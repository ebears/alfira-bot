import { entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { SlashCommandBuilder, type TextChannel } from 'discord.js';
import { createPlayer } from '../player/manager';
import type { Command } from '../types';
import { requireGuild, requireVoiceChannel } from './guards';

export const joinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    await interaction.deferReply();

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      // Wait until the connection is ready (or fail after 5 seconds).
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

      // Create a GuildPlayer for this guild so the web UI can immediately
      // start playback via POST /api/player/play without needing a Discord
      // slash command first. The text channel is used for "Now playing" embeds.
      const textChannel = interaction.channel as TextChannel;
      createPlayer(guild.id, connection, textChannel);

      await interaction.editReply(`✅ Joined **${voiceChannel.name}**.`);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      await interaction.editReply(
        '❌ Could not join the voice channel. Check that I have the **Connect** permission.'
      );
    }
  },
};
