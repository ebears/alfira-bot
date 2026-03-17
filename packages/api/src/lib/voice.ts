import { createPlayer, getClient, getPlayer } from '@alfira-bot/bot';
import { entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import type { TextChannel } from 'discord.js';
import type { Request, Response } from 'express';
import { GUILD_ID, logger } from './config';

// ---------------------------------------------------------------------------
// Voice channel helpers
//
// Handles auto-joining the user's voice channel when the bot isn't already
// connected. Extracted from the player route to keep HTTP handling separate
// from Discord voice connection logic.
// ---------------------------------------------------------------------------

/** Returns existing player or auto-joins the user's voice channel. */
export async function resolveOrAutoJoinPlayer(
  req: Request,
  res: Response
): Promise<ReturnType<typeof getPlayer> | null> {
  const existingPlayer = getPlayer(GUILD_ID);
  if (existingPlayer) {
    return existingPlayer;
  }

  const discordClient = getClient();
  if (!discordClient) {
    res.status(503).json({ error: 'Discord bot is not ready yet.' });
    return null;
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user?.discordId ?? '');
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      res.status(409).json({
        error: 'You are not in a voice channel. Join a voice channel in Discord first.',
      });
      return null;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

    const textChannelId = process.env.DEFAULT_TEXT_CHANNEL_ID;
    const textChannel = textChannelId
      ? (guild.channels.cache.get(textChannelId) as TextChannel | undefined)
      : (guild.systemChannel as TextChannel | null);

    if (!textChannel) {
      res.status(503).json({
        error:
          'Could not find a text channel for "Now playing" messages. Set DEFAULT_TEXT_CHANNEL_ID in your environment.',
      });
      return null;
    }

    return createPlayer(GUILD_ID, connection, textChannel);
  } catch (error) {
    logger.error({ err: error as Error }, 'Failed to auto-join voice channel');
    res.status(503).json({
      error: 'Could not connect to your voice channel. Try using /join in Discord first.',
    });
    return null;
  }
}
