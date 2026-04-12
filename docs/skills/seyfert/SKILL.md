---
name: seyfert
description: Use when working with Seyfert v4 Discord library in this codebase, including bot initialization with getRC override, programmatic event creation with createEvent, client singleton patterns, voice state handling with member.voice(), gateway payload sending, and Hoshimi/NodeLink integration for audio streaming.
---

# Seyfert v4 Patterns (Alfira)

## Overview

Seyfert v4 is used for **voice state management and audio streaming via Hoshimi/NodeLink only**. The bot has no slash commands—all control flows through the web UI HTTP API. This is a non-standard Seyfert usage pattern.

## When to Use

- Initializing Discord client without a `seyfert.config` file
- Creating event handlers programmatically (NOT decorators)
- Accessing voice state via `member.voice()` method
- Sending raw gateway payloads for voice operations
- Integrating with Hoshimi for audio playback
- Registering events after `client.start()`

## Core Patterns

### 1. Client Initialization (No Config File)

```typescript
import { Client } from 'seyfert';

const client = new Client({
  getRC: async () => ({
    token: process.env.DISCORD_BOT_TOKEN,
    locations: { base: '' },  // empty - no file scanning
    intents: 1 | 128,        // Guilds=1, GuildVoiceStates=128
    debug: false,
  }),
});
```

**Key:** Override `getRC` to provide token programmatically. Never use a `seyfert.config` file.

### 2. Programmatic Event Creation

```typescript
import { createEvent } from 'seyfert';

const myEvent = createEvent({
  data: { name: 'eventName' as const },
  run(payload, client) {
    // handle event
  },
});
```

**Key:** Use `createEvent()` factory, NOT TypeScript decorators. Events are plain objects.

### 3. Event Registration (After Start)

```typescript
await client.start();

// Register events after start
client.events.set([readyEvent, rawEvent, otherEvent] as any);
```

**Key:** Call `client.events.set()` AFTER `client.start()`, not before.

### 4. Client Singleton

```typescript
// packages/bot/src/lib/client.ts
import { getClient } from './lib/client';

// Elsewhere in codebase
const client = getClient();
if (!client) throw new Error('Bot not initialized');
```

### 5. Gateway Operations

```typescript
const client = getClient();
const shardId = client.gateway.calculateShardId(guildId);

// Send raw voice gateway payload
client.gateway.send(shardId, rawPayload);
```

### 6. Voice State Access

```typescript
// Use member.voice() - it's a METHOD, not a property
const voice = member.voice();
// voice.channelId, voice.sessionId, etc.
```

### 7. Hoshimi Integration

```typescript
const { Hoshimi } = await import('hoshimi');

const hoshimi = new Hoshimi({
  sendPayload: (guildId: string, payload: unknown) => {
    const shardId = client.gateway.calculateShardId(guildId);
    // @ts-expect-error - hoshimi sends raw gateway payloads
    client.gateway.send(shardId, payload);
  },
  nodes: [{ host, port, password, secure }],
  client: { id: '', username: '' },
});
```

## Quick Reference

| Operation | Pattern |
|-----------|---------|
| Create event | `createEvent({ data: { name: 'x' }, run(payload, client) {} })` |
| Register events | `client.events.set([...events] as any)` |
| Get client | `getClient()` from `packages/bot/src/lib/client.ts` |
| Gateway shard calc | `client.gateway.calculateShardId(guildId)` |
| Send gateway payload | `client.gateway.send(shardId, payload)` |
| Voice state | `member.voice()` (method, not property) |
| Raw event forwarding | Forward `packet.t` and `packet.d` to `hoshimi.updateVoiceState()` |

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| `@Event() decorator` | `createEvent({ data: { name: 'x' } })` |
| `ready` event for startup | `ready` works but `botReady` is recommended by Seyfert docs |
| `member.voice` (property) | `member.voice()` (method call) |
| `client.events.set()` before start | After `client.start()` |
| `seyfert.config` file | Override `getRC` in Client constructor |
| Import Client directly in API | Use `getClient()` singleton from `packages/bot/src/lib/client.ts` |

## Bot Initialization Sequence

1. Create Client with `getRC` override
2. Initialize Hoshimi with `sendPayload` using `client.gateway`
3. Call `await client.start()`
4. Register events via `client.events.set([...])`
5. Call `hoshimi.init({ id, username })` in `ready` event handler

## File Reference

- Bot entry: `packages/bot/src/index.ts:152-206`
- Event creation: `packages/bot/src/index.ts:37-149`
- Client singleton: `packages/bot/src/lib/client.ts`
- Broadcast indirection: `packages/bot/src/lib/broadcast.ts`
- GuildPlayer broadcast calls: `packages/bot/src/player/GuildPlayer.ts:289-291`