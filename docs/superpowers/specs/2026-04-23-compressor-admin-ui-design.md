# Compressor Admin Controls — Design Spec

Date: 2026-04-23
Status: approved

---

## Overview

Expose NodeLink's compressor filter parameters in a polished, admin-only section of the web UI's Settings → Server tab. Guild-level configuration (not per-song), with explicit save behavior.

---

## 1. Database

**New table: `guild_settings`** (packages/server/src/shared/db/schema.ts)

```typescript
export const guildSettings = sqliteTable('guildSettings', {
  id: integer('id').primaryKey(),           // always 1 — single guild row
  compressorEnabled: integer('compressorEnabled', { mode: 'boolean' }).notNull().default(false),
  compressorThreshold: integer('compressorThreshold').notNull().default(-6),  // dB, -60 to 0
  compressorRatio: real('compressorRatio').notNull().default(4.0),           // 1 to 20
  compressorAttack: integer('compressorAttack').notNull().default(5),         // ms, 0 to 100
  compressorRelease: integer('compressorRelease').notNull().default(50),       // ms, 10 to 1000
  compressorGain: integer('compressorGain').notNull().default(3),             // dB, 0 to 24
});
```

Default row (id=1) created on first migration run. No upsert logic needed — the guild always has exactly one settings row.

**Migration file:** `packages/server/src/shared/db/migrations/0001_add_guild_settings.sql`

---

## 2. API

**Endpoint:** `PATCH /api/settings/compressor`

**Request body:**
```json
{
  "enabled": true,
  "threshold": -6,
  "ratio": 4.0,
  "attack": 5,
  "release": 50,
  "gain": 3
}
```

**Response:** `200 OK` with the updated settings object, or `400` with validation errors.

**Behavior:**
1. Validate all fields (ranges: threshold -60→0, ratio 1→20, attack 0→100, release 10→1000, gain 0→24)
2. Upsert into `guildSettings` where id = 1
3. If the player is currently connected, call `node.rest.updatePlayer({ guildId, playerOptions: { filters: { compressor: {...} } } })`
4. Broadcast updated `compressorSettings` via `player:update` WebSocket event

**Route file:** `packages/server/src/routes/compressor.ts` (new file)

**Auth:** Requires admin (`ctx.isAdmin`).

---

## 3. WebSocket

The `QueueState` type (shared) gains a new field:

```typescript
compressorSettings: {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  gain: number;
} | null;
```

`emitPlayerUpdate` in `socket.ts` always includes this field when broadcasting queue state.

The web UI's `useSocket` hook already handles `player:update` events — no changes needed there.

---

## 4. Player Integration

When `GuildPlayer` starts or restarts playback, it reads the current compressor settings from the DB and applies them via NodeLink:
```typescript
await node.rest.updatePlayer({ guildId, playerOptions: { filters: { compressor: {...} } } });
```

`GuildPlayer` does not need to track compressor state — it reads from DB on play start.

---

## 5. UI Components

### CompressorSection (new file: `packages/web/src/components/settings/CompressorSection.tsx`)

Rendered inside `ServerTab.tsx`, between the Admin Mode toggle and the Tags section heading.

```
┌─────────────────────────────────────────────────────────────┐
│  COMPRESSOR                                     [toggle]   │
│                                                             │
│  Threshold   ────●──────────────   -6 dB                   │
│  Ratio        ──●────────────────   4.0:1                    │
│  Attack       ────●──────────────   5 ms                    │
│  Release      ──●────────────────   50 ms                    │
│  Gain         ──────●────────────   +3 dB                   │
│                                                             │
│  [Save Changes]                [Reset to Defaults]          │
└─────────────────────────────────────────────────────────────┘
```

**Slider spec (all sliders always visible):**

| Param     | Range         | Step | Default |
|-----------|---------------|------|---------|
| Threshold | -60 → 0 dB    | 1    | -6      |
| Ratio     | 1.0 → 20 :1   | 0.5  | 4.0     |
| Attack    | 0 → 100 ms    | 1    | 5       |
| Release   | 10 → 1000 ms  | 10   | 50      |
| Gain      | 0 → 24 dB     | 1    | 3       |

**States:**
- `isAdminView = false`: entire section dimmed (`opacity-40 pointer-events-none`)
- `enabled = false`: section normal opacity but toggle off; sliders visible but functionally inactive
- `hasChanges = false`: "Save Changes" button disabled
- `hasChanges = true`: "Save Changes" button active (accent color)
- "Reset to Defaults" resets local state only; admin must Save to apply

**Component dependencies:** Uses existing `SettingsToggle` component for the enable toggle. No new UI library dependencies.

---

## 6. Type Changes

- `QueueState` (shared types) — add `compressorSettings: CompressorSettings | null`
- `CompressorSettings` type defined in shared types, exported from `@alfira-bot/server/shared`

---

## 7. Implementation Order

1. Add Drizzle schema + migration for `guildSettings` table
2. Add `CompressorSettings` and `QueueState.compressorSettings` to shared types
3. Create `PATCH /api/settings/compressor` route
4. Add NodeLink filter call to `GuildPlayer.ts` on play start
5. Update `emitPlayerUpdate` to include compressor settings
6. Build `CompressorSection.tsx` component
7. Add to `ServerTab.tsx`
8. Verify end-to-end: save → broadcast → web UI reflects update

---

## 8. Not in Scope

- Per-song compressor overrides
- Visual compressor meter / gain reduction display
- Preset system (save/load named compressor profiles)
- Any changes to the Discord bot side