# Phase 7C — Product Simplification & Human-First UX
### A simplification proposal (no code yet — architecture first)

**Goal:** not the most powerful supply chain platform — the *easiest one to use*.
A user should never have to ask "Where do I go? What do I click? Which screen?"

**The test we design against**
- **CEO / Board:** understands the business in **under 30 seconds** (Overview).
- **Country / GM:** finds *why* something is happening in **under 3 clicks** (Management).
- **Warehouse / Ops user:** knows what to do in **under 10 seconds**, learns the app in **15 minutes** (My Work).

The model is **Google Maps**: start broad → click → zoom → click → zoom. You never hunt through menus. We apply that everywhere: **drill-down, not screen-switching.**

---

## 1. Current Structure

The four intent tabs already exist — but each is overloaded. Today there are **~17 workspaces and ~40 second-level tabs.**

| Tab | Workspaces | Second-level tabs (today) |
|-----|-----------|---------------------------|
| **Overview** | 1 | Live Center *(1 — already good: 3 modes in one page)* |
| **Management** | 8 | Operations Intelligence · Planning · Time Machine · Primary Sales · Inventory · Secondary Sales · Business · Command Center · Analytics · Finance · Decision Center · Learning · Assistant **(≈13)** |
| **Operations** | 5 + Governance | Documents (4: Upload, Validation, Validate-Inbound, Validate-Outbound) · Primary Sales (4: Planning, Operations, Finance, Tracking) · Inventory (9: Planning, Operations, Reviews, Expiry, Consignment, Returns, Receipts, Counts, Traceability) · Secondary Sales (7: Sales, Finance, Operations, Performance, Customers, Shipments, Commitments) · **Governance:** Document Intelligence, Users & Roles, Audit, Products, ERP Upload, Progress, Ops Dashboard **(≈31)** |
| **My Work** | 2 | Queues · Approval Center **(2)** |

**The three structural problems**
1. **Management is "twenty dashboards."** Eight separate dashboard workspaces, each its own page. To answer one question you must guess which dashboard, then switch between several. This is the exact anti-pattern the mandate calls out.
2. **Operations is organised by *department* (Primary / Inventory / Secondary), not by *work*.** The same verbs repeat in every zone ("Planning", "Operations", "Finance"), and **observation screens are mixed in with action screens** (Tracking, Reviews, Performance, Traceability are *looking*, not *doing*).
3. **The same thing lives in three places.** *Finance* appears as Payables (Operations→Primary), Receivables (Operations→Secondary), and Finance (Management). *Primary/Inventory/Secondary* each have a Management dashboard **and** an Operations zone. The user must know the difference. They shouldn't have to.

---

## 2. Proposed Structure

Keep the four tabs. Collapse what's inside them. **From ~40 tabs to ~12 destinations.**

```
OVERVIEW      "What is happening?"        → 1 living page (no tabs)
MANAGEMENT    "Why is it happening?"      → 1 Analysis workspace + always-on filter bar
OPERATIONS    "What work needs doing?"    → 1 process pipeline + Governance (admins only)
MY WORK       "What do I need to do?"     → 1 personal queue (the default home for most users)
```

- **Overview** — observation only. Live map, ticker, activity feed, current position. No forms, no analysis, no decisions. *(Already built this way.)*
- **Management** — **one** intelligent workspace, not eight dashboards. A persistent **global filter bar** (Country · Vertical · Category · Product · Customer · Date range · Shipment) sits on top; below it a small set of **analyses you open in place and drill into**. Change a filter once and *every* analysis re-reads. Saved Views replace separate pages.
- **Operations** — reorganised around the **work pipeline**, not departments: **Documents → Receive → Allocate → Fulfil → Close.** Pure "looking" screens move out (to Overview/Management). Governance (Users, Audit, Products, ERP, Document Intelligence) stays a quiet cluster visible only to Admin / App Manager.
- **My Work** — becomes the **default landing for operational users.** Their pending items find *them*; they rarely need to browse Operations at all.

---

## 3. Tabs Removed / Folded

| Removed as a separate tab | Folded into |
|---------------------------|-------------|
| Management: Operations Intelligence, Planning, Time Machine, Primary, Inventory, Secondary, Business, Command Center, Analytics, Finance, Decision Center, Learning, Assistant *(13 → analyses)* | **One Management workspace** — each becomes a card/analysis behind the shared filter bar, opened in place. |
| Operations → Documents: *Validate-Inbound*, *Validate-Outbound* as separate tabs | **One Documents screen** that auto-detects inbound vs outbound (see Rule 1). |
| Operations → Primary/Inventory/Secondary: *Tracking, Reviews, Performance, Traceability* | These are **observation** → move to **Overview** (live tracking) / **Management** (reviews, performance, traceability drill-downs). |
| Operations: *Payables*, *Receivables*, Management: *Finance* (money in 3 places) | **One "Money" analysis** in Management (payables + receivables + cashflow), filtered like everything else. |
| Operations → *Ops Dashboard* (under Setup) | Redundant with Overview/Management — removed. |
| My Work: *Approval Center* as its own workspace | Folded into **My Work** as one queue type among "My Approvals / Validations / Reviews / Corrections / Decisions". |

Net: **Management ≈13 → effectively 1.** **Operations ≈31 → ~6 doing-steps + Governance.** **My Work 2 → 1.**

---

## 4. Screens Merged

1. **4 document screens → 1.** Upload Center + Validation Center + Validate-Inbound + Validate-Outbound become a single **Documents** screen. The system decides direction and routing; the user just uploads and confirms.
2. **3 "Planning" + 3 "Operations" + 2 "Finance" sub-tabs** (repeated across Primary/Inventory/Secondary) collapse into the **shared pipeline** (one Receive step, one Allocate step, one Fulfil step) — the country/vertical is a *filter*, not a separate set of screens.
3. **8 dashboards → 1 analysis canvas.** One workspace, many analyses, one filter bar, drill-down instead of page-switching.
4. **Money everywhere → one Money view.** Payables, receivables and finance dashboards unify.
5. **Decisions + Learning + Assistant** merge into the analysis canvas as "Decisions" (a decision is just an analysis you act on; learning/assistant are context within it).

---

## 5. Workflows Simplified (the system prevents mistakes)

- **Upload a document:** today the user must choose *Primary Upload* vs *Secondary Upload*. → **The system classifies it** from its content (invoice/AWB/packing list, origin/destination). One upload box. *(Rule 1.)*
- **Validation:** technical concepts hidden. The user sees "**3 fields need your confirmation**", not "OCR confidence 0.62 / template engine / translation memory". *(Rule 2.)*
- **Goods receipt:** after a shipment is approved, "**Receive into [warehouse]**" appears as a one-click task in My Work — no hunting through the Inventory zone's 9 tabs.
- **Approvals / reviews / corrections / collections:** never browsed for — they **arrive in My Work**, scoped to the logged-in email.
- **Decisions:** surfaced from an anomaly in Overview → "Look into this" jumps straight to the pre-filtered analysis in Management → "Record decision" — a single path, not a tour.

---

## 6. Click-Reduction Opportunities

| Common task | Today (clicks) | Proposed | Saved |
|-------------|----------------|----------|-------|
| Upload + classify a shipment document | Choose Primary/Secondary → zone → tab → upload **(4)** | One Documents box, auto-classified **(1)** | −3 |
| "Why is Brazil revenue down?" | Management → pick which of 8 dashboards → maybe switch dashboards → filter **(4–6)** | Management → set Country=Brazil once → every analysis re-reads; drill down **(2)** | −3 |
| Approve a pending import | Find Operations/My Work → Approval Center → item → approve **(4)** | My Work → item is already on top → approve **(2)** | −2 |
| Post a goods receipt | Operations → Inventory zone → Receipts tab → item → post **(5)** | My Work task "Receive shipment X" → post **(2)** | −3 |
| Leadership: grasp today's business | Pick a dashboard, read, switch **(3+)** | Overview, read **(0–1)** | −2+ |

---

## 7. User Journeys (after)

- **CEO / Board (30 seconds):** Lands on **Overview**. Live map + ticker + "current position" headline answers *what is happening* without a click. Sees Brazil flashing → clicks it → drills to the city → optional "Look into this".
- **Country Manager / GM (under 3 clicks):** Lands on **Management**. Sets the filter to their country **once**. Reads the relevant analyses (sales, inventory, money, planning) on one canvas; drills into any number → never switches "dashboards". Saves the view as "My Morning".
- **Warehouse / Ops user (10 seconds, learn in 15 min):** Lands on **My Work**. A short list of today's tasks (receive, count, correct, dispatch) in plain language. Does them top to bottom. Never needs to understand Primary/Inventory/Secondary at all.
- **Admin / App Manager:** Same four tabs; additionally sees the quiet **Governance** cluster in Operations (Users, Audit, Products, ERP, Document Intelligence).

---

## 8. Navigation-Reduction Plan

1. **Default landing by intent, not by menu.** Leadership → Overview; operational users → My Work; admins → wherever they left off. Driven by permissions (already email-based).
2. **One filter bar for all of Management** replaces eight dashboard destinations. Filter state persists across analyses and is shareable as a Saved View (deep-linkable URL).
3. **Operations becomes a left-to-right pipeline** (Documents → Receive → Allocate → Fulfil → Close), each step showing only its own work. Country/vertical are filters, not separate zones.
4. **Move observation out of Operations** (Tracking → Overview; Reviews/Performance/Traceability → Management drill-downs).
5. **Keep the current location always highlighted**, keep Back predictable, preserve filters/scroll on return *(design-system navigation rules)*.
6. **Cap visible second-level tabs at ~5 per workspace**; anything beyond becomes drill-down or an overflow, never a wall of tabs.

---

## 9. Where the System Decides (instead of the user)

- **Document direction & type** — inbound vs outbound, invoice vs AWB vs packing list → detected, not asked.
- **Next step routing** — a validated document proposes its own next action ("Ready to receive").
- **What's on my plate** — My Work is assembled from the user's email + permissions; the user never builds it.
- **Currency / rate book / date** — chosen from context (primary vs secondary flow, transaction date) automatically; manual override stays available but hidden until needed.
- **Shipment country / vertical** — inferred from documents (`COUNTRY-VERTICAL-NUMBER`), confirmed in one tap.
- **Where to land** — role/permissions pick the home tab.
- **Mistake prevention** — destructive actions confirmed; soft-delete only; the easy path is always the safe path.

> Guardrails kept intact: OCR never auto-creates transactions (human confirms); nothing hard-deletes; no new countries/warehouses/products/verticals/approvers hardcoded — they're learned in-app.

---

## 10. Recommended Final Information Architecture

```
OVERVIEW  — "What is happening?"            [observe only]
  └ Live Center (one page: Primary · Inventory · Secondary modes; map, ticker, feed, position)

MANAGEMENT — "Why is it happening?"         [analyse]
  └ Analysis (one workspace)
      • Global filter bar: Country · Vertical · Category · Product · Customer · Date · Shipment
      • Analyses (open in place, drill down): Business · Primary · Inventory · Secondary ·
        Money(Finance) · Planning & Time Machine · Operations Intelligence · Decisions(+Learning/Assistant)
      • Saved Views (personal, shareable)

OPERATIONS — "What work needs doing?"       [execute]
  └ Pipeline: Documents → Receive → Allocate → Fulfil → Close
      (Counts, Returns, Consignment, Expiry actions live as steps/tasks, not separate tabs)
  └ Governance  [Admin / App Manager only]: Users & Roles · Audit · Products · ERP Upload · Document Intelligence

MY WORK — "What do I personally need to do?" [default home for most users]
  └ My Queue (email-scoped): Validations · Approvals · Reviews · Corrections · Collections ·
    Shipment updates · Decisions
```

**Rollout (safe, phased — no big-bang):**
1. Collapse **Management** into the single Analysis workspace + filter bar (biggest clarity win, no data risk).
2. Make **My Work** the aggregated default home; pull approvals/validations/reviews into it.
3. Re-thread **Operations** into the pipeline; move observation screens to Overview/Management.
4. Auto-classify documents (remove Primary/Secondary upload choice).
5. Retire redundant screens (Ops Dashboard; duplicate Finance) once their content lives in the merged homes.

Every step keeps all existing screens reachable until its replacement is proven — then the old one is removed. **Reduce. Merge. Make it obvious.**
