import { PLAYLIST_SONGS_INCLUDE, toQueuedSong } from '@alfira-bot/shared';
import prisma from '@alfira-bot/shared/prisma';
import { type GuildMember, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { pluralize } from '../utils/format';
import { getOrCreateConnection, requireGuild, requireVoiceChannel } from './guards';

export const playlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Playlist commands.')
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Load a saved playlist into the queue and start playing.')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('The name of the playlist to play.').setRequired(true)
        )
    ),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'play') {
      const name = interaction.options.getString('name', true).trim();

      const voiceChannel = await requireVoiceChannel(interaction);
      if (!voiceChannel) return;

      // Database lookup can take a moment; defer immediately.
      await interaction.deferReply();

      const playlist = await prisma.playlist.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        include: PLAYLIST_SONGS_INCLUDE,
      });

      if (!playlist) {
        await interaction.editReply(
          `❌ No playlist found named **${name}**. Check your spelling or use the web UI to see all playlists.`
        );
        return;
      }

      if (playlist.songs.length === 0) {
        await interaction.editReply(`❌ **${playlist.name}** exists but has no songs in it yet.`);
        return;
      }

      const player = await getOrCreateConnection(interaction, guild, voiceChannel);
      if (!player) return;

      const member = interaction.member as GuildMember;
      const queuedSongs = playlist.songs.map((ps) =>
        toQueuedSong({ ...ps.song, createdAt: ps.song.createdAt.toISOString() }, member.displayName)
      );

      await player.addToQueue(queuedSongs);

      const count = queuedSongs.length;
      await interaction.editReply(
        `✅ Queued **${pluralize(count, 'song')}** from **${playlist.name}**.`
      );
    }
  },
};
