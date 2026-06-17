// Executive Live Operations Center data layer (Phase 7A).
//
// Turns the platform's real operational records into the three observation
// lanes a business owner cares about:
//
//   Primary Sales   →  "What is entering the business?"   (incoming imports)
//   Inventory       →  "What do we currently own?"        (stock on hand)
//   Secondary Sales →  "What is leaving the business?"    (customer orders)
//
// Everything here is computed live from actual records — no demo data, no fake
// activity, nothing hardcoded. Each lane produces map colour values, rich
// per-country tooltips, a persistent side panel, city nodes, animated routes,
// and the single "current position" strip an executive reads in 30 seconds.

import { convertAmount, formatDisplay, formatUnits } from "./currency";
import { cityCoords, cityFromLabel } from "./cityGeo";
import type { MapCity, MapRoute } from "../components/WorldMap";
import type {
  ApiCustomer,
  ApiCustomerCommitment,
  ApiImportFileCandidate,
  ApiInventoryBatch,
  ApiShipment,
  ApiWarehouseLocation,
} from "./api";

export type LaneId = "primary" | "inventory" | "secondary";

export type ExecRow = { label: string; value: string; tone?: "good" | "bad" | "warn" };

export type ExecChip = { label: string; value: string; tone?: "good" | "bad" | "warn" };

export type ExecPosition = {
  headline: string; // e.g. "Incoming today"
  count: number;
  countLabel: string; // e.g. "Shipments"
  value: number; // converted into display currency
  units: number;
  chips: ExecChip[]; // small supporting numbers
};

export type ExecLane = {
  values: Record<string, number>; // country → magnitude (drives map colour)
  tooltips: Record<string, ExecRow[]>; // pre-formatted hover rows per country
  sidePanel: Record<string, ExecRow[]>; // persistent country panel
  cities: MapCity[]; // city-level nodes (rendered only when a country is opened)
  routes: MapRoute[]; // animated arcs for in-motion shipments
  position: ExecPosition;
  formatValue: (value: number) => string; // how the map legend reads the magnitude
};

const PRIMARY_DONE = new Set(["received", "closed", "rejected", "cancelled", "delivered"]);
const SECONDARY_ACTIVE = new Set(["submitted", "approved", "dispatched"]);

const norm = (value: string | null | undefined): string => (value ?? "").trim();

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysAgo(n: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// ----------------------------------------------------------------------------
// PRIMARY — what is entering the business (incoming imports).
// ----------------------------------------------------------------------------
export function buildPrimaryLane(
  imports: ApiImportFileCandidate[],
  warehouses: ApiWarehouseLocation[],
  now: Date = new Date(),
): ExecLane {
  const cutoff30 = daysAgo(30, now);
  const cutoff14 = daysAgo(14, now);

  type Agg = { count: number; units: number; value: number; delayed: number };
  const byCountry = new Map<string, Agg>();
  const ensure = (c: string): Agg => {
    if (!byCountry.has(c)) byCountry.set(c, { count: 0, units: 0, value: 0, delayed: 0 });
    return byCountry.get(c)!;
  };

  let totalCount = 0;
  let totalUnits = 0;
  let totalValue = 0;
  let arrived = 0;
  let delayed = 0;
  const routeTally = new Map<string, MapRoute>();

  for (const candidate of imports) {
    const country = norm(candidate.destination_country);
    const status = norm(candidate.status).toLowerCase();
    const isActive = !PRIMARY_DONE.has(status);

    // Recently arrived (for context chip), counted across all records.
    const refDate = parseDate(candidate.invoice_date) ?? parseDate(candidate.flight_date);
    if (PRIMARY_DONE.has(status) && status !== "rejected" && status !== "cancelled" && refDate && refDate >= cutoff30) {
      arrived += 1;
    }
    if (!isActive || !country) continue;

    const units = candidate.lines.reduce((sum, line) => sum + (line.quantity || 0), 0);
    const value = candidate.lines.reduce(
      (sum, line) => sum + convertAmount((line.unit_value || 0) * (line.quantity || 0), { from: line.currency }),
      0,
    );
    const flight = parseDate(candidate.flight_date);
    const isDelayed = flight != null && flight < cutoff14;

    totalCount += 1;
    totalUnits += units;
    totalValue += value;
    if (isDelayed) delayed += 1;

    const agg = ensure(country);
    agg.count += 1;
    agg.units += units;
    agg.value += value;
    if (isDelayed) agg.delayed += 1;

    const origin = norm(candidate.origin_country);
    if (origin && country && origin.toLowerCase() !== country.toLowerCase()) {
      const key = `${origin}→${country}`;
      const existing = routeTally.get(key);
      if (existing) existing.intensity = (existing.intensity ?? 1) + 1;
      else routeTally.set(key, { from: origin, to: country, intensity: 1, mode: "air" });
    }
  }

  // One arrival node per country, placed at that country's warehouse city.
  const cities = placeCountryCities(byCountry, warehouses, (agg) => ({
    value: agg.count,
    valueLabel: formatDisplay(agg.value, { compact: true }),
    volume: `${formatUnits(agg.units)} units inbound`,
    movement: `${agg.count} incoming`,
    status: agg.delayed > 0 ? `${agg.delayed} delayed` : "in transit",
  }));

  const values: Record<string, number> = {};
  const tooltips: Record<string, ExecRow[]> = {};
  const sidePanel: Record<string, ExecRow[]> = {};
  for (const [country, agg] of byCountry) {
    values[country] = agg.count;
    tooltips[country] = [
      { label: "Incoming", value: `${formatUnits(agg.count)} shipments` },
      { label: "Value", value: formatDisplay(agg.value, { compact: true }) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Delayed", value: formatUnits(agg.delayed), tone: agg.delayed > 0 ? "bad" : undefined },
    ];
    sidePanel[country] = [
      { label: "Incoming shipments", value: formatUnits(agg.count) },
      { label: "Value", value: formatDisplay(agg.value) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Delayed", value: formatUnits(agg.delayed), tone: agg.delayed > 0 ? "bad" : "good" },
    ];
  }

  const routes = [...routeTally.values()].sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0)).slice(0, 40);

  return {
    values,
    tooltips,
    sidePanel,
    cities,
    routes,
    formatValue: (v) => `${formatUnits(v)} shipments`,
    position: {
      headline: "Incoming now",
      count: totalCount,
      countLabel: "Shipments",
      value: totalValue,
      units: totalUnits,
      chips: [
        { label: "In transit", value: formatUnits(totalCount) },
        { label: "Arrived (30d)", value: formatUnits(arrived), tone: "good" },
        { label: "Delayed", value: formatUnits(delayed), tone: delayed > 0 ? "bad" : undefined },
      ],
    },
  };
}

// ----------------------------------------------------------------------------
// INVENTORY — what we currently own (stock on hand by location).
// ----------------------------------------------------------------------------
export function buildInventoryLane(
  batches: ApiInventoryBatch[],
  warehouses: ApiWarehouseLocation[],
  shipments: ApiShipment[],
  now: Date = new Date(),
): ExecLane {
  const warehouseCountry = warehouseCountryMap(warehouses);

  // Reserved = quantity approved on outbound orders still in motion.
  const reservedByItem = new Map<string, number>();
  for (const shipment of shipments) {
    if (!SECONDARY_ACTIVE.has(norm(shipment.status).toLowerCase())) continue;
    for (const line of shipment.lines) {
      const key = `${line.item_code}|${line.batch_number}`.toLowerCase();
      reservedByItem.set(key, (reservedByItem.get(key) ?? 0) + (line.quantity_approved || line.quantity_requested || 0));
    }
  }

  type Agg = { value: number; units: number; reserved: number; expiring: number; expired: number; batches: number };
  const byCountry = new Map<string, Agg>();
  const byCity = new Map<string, { country: string; city: string; value: number; units: number; expiring: number }>();
  const ensure = (c: string): Agg => {
    if (!byCountry.has(c)) byCountry.set(c, { value: 0, units: 0, reserved: 0, expiring: 0, expired: 0, batches: 0 });
    return byCountry.get(c)!;
  };

  let totalValue = 0;
  let totalUnits = 0;
  let totalReserved = 0;
  let totalExpiring = 0;
  let totalExpired = 0;

  for (const batch of batches) {
    const qty = batch.quantity_available || 0;
    if (qty <= 0) continue;
    const value = convertAmount(batch.inventory_value || batch.unit_value * qty || 0, { from: batch.currency });
    const country = resolveCountry(batch.warehouse_location, warehouseCountry);
    const reserved = reservedByItem.get(`${batch.item_code}|${batch.batch_number}`.toLowerCase()) ?? 0;
    const expiring = batch.days_to_expiry != null && batch.days_to_expiry >= 0 && batch.days_to_expiry <= 90;
    const expired = batch.days_to_expiry != null && batch.days_to_expiry < 0;

    totalValue += value;
    totalUnits += qty;
    totalReserved += reserved;
    if (expiring) totalExpiring += 1;
    if (expired) totalExpired += 1;

    if (country) {
      const agg = ensure(country);
      agg.value += value;
      agg.units += qty;
      agg.reserved += reserved;
      agg.batches += 1;
      if (expiring) agg.expiring += 1;
      if (expired) agg.expired += 1;
    }

    const cityName = cityFromLabel(batch.warehouse_location || "");
    const coords = cityCoords(cityName);
    if (coords && country) {
      const key = `${country}|${cityName}`.toLowerCase();
      const slot = byCity.get(key) ?? { country, city: titleCase(cityName), value: 0, units: 0, expiring: 0 };
      slot.value += value;
      slot.units += qty;
      if (expiring) slot.expiring += 1;
      byCity.set(key, slot);
    }
  }

  const values: Record<string, number> = {};
  const tooltips: Record<string, ExecRow[]> = {};
  const sidePanel: Record<string, ExecRow[]> = {};
  for (const [country, agg] of byCountry) {
    const available = Math.max(0, agg.units - agg.reserved);
    values[country] = agg.value;
    tooltips[country] = [
      { label: "Inventory", value: formatDisplay(agg.value, { compact: true }) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Reserved", value: formatUnits(agg.reserved) },
      { label: "Available", value: formatUnits(available) },
      { label: "Expiring", value: formatUnits(agg.expiring), tone: agg.expiring > 0 ? "warn" : undefined },
    ];
    sidePanel[country] = [
      { label: "Inventory value", value: formatDisplay(agg.value) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Reserved", value: formatUnits(agg.reserved) },
      { label: "Available", value: formatUnits(available), tone: "good" },
      { label: "Expiring ≤90d", value: formatUnits(agg.expiring), tone: agg.expiring > 0 ? "warn" : "good" },
      { label: "Expired", value: formatUnits(agg.expired), tone: agg.expired > 0 ? "bad" : "good" },
    ];
  }

  const cities: MapCity[] = [];
  for (const slot of byCity.values()) {
    const coords = cityCoords(slot.city)!;
    cities.push({
      country: slot.country,
      city: slot.city,
      lon: coords[0],
      lat: coords[1],
      value: slot.value,
      valueLabel: formatDisplay(slot.value, { compact: true }),
      volume: `${formatUnits(slot.units)} units`,
      movement: "on hand",
      status: slot.expiring > 0 ? `${slot.expiring} expiring` : "healthy",
    });
  }

  const locations = byCity.size || byCountry.size;
  return {
    values,
    tooltips,
    sidePanel,
    cities,
    routes: [],
    formatValue: (v) => formatDisplay(v, { compact: true }),
    position: {
      headline: "Inventory now",
      count: locations,
      countLabel: "Locations",
      value: totalValue,
      units: totalUnits,
      chips: [
        { label: "Available", value: formatUnits(Math.max(0, totalUnits - totalReserved)), tone: "good" },
        { label: "Expiring ≤90d", value: formatUnits(totalExpiring), tone: totalExpiring > 0 ? "warn" : undefined },
        { label: "Expired", value: formatUnits(totalExpired), tone: totalExpired > 0 ? "bad" : undefined },
      ],
    },
  };
}

// ----------------------------------------------------------------------------
// SECONDARY — what is leaving the business (customer orders / deliveries).
// ----------------------------------------------------------------------------
export function buildSecondaryLane(
  shipments: ApiShipment[],
  customers: ApiCustomer[],
  batches: ApiInventoryBatch[],
  commitments: ApiCustomerCommitment[],
  now: Date = new Date(),
): ExecLane {
  const cutoff30 = daysAgo(30, now);

  const customerCity = new Map<string, string>();
  for (const c of customers) {
    if (c.city) customerCity.set(c.customer_name.trim().toLowerCase(), c.city);
  }
  const batchValue = new Map<string, { unit: number; currency: string | null }>();
  for (const b of batches) {
    batchValue.set(`${b.item_code}|${b.batch_number}`.toLowerCase(), { unit: b.unit_value, currency: b.currency });
  }

  type Agg = { orders: number; units: number; value: number; customers: Set<string>; delivered: number };
  const byCountry = new Map<string, Agg>();
  const byCity = new Map<string, { country: string; city: string; orders: number; units: number; value: number }>();
  const ensure = (c: string): Agg => {
    if (!byCountry.has(c)) byCountry.set(c, { orders: 0, units: 0, value: 0, customers: new Set(), delivered: 0 });
    return byCountry.get(c)!;
  };

  let totalOrders = 0;
  let totalUnits = 0;
  let totalValue = 0;
  let delivered = 0;
  const allCustomers = new Set<string>();

  for (const shipment of shipments) {
    const country = norm(shipment.destination_country);
    const status = norm(shipment.status).toLowerCase();
    const isActive = SECONDARY_ACTIVE.has(status);
    const reqDate = parseDate(shipment.required_delivery_date) ?? parseDate(shipment.request_date);

    if (status === "delivered" && reqDate && reqDate >= cutoff30) delivered += 1;
    if (!isActive || !country) continue;

    let units = 0;
    let value = 0;
    for (const line of shipment.lines) {
      const qty = line.quantity_approved || line.quantity_requested || 0;
      units += qty;
      const bv = batchValue.get(`${line.item_code}|${line.batch_number}`.toLowerCase());
      if (bv) value += convertAmount(bv.unit * qty, { from: bv.currency });
    }

    totalOrders += 1;
    totalUnits += units;
    totalValue += value;
    allCustomers.add(shipment.customer_name.trim().toLowerCase());

    const agg = ensure(country);
    agg.orders += 1;
    agg.units += units;
    agg.value += value;
    agg.customers.add(shipment.customer_name.trim().toLowerCase());

    const cityName = shipment.city || customerCity.get(shipment.customer_name.trim().toLowerCase()) || "";
    const coords = cityCoords(cityName);
    if (coords) {
      const key = `${country}|${cityName}`.toLowerCase();
      const slot = byCity.get(key) ?? { country, city: titleCase(cityName), orders: 0, units: 0, value: 0 };
      slot.orders += 1;
      slot.units += units;
      slot.value += value;
      byCity.set(key, slot);
    }
  }

  // Open commitments (not fully delivered) per country, for the side panel.
  const openCommitmentsByCountry = new Map<string, number>();
  let openCommitments = 0;
  for (const c of commitments) {
    const open = (c.ordered_quantity || 0) > (c.delivered_quantity || 0);
    if (!open) continue;
    openCommitments += 1;
    const country = norm(c.country);
    if (country) openCommitmentsByCountry.set(country, (openCommitmentsByCountry.get(country) ?? 0) + 1);
  }

  const values: Record<string, number> = {};
  const tooltips: Record<string, ExecRow[]> = {};
  const sidePanel: Record<string, ExecRow[]> = {};
  for (const [country, agg] of byCountry) {
    const open = openCommitmentsByCountry.get(country) ?? 0;
    values[country] = agg.orders;
    tooltips[country] = [
      { label: "Orders", value: formatUnits(agg.orders) },
      { label: "Value", value: formatDisplay(agg.value, { compact: true }) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Customers", value: formatUnits(agg.customers.size) },
    ];
    sidePanel[country] = [
      { label: "Orders in motion", value: formatUnits(agg.orders) },
      { label: "Value", value: formatDisplay(agg.value) },
      { label: "Units", value: formatUnits(agg.units) },
      { label: "Customers", value: formatUnits(agg.customers.size) },
      { label: "Open commitments", value: formatUnits(open), tone: open > 0 ? "warn" : "good" },
    ];
  }

  const cities: MapCity[] = [];
  for (const slot of byCity.values()) {
    const coords = cityCoords(slot.city)!;
    cities.push({
      country: slot.country,
      city: slot.city,
      lon: coords[0],
      lat: coords[1],
      value: slot.orders,
      valueLabel: formatDisplay(slot.value, { compact: true }),
      volume: `${formatUnits(slot.units)} units`,
      movement: `${slot.orders} orders`,
      status: "outbound",
    });
  }

  return {
    values,
    tooltips,
    sidePanel,
    cities,
    routes: [],
    formatValue: (v) => `${formatUnits(v)} orders`,
    position: {
      headline: "Outgoing now",
      count: totalOrders,
      countLabel: "Orders",
      value: totalValue,
      units: totalUnits,
      chips: [
        { label: "Customers", value: formatUnits(allCustomers.size) },
        { label: "Delivered (30d)", value: formatUnits(delivered), tone: "good" },
        { label: "Open commitments", value: formatUnits(openCommitments), tone: openCommitments > 0 ? "warn" : undefined },
      ],
    },
  };
}

// ---- shared helpers --------------------------------------------------------

function warehouseCountryMap(warehouses: ApiWarehouseLocation[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const w of warehouses) {
    if (w.warehouse_name) map.set(w.warehouse_name.trim().toLowerCase(), w.country);
    if (w.warehouse_code) map.set(w.warehouse_code.trim().toLowerCase(), w.country);
  }
  return map;
}

function resolveCountry(location: string | null | undefined, lookup: Map<string, string>): string {
  const key = norm(location).toLowerCase();
  if (!key) return "";
  if (lookup.has(key)) return lookup.get(key)!;
  // Loose contains match — warehouse labels vary ("Mumbai WH" vs "Mumbai").
  for (const [name, country] of lookup) {
    if (key.includes(name) || name.includes(key)) return country;
  }
  return "";
}

function placeCountryCities<T extends { value: number }>(
  byCountry: Map<string, T>,
  warehouses: ApiWarehouseLocation[],
  build: (agg: T) => { value: number; valueLabel?: string; volume?: string; movement?: string; status?: string },
): MapCity[] {
  const cities: MapCity[] = [];
  for (const [country, agg] of byCountry) {
    const wh = warehouses.find((w) => w.country.trim().toLowerCase() === country.trim().toLowerCase());
    const cityName = wh ? cityFromLabel(wh.warehouse_name) : country;
    const coords = cityCoords(cityName);
    if (!coords) continue;
    const meta = build(agg);
    cities.push({ country, city: titleCase(cityName), lon: coords[0], lat: coords[1], ...meta });
  }
  return cities;
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
