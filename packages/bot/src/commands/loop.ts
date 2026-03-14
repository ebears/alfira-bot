import type { LoopMode } from '@alfira-bot/shared';
import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';
import { formatLoopMode } from '../utils/format';
import { requireGuild } from './guards';

const modeLabels: Record<LoopMode, string> = {
  off: 'off',
  song: 'the current song',
  queue: 'the entire queue',
};

export const loopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('The loop mode to set.')
        .setRequired(true)
        .addChoices(
          { name: '⬛ Off — play through the queue once', value: 'off' },
          { name: '🔂 Song — repeat the current song', value: 'song' },
          { name: '🔁 Queue — loop the entire queue', value: 'queue' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const player = getPlayer(guild.id);

    if (!player) {
      await interaction.reply({ content: 'Nothing is playing.', flags: 'Ephemeral' });
      return;
    }

    const mode = interaction.options.getString('mode', true) as LoopMode;
    player.setLoopMode(mode);

    await interaction.reply(`${formatLoopMode(mode)} Looping **${modeLabels[mode]}**.`);
  },
};
