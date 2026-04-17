# Seek Support — Design

## Context

Users want to jump to a specific position in the current track. The bot uses NodeLink (Lavalink v4-compatible) via `hoshimi`; seek is supported by the underlying player but not yet exposed through the UI.

---

## What We're Building

A draggable (and clickable) seek scrubber on the desktop NowPlayingBar that lets users seek within the current track. Mobile is out of scope.

---

## Architecture

### Server

**`GuildPlayer.seek(positionMs: number)`** — new method:
- Validates a track is currently loaded (`currentSong !== null`)
- Calls `hoshimiPlayer.seek(positionMs)`
- Broadcasts the updated queue state via `broadcastQueueUpdate`

**`POST /api/player/seek`** — new route:
- Auth: user must be authenticated and in voice (`requireUserInVoice`)
- Body: `{ position: number }` (milliseconds)
- Calls `player.seek(position)`, returns the updated `QueueState`

### Shared Types

**`QueuedSong.isSeekable: boolean`** — new field:
- Currently available from NodeLink's track info but not stored on `QueuedSong`
- Thread through `toQueuedSong()` from NodeLink's `TrackInfo.isSeekable`
- If not available from the track source, default to `true`

### Shared API

**`seek(positionMs: number): Promise<void>`** — new export in `api.ts`:
- Calls `POST /api/player/seek` with `{ position: positionMs }`

---

## UI: Desktop Scrubber

### UX

- **Click to seek**: Clicking anywhere on the bar (outside the thumb) jumps to that position
- **Drag to seek**: Mouse down on thumb → drag → mouse up commits seek
- **Constrained**: Cannot seek past 0 or track duration
- **Non-seekable tracks**: Thumb is hidden; bar is still visible but non-interactive; cursor shows `not-allowed`
- **Optimistic update**: On seek commit, the rAF loop resets its `effectiveStart` to `Date.now() - seekedMs` so thumb/text update immediately. The next `player:update` corrects if needed.
- **Seek while paused**: Works correctly — the pause state is preserved through seek

### Component Structure

**`Scrubber`** (new sub-component, inside `ProgressBar`):
- Props: `isSeekable`, `duration`, `elapsed`, `onSeek(seconds)`
- Internal state: `isDragging`, `dragPct` (for thumb visual during drag)
- Mouse events: `onMouseDown` on thumb starts drag; `onMouseMove` on container tracks; `onMouseUp` anywhere commits
- The seekable check gates interactivity

**`ProgressBar` (desktop variant)** updated to:
- Render the `Scrubber` component inside the existing clay-inset bar
- Receive `onSeek` from parent

**`NowPlayingBar`** updated to:
- Pass `onSeek` handler to the desktop `ProgressBar`
- The `onSeek` callback calls the `seek` action from `usePlayer`

### PlayerContext

Add `seek: (positionMs: number) => Promise<void>` to `PlayerContextValue` and the provider. Mirrors the pattern of `pause`, `skip`, etc.

### useProgressBar

Add an `overrideElapsed?: number` parameter. When provided (after a seek), the hook resets `effectiveStartRef` to `Date.now() - overrideElapsed * 1000` and `accumulatedMsRef` to `overrideElapsed * 1000`, so the rAF loop picks up the new position without waiting for the next WebSocket event.

---

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/GuildPlayer.ts` | Add `seek(positionMs)` method |
| `packages/server/src/routes/player.ts` | Add `handleSeek` + route dispatch |
| `packages/server/src/shared/api.ts` | Add `seek()` export |
| `packages/server/src/shared/types.ts` | Add `isSeekable: boolean` to `QueuedSong` |
| `packages/server/src/utils/nodelink.ts` | Thread `isSeekable` from NodeLink track info |
| `packages/web/src/context/PlayerContext.tsx` | Add `seek` action |
| `packages/web/src/components/NowPlayingBar.tsx` | Integrate `Scrubber` in desktop `ProgressBar` |
| `packages/web/src/hooks/useProgressBar.ts` | Accept `overrideElapsed` for optimistic updates |

---

## What We're NOT Building (Out of Scope)

- Mobile seek UI
- Keyboard shortcuts (e.g., `J`/`L` to seek ±10s)
- Relative seek (e.g., ±10s buttons)
