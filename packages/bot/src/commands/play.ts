import type { QueuedSong } from '@alfira-bot/shared';
import prisma from '@alfira-bot/shared/prisma';
import { type GuildMember, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { getMetadata, isValidYouTubeUrl } from '../utils/ytdlp';
import { getOrCreateConnection, requireGuild, requireVoiceChannel } from './guards';

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

    if (!isValidYouTubeUrl(url)) {
      await interaction.reply({
        content: '❌ That does not look like a valid YouTube URL.',
        flags: 'Ephemeral',
      });
      return;
    }

    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    // Fetching metadata can take a moment, so defer immediately.
    await interaction.deferReply();

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

    const dbSong = await prisma.song.findUnique({
      where: { youtubeId: metadata.youtubeId },
    });

    const player = await getOrCreateConnection(interaction, guild, voiceChannel);
    if (!player) return;

    // Use DB record fields when available; fall back to metadata with empty id/addedBy.
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

    if (isPlaying || queueLength > 0) {
      await interaction.editReply(
        `✅ Added to queue (position ${queueLength + 1}): **${song.title}**`
      );
    } else {
      await interaction.editReply(`✅ Starting playback: **${song.title}**`);
    }
  },
};
