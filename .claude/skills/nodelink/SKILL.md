---
name: nodelink
description: Use when working with NodeLink audio server, its REST/WebSocket API, audio filters, or Lavalink v4 compatibility in this codebase.
---

# NodeLink Reference (Alfira Bot)

NodeLink is a Lavalink v4-compatible audio streaming server built entirely in Node.js. In this codebase it streams audio to Discord via the `hoshimi` v0.3 client.

---

## Docs
- **GitHub:** https://github.com/PerformanC/NodeLink
- **npm:** https://www.npmjs.com/package/nodelink
- **Official Docs:** https://nodelink.js.org/docs

---

## Docker Deployment

NodeLink runs as a Docker container. **No config.js is used** — all settings are Docker image defaults.

**Image:** `docker.io/performanc/nodelink:latest`

**Dev compose (`docker-compose.yml`):**
```yaml
nodelink:
  image: docker.io/performanc/nodelink:latest
  restart: unless-stopped
  environment:
    HOST: 0.0.0.0
    PORT: 2333
    NODELINK_AUTHORIZATION: ${NODELINK_AUTHORIZATION:-}
    NODELINK_SERVER_USE_BUN_SERVER: "true"
  ports:
    - "2333:3000"      # host:container
```

> **Note on env var names:** The official NodeLink Docker docs use `NODELINK_SERVER_HOST`, `NODELINK_SERVER_PORT`, and `NODELINK_SERVER_PASSWORD`. This project's `docker-compose.yml` uses `HOST`, `PORT`, and `NODELINK_AUTHORIZATION` instead — these are the actual env vars the image respects in this configuration. The internal port is `3000` (not the documented `2333` default), which appears to be an effect of `NODELINK_SERVER_USE_BUN_SERVER: "true"`.

**Prod compose (`docker-compose.prod.yml`):** Same, but no port exposure (container port only).

### Key deployment details
| Setting | Value |
|---------|-------|
| Internal port | 3000 |
| External port | 2333 |
| Host binding | 0.0.0.0 |
| Authorization | `NODELINK_AUTHORIZATION` env var (default: empty = `youshallnotpass` per image default) |
| Bun server mode | `NODELINK_SERVER_USE_BUN_SERVER: "true"` |
| Config file | None — all settings via Docker env vars |

---

## How the Bot Uses NodeLink

The bot never touches NodeLink directly. All communication goes through **`hoshimi` v0.3.9** — a Lavalink v4 client that wraps REST and WebSocket.

### hoshimi Initialization (`packages/bot/src/index.ts:48-96`)

```typescript
const { Hoshimi } = await import('hoshimi');
const nodeConfig = parseNodeLinkUrl(NODELINK_URL);

const hoshimi = new Hoshimi({
  sendPayload: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    guild.shard.send(payload);
  },
  nodes: [
    {
      host: nodeConfig.host,      // "nodelink" (Docker DNS)
      port: nodeConfig.port,      // 3000
      password: NODELINK_AUTH,
      secure: nodeConfig.secure,
    },
  ],
  client: { id: '', username: '' },
});
```

### Voice State Forwarding
Discord gateway events are forwarded to hoshimi:
```typescript
client.on('raw', (packet) => {
  hoshimi.updateVoiceState(packet);
});
```

### hoshimi Player API (what the bot calls)
| Call | Purpose |
|------|---------|
| `player.play({ track, volume })` | Stream track to voice channel |
| `player.stop(true\|false)` | Stop playback; `true` destroys player/voice session |
| `player.setPaused(bool)` | Pause/resume |
| `player.setLoop(mode)` | Set loop mode (1=track, 2=queue, 3=off) |
| `player.connect()` | Reconnect voice to channel |
| `player.destroy(reason)` | Destroy player entirely |
| `player.setFilter(filters)` | Apply audio filters (equalizer, etc.) |

### hoshimi Events the Bot Listens To
```typescript
hoshimi.on('trackEnd', (player, track, payload: TrackEndEvent) => { ... });
hoshimi.on('trackError', (player, track, exception) => { ... });
```

---

## REST API (used by the bot)

**File:** `packages/bot/src/utils/nodelink.ts`

### Load Tracks — `GET /v4/loadtracks?identifier=<url>`

This is the **only** REST endpoint the bot calls. It is used by three functions:

```typescript
// getMetadata — fetches track title, youtubeId, duration, thumbnail
const response = await restRequest<LoadTrackResponse>(
  `/v4/loadtracks?identifier=${encodeURIComponent(youtubeUrl)}`
);

// getStreamFormat — fetches the encoded track token for playback
const response = await restRequest<LoadTrackResponse>(
  `/v4/loadtracks?identifier=${encodeURIComponent(youtubeUrl)}`
);

// getPlaylistMetadataWithVideos — fetches playlist info + track list
const response = await restRequest<LoadTrackResponse>(
  `/v4/loadtracks?identifier=${encodeURIComponent(playlistUrl)}`
);
```

### REST Request Helper
```typescript
function nodelinkHeaders(): { 'Content-Type': string; Authorization?: string } {
  const headers: { 'Content-Type': string; Authorization?: string } = {
    'Content-Type': 'application/json',
  };
  if (NODELINK_AUTH) headers.Authorization = NODELINK_AUTH;
  return headers;
}

async function restRequest<T>(path: string): Promise<T> {
  const url = `${NODELINK_URL}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: nodelinkHeaders(),
  });
  if (!response.ok) {
    throw new Error(`NodeLink REST ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}
```

### LoadTracks Response Shape
```typescript
interface LoadTrackResponse {
  loadType?: string;
  data?: {
    encoded?: string;       // Base64 track token for playback
    info?: {
      title?: string;
      identifier?: string;  // YouTube video ID
      duration?: number;
      isStream?: boolean;
      isSeekable?: boolean;
      position?: number;
      author?: string;
      artworkUrl?: string;
    };
  };
  tracks?: { info?: { identifier?: string; title?: string; duration?: number } }[];
  playlistInfo?: { name?: string; selectedTrack?: number };
  exception?: { message?: string };
}
```

**Important:** The bot does **not** call NodeLink's REST Player CRUD endpoints (`/v4/sessions/{sessionId}/players/{guildId}`). All player state (play, pause, skip, volume) is managed through hoshimi over WebSocket.

---

## Player Lifecycle

1. **Join** → `GuildPlayer.createPlayer()` calls `hoshimi.createPlayer({ guildId, voiceId })`
2. **Connect** → `player.connect()` sends voice server update via hoshimi; NodeLink receives voice state via Discord gateway
3. **Play** → `player.play({ track, volume })` — hoshimi sends encoded track over WebSocket to NodeLink
4. **Pause/Resume** → `player.setPaused(bool)` via hoshimi
5. **Skip** → `player.stop(false)` (stops without destroying voice session), then `playNext()`
6. **Stop** → `player.stop(true)` → `destroy(DestroyReasons.Requested)` sends DELETE to NodeLink, destroying voice session

### Critical: Why `stop(true)` causes "No voice state, track is enqueued"

When all humans leave the voice channel, the bot intentionally does **NOT** call `player.stop()`. Calling `stop(true)` destroys the Hoshimi player, which sends a DELETE to NodeLink and clears its stored voice session (endpoint/sessionId/token). When the subsequent `play()` call tries to play a new track, NodeLink has no voice state and logs the error.

Instead, `playNext()` calls `player.connect()` to re-establish voice state before calling `play()`.

---

## Audio Filters

The bot only uses the **volume filter**. No EQ, timescale, karaoke, or other filters are implemented.

### Volume Calculation (`packages/bot/src/player/GuildPlayer.ts:413-441`)

Volume is passed as a **linear scale** (not dB). The conversion:

```typescript
const volume =
  next.volumeOffset != null && next.volumeOffset !== 0
    ? 10 ** (next.volumeOffset / 20) * 100  // Convert dB offset to linear scale
    : 100;

await player.play({ track: new Track(...), volume });
```

---

## Sources Used

Only **YouTube** is used. The codebase passes YouTube URLs directly to `/v4/loadtracks`. Spotify, SoundCloud, and other sources are **not** configured or used.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODELINK_URL` | Full URL to NodeLink (e.g., `http://nodelink:3000`) |
| `NODELINK_AUTHORIZATION` | Password for NodeLink (default when unset: `youshallnotpass`) |
| `HOST` | Listen interface for the NodeLink server (0.0.0.0) |
| `PORT` | External port mapping (2333) |
| `NODELINK_SERVER_USE_BUN_SERVER` | Use Bun HTTP server (`"true"`) — internal port becomes 3000 |

---

## Official Documentation Links

| Topic | URL |
|-------|-----|
| Home | https://nodelink.js.org/docs |
| REST API | https://nodelink.js.org/docs/api/rest |
| WebSocket API | https://nodelink.js.org/docs/api/websocket |
| Configuration | https://nodelink.js.org/docs/config |
| Docker | https://nodelink.js.org/docs/advanced/docker |
| Audio Filters | https://nodelink.js.org/docs/api/rest (filter section) |