# Design System — OPS Management Operating System

Visual language for the Supply Chain Control Tower (Phase 5A "OPS" identity).
Register: product. Theme: dark cockpit default, light theme via `data-theme="light"`.

## Theme

Dark mission-control cockpit. Light = information, color = risk or country
identity, depth over boxes. Vivid but classy: saturated accents on deep neutral
surfaces, never decoration for its own sake.

## Color

All neutrals come from the committed `--tower-*` tokens; country accents are
computed in OKLCH from the country name (no hardcoded country list).

### Dark (default)

- Background: `--tower-bg` `#07111d`
- Panel: `--tower-panel` `rgba(13,27,42,.86)` / strong `rgba(16,35,52,.94)`
- Border: `rgba(126,231,255,.16)` / strong `.34`
- Text: `--tower-text` `#e7f7ff`; muted `#8aa5b5` (labels only, never body)
- Semantic: cyan `#48e5ff` (brand/info) · emerald `#36e29b` (good) ·
  amber `#ffbd4a` (watch) · crimson `#ff5d6c` (risk)

### Light

- Background `#eef2f7`, panels `#ffffff`, text `#16313f`, muted `#586b78`
- Semantic: blue `#0a6cc4` · green `#0e9e6e` · amber `#c47b00` · red `#d23b48`

### Country accent system

Set on `:root` by `CountryProvider` (`frontend/src/context/CountryContext.tsx`):

- `--country-accent` `oklch(0.74 0.13 H)` — H derived from country name hash;
  global view uses brand hue 196 (teal)
- `--country-accent-strong`, `--country-accent-soft` (16% alpha),
  `--country-accent-glow` (28% alpha)

Accent is used for: selection, focus rings, the country environment strip, KPI
emphasis, active nav. Never for body text or destructive actions.

## Typography

One family: the app's existing sans stack (system-ui based). Fixed rem scale,
ratio ≈ 1.2: 11px meta · 13px UI body · 14px prose · 16px section · 20px panel
title · 24px workspace title · 1.5rem station name. Numbers always
`font-variant-numeric: tabular-nums`. Letter-spacing: -0.02em on titles,
+0.14em only on tiny uppercase meta labels (sparingly).

## Components

- **Radius cap 16px.** Panels 16, cards 12, controls 10, badges/pills full.
- **One border OR one shadow** per element, never both as decoration.
- Buttons: solid accent = primary; quiet ghost = secondary; crimson = destructive.
  All states: hover, focus-visible (3px `--country-accent-soft` ring), active,
  disabled, loading.
- Data grids: dense rows, sticky header, hover row tint, drill-down chevron;
  filters live in a toolbar above, not inside cells.
- Skeletons for loading (no spinners mid-content); empty states teach the screen.
- Status is always icon + label + tone color (never color alone).
- Z-scale: rail 10 · sticky 20 · modal 50.

## Layout

- App shell: workspace rail (left, collapsible) + top bar (country selector,
  theme toggle, user) + content canvas.
- Canvas pattern per workspace: environment strip → hero/summary → exception
  lanes → drill-down grid/detail.
- Responsive structurally: rail collapses to icons <1100px, bottom tab bar
  <720px; grids become stacked cards on mobile.

## Motion

Tokens in `frontend/src/motion/motion.ts`. Fast 0.18s · base 0.24s · slow 0.4s,
`cubic-bezier(0.22,1,0.36,1)` (ease-out-quint). No bounce, no elastic.

- Workspace transitions: content crossfade + 8px rise; each workspace adds one
  meaning-bearing signature (shipment glide, expiry timeline sweep, approval
  stamp, decision path draw, network pulse for distributors, return loop).
- Country switch: accent bloom + horizon sweep on the environment strip
  (re-mount keyed by country).
- Lists stagger at 0.04s per item. Never gate visibility on animation.
- Every animation has a `prefers-reduced-motion` fallback (crossfade or none).
