---
name: hoshimi
description: Use when working with Hoshimi TypeScript Lavalink v4 client, player queue management, Discord.js voice integration, or audio filters.
---

# Hoshimi Expert Reference (Alfira Integration)

Hoshimi is a TypeScript-first Lavalink v4 client library used in Alfira for audio streaming via NodeLink. This reference covers both the Hoshimi API and Alfira's wrapper layer.

## Docs
- **GitHub:** https://github.com/Ganyu-Studios/Hoshimi
- **npm:** https://www.npmjs.com/package/hoshimi

---

## Overview

Alfira uses Hoshimi as the audio backend, wrapped by `GuildPlayer` for queue management. Key architecture:

- **Single-process:** Bot and API run in one Bun process. Bot emits state via `broadcastQueueUpdate()` which the API's WebSocket server injects at startup.
- **Voice idle leave:** Bot auto-leaves after `VOICE_IDLE_TIMEOUT_MINUTES` (default 5) of inactivity.
- **Auto-pause:** When all human members leave the bot's voice channel, playback pauses.
- **Priority queue:** Songs added via Quick Add play before the regular queue.
- **Track construction:** Alfira manually builds `Track` objects using `getStreamFormat()` from NodeLink REST API.

---

## Loop Modes (Alfira-Specific)

Alfira defines `LoopMode` as a string literal type, **not** the Hoshimi enum:

```typescript
// packages/shared/src/types.ts
type LoopMode = 'off' | 'song' | 'queue';
```

**Hoshimi numeric mapping** (used in `player.setLoop()`):
| Alfira Mode | Hoshimi Value |
|-------------|---------------|
| `'song'`    | `1`           |
| `'queue'`   | `2`           |
| `'off'`     | `3`           |

---

## Hoshimi Class

### Constructor

```typescript
import { Hoshimi } from 'hoshimi';

const hoshimi = new Hoshimi({
    sendPayload(guildId, payload) {
        // Alfira uses guild.shard.send() — NOT client.gateway.send()
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        guild.shard.send(payload);
    },
    nodes: [
        {
            host: 'localhost',
            port: 2333,
            password: 'youshallnotpass',
            secure: false,
        },
    ],
    // client:{} is set to { id: '', username: '' } until ready fires
    client: {
        id: '',
        username: '',
    },
});

// Bot's ready handler populates client data
client.once('ready', (readyClient) => {
    hoshimi.init({ id: readyClient.user.id, username: readyClient.user.username });
});
```

### Key Methods
| Method | Description |
|--------|-------------|
| `init(userData)` | Initialize with Discord user `{ id, username }` |
| `updateVoiceState(data)` | Forward raw gateway packets here |
| `createPlayer(guildId, voiceId)` | Create player for guild |
| `getPlayer(guildId)` | Get existing player |
| `deletePlayer(guildId)` | Destroy player |

### Properties
- `players: Collection<string, Player>` — Active players by guild ID
- `nodes: NodeManager` — Node manager instance

---

## Player Class (Hoshimi)

Represents a voice player for a specific guild.

### Player States
`playing`, `paused`, `connected` — these are **flags on the player object**, not a state machine.

### Core Methods
| Method | Description |
|--------|-------------|
| `play(track, options?)` | Start or resume playback |
| `stop(destroy)` | **Critical:** `stop(true)` destroys voice session; `stop(false)` preserves it |
| `pause()` / `setPaused(bool)` | Pause/resume |
| `skip()` | Skip to next track |
| `seek(position)` | Seek to position (ms) |
| `setVolume(volume)` | Set volume (0-1000) |
| `setLoop(mode)` | Set loop mode (1=Track, 2=Queue, 3=Off) |
| `connect()` | Re-establish voice connection |
| `destroy(reason)` | Destroy player with `DestroyReasons` reason |
| `connected` | Boolean flag — true when connected to voice channel |
| `voiceId` | The voice channel ID this player is connected to |

### Player Events
```typescript
player.on('trackStart', (player, track) => { });
player.on('trackEnd', (player, track, payload) => { });
player.on('trackError', (player, track, exception) => { });
player.on('playerUpdate', (player, state) => { });
```

---

## `stop(true)` vs `stop(false)` — Critical Difference

Calling `stop(true)` (destroy) sends a DELETE to NodeLink, clearing its stored voice session (endpoint/sessionId/token). If the next track tries to play immediately, NodeLink logs **"No voice state, track is enqueued"**.

| Method | Voice Session | Use Case |
|--------|--------------|----------|
| `player.stop(false)` | Preserved | Skip — next track plays without reconnecting |
| `player.stop(true)` | Destroyed | Stop/leave — intentionally ending the session |

Alfira uses:
- `skip()` → `player.stop(false)` (preserves voice state)
- `stop()` → `player.stop(true)` (destroys session)
- `replaceQueueAndPlay()` → **never calls stop()** — relies on `play()` replacing the track on the existing player

---

## GuildPlayer (Alfira Wrapper)

High-level player managing queue, priority queue, idle leave, and auto-pause.

**File:** `packages/bot/src/player/GuildPlayer.ts`

### Constructor
```typescript
new GuildPlayer(textChannel, guildId, voiceId, onDestroyed: () => void)
```

### Queue Methods
| Method | Description |
|--------|-------------|
| `addToQueue(songs)` | Add song(s) to end of queue |
| `addToPriorityQueue(song)` | Add song to priority queue (Quick Add) |
| `replaceQueueAndPlay(songs)` | Replace entire queue and start playing |
| `clearQueue()` | Clear the queue |
| `skip()` | Skip current track (uses `stop(false)`) |
| `stop()` | Stop playback and destroy session (uses `stop(true)`) |

### Playback Control
| Method | Description |
|--------|-------------|
| `setLoopMode(mode)` | Set `'off'`, `'song'`, or `'queue'` |
| `togglePause()` | Toggle pause, schedules idle leave when paused |
| `shuffle()` | Shuffle remaining queue (keeps already-played songs in place) |
| `unshuffle()` | Restore original queue order |

### State Getters
| Method | Returns |
|--------|---------|
| `getCurrentSong()` | `QueuedSong \| null` |
| `getQueue()` | `QueuedSong[]` (remaining songs, excluding current) |
| `getLoopMode()` | `LoopMode` |
| `isPlaying()` | `boolean` (true if has song and not paused) |
| `getQueueState()` | `QueueState` (full snapshot for WebSocket broadcast) |

### Internal Behavior

**Idle leave:** After `VOICE_IDLE_TIMEOUT_MINUTES` (env, default 5) of inactivity while in a voice channel, the bot leaves automatically.

**Auto-pause:** When all human members leave the bot's voice channel, `togglePause()` is called to pause playback. When a human rejoins, playback stays paused — user must resume manually.

**Stream retry:** `playSong()` retries `getStreamFormat()` up to 3 times with 1s delay on failure.

---

## PlaybackCursor (Alfira Internal)

Internal queue cursor with loop and shuffle support. Not exposed outside the bot package.

**File:** `packages/bot/src/player/PlaybackCursor.ts`

| Property | Type | Description |
|----------|------|-------------|
| `isEmpty` | `boolean` | Whether buffer is empty |
| `isAtEnd` | `boolean` | Whether read pointer is at end |
| `isShuffled` | `boolean` | Whether queue is shuffled |

| Method | Description |
|--------|-------------|
| `current()` | Get current item without advancing |
| `advance()` | Move read pointer to next item |
| `reset()` | Reset read pointer to beginning |
| `shuffle()` | Fisher-Yates shuffle remaining items |
| `unshuffle()` | Clear shuffle, restore original order |
| `replace(items)` | Replace entire buffer, reset pointer |
| `append(...items)` | Append to end without affecting pointer |
| `clear()` | Clear buffer and reset |
| `toRemaining()` | Get remaining items as array (excludes current) |

---

## PlayerManager (Alfira)

Guild-scoped player lifecycle. Simple Map of `guildId -> GuildPlayer`.

**File:** `packages/bot/src/player/manager.ts`

```typescript
import { createPlayer, getPlayer, destroyAllPlayers } from '@alfira-bot/bot';

// Get existing player (undefined if none)
const player = getPlayer(guildId);

// Create or get existing player
const player = createPlayer(guildId, textChannel, voiceId);

// Stop all players during shutdown
destroyAllPlayers();
```

---

## Track Construction for `player.play()`

Alfira manually builds `Track` objects using the NodeLink REST API:

```typescript
import { SourceNames, Track } from 'hoshimi';
import { getStreamFormat } from './utils/nodelink';

const { track: encodedTrack } = await getStreamFormat(next.youtubeUrl);

const track = new Track(
    {
        encoded: encodedTrack,
        info: {
            title: next.title,
            identifier: next.youtubeId,
            author: '',
            length: next.duration * 1000,    // milliseconds
            artworkUrl: '',
            uri: next.youtubeUrl,
            isStream: false,
            isSeekable: true,
            position: 0,
            sourceName: SourceNames.Youtube,  // 'youtube'
            isrc: null,
        },
        pluginInfo: {},
    },
    {}
);

await player.play({ track, volume: 100 });
```

---

## Discord.js Integration (Alfira)

Alfira uses a **two-phase voice state handling**:

### Phase 1: Raw Packet Forwarding
All raw gateway packets are forwarded to Hoshimi so NodeLink receives Discord's voice server details:

```typescript
// packages/bot/src/index.ts
client.on('raw', (packet) => {
    hoshimi.updateVoiceState(packet);
});
```

### Phase 2: Human-Left Detection
The `voiceStateUpdate` event detects when all humans leave the bot's channel:

```typescript
client.on('voiceStateUpdate', (oldState, newState) => {
    // Ignore bot-only voice changes
    if (newState.member?.user.bot && oldState.member?.user.bot) return;

    const player = manager.players.get(guildId);
    if (!player) return;

    // Only act when someone left the bot's channel
    if (oldState.channelId !== player.voiceId) return;
    if (newState.channelId === player.voiceId) return; // joined, not left

    // Auto-pause when no humans remain
    const humanCount = voiceChannel.members.filter((m) => !m.user.bot).size;
    if (humanCount === 0) {
        guildPlayer.togglePause();
    }
});
```

---

## NodeLink REST Utilities

**File:** `packages/bot/src/utils/nodelink.ts`

### URL Validation
```typescript
import { isValidYouTubeUrl, isYouTubePlaylistUrl } from '@alfira-bot/bot';

isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // true
isYouTubePlaylistUrl('https://www.youtube.com/playlist?list=xxx'); // true
```

### Track Metadata
```typescript
import { getMetadata } from '@alfira-bot/bot';

const { title, youtubeId, duration, thumbnailUrl } = await getMetadata(youtubeUrl);
```

### Stream Format (for playback)
```typescript
import { getStreamFormat } from '@alfira-bot/bot';

const { track: encodedTrack, isWebmOpus } = await getStreamFormat(youtubeUrl);
```

### Playlist Metadata
```typescript
import { getPlaylistMetadataWithVideos } from '@alfira-bot/bot';

const { title, playlistId, videoCount, videos } = await getPlaylistMetadataWithVideos(
    playlistUrl,
    maxVideos // optional limit
);
```

---

## Broadcast Pipeline

`GuildPlayer` never holds WebSocket connections. It broadcasts via:

```typescript
// packages/bot/src/lib/broadcast.ts
broadcastQueueUpdate(state: QueueState);
```

The actual emit function is injected by the API at startup:

```typescript
// packages/api/src/index.ts (called once at boot)
import { setBroadcastQueueUpdate } from '@alfira-bot/bot';
setBroadcastQueueUpdate((state) => {
    // sends to all registered WebSocket clients
    socket.emit('player:update', state);
});
```

---

## DestroyReasons

Used when intentionally destroying a player:

```typescript
import { DestroyReasons } from 'hoshimi';

player.destroy(DestroyReasons.Requested);  // Used in GuildPlayer.destroyPlayer()
```

---

## Search (Hoshimi Built-in)

```typescript
const result = await hoshimi.search('never gonna give you up', {
    source: 'youtube',
    limit: 10,
});

if (result.tracks.length > 0) {
    // Use result.tracks[0] with getStreamFormat() then player.play()
}
```

---

## Filters

```typescript
// Volume (0.0 - 5.0)
player.filter.setVolume(1.0);

// Equalizer (15 bands)
player.filter.setEqualizer([{ band: 0, gain: 0.25 }]);

// Nightcore preset
player.filter.setNightcore();

// Karaoke
player.filter.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });

// Clear all
player.filter.clear();
```

---

## Error Types

```typescript
import { PlayerError, ManagerError, NodeError, ResolveError } from 'hoshimi';
```

---

## Links

| Resource | URL |
|----------|-----|
| Hoshimi GitHub | https://github.com/Ganyu-Studios/Hoshimi |
| Hoshimi npm | https://www.npmjs.com/package/hoshimi |
| NodeLink | https://github.com/PerformanC/NodeLink |
