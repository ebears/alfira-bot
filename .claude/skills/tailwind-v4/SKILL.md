---
name: tailwind-v4
description: Tailwind CSS v4 reference — use when working with Tailwind classes, CSS-first config, @theme directive, OKLCH colors, v3→v4 migration, or custom utilities
---

# TailwindCSS v4 Expert Skill

## Overview

Tailwind CSS v4 shifts from JavaScript configuration to **CSS-first configuration**. Design tokens are defined via `@theme` in CSS, and utilities are applied via `@import "tailwindcss"`.

**Browser Requirements:** Safari 16.4+, Chrome 111+, Firefox 128+ (uses `@property` and `color-mix()`)

---

## Installation

### Vite (Recommended)
```bash
npm install tailwindcss @tailwindcss/vite
```
```js
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"
export default defineConfig({
  plugins: [tailwindcss()],
})
```

### PostCSS
```js
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

### CLI
```bash
npx @tailwindcss/cli -i input.css -o output.css
```

### CSS Entry
```css
@import "tailwindcss";
```

---

## CSS-First Configuration

### @theme Directive

Theme variables generate utility classes:

| Namespace | Utility Classes |
|-----------|----------------|
| `--color-*` | `bg-red-500`, `text-sky-300`, `border-indigo-600` |
| `--font-*` | `font-sans`, `font-serif` |
| `--text-*` | `text-xl`, `text-base` |
| `--spacing-*` | `px-4`, `gap-3` |
| `--radius-*` | `rounded-sm`, `rounded-xl` |
| `--shadow-*` | `shadow-sm`, `shadow-lg` |
| `--animate-*` | `animate-spin`, `animate-pulse` |

### @layer vs @utility

| v3 | v4 |
|----|----|
| `@layer utilities` | `@utility` |
| `@layer components` | `@layer components` |

```css
/* v3 */
@layer utilities { .tab-4 { tab-size: 4; } }

/* v4 */
@utility tab-4 {
  tab-size: 4;
}
```

### @custom-variant

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

### @variant (inline CSS)

```css
.my-element {
  background: white;
  @variant dark { background: black; }
}
```

---

## Colors (OKLCH)

v4 uses **OKLCH** for perceptually uniform colors. 24 families × 11 shades (50-950):

`red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, slate, gray, zinc, neutral, stone`

### Opacity Modifiers

```html
<div class="bg-sky-500/40"></div>           <!-- slash notation -->
<div class="bg-pink-500/[71.37%]"></div>     <!-- arbitrary opacity -->
<div class="bg-cyan-400/(--my-alpha)"></div><!-- CSS variable -->
```

### Arbitrary Values

```html
<div class="bg-[#192a56]">                  <!-- hex -->
<div class="bg-(--brand-color)">            <!-- CSS var (v4 syntax) -->
```

### Custom Colors

```css
@theme {
  --color-midnight: #121063;
  --color-brand: oklch(60% 0.2 240);
}
```

---

## Typography

```css
--font-sans: ui-sans-serif, system-ui, sans-serif;
--font-serif: ui-serif, Georgia, Cambria, "Times New Roman";
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco;
--text-xs: 0.75rem;      /* through --text-9xl */
--font-weight-thin: 100; /* through --font-weight-black */
```

---

## Shadows (v4 Renames)

| v3 | v4 |
|----|----|
| `shadow` | `shadow-sm` |
| `shadow-sm` | `shadow-xs` |

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

---

## Border Radius (v4 Renames)

| v3 | v4 |
|----|----|
| `rounded` | `rounded-sm` |
| `rounded-sm` | `rounded-xs` |

```css
--radius-xs: 0.125rem;
--radius-sm: 0.25rem;
--radius-md: 0.375rem;
--radius-lg: 0.5rem;
--radius-xl: 0.75rem;
--radius-2xl: 1rem;
--radius-full: 9999px;
```

---

## Responsive Design

### Breakpoints (min-width)

| Prefix | Width |
|--------|-------|
| `sm` | 40rem (640px) |
| `md` | 48rem (768px) |
| `lg` | 64rem (1024px) |
| `xl` | 80rem (1280px) |
| `2xl` | 96rem (1536px) |

### Mobile-First

Unprefixed utilities apply to all sizes. Use `md:` to add at breakpoint, not to target mobile.

### Max-* Variants

```html
<div class="max-sm:hidden">  <!-- screens < 40rem -->
```

### Container Queries (v4.2+)

```html
<div class="@container">
  <div class="flex-col @md:flex-row">
```

Named containers: `@container/main`, `@sm/main:flex-col`

---

## Dark Mode

### Class-Based (Recommended)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```html
<html class="dark">
```

### Three-Way Toggle

```js
document.documentElement.classList.toggle("dark",
  localStorage.theme === "dark" ||
    (!("theme" in localStorage) && matchMedia("(prefers-color-scheme: dark)").matches)
);
```

---

## State Variants

### Built-in Variants

`hover:`, `focus:`, `active:`, `group-hover:`, `disabled:`, `required:`, `invalid:`, `placeholder:`, `file:`, `marker:`, `selection:`, `peer-hover:`, `peer-focus:`, etc.

### Group Variants

```html
<div class="group">
  <img class="group-hover:brightness-110" />
  <div class="opacity-0 group-hover:opacity-100">Overlay</div>
</div>
```

### Peer Variants

```html
<div class="peer">
  <input type="checkbox" class="peer-checked:bg-green-500" />
</div>
```

### Important Modifier

```html
<!-- v3 -->
<div class="!flex">

<!-- v4 -->
<div class="flex!">
```

---

## Animations

### Default Animations

```html
<div class="animate-spin animate-pulse animate-bounce animate-ping">
```

| Utility | Purpose |
|---------|---------|
| `animate-spin` | 360° rotation |
| `animate-pulse` | Opacity pulse |
| `animate-bounce` | Vertical bounce |
| `animate-ping` | Scale + opacity ping |
| `animate-none` | Disable animations |

### Custom Keyframes

```css
@theme {
  --animate-slide-in: slide-in 0.3s ease-out;
  --animate-fade-in: fade-in 0.2s ease-in;

  @keyframes slide-in {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
}
```

---

## Ring Utilities

### Default Ring Width Changed

```html
<!-- v3: ring = 3px -->
<button class="ring ring-blue-500">

<!-- v4: no default -->
<button class="ring-3 ring-blue-500">
```

### Restoring v3 Default

```css
@theme {
  --default-ring-width: 3px;
}
```

---

## Custom Utilities (Functional)

```css
@theme {
  --tab-size-github: 8;
}

@utility tab-* {
  tab-size: --value(integer);        /* tab-2, tab-4 */
  tab-size: --value(--tab-size-*);   /* tab-github */
}
```

---

## Preflight Changes

- **Default border color:** v3 `gray-200` → v4 `currentColor`
- **Placeholder color:** `currentColor` at 50% opacity
- **Button cursor:** `cursor: default` (was `cursor: pointer`)

### Restoring v3 Defaults

```css
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--color-gray-200, currentColor);
  }
  input::placeholder, textarea::placeholder {
    color: var(--color-gray-400);
  }
  button:not(:disabled), [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
```

---

## v4 Breaking Changes

| Change | v3 | v4 |
|--------|----|----|
| Import | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Config | `tailwind.config.js` | `@theme` in CSS |
| Colors | RGB/HSL | OKLCH |
| `shadow` | Default | `shadow-sm` |
| `rounded` | Default | `rounded-sm` |
| `ring` | 3px default | `ring-3` |
| `!` modifier | Before variant | After variant |
| Arbitrary CSS var | `bg-[--var]` | `bg-(--var)` |
| Transform reset | `transform-none` | `scale-none` |
| `space-y` | `~ :not([hidden])` | `:not(:last-child)` |

### Common Mistakes

1. Using v3 `tailwind.config.js` — v4 uses `@theme` in CSS
2. `!hover:` instead of `hover!` — important modifier comes AFTER variant
3. `bg-[--var]` instead of `bg-(--var)` — CSS vars use `--()` syntax
4. `transform-none` instead of `scale-none` — transform resets are specific
5. Missing `@custom-variant dark` — must define for class-based dark mode

---

## Links

- [Installation](https://tailwindcss.com/docs/installation)
- [Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Theme Configuration](https://tailwindcss.com/docs/theme)
- [Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Container Queries](https://tailwindcss.com/docs/responsive-design#container-queries)
- [Custom Variants](https://tailwindcss.com/docs/adding-custom-styles#using-css-variants)
- [Custom Utilities](https://tailwindcss.com/docs/adding-custom-styles#utility-functions)
