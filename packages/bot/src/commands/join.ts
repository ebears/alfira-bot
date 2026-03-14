import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { getOrCreateConnection, requireGuild, requireVoiceChannel } from './guards';

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
      const player = await getOrCreateConnection(interaction, guild, voiceChannel);

      if (player) {
        await interaction.editReply(`✅ Joined **${voiceChannel.name}**.`);
      }
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      await interaction.editReply(
        '❌ Could not join the voice channel. Check that I have the **Connect** permission.'
      );
    }
  },
};
