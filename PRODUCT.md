# Product

## Register

product

## Users

Management team of a healthcare / medical-device subsidiary. Non-technical business
owners: the Managing Director, country incharges, vertical heads, and operations
staff. They work from offices (desktop-first) and on the move (mobile-friendly),
reviewing performance, clearing work queues, approving imports and shipments, and
recording decisions. The primary task on any screen is review → exception →
transaction → decision, never raw data entry.

## Product Purpose

A management operating system (Supply Chain Control Tower) for the subsidiary:
document-driven imports, inventory, shipments, consignment, returns, commitments,
receivables/payables, distributor and country performance, decision intelligence,
approvals, and RBAC. Success = managers run the business from queues and reviews
inside this app instead of spreadsheets and email. It must never feel like a
traditional ERP.

## Brand Personality

Commanding, vivid, effortless. An executive cockpit: premium enterprise SaaS that
feels alive — colorful and classy, motion-rich but productivity-first. Reference
feel: Linear (speed, keyboard flow), Stripe Dashboard (data clarity), Vercel
(restraint), Apple (meaning-bearing motion). Country is a first-class environment:
selecting a country re-tints the room with that country's accent.

## Anti-references

- SAP, Oracle, Dynamics, Zoho, Odoo — and any generic admin template.
- Dense flat menu systems (the old 21-item nav is the anti-pattern).
- Static pages and old-style tables everywhere.
- Notification spam — work arrives in queues (My Actions / Reviews / Approvals /
  Decisions), never as toasts begging for attention.

## Design Principles

1. **Cockpit, not ERP.** Management reviews exceptions and decides; transactions
   are drill-downs, not landing pages. Summary → Exceptions → Transactions → Decision.
2. **Country is an environment, not a filter.** Selecting a country shifts the
   accent, KPIs, reviews, and performance views. Identity stays professional and subtle.
3. **Motion carries meaning.** 200–500 ms, ease-out, never blocks input, reinforces
   context (shipments glide, expiry flows along a timeline, approvals stamp).
   Full reduced-motion fallbacks always.
4. **Queues over notifications.** Users work from My Actions, My Reviews,
   My Approvals, My Decisions.
5. **Permissions drive everything.** No hardcoded roles, countries, verticals,
   approvers, or document rules — templates and learned data only.

## Accessibility & Inclusion

WCAG 2.1 AA. Body text ≥ 4.5:1 contrast in both themes; full keyboard navigation;
visible focus states; `prefers-reduced-motion` honored on every animation; color
never the only carrier of state (icons + labels accompany risk tones).
