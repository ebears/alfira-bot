---
name: seyfert
description: Use when working with Seyfert v4 Discord framework — client initialization, createEvent API, gateway, intents, command registration, or voice integration.
---

# Seyfert v4 Expert Reference

Seyfert is a TypeScript Discord framework. Alfira uses Seyfert v4 with Hoshimi for audio.

## Docs
- **GitHub:** https://github.com/Zyumiy0/Seyfert
- **npm:** https://www.npmjs.com/package/seyfert

---

## Client Initialization

```typescript
import { Client } from 'seyfert';

const client = new Client({
  getRC: async () => ({
    token: process.env.DISCORD_BOT_TOKEN,
    locations: { base: '' },   // empty when using programmatic event registration
    intents,                  // GatewayIntentBits value
    debug: false,
  }),
});
```

No `seyfert.config.mjs` required. All config is passed via `getRC`.

---

## Starting the Client

```typescript
await client.start();
// Events are loaded automatically from the file-system location or registered programmatically.
```

`client.start()` returns `Promise<void>`. After start, register events programmatically:

```typescript
await client.start();
client.events.set([readyEvent, rawEvent] as any);
```

---

## `createEvent` — Event Definition API

The correct v4 API for defining events:

```typescript
import { createEvent } from 'seyfert';

const readyEvent = createEvent({
  data: { name: 'ready' as const, once: true },
  run(user, _client) {
    // user is the bot's User object
    logger.info(`Bot logged in as ${user.username}`);
  },
});
```

```typescript
const rawEvent = createEvent({
  data: { name: 'raw' as const },
  run(packet, _client) {
    // packet is the raw GatewayDispatchPayload
    hoshimi.updateVoiceState(packet as Parameters<typeof hoshimi.updateVoiceState>[0]);
  },
});
```

```typescript
const voiceStateUpdateEvent = createEvent({
  data: { name: 'voiceStateUpdate' as const },
  run(state, oldState, _client) {
    // Seyfert passes [state] or [state, oldState]; destructure appropriately.
    const currentState = Array.isArray(state) ? state[0] : state;
    const previousState = Array.isArray(state) ? state[1] : oldState;
    // ...
  },
});
```

### Event `data` Options
| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Event name — e.g. `'ready'`, `'raw'`, `'voiceStateUpdate'` |
| `once` | `boolean?` | If `true`, the event is removed after first fire |

### Event `run` Signature
`run(payload, client)` — payload shape depends on the event name.

---

## Event Registration (Programmatic)

After `client.start()`, register events via `client.events.set()`:

```typescript
client.events.set([readyEvent, rawEvent, voiceStateUpdateEvent] as any);
```

The `as any` is needed because `createEvent` return has `once?: boolean` but `ClientEvent` requires `once: boolean` — values are correct at runtime.

---

## Gateway

### Sending Payloads
```typescript
client.gateway.send(shardId, payload);

// Calculate shard for a guild
const shardId = client.gateway.calculateShardId(guildId);
```

### Latency
```typescript
client.gateway.latency; // number (ms)
```

---

## Intent Bits

```typescript
import { GatewayIntentBits } from 'seyfert';

// Or bitwise OR directly
const intents = GatewayIntentBits.Guilds | GatewayIntentBits.GuildVoiceStates;
// 1 | 128
```

| Intent | Bit | Value |
|--------|-----|-------|
| `Guilds` | `1` | `1` |
| `GuildVoiceStates` | `128` | `128` |

---

## `ready` vs `botReady`

- **`ready`** — fires per-shard when that shard is ready. Use with `once: true` for single-fire behavior.
- **`botReady`** — fires once when **all shards** are ready.

Alfira uses `ready` with `once: true`:

```typescript
const readyEvent = createEvent({
  data: { name: 'ready' as const, once: true },
  run(user, _client) {
    hoshimi.init({ id: user.id, username: user.username });
    logger.info(`Bot logged in as ${user.username}`);
  },
});
```

---

## Uploading Slash Commands

```typescript
await client.uploadCommands({ cachePath });
```

---

## Client Logger

```typescript
client.logger.info('message');
client.logger.error('message');
// etc.
```

Seyfert exposes its built-in logger via `client.logger`.

---

## Two-Phase Voice Handling (Alfira)

Alfira uses **two separate Seyfert events** for voice integration:

### Phase 1: `raw` — Forward Packets to Hoshimi

```typescript
const rawEvent = createEvent({
  data: { name: 'raw' as const },
  run(packet, _client) {
    hoshimi.updateVoiceState(packet as Parameters<typeof hoshimi.updateVoiceState>[0]);

    // Also track human voice membership for auto-pause.
    if (packet.t === 'VOICE_STATE_UPDATE') {
      const d = packet.d as { guild_id: string; user_id: string; channel_id: string | null; member?: { user?: { bot?: boolean } } };
      // ... human tracking logic
    }
  },
});
```

### Phase 2: `voiceStateUpdate` — Auto-Pause on Human Leave

```typescript
const voiceStateUpdateEvent = createEvent({
  data: { name: 'voiceStateUpdate' as const },
  run(state, oldState, _client) {
    const currentState = Array.isArray(state) ? state[0] : state;
    const previousState = Array.isArray(state) ? state[1] : oldState;
    // ... detect if human left bot's channel, auto-pause if no humans remain
  },
});
```

---

## Links

| Resource | URL |
|----------|-----|
| Seyfert GitHub | https://github.com/Zyumiy0/Seyfert |
| Seyfert npm | https://www.npmjs.com/package/seyfert |
