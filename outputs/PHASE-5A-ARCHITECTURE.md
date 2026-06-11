# Phase 5A — Management Operating System: Architecture & Design Blueprint

Status: foundation shipped this sprint; workspaces staged against this blueprint.
Principle carried from the backend: **the system detects, contextualises,
recommends, and captures — management decides.** The UI is an *executive cockpit*,
not an ERP. Built on the existing Meril `--tower-*` identity (brand blue/teal),
React + TypeScript + Vite, lucide icons, and a new Framer-Motion motion layer.

---

## 1. Screen Inventory

Grouped by workspace. Every screen binds to real backend endpoints (no mocks).

### Command (landing)
| Screen | Purpose | Primary APIs |
|---|---|---|
| Executive Command Center | Role-aware cockpit: sales performance, attention-required, my actions/approvals/decisions, recent reviews | `/executive-command-center-v3`, `/country-performance-v2`, `/executive-actions`, `/approvals`, `/decisions`, `/*-review` |

### Work Queues (users work from queues, not notifications)
| Screen | APIs |
|---|---|
| My Actions | `/executive-actions` (filtered by owner/permission) |
| My Reviews | the seven `/*-review` endpoints |
| My Approvals | `/approvals?outcome=pending` |
| My Decisions | `/decisions?status=open` |

### Review Center (Summary → Exceptions → Transactions → Decision)
Inventory · Expiry · Open Orders · Receivables · Distributor · Country · Vertical
→ each `/{name}-review` returns summary + drillable source transactions.

### Operations Workspace
Inventory (`/inventory-commitment`, `/inventory-efficiency`), Shipments
(`/shipment-intelligence`, `/imports/timeline`), Consignment
(`/consignment-*`), Returns (`/returns`, `/return-*`), Commitments
(`/customer-commitment-*`). Modern grids, batch + document drill-down,
planned-vs-actual shipment timeline.

### Commercial Workspace (Country → Vertical → Distributor → Customer)
`/country-performance-v2` → `/vertical-performance` → `/distributor-performance-v2`
→ `/customer-performance`; target-vs-actual + diagnostics; interactive drill-down.

### Decision Center (signature)
Timeline of decisions; each shows Problem · Context · Options · Decision · Reason ·
Expected vs Actual Outcome · Effectiveness, with `/decision-similarity`,
`/decision-effectiveness`, `/learning-insights`.

### Approval Center
Pending / Approved / Rejected — `/approvals`; authority gated by *permissions*.

### Access Management Center (RBAC)
Users, role templates, permission matrix, country + vertical scope, approval
authority — `/security/*`. Roles are templates; permissions drive access.

### Financial Workspace
Receivables (`/receivables`, `/financial-intelligence`, `/payment-risk`),
Payables (`/payables`, `/partner-financial-intelligence`, `/payables-risk`),
Credit Control (`/credit-control`), Partner intelligence
(`/logistics|customs|warehouse-partner-intelligence`).

---

## 2. Navigation Map

```
Top bar:  [Brand]  [Global Country Selector]  [Theme]  [Command palette ⌘K]  [User]
Rail (role-aware, grouped — collapses to icons < 1024px, drawer < 768px):

  COCKPIT
    • Command Center            (everyone)
  MY WORK
    • My Actions · My Reviews · My Approvals · My Decisions
  REVIEW
    • Review Center             (review permissions)
  OPERATIONS
    • Inventory · Shipments · Consignment · Returns · Commitments
  COMMERCIAL
    • Country · Vertical · Distributor · Customer performance
  DECISIONS
    • Decision Center
  FINANCE
    • Receivables · Payables · Credit · Partners
  ADMIN
    • Access Management · Audit · Learning
```
Nav items render only when `canAccessView(user, id)` passes. Country selector is
global state; switching it re-scopes every country-aware screen in place
(no full reload). Deep links: `/{workspace}/{screen}?country=IT`.

---

## 3. Component Architecture

```
src/
  app/            AppShell, TopBar, NavRail, CommandPalette, ThemeToggle
  context/        CountryContext, AuthContext (current user + permissions), ThemeContext
  motion/         motion.ts (variants, transitions, reduced-motion), <WorkspaceTransition>, context glyphs
  ui/             primitives — Surface, Metric, Stat, DataGrid, Drawer, Sheet,
                  Badge, RiskPill, Tag, Tabs, EmptyState, Skeleton, Toolbar, FilterBar
  workspaces/
    command/      CommandCenter + section widgets
    queues/       ActionsQueue, ReviewsQueue, ApprovalsQueue, DecisionsQueue
    review/       ReviewCenter (Summary→Exceptions→Transactions→Decision)
    operations/   Inventory, Shipments, Consignment, Returns, Commitments
    commercial/   CommercialDrilldown
    decision/     DecisionCenter, DecisionTimeline, SimilarDecisions
    approval/     ApprovalCenter
    access/       AccessManagementCenter
    finance/      Receivables, Payables, Credit, Partners
  lib/            api.ts (typed fetchers), format.ts, rbac.ts
```
Rules (from the design methodology): cards only as the best affordance, never
nested; Grid for 2D / Flex for 1D; semantic z-index scale; one reusable `DataGrid`
drives every operational table (sort, filter, drill-down, density). Widgets are
pure + role-aware via props, never fetching role logic inline.

---

## 4. Design System

Built on the existing `--tower-*` tokens (identity preserved). Additions:

- **Color**: brand blue/teal primary; semantic `--tower-emerald/amber/crimson/cyan`
  for healthy/warning/critical/info. Risk ramp: Low=emerald, Medium=amber,
  High=orange, Critical=crimson. Country accent = subtle tint layered over surface,
  never replacing brand. All body text verified ≥4.5:1 (light + dark).
- **Type**: Inter, single family, weight-contrast hierarchy. Display ≤ 6rem,
  letter-spacing floor −0.04em, `text-wrap: balance` on headings, body ≤ 72ch.
  Tabular-nums for all metrics/currency.
- **Surfaces**: `--tower-panel` / `--tower-panel-strong`; radius 12–16px (cap),
  pill only for tags/buttons; one shadow OR one border, never both.
- **Spacing**: 4px base; section rhythm 24/32/48; varied, not uniform.
- **Z-index scale**: rail(10) → sticky(20) → drawer-backdrop(30) → drawer(40) →
  modal(50) → toast(60) → tooltip(70).
- **States**: every surface has loading (skeleton), empty (guided), and error
  (retry) states. No blank screens.

## 5. Motion System (Framer Motion)

- **Tokens**: fast 180ms, base 240ms, slow 400ms; easing ease-out-quint
  `[0.22,1,0.36,1]`. No bounce/elastic. All gated by `prefers-reduced-motion`
  (→ instant crossfade).
- **Workspace transition**: shared `<WorkspaceTransition>` — content fades+rises
  8px (240ms) on route change; a context glyph animates per workspace to reinforce
  meaning (Shipments → aircraft drift, Inventory → container settle, Expiry →
  timeline sweep, Receivables → flow, Country → globe expand, Distributor →
  network, Returns → return-loop, Decisions → branching path, Approvals → stamp).
  Glyphs are transform/opacity/clip-path only (cheap, 60fps), never block input.
- **Micro-motion**: metric count-up (existing `useCountUp`), list stagger (40ms),
  risk-pill pulse on Critical, drawer slide, optimistic button states.
- **Rule**: motion reinforces context and never makes the user wait; content is
  visible by default, motion enhances (never gates) it.

## 6. RBAC Architecture

- **Source of truth**: backend `/security` — users carry `role_name` (a *template*,
  not a hardcoded gate), `permissions[]`, `country_scope[]`, and approval authority.
- **Client**: `AuthContext` exposes `hasPermission(p)`, `canAccessView(id)`,
  `inCountryScope(c)`, `canApprove(type)`. Nav, widgets, queues, and actions all
  gate on **permissions**, never on role name.
- **Access Management Center**: admin creates users, assigns a role *template*
  (which seeds a permission set the admin can then customise), sets country +
  vertical scope, and grants approval authority — all persisted via `/security`
  and audited. No roles or permissions hardcoded in the UI.
- **Country scope**: the global country selector is constrained to the user's
  `country_scope`; out-of-scope data is never shown.

---

## Implementation status (this sprint)

Shipped & connected: design-system v2 layer + motion system (Framer Motion) +
CountryContext (global selector) + expanded typed API client (Phase 2–4
endpoints) + **Executive Command Center** landing wired to
`/executive-command-center-v3`, `/executive-actions`, `/approvals`, `/decisions`,
country performance, and recent reviews — role-aware, themed, mobile-friendly.

Staged next (in priority order, against this blueprint): Decision Center →
Approval Center + Work Queues → Review Center → Operations grids → Commercial
drill-down → Access Management Center. Each is a self-contained workspace module
consuming the already-built backend APIs.
