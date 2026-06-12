# Phase 5A — Management OS: UX Architecture

Design system lives in `DESIGN.md` (root). Strategy in `PRODUCT.md`. This file:
screens, navigation, components, motion, RBAC.

## Navigation map — 8 workspaces (replaces the flat 21-item nav)

Rail (left) lists workspaces; each workspace has tabs (sub-views). Every legacy
screen keeps its view-id and hash URL — nothing is lost, only grouped.

| Workspace | Tabs (view-ids) | Backed by |
| --- | --- | --- |
| **Command Center** | Overview (`command-center`), Analytics (`analytics`), Goods Tracking (`goods-tracking`), Progress (`platform-progress`) | `/executive/command-center-v2`, dashboards |
| **My Work** | Queues (`my-work`): Actions · Reviews · Approvals · Decisions | `/executive/actions`, `/executive/approvals`, `/decisions`, review endpoints |
| **Reviews** | Review Center (`reviews`): Inventory, Expiry, Open Orders, Receivables, Distributor, Country, Vertical | `/commercial/reviews/*` (`ReviewResponse`) |
| **Approvals** | Approval Center (`approvals`): Pending / Approved / Rejected | `/executive/approvals` + decide, `/security/resolve-approver` |
| **Operations** | Ops Dashboard (`dashboard`), Inventory (`inventory`), Shipments (`shipments`), Dispatches (`dispatches`), Receipts (`receipts`), Counts (`counts`), Expiry (`expiry`), Consignment (`consignment`), Returns (`returns`), Commitments (`commitments`), Traceability (`traceability`), Documents (`documents`), Import Validation (`import-validation`), ERP Upload (`erp-uploads`), Products (`products`) | warehouse/movement/consignment/returns/commitments routes |
| **Commercial** | Performance (`commercial`): Country→Vertical→Distributor→Customer drill-down, Targets; Receivables (`receivables`), Payables (`payables`), Customers (`customers`) | `/commercial/*`, `/receivables/*`, `/payables/*` |
| **Decisions** | Decision Center (`decision-center`), Learning (`learning`), Assistant (`assistant`) | `/decisions/*` (effectiveness, history, similarity, insights), learning routes |
| **Access** | Users & Roles (`security`), Audit (`audit`) | `/security/*`, `/audit` |

`activeView` stays the single source of truth (hash-routable). `activeWorkspace`
is derived from the view→workspace map. Rail click opens the first tab the user
can access. Workspaces with zero accessible tabs are hidden.

## Screen inventory

New screens (new modules under `frontend/src/workspaces/`):
1. **My Work** — four queues with counts; each item deep-links to its workspace.
2. **Review Center** — one pattern, seven review types: Summary strip →
   Exception lanes → Transaction grid → Record decision (posts to `/decisions`).
3. **Approval Center** — pending/approved/rejected lanes; approve/reject with
   reason; stamp motion on decide; authority via permissions + approval rules.
4. **Commercial Performance** — scorecard drill-down Country → Vertical →
   Distributor → Customer; target vs actual bars; diagnostics; set targets.
5. **Receivables / Payables** — aging lists, risk, financial scorecards,
   record payment, credit control (receivables); partner intel (payables).
6. **Consignment / Returns / Commitments** — dashboards + risk + queues
   (returns inspection queue, consignment reconciliation, commitment risk).
7. **Decision Center** — timeline of decisions: Problem, Context, Options,
   Decision, Reason, Expected vs Actual; similar decisions; effectiveness.
8. **Access Management Center** — upgraded `security` view: user editor with
   role template + permission customization + country/vertical scope; approval
   authority rules; roles are templates, never hardcoded.

Upgraded: **Command Center** (sales performance, attention-required,
my-actions/approvals/decisions/reviews digests — all role- and country-aware).

Legacy screens keep working as tabs inside Operations/Commercial/Access.

## Component architecture

```
frontend/src/
  pages/App.tsx            shell + legacy views (extract progressively, no big bang)
  app/nav.ts               workspace → tabs → permission map (single source)
  context/CountryContext   country environment (accent, selector, station strip)
  motion/motion.ts         tokens + per-workspace signature variants
  workspaces/
    command/  queues/  reviews/  approvals/
    operations/  commercial/  decisions/  access/
  components/              shared: DataGrid, KpiTile, ExceptionLane, StatusPill,
                           DrillPanel, Skeleton, EmptyState, TargetBar
  lib/api.ts               typed client (add receivables/payables/commercial/
                           consignment/returns/commitments/decision-intel fns)
```

Shared component contract: every interactive element ships default/hover/
focus-visible/active/disabled/loading states; skeletons not spinners; empty
states teach the screen.

## Motion system

Tokens: fast .18s / base .24s / slow .4s, ease-out-quint. AnimatePresence on
workspace switch; per-workspace signature (one element, never blocking):

- Shipments/Dispatches: x-axis glide (aircraft feel)
- Inventory/Receipts/Counts: y-rise settle (container set-down)
- Expiry: timeline sweep (clip-path left→right)
- Receivables/Payables: flow stagger toward ledger
- Commercial: network stagger out from selected node
- Returns: loop-back x overshoot return
- Decisions: path draw (clip-path) along timeline spine
- Approvals: stamp scale 1.08→1 + ring pulse on decide
- Country switch: accent bloom + horizon sweep (existing)

All gated by `prefersReducedMotion()` → crossfade.

## RBAC architecture

- `AuthenticatedUser.permissions: string[]` is the only access driver.
- `app/nav.ts` maps every view-id → required permissions (any-of). Workspace
  visible iff ≥1 tab visible. Admin bypasses.
- Approval authority: `hasPermission(user, "<process>_approval")` + server-side
  approval rules (`/security/resolve-approver`); UI shows why you can/can't act.
- Access Center edits users (role template prefills permissions; admin can
  customize per user), country scope, vertical scope, approval rules.
- No hardcoded roles/countries/verticals anywhere in the UI.
