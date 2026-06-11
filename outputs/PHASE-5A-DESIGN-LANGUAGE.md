# OPS — Mission Control for Medical Supply
### Phase 5A · Product Design Language (design-led redesign)

> **Tagline:** *Calm command over life-critical flow.*
> Not an ERP. Not a dashboard. A management operating system that gives four
> executives **situational awareness** over medical product crossing borders —
> where every pixel either carries a signal or gets out of the way.

The core emotional truth: this product moves life-critical devices through
customs, expiry windows, credit limits and distributors. The user is never
"doing data entry" — they are *standing in a control room, reading the situation,
and committing a decision.* The interface should feel like that room.

---

## 1. Moodboards — three visual worlds

### World 1 · The Control Room (primary, dark)
Deep instrument backdrop (slate-navy, not pure black), a single system light
(brand teal), and signal colour reserved exclusively for risk. Reference points:
an airline operations centre at night, NASA mission control, Stripe's dark
surfaces, Linear's restraint. **Light is information** — the brightest things on
screen are the things that matter (a critical risk, a number that changed).
Materials: layered matte surfaces with one soft elevation; a single faint
"instrument-glass" sheen on the hero only (never glassmorphism everywhere);
hairline separators, not boxes-in-boxes.

### World 2 · Daylight Ops (light theme)
The same room at day. A true cool off-white (chroma 0 — never cream/sand), ink
text at ≥ 4.5:1, the same teal system light, the same signal palette. Apple-clean,
calm, zero clutter. Theme is a *time of day*, not a reskin.

### World 3 · Country Environments
Every country is a **station** with its own atmosphere — an accent hue derived
deterministically from its identity (no hardcoded country list), a faint horizon
glow, and a vitals strip. Selecting a country is not a filter; it is **walking
into that station's control room** — the ambient accent shifts, a horizon sweeps,
and the country's situation comes up on the board.

Palette (built on the existing `--tower-*` identity, refined):
- **System**: brand teal/cyan — structure, navigation, "the platform speaking".
- **Signal ramp** (risk = colour, the *only* place saturated colour lives):
  Low `emerald` · Medium `amber` · High `orange` · Critical `crimson`.
- **Country accent**: per-station hue, used at low chroma for atmosphere and
  active states — never competing with the signal ramp.
- **Ink / muted**: high-contrast text; muted reserved for secondary metadata only.

Type: **Inter**, one family, weight + size contrast (no second sans). Display
numerals are large, calm, and **tabular** (`font-variant-numeric: tabular-nums`)
so figures don't jitter. Display ≤ 6rem, letter-spacing floor −0.04em,
`text-wrap: balance` on headings, prose ≤ 72ch.

---

## 2. Design direction — the principles

1. **Situational awareness over data density.** The first read answers "what
   needs me?" in under three seconds. Tables are an end state you drill *into*,
   not the landing.
2. **Colour is meaning.** Saturated colour = risk. The platform's own voice is
   teal. A screen with no risk is calm and nearly monochrome — and that itself
   is information.
3. **Big calm numbers, generous negative space.** Vitals are large and quiet,
   not crammed into identical metric cards.
4. **Depth, not boxes.** Elevation + atmosphere create hierarchy; we avoid the
   grid-of-identical-cards reflex and nested cards entirely.
5. **The system recommends; management decides.** Every risk pairs with a
   recommended action and a path to *capture the decision* — the product never
   acts on its own.

---

## 3. Persona lenses — the cockpit reconfigures

The Command Center is not one layout. It reorders its emphasis to the executive
reading it (permission-aware; defaults to the user's mandate):

| Lens | "First read" | Emphasis |
|---|---|---|
| **Country Manager** — *My station* | My country's mission status | my risks, my distributors, my reviews, my approvals |
| **General Manager** — *The map* | Cross-country performance & risk | country league table, top signals, exposure, open decisions |
| **Supply Chain Head** — *The flow* | Product in motion | inventory flow, shipments in transit, expiry horizon, commitments/OTIF |
| **Finance Head** — *The ledger* | Money in motion | net exposure, receivables vs payables, credit holds, payment risk |

---

## 4. Screen concepts

### Command Center → **the cockpit**
- **Mission-status hero**: persona greeting + one-line situational summary
  ("3 signals need you · 2 critical") + a row of large, calm, counting vitals
  (net exposure, available inventory, OTIF, open risks). A faint current animates
  across the hero — the platform is *live*, not static.
- **Lens switcher**: segmented control; switching re-weights the board.
- **Signal board** (replaces "attention required"): risks as living signals —
  severity drives a slow breathing pulse; critical signals sit at the top and
  glow. Each signal shows context + recommended action + a one-tap path to act
  or to *frame a decision*.
- **Queues**: My Actions / Approvals / Decisions / Reviews as calm worklists.

### Country Entry → **immersive station switch**
Selecting a country: the ambient accent blooms to the country's hue, a horizon
gradient sweeps in (clip-path), and a **country situation strip** rises —
station glyph in an accent ring, country name, and that country's vitals
(inventory value, open risks, distributors, on-time %). It reads as *arriving*,
not *filtering*.

### Decision Center → **the signature decision cockpit** (next build)
Three zones, timeline-driven, never a CRUD form:
- **Left — the situation**: the problem and its *detected context*, pulled live
  from the risk engines ("Batch X expiring in 41 days · 0% consumed · ₹4.6L at
  risk"). The decision starts from a real, detected signal.
- **Centre — the decision tree**: options fan out as branches; selecting one
  *illuminates that path*; expected outcome resolves along a timeline, and later
  the actual outcome + effectiveness lands on the same line. Committing a decision
  feels like *filing a flight plan*.
- **Right — collective memory**: similar past decisions (rule-based), their
  reasons, what happened, and aggregate effectiveness — "how we handled this
  before". This is the platform's institutional knowledge made visible.

### Workspace identities (motion + glyph + accent — staged builds)
Shipments→flight arc · Inventory→settling strata · Receivables→cash current ·
Expiry→timeline sweep · Distributor→network · Returns→return-loop ·
Country Review→radar mission-board · Approvals→stamp · Decisions→branching path.

---

## 5. Motion concepts — motion *is* meaning (never decoration)

| Meaning | Motion | Where |
|---|---|---|
| **Movement** | directional travel + trailing fade; great-circle arc | shipments |
| **Risk** | slow breathing pulse; intensity scales with severity | signals, critical items |
| **Flow** | a continuous, almost-subliminal current | finance / inventory headers |
| **Performance** | count-up + bar fill (ease-out); a glow when ≥ 100% | vitals, achievement |
| **Decisions** | branches reveal, chosen path illuminates, outcome resolves | Decision Center |
| **Arrival** | horizon sweep + accent bloom | country entry |

Rules: ease-out-quint, 180–400ms, no bounce; content is visible by default and
motion *enhances* it; everything has a `prefers-reduced-motion` fallback (motion
collapses to an instant, dignified state — never broken, never blank).

---

## 6. User journeys (cinematic)

- **Country Manager, 8:40am** — opens OPS; the board is already on *My station*.
  Two amber signals breathe near the top: a distributor under-consuming a batch
  41 days from expiry, and a receivable 30 days overdue. She switches to Italy —
  the room shifts to Italy's accent, the situation strip rises. She taps the
  expiry signal → *frame a decision* → reallocate. Done in 90 seconds, captured.
- **General Manager, Monday review** — opens on *The map*: a country league
  table, net exposure leading, three critical signals across markets. He reads
  the situation, not a spreadsheet, and assigns two reviews to his team.
- **Supply Chain Head** — *The flow*: shipments in transit arc across the header;
  the expiry horizon shows what tips into risk this month; OTIF is the headline
  vital. He opens the expiry review and drills to the exact batches.
- **Finance Head** — *The ledger*: net exposure is the hero; receivables and
  payables flow in and out; two distributors sit in credit-hold. He clears one
  override (captured + audited) and flags one for collection.

---

## Implementation in this sprint
Redesign the **visual language** first (per direction): cockpit atmosphere +
signal system + refined type/elevation, applied to a **reimagined cockpit
Command Center** with persona **lenses** and **meaning-bearing motion**, plus the
**immersive country-entry** experience (ambient accent + horizon sweep + station
situation strip). The **Decision Center cockpit** is fully specified here and is
the next build. No additional CRUD screens until the language is set.
