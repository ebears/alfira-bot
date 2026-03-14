// ---------------------------------------------------------------------------
// SinglyLinkedList
//
// A singly linked list optimized for queue operations: O(1) push to back
// and O(1) shift from front.
// ---------------------------------------------------------------------------

interface SinglyListNode<T> {
  value: T;
  next: SinglyListNode<T> | null;
}

export class SinglyLinkedList<T> {
  private head: SinglyListNode<T> | null = null;
  private tail: SinglyListNode<T> | null = null;

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

    return value;
  }

  /**
   * Clear all items from the list.
   * O(1) - just nulls the pointers.
   */
  clear(): void {
    this.head = null;
    this.tail = null;
  }

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
}
