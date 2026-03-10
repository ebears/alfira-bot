// ---------------------------------------------------------------------------
// SinglyLinkedList
//
// A singly linked list optimized for queue operations: O(1) push to back
// and O(1) shift from front. No backward traversal needed for this use case.
//
// Time Complexities:
// - push(): O(1)
// - shift(): O(1)
// - clear(): O(1)
// - toArray(): O(n)
// ---------------------------------------------------------------------------

interface SinglyListNode<T> {
  value: T;
  next: SinglyListNode<T> | null;
}

export class SinglyLinkedList<T> {
  private head: SinglyListNode<T> | null = null;
  private tail: SinglyListNode<T> | null = null;
  private _size = 0;

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** Number of items in the list */
  get size(): number {
    return this._size;
  }

  /** Whether the list is empty */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  // ---------------------------------------------------------------------------
  // Core Operations
  // ---------------------------------------------------------------------------

  /**
   * Add an item to the back of the list.
   * O(1) - maintains tail pointer for constant-time insertion.
   */
  push(item: T): void {
    const node: SinglyListNode<T> = {
      value: item,
      next: null,
    };

    if (this.tail) {
      this.tail.next = node;
    } else {
      // List was empty, new node is both head and tail
      this.head = node;
    }

    this.tail = node;
    this._size++;
  }

  /**
   * Remove and return the item from the front of the list.
   * O(1) - just moves head pointer.
   * Returns undefined if list is empty.
   */
  shift(): T | undefined {
    if (!this.head) {
      return undefined;
    }

    const value = this.head.value;
    this.head = this.head.next;

    // If list is now empty, clear tail too
    if (!this.head) {
      this.tail = null;
    }

    this._size--;
    return value;
  }

  /**
   * Peek at the front item without removing it.
   * Returns undefined if list is empty.
   */
  peek(): T | undefined {
    return this.head?.value;
  }

  /**
   * Clear all items from the list.
   * O(1) - just nulls the pointers.
   */
  clear(): void {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  // ---------------------------------------------------------------------------
  // Utility Operations
  // ---------------------------------------------------------------------------

  /**
   * Convert the list to an array.
   * O(n) - must traverse entire list.
   */
  toArray(): T[] {
    const result: T[] = [];
    let node = this.head;

    while (node) {
      result.push(node.value);
      node = node.next;
    }

    return result;
  }

  /**
   * Check if an item exists in the list.
   * O(n) - must traverse to find item.
   */
  contains(predicate: (item: T) => boolean): boolean {
    let node = this.head;

    while (node) {
      if (predicate(node.value)) {
        return true;
      }
      node = node.next;
    }

    return false;
  }

  /**
   * Find an item in the list.
   * O(n) - must traverse to find item.
   * Returns undefined if not found.
   */
  find(predicate: (item: T) => boolean): T | undefined {
    let node = this.head;

    while (node) {
      if (predicate(node.value)) {
        return node.value;
      }
      node = node.next;
    }

    return undefined;
  }

  /**
   * Iterate over all items.
   * Useful for debugging or batch operations.
   */
  forEach(callback: (item: T, index: number) => void): void {
    let node = this.head;
    let index = 0;

    while (node) {
      callback(node.value, index);
      node = node.next;
      index++;
    }
  }
}
