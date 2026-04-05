import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';
import { pluralize } from '../utils/format';
import { requireGuild, requireVoiceChannel } from './guards';

export const shuffleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the upcoming queue. Does not affect the current song.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    const player = getPlayer(guild.id);
    const queue = player?.getQueue() ?? [];

    if (!player || queue.length === 0) {
      await interaction.reply({
        content: 'There are no queued songs to shuffle.',
        flags: 'Ephemeral',
      });
      return;
    }

    player.shuffle();

    await interaction.reply(`🔀 Shuffled ${pluralize(queue.length, 'song')} in the queue.`);
  },
};
