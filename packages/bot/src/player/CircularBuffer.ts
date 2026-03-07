// ---------------------------------------------------------------------------
// CircularBuffer
//
// A fixed-capacity buffer optimized for sequential playback with loop support.
// Uses a read pointer that can wrap around for queue loop mode, and supports
// shuffle via a separate playback order index array.
//
// Time Complexities:
// - current(): O(1)
// - advance(): O(1)
// - reset(): O(1)
// - shuffle(): O(n)
// - toArray(): O(n)
// ---------------------------------------------------------------------------

export class CircularBuffer<T> {
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
   * Resets the read pointer to the beginning.
   */
  shuffle(): void {
    if (this.buffer.length <= 1) {
      return;
    }

    // Create an array of indices [0, 1, 2, ..., n-1]
    this.playbackOrder = Array.from({ length: this.buffer.length }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = this.playbackOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playbackOrder[i], this.playbackOrder[j]] = [
        this.playbackOrder[j],
        this.playbackOrder[i],
      ];
    }

    // Reset read pointer so shuffle takes effect immediately
    this.readIndex = 0;
  }

  /**
   * Remove shuffle and return to original order.
   * Resets the read pointer to the beginning.
   */
  unshuffle(): void {
    this.playbackOrder = null;
    this.readIndex = 0;
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
