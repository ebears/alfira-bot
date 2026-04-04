import type { Readable } from 'node:stream';
import type { LoopMode, QueuedSong, QueueState } from '@alfira-bot/shared';
import { logger } from '@alfira-bot/shared';
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
  private static readonly VOICE_RECONNECT_TIMEOUT_MS = 5_000;
  private static readonly MAX_MISSED_FRAMES = 50;
  private static readonly STREAM_RETRY_ATTEMPTS = 3;
  private static readonly STREAM_RETRY_DELAY_MS = 1_000;
  private static readonly AUDIO_PLAYER_READY_TIMEOUT_MS = 5_000;

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

  /**
   * Setup audio player event listeners.
   */
  private setupAudioPlayerListeners(): void {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this.onTrackEnd());

    this.audioPlayer.on('error', (error) => {
      logger.error(
        { guildId: this.guildId, track: this.currentSong?.title ?? 'unknown' },
        `AudioPlayer error: ${error.message}`
      );
      this.onTrackEnd();
    });

    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
      logger.warn(
        { guildId: this.guildId },
        'AudioPlayer AutoPaused — voice connection may be temporarily unavailable.'
      );
    });
  }

  /**
   * Setup voice connection event listeners.
   */
  private setupConnectionListeners(): void {
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

      logger.warn(
        { guildId: this.guildId },
        'Voice connection disconnected — attempting recovery.'
      );

      try {
        await Promise.race([
          entersState(
            this.connection,
            VoiceConnectionStatus.Signalling,
            GuildPlayer.VOICE_RECONNECT_TIMEOUT_MS
          ),
          entersState(
            this.connection,
            VoiceConnectionStatus.Connecting,
            GuildPlayer.VOICE_RECONNECT_TIMEOUT_MS
          ),
        ]);
        logger.info({ guildId: this.guildId }, 'Voice connection is reconnecting.');
      } catch {
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          logger.error(
            { guildId: this.guildId },
            'Voice connection could not recover — destroying.'
          );
          this.connection.destroy();
        }
      } finally {
        this.isReconnecting = false;
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info({ guildId: this.guildId }, 'Voice connection destroyed.');

      if (!this.intentionallyStopped) {
        this.audioPlayer.stop(true);
        this.killFfmpeg();
        this.queue.clear();
        this.currentSong = null;
        this.sendToTextChannel(
          '⚠️ Lost the voice connection unexpectedly. Use **/play** or **/join** to reconnect.'
        );
      }

      this.broadcast();
      this.onDestroyed();
    });
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

    // MAX_MISSED_FRAMES frames (~1s) before auto-pause — avoids choppiness from brief network jitter.
    this.audioPlayer = createAudioPlayer({
      behaviors: { maxMissedFrames: GuildPlayer.MAX_MISSED_FRAMES },
    });
    this.connection.subscribe(this.audioPlayer);

    this.setupAudioPlayerListeners();
    this.setupConnectionListeners();
  }

  async addToQueue(songs: QueuedSong | QueuedSong[]): Promise<void> {
    const arr = Array.isArray(songs) ? songs : [songs];
    this.queue.append(...arr);

    // If paused, clear currentSong so newly added songs start playing
    // instead of the previously-paused song resuming.
    if (this.paused && this.currentSong !== null) {
      this.currentSong = null;
    }

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
    this.currentSong = null;
    this.paused = false;
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
    this.killCurrentFfmpeg = null;
    this.currentSong = null;
    this.queue.clear();
    this.priorityQueue = [];
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
    return this.queue.toRemaining();
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
      queue: this.queue.toRemaining(),
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
        logger.error({ guildId: this.guildId, err }, 'Failed to send message to text channel')
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

    // Song loop: replay current song and advance readIndex so that
    // disabling loop mode mid-playthrough doesn't cause a ghost loop
    if (this.loopMode === 'song' && this.currentSong) {
      await this.playSong(this.currentSong);
      this.queue.advance();
      return;
    }

    const next = this.queue.current();
    if (!next) {
      this.currentSong = null;
      this.broadcast();
      return;
    }

    this.currentSong = next;
    this.queue.advance();

    await this.playSong(next);
  }

  private async playSong(next: QueuedSong): Promise<void> {
    this.paused = false;

    let streamUrl: string;
    let isWebmOpus: boolean;
    try {
      let lastError: unknown;
      let result: { url: string; isWebmOpus: boolean } | undefined;
      for (let attempt = 0; attempt < GuildPlayer.STREAM_RETRY_ATTEMPTS; attempt++) {
        try {
          result = await getStreamFormat(next.youtubeUrl);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < GuildPlayer.STREAM_RETRY_ATTEMPTS - 1) {
            await new Promise((resolve) => setTimeout(resolve, GuildPlayer.STREAM_RETRY_DELAY_MS));
          }
        }
      }
      if (!result) throw lastError;
      ({ url: streamUrl, isWebmOpus } = result);
    } catch (error) {
      logger.error(
        { guildId: this.guildId, track: next.title, error },
        `Failed to get stream URL after ${GuildPlayer.STREAM_RETRY_ATTEMPTS} attempts`
      );
      await this.handlePlaybackFailure('could not resolve the audio stream');
      return;
    }

    this.killFfmpeg();

    let stream: Readable;
    let kill: () => void;
    let actualIsWebmOpus: boolean;
    try {
      const handle = createAudioStream(streamUrl, isWebmOpus, next.volumeOffset);
      stream = handle.stream;
      kill = handle.kill;
      actualIsWebmOpus = handle.isOutputWebmOpus;
    } catch (error) {
      logger.error({ guildId: this.guildId, track: next.title, error }, 'Failed to spawn FFmpeg');
      await this.handlePlaybackFailure('FFmpeg failed to start');
      return;
    }
    this.killCurrentFfmpeg = kill;

    const resource = createAudioResource(stream, {
      inputType: actualIsWebmOpus ? StreamType.WebmOpus : StreamType.OggOpus,
    });

    this.audioPlayer.play(resource);

    try {
      await entersState(
        this.audioPlayer,
        AudioPlayerStatus.Playing,
        GuildPlayer.AUDIO_PLAYER_READY_TIMEOUT_MS
      );
    } catch {
      logger.error(
        { guildId: this.guildId, track: next.title },
        'AudioPlayer failed to enter Playing state'
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
