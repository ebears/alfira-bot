import {
  VoiceConnection,
  AudioPlayer,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} from '@discordjs/voice';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { getStreamUrl } from '../utils/ytdlp';
import type { QueuedSong, LoopMode, QueueState } from '@discord-music-bot/shared';

export class GuildPlayer {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  private queue: QueuedSong[] = [];
  private currentSong: QueuedSong | null = null;
  private loopMode: LoopMode = 'off';

  // A snapshot of the queue taken at the start of each full playthrough.
  // Used to reset the queue when loopMode is 'queue' and the list exhausts.
  private queueSnapshot: QueuedSong[] = [];

  // Set to true by skip() so onTrackEnd() knows to advance regardless of
  // loop mode. Without this, skipping in 'song' mode would just replay.
  private skipping = false;

  private readonly connection: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;

  // The text channel where the bot will post "Now playing" embeds when
  // auto-advancing between tracks (i.e. not triggered by a slash command).
  private readonly textChannel: TextChannel;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  constructor(connection: VoiceConnection, textChannel: TextChannel) {
    this.connection = connection;
    this.textChannel = textChannel;

    this.audioPlayer = createAudioPlayer();
    this.connection.subscribe(this.audioPlayer);

    // When a track finishes (or is stopped), decide what to play next.
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.onTrackEnd();
    });

    this.audioPlayer.on('error', (error) => {
      console.error(
        `AudioPlayer error in guild ${this.textChannel.guildId}:`,
        error.message,
        '| Track:',
        this.currentSong?.title ?? 'unknown'
      );
      // Treat an error as a track end so the queue keeps moving.
      this.onTrackEnd();
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a song to the end of the queue.
   * If nothing is currently playing, playback starts immediately.
   */
  async addToQueue(song: QueuedSong): Promise<void> {
    this.queue.push(song);
    if (this.currentSong === null) {
      await this.playNext();
    }
  }

  /**
   * Skip the current song and immediately advance to the next one.
   * Works regardless of loop mode.
   */
  async skip(): Promise<void> {
    if (this.currentSong === null) return;
    this.skipping = true;
    // Stopping the AudioPlayer triggers AudioPlayerStatus.Idle,
    // which calls onTrackEnd(). The skipping flag tells it to advance.
    this.audioPlayer.stop();
  }

  /**
   * Stop playback, clear the queue, and destroy the voice connection.
   * After calling this, the GuildPlayer instance should be discarded.
   */
  stop(): void {
    this.queue = [];
    this.queueSnapshot = [];
    this.currentSong = null;
    this.audioPlayer.stop(true); // true = force-stop, suppresses the Idle event
    this.connection.destroy();
  }

  /**
   * Shuffle the upcoming queue in place using Fisher-Yates.
   * The currently playing song is not affected.
   */
  shuffle(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  /**
   * Change the loop mode.
   */
  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
  }

  // ---------------------------------------------------------------------------
  // Getters (read-only views of internal state for commands to display)
  // ---------------------------------------------------------------------------

  getCurrentSong(): QueuedSong | null {
    return this.currentSong;
  }

  getQueue(): QueuedSong[] {
    // Return a shallow copy so callers can't accidentally mutate the queue.
    return [...this.queue];
  }

  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  isPlaying(): boolean {
    return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
  }

  // ---------------------------------------------------------------------------
  // getQueueState
  //
  // Returns a QueueState snapshot. Used by GET /api/player/queue and will
  // also be the payload for the Socket.io player:update event in Phase 8.
  // ---------------------------------------------------------------------------
  getQueueState(): QueueState {
    return {
      isPlaying: this.isPlaying(),
      loopMode: this.loopMode,
      currentSong: this.currentSong,
      queue: [...this.queue],
    };
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * Pull the next song off the queue and start playing it.
   * Fetches a fresh CDN URL at playback time (not at enqueue time) to avoid
   * using stale URLs for tracks that have been waiting in a long queue.
   */
  private async playNext(): Promise<void> {
    const next = this.queue.shift();

    if (!next) {
      this.currentSong = null;
      return;
    }

    this.currentSong = next;

    let streamUrl: string;
    try {
      streamUrl = await getStreamUrl(next.youtubeUrl);
    } catch (error) {
      console.error(`Failed to get stream URL for "${next.title}":`, error);
      await this.textChannel.send(
        `⚠️ Skipping **${next.title}** — could not resolve the audio stream.`
      );
      // Try the next song instead.
      await this.playNext();
      return;
    }

    const resource: AudioResource = createAudioResource(streamUrl, {
      inputType: StreamType.Arbitrary,
    });

    this.audioPlayer.play(resource);

    try {
      await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
    } catch {
      console.error(`AudioPlayer failed to enter Playing state for "${next.title}"`);
      await this.textChannel.send(
        `⚠️ Skipping **${next.title}** — audio failed to start.`
      );
      await this.playNext();
      return;
    }

    await this.textChannel.send({ embeds: [this.buildNowPlayingEmbed(next)] });
  }

  /**
   * Called when the AudioPlayer becomes Idle (track finished or errored).
   * Applies loop logic and advances the queue.
   */
  private async onTrackEnd(): Promise<void> {
    const finished = this.currentSong;
    const wasSkipping = this.skipping;
    this.skipping = false;

    if (!finished) return;

    if (this.loopMode === 'song' && !wasSkipping) {
      // Re-queue the same song at the front.
      this.queue.unshift(finished);
    } else if (this.loopMode === 'queue') {
      // Append the finished song to the back so the queue cycles continuously.
      this.queue.push(finished);
    }

    await this.playNext();
  }

  /**
   * Build a "Now playing" embed for auto-advance announcements.
   */
  private buildNowPlayingEmbed(song: QueuedSong): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x5865f2) // Discord blurple
      .setTitle('▶️  Now Playing')
      .setDescription(`**[${song.title}](${song.youtubeUrl})**`)
      .setThumbnail(song.thumbnailUrl)
      .addFields(
        { name: 'Duration', value: formatDuration(song.duration), inline: true },
        { name: 'Requested by', value: song.requestedBy, inline: true },
        { name: 'Loop', value: formatLoopMode(this.loopMode), inline: true }
      );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatLoopMode(mode: LoopMode): string {
  return { off: '⬛ Off', song: '🔂 Song', queue: '🔁 Queue' }[mode];
}
