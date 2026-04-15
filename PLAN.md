# Settings Page Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the settings modal into a dedicated `/settings` page with three tabs: Appearance, Server, and Tags.

**Architecture:** Settings page is a full React Router route with tab-based navigation. SettingsMenu in the sidebar becomes a simple link. Existing SettingsContent moves into the Appearance tab. Server and Tags tabs are scaffolded for future expansion.

**Tech Stack:** React Router, React 19, Tailwind CSS 4, Phosphor Icons

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/web/src/components/SettingsMenu.tsx` | Modify | Sidebar button → navigate to `/settings` |
| `packages/web/src/components/SettingsContent.tsx` | Rename | Becomes `AppearanceTab.tsx` |
| `packages/web/src/components/settings/AppearanceTab.tsx` | Create | Theme + mode settings (moved content) |
| `packages/web/src/components/settings/SettingsTabs.tsx` | Create | Tab navigation component |
| `packages/web/src/components/settings/SettingsPage.tsx` | Create | Page shell with tabs |
| `packages/web/src/components/settings/ServerTab.tsx` | Create | Placeholder server settings |
| `packages/web/src/components/settings/TagsTab.tsx` | Create | Placeholder tags management |
| `packages/web/src/App.tsx` | Modify | Add `/settings` route |

---

## Tasks

### Task 1: Rename SettingsContent to AppearanceTab

**Files:**
- Create: `packages/web/src/components/settings/AppearanceTab.tsx`
- Delete: `packages/web/src/components/SettingsContent.tsx`

- [ ] **Step 1:** Create `packages/web/src/components/settings/` directory

```bash
mkdir -p packages/web/src/components/settings
```

- [ ] **Step 2:** Create `AppearanceTab.tsx` with content from `SettingsContent.tsx` (copy unchanged)

```tsx
import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useAdminView } from '../../context/AdminViewContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import SettingsToggle from './settings/SettingsToggle';
import { Button } from './ui/Button';

export default function AppearanceTab() {
  const { user } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();
  const { colorTheme, mode, setColorTheme, setMode, colorThemes } = useTheme();

  return (
    <div className="space-y-6">
      {/* Admin Mode Toggle */}
      {user?.isAdmin && (
        <div className="space-y-2">
          <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Admin</h3>
          <SettingsToggle
            label="Admin Mode"
            description="Enable administrative features and controls"
            checked={isAdminView}
            onChange={toggleAdminView}
          />
        </div>
      )}

      {/* Color Theme Selector */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Color Theme</h3>
        <div className="grid grid-cols-2 gap-2">
          {colorThemes.map((t) => (
            <Button
              key={t.name}
              variant="inherit"
              surface="base"
              className={`flex items-center gap-2 ${colorTheme === t.name ? 'pressed' : ''}`}
              onClick={() => setColorTheme(t.name)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: t.accentColor }}
              />
              <span className="truncate">{t.displayName}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Appearance</h3>
        <div className="flex gap-2">
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'auto' ? 'pressed' : ''}`}
            onClick={() => setMode('auto')}
          >
            <DesktopIcon size={16} weight="duotone" />
            <span>Auto</span>
          </Button>
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'light' ? 'pressed' : ''}`}
            onClick={() => setMode('light')}
          >
            <SunIcon size={16} weight="duotone" />
            <span>Light</span>
          </Button>
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'dark' ? 'pressed' : ''}`}
            onClick={() => setMode('dark')}
          >
            <MoonIcon size={16} weight="duotone" />
            <span>Dark</span>
          </Button>
        </div>
        <p className="text-xs text-faint">
          {colorThemes.find((t) => t.name === colorTheme)?.description}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** Verify `SettingsToggle` import path is correct (it should be `../settings/SettingsToggle` relative to new location)

- [ ] **Step 4:** Delete `packages/web/src/components/SettingsContent.tsx`

```bash
rm packages/web/src/components/SettingsContent.tsx
```

---

### Task 2: Create SettingsTabs component

**Files:**
- Create: `packages/web/src/components/settings/SettingsTabs.tsx`

- [ ] **Step 1:** Create `SettingsTabs.tsx`

```tsx
import { Tab } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import styles from './SettingsTabs.module.css';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'light' | 'regular' | 'bold' }>;
  adminOnly?: boolean;
}

const TABS: TabItem[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'server', label: 'Server', adminOnly: true },
  { id: 'tags', label: 'Tags', adminOnly: true },
];

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const { user } = useAuth();

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || user?.isAdmin);

  return (
    <div className={styles.tabList} role="tablist">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {Icon && <Icon size={16} weight="duotone" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** Create `SettingsTabs.module.css` in same directory

```css
.tabList {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--color-fg);
}

.tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
```

---

### Task 3: Create SettingsPage

**Files:**
- Create: `packages/web/src/components/settings/SettingsPage.tsx`

- [ ] **Step 1:** Create `SettingsPage.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import AppearanceTab from './AppearanceTab';
import ServerTab from './ServerTab';
import SettingsTabs from './SettingsTabs';
import TagsTab from './TagsTab';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appearance');

  const renderTab = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceTab />;
      case 'server':
        return <ServerTab />;
      case 'tags':
        return <TagsTab />;
      default:
        return <AppearanceTab />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="font-display text-3xl text-fg tracking-wide">Settings</h1>
        <Button
          variant="inherit"
          size="icon"
          surface="base"
          onClick={() => navigate(-1)}
          aria-label="Close settings"
        >
          <XIcon size={20} weight="duotone" />
        </Button>
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {renderTab()}
      </div>
    </div>
  );
}
```

---

### Task 4: Create ServerTab and TagsTab placeholders

**Files:**
- Create: `packages/web/src/components/settings/ServerTab.tsx`
- Create: `packages/web/src/components/settings/TagsTab.tsx`

- [ ] **Step 1:** Create `ServerTab.tsx`

```tsx
export default function ServerTab() {
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Server Settings</h3>
      <p className="text-sm text-muted">Coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 2:** Create `TagsTab.tsx`

```tsx
export default function TagsTab() {
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Tags</h3>
      <p className="text-sm text-muted">Coming soon.</p>
    </div>
  );
}
```

---

### Task 5: Update SettingsMenu

**Files:**
- Modify: `packages/web/src/components/SettingsMenu.tsx`

- [ ] **Step 1:** Update `SettingsMenu.tsx` to navigate instead of opening modal

```tsx
import { WrenchIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

interface SettingsMenuProps {
  collapsed?: boolean;
}

export default function SettingsMenu({ collapsed = false }: SettingsMenuProps) {
  const navigate = useNavigate();

  return (
    <div className={collapsed ? 'flex justify-center px-2 pb-2' : 'px-3 pb-2'}>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        title={collapsed ? 'Settings' : undefined}
        className={`flex items-center rounded-xl font-body transition-all duration-150 cursor-pointer w-full ${
          collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
        } btn-inherit`}
        style={{ '--btn-surface': 'var(--color-elevated)' } as React.CSSProperties}
      >
        {!collapsed && <span className="mr-auto">Settings</span>}
        <WrenchIcon size={18} weight="duotone" />
      </button>
    </div>
  );
}
```

**Changes from current:**
- Removed `useState` for `isOpen`
- Removed `Backdrop` import
- Removed `SettingsContent` import
- Removed modal JSX
- Added `useNavigate`
- Click handler → `navigate('/settings')`

---

### Task 6: Add settings route to App.tsx

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1:** Import `SettingsPage`

```tsx
import SettingsPage from './components/settings/SettingsPage';
```

- [ ] **Step 2:** Add route inside the ProtectedRoute group

```tsx
<Route path="settings" element={<SettingsPage />} />
```

Add it after the `playlists/:id` route:

```tsx
<Route path="playlists/:id" element={<PlaylistDetailPage />} />
<Route path="settings" element={<SettingsPage />} />
```

---

### Task 7: Verify and test

- [ ] **Step 1:** Run `bun run web:build` to check for type errors
- [ ] **Step 2:** Run `bun run check` to verify linting passes
- [ ] **Step 3:** Verify in browser:
  - Clicking sidebar "Settings" navigates to `/settings`
  - All three tabs render (Appearance visible to all, Server and Tags visible only to admin)
  - Appearance tab shows theme grid and mode selector
  - Server and Tags tabs show placeholder text
  - Browser back button returns to previous page
