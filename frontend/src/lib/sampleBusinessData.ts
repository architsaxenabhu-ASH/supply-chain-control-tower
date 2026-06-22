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

import type { GeoRoute, MapCity, MapRoute } from "../components/WorldMap";
import { citiesForCountry } from "./cityGeo";
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
  /** Short name of the visualization technique, shown as a chip on the chart. */
  concept: string;
  /** Plain-language "what this is / how to read it", shown on hover. */
  technique: string;
};

// A signature motion scene per mode (Phase 7C). Not a chart — a live, themed
// animation (air freight / working warehouse / delivery truck) that makes the
// mode's activity feel real. Driven by the lane's own figures.
export type SceneKind = "air" | "warehouse" | "truck";
export type SceneStat = { label: string; value: string };
export type SceneSpec = {
  kind: SceneKind;
  concept: string; // headline name, e.g. "Air-freight inbound"
  technique: string; // what the animation represents / how it is built
  caption: string; // one-line plain-language reading
  stats: SceneStat[]; // 2–3 live figures shown over the scene
  intensity: number; // 1–5: drives how many units move and how fast
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
  geoRoutes: GeoRoute[]; // precise city-level arcs (secondary = hub → other cities)
  trend: TrendChart;
  ranking: RankChart;
  composition: DonutChartData;
  scene: SceneSpec;
  formatValue: (value: number) => string;
};

/** Map a raw figure onto a 1–5 intensity used to pace the scene animations. */
const scaleIntensity = (value: number, lo: number, hi: number): number =>
  Math.max(1, Math.min(5, Math.round(1 + ((value - lo) / Math.max(1, hi - lo)) * 4)));

/** Grow the numeric fields of each row by factor `g` (rounded). Used so that
 *  "Add Sample Data" (boost) and the demo pulse (tick) visibly lift the Overview
 *  figures, exactly like the Executive Summary, instead of sitting static. */
function growBy<T extends Record<string, unknown>>(rows: T[], g: number, keys: (keyof T)[]): T[] {
  if (!g || g === 1) return rows;
  return rows.map((row) => {
    const next = { ...row } as Record<string, unknown>;
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number") next[key as string] = Math.round(value * g);
    }
    return next as T;
  });
}

/** The growth multiplier shared by the Overview lanes and the Executive Summary:
 *  each injection lifts the business ~5%, the demo pulse adds a ≤3% drift. */
function growthFactor(boost: number, tick: number): number {
  return 1 + boost * 0.05 + ((tick % 12) / 12) * 0.03;
}

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
    concept: "Area + moving average",
    technique:
      "Layered area chart. The filled band is each week's figure; the dashed line is a 4-week moving average that smooths the noise, so a one-off spike doesn't read as a real trend.",
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

// ---- Expansion markets: new countries that "enter" the network on inject -----
// Markets that are NOT part of the base picture. They only appear once the
// presenter adds sample data, and reveal one-by-one (a fresh country per click),
// so the board literally sees new countries joining the network live.

export type InjectedMarket = {
  country: string;
  city: string;
  lon: number;
  lat: number;
  region: string;
  value: number;
  units: number;
  flows: number;
};

export const EXPANSION_MARKETS: { country: string; city: string; lon: number; lat: number; region: string }[] = [
  { country: "Spain", city: "Madrid", lon: -3.7, lat: 40.42, region: "Europe" },
  { country: "Mexico", city: "Mexico City", lon: -99.13, lat: 19.43, region: "Latin America" },
  { country: "Australia", city: "Sydney", lon: 151.21, lat: -33.87, region: "Asia & Australia" },
  { country: "Egypt", city: "Cairo", lon: 31.24, lat: 30.04, region: "Africa" },
  { country: "Indonesia", city: "Jakarta", lon: 106.85, lat: -6.21, region: "Asia & Australia" },
  { country: "Canada", city: "Toronto", lon: -79.38, lat: 43.65, region: "North America" },
  { country: "Netherlands", city: "Amsterdam", lon: 4.9041, lat: 52.3676, region: "Europe" },
  { country: "South Africa", city: "Johannesburg", lon: 28.0473, lat: -26.2041, region: "Africa" },
  { country: "South Korea", city: "Seoul", lon: 126.978, lat: 37.5665, region: "Asia & Australia" },
  { country: "Singapore", city: "Singapore", lon: 103.8198, lat: 1.3521, region: "Asia & Australia" },
  { country: "China", city: "Shanghai", lon: 121.4737, lat: 31.2304, region: "Asia & Australia" },
  { country: "Argentina", city: "Buenos Aires", lon: -58.3816, lat: -34.6037, region: "Latin America" },
  { country: "Nigeria", city: "Lagos", lon: 3.3792, lat: 6.5244, region: "Africa" },
  { country: "Kenya", city: "Nairobi", lon: 36.8219, lat: -1.2921, region: "Africa" },
];

// Provider indirection (same no-cycle pattern as the API inject providers): the
// demo store registers the live set of injected markets; the map builders read it.
let injectedMarketProvider: () => InjectedMarket[] = () => [];
export function registerMarketProvider(fn: () => InjectedMarket[]): void {
  injectedMarketProvider = fn;
}

// ---- Presentation ledger: the business grows from zero ----------------------
// When the presenter runs a live walkthrough, the whole business starts at zero
// and grows by clicks: each "Primary Sales +" brings goods IN (inbound + stock
// rise); each "Secondary Sales +" sells goods OUT (revenue rises while stock and
// active shipments fall). Inventory is always Primary − Secondary. The figures
// are a pure function of the two counters, so every device shows the same thing.

export type LedgerState = { active: boolean; primaryClicks: number; secondaryClicks: number };
let ledgerProvider: () => LedgerState = () => ({ active: false, primaryClicks: 0, secondaryClicks: 0 });
export function registerLedgerProvider(fn: () => LedgerState): void {
  ledgerProvider = fn;
}
// Each click ≈ 16% of the reference baseline, so ~6 clicks fills a market out.
const LEDGER_STEP = 0.16;

/** Paint the injected expansion markets onto a lane / network map: a choropleth
 *  value, a hover tooltip + side panel, a glowing city node and an India → market
 *  route (when the map shows routes). Called by every map builder, so a freshly
 *  injected country lights up everywhere at once. */
function mergeInjectedMarkets(
  values: Record<string, number>,
  tooltips: SampleLane["tooltips"],
  sidePanel: SampleLane["sidePanel"],
  cities: MapCity[],
  routes: MapRoute[] | null,
  fmt: (value: number) => string,
): void {
  for (const market of injectedMarketProvider()) {
    values[market.country] = (values[market.country] ?? 0) + market.value;
    tooltips[market.country] = [
      { label: "New market", value: market.country },
      { label: "Value", value: fmt(market.value) },
      { label: "Units", value: units(market.units) },
      { label: "Active flows", value: String(market.flows) },
    ];
    sidePanel[market.country] = [
      { label: "Status", value: "New market — just entered" },
      { label: "Region", value: market.region },
      { label: "Network value", value: fmt(market.value), tone: "good" },
      { label: "Units in motion", value: units(market.units) },
      { label: "Active flows", value: String(market.flows) },
    ];
    cities.push({
      country: market.country,
      city: market.city,
      lon: market.lon,
      lat: market.lat,
      value: market.value,
      valueLabel: fmt(market.value),
      volume: `${units(market.units)} units`,
      movement: `${market.flows} flows in`,
      status: "New market",
    });
    if (routes) routes.push({ from: ORIGIN, to: market.country, intensity: 2, mode: "air" });
  }
}

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

const PRIMARY_ROWS_BASE: PrimaryRow[] = [
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

function buildPrimary(g = 1): SampleLane {
  const ledger = activeLedgerRows();
  const PRIMARY_ROWS = ledger
    ? ledger.primary
    : growBy(PRIMARY_ROWS_BASE, g, ["shipments", "units", "value", "inTransit", "customs", "arrived", "delayed"]);
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
  const geoRoutes: GeoRoute[] = []; // primary uses country-level routes above

  for (const row of PRIMARY_ROWS) {
    const market = MARKETS[row.country];
    // No activity (e.g. right after "Start at zero") → the country is not on the
    // map at all: no value, no node, and no animated route. Movement only ever
    // shows where shipments are actually moving.
    if (row.value <= 0 && row.shipments <= 0) continue;
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

  // Light up any markets the presenter has injected (new countries entering).
  mergeInjectedMarkets(values, tooltips, sidePanel, cities, routes, money);

  const trend = trendFrom(
    series(11, Math.round(totalValue * 0.74), totalValue, 0.08),
    (value) => money(value),
    "Inbound value · last 12 weeks",
    `Up 12% over the quarter — Germany and the USA are driving most of the rise.`,
    "4-wk average",
  );

  const ranking: RankChart = {
    title: "Top inbound markets",
    caption: `Germany leads with ${money(PRIMARY_ROWS[0].value)} arriving — the top 3 markets are ${
      totalValue > 0 ? Math.round((sum(PRIMARY_ROWS.slice(0, 3).map((r) => r.value)) / totalValue) * 100) : 0
    }% of inbound value.`,
    concept: "Ranked bars",
    technique:
      "Horizontal bar ranking. Every market is sized against the leader and sorted high-to-low, so the biggest sources of inbound value stand out immediately.",
    format: (value) => money(value),
    rows: [...PRIMARY_ROWS]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: `${row.shipments} shipments`, value: row.value, display: money(row.value) })),
  };

  const composition: DonutChartData = {
    title: "Shipments by status",
    caption: `${totalInTransit} of ${totalShipments} shipments are still in transit; ${totalCustoms} sit at customs and ${totalDelayed} are running late.`,
    concept: "Donut (part-to-whole)",
    technique:
      "Donut chart. The whole ring is every inbound shipment (100%); each arc is one status's share, so you can see the mix at a glance without reading numbers.",
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
    geoRoutes,
    trend,
    ranking,
    composition,
    scene: {
      kind: "air",
      concept: "Air-freight inbound",
      technique:
        "A live motion scene (not a chart): each cargo plane stands for inbound air freight leaving India for a market. Plane count and speed scale with how many shipments are in transit right now.",
      caption: `${totalInTransit} shipments in the air · India → ${PRIMARY_ROWS.length} markets`,
      stats: [
        { label: "in transit", value: String(totalInTransit) },
        { label: "units inbound", value: units(totalUnits) },
        { label: "inbound value", value: money(totalValue) },
      ],
      intensity: scaleIntensity(totalInTransit, 10, 50),
    },
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

const INVENTORY_ROWS_BASE: InventoryRow[] = [
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

function buildInventory(g = 1): SampleLane {
  const ledger = activeLedgerRows();
  const INVENTORY_ROWS = ledger
    ? ledger.inventory
    : growBy(INVENTORY_ROWS_BASE, g, ["value", "units", "reserved", "expiring", "expired"]);
  const totalValue = sum(INVENTORY_ROWS.map((row) => row.value));
  const totalUnits = sum(INVENTORY_ROWS.map((row) => row.units));
  const totalReserved = sum(INVENTORY_ROWS.map((row) => row.reserved));
  const totalExpiring = sum(INVENTORY_ROWS.map((row) => row.expiring));
  const totalExpired = sum(INVENTORY_ROWS.map((row) => row.expired));
  const totalAvailable = totalUnits - totalReserved;
  const availablePct = totalUnits > 0 ? Math.round((totalAvailable / totalUnits) * 100) : 0;

  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];

  for (const row of INVENTORY_ROWS) {
    const market = MARKETS[row.country];
    if (row.value <= 0 && row.units <= 0) continue; // no stock → not on the map
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

  // Light up any markets the presenter has injected (new countries entering).
  mergeInjectedMarkets(values, tooltips, sidePanel, cities, null, money);

  const trend = trendFrom(
    series(21, Math.round(totalValue * 0.96), totalValue, 0.03),
    (value) => money(value),
    "Stock value · last 12 weeks",
    "Holding steady — up 3% as Germany and the USA restocked ahead of Q3 demand.",
    "4-wk average",
  );

  const ranking: RankChart = {
    title: "Stock by market",
    caption: `Germany holds the most at ${money(INVENTORY_ROWS[0].value)}; the top 3 markets carry ${
      totalValue > 0
        ? Math.round((sum([...INVENTORY_ROWS].sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.value)) / totalValue) * 100)
        : 0
    }% of total stock value.`,
    concept: "Ranked bars",
    technique:
      "Horizontal bar ranking. Each market's stock value is sized against the largest holding and sorted high-to-low, so you can see where capital is tied up.",
    format: (value) => money(value),
    rows: [...INVENTORY_ROWS]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: `${units(row.units)} units`, value: row.value, display: money(row.value) })),
  };

  const composition: DonutChartData = {
    title: "Stock state (units)",
    caption: `${availablePct}% available to sell; ${units(totalReserved)} reserved to orders and ${units(totalExpiring)} expiring within 90 days.`,
    concept: "Donut (part-to-whole)",
    technique:
      "Donut chart. The full ring is all stock on hand; each arc is a state — available, reserved, expiring or expired — so the health of inventory reads at a glance.",
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
    geoRoutes: [],
    trend,
    ranking,
    composition,
    scene: {
      kind: "warehouse",
      concept: "Working warehouse",
      technique:
        "A 3-D warehouse diorama (not a chart): racks hold stock while a forklift and a conveyor keep moving, standing for the network's live put-away and picking. The motion never stops because stock is always being handled.",
      caption: `${units(totalAvailable)} available · ${units(totalUnits)} units on hand`,
      stats: [
        { label: "units on hand", value: units(totalUnits) },
        { label: "available", value: units(totalAvailable) },
        { label: "expiring ≤90d", value: units(totalExpiring) },
      ],
      intensity: scaleIntensity(sum(INVENTORY_ROWS.map((row) => row.warehouses)), 8, 16),
    },
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

const SECONDARY_ROWS_BASE: SecondaryRow[] = [
  { country: "Germany", revenue: 96_000_000, orders: 41, units: 28000, delivered: 33, commitmentsOpen: 6, topCustomer: "Berlin Mitte Klinikum", mix: [0.34, 0.22, 0.2, 0.14, 0.1] },
  { country: "United Arab Emirates", revenue: 71_000_000, orders: 33, units: 21000, delivered: 27, commitmentsOpen: 4, topCustomer: "Gulf Medical Centre", mix: [0.3, 0.26, 0.18, 0.16, 0.1] },
  { country: "Italy", revenue: 58_000_000, orders: 29, units: 17500, delivered: 24, commitmentsOpen: 3, topCustomer: "Milano Salute", mix: [0.36, 0.2, 0.18, 0.16, 0.1] },
  { country: "United States of America", revenue: 84_000_000, orders: 26, units: 19000, delivered: 19, commitmentsOpen: 5, topCustomer: "Hudson Health Network", mix: [0.28, 0.24, 0.24, 0.14, 0.1] },
  { country: "Brazil", revenue: 47_000_000, orders: 24, units: 15000, delivered: 18, commitmentsOpen: 4, topCustomer: "São Paulo Saúde", mix: [0.3, 0.22, 0.2, 0.18, 0.1] },
  { country: "Saudi Arabia", revenue: 43_000_000, orders: 21, units: 12500, delivered: 16, commitmentsOpen: 3, topCustomer: "Riyadh Medical Group", mix: [0.32, 0.24, 0.18, 0.16, 0.1] },
  { country: "France", revenue: 39_000_000, orders: 19, units: 11000, delivered: 15, commitmentsOpen: 2, topCustomer: "Paris Santé", mix: [0.34, 0.2, 0.2, 0.16, 0.1] },
  { country: "Turkey", revenue: 31_000_000, orders: 17, units: 9500, delivered: 13, commitmentsOpen: 2, topCustomer: "Bosphorus Health Group", mix: [0.3, 0.24, 0.2, 0.16, 0.1] },
  { country: "Japan", revenue: 34_000_000, orders: 14, units: 7800, delivered: 11, commitmentsOpen: 2, topCustomer: "Tokyo Bay Medical", mix: [0.26, 0.26, 0.22, 0.16, 0.1] },
  { country: "United Kingdom", revenue: 27_000_000, orders: 13, units: 6900, delivered: 10, commitmentsOpen: 1, topCustomer: "Thames Health Trust", mix: [0.32, 0.2, 0.2, 0.18, 0.1] },
];

function buildSecondary(g = 1): SampleLane {
  const ledger = activeLedgerRows();
  const SECONDARY_ROWS = ledger
    ? ledger.secondary
    : growBy(SECONDARY_ROWS_BASE, g, ["revenue", "orders", "units", "delivered", "commitmentsOpen"]);
  const totalRevenue = sum(SECONDARY_ROWS.map((row) => row.revenue));
  const totalOrders = sum(SECONDARY_ROWS.map((row) => row.orders));
  const totalUnits = sum(SECONDARY_ROWS.map((row) => row.units));
  const totalDelivered = sum(SECONDARY_ROWS.map((row) => row.delivered));
  const totalCommitments = sum(SECONDARY_ROWS.map((row) => row.commitmentsOpen));
  const onTimePct = totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0;

  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];
  const routes: MapRoute[] = [];
  // Secondary is intra-country: from the delivery hub (where primary lands) out
  // to the other major cities of the SAME country — never country-to-country.
  const geoRoutes: GeoRoute[] = [];
  for (const row of SECONDARY_ROWS) {
    if (row.orders <= 0) continue;
    const geo = citiesForCountry(row.country);
    if (!geo) continue;
    const hub: [number, number] = [geo.hub.lon, geo.hub.lat];
    const intensity = Math.max(1, Math.min(4, Math.round(row.orders / 5)));
    for (const c of geo.others.slice(0, 3)) {
      geoRoutes.push({ from: hub, to: [c.lon, c.lat], mode: "road", intensity });
    }
  }

  const verticalRevenue = VERTICALS.map(() => 0);
  for (const row of SECONDARY_ROWS) {
    const market = MARKETS[row.country];
    if (row.revenue <= 0 && row.orders <= 0) continue; // no sales → not on the map
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

  // Light up any markets the presenter has injected (new countries entering).
  mergeInjectedMarkets(values, tooltips, sidePanel, cities, routes, money);

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
    concept: "Ranked bars",
    technique:
      "Horizontal bar ranking. Markets are sized by revenue and sorted high-to-low, each tagged with its single largest customer, so the commercial engine is visible at a glance.",
    format: (value) => money(value),
    rows: [...SECONDARY_ROWS]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((row) => ({ label: row.country, sub: row.topCustomer, value: row.revenue, display: money(row.revenue) })),
  };

  const composition: DonutChartData = {
    title: "Revenue by vertical",
    caption: `Cardiology leads at ${totalRevenue > 0 ? Math.round((verticalRevenue[0] / totalRevenue) * 100) : 0}% of revenue, with Vascular and Orthopedics close behind.`,
    concept: "Donut (part-to-whole)",
    technique:
      "Donut chart. The full ring is total revenue; each arc is a clinical vertical's share, so you can see which product lines are carrying sales.",
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
    routes,
    geoRoutes,
    trend,
    ranking,
    composition,
    scene: {
      kind: "truck",
      concept: "Last-mile dispatch",
      technique:
        "A delivery truck in motion (not a chart): the road speed and wheel spin scale with how many orders are going out. Each run stands for live customer dispatches leaving the subsidiary.",
      caption: `${totalDelivered} delivered of ${totalOrders} orders · ${onTimePct}% on time`,
      stats: [
        { label: "orders out", value: String(totalOrders) },
        { label: "delivered", value: String(totalDelivered) },
        { label: "revenue", value: money(totalRevenue) },
      ],
      intensity: scaleIntensity(totalOrders, 100, 300),
    },
    formatValue: (value) => money(value),
  };
}

// Synthesize the three lanes from the two presentation counters. Primary and
// Secondary share the same destination markets (all outside India — India is the
// source, so it only features in Primary). Inventory is derived: what came in
// minus what was sold, so it can go DOWN as Secondary Sales grow.
type LedgerRows = { primary: PrimaryRow[]; inventory: InventoryRow[]; secondary: SecondaryRow[] };

function buildLedgerRows(primaryClicks: number, secondaryClicks: number): LedgerRows {
  const pf = Math.max(0, primaryClicks) * LEDGER_STEP;
  const sf = Math.max(0, secondaryClicks) * LEDGER_STEP;
  const secBy = new Map(SECONDARY_ROWS_BASE.map((row) => [row.country, row]));
  const primary: PrimaryRow[] = [];
  const inventory: InventoryRow[] = [];
  const secondary: SecondaryRow[] = [];

  for (const base of PRIMARY_ROWS_BASE) {
    const s = secBy.get(base.country);
    // Goods coming IN (Primary Sales).
    const pShip = Math.round(base.shipments * pf);
    const pUnits = Math.round(base.units * pf);
    const pValue = Math.round(base.value * pf);
    // Goods sold OUT (Secondary Sales) — never more than what has come in.
    const wantUnits = Math.round((s?.units ?? base.units * 0.85) * sf);
    const soldUnits = Math.min(pUnits, wantUnits);
    const fillRatio = wantUnits > 0 ? soldUnits / wantUnits : 0;
    const revenue = Math.round((s?.revenue ?? base.value * 0.82) * sf * fillRatio);
    const orders = Math.round((s?.orders ?? Math.round(base.shipments * 2)) * sf * fillRatio);
    const delivered = Math.round(orders * 0.72);
    const openPOs = soldUnits > 0 ? Math.max(0, Math.round((s?.commitmentsOpen ?? 2) * Math.min(1, sf))) : 0;
    // Inventory = in − out (units and value both fall as sales grow).
    const invUnits = Math.max(0, pUnits - soldUnits);
    const unitCost = pUnits > 0 ? pValue / pUnits : 0;
    const invValue = Math.max(0, Math.round(pValue - soldUnits * unitCost));
    const reserved = Math.round(invUnits * 0.22);
    const expiring = Math.round(invUnits * 0.06);
    const expired = Math.round(invUnits * 0.004);
    // Active in-transit shipments fall as deliveries complete.
    const inTransit = Math.max(0, pShip - delivered);
    const customs = Math.min(inTransit, base.customs);
    const arrived = Math.max(0, pShip - inTransit);
    const delayed = inTransit > 0 ? base.delayed : 0;

    primary.push({ country: base.country, shipments: pShip, units: pUnits, value: pValue, inTransit, customs, arrived, delayed, mode: base.mode });
    inventory.push({ country: base.country, value: invValue, units: invUnits, reserved, expiring, expired, warehouses: 1 });
    secondary.push({
      country: base.country,
      revenue,
      orders,
      units: soldUnits,
      delivered,
      commitmentsOpen: openPOs,
      topCustomer: s?.topCustomer ?? base.country,
      mix: s?.mix ?? [0.3, 0.22, 0.2, 0.18, 0.1],
    });
  }
  return { primary, inventory, secondary };
}

/** The ledger rows for the current presentation, or null when not presenting
 *  (so normal browsing keeps the full static sample). */
function activeLedgerRows(): LedgerRows | null {
  const led = ledgerProvider();
  return led.active ? buildLedgerRows(led.primaryClicks, led.secondaryClicks) : null;
}

const BUILDERS: Record<LaneId, (g: number) => SampleLane> = {
  primary: buildPrimary,
  inventory: buildInventory,
  secondary: buildSecondary,
};

/** Build the full sample lane (map + KPIs + charts) for the chosen mode. `_rev`
 *  is the currency revision (so figures re-format on a currency switch); `boost`
 *  and `tick` lift the figures as the presenter injects sample data / the demo
 *  pulses, so the live Overview grows just like the Executive Summary. */
export function buildSampleLane(lane: LaneId, _rev = 0, boost = 0, tick = 0): SampleLane {
  void _rev;
  return BUILDERS[lane](growthFactor(boost, tick));
}

// =============================================================================
// Live event stream — a continuous, business-wide pulse for ticker + feed
// =============================================================================

type EventSeed = { category: LiveCategory; text: string; actor?: string };

const EVENT_SEEDS: EventSeed[] = [
  { category: "primary", text: "Shipment GERMANY-CARDIO-0412 landed at Frankfurt — 2,400 units", actor: "Skyline Air Cargo" },
  { category: "primary", text: "UAE-VASCULAR-0388 cleared customs at Dubai", actor: "Customs DXB" },
  { category: "primary", text: "USA-ORTHO-0221 departed Mumbai by sea freight", actor: "Atlantic Sea Lines" },
  { category: "primary", text: "ITALY-ENDO-0356 arrived at Milan distribution hub", actor: "Operations" },
  { category: "primary", text: "BRAZIL-CARDIO-0190 flagged delayed — ETA slipped 2 days", actor: "Control Tower" },
  { category: "inventory", text: "12,400 units received into Frankfurt warehouse", actor: "WH Frankfurt" },
  { category: "inventory", text: "Reserved 3,200 units in Dubai against open orders", actor: "Allocation" },
  { category: "inventory", text: "Expiry watch: 2,100 units in São Paulo within 90 days", actor: "Quality" },
  { category: "inventory", text: "Stock count completed at New York DC — variance 0.3%", actor: "WH New York" },
  { category: "secondary", text: "Customer PO received — Berlin Mitte Klinikum, 1,800 units", actor: "Sales DE" },
  { category: "secondary", text: "Order ITALY-0934 delivered to Milano Salute", actor: "Logistics IT" },
  { category: "secondary", text: "Gulf Medical Centre commitment confirmed for Q3", actor: "Sales AE" },
  { category: "secondary", text: "Hudson Health Network order dispatched from New York", actor: "Logistics US" },
  { category: "finance", text: "Payment received — €420,000 from Paris Santé", actor: "Finance" },
  { category: "finance", text: "Invoice raised for Bosphorus Health Group — ₹2.4 Cr", actor: "Finance" },
  { category: "finance", text: "FX rate locked for the day — EUR/INR reference set", actor: "Treasury" },
  { category: "system", text: "Import approval completed for GERMANY-CARDIO-0412", actor: "K. Rao" },
  { category: "system", text: "Country review signed off — UAE", actor: "Regional Mgr" },
  { category: "system", text: "Decision recorded: expedite Brazil restock", actor: "GM" },
  { category: "primary", text: "SAUDI-DIAG-0277 booked on next Riyadh flight", actor: "Sales SA" },
  { category: "secondary", text: "Open PO escalated — Riyadh Medical Group, due in 15 days", actor: "Sales SA" },
  { category: "inventory", text: "Consignment replenished at Tokyo partner site", actor: "WH Tokyo" },
  { category: "primary", text: "FRANCE-VASCULAR-0301 cleared customs at Paris", actor: "Customs CDG" },
  { category: "secondary", text: "Order delivered to Thames Health Trust, London", actor: "Logistics UK" },
];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** A business-wide stream of recent events. Timestamps are spread back from now
 *  so the feed reads as "the last couple of hours of trading".
 *
 *  When `pulse > 0` (Demo Mode), a rotating seed is promoted to a brand-new
 *  "just now" event at the head of the list — so a fresh line streams into the
 *  feed on every pulse and the business reads as continuously live. */
export function buildSampleEvents(pulse = 0): LiveEvent[] {
  const now = Date.now();
  const events: LiveEvent[] = EVENT_SEEDS.map((seed, index) => {
    const at = new Date(now - (index + 1) * 6 * 60 * 1000 - (index % 3) * 70 * 1000);
    return {
      id: `sample-${index}`,
      at,
      time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
      category: seed.category,
      text: seed.text,
      actor: seed.actor ?? null,
    };
  });
  if (pulse <= 0) return events;
  const n = EVENT_SEEDS.length;
  const lead = EVENT_SEEDS[((pulse % n) + n) % n];
  const at = new Date(now);
  const leadEvent: LiveEvent = {
    id: `live-${pulse}`,
    at,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    category: lead.category,
    text: lead.text,
    actor: lead.actor ?? null,
  };
  return [leadEvent, ...events];
}

/** Generate a fresh burst of "just arrived" events — used by the presenter's
 *  "Add Sample Data" button so a set of new activity visibly enters the system
 *  on each click. Deterministic per `seq` so re-renders are stable. */
export function generateBurst(seq: number, size = 5): LiveEvent[] {
  const now = Date.now();
  const n = EVENT_SEEDS.length;
  const out: LiveEvent[] = [];
  for (let k = 0; k < size; k += 1) {
    const seed = EVENT_SEEDS[(seq * 7 + k * 3) % n];
    const at = new Date(now - k * 1400);
    out.push({
      id: `inject-${seq}-${k}`,
      at,
      time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
      category: seed.category,
      text: seed.text,
      actor: seed.actor ?? null,
    });
  }
  return out;
}

// =============================================================================
// EXECUTIVE LIVE OPERATIONS CENTER (Phase 7D)
// -----------------------------------------------------------------------------
// A single computed snapshot of the whole business — the "Bloomberg terminal"
// read for board / CEO / MD / GM. Every figure here is DERIVED from the three
// lanes above (primary, inventory, secondary), never hardcoded:
//   • reliability comes from shipment / customs counts and computed delay days
//   • serviceability = available stock (+ incoming) vs open customer demand
//   • fulfilment comes from orders vs deliveries and a computed PO→POD cycle
//   • regional context compares each Country+Vertical against its REGION average
//   • attention / success are ranked from those same computed metrics
//
// The snapshot is sensitive to `boost` (how many times the presenter pressed
// "Add Sample Data") and `tick` (the demo pulse). Both gently lift the figures,
// so the whole business visibly "breathes" and grows as live activity flows in.
// =============================================================================

export type ExecTone = "good" | "warn" | "bad" | "info" | "neutral";
export type ExecStat = { label: string; value: string; sub?: string; tone?: ExecTone };
export type ExecBand = { label: string; value: string; volume: string; pct: number; tone?: ExecTone };
export type ExecBenchmark = {
  country: string;
  vertical: string;
  region: string;
  metric: string;
  value: string;
  benchmark: string;
  deltaLabel: string;
  tone: ExecTone;
};
export type ExecAttention = {
  country: string;
  vertical: string;
  headline: string;
  impact: string;
  value: string;
  volume: string;
  reason: string;
  tone: ExecTone;
};
export type ExecWin = { title: string; country: string; vertical: string; detail: string };

export type ExecSnapshot = {
  asOf: string;
  header: { incoming: ExecStat[]; inventory: ExecStat[]; outgoing: ExecStat[] };
  reliability: { shipment: ExecStat[]; severity: ExecStat[]; customs: ExecStat[]; protection: ExecStat[] };
  health: { serviceability: ExecStat[]; coverageDays: number; aging: ExecBand[]; nearExpiry: ExecStat; writeOffRisk: ExecStat; outOfStock: ExecStat[] };
  fulfillment: { orders: ExecStat[]; reliability: ExecStat[]; cycle: ExecStat[]; buckets: ExecStat[] };
  flow: { incoming: ExecStat[]; inventory: ExecStat[]; outgoing: ExecStat[]; intensity: { inbound: number; hold: number; outbound: number } };
  regional: ExecBenchmark[];
  attention: ExecAttention[];
  success: ExecWin[];
  vitals: { label: string; pct: number; tone: ExecTone; caption: string }[];
  heroes: { label: string; value: number; format: (value: number) => string; tone: ExecTone; sub: string }[];
  headerSpark: { incoming: number[]; inventory: number[]; outgoing: number[] };
  donuts: { inventoryState: { label: string; value: number }[]; orderState: { label: string; value: number }[] };
  map: {
    values: Record<string, number>;
    tooltips: SampleLane["tooltips"];
    sidePanel: SampleLane["sidePanel"];
    cities: MapCity[];
    routes: MapRoute[];
    geoRoutes: GeoRoute[];
    formatValue: (value: number) => string;
  };
};

// Each market sits inside one management region. Management never compares
// verticals against each other or countries globally — only a Country+Vertical
// against its own region's average.
const REGIONS: Record<string, string> = {
  Germany: "Europe",
  Italy: "Europe",
  France: "Europe",
  "United Kingdom": "Europe",
  Poland: "Europe",
  Turkey: "Europe",
  "United Arab Emirates": "Middle East",
  "Saudi Arabia": "Middle East",
  "United States of America": "North America",
  Brazil: "Latin America",
  Japan: "Asia & Australia",
  "South Africa": "Africa",
  Spain: "Europe",
  Mexico: "Latin America",
  Australia: "Asia & Australia",
  Egypt: "Africa",
  Indonesia: "Asia & Australia",
  Canada: "North America",
};
const regionOf = (country: string): string => REGIONS[country] ?? "Other";

// Stable ordering so each market keeps the same "focus vertical" between renders.
const EXEC_COUNTRIES = [
  "Germany",
  "United States of America",
  "United Arab Emirates",
  "Italy",
  "Brazil",
  "Saudi Arabia",
  "France",
  "Japan",
  "Turkey",
  "United Kingdom",
  "Poland",
];

const clampPct = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
const pct = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);
const toneForServ = (value: number): ExecTone => (value >= 95 ? "good" : value >= 80 ? "info" : value >= 65 ? "warn" : "bad");

// A computed per-Country+Vertical operating picture — the spine every section
// reads from. Synthesised fields (delay/clearance/cycle days) are deterministic
// per market, so the page is stable across re-renders but still market-specific.
type CountryOps = {
  country: string;
  region: string;
  vertical: string;
  incomingValue: number;
  incomingUnits: number;
  shipments: number;
  delayed: number;
  arrived: number;
  inTransit: number;
  customs: number;
  delayDays: number;
  clearanceDays: number;
  stockValue: number;
  stockUnits: number;
  available: number;
  reserved: number;
  expiring: number;
  expired: number;
  revenue: number;
  orders: number;
  delivered: number;
  outUnits: number;
  openPOs: number;
  cycleDays: number;
  openDemand: number;
  currentServ: number;
  futureServ: number;
  coverageDays: number;
};

function buildCountryOps(boost: number, tick: number): CountryOps[] {
  // When presenting, the figures come straight from the ledger (already scaled by
  // the click counters), so g = 1. Otherwise the injection/pulse growth applies.
  const ledger = activeLedgerRows();
  const g = ledger ? 1 : growthFactor(boost, tick);
  const primaryBy = new Map((ledger ? ledger.primary : PRIMARY_ROWS_BASE).map((row) => [row.country, row]));
  const invBy = new Map((ledger ? ledger.inventory : INVENTORY_ROWS_BASE).map((row) => [row.country, row]));
  const secBy = new Map((ledger ? ledger.secondary : SECONDARY_ROWS_BASE).map((row) => [row.country, row]));

  return EXEC_COUNTRIES.map((country, idx) => {
    const p = primaryBy.get(country);
    const inv = invBy.get(country);
    const s = secBy.get(country);
    const r = rng(1000 + idx * 7);
    const vertical = VERTICALS[idx % VERTICALS.length];

    const incomingValue = (p?.value ?? 0) * g;
    const incomingUnits = (p?.units ?? 0) * g;
    const shipments = Math.round((p?.shipments ?? 0) * g);
    const delayed = p?.delayed ?? 0;
    const arrived = p?.arrived ?? 0;
    const inTransit = p?.inTransit ?? 0;
    const customs = p?.customs ?? 0;
    const delayDays = 2 + Math.round(r() * 6);
    const clearanceDays = 1 + Math.round(r() * 3);

    const stockValue = (inv?.value ?? 0) * g;
    const stockUnits = (inv?.units ?? 0) * g;
    const reserved = (inv?.reserved ?? 0) * g;
    const available = Math.max(0, stockUnits - reserved);
    const expiring = (inv?.expiring ?? 0) * g;
    const expired = inv?.expired ?? 0;

    const revenue = (s?.revenue ?? 0) * g;
    const orders = Math.round((s?.orders ?? 0) * g);
    const delivered = Math.round((s?.delivered ?? 0) * g);
    const outUnits = (s?.units ?? 0) * g;
    const openPOs = s?.commitmentsOpen ?? 0;
    const cycleDays = 8 + Math.round(r() * 12);

    const avgOrderUnits = orders > 0 ? outUnits / orders : 0;
    const openDemand = Math.max(1, reserved + openPOs * Math.max(1, avgOrderUnits));
    const currentServ = clampPct(pct(available, openDemand));
    const futureServ = clampPct(pct(available + incomingUnits, openDemand));
    const dailyOut = Math.max(1, ((s?.units ?? 0) * g) / 30);
    const coverageDays = Math.round(available / dailyOut);

    return {
      country,
      region: regionOf(country),
      vertical,
      incomingValue,
      incomingUnits,
      shipments,
      delayed,
      arrived,
      inTransit,
      customs,
      delayDays,
      clearanceDays,
      stockValue,
      stockUnits,
      available,
      reserved,
      expiring,
      expired,
      revenue,
      orders,
      delivered,
      outUnits,
      openPOs,
      cycleDays,
      openDemand,
      currentServ,
      futureServ,
      coverageDays,
    };
  });
}

/** Build the whole-business executive snapshot. `boost` = number of presenter
 *  injections, `tick` = demo pulse; both lift the figures so the screen reads as
 *  a live, growing operation. */
export function buildExecutiveSnapshot(_rev = 0, boost = 0, tick = 0): ExecSnapshot {
  void _rev;
  const ops = buildCountryOps(boost, tick);
  const total = <K extends keyof CountryOps>(key: K): number => sum(ops.map((row) => Number(row[key])));

  // ---- Section 1 — Live header ---------------------------------------------
  const incomingValueTotal = total("incomingValue");
  const incomingUnitsTotal = total("incomingUnits");
  const shipmentsTotal = total("shipments");
  const stockValueTotal = total("stockValue");
  const stockUnitsTotal = total("stockUnits");
  const availableTotal = total("available");
  const revenueTotal = total("revenue");
  const ordersTotal = total("orders");
  const deliveredTotal = total("delivered");
  const outUnitsTotal = total("outUnits");
  const networkCoverageDays = Math.round(availableTotal / Math.max(1, outUnitsTotal / 30));
  const avgUnitValue = stockValueTotal / Math.max(1, stockUnitsTotal);

  const header: ExecSnapshot["header"] = {
    incoming: [
      { label: "Value", value: money(incomingValueTotal), tone: "good" },
      { label: "Volume", value: `${units(incomingUnitsTotal)} units` },
      { label: "Shipments", value: String(shipmentsTotal) },
    ],
    inventory: [
      { label: "Value", value: money(stockValueTotal) },
      { label: "Volume", value: `${units(stockUnitsTotal)} units` },
      { label: "Coverage", value: `${networkCoverageDays} days`, tone: networkCoverageDays < 20 ? "warn" : "good" },
    ],
    outgoing: [
      { label: "Value", value: money(revenueTotal), tone: "good" },
      { label: "Volume", value: `${units(outUnitsTotal)} units` },
      { label: "Orders", value: String(ordersTotal) },
    ],
  };

  // ---- Section 2 — Supply-chain reliability --------------------------------
  const delayedTotal = total("delayed");
  const arrivedTotal = total("arrived");
  const inTransitTotal = total("inTransit");
  const customsTotal = total("customs");
  const onTimePct = clampPct(pct(shipmentsTotal - delayedTotal, shipmentsTotal));
  const delayedShare = 100 - onTimePct;
  const avgDelayDays = total("delayed")
    ? sum(ops.map((row) => row.delayDays * row.delayed)) / total("delayed")
    : 0;
  let delayedUnder = 0;
  let delayedOver = 0;
  let critical = 0;
  for (const row of ops) {
    if (row.delayed <= 0) continue;
    if (row.delayDays > 2 * avgDelayDays) critical += row.delayed;
    else if (row.delayDays > avgDelayDays) delayedOver += row.delayed;
    else delayedUnder += row.delayed;
  }
  const docIssues = sum(ops.map((row) => (row.customs > 1 ? row.customs - 1 : 0)));
  const customsHandled = Math.max(1, arrivedTotal + customsTotal);
  const clearanceSuccess = clampPct(pct(customsHandled - docIssues, customsHandled));
  const avgClearanceDays =
    sum(ops.map((row) => row.clearanceDays * (row.customs + row.arrived))) / customsHandled;
  const ordersProtected = sum(ops.filter((row) => row.incomingUnits > 0).map((row) => row.openPOs));
  const revenueProtected = sum(ops.filter((row) => row.incomingUnits > 0).map((row) => row.revenue));

  const reliability: ExecSnapshot["reliability"] = {
    shipment: [
      { label: "On time", value: `${onTimePct}%`, tone: toneForServ(onTimePct) },
      { label: "Delayed", value: `${delayedShare}%`, tone: delayedShare > 12 ? "warn" : "good" },
      { label: "Avg delay", value: `${avgDelayDays.toFixed(1)} days`, tone: avgDelayDays > 5 ? "warn" : "good" },
    ],
    severity: [
      { label: "Under average", value: String(delayedUnder), tone: "good" },
      { label: "Over average", value: String(delayedOver), tone: "warn" },
      { label: "Critical (>2× avg)", value: String(critical), tone: critical > 0 ? "bad" : "good" },
    ],
    customs: [
      { label: "Clearance success", value: `${clearanceSuccess}%`, tone: toneForServ(clearanceSuccess) },
      { label: "Documentation issues", value: String(docIssues), tone: docIssues > 2 ? "warn" : "good" },
      { label: "Avg clearance", value: `${avgClearanceDays.toFixed(1)} days` },
    ],
    protection: [
      { label: "Inventory protected", value: money(incomingValueTotal), sub: "by incoming shipments", tone: "good" },
      { label: "Orders protected", value: String(ordersProtected), sub: "open POs covered" },
      { label: "Revenue protected", value: money(revenueProtected), sub: "tied to inbound stock", tone: "good" },
    ],
  };

  // ---- Section 3 — Inventory health ----------------------------------------
  const openDemandTotal = total("openDemand");
  const currentServiceability = clampPct(pct(availableTotal, openDemandTotal));
  const futureServiceability = clampPct(pct(availableTotal + incomingUnitsTotal, openDemandTotal));
  const band0 = stockUnitsTotal * 0.62;
  const band1 = stockUnitsTotal * 0.26;
  const band2 = Math.max(0, stockUnitsTotal - band0 - band1);
  const expiringTotal = total("expiring");
  // "Expiry & out of stock" reports only stock customers actually want (has open
  // demand) — not the whole catalogue. We keep the demand-backed portion of
  // near-expiry stock (the units there is real demand to sell before they lapse);
  // expiring stock nobody is ordering is excluded here.
  const demandedRows = ops.filter((row) => row.reserved > 0 || row.openPOs > 0);
  const expiringWithDemand = sum(demandedRows.map((row) => Math.min(row.expiring, row.openDemand)));
  const demandedVolume = sum(demandedRows.map((row) => row.openDemand)) || stockUnitsTotal;
  // The other half of the expiring stock: units that are about to lapse with no
  // open demand behind them. This is the "may become a loss" figure — what to
  // discount, move, or brace to write off — kept separate from the "sell this
  // now" figure above. The two together account for all near-expiry stock.
  const expiringNoDemand = Math.max(0, expiringTotal - expiringWithDemand);
  const lowCoverage = ops.filter((row) => row.currentServ < 65);
  const outVerticals = new Set(lowCoverage.map((row) => row.vertical));

  const health: ExecSnapshot["health"] = {
    serviceability: [
      { label: "Current serviceability", value: `${currentServiceability}%`, sub: "stock vs open demand", tone: toneForServ(currentServiceability) },
      { label: "Future serviceability", value: `${futureServiceability}%`, sub: "stock + incoming vs demand", tone: toneForServ(futureServiceability) },
    ],
    coverageDays: networkCoverageDays,
    aging: [
      { label: "0–90 days", value: money(band0 * avgUnitValue), volume: `${units(band0)} units`, pct: Math.round(pct(band0, stockUnitsTotal)), tone: "good" },
      { label: "90–180 days", value: money(band1 * avgUnitValue), volume: `${units(band1)} units`, pct: Math.round(pct(band1, stockUnitsTotal)), tone: "info" },
      { label: "180+ days", value: money(band2 * avgUnitValue), volume: `${units(band2)} units`, pct: Math.round(pct(band2, stockUnitsTotal)), tone: "warn" },
    ],
    nearExpiry: {
      label: "Near expiry, in demand (≤90 days)",
      value: money(expiringWithDemand * avgUnitValue),
      sub: `${units(expiringWithDemand)} units customers want · ${Math.round(pct(expiringWithDemand, demandedVolume))}% of demanded stock`,
      tone: "warn",
    },
    writeOffRisk: {
      label: "At write-off risk (no demand, ≤90 days)",
      value: money(expiringNoDemand * avgUnitValue),
      sub: `${units(expiringNoDemand)} units no one is ordering · ${Math.round(pct(expiringNoDemand, expiringTotal))}% of expiring stock`,
      tone: expiringNoDemand > 0 ? "bad" : "good",
    },
    outOfStock: [
      { label: "Products at risk", value: String(lowCoverage.length * 2), tone: lowCoverage.length ? "bad" : "good" },
      { label: "Countries", value: String(lowCoverage.length), tone: lowCoverage.length ? "warn" : "good" },
      { label: "Verticals", value: String(outVerticals.size), tone: outVerticals.size ? "warn" : "good" },
    ],
  };

  // ---- Section 4 — Customer fulfilment -------------------------------------
  const openOrders = Math.max(0, ordersTotal - deliveredTotal);
  const backordered = sum(ops.map((row) => row.openPOs));
  const missed = Math.round(openOrders * 0.12);
  const delayedDeliveries = Math.round(openOrders * 0.28);
  const onTimeDeliveries = deliveredTotal;
  const cycleAvg = ordersTotal
    ? sum(ops.map((row) => row.cycleDays * row.orders)) / ordersTotal
    : 0;
  const cycleBest = Math.min(...ops.map((row) => row.cycleDays));
  const cycleWorst = Math.max(...ops.map((row) => row.cycleDays));
  const faster = sum(ops.filter((row) => row.cycleDays < cycleAvg - 1).map((row) => row.orders));
  const slower = sum(ops.filter((row) => row.cycleDays > cycleAvg + 1).map((row) => row.orders));
  const averageBucket = Math.max(0, ordersTotal - faster - slower);

  const fulfillment: ExecSnapshot["fulfillment"] = {
    orders: [
      { label: "Received", value: String(ordersTotal) },
      { label: "Delivered", value: String(deliveredTotal), tone: "good" },
      { label: "Open", value: String(openOrders), tone: openOrders > deliveredTotal ? "warn" : "neutral" },
      { label: "Backordered", value: String(backordered), tone: backordered > 0 ? "warn" : "good" },
    ],
    reliability: [
      { label: "On time", value: String(onTimeDeliveries), tone: "good" },
      { label: "Delayed", value: String(delayedDeliveries), tone: "warn" },
      { label: "Missed", value: String(missed), tone: missed > 0 ? "bad" : "good" },
    ],
    cycle: [
      { label: "Average PO→POD", value: `${cycleAvg.toFixed(0)} days` },
      { label: "Best", value: `${cycleBest} days`, tone: "good" },
      { label: "Worst", value: `${cycleWorst} days`, tone: "warn" },
    ],
    buckets: [
      { label: "Faster than average", value: String(faster), tone: "good" },
      { label: "Average", value: String(averageBucket), tone: "neutral" },
      { label: "Slower than average", value: String(slower), tone: "warn" },
    ],
  };

  // ---- Section 5 — Business flow -------------------------------------------
  const flow: ExecSnapshot["flow"] = {
    incoming: [
      { label: "Value", value: money(incomingValueTotal) },
      { label: "Volume", value: `${units(incomingUnitsTotal)} units` },
      { label: "Shipments", value: String(shipmentsTotal) },
    ],
    inventory: [
      { label: "Value", value: money(stockValueTotal) },
      { label: "Volume", value: `${units(stockUnitsTotal)} units` },
      { label: "Coverage", value: `${networkCoverageDays} days` },
    ],
    outgoing: [
      { label: "Value", value: money(revenueTotal) },
      { label: "Delivered", value: String(deliveredTotal) },
      { label: "Orders", value: String(ordersTotal) },
    ],
    intensity: {
      inbound: scaleIntensity(inTransitTotal, 10, 50),
      hold: scaleIntensity(stockUnitsTotal, 150_000, 320_000),
      outbound: scaleIntensity(ordersTotal, 100, 320),
    },
  };

  // ---- Section 6 — Regional context (Country+Vertical vs region average) ---
  const regionGroups = new Map<string, CountryOps[]>();
  for (const row of ops) {
    const list = regionGroups.get(row.region) ?? [];
    list.push(row);
    regionGroups.set(row.region, list);
  }
  const regionAvg = (region: string, key: (row: CountryOps) => number): number => {
    const list = regionGroups.get(region) ?? [];
    return list.length ? sum(list.map(key)) / list.length : 0;
  };
  const regionalPicks = [...ops].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const regional: ExecBenchmark[] = regionalPicks.map((row, idx) => {
    const useServ = idx % 2 === 0;
    if (useServ) {
      const bench = regionAvg(row.region, (r) => r.currentServ);
      return {
        country: row.country,
        vertical: row.vertical,
        region: row.region,
        metric: "Serviceability",
        value: `${row.currentServ}%`,
        benchmark: `${row.region} avg ${Math.round(bench)}%`,
        deltaLabel: `${row.currentServ - Math.round(bench) >= 0 ? "+" : ""}${row.currentServ - Math.round(bench)} pts`,
        tone: row.currentServ >= bench ? "good" : "warn",
      };
    }
    const bench = regionAvg(row.region, (r) => r.cycleDays);
    return {
      country: row.country,
      vertical: row.vertical,
      region: row.region,
      metric: "PO→POD",
      value: `${row.cycleDays} days`,
      benchmark: `${row.region} avg ${Math.round(bench)} days`,
      deltaLabel: `${row.cycleDays - Math.round(bench) <= 0 ? "" : "+"}${row.cycleDays - Math.round(bench)} days`,
      tone: row.cycleDays <= bench ? "good" : "warn",
    };
  });

  // ---- Section 7 — Management attention ------------------------------------
  type Candidate = ExecAttention & { score: number };
  const candidates: Candidate[] = [];
  for (const row of ops) {
    if (row.delayed > 0) {
      candidates.push({
        country: row.country,
        vertical: row.vertical,
        headline: "Shipment delay",
        impact: "Inbound behind schedule",
        value: money(row.incomingValue),
        volume: `${row.openPOs} customer commitments`,
        reason: `${row.delayed} shipment(s) running ${row.delayDays} days late into ${row.country}`,
        tone: "bad",
        score: row.incomingValue,
      });
    }
    if (row.coverageDays < 18) {
      candidates.push({
        country: row.country,
        vertical: row.vertical,
        headline: "Low coverage",
        impact: "Stock cover thin",
        value: money(row.revenue),
        volume: `${row.coverageDays} days cover`,
        reason: `Only ${row.coverageDays} days of cover against current outbound demand`,
        tone: "warn",
        score: row.revenue,
      });
    }
    if (row.currentServ < 70) {
      candidates.push({
        country: row.country,
        vertical: row.vertical,
        headline: "Serviceability risk",
        impact: "Demand may go unmet",
        value: money(row.openDemand * avgUnitValue),
        volume: `${row.currentServ}% serviceable`,
        reason: `Available stock covers only ${row.currentServ}% of open ${row.country} demand`,
        tone: "bad",
        score: row.openDemand * avgUnitValue,
      });
    }
    if (row.expiring > 2000) {
      candidates.push({
        country: row.country,
        vertical: row.vertical,
        headline: "Near-expiry write-off risk",
        impact: "Value at risk of expiry",
        value: money(row.expiring * avgUnitValue),
        volume: `${units(row.expiring)} units ≤90 days`,
        reason: `${units(row.expiring)} units in ${row.country} expire within 90 days`,
        tone: "warn",
        score: row.expiring * avgUnitValue,
      });
    }
    if (row.openPOs > 4) {
      candidates.push({
        country: row.country,
        vertical: row.vertical,
        headline: "Customer fulfilment risk",
        impact: "Large POs awaiting allocation",
        value: money(row.revenue),
        volume: `${row.openPOs} open POs`,
        reason: `${row.openPOs} open customer POs in ${row.country} need allocation to ship on time`,
        tone: "warn",
        score: row.revenue * 0.8,
      });
    }
  }
  const attention: ExecAttention[] = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score, ...rest }) => {
      void score;
      return rest;
    });

  // ---- Section 8 — Success stories -----------------------------------------
  const byServ = [...ops].sort((a, b) => b.currentServ - a.currentServ)[0];
  const byFulfil = [...ops].sort((a, b) => pct(b.delivered, b.orders) - pct(a.delivered, a.orders))[0];
  const byLogistics = [...ops].filter((r) => r.shipments > 0).sort((a, b) => a.delayDays - b.delayDays)[0];
  const byCoverage = [...ops].sort((a, b) => b.coverageDays - a.coverageDays)[0];
  const byCycle = [...ops].sort((a, b) => a.cycleDays - b.cycleDays)[0];
  const byReliable = [...ops].sort((a, b) => b.currentServ + (100 - b.delayDays) - (a.currentServ + (100 - a.delayDays)))[0];
  const success: ExecWin[] = [
    { title: "Best serviceability", country: byServ.country, vertical: byServ.vertical, detail: `${byServ.currentServ}% of open demand covered` },
    { title: "Best fulfilment", country: byFulfil.country, vertical: byFulfil.vertical, detail: `${Math.round(pct(byFulfil.delivered, byFulfil.orders))}% of orders delivered` },
    { title: "Best logistics reliability", country: byLogistics?.country ?? "—", vertical: byLogistics?.vertical ?? "—", detail: `${byLogistics?.delayDays ?? 0}-day average delay, lowest in network` },
    { title: "Most improved coverage", country: byCoverage.country, vertical: byCoverage.vertical, detail: `${byCoverage.coverageDays} days of cover on hand` },
    { title: "Most improved customer service", country: byCycle.country, vertical: byCycle.vertical, detail: `${byCycle.cycleDays}-day PO→POD, fastest cycle` },
    { title: "Most reliable Country + Vertical", country: byReliable.country, vertical: byReliable.vertical, detail: `${byReliable.currentServ}% serviceable · ${byReliable.delayDays}-day delay` },
  ];

  // ---- Live map: the whole network value, drillable to cities --------------
  const values: Record<string, number> = {};
  const tooltips: SampleLane["tooltips"] = {};
  const sidePanel: SampleLane["sidePanel"] = {};
  const cities: MapCity[] = [];
  for (const row of ops) {
    const networkValue = row.incomingValue + row.stockValue + row.revenue;
    if (networkValue <= 0) continue; // inactive country → off the map (e.g. at reset)
    values[row.country] = networkValue;
    tooltips[row.country] = [
      { label: "Incoming", value: money(row.incomingValue) },
      { label: "Stock", value: money(row.stockValue) },
      { label: "Revenue", value: money(row.revenue) },
      { label: "Serviceability", value: `${row.currentServ}%` },
      { label: "Open POs", value: String(row.openPOs) },
    ];
    sidePanel[row.country] = [
      { label: "Network value", value: money(networkValue) },
      { label: "Incoming", value: money(row.incomingValue) },
      { label: "Stock on hand", value: money(row.stockValue) },
      { label: "Revenue out", value: money(row.revenue), tone: "good" },
      { label: "Serviceability", value: `${row.currentServ}%`, tone: row.currentServ < 70 ? "bad" : row.currentServ < 90 ? "warn" : "good" },
      { label: "Delayed", value: String(row.delayed), tone: row.delayed > 0 ? "bad" : "good" },
    ];
    const market = MARKETS[row.country];
    if (market) {
      cities.push({
        country: row.country,
        city: market.city,
        lon: market.lon,
        lat: market.lat,
        value: networkValue,
        valueLabel: money(networkValue),
        volume: `${units(row.stockUnits)} units held`,
        movement: `${row.shipments} in · ${row.orders} out`,
        status: row.delayed > 0 ? "Delay" : row.currentServ < 70 ? "Low cover" : "Healthy",
      });
    }
  }
  // India → country inbound routes, but ONLY where shipments are actually moving
  // (driven by the live counters), so the network map is empty right after reset
  // and grows as Primary Sales are added.
  const modeByCountry = new Map(PRIMARY_ROWS_BASE.map((row) => [row.country, row.mode] as const));
  const routes: MapRoute[] = ops
    .filter((row) => row.shipments > 0 && MARKETS[row.country])
    .map((row) => ({
      from: ORIGIN,
      to: row.country,
      intensity: Math.max(1, Math.round(row.shipments / 2)),
      mode: modeByCountry.get(row.country) ?? "air",
    }));
  // Secondary distribution is intra-country: from each country's delivery hub out
  // to its other major cities — never country-to-country. Only countries that are
  // actually selling get these routes, so the map grows with the demo.
  const geoRoutes: GeoRoute[] = [];
  for (const row of ops) {
    if (row.orders <= 0) continue;
    const geo = citiesForCountry(row.country);
    if (!geo) continue;
    const hub: [number, number] = [geo.hub.lon, geo.hub.lat];
    const intensity = Math.max(1, Math.min(4, Math.round(row.orders / 5)));
    for (const c of geo.others.slice(0, 3)) {
      geoRoutes.push({ from: hub, to: [c.lon, c.lat], mode: "road", intensity });
    }
  }
  // Newly injected markets join the network map alongside the core countries.
  mergeInjectedMarkets(values, tooltips, sidePanel, cities, routes, money);

  // ---- Visual extras for the Executive Summary page (gauges / sparks / donuts)
  const fulfilRate = clampPct(pct(deliveredTotal, ordersTotal));
  const vitals = [
    { label: "On-time delivery", pct: onTimePct, tone: toneForServ(onTimePct), caption: "shipments arriving on schedule" },
    { label: "Customs clearance", pct: clearanceSuccess, tone: toneForServ(clearanceSuccess), caption: "cleared without document issues" },
    { label: "Serviceability", pct: currentServiceability, tone: toneForServ(currentServiceability), caption: "open demand we can cover now" },
    { label: "Order fulfilment", pct: fulfilRate, tone: toneForServ(fulfilRate), caption: "customer orders delivered" },
  ];
  const headerSpark = {
    incoming: series(91, Math.round(incomingValueTotal * 0.82), Math.round(incomingValueTotal), 0.06),
    inventory: series(92, Math.round(stockValueTotal * 0.94), Math.round(stockValueTotal), 0.03),
    outgoing: series(93, Math.round(revenueTotal * 0.78), Math.round(revenueTotal), 0.07),
  };
  const donuts = {
    inventoryState: [
      { label: "Available", value: Math.round(availableTotal) },
      { label: "Reserved", value: Math.round(total("reserved")) },
      { label: "Expiring ≤90d", value: Math.round(expiringTotal) },
      { label: "Expired", value: Math.round(total("expired")) },
    ],
    orderState: [
      { label: "Delivered", value: deliveredTotal },
      { label: "Open", value: openOrders },
      { label: "Backordered", value: backordered },
    ],
  };

  return {
    asOf: new Date().toISOString(),
    header,
    reliability,
    health,
    fulfillment,
    flow,
    regional,
    attention,
    success,
    vitals,
    heroes: [
      { label: "Entering the business", value: incomingValueTotal, format: money, tone: "good", sub: `${units(incomingUnitsTotal)} units · ${shipmentsTotal} shipments` },
      { label: "Inventory on hand", value: stockValueTotal, format: money, tone: "info", sub: `${units(stockUnitsTotal)} units · ${networkCoverageDays} days cover` },
      { label: "Leaving the business", value: revenueTotal, format: money, tone: "good", sub: `${ordersTotal} orders · ${units(outUnitsTotal)} units` },
    ],
    headerSpark,
    donuts,
    map: { values, tooltips, sidePanel, cities, routes, geoRoutes, formatValue: (value) => money(value) },
  };
}
