---
name: hoshimi
description: Use when working with Hoshimi TypeScript Lavalink v4 client, player queue management, Seyfert voice integration, or audio filters.
---

# Hoshimi

**Docs:** https://hoshimi-web.vercel.app/docs
**TypeDoc API:** https://hoshimi-web.vercel.app/core-api/index.html
**GitHub:** https://github.com/Ganyu-Studios/Hoshimi
**npm:** https://www.npmjs.com/package/hoshimi

---

## What is Hoshimi

Hoshimi is a TypeScript-first [Lavalink v4](https://github.com/lavalink-devs/lavalink) client with clean architecture, strict typing, and practical extension points.

### Core abstractions

| Abstraction | Role |
|-------------|------|
| **Hoshimi (Manager)** | Entry point — creates players, searches, manages nodes |
| **Node** | Represents one Lavalink server instance |
| **Player** | Per-guild playback controller with an attached queue |
| **Queue** | Track queue with add/clear/skip/shuffle operations |
| **FilterManager** | Audio filters: nightcore, karaoke, EQ, volume, etc. |
| **LyricsManager** | Lyrics fetching and live subscription |
| **SourceRegistry** | Register and resolve custom search source aliases |
| **Structures** | Factory for overriding Player, Node, Queue, Track, etc. |

### Error model

Hoshimi throws typed errors at the appropriate layer: `ManagerError`, `NodeError`, `PlayerError`, `RestError`, `ResolveError`, `StorageError`, `OptionError`.

### Installation

```bash
bun add hoshimi
```

---

## Documentation Index

### Getting Started

| Guide | What it covers |
|-------|----------------|
| [Quick Start](https://hoshimi-web.vercel.app/docs/getting-started/quick-start) | Create a manager, init on ready, forward voice packets, search/queue/play flow |
| [Bot Integration](https://hoshimi-web.vercel.app/docs/getting-started/bot-integration) | `createHoshimi`, `init()`, voice packet forwarding, per-guild player lifecycle; `createPlayer` is idempotent per guild |
| [Events and Gateway](https://hoshimi-web.vercel.app/docs/getting-started/events-gateway) | `NodeReady`, `PlayerCreate`, `QueueEnd` hooks; production checklist — forward all voice packets, persist session state, clean up on `QueueEnd`/`PlayerDestroy` |
| [Player Lifecycle](https://hoshimi-web.vercel.app/docs/getting-started/player-lifecycle) | Create/reuse players, search and play, runtime controls (pause/seek/skip/volume/loop), `disconnect()` vs `destroy()` |

### Core Guides

| Guide | What it covers |
|-------|----------------|
| [Search and Sources](https://hoshimi-web.vercel.app/docs/guides/search-sources) | `manager.search()` vs `player.search()`, `SearchOptions`, `SearchSources`, `LoadType` branching (`Track` / `Search` / `Playlist` / `Empty` / `Error`) |
| [Source Registry](https://hoshimi-web.vercel.app/docs/guides/source-registry) | `SourceRegistry.register()`, `resolve()`, `isRegistered()`, `createIdentifier()`; register custom source aliases at bootstrap |
| [Tracks and Resolution](https://hoshimi-web.vercel.app/docs/guides/tracks-and-resolution) | `Track` (resolved) vs `UnresolvedTrack` (title/author only); `isResolved()` / `isUnresolved()` type guards; mixed queue inputs |
| [Node Operations](https://hoshimi-web.vercel.app/docs/guides/node-operations) | `nodeManager.getLeastUsed()` for load balancing, `node.decode.single/multiple()`, `node.rest` for low-level REST calls |
| [Queue and Storage](https://hoshimi-web.vercel.app/docs/guides/queue-storage) | Queue operations (`add`, `shift`, `shuffle`, `clear`, `current`, `history`); in-memory defaults; custom `QueueStorageAdapter` pattern (Redis example); what to persist vs what to clear on teardown |
| [Filters and Lyrics](https://hoshimi-web.vercel.app/docs/guides/filters-lyrics) | Nightcore, karaoke, EQ, volume filters; reset before switching presets; lyrics fetch/subscribe/cleanup pattern; `plugin` vs `dspx` filter manager distinction |

### Advanced

| Guide | What it covers |
|-------|----------------|
| [Custom Structures](https://hoshimi-web.vercel.app/docs/advanced/custom-structures) | Override `Player`, `Node`, `Queue`, `Track`, `LyricsManager` via `Structures` factory at bootstrap; module augmentation for typed custom properties |
| [Structure Types](https://hoshimi-web.vercel.app/docs/advanced/structure-types) | `PlayerStructure`, `TrackStructure`, `NodeStructure` and other `*Structure` aliases for type-safe extensions |
| [Errors and Recovery](https://hoshimi-web.vercel.app/docs/advanced/errors-recovery) | Error class hierarchy; `instanceof` handling pattern; pre-flight checks (`isUseable`, voice channel existence, `queue.isEmpty()`); persist vs clear on teardown |

### TypeDoc API Reference

The [TypeDoc reference](https://hoshimi-web.vercel.app/core-api/index.html) documents:

- **23 classes** — Hoshimi, NodeManager, Player, Queue, Node, Track, UnresolvedTrack, FilterManager, LyricsManager, Rest, storage adapters, error classes
- **22 enums** — `State`, `LoopMode`, `LoadType`, `SearchSources`, `FilterType`, `TrackEndReason`, `DestroyReasons`, `OpCodes`, and more
- **96 interfaces** — PlayOptions, PlayerOptions, PlayerUpdate, KaraokeSettings, EQBandSettings, VoiceState, VoicePacket, LyricsResult, and more
- **49 type aliases** — `Awaitable`, `DeepRequired`, `Nullable`, `Prettify`, `*Structure` aliases, custom search sources
