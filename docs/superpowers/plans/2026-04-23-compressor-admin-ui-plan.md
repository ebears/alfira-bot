# Compressor Admin Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guild-level compressor settings UI in the web Settings → Server tab, with a PATCH endpoint to persist settings and apply them to NodeLink on playback start.

**Architecture:** Guild-level configuration stored in a new `guildSettings` DB table. A new `PATCH /api/settings/compressor` endpoint persists settings and applies them to the live NodeLink player. The web UI exposes five sliders with explicit save. `QueueState` gains a `compressorSettings` field broadcast via WebSocket on every player update.

**Tech Stack:** Bun, TypeScript, Drizzle ORM (SQLite), hoshimi v0.3 (NodeLink v4), React 19, Tailwind CSS 4.

---

## File Map

| File | Role |
|---|---|
| `packages/server/src/shared/db/schema.ts` | Add `guildSettings` table |
| `packages/server/src/shared/db/migrations/0051_add_guild_settings.sql` | SQL migration |
| `packages/server/src/shared/db/index.ts` | Export `guildSettings` table |
| `packages/server/src/shared/types.ts` | Add `CompressorSettings` type; extend `QueueState` |
| `packages/server/src/shared/index.ts` | Re-export `CompressorSettings` for route/WebSocket consumers |
| `packages/server/src/routes/compressor.ts` | New `PATCH /api/settings/compressor` route |
| `packages/server/src/index.ts` | Register compressor route |
| `packages/server/src/lib/socket.ts` | Read compressor settings for broadcast |
| `packages/server/src/startDiscord.ts` | Pass compressor settings to broadcast |
| `packages/server/src/GuildPlayer.ts` | Apply filter on play start |
| `packages/web/src/components/settings/CompressorSection.tsx` | New UI component |
| `packages/web/src/components/settings/ServerTab.tsx` | Render CompressorSection |

---

## Task 1: Database Schema

**Files:**
- Modify: `packages/server/src/shared/db/schema.ts`
- Modify: `packages/server/src/shared/db/index.ts`
- Create: `packages/server/src/shared/db/migrations/0051_add_guild_settings.sql`

- [ ] **Step 1: Add `guildSettings` table to Drizzle schema**

Open `packages/server/src/shared/db/schema.ts` and add after the `tag` table definition:

```typescript
export const guildSettings = sqliteTable('guildSettings', {
  id: integer('id').primaryKey(),                                   // always 1 — single guild row
  compressorEnabled: integer('compressorEnabled', { mode: 'boolean' }).notNull().default(false),
  compressorThreshold: integer('compressorThreshold').notNull().default(-6),  // dB, -60 to 0
  compressorRatio: real('compressorRatio').notNull().default(4.0),            // 1.0 to 20.0
  compressorAttack: integer('compressorAttack').notNull().default(5),           // ms, 0 to 100
  compressorRelease: integer('compressorRelease').notNull().default(50),        // ms, 10 to 1000
  compressorGain: integer('compressorGain').notNull().default(3),              // dB, 0 to 24
});
```

- [ ] **Step 2: Export `guildSettings` from `packages/server/src/shared/db/index.ts`**

Open the file and add `guildSettings` to the `tables` export object:

```typescript
export const tables = {
  song: schema.song,
  playlist: schema.playlist,
  playlistSong: schema.playlistSong,
  refreshToken: schema.refreshToken,
  tag: schema.tag,
  guildSettings: schema.guildSettings,
};
```

- [ ] **Step 3: Create SQL migration file**

Create `packages/server/src/shared/db/migrations/0051_add_guild_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS "guildSettings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "compressorEnabled" integer NOT NULL DEFAULT 0,
  "compressorThreshold" integer NOT NULL DEFAULT -6,
  "compressorRatio" real NOT NULL DEFAULT 4.0,
  "compressorAttack" integer NOT NULL DEFAULT 5,
  "compressorRelease" integer NOT NULL DEFAULT 50,
  "compressorGain" integer NOT NULL DEFAULT 3
);

INSERT INTO "guildSettings" ("id", "compressorEnabled", "compressorThreshold", "compressorRatio", "compressorAttack", "compressorRelease", "compressorGain")
VALUES (1, 0, -6, 4.0, 5, 50, 3)
ON CONFLICT("id") DO NOTHING;
```

- [ ] **Step 4: Verify migration runs**

Run: `bun run db:migrate`
Expected: Migration completes without error, `guildSettings` table exists in DB.

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/server/src/shared/types.ts`

- [ ] **Step 1: Add `CompressorSettings` type and extend `QueueState`**

Open `packages/server/src/shared/types.ts`. Add the new type before `QueueState`, then add `compressorSettings` field to `QueueState`:

```typescript
export interface CompressorSettings {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  gain: number;
}

export interface QueueState {
  // ... existing fields ...
  compressorSettings: CompressorSettings | null;
}
```

- [ ] **Step 2: Re-export from `packages/server/src/shared/index.ts`**

Open `packages/server/src/shared/index.ts` and add `CompressorSettings` to the type export block:

```typescript
export type {
  // ... existing types ...
  CompressorSettings,
} from './types';
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/server && bun run check` (or `bun tsc --noEmit`)
Expected: No type errors.

---

## Task 3: Compressor Route

**Files:**
- Create: `packages/server/src/routes/compressor.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Create the compressor route**

Create `packages/server/src/routes/compressor.ts`:

```typescript
import { json } from '../lib/json';
import type { RouteContext } from '../index';
import { db, tables } from '../shared/db';
import { getHoshimi } from '../startDiscord';

interface CompressorPayload {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  gain: number;
}

function buildFilters(payload: CompressorPayload) {
  return {
    compressor: {
      threshold: payload.threshold,
      ratio: payload.ratio,
      attack: payload.attack,
      release: payload.release,
      gain: payload.gain,
    },
  };
}

export async function handleCompressor(ctx: RouteContext, request: Request): Promise<Response> {
  if (!ctx.isAdmin) return json({ error: 'Admin access required.' }, 403);

  let body: CompressorPayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { enabled, threshold, ratio, attack, release, gain } = body;

  // Validate ranges
  if (typeof enabled !== 'boolean') return json({ error: 'enabled must be boolean' }, 400);
  if (!Number.isInteger(threshold) || threshold < -60 || threshold > 0) return json({ error: 'threshold must be integer -60 to 0' }, 400);
  if (typeof ratio !== 'number' || ratio < 1 || ratio > 20) return json({ error: 'ratio must be number 1 to 20' }, 400);
  if (!Number.isInteger(attack) || attack < 0 || attack > 100) return json({ error: 'attack must be integer 0 to 100' }, 400);
  if (!Number.isInteger(release) || release < 10 || release > 1000) return json({ error: 'release must be integer 10 to 1000' }, 400);
  if (!Number.isInteger(gain) || gain < 0 || gain > 24) return json({ error: 'gain must be integer 0 to 24' }, 400);

  // Upsert into DB
  await db
    .insert(tables.guildSettings)
    .values({ id: 1, compressorEnabled: enabled, compressorThreshold: threshold, compressorRatio: ratio, compressorAttack: attack, compressorRelease: release, compressorGain: gain })
    .onConflictDoUpdate({
      target: tables.guildSettings.id,
      set: { compressorEnabled: enabled, compressorThreshold: threshold, compressorRatio: ratio, compressorAttack: attack, compressorRelease: release, compressorGain: gain },
    })
    .run();

  // Apply to live NodeLink player if connected
  const hoshimi = getHoshimi();
  if (hoshimi) {
    const player = hoshimi.players.get(process.env.GUILD_ID ?? '');
    if (player?.connected) {
      const filters = enabled ? buildFilters(body) : {};
      await player.node.rest.updatePlayer({
        guildId: process.env.GUILD_ID ?? '',
        playerOptions: { filters },
      });
    }
  }

  return json({ enabled, threshold, ratio, attack, release, gain });
}
```

**Note on imports:** `db`, `tables` come from `'../shared/db'` and `getHoshimi` from `'../startDiscord'` — same pattern as other route files. `RouteContext` is imported as `import type { RouteContext } from '../index'` (line 1), same as all other route handlers.
```

- [ ] **Step 2: Register route in `packages/server/src/index.ts`**

Open `packages/server/src/index.ts`. Add the import at the top with other route imports (after line 16):

```typescript
import { handleCompressor } from './routes/compressor';
```

In the route matching section (after the `/api/player` block at line 184 and before the `/auth` block at line 186), add:

```typescript
if (url.pathname.startsWith('/api/settings/compressor')) {
  return setSecurityHeaders(await handleCompressor(ctx, request));
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/server && bun tsc --noEmit`
Expected: No type errors.

---

## Task 4: QueueState Broadcast with Compressor Settings

**Files:**
- Modify: `packages/server/src/lib/socket.ts`
- Modify: `packages/server/src/GuildPlayer.ts`

- [ ] **Step 1: Add helper to read guild settings from DB**

In `packages/server/src/lib/socket.ts`, add to the top imports:

```typescript
import { eq } from 'drizzle-orm';
import { db, tables } from '../shared/db';
import type { CompressorSettings } from '../shared';
```

Add the helper function:

```typescript
export async function getCompressorSettings(): Promise<CompressorSettings | null> {
  const row = await db
    .select({
      enabled: tables.guildSettings.compressorEnabled,
      threshold: tables.guildSettings.compressorThreshold,
      ratio: tables.guildSettings.compressorRatio,
      attack: tables.guildSettings.compressorAttack,
      release: tables.guildSettings.compressorRelease,
      gain: tables.guildSettings.compressorGain,
    })
    .from(tables.guildSettings)
    .where(eq(tables.guildSettings.id, 1))
    .get();
  if (!row) return null;
  return { enabled: row.enabled, threshold: row.threshold, ratio: row.ratio, attack: row.attack, release: row.release, gain: row.gain };
}
```

- [ ] **Step 2: Update `emitPlayerUpdate` to include compressor settings**

Modify `emitPlayerUpdate` in `socket.ts` to fetch settings and attach them to the state:

```typescript
export async function emitPlayerUpdate(state: QueueState): Promise<void> {
  const compressor = await getCompressorSettings();
  const message = JSON.stringify({ event: 'player:update', data: { ...state, compressorSettings: compressor } });
  for (const client of clients) {
    client.send(message);
  }
}
```

**Note:** `emitPlayerUpdate` becomes `async`. All callers must be updated.

- [ ] **Step 3: Update `broadcast()` in `GuildPlayer.ts` to handle async**

`emitPlayerUpdate` is now async. The private `broadcast()` method in `GuildPlayer.ts` calls `broadcastQueueUpdate` and must handle the Promise without becoming async (many callers are in non-async methods). Use `void` to explicitly fire-and-forget:

```typescript
private broadcast(): void {
  void broadcastQueueUpdate(this.getQueueState());
}
```

No changes needed to any existing `this.broadcast()` call sites — all remain unchanged and work correctly.

- [ ] **Step 4: Verify types and build**

Run: `cd packages/server && bun tsc --noEmit`
Expected: No type errors.

---

## Task 5: Apply Compressor Filter on Playback Start

**Files:**
- Modify: `packages/server/src/GuildPlayer.ts`

- [ ] **Step 1: Add DB and type imports to GuildPlayer.ts**

Open `packages/server/src/GuildPlayer.ts`. Add imports at the top (after the existing imports):

```typescript
import { db, tables } from './shared/db';
import type { CompressorSettings } from './shared';
import { eq } from 'drizzle-orm';
```

- [ ] **Step 2: Add DB read and filter application in playSong()**

Open `packages/server/src/GuildPlayer.ts`. Add import at the top:

```typescript
import { db, tables } from './shared/db';
import type { CompressorSettings } from './shared';
```

In `playSong()`, after the `player.play()` call (line ~480 area), add a follow-up to apply the compressor filter if enabled. Read settings from DB and call `node.rest.updatePlayer`:

```typescript
// Apply compressor filter if enabled
const settings = await db
  .select({
    enabled: tables.guildSettings.compressorEnabled,
    threshold: tables.guildSettings.compressorThreshold,
    ratio: tables.guildSettings.compressorRatio,
    attack: tables.guildSettings.compressorAttack,
    release: tables.guildSettings.compressorRelease,
    gain: tables.guildSettings.compressorGain,
  })
  .from(tables.guildSettings)
  .where(eq(tables.guildSettings.id, 1))
  .get();

if (settings?.enabled) {
  const node = player.node;
  if (node) {
    await node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        filters: {
          compressor: {
            threshold: settings.compressorThreshold,
            ratio: settings.compressorRatio,
            attack: settings.compressorAttack,
            release: settings.compressorRelease,
            gain: settings.compressorGain,
          },
        },
      },
    });
  }
}
```

**Note:** `playSong` is already `async`. Add the import for `eq` from drizzle-orm.

- [ ] **Step 2: Verify build**

Run: `cd packages/server && bun tsc --noEmit`
Expected: No type errors.

---

## Task 6: Build CompressorSection UI Component

**Files:**
- Create: `packages/web/src/components/settings/CompressorSection.tsx`

- [ ] **Step 1: Create the component**

Create `packages/web/src/components/settings/CompressorSection.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useAdminView } from '../../context/AdminViewContext';
import SettingsToggle from './SettingsToggle';

const DEFAULTS = { enabled: false, threshold: -6, ratio: 4.0, attack: 5, release: 50, gain: 3 };

const SLIDERS = [
  { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 1, unit: 'dB' },
  { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.5, unit: ':1' },
  { key: 'attack', label: 'Attack', min: 0, max: 100, step: 1, unit: 'ms' },
  { key: 'release', label: 'Release', min: 10, max: 1000, step: 10, unit: 'ms' },
  { key: 'gain', label: 'Gain', min: 0, max: 24, step: 1, unit: 'dB' },
] as const;

type SliderKey = typeof SLIDERS[number]['key'];

interface CompressorValues {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  gain: number;
}

export default function CompressorSection() {
  const { isAdminView } = useAdminView();
  const [values, setValues] = useState<CompressorValues>(DEFAULTS);
  const [savedValues, setSavedValues] = useState<CompressorValues>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(savedValues);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/compressor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setSavedValues(values);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setValues({ ...DEFAULTS, enabled: values.enabled });
  }

  function updateValue(key: SliderKey, value: number) {
    setValues(v => ({ ...v, [key]: value }));
  }

  const dimmed = !isAdminView;

  return (
    <div className={`space-y-3 ${dimmed ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-[11px] text-muted uppercase tracking-wider">Compressor</h4>
        <SettingsToggle
          label=""
          checked={values.enabled}
          onChange={(enabled) => setValues(v => ({ ...v, enabled }))}
        />
      </div>

      <div className="space-y-2">
        {SLIDERS.map(({ key, label, min, max, step, unit }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted w-20 shrink-0">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(e) => updateValue(key, parseFloat(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="font-mono text-[11px] text-fg w-16 text-right shrink-0">
              {key === 'ratio' ? `${values[key].toFixed(1)}:1` :
               key === 'gain' ? `+${values[key]} ${unit}` :
               `${values[key]} ${unit}`}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`font-body text-sm px-4 py-1.5 rounded transition-colors ${
            hasChanges && !saving
              ? 'bg-accent text-elevated cursor-pointer'
              : 'bg-elevated text-muted cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="font-body text-sm px-4 py-1.5 rounded bg-elevated text-muted hover:text-fg transition-colors cursor-pointer"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd packages/web && bun tsc --noEmit`
Expected: No type errors.

---

## Task 7: Add CompressorSection to ServerTab

**Files:**
- Modify: `packages/web/src/components/settings/ServerTab.tsx`

- [ ] **Step 1: Import and render CompressorSection**

Open `packages/web/src/components/settings/ServerTab.tsx`. Add the import and render it between the Admin Mode toggle and the Tags section heading:

```typescript
import CompressorSection from './CompressorSection';
```

Add `<CompressorSection />` between the `SettingsToggle` block and the closing `</div>`:

```tsx
<SettingsToggle
  label="Admin Mode"
  description="Enable administrative features and controls"
  checked={isAdminView}
  onChange={toggleAdminView}
/>

<CompressorSection />
```

The h3 heading "Server Settings" wraps everything — CompressorSection sits below the toggle in the same `space-y-2` container.

- [ ] **Step 2: Verify build**

Run: `cd packages/web && bun tsc --noEmit`
Expected: No type errors.

---

## Task 8: End-to-End Verification

- [ ] **Step 1: Start the server**

Run: `bun run dev`
Expected: Server starts, migrations run, no errors.

- [ ] **Step 2: Open web UI, go to Settings → Server tab**

Log in as admin, enable Admin Mode toggle.

Expected: Compressor section visible with 5 sliders and two buttons (Save Changes, Reset to Defaults).

- [ ] **Step 3: Toggle compressor on, adjust sliders, click Save Changes**

Adjust threshold to -12, ratio to 8, attack to 10, release to 200, gain to 6. Click Save.

Expected: Button briefly shows "Saving…" then re-enables. Sliders remain at set values.

- [ ] **Step 4: Verify WebSocket broadcast**

Open browser DevTools → Network → WS filter. Play a song via the bot. Observe `player:update` message contains `compressorSettings` with saved values.

Expected: `compressorSettings: { enabled: true, threshold: -12, ratio: 8, attack: 10, release: 200, gain: 6 }` in the payload.

- [ ] **Step 5: Verify NodeLink received filter update**

Check NodeLink logs (docker compose logs nodelink) — should show filter/compressor update call after play starts.

- [ ] **Step 6: Reset to Defaults button**

Click Reset to Defaults. Values should reset to -6, 4.0, 5, 50, 3 in the UI but not yet saved. Click Save to confirm.

- [ ] **Step 7: Non-admin user cannot interact**

Log in as non-admin, go to Server tab. Compressor section should be dimmed and non-interactive.

---

## Task 9: Lint and Check

- [ ] **Step 1: Run Biome check**

Run: `bun run check`
Expected: No errors or warnings. Auto-fix if needed.

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/shared/db/schema.ts packages/server/src/shared/db/index.ts packages/server/src/shared/db/migrations/0051_add_guild_settings.sql packages/server/src/shared/types.ts packages/server/src/routes/compressor.ts packages/server/src/index.ts packages/server/src/lib/socket.ts packages/server/src/startDiscord.ts packages/server/src/GuildPlayer.ts packages/web/src/components/settings/CompressorSection.tsx packages/web/src/components/settings/ServerTab.tsx
git commit -m "feat(server): add compressor admin controls with guild-level settings

- New guildSettings table for persistent compressor configuration
- PATCH /api/settings/compressor endpoint
- NodeLink filter applied on playback start
- WebSocket broadcasts compressorSettings in player:update
- Admin-only CompressorSection in Settings → Server tab with 5 sliders

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```