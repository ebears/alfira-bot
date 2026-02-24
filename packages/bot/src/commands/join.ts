import { SlashCommandBuilder, GuildMember, ChannelType } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import type { Command } from '../types';

export const joinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel.'),

  async execute(interaction) {
    // Ensure the command is used inside a guild.
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: 'Ephemeral',
      });
      return;
    }

    // Fetch the member's current voice state.
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: 'You need to be in a voice channel first.',
        flags: 'Ephemeral',
      });
      return;
    }

    // Only stage and regular voice channels are joinable.
    if (
      voiceChannel.type !== ChannelType.GuildVoice &&
      voiceChannel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: 'That channel type is not supported.',
        flags: 'Ephemeral',
      });
      return;
    }

    await interaction.deferReply();

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      // Wait until the connection is ready (or fail after 5 seconds).
      // Without this, subsequent audio operations may fire before the
      // WebSocket handshake with Discord's voice server is complete.
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

      await interaction.editReply(`✅ Joined **${voiceChannel.name}**.`);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      await interaction.editReply(
        '❌ Could not join the voice channel. Check that I have the **Connect** permission.'
      );
    }
  },
};
