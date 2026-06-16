import { convertAmount } from "./currency";
import type { ApiImportFileCandidate } from "./api";

// B3 Document Intelligence — the calculations layer (Phase 6C, item D).
// Real B3/Invoice/Packing/AWB field *extraction* needs the production OCR
// pipeline; what we can do now, accurately, is derive the shipment-level
// analytics from the line data already captured, and store/show them. Values
// are converted into the active display currency so totals are comparable.

export type ShipmentAnalytics = {
  totalValue: number;
  totalQuantity: number;
  totalSkus: number;
  totalBatches: number;
  earliestExpiry: string | null;
  latestExpiry: string | null;
  grossWeightKg: number;
  chargeableWeightKg: number;
  boxCount: number;
  weightPerBox: number | null;
  avgQtyPerBox: number | null;
};

export function computeShipmentAnalytics(candidate: ApiImportFileCandidate): ShipmentAnalytics {
  const lines = candidate.lines ?? [];
  const skus = new Set<string>();
  const batches = new Set<string>();
  let totalQuantity = 0;
  let totalValue = 0;
  let earliestExpiry: string | null = null;
  let latestExpiry: string | null = null;

  for (const line of lines) {
    if (line.item_code) skus.add(line.item_code.trim().toLowerCase());
    if (line.batch_number) batches.add(`${line.item_code}|${line.batch_number}`.toLowerCase());
    totalQuantity += line.quantity || 0;
    totalValue += convertAmount((line.unit_value || 0) * (line.quantity || 0), { from: line.currency });
    if (line.expiry_date) {
      if (!earliestExpiry || line.expiry_date < earliestExpiry) earliestExpiry = line.expiry_date;
      if (!latestExpiry || line.expiry_date > latestExpiry) latestExpiry = line.expiry_date;
    }
  }

  const grossWeightKg = candidate.gross_weight_kg ?? 0;
  const chargeableWeightKg = candidate.chargeable_weight_kg ?? 0;
  const boxCount = candidate.package_count ?? 0;

  return {
    totalValue,
    totalQuantity,
    totalSkus: skus.size,
    totalBatches: batches.size,
    earliestExpiry,
    latestExpiry,
    grossWeightKg,
    chargeableWeightKg,
    boxCount,
    weightPerBox: boxCount > 0 ? grossWeightKg / boxCount : null,
    avgQtyPerBox: boxCount > 0 ? totalQuantity / boxCount : null,
  };
}
