import { convertAmount } from "./currency";
import type { ApiImportFileCandidate, ApiInventoryBatch, ApiShipment } from "./api";

// Shipment movement, computed live from real records — never hardcoded.
// Four metrics per country, each split into Primary (inbound, Meril India →
// subsidiary) and Secondary (outbound, subsidiary → customer):
//   • shipments  — how many are moving
//   • units      — total quantity
//   • weight     — total kilograms ("volume", in the user's words)
//   • value      — worth, converted into the display currency
//
// "active" = in motion right now. The time windows answer "how much did we move
// in this period" by including shipments whose date falls inside the window.

export type MovementMetrics = { shipments: number; units: number; weight: number; value: number };
export type CountryMovement = {
  country: string;
  total: MovementMetrics;
  primary: MovementMetrics;
  secondary: MovementMetrics;
};
export type MovementResult = {
  totals: MovementMetrics;
  primary: MovementMetrics;
  secondary: MovementMetrics;
  byCountry: Record<string, CountryMovement>;
};

export type MovementWindow = "active" | "month" | "3m" | "6m" | "year" | "all";

const zero = (): MovementMetrics => ({ shipments: 0, units: 0, weight: 0, value: 0 });

// Primary import is "done" (no longer in motion) once received/closed.
const PRIMARY_DONE = new Set(["received", "closed", "rejected", "cancelled"]);
// Secondary shipment is in motion while it is submitted / approved / dispatched.
const SECONDARY_ACTIVE = new Set(["submitted", "approved", "dispatched"]);

function windowStart(window: MovementWindow, now: Date): Date | null {
  if (window === "active" || window === "all") return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (window === "month") {
    d.setDate(1);
    return d;
  }
  if (window === "year") {
    d.setMonth(0, 1);
    return d;
  }
  d.setMonth(d.getMonth() - (window === "3m" ? 3 : 6));
  return d;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function add(target: MovementMetrics, source: MovementMetrics): void {
  target.shipments += source.shipments;
  target.units += source.units;
  target.weight += source.weight;
  target.value += source.value;
}

export function computeMovement(
  imports: ApiImportFileCandidate[],
  shipments: ApiShipment[],
  batches: ApiInventoryBatch[],
  window: MovementWindow,
  now: Date = new Date(),
): MovementResult {
  const start = windowStart(window, now);
  const byCountry: Record<string, CountryMovement> = {};
  const totals = zero();
  const primary = zero();
  const secondary = zero();

  const ensure = (country: string): CountryMovement => {
    if (!byCountry[country]) {
      byCountry[country] = { country, total: zero(), primary: zero(), secondary: zero() };
    }
    return byCountry[country];
  };

  const inWindow = (date: Date | null): boolean => {
    if (!start) return true; // "all"
    return date != null && date >= start && date <= now;
  };

  // Unit value lookup for outbound (secondary) shipment lines.
  const batchValue = new Map<string, { unit: number; currency: string | null }>();
  for (const batch of batches) {
    batchValue.set(`${batch.item_code}|${batch.batch_number}`.toLowerCase(), {
      unit: batch.unit_value,
      currency: batch.currency,
    });
  }

  // PRIMARY — inbound imports.
  for (const candidate of imports) {
    const country = (candidate.destination_country || "").trim();
    if (!country) continue;
    const status = (candidate.status || "").toLowerCase();
    const include =
      window === "active"
        ? !PRIMARY_DONE.has(status)
        : inWindow(parseDate(candidate.invoice_date) ?? parseDate(candidate.flight_date));
    if (!include) continue;

    const units = candidate.lines.reduce((sum, line) => sum + (line.quantity || 0), 0);
    const weight = candidate.gross_weight_kg ?? candidate.chargeable_weight_kg ?? 0;
    const value = candidate.lines.reduce(
      (sum, line) => sum + convertAmount((line.unit_value || 0) * (line.quantity || 0), { from: line.currency }),
      0,
    );
    const metrics: MovementMetrics = { shipments: 1, units, weight, value };
    add(totals, metrics);
    add(primary, metrics);
    const cm = ensure(country);
    add(cm.total, metrics);
    add(cm.primary, metrics);
  }

  // SECONDARY — outbound customer shipments.
  for (const shipment of shipments) {
    const country = (shipment.destination_country || "").trim();
    if (!country) continue;
    const status = (shipment.status || "").toLowerCase();
    const include =
      window === "active" ? SECONDARY_ACTIVE.has(status) : inWindow(parseDate(shipment.request_date));
    if (!include) continue;

    let units = 0;
    let value = 0;
    for (const line of shipment.lines) {
      const qty = line.quantity_approved || line.quantity_requested || 0;
      units += qty;
      const bv = batchValue.get(`${line.item_code}|${line.batch_number}`.toLowerCase());
      if (bv) value += convertAmount(bv.unit * qty, { from: bv.currency });
    }
    const metrics: MovementMetrics = { shipments: 1, units, weight: 0, value };
    add(totals, metrics);
    add(secondary, metrics);
    const cm = ensure(country);
    add(cm.total, metrics);
    add(cm.secondary, metrics);
  }

  return { totals, primary, secondary, byCountry };
}
