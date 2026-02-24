import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';

// Maximum number of queued songs to list before truncating.
// Discord embeds have a 6000 character total limit. At ~60 chars per entry,
// 10 entries is a safe ceiling that leaves room for the rest of the embed.
const MAX_QUEUE_DISPLAY = 10;

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    const current = player?.getCurrentSong() ?? null;
    const queue = player?.getQueue() ?? [];
    const loopMode = player?.getLoopMode() ?? 'off';

    if (!current && queue.length === 0) {
      await interaction.reply({ content: 'The queue is empty.', flags: 'Ephemeral' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎵  Queue');

    // ---------------------------------------------------------------------------
    // Now playing section
    // ---------------------------------------------------------------------------
    if (current) {
      embed.addFields({
        name: '▶️  Now Playing',
        value: `**[${current.title}](${current.youtubeUrl})** — ${formatDuration(current.duration)}`,
      });
    }

    // ---------------------------------------------------------------------------
    // Upcoming songs
    // ---------------------------------------------------------------------------
    if (queue.length > 0) {
      const visible = queue.slice(0, MAX_QUEUE_DISPLAY);
      const overflow = queue.length - visible.length;

      const lines = visible.map(
        (song, i) =>
          `\`${i + 1}.\` [${song.title}](${song.youtubeUrl}) — ${formatDuration(song.duration)}`
      );

      if (overflow > 0) {
        lines.push(`*...and ${overflow} more*`);
      }

      embed.addFields({ name: '⏭️  Up Next', value: lines.join('\n') });
    }

    // ---------------------------------------------------------------------------
    // Footer: total count and loop mode
    // ---------------------------------------------------------------------------
    const loopLabels = { off: '⬛ Off', song: '🔂 Song', queue: '🔁 Queue' };
    const totalSongs = queue.length + (current ? 1 : 0);

    embed.setFooter({
      text: `${totalSongs} song${totalSongs === 1 ? '' : 's'} total  •  Loop: ${loopLabels[loopMode]}`,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
