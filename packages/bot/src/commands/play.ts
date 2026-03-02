import { SlashCommandBuilder, GuildMember, ChannelType, TextChannel } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import { isValidYouTubeUrl, getMetadata } from '../utils/ytdlp';
import prisma from '../lib/prisma';
import { getPlayer, createPlayer } from '../player/manager';
import type { QueuedSong } from '@discord-music-bot/shared';
import type { Command } from '../types';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Add a YouTube URL to the queue and start playing.')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('The YouTube URL to play.')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: 'Ephemeral',
      });
      return;
    }

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
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (
      !voiceChannel ||
      (voiceChannel.type !== ChannelType.GuildVoice &&
        voiceChannel.type !== ChannelType.GuildStageVoice)
    ) {
      await interaction.reply({
        content: 'You need to be in a voice channel to use this command.',
        flags: 'Ephemeral',
      });
      return;
    }

    // Fetching metadata can take a moment, so defer immediately.
    await interaction.deferReply();

    // ---------------------------------------------------------------------------
    // Fetch song metadata via yt-dlp.
    // ---------------------------------------------------------------------------
    let metadata;
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
    let connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
    }

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      connection.destroy();
      await interaction.editReply(
        '❌ Could not connect to the voice channel in time. Try again.'
      );
      return;
    }

    // ---------------------------------------------------------------------------
    // Get or create the GuildPlayer for this guild.
    // ---------------------------------------------------------------------------
    const textChannel = interaction.channel as TextChannel;
    const player = createPlayer(interaction.guild.id, connection, textChannel);

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
    const song: QueuedSong = dbSong
      ? { ...dbSong, requestedBy: member.displayName }
      : {
          id: '',
          title: metadata.title,
          youtubeUrl: url,
          youtubeId: metadata.youtubeId,
          duration: metadata.duration,
          thumbnailUrl: metadata.thumbnailUrl,
          addedBy: '',
          createdAt: new Date(),
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
