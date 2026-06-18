// Sample international business dataset (Phase 7B presentation layer).
//
// The user explicitly asked for representative sample data so the Overview's
// charts and visuals come alive, framed as a global medical-device distribution
// business: Meril India (the parent) supplies subsidiaries and distributors
// across Europe, the Middle East, the Americas and Asia-Pacific.
//
//   Primary Sales   — what is ENTERING the business  (India → subsidiary imports)
//   Inventory       — what we currently OWN          (stock held per market)
//   Secondary Sales — what is LEAVING the business   (subsidiary → customer sales)
//
// Everything here is clearly sample data (see SAMPLE_NOTICE) and is computed,
// not hardcoded into the real platform — values are aggregated, deltas and
// shares are calculated, and each chart carries a plain-language reading.
//
// Monetary values are held in INR (the platform base currency) so the live
// currency switcher converts them just like real figures.

import type { MapCity, MapRoute } from "../components/WorldMap";
import { formatMoney, formatUnits } from "./currency";
import type { LiveCategory, LiveEvent } from "./liveTicker";

export type LaneId = "primary" | "inventory" | "secondary";

export const SAMPLE_NOTICE = "Sample data";

const BASE = "INR";
const money = (value: number, compact = true): string => formatMoney(value, { from: BASE, compact });
const units = (value: number): string => formatUnits(value);

export type Tone = "good" | "warn" | "bad" | "neutral";

export type Kpi = {
  label: string;
  value: string;
  delta: number; // percent vs previous period; sign drives the arrow
  deltaLabel?: string; // overrides the "% vs last month" caption when set
  spark: number[];
  tone: Tone;
  hint: string;
};

export type SeriesPoint = { label: string; value: number; value2?: number };

export type RankRow = { label: string; sub?: string; value: number; display: string };

export type ExecChart = {
  title: string;
  caption: string;
};

export type TrendChart = ExecChart & {
  series: SeriesPoint[];
  format: (value: number) => string;
  legend: [string, string];
};

export type RankChart = ExecChart & { rows: RankRow[]; format: (value: number) => string };

export type DonutChartData = ExecChart & {
  slices: { label: string; value: number }[];
  format: (value: number) => string;
  centerLabel: string;
};

export type ExecChip = { label: string; value: string; tone?: Tone };

export type SampleLane = {
  headline: string;
  tag: string; // short summary shown on the mode toggle
  chips: ExecChip[];
  kpis: Kpi[];
  values: Record<string, number>;
  tooltips: Record<string, { label: string; value: string }[]>;
  sidePanel: Record<string, { label: string; value: string; tone?: "good" | "bad" | "warn" }[]>;
  cities: MapCity[];
  routes: MapRoute[];
  trend: TrendChart;
  ranking: RankChart;
  composition: DonutChartData;
  formatValue: (value: number) => string;
};

// ---- Deterministic helpers (stable across re-renders) -----------------------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A 12-point series that trends from `from` to `to` with light, stable noise. */
function series(seed: number, from: number, to: number, jitter = 0.05, length = 12): number[] {
  const next = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const t = length > 1 ? i / (length - 1) : 1;
    const base = from + (to - from) * t;
    const noise = (next() - 0.5) * 2 * jitter * base;
    out.push(Math.max(0, Math.round(base + noise)));
  }
  out[length - 1] = to; // land exactly on the headline number
  return out;
}

/** A simple trailing moving average, used as the interpretive overlay line. */
function movingAverage(input: number[], window = 4): number[] {
  return input.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = input.slice(start, index + 1);
    return Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  });
}

const WEEK_LABELS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"];

function trendFrom(values: number[], format: (value: number) => string, title: string, caption: string, overlay: string): TrendChart {
  const avg = movingAverage(values);
  return {
    title,
    caption,
    format,
    legend: ["This year", overlay],
    series: values.map((value, index) => ({ label: WEEK_LABELS[index] ?? `W${index + 1}`, value, value2: avg[index] })),
  };
}

// ---- Geography: one hub city per market (lon, lat) --------------------------

type Market = { country: string; city: string; lon: number; lat: number };

const MARKETS: Record<string, Market> = {
  Germany: { country: "Germany", city: "Frankfurt", lon: 8.68, lat: 50.11 },
  "United Arab Emirates": { country: "United Arab Emirates", city: "Dubai", lon: 55.27, lat: 25.2 },
  Italy: { country: "Italy", city: "Milan", lon: 9.19, lat: 45.46 },
  "United States of America": { country: "United States of America", city: "New York", lon: -74.0, lat: 40.71 },
  Brazil: { country: "Brazil", city: "São Paulo", lon: -46.63, lat: -23.55 },
  France: { country: "France", city: "Paris", lon: 2.35, lat: 48.86 },
  "Saudi Arabia": { country: "Saudi Arabia", city: "Riyadh", lon: 46.68, lat: 24.71 },
  Japan: { country: "Japan", city: "Tokyo", lon: 139.69, lat: 35.69 },
  Turkey: { country: "Turkey", city: "Istanbul", lon: 28.98, lat: 41.01 },
  "United Kingdom": { country: "United Kingdom", city: "London", lon: -0.13, lat: 51.51 },
  Poland: { country: "Poland", city: "Warsaw", lon: 21.01, lat: 52.23 },
  "South Africa": { country: "South Africa", city: "Johannesburg", lon: 28.05, lat: -26.2 },
};

const ORIGIN = "India";

const VERTICALS = ["Cardiology", "Vascular", "Orthopedics", "Endosurgery", "Diagnostics"];

const sum = (numbers: number[]): number => numbers.reduce((total, value) => total + value, 0);

// =============================================================================
// PRIMARY SALES — imports India → subsidiary (what is entering the business)
// =============================================================================

type PrimaryRow = {
  country: string;
  shipments: number;
  units: number;
  value: number;
  inTransit: number;
  customs: number;
  arrived: number;
  delayed: number;
  mode: "air" | "sea";
};

const PRIMARY_ROWS: PrimaryRow[] = [
  { country: "Germany", shipments: 14, units: 32000, value: 108_000_000, inTransit: 8, customs: 2, arrived: 3, delayed: 1, mode: "air" },
  { country: "United Arab Emirates", shipments: 11, units: 25000, value: 84_000_000, inTransit: 6, customs: 1, arrived: 3, delayed: 1, mode: "air" },
  { country: "United States of America", shipments: 8, units: 21000, value: 96_000_000, inTransit: 5, customs: 2, arrived: 1, delayed: 0, mode: "sea" },
  { country: "Italy", shipments: 9, units: 18500, value: 67_000_000, inTransit: 5, customs: 1, arrived: 3, delayed: 0, mode: "air" },
  { country: "Brazil", shipments: 7, units: 16000, value: 54_000_000, inTransit: 4, customs: 1, arrived: 1, delayed: 1, mode: "sea" },
  { country: "Saudi Arabia", shipments: 6, units: 14000, value: 47_000_000, inTransit: 4, customs: 1, arrived: 1, delayed: 0, mode: "air" },
  { country: "France", shipments: 6, units: 12000, value: 41_000_000, inTransit: 3, customs: 1, arrived: 2, delayed: 0, mode: "air" },
  { country: "Japan", shipments: 5, units: 9000, value: 38_000_000, inTransit: 3, customs: 1, arrived: 1, delayed: 0, mode: "air" },
  { country: "Turkey", shipments: 5, units: 11000, value: 33_000_000, inTransit: 3, customs: 0, arrived: 2, delayed: 0, mode: "air" },
  { country: "United Kingdom", shipments: 4, units: 8000, value: 29_000_000, inTransit: 2, customs: 1, arrived: 1, delayed: 0, mode: "air" },
];

function buildPrimary(): SampleLane {
  const totalShipments = sum(PRIMARY_ROWS.map((row) => row.shipments));
  const totalUnits = sum(PRIMARY_ROWS.map((row) => row.units));
  const totalValue = sum(PRIMARY_ROWS.map((row) => row.value));
  const totalDelayed = sum(PRIMARY_ROWS.map((row) => row.delayed));
  const totalInTransit = sum(PRIMARY_ROWS.map((row) => row.inTransit));
  const totalCustoms = sum(PRIMARY_ROWS.map((row) => row.customs));
  const totalArrived = sum(PRIMARY_ROWS.map((row) => row.arrived));

  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];
  const routes: MapRoute[] = [];

  for (const row of PRIMARY_ROWS) {
    const market = MARKETS[row.country];
    values[row.country] = row.value;
    tooltips[row.country] = [
      { label: "Incoming", value: `${row.shipments} shipments` },
      { label: "Value", value: money(row.value) },
      { label: "Units", value: units(row.units) },
      { label: "In transit", value: String(row.inTransit) },
      { label: "Customs", value: String(row.customs) },
      { label: "Delayed", value: String(row.delayed) },
    ];
    sidePanel[row.country] = [
      { label: "Inbound value", value: money(row.value) },
      { label: "Shipments", value: String(row.shipments) },
      { label: "In transit", value: String(row.inTransit) },
      { label: "At customs", value: String(row.customs), tone: row.customs > 1 ? "warn" : undefined },
      { label: "Arrived", value: String(row.arrived), tone: "good" },
      { label: "Delayed", value: String(row.delayed), tone: row.delayed > 0 ? "bad" : "good" },
    ];
    if (market) {
      cities.push({
        country: row.country,
        city: market.city,
        lon: market.lon,
        lat: market.lat,
        value: row.value,
        valueLabel: money(row.value),
        volume: `${units(row.units)} units`,
        movement: `${row.shipments} shipments inbound`,
        status: row.delayed > 0 ? "Delay" : "On track",
      });
      routes.push({ from: ORIGIN, to: row.country, intensity: Math.max(1, Math.round(row.shipments / 2)), mode: row.mode });
    }
  }

  const trend = trendFrom(
    series(11, Math.round(totalValue * 0.74), totalValue, 0.08),
    (value) => money(value),
    "Inbound value · last 12 weeks",
    `Up 12% over the quarter — Germany and the USA are driving most of the rise.`,
    "4-wk average",
  );

  const ranking: RankChart = {
    title: "Top inbound markets",
    caption: `Germany leads with ${money(PRIMARY_ROWS[0].value)} arriving — the top 3 markets are ${Math.round(
      (sum(PRIMARY_ROWS.slice(0, 3).map((r) => r.value)) / totalValue) * 100,
    )}% of inbound value.`,
    format: (value) => money(value),
    rows: [...PRIMARY_ROWS]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: `${row.shipments} shipments`, value: row.value, display: money(row.value) })),
  };

  const composition: DonutChartData = {
    title: "Shipments by status",
    caption: `${totalInTransit} of ${totalShipments} shipments are still in transit; ${totalCustoms} sit at customs and ${totalDelayed} are running late.`,
    format: (value) => `${Math.round(value)}`,
    centerLabel: "Shipments",
    slices: [
      { label: "In transit", value: totalInTransit },
      { label: "At customs", value: totalCustoms },
      { label: "Arrived", value: totalArrived },
      { label: "Delayed", value: totalDelayed },
    ],
  };

  return {
    headline: `${totalShipments} shipments inbound · ${money(totalValue)} in motion across ${PRIMARY_ROWS.length} markets`,
    tag: `${totalShipments} shipments · ${money(totalValue)}`,
    chips: [
      { label: "in transit", value: String(totalInTransit), tone: "neutral" },
      { label: "at customs", value: String(totalCustoms), tone: "warn" },
      { label: "delayed", value: String(totalDelayed), tone: totalDelayed > 0 ? "bad" : "good" },
    ],
    kpis: [
      {
        label: "Incoming shipments",
        value: String(totalShipments),
        delta: 9,
        spark: series(1, Math.round(totalShipments * 0.85), totalShipments, 0.12),
        tone: "good",
        hint: `${totalInTransit} in transit now; ${totalArrived} arrived this week.`,
      },
      {
        label: "Inbound value",
        value: money(totalValue),
        delta: 12,
        spark: series(2, Math.round(totalValue * 0.8), totalValue, 0.1),
        tone: "good",
        hint: "Germany and the USA lead inbound value.",
      },
      {
        label: "Units inbound",
        value: units(totalUnits),
        delta: 6,
        spark: series(3, Math.round(totalUnits * 0.9), totalUnits, 0.08),
        tone: "good",
        hint: `${units(totalUnits)} units heading to ${PRIMARY_ROWS.length} markets.`,
      },
      {
        label: "Delayed",
        value: String(totalDelayed),
        delta: -2,
        deltaLabel: "2 fewer than last week",
        spark: series(4, totalDelayed + 3, totalDelayed, 0.2),
        tone: totalDelayed > 0 ? "warn" : "good",
        hint: `${totalCustoms} are stuck at customs over 5 days — worth a push.`,
      },
    ],
    values,
    tooltips,
    sidePanel,
    cities,
    routes,
    trend,
    ranking,
    composition,
    formatValue: (value) => money(value),
  };
}

// =============================================================================
// INVENTORY — stock held per market (what we currently own)
// =============================================================================

type InventoryRow = {
  country: string;
  value: number;
  units: number;
  reserved: number;
  expiring: number; // units within 90 days
  expired: number;
  warehouses: number;
};

const INVENTORY_ROWS: InventoryRow[] = [
  { country: "Germany", value: 142_000_000, units: 48000, reserved: 12000, expiring: 3200, expired: 400, warehouses: 2 },
  { country: "United Arab Emirates", value: 98_000_000, units: 36000, reserved: 8000, expiring: 2600, expired: 150, warehouses: 1 },
  { country: "Italy", value: 76_000_000, units: 29000, reserved: 6400, expiring: 1800, expired: 90, warehouses: 1 },
  { country: "United States of America", value: 121_000_000, units: 33000, reserved: 9200, expiring: 1500, expired: 60, warehouses: 2 },
  { country: "Brazil", value: 64_000_000, units: 24000, reserved: 5200, expiring: 2100, expired: 320, warehouses: 1 },
  { country: "France", value: 58_000_000, units: 21000, reserved: 4100, expiring: 1200, expired: 70, warehouses: 1 },
  { country: "Saudi Arabia", value: 49_000_000, units: 18000, reserved: 3600, expiring: 900, expired: 40, warehouses: 1 },
  { country: "Japan", value: 41_000_000, units: 13000, reserved: 2800, expiring: 600, expired: 20, warehouses: 1 },
  { country: "Turkey", value: 36_000_000, units: 15000, reserved: 3000, expiring: 1100, expired: 130, warehouses: 1 },
  { country: "Poland", value: 28_000_000, units: 11000, reserved: 1900, expiring: 700, expired: 50, warehouses: 1 },
];

function buildInventory(): SampleLane {
  const totalValue = sum(INVENTORY_ROWS.map((row) => row.value));
  const totalUnits = sum(INVENTORY_ROWS.map((row) => row.units));
  const totalReserved = sum(INVENTORY_ROWS.map((row) => row.reserved));
  const totalExpiring = sum(INVENTORY_ROWS.map((row) => row.expiring));
  const totalExpired = sum(INVENTORY_ROWS.map((row) => row.expired));
  const totalAvailable = totalUnits - totalReserved;
  const availablePct = Math.round((totalAvailable / totalUnits) * 100);

  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];

  for (const row of INVENTORY_ROWS) {
    const market = MARKETS[row.country];
    const available = row.units - row.reserved;
    values[row.country] = row.value;
    tooltips[row.country] = [
      { label: "Stock value", value: money(row.value) },
      { label: "Units", value: units(row.units) },
      { label: "Available", value: units(available) },
      { label: "Reserved", value: units(row.reserved) },
      { label: "Expiring ≤90d", value: units(row.expiring) },
    ];
    sidePanel[row.country] = [
      { label: "Stock value", value: money(row.value) },
      { label: "Units on hand", value: units(row.units) },
      { label: "Available", value: units(available), tone: "good" },
      { label: "Reserved", value: units(row.reserved) },
      { label: "Expiring ≤90d", value: units(row.expiring), tone: row.expiring > 2000 ? "warn" : undefined },
      { label: "Expired", value: units(row.expired), tone: row.expired > 200 ? "bad" : undefined },
    ];
    if (market) {
      cities.push({
        country: row.country,
        city: market.city,
        lon: market.lon,
        lat: market.lat,
        value: row.value,
        valueLabel: money(row.value),
        volume: `${units(row.units)} units · ${row.warehouses} WH`,
        movement: `${units(available)} available`,
        status: row.expired > 200 ? "Expiry risk" : "Healthy",
      });
    }
  }

  const trend = trendFrom(
    series(21, Math.round(totalValue * 0.96), totalValue, 0.03),
    (value) => money(value),
    "Stock value · last 12 weeks",
    "Holding steady — up 3% as Germany and the USA restocked ahead of Q3 demand.",
    "4-wk average",
  );

  const ranking: RankChart = {
    title: "Stock by market",
    caption: `Germany holds the most at ${money(INVENTORY_ROWS[0].value)}; the top 3 markets carry ${Math.round(
      (sum([...INVENTORY_ROWS].sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.value)) / totalValue) * 100,
    )}% of total stock value.`,
    format: (value) => money(value),
    rows: [...INVENTORY_ROWS]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: `${units(row.units)} units`, value: row.value, display: money(row.value) })),
  };

  const composition: DonutChartData = {
    title: "Stock state (units)",
    caption: `${availablePct}% available to sell; ${units(totalReserved)} reserved to orders and ${units(totalExpiring)} expiring within 90 days.`,
    format: (value) => units(value),
    centerLabel: "Units",
    slices: [
      { label: "Available", value: totalAvailable },
      { label: "Reserved", value: totalReserved },
      { label: "Expiring ≤90d", value: totalExpiring },
      { label: "Expired", value: totalExpired },
    ],
  };

  return {
    headline: `${money(totalValue)} held · ${units(totalUnits)} units across ${INVENTORY_ROWS.length} markets`,
    tag: `${money(totalValue)} held`,
    chips: [
      { label: "available", value: `${availablePct}%`, tone: "good" },
      { label: "reserved", value: units(totalReserved), tone: "neutral" },
      { label: "expiring ≤90d", value: units(totalExpiring), tone: "warn" },
    ],
    kpis: [
      {
        label: "Stock value",
        value: money(totalValue),
        delta: 3,
        spark: series(11, Math.round(totalValue * 0.95), totalValue, 0.03),
        tone: "good",
        hint: "Stable cover heading into Q3.",
      },
      {
        label: "Units on hand",
        value: units(totalUnits),
        delta: 1,
        spark: series(12, Math.round(totalUnits * 0.98), totalUnits, 0.03),
        tone: "neutral",
        hint: `${units(totalAvailable)} available to sell right now.`,
      },
      {
        label: "Available",
        value: `${availablePct}%`,
        delta: -2,
        deltaLabel: "more reserved this week",
        spark: series(13, availablePct + 3, availablePct, 0.04),
        tone: "neutral",
        hint: `${units(totalReserved)} units committed to open orders.`,
      },
      {
        label: "Expiring ≤90d",
        value: units(totalExpiring),
        delta: 8,
        deltaLabel: "rising — act soon",
        spark: series(14, Math.round(totalExpiring * 0.8), totalExpiring, 0.1),
        tone: "warn",
        hint: "Prioritise Germany, UAE and Brazil to avoid write-offs.",
      },
    ],
    values,
    tooltips,
    sidePanel,
    cities,
    routes: [],
    trend,
    ranking,
    composition,
    formatValue: (value) => money(value),
  };
}

// =============================================================================
// SECONDARY SALES — subsidiary → customer (what is leaving the business)
// =============================================================================

type SecondaryRow = {
  country: string;
  revenue: number;
  orders: number;
  units: number;
  delivered: number;
  commitmentsOpen: number;
  topCustomer: string;
  mix: number[]; // revenue share across VERTICALS
};

const SECONDARY_ROWS: SecondaryRow[] = [
  { country: "Germany", revenue: 96_000_000, orders: 41, units: 28000, delivered: 33, commitmentsOpen: 6, topCustomer: "Charité Klinik", mix: [0.34, 0.22, 0.2, 0.14, 0.1] },
  { country: "United Arab Emirates", revenue: 71_000_000, orders: 33, units: 21000, delivered: 27, commitmentsOpen: 4, topCustomer: "NMC Healthcare", mix: [0.3, 0.26, 0.18, 0.16, 0.1] },
  { country: "Italy", revenue: 58_000_000, orders: 29, units: 17500, delivered: 24, commitmentsOpen: 3, topCustomer: "Humanitas", mix: [0.36, 0.2, 0.18, 0.16, 0.1] },
  { country: "United States of America", revenue: 84_000_000, orders: 26, units: 19000, delivered: 19, commitmentsOpen: 5, topCustomer: "Mercy Health", mix: [0.28, 0.24, 0.24, 0.14, 0.1] },
  { country: "Brazil", revenue: 47_000_000, orders: 24, units: 15000, delivered: 18, commitmentsOpen: 4, topCustomer: "Hospital Albert Einstein", mix: [0.3, 0.22, 0.2, 0.18, 0.1] },
  { country: "Saudi Arabia", revenue: 43_000_000, orders: 21, units: 12500, delivered: 16, commitmentsOpen: 3, topCustomer: "Dr. Sulaiman Al Habib", mix: [0.32, 0.24, 0.18, 0.16, 0.1] },
  { country: "France", revenue: 39_000_000, orders: 19, units: 11000, delivered: 15, commitmentsOpen: 2, topCustomer: "AP-HP Paris", mix: [0.34, 0.2, 0.2, 0.16, 0.1] },
  { country: "Turkey", revenue: 31_000_000, orders: 17, units: 9500, delivered: 13, commitmentsOpen: 2, topCustomer: "Acıbadem", mix: [0.3, 0.24, 0.2, 0.16, 0.1] },
  { country: "Japan", revenue: 34_000_000, orders: 14, units: 7800, delivered: 11, commitmentsOpen: 2, topCustomer: "St. Luke's Tokyo", mix: [0.26, 0.26, 0.22, 0.16, 0.1] },
  { country: "United Kingdom", revenue: 27_000_000, orders: 13, units: 6900, delivered: 10, commitmentsOpen: 1, topCustomer: "Guy's & St Thomas'", mix: [0.32, 0.2, 0.2, 0.18, 0.1] },
];

const SECONDARY_ROUTES: MapRoute[] = [
  { from: "Germany", to: "Poland", intensity: 2, mode: "air" },
  { from: "Germany", to: "France", intensity: 2, mode: "air" },
  { from: "United Arab Emirates", to: "Saudi Arabia", intensity: 3, mode: "air" },
  { from: "United States of America", to: "Brazil", intensity: 1, mode: "air" },
];

function buildSecondary(): SampleLane {
  const totalRevenue = sum(SECONDARY_ROWS.map((row) => row.revenue));
  const totalOrders = sum(SECONDARY_ROWS.map((row) => row.orders));
  const totalUnits = sum(SECONDARY_ROWS.map((row) => row.units));
  const totalDelivered = sum(SECONDARY_ROWS.map((row) => row.delivered));
  const totalCommitments = sum(SECONDARY_ROWS.map((row) => row.commitmentsOpen));
  const onTimePct = Math.round((totalDelivered / totalOrders) * 100);

  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];

  const verticalRevenue = VERTICALS.map(() => 0);
  for (const row of SECONDARY_ROWS) {
    const market = MARKETS[row.country];
    values[row.country] = row.revenue;
    row.mix.forEach((share, index) => {
      verticalRevenue[index] += row.revenue * share;
    });
    tooltips[row.country] = [
      { label: "Revenue", value: money(row.revenue) },
      { label: "Orders", value: String(row.orders) },
      { label: "Units", value: units(row.units) },
      { label: "Delivered", value: String(row.delivered) },
      { label: "Open POs", value: String(row.commitmentsOpen) },
    ];
    sidePanel[row.country] = [
      { label: "Revenue", value: money(row.revenue) },
      { label: "Orders", value: String(row.orders) },
      { label: "Delivered", value: String(row.delivered), tone: "good" },
      { label: "In progress", value: String(row.orders - row.delivered) },
      { label: "Open POs", value: String(row.commitmentsOpen), tone: row.commitmentsOpen > 4 ? "warn" : undefined },
      { label: "Top customer", value: row.topCustomer },
    ];
    if (market) {
      cities.push({
        country: row.country,
        city: market.city,
        lon: market.lon,
        lat: market.lat,
        value: row.revenue,
        valueLabel: money(row.revenue),
        volume: `${row.orders} orders · ${units(row.units)} units`,
        movement: `${row.delivered} delivered`,
        status: row.commitmentsOpen > 4 ? "POs open" : "On track",
      });
    }
  }

  const trend = trendFrom(
    series(31, Math.round(totalRevenue * 0.7), totalRevenue, 0.07),
    (value) => money(value),
    "Revenue out · last 12 weeks",
    "Up 14% — the strongest quarter yet, led by Germany, the USA and the UAE.",
    "4-wk average",
  );

  const ranking: RankChart = {
    title: "Top markets by revenue",
    caption: `Germany tops sales at ${money(SECONDARY_ROWS[0].revenue)}; ${SECONDARY_ROWS[0].topCustomer} is the single largest customer.`,
    format: (value) => money(value),
    rows: [...SECONDARY_ROWS]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: row.topCustomer, value: row.revenue, display: money(row.revenue) })),
  };

  const composition: DonutChartData = {
    title: "Revenue by vertical",
    caption: `Cardiology leads at ${Math.round((verticalRevenue[0] / totalRevenue) * 100)}% of revenue, with Vascular and Orthopedics close behind.`,
    format: (value) => money(value),
    centerLabel: "Revenue",
    slices: VERTICALS.map((label, index) => ({ label, value: Math.round(verticalRevenue[index]) })),
  };

  return {
    headline: `${money(totalRevenue)} sold · ${totalOrders} orders out across ${SECONDARY_ROWS.length} markets`,
    tag: `${money(totalRevenue)} out`,
    chips: [
      { label: "delivered", value: String(totalDelivered), tone: "good" },
      { label: "in progress", value: String(totalOrders - totalDelivered), tone: "neutral" },
      { label: "open POs", value: String(totalCommitments), tone: "warn" },
    ],
    kpis: [
      {
        label: "Revenue (MTD)",
        value: money(totalRevenue),
        delta: 14,
        spark: series(31, Math.round(totalRevenue * 0.78), totalRevenue, 0.07),
        tone: "good",
        hint: "Best month this year — Germany and the USA leading.",
      },
      {
        label: "Orders",
        value: String(totalOrders),
        delta: 8,
        spark: series(32, Math.round(totalOrders * 0.85), totalOrders, 0.1),
        tone: "good",
        hint: `${totalDelivered} delivered, ${totalOrders - totalDelivered} in progress.`,
      },
      {
        label: "Units shipped",
        value: units(totalUnits),
        delta: 7,
        spark: series(33, Math.round(totalUnits * 0.88), totalUnits, 0.08),
        tone: "good",
        hint: `On-time delivery running at ${onTimePct}%.`,
      },
      {
        label: "Open commitments",
        value: String(totalCommitments),
        delta: 4,
        deltaLabel: "due within 15 days",
        spark: series(34, totalCommitments + 2, totalCommitments, 0.15),
        tone: "warn",
        hint: "Several large POs need allocation to ship on time.",
      },
    ],
    values,
    tooltips,
    sidePanel,
    cities,
    routes: SECONDARY_ROUTES,
    trend,
    ranking,
    composition,
    formatValue: (value) => money(value),
  };
}

const BUILDERS: Record<LaneId, () => SampleLane> = {
  primary: buildPrimary,
  inventory: buildInventory,
  secondary: buildSecondary,
};

/** Build the full sample lane (map + KPIs + charts) for the chosen mode. The
 *  `rev` argument is the currency revision — pass it so the figures re-format
 *  when the display currency changes (the value itself is recomputed). */
export function buildSampleLane(lane: LaneId, _rev = 0): SampleLane {
  void _rev;
  return BUILDERS[lane]();
}

// =============================================================================
// Live event stream — a continuous, business-wide pulse for ticker + feed
// =============================================================================

type EventSeed = { category: LiveCategory; text: string; actor?: string };

const EVENT_SEEDS: EventSeed[] = [
  { category: "primary", text: "Shipment GERMANY-CARDIO-0412 landed at Frankfurt — 2,400 units", actor: "DHL Air" },
  { category: "primary", text: "UAE-VASCULAR-0388 cleared customs at Dubai", actor: "Customs DXB" },
  { category: "primary", text: "USA-ORTHO-0221 departed Mumbai by sea freight", actor: "Maersk" },
  { category: "primary", text: "ITALY-ENDO-0356 arrived at Milan distribution hub", actor: "Operations" },
  { category: "primary", text: "BRAZIL-CARDIO-0190 flagged delayed — ETA slipped 2 days", actor: "Control Tower" },
  { category: "inventory", text: "12,400 units received into Frankfurt warehouse", actor: "WH Frankfurt" },
  { category: "inventory", text: "Reserved 3,200 units in Dubai against open orders", actor: "Allocation" },
  { category: "inventory", text: "Expiry watch: 2,100 units in São Paulo within 90 days", actor: "Quality" },
  { category: "inventory", text: "Stock count completed at New York DC — variance 0.3%", actor: "WH New York" },
  { category: "secondary", text: "Customer PO received — Charité Klinik, 1,800 units", actor: "Sales DE" },
  { category: "secondary", text: "Order ITALY-0934 delivered to Humanitas", actor: "Logistics IT" },
  { category: "secondary", text: "NMC Healthcare commitment confirmed for Q3", actor: "Sales AE" },
  { category: "secondary", text: "Mercy Health order dispatched from New York", actor: "Logistics US" },
  { category: "finance", text: "Payment received — €420,000 from AP-HP Paris", actor: "Finance" },
  { category: "finance", text: "Invoice raised for Acıbadem — ₹2.4 Cr", actor: "Finance" },
  { category: "finance", text: "FX rate locked for the day — EUR/INR reference set", actor: "Treasury" },
  { category: "system", text: "Import approval completed for GERMANY-CARDIO-0412", actor: "K. Rao" },
  { category: "system", text: "Country review signed off — UAE", actor: "Regional Mgr" },
  { category: "system", text: "Decision recorded: expedite Brazil restock", actor: "GM" },
  { category: "primary", text: "SAUDI-DIAG-0277 booked on next Riyadh flight", actor: "Sales SA" },
  { category: "secondary", text: "Open PO escalated — Dr. Sulaiman Al Habib, due in 15 days", actor: "Sales SA" },
  { category: "inventory", text: "Consignment replenished at Tokyo partner site", actor: "WH Tokyo" },
  { category: "primary", text: "FRANCE-VASCULAR-0301 cleared customs at Paris", actor: "Customs CDG" },
  { category: "secondary", text: "Order delivered to Guy's & St Thomas', London", actor: "Logistics UK" },
];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** A business-wide stream of recent events. Timestamps are spread back from now
 *  so the feed reads as "the last couple of hours of trading". */
export function buildSampleEvents(): LiveEvent[] {
  const now = Date.now();
  return EVENT_SEEDS.map((seed, index) => {
    const at = new Date(now - index * 7 * 60 * 1000 - (index % 3) * 90 * 1000);
    return {
      id: `sample-${index}`,
      at,
      time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
      category: seed.category,
      text: seed.text,
      actor: seed.actor ?? null,
    };
  });
}
