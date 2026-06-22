import { useId } from "react";
import { Info } from "lucide-react";

// Plain-language glossary (Phase 7G). The app keeps its real business terms —
// they carry meaning and drive the logic — but every bit of jargon can be read
// in one everyday sentence by anyone, with zero supply-chain background. This is
// progressive disclosure: the term stays, the explanation is one hover/tab away.
// Keys are the lowercased term; look-ups in `Term` are case-insensitive.
export const GLOSSARY: Record<string, string> = {
  "primary sales": "Goods coming IN — the subsidiary buying stock from India, the source.",
  "secondary sales": "Goods going OUT — the subsidiary selling that stock to its own local customers.",
  inventory: "The stock we are holding right now: what came in from Primary, minus what went out as Secondary.",
  serviceability: "How much of what customers have already ordered we can actually supply from stock today. Higher is better.",
  "coverage days": "How many days the current stock will last at the recent selling rate before we run out.",
  "coverage": "How many days the current stock will last at the recent selling rate before we run out.",
  "inventory aging": "How long stock has been sitting unsold. Older stock ties up cash and risks expiring.",
  "near-expiry": "Stock that will pass its use-by date soon, so it should be sold or moved first.",
  "near expiry": "Stock that will pass its use-by date soon, so it should be sold or moved first.",
  "out of stock": "Items customers want that we currently have none of.",
  "expiry & out of stock": "Stock that customers actually want which is about to expire, plus items in demand we've run out of. Stock nobody is ordering isn't counted here.",
  "near expiry, in demand (≤90 days)": "Near-expiry stock that customers want — the units to sell or move first, before they lapse. Expiring stock with no demand isn't counted here.",
  "at write-off risk (no demand, ≤90 days)": "Near-expiry stock that NO customer is currently ordering — it may become a loss. Discount it, move it, or plan to write it off. The other half of expiring stock (what customers want) is the 'sell this now' figure beside it.",
  "write-off risk": "Stock about to expire with no demand behind it — money you may lose unless you discount or move it.",
  "stock state": "A breakdown of stock into available to sell, reserved for orders, expiring soon, and expired.",
  customs: "Government clearance that imported goods must pass before they can be delivered.",
  "customs reliability": "How often our imports clear government customs on time, without hold-ups.",
  "supply protection": "How safe our supply is from running out — buffer stock and back-up sources.",
  "delay severity": "Of the shipments that are late, how late they are — a little, a lot, or critically.",
  "shipment reliability": "How often our shipments arrive on time as promised.",
  "po → pod cycle": "The time from a customer placing an order (PO) to them receiving it (proof of delivery, POD).",
  "po -> pod cycle": "The time from a customer placing an order (PO) to them receiving it (proof of delivery, POD).",
  "performance buckets": "Orders sorted into how well we served them: on time, slightly late, or badly late.",
  backorders: "Customer orders we've accepted but can't fulfil yet because the stock isn't available.",
  backordered: "An order we've accepted but can't fulfil yet because the stock isn't available.",
  "in-transit": "Goods that have left the supplier but haven't arrived at the warehouse yet.",
  "in transit": "Goods that have left the supplier but haven't arrived at the warehouse yet.",
  consignment: "Stock we place at a customer's site that we still own until they actually use it.",
  receivables: "Money customers owe us for goods we've already delivered.",
  payables: "Money we owe our suppliers for goods we've already received.",
  serviceabilityfuture: "Whether we can cover demand we can already see coming, not just today's orders.",
};

// One reusable, keyboard-accessible "?" affordance: a small circled info icon
// that reveals a plain-language explanation on hover OR keyboard focus.
// Styled bubble lives in styles.phase5a.css (.infotip*). Occasional interaction,
// so a 140ms ease-out is right (emil); honours reduced motion.
export function InfoTip({ label, children }: { label: string; children: string }) {
  const id = useId();
  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-btn"
        aria-label={`What does "${label}" mean?`}
        aria-describedby={id}
      >
        <Info size={12} aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="infotip-pop">
        {children}
      </span>
    </span>
  );
}

// Convenience: looks the term up in the glossary by its visible text. Renders
// nothing if the term isn't glossed, so it's safe to sprinkle anywhere.
export function Term({ name, label }: { name?: string; label: string }) {
  const key = (name ?? label).toLowerCase().trim();
  const gloss = GLOSSARY[key];
  if (!gloss) return null;
  return (
    <InfoTip label={label}>{gloss}</InfoTip>
  );
}
