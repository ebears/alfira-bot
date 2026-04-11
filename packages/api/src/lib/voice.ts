import { createPlayer, getClient, getPlayer, VOICE_CONNECTION_TIMEOUT_MS } from '@alfira-bot/bot';
import { entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import type { TextChannel } from 'discord.js';
import { GUILD_ID, logger } from './config';
import { json } from './json';

/**
 * Verifies the requesting user is in a voice channel.
 * Returns true if in voice, error Response otherwise.
 */
export async function requireUserInVoice(discordId: string): Promise<true | Response> {
  const client = getClient();
  if (!client) {
    return json({ error: 'Discord bot is not ready yet.' }, 503);
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);

    if (!member.voice.channel) {
      return json({ error: 'You must be in a voice channel to control playback.' }, 403);
    }

    return true;
  } catch (error) {
    logger.error({ err: error as Error }, 'Failed to verify voice channel membership');
    return json({ error: 'Could not verify voice channel membership.' }, 503);
  }
}

/**
 * Returns existing player or auto-joins the user's voice channel.
 * Returns the player on success, error Response on failure.
 */
export async function resolveOrAutoJoinPlayer(
  discordId: string
): Promise<
  | { ok: true; player: NonNullable<ReturnType<typeof getPlayer>> }
  | { ok: false; response: Response }
> {
  const existingPlayer = getPlayer(GUILD_ID);
  if (existingPlayer) {
    return { ok: true, player: existingPlayer };
  }

  const discordClient = getClient();
  if (!discordClient) {
    return { ok: false, response: json({ error: 'Discord bot is not ready yet.' }, 503) };
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return {
        ok: false,
        response: json(
          {
            error: 'You are not in a voice channel. Join a voice channel in Discord first.',
          },
          409
        ),
      };
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, VOICE_CONNECTION_TIMEOUT_MS);

    const textChannelId = process.env.DEFAULT_TEXT_CHANNEL_ID;
    const textChannel = textChannelId
      ? (guild.channels.cache.get(textChannelId) as TextChannel | undefined)
      : (guild.systemChannel as TextChannel | null);

    if (!textChannel) {
      return {
        ok: false,
        response: json(
          {
            error:
              'Could not find a text channel for "Now playing" messages. Set DEFAULT_TEXT_CHANNEL_ID in your environment.',
          },
          503
        ),
      };
    }

    return { ok: true, player: createPlayer(GUILD_ID, connection, textChannel) };
  } catch (error) {
    logger.error({ err: error as Error }, 'Failed to auto-join voice channel');
    return {
      ok: false,
      response: json(
        {
          error: 'Could not connect to your voice channel. Try using /join in Discord first.',
        },
        503
      ),
    };
  }
}
