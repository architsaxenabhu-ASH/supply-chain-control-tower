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

## Information architecture (Phase 5H)

The navigation mirrors the real subsidiary operating model so a user reads it
immediately after login:

```
Primary Sales  →  Inventory  →  Secondary Sales
 (buy stock in)   (the bridge)    (sell stock out)
```

Two top-level sections in the rail (`app/nav.ts`, `WorkspaceDef.section`):

- **Operations** — three flow workspaces, each with role-shaped sub-tabs:
  - Primary Sales (India → subsidiary): Planning · Operations · Finance · Documents · Tracking
  - Inventory (the bridge): Planning · Operations · Reviews · Expiry · Consignment · Returns · Receipts · Counts · Traceability
  - Secondary Sales (subsidiary → customer): Sales · Finance · Operations · Performance · Customers · Shipments · Commitments
- **Dashboards** — five summaries (`workspaces/dashboards/Dashboards.tsx`):
  Primary Sales, Inventory, Secondary Sales, Business (executive), Finance.
- **Manage** — cross-cutting: My Work, Approvals, Decisions, Access, Setup.

Section labels group the rail. Dashboards roll up operations; they are not
operational screens. The active currency book follows the workspace (secondary
flow → secondary book).

## Live business pulse + dashboard storytelling (Phase 5I)

The sidebar **flow pulse** (`.flow-pulse`) is alive: each stage shows a real
value (inbound count · stock value · open orders) derived from data already
loaded, a dot flows down the connector when stock is actually moving into the
next stage, and each node navigates to its dashboard. It makes the operating
model legible and the business feel in motion the moment you log in.

Each dashboard answers **one management question** (the hero eyebrow), leads
with the **answer** (the hero title), and tells the situation in one
interpreted **story** sentence (`.dash-story`) — not just numbers:

- Primary Sales — *What is coming?*
- Inventory — *What do we have?*
- Secondary Sales — *What have we promised and delivered?*
- Business — *Are we achieving targets?*
- Finance — *What is our exposure?*

Low-data is composed, not blank: `EmptyStory` (`.empty-story`) shows an icon,
a headline, and a sentence that teaches what fills the panel, so the system
feels complete while data volume is still growing.

## Story → Action (Phase 5J)

Every dashboard ends its story with an **action launchpad** (`ActionLaunchpad`,
`.launchpad`): a row of next-step cards, each with a live count where one
exists, that jump straight to the operational screen where the work happens.
The dashboard is a springboard, not just a summary:

- Primary Sales → Open shipments · Chase delays (n) · Record update · Documents
- Inventory → Review risk · Review expiry (n) · Open reviews · Record decision
- Secondary Sales → Open commitments (n) · Review backorders (n) · Record
  fulfillment · Record decision
- Business → Open country review · Open vertical review · Clear approvals (n)
- Finance → Open receivables (n overdue) · Open payables (n) · Record collection plan

The sidebar **flow pulse** is a business heartbeat: each stage shows a live
value plus an operational **state** — **Healthy / Attention / Critical**
(`.flow-pulse-state`) — with a status pip that *beats* when not healthy.
Critical = value or commitment at risk (imports past ETA, stock expired/near
expiry); Attention = needs a human soon (in motion, awaiting approval);
Healthy = flowing cleanly. A dot flows down the connector when stock is
actually moving into the next stage.

## Decision cockpit (Phase 5L)

The Decision Center is the signature feature — a management decision cockpit,
not a transaction screen. It runs the loop **Situation → Options → Decision →
Reason → Outcome**:

- **Situations awaiting a decision** — live risks (expiry, backorders, delays,
  overdue payments, pending approvals) surface from `/executive/actions` as
  situation cards with a severity pip.
- Selecting a situation opens the rail: a **recommended action**, **how we
  handled this before** (similar past decisions + their outcomes via
  `/decisions/similar`), and a **capture form** (Situation → Options →
  Decision → Reason → Expected outcome → `createDecision`).
- **Decision history** timeline; selecting a past open decision lets you
  **record its outcome** and effectiveness, closing the loop so the playbook
  learns. Hero vitals show effectiveness and the most effective play.

## Planning cockpit (Phase 6)

A new top-level **Planning** dashboard (`workspaces/planning/PlanningDashboard.tsx`,
view `dash-planning`, first under Dashboards) answers Past · Present · Future in
one view — by pure calculation, no forecasting or models:

```
Projected inventory = current available + incoming − committed demand
                      (incoming arriving, and demand due, by the chosen horizon)
```

Horizon selector tuned to a distribution subsidiary's decision cycle:
**Today / +15 / +30 / +45 / custom date** (most calls are made within
15–45 days). Sections: present vs projected
vitals (P2); **requirement gap by vertical** with coverage % and
shortage/surplus/covered status (P3); **incoming supply** timeline with ETA and
delay (P4); **customer commitments** timeline with required date and OTIF risk
(P5); and **shortages developing** with a launchpad to act (pull forward supply
/ record a decision). All computed from existing endpoints (inventory, import
candidates, commitments, products) — no duplicate business logic.

## Operations Intelligence Center (Phase 6 sprint, P1)

`workspaces/intelligence/OperationsIntelligence.tsx` (Dashboards → Ops
Intelligence, view `dash-ops-intel`, first/primary management workspace). Not
an exception list — it shows three lanes:
- **Attention required** — executive-action risks (shipment delay, inventory,
  commitment, payment), approval bottlenecks, OCR validation pending, master-
  data candidates. Each item routes to where it can be worked.
- **Performing well** — countries & distributors at/above target, OTIF
  achievement, inventory health. What is right, not only what is wrong.
- **Recently resolved** — read from the audit trail: payments recorded, stock
  received, orders progressed, approvals completed, decisions closed.
Composed entirely from existing engines (executive actions, performance
scorecards, commitment/inventory dashboards, approvals, validation queue, audit
trail) — no new business logic. Situation Rooms (P2) will launch from these
items with the full story + past decisions + outcomes.

## Shipment-first Documents workspace (Phase 6F)

The document workflow redesigned around **shipments, not OCR**. New "Documents"
workspace (Operations section, warehouse/ops users) — `workspaces/shipdocs/`:

- **Primary · Upload** (`doc-primary-upload`, `PrimaryUpload.tsx`) — a 4-step,
  shipment-first wizard that hides all OCR/template/confidence detail: Step 1
  select or create a shipment (header: type subsidiary/direct, country,
  vertical, number → `COUNTRY-VERTICAL-NUMBER`, origin, destination, ETA);
  Step 2 upload its documents (CI / PL / AWB / Import); Step 3 review the
  **business data only** read from them; Step 4 **save to the validation
  queue**. Saving creates nothing official — the shipment is Pending Validation,
  no inventory/metric/secondary-sales moves. Reuses `uploadDocument` +
  `assembleImportFromDocuments`.
- **Primary · Validate** (`doc-primary-validate`, `PrimaryValidate.tsx`) — a
  shipment-first split screen: documents (left) vs extracted data (right),
  **document completeness** (required vs present, validation blocked until
  mandatory docs present), Approve / Request correction / Reject, and a
  validation-only **supporting-document upload** (photos, emails, certificates).
  Approve → official shipment (via `approveImportCandidate`); inventory still
  waits for goods receipt.

- **Secondary · Upload / Validate** (`doc-secondary-upload` /
  `doc-secondary-validate`, `SecondaryUpload.tsx` / `SecondaryValidate.tsx`) —
  the outbound mirror (subsidiary → customer), same shipment-first logic.
  Header: customer, country, order no., type (standard/consignment/direct).
  Doc kinds: Customer PO / Invoice / Packing List / POD / Other. Saving creates
  a **secondary shipment bundle** (backend `/secondary-documents/shipments`,
  `secondary_documents_repository.py`) in Pending Validation — nothing reaches
  sales, receivables, commitments, or analytics until validated. Validate
  mirrors Primary (completeness requires Customer PO + Invoice; Approve →
  official secondary shipment; Reject; supporting-doc upload). Audited under
  module "secondary_documents".

The principle: documents belong to shipments — Shipment Management with
documents attached, not Document Management with shipments attached.

**Validation insights (Phase 6F enhancements)** — shared `ShipmentInsights.tsx`
used by both Primary and Secondary Validate:

- **Shipment timeline** — a stage strip (Created → Documents uploaded →
  Validated → Dispatched → In transit → Arrived → Received → Completed) with the
  current stage derived from the shipment's status, so a validator always sees
  where a shipment sits in its life. Rejected shipments are flagged distinctly.
- **Conversation log** — every action on the shipment (uploads, validations,
  corrections, approvals, rejections) read from the tamper-evident audit trail,
  filtered to that shipment's id, newest first, with who and when.
- **Country-specific document checklist** (Primary) — `evaluateImportChecklist`
  decides extra required documents from country + vertical + material; missing
  mandatory documents **block validation** for known combinations, while unknown
  combinations stay informational ("learning") so the user is never hard-locked.
  Attached supporting documents feed back into the present-document set.

Staged next: true supporting-document association (first-class child records
rather than session-only), a secondary-side checklist, and wiring validated
secondary shipments into the live sales/receivables data.

## Reference lookups & always-on movement map (Phase 6H)

Two cross-cutting fixes so the UI conveys state visually and selectors are never
empty — both backed by data the system has *learned*, nothing hardcoded.

- **Known countries** (`/reference/countries`, `services/reference_repository.py`)
  unions every country seen in live data (warehouses, customers, shipments,
  imports, secondary shipments, country document rules, master data, user
  scopes), minus sentinels like "All". The top-bar country selector
  (`CountrySelector`) now fills from this: scoped users see their countries,
  global/Admin users see all — so it is never just "Global view".
- **Movement by country** (`/reference/movement-by-country`) counts shipments
  touching each country (outbound + inbound + secondary). Empty = zero.
- **Maps are always visible, with a zero state.** `components/WorldMap.tsx` is no
  longer hidden behind empty-state text. The Command Center and Operations
  Intelligence dashboards gained a movement map; the Primary dashboard, Primary
  Sales, and Inventory maps now render the world even at zero, with a caption
  that says the map "shows zero" until movement appears. The map lights and sizes
  countries by magnitude and never hardcodes the country list (atlas geometry is
  matched to learned country names).

## Movement visual + simpler document console (Phase 6I)

Driven by the user's direction (see memory `app-simplicity-for-non-scm-users`):
convey operations *visually*, and make every screen usable by someone with no
supply-chain background.

- **MovementPanel** (`components/MovementPanel.tsx`, computed by `lib/movement.ts`)
  — four live metrics per country (active **shipments**, **units**, **weight**,
  **value**), each split **Primary (inbound) vs Secondary (outbound)**. A metric
  toggle recolours the map; a **time-range setting** (In motion now / This month
  / Last 3 / Last 6 / This year / All time) switches between what's moving now
  and what moved in a period. Value uses the currency engine; everything
  recomputes from live records (import candidates + shipments + inventory
  batches) — nothing hardcoded. A country detail table gives the "tracking in
  detail" view. Shown on the Command Center, Operations Intelligence, and the
  Goods Tracking tab.
- **Drag-and-drop upload** — `components/DropZone.tsx` wraps a hidden file input
  so each document slot accepts a click *or* a dropped file. Used in Primary and
  Secondary upload wizards.
- **Simplified validation** — Primary/Secondary Validate now lead with a plain
  "what to do" line, a one-line readiness verdict ("Looks complete — ready to
  approve" / "Not ready — add the Packing List"), and just **two** actions:
  **Approve** and **Send back for fixing** (one optional note replaces the old
  Reject + Request-correction pair). All technical detail (timeline,
  completeness, country checklist, documents, extracted data) moves behind a
  single "See the documents and data" toggle (progressive disclosure).

## Interactive operational map (Phase 6J)

`components/WorldMap.tsx` upgraded from a static choropleth to a drill-down
**World → Country → City** map, so management can read operations off the map
without opening screens.

- **Click a country → smooth zoom** (a CSS transform on the country layer, so
  geometry never re-projects and the motion stays fluid). The selected country
  gets an accent **glow**; the rest of the world **dims but stays visible** for
  context. `fitToRegion` now uses the same transform to auto-frame lit countries.
- **Breadcrumb / back controls** — `World ▸ Country ▸ City`, each segment a
  button, so context is never lost.
- **City nodes** — pulsing, activity-sized nodes, **only rendered after a
  country is zoomed into** (the performance requirement), positioned by a
  geographic city-coordinate reference (`lib/cityGeo.ts`, atlas-style reference,
  not business data). Placed in a screen-space overlay so they stay crisp at any
  zoom and fade in as the zoom settles.
- **Enhanced tooltip** — Country / City, Value, Volume, Movement, Status; stays
  while hovering; no native browser tooltip (aria-label only). Selecting a city
  pins a persistent read-out.
- **Real city data today:** the **Inventory** map feeds warehouse cities
  (`InventoryHub` → warehouse name → city via `cityFromLabel`, country from the
  warehouse master, value/volume per node). Zoom into India → Mumbai + Delhi
  nodes sized by inventory value. Country-level zoom works on every map
  (Movement, Primary, Secondary) for free.

Data still to capture before the remaining layers light up: a **city field on
shipments / imports / customers** (currently only `destination_country`), needed
for Primary transit routes + ETA animation, Secondary customer-city pins, and
city-level shipment counts. The framework is ready; it lights up as that data is
captured.

## Document Intelligence Center (Phase 6 sprint, P3)

`workspaces/documents/DocumentIntelligence.tsx` (Manage → Document
Intelligence, view `doc-intelligence`). The document → transaction pipeline as a
first-class surface: **Upload → Detect Country → Document Type → Template →
Translation Memory → Extract → Human Validation → Transaction**, drawn as a
stage strip with the **human-validation gate highlighted**. OCR autofills every
field (country, type, line items, values) but **never creates a transaction** —
a person with the right permission must validate at the gate before anything
posts. Per-document inspection shows detected country (from master candidates),
document type, the applied template (Country · Document Type), and the
autofilled fields with confidence; "Validate & post" links to the existing
human-validation screen. Reuses the existing extraction + validation engines.

Translation Memory (net-new, backend `/translation/memory`,
`services/translation_repository.py`): translate once, store forever, reuse
automatically; every save audited under module "translation" (App-Manager
governed). A reuse counter compounds value as phrases recur.

## Situation Rooms (Phase 6 sprint, P2)

`workspaces/intelligence/SituationRoom.tsx` — management investigation
workspaces, launched **in place** from Operations Intelligence items (so no
routing/RBAC seams). The flow is: Operations Intelligence detects → Situation
Room investigates → Decision Center decides → outcome tracked. Both negative
situations (delay, shortage, expiry, commitment/receivable/payment/consignment
risk) and positive ones (target/distributor achievement, recovery, OTIF
improvement) get a room — the system celebrates wins and investigates problems.

Sections: (1) summary with severity, country/vertical/product, value/volume/
movement impact; (2) impact analysis (affected countries, customers,
distributors, inventory, orders, shipments, receivables, payables, categories,
products); (3) timeline — projected position at Today/+15/+30/+45 scoped to the
situation; (4) historical context via decision similarity + learning success
rate; (5) recommended actions by type (advisory only); (6) a direct line into
the Decision cockpit; (7) product intelligence Country+Vertical → Category →
Product with value/volume/movement (verticals never benchmarked against each
other); (8/9/10) governance strip — portfolio scope, escalation, last review
(escalation chains and review governance are honest placeholders pointing to
their dedicated upcoming features). Reuses decision/learning/planning engines —
no duplicate logic.

## Historical Time Machine — Business Snapshot (Phase 6, P1)

`workspaces/planning/BusinessSnapshot.tsx` (Planning workspace → Time Machine
tab, view `dash-snapshot`). Pick any past date and see the whole business as it
stood that day, reconstructed from the transaction record — not just inventory:
- **Inventory** (units + value) = goods receipts posted by the date − dispatches
  out by the date (value uses each line's receipt unit value).
- **Receivables / payables outstanding** = invoiced by the date − payments
  collected/made by the date (exact from invoice + payment dates).
- **Open customer orders** that day (best-effort from required-delivery dates).
Money converts at the rate locked for the snapshot date (ties into the
date-locked rate books), so a past day reads in period-accurate value. Date
shortcuts: Today / Month start / Year start.

Deferred to later Phase 6 passes (per the user's re-sequencing): P2 Situation
Rooms, Document Intelligence Center, Advanced RBAC matrix, Master Data
Governance, Data Quality Center, the Operations Intelligence Center reframe of
exceptions (Attention / Performing Well / Recently Resolved), and the
heartbeat's average-lead-time recalibration.

## RBAC (Phase 5L)

Navigation is permission-gated end to end: `visibleSections` →
`visibleWorkspaces` → `visibleTabs` → `canAccessView` means the rail only
shows screens a user may open; Admin (`role_name === "Admin"`) bypasses and
sees everything. A guard redirects any disallowed `activeView` to
`firstAccessibleView(user)`. Edit actions inside screens are gated separately
with `hasPermission(user, "<permission>")`, so view-only and edit rights are
distinct and managed per user in Access → Users & Roles.

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

## Currency environment (Phase 5D/5E/5G)

Stored amounts keep their own invoice currency; conversion happens at display
time. `lib/currency.ts` + `context/CurrencyContext.tsx`: the top-bar selector
offers Local (selected country's currency), EUR, USD, INR and every code with
a locked rate. `formatMoney` renders money (compact for big figures);
`formatUnits` renders counts (international grouping, never lakh/crore).

Two rate books (Phase 5G), because the business runs two flows with their own
rates: **primary** (Meril India → subsidiary; also the default for valuing
inventory) and **secondary** (subsidiary → customer). The active book follows
the workspace (`SECONDARY_VIEWS` → secondary, else primary). Conversion is
date-specific: each amount converts at the rate locked for its own transaction
date — a batch's registration (goods-receipt) date, an invoice's date — not
today's rate. Inventory additionally offers a "today's rate" revaluation
toggle. Rates lock per book + date to the ECB end-of-day reference (published
~16:00 CET) via `/currency/rates?book=`; historical dates requested by a view
are locked lazily. Manual overrides are per book, require a reason, and land
in the audit trail (module "currency").

Reactivity: the engine is an external store (`subscribeCurrency` /
`getCurrencyRevision`); App subscribes via `useSyncExternalStore` so every
figure across the app re-renders together whenever the currency, book, date,
or rates change. Views that convert inside `useMemo` include the revision in
their deps so aggregates recompute when a historical rate table arrives.

## Living tab icons (Phase 5D)

Every workspace tab and rail item carries `data-signature`; while active or
hovered, its icon animates in that signature's meaning (glide travels, rise
settles, sweep tilts, loop turns back, stamp presses, network breathes, flow
drifts, path descends, fade breathes). 1-3px amplitudes, 2.4-3.4s cycles,
disabled under `prefers-reduced-motion`.

## Tab-entry stinger (Phase 5F)

Switching tabs plays a signature-themed overlay (`.view-stinger` in App.tsx):
a glass panel with the tab's icon and name wipes across the canvas in the
signature's direction (glide arrives from the right, rise from below, stamp
presses in, network blooms radially…); the icon + title slide in from the
same direction. The overlay holds while the incoming view still reports
`aria-busy` (data loading), showing a sweeping accent progress line and a
drifting light sheen, then clears the moment the tab is ready. Minimum hold
450ms so the entry reads; hard cap 4s so it can never trap the screen.
Pointer-transparent; skipped entirely under reduced motion.
