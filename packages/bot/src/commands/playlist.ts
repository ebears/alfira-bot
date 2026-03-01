import { SlashCommandBuilder, GuildMember, ChannelType, TextChannel } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { Prisma } from '../../../api/src/generated/prisma/client';
import prisma from '../lib/prisma';

// ---------------------------------------------------------------------------
// Describes a PlaylistSong row with its nested Song relation included.
// Derived directly from Prisma's generated types so it stays in sync with
// the schema automatically — no manual duplication required.
// ---------------------------------------------------------------------------
type PlaylistSongWithSong = Prisma.PlaylistSongGetPayload<{ include: { song: true } }>;
import { getPlayer, createPlayer } from '../player/manager';
import type { QueuedSong } from '@discord-music-bot/shared';
import type { Command } from '../types';

export const playlistCommand: Command = {
  // SlashCommandBuilder (not the Omit variant) because addSubcommand is used.
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Playlist commands.')
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Load a saved playlist into the queue and start playing.')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('The name of the playlist to play.')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: 'Ephemeral',
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    // ---------------------------------------------------------------------------
    // /playlist play [name]
    // ---------------------------------------------------------------------------
    if (subcommand === 'play') {
      const name = interaction.options.getString('name', true).trim();

      // Ensure the user is in a voice channel before hitting the database.
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

      // Database lookup can take a moment; defer immediately.
      await interaction.deferReply();

      // ---------------------------------------------------------------------------
      // Look up the playlist by name.
      //
      // Case-insensitive match so "My Mix" and "my mix" both work. If the user
      // has multiple playlists whose names differ only by case, the first one
      // (by createdAt) is returned — an edge case not worth special-casing here.
      // ---------------------------------------------------------------------------
      const playlist = await prisma.playlist.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        include: {
          songs: {
            orderBy: { position: 'asc' },
            include: { song: true },
          },
        },
      });

      if (!playlist) {
        await interaction.editReply(
          `❌ No playlist found named **${name}**. Check your spelling or use the web UI to see all playlists.`
        );
        return;
      }

      if (playlist.songs.length === 0) {
        await interaction.editReply(
          `❌ **${playlist.name}** exists but has no songs in it yet.`
        );
        return;
      }

      // ---------------------------------------------------------------------------
      // Get or create the voice connection.
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
      // Get or create the GuildPlayer.
      // ---------------------------------------------------------------------------
      const textChannel = interaction.channel as TextChannel;
      const player = createPlayer(interaction.guild.id, connection, textChannel);

      // ---------------------------------------------------------------------------
      // Build QueuedSong objects from the PlaylistSong records.
      //
      // ps.song is the full Song DB record (id, addedBy, etc.), so unlike the
      // /play command there are no placeholder fields here.
      // ---------------------------------------------------------------------------
      const queuedSongs: QueuedSong[] = playlist.songs.map((ps: PlaylistSongWithSong) => ({
        ...ps.song,
        requestedBy: member.displayName,
      }));

      await player.addManyToQueue(queuedSongs);

      const count = queuedSongs.length;
      await interaction.editReply(
        `✅ Queued **${count}** song${count === 1 ? '' : 's'} from **${playlist.name}**.`
      );
    }
  },
};
