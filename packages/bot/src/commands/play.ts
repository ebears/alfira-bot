import type { QueuedSong } from '@alfira-bot/shared';
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { type GuildMember, SlashCommandBuilder, type TextChannel } from 'discord.js';
import prisma from '../lib/prisma';
import { createPlayer } from '../player/manager';
import type { Command } from '../types';
import { getMetadata, isValidYouTubeUrl } from '../utils/ytdlp';
import { requireGuild, requireVoiceChannel } from './guards';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Add a YouTube URL to the queue and start playing.')
    .addStringOption((option) =>
      option.setName('url').setDescription('The YouTube URL to play.').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const url = interaction.options.getString('url', true).trim();

    // ---------------------------------------------------------------------------
    // Validate the URL before doing anything expensive.
    // ---------------------------------------------------------------------------
    if (!isValidYouTubeUrl(url)) {
      await interaction.reply({
        content: '❌ That does not look like a valid YouTube URL.',
        flags: 'Ephemeral',
      });
      return;
    }

    // ---------------------------------------------------------------------------
    // Ensure the user is in a voice channel.
    // ---------------------------------------------------------------------------
    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    // Fetching metadata can take a moment, so defer immediately.
    await interaction.deferReply();

    // ---------------------------------------------------------------------------
    // Fetch song metadata via yt-dlp.
    // ---------------------------------------------------------------------------
    let metadata: Awaited<ReturnType<typeof getMetadata>> | undefined;
    try {
      metadata = await getMetadata(url);
    } catch (error) {
      console.error('Metadata fetch failed:', error);
      await interaction.editReply(
        '❌ Could not fetch song info. The video may be private, age-restricted, or unavailable.'
      );
      return;
    }

    // ---------------------------------------------------------------------------
    // Look up the song in the database by youtubeId.
    //
    // This populates id and addedBy from the real DB record when the song is
    // in the library. If it isn't in the library yet (someone pasted a URL that
    // wasn't added through the web UI), we fall back to empty strings so the
    // bot still plays it — the library is the web UI's domain, not the bot's.
    // ---------------------------------------------------------------------------
    const dbSong = await prisma.song.findUnique({
      where: { youtubeId: metadata.youtubeId },
    });

    // ---------------------------------------------------------------------------
    // Get or create the voice connection.
    //
    // If the bot is already connected (e.g. from a previous /play or /join),
    // reuse that connection. Otherwise join the user's channel.
    // ---------------------------------------------------------------------------
    const guildId = guild.id;
    let connection = getVoiceConnection(guildId);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
      });
    }

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      connection.destroy();
      await interaction.editReply('❌ Could not connect to the voice channel in time. Try again.');
      return;
    }

    // ---------------------------------------------------------------------------
    // Get or create the GuildPlayer for this guild.
    // ---------------------------------------------------------------------------
    const textChannel = interaction.channel as TextChannel;
    const player = createPlayer(guildId, connection, textChannel);

    // ---------------------------------------------------------------------------
    // Build the QueuedSong.
    //
    // If the song exists in the library, use all fields from the DB record so
    // that id and addedBy are real values. If not, fall back to metadata-only
    // values with empty placeholder strings for id and addedBy.
    //
    // Note: getStreamFormat() is NOT called here. The GuildPlayer calls it at
    // playback time so CDN URLs are always fresh for songs in long queues.
    // ---------------------------------------------------------------------------
    const member = interaction.member as GuildMember;
    const song: QueuedSong = dbSong
      ? { ...dbSong, createdAt: dbSong.createdAt.toISOString(), requestedBy: member.displayName }
      : {
          id: '',
          title: metadata.title,
          youtubeUrl: url,
          youtubeId: metadata.youtubeId,
          duration: metadata.duration,
          thumbnailUrl: metadata.thumbnailUrl,
          addedBy: '',
          createdAt: new Date().toISOString(),
          requestedBy: member.displayName,
        };

    const queueLength = player.getQueue().length;
    const isPlaying = player.isPlaying();

    await player.addToQueue(song);

    // ---------------------------------------------------------------------------
    // Reply. If something was already playing, confirm the song was queued
    // rather than pretending it started playing immediately.
    // ---------------------------------------------------------------------------
    if (isPlaying || queueLength > 0) {
      await interaction.editReply(
        `✅ Added to queue (position ${queueLength + 1}): **${song.title}**`
      );
    } else {
      await interaction.editReply(`✅ Starting playback: **${song.title}**`);
    }
  },
};
