import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import { formatLoopMode } from '../utils/format';
import type { Command, LoopMode } from '../types';

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
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.reply({ content: 'Nothing is playing.', flags: 'Ephemeral' });
      return;
    }

    const mode = interaction.options.getString('mode', true) as LoopMode;
    player.setLoopMode(mode);

    const confirmations: Record<LoopMode, string> = {
      off:   `${formatLoopMode('off')} Loop is now **off**.`,
      song:  `${formatLoopMode('song')} Looping the **current song**.`,
      queue: `${formatLoopMode('queue')} Looping the **entire queue**.`,
    };

    await interaction.reply(confirmations[mode]);
  },
};
