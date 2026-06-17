// Live operational event stream (Phase 7A).
//
// The executive ticker and activity feed are NOT notifications or alerts — they
// are a continuous stream of things that actually happened, drawn from the two
// real event sources the platform already keeps: the tamper-evident audit trail
// and the stock-movement ledger. Every line is a real business event, phrased
// in plain language. Nothing is invented.

import { formatUnits } from "./currency";
import type { ApiAuditEvent, ApiMovementEvent } from "./api";

export type LiveCategory = "primary" | "inventory" | "secondary" | "finance" | "system";

export type LiveEvent = {
  id: string;
  at: Date;
  time: string; // "10:04"
  category: LiveCategory;
  text: string;
  actor?: string | null;
};

export const CATEGORY_LABEL: Record<LiveCategory, string> = {
  primary: "Primary",
  inventory: "Inventory",
  secondary: "Secondary",
  finance: "Finance",
  system: "System",
};

function timeOf(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sentenceCase(value: string): string {
  const clean = value.replace(/_/g, " ").trim();
  return clean ? clean[0].toUpperCase() + clean.slice(1) : clean;
}

function categoryFromModule(moduleName: string, action: string): LiveCategory {
  const m = `${moduleName} ${action}`.toLowerCase();
  if (/(secondary|dispatch|customer|sales_order|delivery)/.test(m)) return "secondary";
  if (/(import|primary|goods_receipt|receipt|arrival)/.test(m)) return "primary";
  if (/(inventory|stock|count|expiry|batch|consignment|return)/.test(m)) return "inventory";
  if (/(payable|receivable|payment|invoice|credit|finance)/.test(m)) return "finance";
  return "system";
}

function categoryFromMovement(eventType: string): LiveCategory {
  const t = eventType.toLowerCase();
  if (/(dispatch|delivery|shipment|sale)/.test(t)) return "secondary";
  if (/(receipt|goods_receipt|arrival)/.test(t)) return "primary";
  return "inventory";
}

function humanizeAudit(event: ApiAuditEvent): string {
  const base = sentenceCase(event.action);
  const ref = event.entity_id ? ` · ${event.entity_id}` : "";
  return `${base}${ref}`;
}

function humanizeMovement(event: ApiMovementEvent): string {
  const qty = formatUnits(event.quantity || 0);
  const type = event.event_type.toLowerCase();
  const item = event.reference || event.item_code || "stock";
  if (/receipt|arrival|goods_receipt/.test(type)) {
    const where = event.warehouse ? ` at ${event.warehouse}` : "";
    const from = event.counterparty ? ` from ${event.counterparty}` : "";
    return `Received ${qty} units of ${item}${where}${from}`;
  }
  if (/dispatch|delivery|shipment/.test(type)) {
    const to = event.counterparty ? ` to ${event.counterparty}` : "";
    return `Dispatched ${qty} units of ${item}${to}`;
  }
  if (/allocat|reserv/.test(type)) {
    const to = event.counterparty ? ` for ${event.counterparty}` : "";
    return `Allocated ${qty} units of ${item}${to}`;
  }
  const where = event.warehouse ? ` at ${event.warehouse}` : "";
  return `${sentenceCase(event.event_type)} · ${qty} units of ${item}${where}`;
}

export function buildLiveStream(
  auditEvents: ApiAuditEvent[],
  movements: ApiMovementEvent[],
  limit = 80,
): LiveEvent[] {
  const events: LiveEvent[] = [];

  for (const e of auditEvents) {
    const at = new Date(e.created_at);
    if (Number.isNaN(at.getTime())) continue;
    events.push({
      id: `a-${e.id}`,
      at,
      time: timeOf(at),
      category: categoryFromModule(e.module_name, e.action),
      text: humanizeAudit(e),
      actor: e.actor,
    });
  }

  for (const e of movements) {
    const at = new Date(e.occurred_at);
    if (Number.isNaN(at.getTime())) continue;
    events.push({
      id: `m-${e.event_id}`,
      at,
      time: timeOf(at),
      category: categoryFromMovement(e.event_type),
      text: humanizeMovement(e),
      actor: e.actor,
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, limit);
}
