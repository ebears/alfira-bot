import type { LoopMode, QueuedSong, QueueState } from '@alfira-bot/shared';
import { logger } from '@alfira-bot/shared/logger';
import type { EmbedBuilder, TextChannel } from 'discord.js';
import { DestroyReasons, type Player, SourceNames, Track, type TrackEndEvent } from 'hoshimi';
import { broadcastQueueUpdate } from '../lib/broadcast';
import { getHoshimi } from '../lib/client';
import { buildNowPlayingEmbed } from '../utils/format';
import { PlaybackCursor } from './PlaybackCursor';

export class GuildPlayer {
  private static readonly MAX_CONSECUTIVE_FAILURES = 3;
  private static readonly STREAM_RETRY_ATTEMPTS = 3;
  private static readonly STREAM_RETRY_DELAY_MS = 1_000;

  private queue: PlaybackCursor<QueuedSong> = new PlaybackCursor();
  private priorityQueue: QueuedSong[] = [];
  private currentSong: QueuedSong | null = null;
  private loopMode: LoopMode = 'off';
  private paused = false;
  private stopping = false;
  private trackStartedAt: number | null = null;
  private pausedAt: number | null = null;
  private consecutiveFailures = 0;

  // Auto-leave idle timer.
  private idleLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  private getIdleTimeoutMinutes(): number {
    const raw = process.env.VOICE_IDLE_TIMEOUT_MINUTES;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }

  private scheduleIdleLeave(): void {
    this.cancelIdleLeave();
    const minutes = this.getIdleTimeoutMinutes();
    this.idleLeaveTimer = setTimeout(() => this.leaveOnIdle(), minutes * 60 * 1000);
  }

  private cancelIdleLeave(): void {
    if (this.idleLeaveTimer !== null) {
      clearTimeout(this.idleLeaveTimer);
      this.idleLeaveTimer = null;
    }
  }

  private readonly LEAVE_PHRASES = [
    '👋 "Fine, I\'ll leave."',
    '🚪 "I found something."',
    '💥 "Careful, I\'ve spotted a trap."',
    '✉️ Alfira has left the party.',
    '😵 Alfira was killed.',
    '💀 Alfira failed the last death saving throw.',
  ];

  private leaveOnIdle(): void {
    logger.info(
      { guildId: this.guildId },
      `Auto-leaving voice channel after idle (${this.getIdleTimeoutMinutes()} minutes).`
    );
    const phrase = this.LEAVE_PHRASES[Math.floor(Math.random() * this.LEAVE_PHRASES.length)];
    this.sendToTextChannel(`${phrase} (Left the voice channel due to inactivity.)`);
    this.destroyPlayer();
  }

  private readonly guildId: string;
  private readonly textChannel: TextChannel;
  private readonly voiceId: string;

  private unpause(): void {
    const hoshimi = getHoshimi();
    if (!hoshimi) return;
    const player = hoshimi.players.get(this.guildId);
    if (player) {
      player.setPaused(false);
    }
    this.paused = false;
  }

  constructor(
    textChannel: TextChannel,
    guildId: string,
    voiceId: string,
    _onDestroyed: () => void
  ) {
    this.textChannel = textChannel;
    this.guildId = guildId;
    this.voiceId = voiceId;

    // Register event handlers on the Hoshimi manager for this player's events.
    const hoshimi = getHoshimi();
    if (hoshimi) {
      hoshimi.on('trackEnd', (player: Player, track: unknown, payload: TrackEndEvent) => {
        if (player.guildId !== this.guildId) return;
        if (payload.reason === 'replaced') return;
        void track;
        this.onTrackEnd().catch(() => {
          // swallow errors — they are logged in handlePlaybackFailure
        });
      });
      hoshimi.on('trackError', (player: Player, track: unknown, exception: unknown) => {
        if (player.guildId !== this.guildId) return;
        const exc = exception as { exception?: { message?: string } };
        logger.error(
          { guildId: this.guildId, track: this.currentSong?.title ?? 'unknown' },
          `Player error: ${exc.exception?.message ?? 'unknown'}`
        );
        void track;
      });
    }
  }

  private hoshimiPlayer() {
    return getHoshimi()?.players.get(this.guildId);
  }

  private destroyPlayer(): void {
    const hoshimi = getHoshimi();
    if (!hoshimi) return;
    const player = hoshimi.players.get(this.guildId);
    if (player) {
      player.destroy(DestroyReasons.Requested);
    }
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
    this.cancelIdleLeave();
  }

  async addToPriorityQueue(song: QueuedSong): Promise<void> {
    this.priorityQueue.push(song);
    await this.ensurePlaying();
  }

  async replaceQueueAndPlay(songs: QueuedSong[]): Promise<void> {
    this.queue.clear();
    this.priorityQueue = [];
    this.currentSong = null;
    this.paused = false;
    this.consecutiveFailures = 0;
    this.queue.replace(songs);
    this.cancelIdleLeave();

    // Note: we intentionally do NOT call player.stop() here. Calling stop(true)
    // destroys the Hoshimi player, which sends a DELETE to NodeLink and clears its
    // stored voice session (endpoint/sessionId/token). When the subsequent
    // play() call then tries to play a new track, NodeLink has no voice state and
    // logs "No voice state, track is enqueued". Instead, let playNext() call
    // playSong() which will call play() on the existing player, replacing the
    // track without destroying the voice session.

    await this.playNext();
    this.broadcast();
  }

  skip(): void {
    if (this.currentSong === null) return;

    // Unpause first — stop() on a paused player might not trigger TrackEnd.
    if (this.paused) {
      this.unpause();
    }

    const player = this.hoshimiPlayer();
    if (player) {
      // stop(false) stops playback without destroying the player or clearing
      // its voice state, so the next track can play without reconnecting.
      player.stop(false);
    }
  }

  stop(): void {
    this.stopping = true;
    this.cancelIdleLeave();
    this.currentSong = null;
    this.queue.clear();
    this.priorityQueue = [];
    this.paused = false;
    this.trackStartedAt = null;
    this.broadcast();

    const player = this.hoshimiPlayer();
    if (player) {
      player.stop(true);
    }
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
    const player = this.hoshimiPlayer();
    if (player) {
      // Hoshimi uses LoopMode enum (Track=1, Queue=2, Off=3)
      player.setLoop(mode === 'song' ? 1 : mode === 'queue' ? 2 : 3);
    }
    this.broadcast();
  }

  togglePause(): boolean {
    if (!this.currentSong) return false;

    const player = this.hoshimiPlayer();
    if (!player) return false;

    if (this.paused) {
      this.cancelIdleLeave();
      if (this.pausedAt !== null) {
        const pauseDuration = Date.now() - this.pausedAt;
        if (this.trackStartedAt !== null) {
          this.trackStartedAt += pauseDuration;
        }
        this.pausedAt = null;
      }
      player.setPaused(false);
      this.paused = false;
    } else {
      this.pausedAt = Date.now();
      player.setPaused(true);
      this.paused = true;
      this.scheduleIdleLeave();
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
    const player = this.hoshimiPlayer();
    return player?.playing ?? false;
  }

  getQueueState(): QueueState {
    const player = this.hoshimiPlayer();
    return {
      isPlaying: this.isPlaying(),
      isPaused: this.paused,
      isConnectedToVoice: player?.connected ?? false,
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
    const player = this.hoshimiPlayer();
    if (player && !player.connected) {
      // Re-establish the voice connection so playSong() can use it.
      await player.connect();
    }

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
        this.scheduleIdleLeave();
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
    this.cancelIdleLeave();
    this.paused = false;

    const hoshimi = getHoshimi();
    if (!hoshimi) {
      await this.handlePlaybackFailure('Hoshimi not available');
      return;
    }

    let lastError: unknown;
    let trackData: { track: string; isWebmOpus: boolean } | undefined;

    for (let attempt = 0; attempt < GuildPlayer.STREAM_RETRY_ATTEMPTS; attempt++) {
      try {
        const { getStreamFormat } = await import('../utils/nodelink');
        trackData = await getStreamFormat(next.youtubeUrl);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < GuildPlayer.STREAM_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, GuildPlayer.STREAM_RETRY_DELAY_MS));
        }
      }
    }

    if (!trackData) {
      logger.error(
        { guildId: this.guildId, track: next.title, error: lastError },
        `Failed to get stream URL after ${GuildPlayer.STREAM_RETRY_ATTEMPTS} attempts`
      );
      await this.handlePlaybackFailure('could not load the track from NodeLink');
      return;
    }

    let player = hoshimi.players.get(this.guildId);
    if (!player) {
      if (!this.voiceId) {
        logger.error(
          { guildId: this.guildId },
          'Cannot play: no voiceId set and no existing player'
        );
        await this.handlePlaybackFailure('not connected to a voice channel');
        return;
      }
      player = hoshimi.createPlayer({ guildId: this.guildId, voiceId: this.voiceId });
    } else if (!player.connected) {
      // Player exists but was disconnected (e.g. after stop()). Reconnect first so
      // NodeLink receives the voice server update and can begin streaming.
      await player.connect();
    }

    // Apply volume via NodeLink volume filter.
    const volume =
      next.volumeOffset != null && next.volumeOffset !== 0
        ? 10 ** (next.volumeOffset / 20) * 100
        : 100;

    await player.play({
      track: new Track(
        {
          encoded: trackData.track,
          info: {
            title: next.title,
            identifier: next.youtubeId,
            author: '',
            length: next.duration * 1000,
            artworkUrl: '',
            uri: next.youtubeUrl,
            isStream: false,
            isSeekable: true,
            position: 0,
            sourceName: SourceNames.Youtube,
            isrc: null,
          },
          pluginInfo: {},
        },
        {}
      ),
      volume,
    });

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
        `⚠️ **${GuildPlayer.MAX_CONSECUTIVE_FAILURES}** consecutive failures — stopping playback. Use the Play button in the web UI to try again.`
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
