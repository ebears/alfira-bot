import type { QueueState } from '@discord-music-bot/shared';

// ---------------------------------------------------------------------------
// broadcast.ts
//
// A thin indirection layer so GuildPlayer can broadcast state changes without
// importing from the API package (which would create a circular dependency:
// api → bot → api).
//
// The API's entry point calls setBroadcastQueueUpdate() once after initialising
// the Socket.io server, injecting the actual emit implementation. Until then,
// all calls are no-ops — which is safe because no clients can connect before
// the server starts.
// ---------------------------------------------------------------------------

type BroadcastFn = (state: QueueState) => void;

let _broadcastQueueUpdate: BroadcastFn | null = null;

/**
 * Called once by the API entry point to inject the Socket.io emit function.
 */
export function setBroadcastQueueUpdate(fn: BroadcastFn): void {
  _broadcastQueueUpdate = fn;
}

/**
 * Called by GuildPlayer after every state-changing operation.
 * No-op until setBroadcastQueueUpdate() has been called.
 */
export function broadcastQueueUpdate(state: QueueState): void {
  _broadcastQueueUpdate?.(state);
}
