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
import { getStreamUrl, createAudioStream } from '../utils/ytdlp';
import { formatDuration, formatLoopMode } from '../utils/format';
import { broadcastQueueUpdate } from '../lib/broadcast';
import type { QueuedSong, LoopMode, QueueState } from '@discord-music-bot/shared';

// ---------------------------------------------------------------------------
// Retry helper
//
// Retries an async operation up to `maxRetries` additional times (so the
// function is called at most maxRetries + 1 times total). A fixed `delayMs`
// pause is inserted between each attempt. If all attempts fail, the last
// error is re-thrown.
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export class GuildPlayer {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  private queue: QueuedSong[] = [];
  private currentSong: QueuedSong | null = null;
  private loopMode: LoopMode = 'off';

  // Set to true by skip() so onTrackEnd() knows to advance regardless of
  // loop mode. Without this, skipping in 'song' mode would just replay.
  private skipping = false;

  // Set to true by stop() before connection.destroy() is called, so the
  // VoiceConnectionStatus.Destroyed handler can distinguish an intentional
  // teardown (stop/leave commands) from an unexpected connection loss and
  // avoid posting a spurious warning message or double-broadcasting.
  private intentionallyStopped = false;

  // Guards against multiple simultaneous reconnect attempts when the
  // Disconnected event fires in quick succession.
  private isReconnecting = false;

  // Kill function for the FFmpeg process currently backing the audio stream.
  // Stored so we can terminate it on skip or stop, preventing zombie processes.
  //
  // Root cause of the "music stops silently mid-track" bug:
  //   When createAudioResource() was called with a raw URL string and
  //   StreamType.Arbitrary, @discordjs/voice spawned FFmpeg internally without
  //   HTTP reconnect flags. If YouTube's CDN dropped the connection (throttle,
  //   network blip, etc.) FFmpeg treated it as EOF, exited cleanly, and the
  //   AudioPlayer transitioned to Idle — firing onTrackEnd() as if the song
  //   finished normally, with no error logged anywhere.
  //
  //   The fix: we spawn FFmpeg ourselves (via createAudioStream) with
  //   -reconnect/-reconnect_streamed/-reconnect_delay_max so transient drops
  //   are retried transparently. We track the process here so it can be killed
  //   when a track is skipped or playback is stopped.
  private killCurrentFfmpeg: (() => void) | null = null;

  private readonly connection: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;
  private readonly guildId: string;

  // The text channel where the bot will post "Now playing" embeds when
  // auto-advancing between tracks (i.e. not triggered by a slash command).
  private readonly textChannel: TextChannel;

  // Callback provided by the manager so this class can remove itself from
  // the player map without creating a circular import between GuildPlayer
  // and manager.ts.
  private readonly onDestroyed: () => void;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  constructor(
    connection: VoiceConnection,
    textChannel: TextChannel,
    guildId: string,
    onDestroyed: () => void,
  ) {
    this.connection = connection;
    this.textChannel = textChannel;
    this.guildId = guildId;
    this.onDestroyed = onDestroyed;

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        // Allow up to ~1 second of missed frames before auto-pausing.
        // The default of 5 frames (~100 ms) is far too aggressive — any brief
        // network jitter, encoding pause, or event-loop delay causes the
        // AudioPlayer to transition to AutoPaused, which users hear as
        // choppiness. 50 frames gives a comfortable cushion without masking
        // genuine end-of-stream events.
        maxMissedFrames: 50,
      },
    });
    this.connection.subscribe(this.audioPlayer);

    // -------------------------------------------------------------------------
    // AudioPlayer event handlers
    // -------------------------------------------------------------------------

    // When a track finishes (or is stopped), decide what to play next.
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.onTrackEnd();
    });

    this.audioPlayer.on('error', (error) => {
      console.error(
        `[GuildPlayer:${this.guildId}] AudioPlayer error:`,
        error.message,
        '| Track:',
        this.currentSong?.title ?? 'unknown',
      );
      // Treat an error as a track end so the queue keeps moving.
      this.onTrackEnd();
    });

    // AutoPaused fires when all voice connection subscribers are temporarily
    // unable to receive audio (e.g. a brief network stutter). The player will
    // resume automatically once the connection is ready again — we just log it.
    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
      console.warn(
        `[GuildPlayer:${this.guildId}] AudioPlayer AutoPaused — ` +
          'voice connection may be temporarily unavailable.',
      );
    });

    // -------------------------------------------------------------------------
    // VoiceConnection event handlers
    // -------------------------------------------------------------------------

    // Workaround: clear the UDP keepAlive interval whenever the underlying
    // networking state changes. The keepAlive heartbeat fires roughly every
    // 5 seconds and can disrupt the precise timing of outgoing audio packets,
    // which users perceive as periodic stutters. Clearing the interval removes
    // the interference without affecting connection health — Discord's WebSocket
    // gateway maintains its own heartbeat independently.
    // This mirrors the approach used by the Muse bot (museofficial/muse).
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

    // Disconnected can be a transient network blip. Give Discord 5 s to start
    // reconnecting on its own. If it transitions to Signalling or Connecting
    // within that window, the handshake is underway and we leave it alone. If
    // nothing happens, we destroy the connection ourselves so the Destroyed
    // handler can run cleanup.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;

      console.warn(
        `[GuildPlayer:${this.guildId}] Voice connection disconnected — attempting recovery.`,
      );

      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.info(
          `[GuildPlayer:${this.guildId}] Voice connection is reconnecting.`,
        );
      } catch {
        // The connection did not start reconnecting. Destroy it unless it has
        // already been moved to the Destroyed state by something else (e.g. a
        // concurrent stop() call).
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          console.error(
            `[GuildPlayer:${this.guildId}] Voice connection could not recover — destroying.`,
          );
          this.connection.destroy();
        }
      } finally {
        this.isReconnecting = false;
      }
    });

    // Destroyed fires for both intentional teardowns (stop/leave commands) and
    // unexpected connection losses. In the unexpected case we reset queue state,
    // broadcast to the web UI, stop the AudioPlayer so it does not try to keep
    // playing to a dead connection, and post a warning in the text channel.
    // In both cases we remove this instance from the manager's Map.
    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.info(`[GuildPlayer:${this.guildId}] Voice connection destroyed.`);

      if (!this.intentionallyStopped) {
        // Force the AudioPlayer to stop so the Idle handler does not fire and
        // attempt to play the next track against a destroyed connection.
        this.audioPlayer.stop(true);

        // Kill any running FFmpeg process so it doesn't linger as a zombie.
        this.killCurrentFfmpeg?.();
        this.killCurrentFfmpeg = null;

        // Reset in-memory state and push it to the web UI.
        this.queue = [];
        this.currentSong = null;
        broadcastQueueUpdate(this.getQueueState());

        // Notify the text channel. fire-and-forget; don't let a channel error
        // bubble up through an event handler.
        this.textChannel
          .send(
            '⚠️ Lost the voice connection unexpectedly. ' +
              'Use **/play** or **/join** to reconnect.',
          )
          .catch((err) =>
            console.error(
              `[GuildPlayer:${this.guildId}] Failed to send disconnect warning:`,
              err,
            ),
          );
      }

      // Always clean up the manager entry. removePlayer() is a simple
      // Map.delete(), so calling it twice is harmless.
      this.onDestroyed();
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a song to the end of the queue.
   * If nothing is currently playing, playback starts immediately.
   * Broadcasts the updated state after the queue is modified.
   */
  async addToQueue(song: QueuedSong): Promise<void> {
    this.queue.push(song);
    if (this.currentSong === null) {
      await this.playNext();
    } else {
      // Already playing — just broadcast the new queue length.
      broadcastQueueUpdate(this.getQueueState());
    }
  }

  /**
   * Add multiple songs to the end of the queue in one operation.
   * Compared to calling addToQueue() in a loop, this pushes all songs before
   * starting playback and only broadcasts a single queue-update event.
   */
  async addManyToQueue(songs: QueuedSong[]): Promise<void> {
    this.queue.push(...songs);
    if (this.currentSong === null) {
      await this.playNext();
    } else {
      broadcastQueueUpdate(this.getQueueState());
    }
  }

  /**
   * Replace the entire queue with new songs and immediately start playback.
   * Clears the current queue, skips any currently playing song, and starts
   * playing the first song from the new queue.
   */
  async replaceQueueAndPlay(songs: QueuedSong[]): Promise<void> {
    // Clear the current queue and stop playback
    this.queue = [];

    // Kill any current FFmpeg process
    this.killCurrentFfmpeg?.();
    this.killCurrentFfmpeg = null;

    // Stop the audio player (triggers Idle -> onTrackEnd, but queue is empty)
    this.audioPlayer.stop(true); // true = force-stop, suppresses Idle event

    // Set the new queue
    this.queue = [...songs];

    // Start playing the first song
    await this.playNext();

    // Broadcast the new state
    broadcastQueueUpdate(this.getQueueState());
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
    // The old FFmpeg process will be killed at the top of the next playNext()
    // call. broadcastQueueUpdate will be called inside playNext() / onTrackEnd().
    this.audioPlayer.stop();
  }

  /**
   * Stop playback, clear the queue, and destroy the voice connection.
   * After calling this, the GuildPlayer instance should be discarded.
   */
  stop(): void {
    // Set the flag BEFORE calling connection.destroy() — the Destroyed event
    // fires synchronously inside destroy(), so the flag must already be true
    // when the handler runs.
    this.intentionallyStopped = true;

    this.queue = [];
    this.currentSong = null;

    this.audioPlayer.stop(true); // true = force-stop, suppresses the Idle event

    // Kill the FFmpeg process now that we know nothing else will consume it.
    this.killCurrentFfmpeg?.();
    this.killCurrentFfmpeg = null;

    this.connection.destroy();

    // Broadcast the stopped/empty state so all clients update immediately.
    broadcastQueueUpdate(this.getQueueState());
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
    broadcastQueueUpdate(this.getQueueState());
  }

  /**
   * Change the loop mode.
   */
  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
    broadcastQueueUpdate(this.getQueueState());
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
  // Returns a QueueState snapshot. Used by GET /api/player/queue and as the
  // payload for the Socket.io player:update event.
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
   *
   * Fetches a fresh CDN URL at playback time (not at enqueue time) to avoid
   * using stale URLs for tracks that have been waiting in a long queue.
   * Retries the URL fetch up to 2 times (3 attempts total) before skipping.
   *
   * Spawns FFmpeg with HTTP reconnect flags via createAudioStream() so that
   * transient CDN drops are retried transparently instead of silently
   * terminating the stream.
   *
   * Broadcasts the new state once playback begins (or when the queue empties).
   * Bails out early if the voice connection has already been destroyed.
   */
  private async playNext(): Promise<void> {
    // Guard: don't attempt to play anything if the connection is gone.
    if (this.connection.state.status === VoiceConnectionStatus.Destroyed) {
      return;
    }

    const next = this.queue.shift();

    if (!next) {
      this.currentSong = null;
      // Queue exhausted — broadcast the idle state.
      broadcastQueueUpdate(this.getQueueState());
      return;
    }

    this.currentSong = next;

    let streamUrl: string;
    try {
      // Retry up to 2 extra times (3 attempts total), waiting 1 s between
      // each attempt. This handles transient yt-dlp / network failures
      // without immediately skipping a song the user wanted to hear.
      streamUrl = await withRetry(() => getStreamUrl(next.youtubeUrl), 2, 1_000);
    } catch (error) {
      console.error(
        `[GuildPlayer:${this.guildId}] Failed to get stream URL for "${next.title}" after 3 attempts:`,
        error,
      );
      await this.textChannel.send(
        `⚠️ Skipping **${next.title}** — could not resolve the audio stream.`,
      );
      // Try the next song instead.
      await this.playNext();
      return;
    }

    // Kill any FFmpeg process left over from the previous track before
    // starting a new one. This covers the normal track-end and skip paths;
    // stop() kills it directly before destroying the connection.
    this.killCurrentFfmpeg?.();
    this.killCurrentFfmpeg = null;

    // Spawn FFmpeg with HTTP reconnect flags so that transient CDN drops do
    // not silently terminate playback. Without these flags, FFmpeg treats a
    // dropped HTTP connection as EOF, exits cleanly, and the AudioPlayer
    // transitions to Idle — calling onTrackEnd() as if the song finished
    // normally, with no error logged anywhere.
    //
    // StreamType.OggOpus tells @discordjs/voice to demux the OGG container
    // and send the already-encoded Opus packets to Discord directly — no
    // Node.js Opus encoder library (@discordjs/opus / opusscript) is needed.
    const { stream, kill } = createAudioStream(streamUrl);
    this.killCurrentFfmpeg = kill;

    const resource: AudioResource = createAudioResource(stream, {
      inputType: StreamType.OggOpus,
    });

    this.audioPlayer.play(resource);

    try {
      await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
    } catch {
      console.error(
        `[GuildPlayer:${this.guildId}] AudioPlayer failed to enter Playing state for "${next.title}"`,
      );
      await this.textChannel.send(
        `⚠️ Skipping **${next.title}** — audio failed to start.`,
      );
      await this.playNext();
      return;
    }

    // Broadcast after confirming playback has actually started.
    broadcastQueueUpdate(this.getQueueState());

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
        { name: 'Loop', value: formatLoopMode(this.loopMode), inline: true },
      );
  }
}
