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

## Reference patterns (Phase 5B)

Adopted from the user's SCM reference set (VeloHub-style control tower, dark
navy glass explorer, GreenStory/HexaSupply dashboards, fleet tracking). CSS in
`styles.phase5a.css` under "Phase 5B". All read `--tower-*`/`--country-accent*`
so they work in both themes.

- **Delta chip** `.delta-chip.delta-up|down|flat` — "+2.1% from last hour"
  pill next to a big figure. Green up, crimson down, muted flat.
- **Stacked segment bar** `.seg-bar` + `.seg-legend` — one horizontal bar
  showing a status distribution (good/warn/bad/info/neutral segments), dot
  legend with counts underneath. Use for queue mix, expiry buckets, variance.
- **Score bar** `.score-row` — labeled progress with value on the right and
  a glowing tonal fill. Use for capacity, health, utilisation.
- **Numbered rows** `.num-rows > .num-row` — index chip, primary line,
  muted route line (`origin → destination`), status dot-pill on the right.
  Use for realtime shipments, queues, top-N lists.
- **Status dot-pill** `.dot-pill.tone-*` — coloured dot + label in a tinted
  pill; replaces bare text status where a grid cell is too heavy.
- **Dense grids** — every `.panel table` gets tabular figures and an
  accent-tinted row hover. Zero-row tables must render a `.empty-state`
  paragraph instead of a bare header row.
- **Hero vitals** — big `clamp()` figures (`.vitals-row .vital`) with tone
  colours, optionally paired with a delta chip, inside `.cockpit-hero`.
- **World map** (`components/WorldMap.tsx`) — choropleth lit by
  `--country-accent` intensity with pulsing centroid dots; clicking a lit
  country focuses the page's country filter. Country shapes are geography
  reference data; matching against learned business countries is dynamic.
- **Contribution donut** (`components/DonutChart.tsx`) — pure-SVG donut with
  centre total and dot legend; top-N slices, remainder grouped as "Other".
- **Filter bar** (`components/FilterBar.tsx`) — date range + data-derived
  selects + product search in one strip; options never hardcoded.

## Currency environment (Phase 5D)

Amounts are stored in the base currency (INR) and converted at display time.
`lib/currency.ts` + `context/CurrencyContext.tsx`: top-bar selector offers
Local (selected country's currency), EUR, USD, INR and every code with a
locked rate. Rates lock per date to the ECB end-of-day reference rate
(published ~16:00 CET) fetched once and stored via `/currency/rates`; manual
overrides require a reason and land in the audit trail (module "currency").
All money rendering goes through `formatMoney` (compact for big figures);
unit counts through `formatUnits` (international grouping, never lakh/crore).

## Living tab icons (Phase 5D)

Every workspace tab and rail item carries `data-signature`; while active or
hovered, its icon animates in that signature's meaning (glide travels, rise
settles, sweep tilts, loop turns back, stamp presses, network breathes, flow
drifts, path descends, fade breathes). 1-3px amplitudes, 2.4-3.4s cycles,
disabled under `prefers-reduced-motion`.
