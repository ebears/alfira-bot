import { SlashCommandBuilder, GuildMember, ChannelType, TextChannel } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import { isValidYouTubeUrl, getMetadata } from '../utils/ytdlp';
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
    // Fetch song metadata.
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
    //
    // The text channel is passed so the player can send "Now playing" embeds
    // when auto-advancing between tracks (where there's no interaction to reply to).
    // ---------------------------------------------------------------------------
    const textChannel = interaction.channel as TextChannel;
    const player = createPlayer(interaction.guild.id, connection, textChannel);

    // ---------------------------------------------------------------------------
    // Build the Song object and hand it to the player.
    //
    // Note: getStreamUrl() is NOT called here. The GuildPlayer calls it at
    // playback time, just before creating the AudioResource. This ensures CDN
    // URLs are always fresh, even for songs that sat in the queue for a while.
    // ---------------------------------------------------------------------------
    const song: QueuedSong = {
      id: '',  // Not yet persisted — Phase 4 replaces this with the DB record's ID
      title: metadata.title,
      youtubeUrl: url,
      youtubeId: metadata.youtubeId,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl,
      addedBy: '',       // Not yet persisted — Phase 4 fills this from the DB record
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
      // The player was idle, so addToQueue() started playback. The GuildPlayer
      // will send the "Now playing" embed to the text channel automatically.
      await interaction.editReply(`✅ Starting playback: **${song.title}**`);
    }
  },
};
