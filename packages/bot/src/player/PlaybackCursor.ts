// ---------------------------------------------------------------------------
// PlaybackCursor
//
// A playback cursor over a fixed set of items with loop support.
// Uses a read pointer that can wrap around for queue loop mode, and supports
// shuffle via a separate playback order index array.
//
// Note: Unlike a traditional circular/ring buffer, this class does not
// automatically wrap or manage capacity. It's essentially a cursor over
// a list of items with shuffle support.
//
// Time Complexities:
// - current(): O(1)
// - advance(): O(1)
// - reset(): O(1)
// - shuffle(): O(n)
// - toArray(): O(n)
// ---------------------------------------------------------------------------

export class PlaybackCursor<T> {
  private buffer: T[];
  private readIndex: number = 0;
  private playbackOrder: number[] | null = null;

  constructor(items: T[] = []) {
    this.buffer = [...items];
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** Total number of items in the buffer */
  get size(): number {
    return this.buffer.length;
  }

  /** Number of items remaining to be played */
  get remaining(): number {
    return Math.max(0, this.buffer.length - this.readIndex);
  }

  /** Whether the buffer is empty */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /** Whether we've reached the end of the buffer */
  get isAtEnd(): boolean {
    return this.readIndex >= this.buffer.length;
  }

  /** Current read position (0-indexed) */
  get position(): number {
    return this.readIndex;
  }

  /** Whether the buffer is currently shuffled */
  get isShuffled(): boolean {
    return this.playbackOrder !== null;
  }

  // ---------------------------------------------------------------------------
  // Core Operations
  // ---------------------------------------------------------------------------

  /**
   * Get the current item without advancing the read pointer.
   * Returns undefined if buffer is empty or at end.
   */
  current(): T | undefined {
    if (this.buffer.length === 0 || this.isAtEnd) {
      return undefined;
    }

    const idx = this.playbackOrder
      ? this.playbackOrder[this.readIndex]
      : this.readIndex;
    return this.buffer[idx];
  }

  /**
   * Peek at the next item without advancing.
   * Returns undefined if there is no next item.
   */
  peekNext(): T | undefined {
    const nextIndex = this.readIndex + 1;
    if (nextIndex >= this.buffer.length) {
      return undefined;
    }

    const idx = this.playbackOrder
      ? this.playbackOrder[nextIndex]
      : nextIndex;
    return this.buffer[idx];
  }

  /**
   * Advance the read pointer to the next item.
   * Does nothing if already at end.
   */
  advance(): void {
    if (!this.isAtEnd) {
      this.readIndex++;
    }
  }

  /**
   * Reset the read pointer to the beginning.
   * Used for queue loop mode to wrap around.
   */
  reset(): void {
    this.readIndex = 0;
  }

  // ---------------------------------------------------------------------------
  // Shuffle Operations
  // ---------------------------------------------------------------------------

  /**
   * Shuffle the playback order using Fisher-Yates algorithm.
   * The buffer contents remain unchanged; only the access order is randomized.
   * Only shuffles unplayed items (after current position), keeping already-played
   * items in their original order. Preserves the current read position.
   */
  shuffle(): void {
    if (this.buffer.length <= 1) {
      return;
    }

    // Keep played items in original order (if any)
    const played = Array.from({ length: this.readIndex }, (_, i) => i);

    // Create array of remaining indices to shuffle
    const remaining = Array.from(
      { length: this.buffer.length - this.readIndex },
      (_, i) => this.readIndex + i
    );

    // Fisher-Yates shuffle only the remaining items
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    this.playbackOrder = [...played, ...remaining];
  }

  /**
   * Remove shuffle and return to original order.
   * Preserves the current read position.
   */
  unshuffle(): void {
    this.playbackOrder = null;
  }

  // ---------------------------------------------------------------------------
  // Modification Operations
  // ---------------------------------------------------------------------------

  /**
   * Replace the entire buffer contents with new items.
   * Resets read pointer and clears shuffle.
   */
  replace(items: T[]): void {
    this.buffer = [...items];
    this.readIndex = 0;
    this.playbackOrder = null;
  }

  /**
   * Clear all items from the buffer.
   */
  clear(): void {
    this.buffer = [];
    this.readIndex = 0;
    this.playbackOrder = null;
  }

  // ---------------------------------------------------------------------------
  // Utility Operations
  // ---------------------------------------------------------------------------

  /**
   * Convert remaining items to an array (for API responses).
   * Returns items in current playback order, starting from current position.
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = this.readIndex; i < this.buffer.length; i++) {
      const idx = this.playbackOrder ? this.playbackOrder[i] : i;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  /**
   * Convert all items to an array (including already-played items).
   * Returns items in current playback order.
   */
  toArrayAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.buffer.length; i++) {
      const idx = this.playbackOrder ? this.playbackOrder[i] : i;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  /**
   * Get an array of all items in original order (ignoring shuffle).
   * Used for debugging or when original order is needed.
   */
  toOriginalArray(): T[] {
    return [...this.buffer];
  }
}
