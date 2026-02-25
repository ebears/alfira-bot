# Discord Music Bot — Project Document

## Table of Contents

1. [Project Scope](#1-project-scope)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Design](#4-database-design)
5. [Discord Bot](#5-discord-bot)
6. [REST API](#6-rest-api)
7. [Web UI](#7-web-ui)
8. [Authentication & Permissions](#8-authentication--permissions)
9. [Real-Time Sync](#9-real-time-sync)
10. [Error Handling](#10-error-handling)
11. [Build Order](#11-build-order)

---

## 1. Project Scope

### What this project is

A self-hosted Discord music bot where the **web UI is the primary interface**. Users log in with their Discord account, and what they can see and do depends on their role. The bot handles audio playback in a voice channel; the web UI handles everything else — browsing songs, managing playlists, and controlling playback in real time.

### Roles

| Role | Permissions |
|---|---|
| **Admin** | Add/delete songs, create/delete playlists, manage playlist contents, control playback |
| **Member** | View songs, view playlists, view the live player state — no controls |

Admin status is determined by a configurable list of Discord role IDs set in the bot's environment config. Anyone in the server who is not an admin is a member.

### Explicit non-goals

- No multi-server support. This is scoped to a single Discord guild.
- No drag-to-reorder playlists.
- No song search by name. Songs are added via YouTube URL only.
- No mobile app. The web UI should be usable on mobile browsers, but it is not a dedicated app.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js v18+ |
| Language | TypeScript throughout |
| Discord library | discord.js v14 + @snazzah/davey (DAVE E2EE protocol) |
| Audio | yt-dlp + FFmpeg |
| Voice | @discordjs/voice |
| API framework | Express.js |
| Real-time | Socket.io |
| Database ORM | Prisma |
| Database | PostgreSQL |
| Frontend | React (Vite) |
| Styling | Tailwind CSS |
| HTTP client | Axios |
| Auth | Discord OAuth2 + JWT (HttpOnly cookie) |

### Why these choices

- **TypeScript throughout** means you define a type like `Song` once and share it between the bot, API, and frontend — no duplicate definitions, no mismatches.
- **Prisma** gives you type-safe database access and a clean migration workflow. It generates TypeScript types from your schema automatically.
- **yt-dlp** is the most reliable tool for extracting audio from YouTube. It updates frequently to keep pace with YouTube's changes, so it should be pinned and updated regularly.
- **Socket.io** handles the real-time sync. Since the web player is the primary interface, this is a core part of the architecture, not a bolt-on.

---

## 3. Project Structure

```
discord-music-bot/
├── package.json                             ← Monorepo root (npm workspaces) ✅
├── docker-compose.yml                       ← PostgreSQL for development ✅
│
└── packages/
    ├── shared/                              ← ✅ Complete (Phase 3)
    │   ├── package.json
    │   └── src/
    │       └── types.ts                     ← Song, QueuedSong, LoopMode, QueueState, Playlist
    │
    ├── api/                                 ← ✅ Complete (Phases 3, 5)
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   ├── .env                             ← Create from .env.example (never commit)
    │   ├── prisma/
    │   │   └── schema.prisma                ← output set to root node_modules/.prisma/client
    │   └── src/
    │       ├── index.ts                     ← Combined entry point: Express + bot in one process
    │       ├── lib/
    │       │   └── prisma.ts                ← Prisma client singleton
    │       ├── middleware/
    │       │   ├── requireAuth.ts           ← JWT verification via HttpOnly cookie
    │       │   ├── requireAdmin.ts          ← Checks req.user.isAdmin, returns 403 if false
    │       │   └── errorHandler.ts          ← Global error handler + asyncHandler wrapper
    │       └── routes/
    │           ├── songs.ts                 ← GET, POST, DELETE /api/songs
    │           ├── playlists.ts             ← Full CRUD + song add/remove
    │           ├── player.ts                ← queue, play, skip, stop, loop, shuffle
    │           └── auth.ts                  ← Full Discord OAuth2 flow + JWT issuance
    │                                           /auth/callback now redirects to WEB_UI_ORIGIN
    │
    ├── bot/                                 ← ✅ Complete (Phases 1, 2, 3, 4)
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts
    │       ├── deploy-commands.ts
    │       ├── commands/
    │       │   ├── join.ts, leave.ts, play.ts, skip.ts, stop.ts
    │       │   ├── loop.ts, shuffle.ts, queue.ts, nowplaying.ts
    │       │   └── playlist.ts
    │       ├── lib/
    │       │   └── prisma.ts
    │       ├── player/
    │       │   ├── GuildPlayer.ts
    │       │   └── manager.ts
    │       └── utils/
    │           └── ytdlp.ts
    │
    └── web/                                 ← ✅ Complete (Phase 6)
        ├── package.json                     ← Vite + React + Tailwind + Axios
        ├── tsconfig.json
        ├── vite.config.ts                   ← Proxies /api and /auth to :3001
        ├── tailwind.config.js               ← Dark theme: near-black, lime accent (#c8f135)
        ├── postcss.config.js
        ├── index.html                       ← Bebas Neue, Karla, JetBrains Mono from Google Fonts
        └── src/
            ├── main.tsx
            ├── App.tsx                      ← Route definitions
            ├── index.css                    ← Tailwind directives + global component classes
            ├── api/
            │   ├── client.ts                ← Axios instance; 401 → redirect to /login
            │   ├── types.ts                 ← Frontend-local mirrors of shared types
            │   └── api.ts                   ← Typed wrappers for all API endpoints
            ├── context/
            │   └── AuthContext.tsx          ← Fetches /auth/me on load; exposes user + logout
            └── components/
            │   ├── ProtectedRoute.tsx       ← Redirects unauthenticated users to /login
            │   └── Layout.tsx               ← Sidebar nav, main content area, Now Playing bar stub
            └── pages/
                ├── LoginPage.tsx            ← Centered card; "Login with Discord" → /auth/login
                ├── SongsPage.tsx            ← Searchable grid, add-song modal, delete confirm,
                │                               add-to-playlist popover (admin only)
                ├── PlaylistsPage.tsx        ← List with song counts, create/delete (admin only)
                ├── PlaylistDetailPage.tsx   ← Ordered track list, click-to-rename, add songs modal,
                │                               remove-from-playlist, Play modal with mode/loop
                └── PlayerPage.tsx           ← Stub — implemented in Phase 7
```

### Environment variable added in Phase 6

Add `WEB_UI_ORIGIN=http://localhost:5173` to `packages/api/.env`. This controls where
`/auth/callback` redirects after a successful login. In production, set it to your deployed
frontend URL.

### Prisma client generation note

The schema's `generator` block sets `output = "../../../node_modules/.prisma/client"` so the
generated client is written to the root `node_modules` and resolved correctly by both the bot
and API packages. Run `npm run db:generate` from the project root after any schema change or
fresh clone. `@prisma/client` is a thin shim that automatically forwards to `.prisma/client` —
no import changes are needed in application code.

---

## 4. Database Design

```prisma
model Song {
  id            String         @id @default(cuid())
  title         String
  youtubeUrl    String         @unique
  youtubeId     String         @unique
  duration      Int            // seconds
  thumbnailUrl  String
  addedBy       String         // Discord user ID
  createdAt     DateTime       @default(now())
  playlistSongs PlaylistSong[]
}

model Playlist {
  id        String         @id @default(cuid())
  name      String
  createdBy String         // Discord user ID
  createdAt DateTime       @default(now())
  songs     PlaylistSong[]
}

model PlaylistSong {
  id         String   @id @default(cuid())
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  playlistId String
  song       Song     @relation(fields: [songId], references: [id], onDelete: Cascade)
  songId     String
  position   Int

  @@unique([playlistId, songId])
  @@index([playlistId, position])
}
```

### Key decisions

- `youtubeId` is stored separately so thumbnails can be constructed as `https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg` without parsing the URL every time.
- `position` on `PlaylistSong` keeps playlists ordered. When playing in random mode, position is ignored at runtime — the DB is never shuffled.
- Cascade deletes on `PlaylistSong` mean removing a song from the library automatically removes it from all playlists.
- No `guildId` column is needed since this is a single-server app.

---

## 5. Discord Bot

The bot's responsibilities are narrow: join voice channels, manage the audio queue, and play audio. All music library management happens through the web UI and API.

### Slash commands

| Command | Description |
|---|---|
| `/join` | Join your current voice channel |
| `/leave` | Leave the voice channel |
| `/play [url]` | Add a YouTube URL to the queue and start playing |
| `/skip` | Skip the current song |
| `/stop` | Stop playback and clear the queue |
| `/queue` | Display the current queue as a Discord embed |
| `/loop [off/song/queue]` | Set the loop mode |
| `/shuffle` | Shuffle the remaining queue |
| `/playlist play [name]` | Load a saved playlist from the database |
| `/nowplaying` | Show what's currently playing |

### GuildPlayer class

The player is a class that manages all audio state for the guild. One instance exists for the lifetime of a voice session.

```
GuildPlayer
├── queue: QueuedSong[]
├── currentSong: QueuedSong | null
├── loopMode: "off" | "song" | "queue"
├── skipping: boolean          — Distinguishes a manual skip from natural track end
├── queueSnapshot: QueuedSong[] — Used to reset the queue when loopMode is 'queue'
├── connection: VoiceConnection
├── audioPlayer: AudioPlayer (@discordjs/voice)
├── textChannel: TextChannel   — For "Now playing" embeds on auto-advance
│
├── addToQueue(song)   — Append a QueuedSong; starts playback if idle
├── skip()             — Sets skipping flag and stops AudioPlayer (triggers onTrackEnd)
├── stop()             — Clears queue, stops player, destroys connection
├── shuffle()          — Fisher-Yates shuffle of the upcoming queue
├── setLoopMode(mode)  — Change loop mode
├── getCurrentSong()   — Read-only getter → QueuedSong | null
├── getQueue()         — Returns a shallow copy of the queue → QueuedSong[]
├── getLoopMode()      — Read-only getter → LoopMode
├── isPlaying()        — Checks AudioPlayer status → boolean
├── getQueueState()    — Returns a QueueState snapshot for API/Socket.io
├── playNext()         — Internal: fetches fresh CDN URL and starts next track
└── onTrackEnd()       — Internal: applies loop logic and calls playNext()
```

### Playback flow

1. A song is added to the queue via slash command (`/play`) or the web player API (`POST /api/player/play`).
2. If nothing is playing, `playNext()` is called immediately.
3. `getStreamUrl()` runs `yt-dlp -g` to resolve a direct CDN URL just before playback. This is intentionally deferred to playback time — not enqueue time — so URLs never go stale in long queues.
4. `@discordjs/voice` creates an `AudioResource` from the CDN URL and FFmpeg handles buffering and Opus encoding. The CDN URL approach (rather than piping yt-dlp stdout) eliminates throttle-induced choppiness.
5. When the track ends, `onTrackEnd()` checks the `skipping` flag and loop mode, then either replays the song, advances the queue, or stops.
6. The player sends a "Now playing" embed to the text channel on auto-advance. **`broadcastQueueUpdate()` is not yet wired up** — that is a Phase 8 concern when Socket.io is added.

### /play command — DB lookup behaviour

After fetching metadata via yt-dlp, `play.ts` queries the database by `youtubeId`. If the song
exists in the library the `QueuedSong` is built from the DB record (real `id` and `addedBy`
values). If the song is not in the library (URL pasted directly into Discord without going
through the web UI first), `id` and `addedBy` fall back to empty strings so playback still works
— the library is the web UI's domain, not the bot's.

### /playlist play command — DB lookup behaviour

`playlist.ts` queries Prisma for a playlist by name (case-insensitive). Songs are fetched in
`position` order with their full `Song` records joined, so every `QueuedSong` has real `id` and
`addedBy` values. The `requestedBy` field is set to the Discord member's display name at queue
time.

### yt-dlp wrapper

```typescript
// utils/ytdlp.ts — actual implementation

// Resolves a direct CDN URL using -g. FFmpeg then opens its own HTTP
// connection to this URL, avoiding the throttle-induced choppiness that
// occurs when yt-dlp pipes audio through stdout.
export function getStreamUrl(youtubeUrl: string): Promise<string>

// Fetches title, duration, and thumbnail using --dump-json.
// Duration is Math.round()'d and thumbnail is constructed from youtubeId
// to avoid parsing the URL repeatedly downstream.
export function getMetadata(youtubeUrl: string): Promise<SongMetadata>

// Lightweight URL format check before hitting yt-dlp.
// Accepts: youtube.com, www.youtube.com, youtu.be, music.youtube.com
export function isValidYouTubeUrl(url: string): boolean
```

`execFile` is used throughout instead of `exec` — URLs are passed as argument arrays, not interpolated into shell strings, preventing injection.

### Loop modes

| Mode | Behaviour |
|---|---|
| `off` | Queue plays through once, then stops |
| `song` | Current song repeats until manually skipped |
| `queue` | When the last song finishes, the queue resets and replays from the beginning |

---

## 6. REST API

The API runs in the same Node.js process as the bot. `packages/api/src/index.ts` is the combined entry point — it starts Express, connects Prisma, then calls `startBot()`. This shared process is what allows `GuildPlayer` to call `broadcastQueueUpdate()` directly in Phase 8.

### Auth middleware

Two middleware functions gate every protected route.

- **`requireAuth`** — Reads the JWT from the HttpOnly `session` cookie, verifies it using `JWT_SECRET`, and attaches the decoded payload to `req.user`. Returns `401` if the token is missing, expired, or invalid.
- **`requireAdmin`** — Checks `req.user.isAdmin` and returns `403` if false. Must be used after `requireAuth`.

### Song endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/songs` | Member | List all songs |
| `POST` | `/api/songs` | Admin | Add a song by YouTube URL |
| `DELETE` | `/api/songs/:id` | Admin | Delete a song |

**`POST /api/songs` flow:**
1. Validate the URL format using `isValidYouTubeUrl()`.
2. Call `getMetadata()` via yt-dlp to fetch title, duration, and youtubeId.
3. Check for duplicates by `youtubeId` (more reliable than URL comparison).
4. Save to the database. `addedBy` is set to `req.user.discordId`.
5. Return the new song record as `201 Created`.
6. TODO (Phase 8): emit `songs:added` Socket.io event.

### Playlist endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/playlists` | Member | List all playlists (with song count) |
| `POST` | `/api/playlists` | Admin | Create a new playlist |
| `GET` | `/api/playlists/:id` | Member | Get a playlist with its ordered songs |
| `PATCH` | `/api/playlists/:id` | Admin | Rename a playlist |
| `DELETE` | `/api/playlists/:id` | Admin | Delete a playlist |
| `POST` | `/api/playlists/:id/songs` | Admin | Add a song to a playlist |
| `DELETE` | `/api/playlists/:id/songs/:songId` | Admin | Remove a song from a playlist |

### Player endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/player/queue` | Member | Get the current queue state |
| `POST` | `/api/player/play` | Admin | Start playback |
| `POST` | `/api/player/skip` | Admin | Skip the current song |
| `POST` | `/api/player/stop` | Admin | Stop playback |
| `POST` | `/api/player/loop` | Admin | Set loop mode |
| `POST` | `/api/player/shuffle` | Admin | Shuffle the queue |

**`POST /api/player/play` request body:**
```json
{
  "playlistId": "clx...",      // Optional. Omit to play the full library.
  "mode": "random",             // "sequential" | "random"
  "loop": "queue"               // "off" | "song" | "queue"
}
```

**`GET /api/player/queue` response:**
```json
{
  "isPlaying": true,
  "loopMode": "queue",
  "currentSong": {
    "id": "clx...",
    "title": "Song Title",
    "youtubeId": "dQw4w9WgXcQ",
    "duration": 212,
    "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  },
  "queue": [ ... ]
}
```

### Auth endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Redirect to Discord OAuth2 |
| `GET` | `/auth/callback` | Handle OAuth2 callback, issue JWT, redirect to WEB_UI_ORIGIN |
| `GET` | `/auth/me` | Return the current user's info and role |
| `POST` | `/auth/logout` | Clear the session cookie |

---

## 7. Web UI

The web UI is the primary way all users interact with the bot. Since the web player is central, real-time state from Socket.io should be treated as the source of truth for the player page — not polling.

### Design system

Dark, music-poster aesthetic. Near-black backgrounds (`#080808` base, `#111111` surface),
electric lime accent (`#c8f135`), Bebas Neue for display headings, Karla for body text,
JetBrains Mono for metadata and labels. Defined as Tailwind theme tokens.

### Layout

A persistent sidebar for navigation and a fixed **Now Playing bar** at the bottom of every page, visible to all users. The bar shows the current song's thumbnail, title, and duration. Admins also see Skip and Stop buttons in the bar.

```
┌─────────────────────────────────────┐
│  🎵 alfira      [User Avatar]       │
├──────────┬──────────────────────────┤
│          │                          │
│  Songs   │    [Page Content]        │
│          │                          │
│ Playlists│                          │
│          │                          │
│  Player  │                          │
│          │                          │
├──────────┴──────────────────────────┤
│  [Thumbnail] Song Title   ⏭ ⏹      │  ← Admins only see controls
└─────────────────────────────────────┘
```

### Login page (`/login`) ✅

A centered card with a "Login with Discord" button. Unauthenticated users are redirected here
from any protected route via `ProtectedRoute`. After OAuth2 completes the API sets the JWT
cookie and redirects to the web UI root; `AuthContext` then fetches `/auth/me` automatically.

### Song Library (`/songs`) ✅

- A search bar for client-side filtering by title.
- A responsive grid of song cards showing: thumbnail, title, and duration.
- **Admins only:** An "Add Song" button that opens a modal with a YouTube URL input. On submit, calls `POST /api/songs`. Shows a loading state while yt-dlp fetches metadata. Displays an inline error if the URL is invalid or already exists.
- **Admins only:** A delete button on each song card with a confirmation dialog.
- **Admins only:** An "add to playlist" popover on each card showing all playlists; already-added playlists show a checkmark.

### Playlists (`/playlists`) ✅

- A list of playlist rows showing name and song count.
- **Admins only:** A "New Playlist" button that opens a create modal.
- Clicking a playlist navigates to its detail view.
- **Admins only:** Per-row delete with hover reveal.

**Playlist detail (`/playlists/:id`) ✅**
- Ordered track list with position numbers and thumbnails.
- **Admins only:** Click the playlist name to rename it inline.
- **Admins only:** A "Remove" button on each song row (hover-revealed).
- **Admins only:** An "Add Songs" button opens a searchable modal showing the full library, with per-song add buttons that show a checkmark once added.
- **Admins only:** A "Play" button opens a modal with sequential/random order and off/song/queue loop selectors, wired to `POST /api/player/play`.
- **Admins only:** A "Delete" button to remove the playlist entirely.

### Player (`/player`)

- **Now Playing card:** Large thumbnail, title, and a progress bar (updated via Socket.io).
- **Queue list:** Ordered list of upcoming songs.
- **Admins only:** Full playback controls — Play, Skip, Stop, Loop mode selector, Shuffle.
- **Admins only:** A "Load Playlist" section to select and queue a playlist.
- **Members:** The page is fully visible but all controls are hidden. They see exactly what's playing and what's coming up, in real time.

---

## 8. Authentication & Permissions

### Discord OAuth2 flow

1. User clicks "Login with Discord."
2. They are redirected to Discord's OAuth2 authorization URL, requesting the `identify` scope.
3. After authorising, Discord redirects to `/auth/callback?code=...`.
4. The API exchanges the code for a Discord access token.
5. The API fetches the user's Discord identity (id, username, avatar).
6. The API uses the bot token to fetch the user's guild member record and role IDs directly,
   avoiding the need for the `guilds.members.read` OAuth scope.
7. The API checks whether any of their role IDs match the configured admin role IDs.
8. A JWT is issued containing the user's Discord ID, username, avatar, and `isAdmin` flag. It is set as an `HttpOnly` cookie.
9. The user is redirected to `WEB_UI_ORIGIN` (default: `http://localhost:5173`).

### Role check

Admin role IDs are stored in `api/.env` as a comma-separated list:

```
ADMIN_ROLE_IDS=123456789,987654321
```

The `requireAdmin` middleware reads these at startup and checks the `isAdmin` flag on the JWT. The JWT is re-issued on each login, so role changes in Discord take effect on the user's next login.

### What this means for the UI

The `GET /auth/me` endpoint returns the user's info including `isAdmin`. `AuthContext` fetches
this on load and stores it in React context. All admin-only UI elements are conditionally
rendered based on this flag. This is UI-only gating — the API enforces the same rules
independently.

---

## 9. Real-Time Sync

Socket.io is used to push state from the server to all connected web clients. Since the web player is the primary interface, this is not optional — users should never have to refresh to see what's playing.

### Architecture

The bot, API, and Socket.io server run in the same Node.js process. When the `GuildPlayer` changes state (song starts, song ends, skip, stop, shuffle), it directly calls a `broadcastQueueUpdate()` function that emits to all connected Socket.io clients. No Redis or inter-process communication is needed for a single-server setup.

### Events emitted by the server

| Event | Payload | Trigger |
|---|---|---|
| `player:update` | Full `QueueState` object | Any queue or playback state change |
| `songs:added` | New `Song` object | A song is added to the library |
| `songs:deleted` | Deleted song's `id` | A song is removed from the library |
| `playlists:updated` | Updated `Playlist` object | A playlist is created, renamed, or its songs change |

A single `player:update` event covers all playback changes (now playing, skip, stop, shuffle, loop mode change) rather than separate events for each. This keeps the client logic simple: whenever `player:update` fires, replace the entire local queue state.

### Client handling

```typescript
// hooks/usePlayer.ts
const socket = useSocket(); // connects to Socket.io on mount

useEffect(() => {
  socket.on('player:update', (state: QueueState) => {
    setQueueState(state);
  });

  // Fetch initial state on connect (in case we missed events)
  fetchQueueState().then(setQueueState);

  return () => socket.off('player:update');
}, [socket]);
```

On initial connect (and reconnect), the client always fetches the current queue state via `GET /api/player/queue`. This ensures a user who opens the web UI mid-song sees the correct state immediately, without waiting for the next `player:update` event.

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| yt-dlp fails (private/deleted video) | Bot skips the song, posts an error message in the text channel, emits `player:update` |
| Invalid YouTube URL submitted | `POST /api/songs` returns `400` with a clear message; the UI shows it inline in the modal |
| Duplicate song submitted | `POST /api/songs` returns `409`; the UI shows "This song is already in your library" |
| Bot is kicked from voice channel | `GuildPlayer` is destroyed; `player:stopped` state is broadcast via Socket.io |
| User runs `/play` without being in a voice channel | Bot replies with an ephemeral error message visible only to that user |
| Web UI loses Socket.io connection | Socket.io handles automatic reconnection; on reconnect, the client re-fetches queue state via REST |
| JWT is expired | API returns `401`; the Axios interceptor in `client.ts` redirects the user to `/login` |

---

## 11. Build Order

Each phase produces something functional before the next begins.

**Phase 1 — Bot audio proof of concept ✅ COMPLETE**
Bot connects, joins/leaves voice channels, and plays audio from a YouTube URL via yt-dlp + FFmpeg. CDN URL approach (`-g` flag) adopted over stdout piping to resolve throttle-induced choppiness. `@snazzah/davey` added for Discord's DAVE E2EE voice protocol.

**Phase 2 — Queue and slash commands ✅ COMPLETE**
`GuildPlayer` class built with full queue management. All slash commands implemented and working: `/join`, `/leave`, `/play`, `/skip`, `/stop`, `/loop`, `/shuffle`, `/queue`, `/nowplaying`. The `skipping` flag correctly handles skip behaviour across all loop modes.

**Phase 3 — Database and API ✅ COMPLETE**
`packages/shared` created with `Song`, `QueuedSong`, `LoopMode`, `QueueState`, `Playlist` types. `packages/api` created as the new combined entry point — Express, Prisma, and the bot all start from `api/src/index.ts` in a single process. All song, playlist, and player CRUD endpoints implemented. `docker-compose.yml` added for PostgreSQL. Auth middleware fully implemented (not stubs). Bot's `index.ts` refactored to export `startBot()` instead of self-executing. `GuildPlayer` updated to use `QueuedSong` and exposes `getQueueState()`. `bot/src/types.ts` now re-exports from shared.

**Phase 4 — Bot reads from the database ✅ COMPLETE**
`/playlist play [name]` fully implemented — queries Prisma for the playlist by name (case-insensitive), joins the `Song` records in position order, and enqueues them as fully populated `QueuedSong` objects. `/play` updated to look up the song by `youtubeId` after fetching metadata so songs in the library get real `id` and `addedBy` values. Bot-local Prisma singleton added at `bot/src/lib/prisma.ts`. Prisma schema updated to generate the client to the root `node_modules/.prisma/client` so both the bot and API packages resolve the same generated client. `SlashCommandSubcommandsOnlyBuilder` added to the `Command` type union.

> **Running the project:** `npm run dev` starts everything (API + bot). After any schema change or fresh clone, run `npm run db:generate` first.

**Phase 5 — Discord OAuth2 ✅ COMPLETE**
Full OAuth2 flow implemented in `auth.ts`. Bot token used to fetch guild member roles server-side, avoiding the `guilds.members.read` scope. `requireAuth` and `requireAdmin` middleware are real JWT-based implementations. `GET /auth/me` and `POST /auth/logout` work. `/auth/callback` now redirects to `WEB_UI_ORIGIN` (add this to `packages/api/.env`).

**Phase 6 — Web UI: Songs and Playlists ✅ COMPLETE**
`packages/web` created as a new Vite + React + Tailwind workspace. Dark music-poster aesthetic with near-black backgrounds and lime accent. `AuthContext` fetches `/auth/me` on load and gates all protected routes via `ProtectedRoute`. `Layout` provides the persistent sidebar and a Now Playing bar stub. Login page redirects to `/auth/login`. Song Library page has searchable grid, add-song modal, delete confirm, and add-to-playlist popover. Playlists page lists all playlists with create/delete. Playlist detail has ordered track list, inline rename, add-songs modal, remove-from-playlist, and a Play modal wired to the player API. Axios interceptor globally handles 401 → redirect to `/login`. Run with `npm run web:dev`.

**Phase 7 — Web UI: Player page** ← *next*
Build the Player page with full playback controls wired to the API. The Now Playing bar in
`Layout.tsx` is already stubbed and ready to be wired up. Fetch initial queue state via
`GET /api/player/queue` on mount. Display current song (large thumbnail, title, duration
progress), the upcoming queue list, and admin controls: Skip, Stop, loop mode selector,
Shuffle, and a Load Playlist section.

**Phase 8 — Real-time sync**
Add Socket.io to the API. Wire `GuildPlayer` to call `broadcastQueueUpdate()` after every state change. Implement `player:update`, `songs:added`, `songs:deleted`, and `playlists:updated` events. Replace the `TODO (Phase 8)` comments in all route handlers. Update the web UI to consume events via a `useSocket` hook. Test by controlling playback from both Discord slash commands and the web UI simultaneously.

**Phase 9 — Polish**
Add loading states, error messages, toast notifications, and empty states throughout the UI. Test edge cases from the error handling table above.
