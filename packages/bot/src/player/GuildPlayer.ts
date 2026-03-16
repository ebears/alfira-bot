import type { Readable } from 'node:stream';
import type { LoopMode, QueuedSong, QueueState } from '@alfira-bot/shared';
import {
  type AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  StreamType,
  type VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import type { EmbedBuilder, TextChannel } from 'discord.js';
import { broadcastQueueUpdate } from '../lib/broadcast';
import { buildNowPlayingEmbed } from '../utils/format';
import { createAudioStream, getStreamFormat } from '../utils/ytdlp';
import { PlaybackCursor } from './PlaybackCursor';

export class GuildPlayer {
  private static readonly MAX_CONSECUTIVE_FAILURES = 3;

  private queue: PlaybackCursor<QueuedSong> = new PlaybackCursor();
  private priorityQueue: QueuedSong[] = [];
  private currentSong: QueuedSong | null = null;
  private loopMode: LoopMode = 'off';
  private paused = false;
  private stopping = false;
  private trackStartedAt: number | null = null;
  private pausedAt: number | null = null;
  private consecutiveFailures = 0;

  // Set by stop() so Destroyed handler can distinguish intentional vs unexpected teardown.
  private intentionallyStopped = false;

  private isReconnecting = false;

  // FFmpeg kill function, stored to prevent zombie processes on skip/stop.
  private killCurrentFfmpeg: (() => void) | null = null;

  private readonly connection: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;
  private readonly guildId: string;
  private readonly textChannel: TextChannel;
  private readonly onDestroyed: () => void;

  private killFfmpeg(): void {
    this.killCurrentFfmpeg?.();
    this.killCurrentFfmpeg = null;
  }

  private unpause(): void {
    this.audioPlayer.unpause();
    this.paused = false;
  }

  constructor(
    connection: VoiceConnection,
    textChannel: TextChannel,
    guildId: string,
    onDestroyed: () => void
  ) {
    this.connection = connection;
    this.textChannel = textChannel;
    this.guildId = guildId;
    this.onDestroyed = onDestroyed;

    // 50 frames (~1s) before auto-pause — avoids choppiness from brief network jitter.
    this.audioPlayer = createAudioPlayer({ behaviors: { maxMissedFrames: 50 } });
    this.connection.subscribe(this.audioPlayer);

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this.onTrackEnd());

    this.audioPlayer.on('error', (error) => {
      console.error(
        `[GuildPlayer:${this.guildId}] AudioPlayer error:`,
        error.message,
        '| Track:',
        this.currentSong?.title ?? 'unknown'
      );
      this.onTrackEnd();
    });

    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
      console.warn(
        `[GuildPlayer:${this.guildId}] AudioPlayer AutoPaused — voice connection may be temporarily unavailable.`
      );
    });

    // Clear UDP keepAlive to prevent periodic stutters.
    this.connection.on('stateChange', (oldState, newState) => {
      const oldNetworking = Reflect.get(oldState, 'networking');
      const newNetworking = Reflect.get(newState, 'networking');

      const networkStateChangeHandler = (_: unknown, newNetworkState: object) => {
        const newUdp = Reflect.get(newNetworkState, 'udp');
        clearInterval(newUdp?.keepAliveInterval);
      };

      oldNetworking?.off('stateChange', networkStateChangeHandler);
      newNetworking?.on('stateChange', networkStateChangeHandler);
    });

    // Give Discord 5s to reconnect before destroying.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;

      console.warn(
        `[GuildPlayer:${this.guildId}] Voice connection disconnected — attempting recovery.`
      );

      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.info(`[GuildPlayer:${this.guildId}] Voice connection is reconnecting.`);
      } catch {
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          console.error(
            `[GuildPlayer:${this.guildId}] Voice connection could not recover — destroying.`
          );
          this.connection.destroy();
        }
      } finally {
        this.isReconnecting = false;
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.info(`[GuildPlayer:${this.guildId}] Voice connection destroyed.`);

      if (!this.intentionallyStopped) {
        this.audioPlayer.stop(true);
        this.killFfmpeg();
        this.queue.clear();
        this.currentSong = null;
        this.broadcast();
        this.sendToTextChannel(
          '⚠️ Lost the voice connection unexpectedly. Use **/play** or **/join** to reconnect.'
        );
      }

      this.onDestroyed();
    });
  }

  async addToQueue(songs: QueuedSong | QueuedSong[]): Promise<void> {
    const arr = Array.isArray(songs) ? songs : [songs];
    this.queue.append(...arr);
    await this.ensurePlaying();
  }

  async addToPriorityQueue(song: QueuedSong): Promise<void> {
    this.priorityQueue.push(song);
    await this.ensurePlaying();
  }

  async replaceQueueAndPlay(songs: QueuedSong[]): Promise<void> {
    this.queue.clear();
    this.priorityQueue = [];
    this.killFfmpeg();
    this.audioPlayer.stop(true);
    this.consecutiveFailures = 0;
    this.queue.replace(songs);
    await this.playNext();
    this.broadcast();
  }

  skip(): void {
    if (this.currentSong === null) return;

    // Unpause first — .stop() on a paused player doesn't trigger Idle.
    if (this.paused) {
      this.unpause();
    }

    this.audioPlayer.stop();
  }

  stop(): void {
    this.intentionallyStopped = true;
    this.stopping = true;
    this.audioPlayer.stop(true);
    this.paused = false;
    this.trackStartedAt = null;
    this.broadcast();
  }

  clearQueue(): void {
    this.queue.clear();
    this.broadcast();
  }

  shuffle(): void {
    this.queue.shuffle();
    this.broadcast();
  }

  unshuffle(): void {
    this.queue.unshuffle();
    this.broadcast();
  }

  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
    this.broadcast();
  }

  togglePause(): boolean {
    if (!this.currentSong) return false;

    if (this.paused) {
      if (this.pausedAt !== null) {
        const pauseDuration = Date.now() - this.pausedAt;
        if (this.trackStartedAt !== null) {
          this.trackStartedAt += pauseDuration;
        }
        this.pausedAt = null;
      }
      this.unpause();
    } else {
      this.pausedAt = Date.now();
      this.audioPlayer.pause(true);
      this.paused = true;
    }

    this.broadcast();
    return this.paused;
  }

  getCurrentSong(): QueuedSong | null {
    return this.currentSong;
  }

  getQueue(): QueuedSong[] {
    return this.queue.toArray();
  }

  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  isPlaying(): boolean {
    return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
  }

  getQueueState(): QueueState {
    return {
      isPlaying: this.isPlaying(),
      isPaused: this.paused,
      isConnectedToVoice: this.connection.state.status !== VoiceConnectionStatus.Destroyed,
      loopMode: this.loopMode,
      isShuffled: this.queue.isShuffled,
      currentSong: this.currentSong,
      priorityQueue: this.priorityQueue,
      queue: this.queue.toArray(),
      trackStartedAt: this.trackStartedAt,
    };
  }

  private async ensurePlaying(): Promise<void> {
    if (this.currentSong === null) {
      await this.playNext();
    } else {
      this.broadcast();
    }
  }

  private broadcast(): void {
    broadcastQueueUpdate(this.getQueueState());
  }

  private sendToTextChannel(message: string | { embeds: EmbedBuilder[] }): void {
    this.textChannel
      .send(message)
      .catch((err) =>
        console.error(`[GuildPlayer:${this.guildId}] Failed to send message to text channel:`, err)
      );
  }

  private async playNext(): Promise<void> {
    if (this.connection.state.status === VoiceConnectionStatus.Destroyed) return;

    const prioritySong = this.priorityQueue.shift();
    if (prioritySong) {
      this.currentSong = prioritySong;
      this.paused = false;
      await this.playSong(prioritySong);
      return;
    }

    if (this.queue.isAtEnd) {
      if (this.loopMode === 'queue' && !this.queue.isEmpty) {
        this.queue.reset();
      } else if (this.loopMode === 'song' && this.currentSong) {
        await this.playSong(this.currentSong);
        return;
      } else {
        this.currentSong = null;
        this.queue.clear();
        this.broadcast();
        return;
      }
    }

    const next = this.queue.current();
    if (!next) {
      this.currentSong = null;
      this.broadcast();
      return;
    }

    this.currentSong = next;

    if (this.loopMode !== 'song') {
      this.queue.advance();
    }

    await this.playSong(next);
  }

  private async playSong(next: QueuedSong): Promise<void> {
    this.paused = false;

    let streamUrl: string;
    let isWebmOpus: boolean;
    try {
      let lastError: unknown;
      let result: { url: string; isWebmOpus: boolean } | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await getStreamFormat(next.youtubeUrl);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
        }
      }
      if (!result) throw lastError;
      ({ url: streamUrl, isWebmOpus } = result);
    } catch (error) {
      console.error(
        `[GuildPlayer:${this.guildId}] Failed to get stream URL for "${next.title}" after 3 attempts:`,
        error
      );
      await this.handlePlaybackFailure('could not resolve the audio stream');
      return;
    }

    this.killFfmpeg();

    let stream: Readable;
    let kill: () => void;
    try {
      const handle = createAudioStream(streamUrl, isWebmOpus);
      stream = handle.stream;
      kill = handle.kill;
    } catch (error) {
      console.error(
        `[GuildPlayer:${this.guildId}] Failed to spawn FFmpeg for "${next.title}":`,
        error
      );
      await this.handlePlaybackFailure('FFmpeg failed to start');
      return;
    }
    this.killCurrentFfmpeg = kill;

    const resource = createAudioResource(stream, {
      inputType: isWebmOpus ? StreamType.WebmOpus : StreamType.OggOpus,
    });

    this.audioPlayer.play(resource);

    try {
      await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
    } catch {
      console.error(
        `[GuildPlayer:${this.guildId}] AudioPlayer failed to enter Playing state for "${next.title}"`
      );
      await this.handlePlaybackFailure('audio failed to start');
      return;
    }

    this.consecutiveFailures = 0;
    this.trackStartedAt = Date.now();
    this.pausedAt = null;
    this.broadcast();
    this.sendToTextChannel({ embeds: [buildNowPlayingEmbed(next, this.loopMode)] });
  }

  private async handlePlaybackFailure(skipMessage: string): Promise<void> {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= GuildPlayer.MAX_CONSECUTIVE_FAILURES) {
      this.sendToTextChannel(
        `⚠️ **${GuildPlayer.MAX_CONSECUTIVE_FAILURES}** consecutive failures — stopping playback. Use **/play** to try again.`
      );
      this.stop();
      return;
    }
    this.sendToTextChannel(
      `⚠️ Skipping **${this.currentSong?.title ?? 'unknown'}** — ${skipMessage}`
    );
    await this.playNext();
  }

  private async onTrackEnd(): Promise<void> {
    this.trackStartedAt = null;
    this.pausedAt = null;

    if (this.stopping) {
      this.stopping = false;
      return;
    }

    if (!this.currentSong) return;

    await this.playNext();
  }
}
