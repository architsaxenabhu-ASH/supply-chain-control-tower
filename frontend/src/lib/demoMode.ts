// Demo Mode (Phase 7E) — a presenter-controlled "live" walkthrough that every
// device sees at once, so a manager in another city watches the same business
// grow in real time. It is deliberately constrained and never touches real data.
//
// How it stays in sync across devices:
//   • The shared truth is three counters on the backend (epoch / primary /
//     secondary). Every device polls them a few times a minute.
//   • The presenter's three controls map to those counters:
//       – "Start at zero" (reset)  → bumps epoch, zeroes both counters.
//       – "Primary Sales +"        → goods come IN (inbound + inventory rise).
//       – "Secondary Sales +"      → goods sold OUT (revenue rises; inventory and
//                                     active shipments fall).
//   • Inventory is always Primary − Secondary. Because the on-screen figures are
//     a pure function of the two counters, every device shows identical numbers.
//
// When the backend is unreachable (e.g. a single laptop with no server) it still
// works locally — the same counters live in memory; only cross-device sync needs
// the shared backend.

import type { LiveEvent } from "./liveTicker";
import {
  EXPANSION_MARKETS,
  generateBurst,
  registerLedgerProvider,
  registerMarketProvider,
  type InjectedMarket,
} from "./sampleBusinessData";
import {
  generateInjectedBatches,
  generateInjectedCommitments,
  generateInjectedImports,
  registerInjectProviders,
} from "./sampleApiData";
import { fetchDemoState, postDemoAction, type DemoLedgerState } from "./api";
import type { ApiCustomerCommitment, ApiImportFileCandidate, ApiInventoryBatch } from "./api";

const PULSE_MS = 4000; // a fresh feed line surfaces roughly every 4 seconds
const POLL_MS = 2500; // how often each device checks the shared counters
const MAX_INJECTED = 150; // cap each injected list (newest first)
const LIST_WINDOW = 10; // regenerate the most recent N clicks' worth of rows

// ---- Shared ledger state (mirrors the backend counters) --------------------
let epoch = 0; // > 0 once a presentation has started (after the first reset/click)
let primaryClicks = 0;
let secondaryClicks = 0;

// ---- Local-only presentation animation -------------------------------------
let active = false; // the live "pulse" (badge hidden + feed scrolling)
let tick = 0;
let injectSeq = 0; // bumps on any counter change → screens refetch
let injected: LiveEvent[] = [];
let injectedImports: ApiImportFileCandidate[] = [];
let injectedCommitments: ApiCustomerCommitment[] = [];
let injectedBatches: ApiInventoryBatch[] = [];
let injectedMarkets: InjectedMarket[] = [];

let pulseTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

// The sample lanes/maps/lists read whatever the demo has produced, without those
// modules importing this one (avoids an import cycle).
registerLedgerProvider(() => ({ active: epoch > 0, primaryClicks, secondaryClicks }));
registerMarketProvider(() => injectedMarkets);
registerInjectProviders(
  () => injectedImports,
  () => injectedCommitments,
  () => injectedBatches,
);

function emit(): void {
  for (const listener of listeners) listener();
}

// ---- Deterministic regeneration of injected rows from the counters ----------
// Both lists and the new-market reveal are pure functions of the counters, so
// every device that has polled the same counters renders exactly the same thing.

function cumulative<T>(gen: (seq: number) => T[], count: number): T[] {
  if (count <= 0) return [];
  const start = Math.max(1, count - (LIST_WINDOW - 1));
  const rows: T[] = [];
  for (let seq = count; seq >= start; seq -= 1) {
    rows.push(...gen(seq)); // newest first
    if (rows.length >= MAX_INJECTED) break;
  }
  return rows.slice(0, MAX_INJECTED);
}

function recomputeMarkets(primaryCount: number): InjectedMarket[] {
  const reveal = Math.min(EXPANSION_MARKETS.length, primaryCount);
  return EXPANSION_MARKETS.slice(0, reveal).map((market, i) => {
    const age = primaryCount - i; // primary clicks since this market appeared
    const baseValue = 6_000_000 + i * 1_400_000;
    return {
      country: market.country,
      city: market.city,
      lon: market.lon,
      lat: market.lat,
      region: market.region,
      value: Math.round(baseValue * (1 + age * 0.08)),
      units: 1200 + i * 400 + age * 220,
      flows: 2 + age,
    };
  });
}

function rebuildFromCounters(): void {
  injectedImports = cumulative(generateInjectedImports, primaryClicks);
  injectedBatches = cumulative(generateInjectedBatches, primaryClicks);
  injectedCommitments = cumulative(generateInjectedCommitments, secondaryClicks);
  injectedMarkets = recomputeMarkets(primaryClicks);
  // A short business-wide burst for the live feed (newest first).
  if (epoch > 0) {
    injected = [...generateBurst(injectSeq), ...injected].slice(0, MAX_INJECTED);
  } else {
    injected = [];
  }
}

/** Apply a fresh set of counters (from the backend or a local action). */
function applyCounters(nextEpoch: number, nextPrimary: number, nextSecondary: number): void {
  if (nextEpoch === epoch && nextPrimary === primaryClicks && nextSecondary === secondaryClicks) return;
  epoch = nextEpoch;
  primaryClicks = nextPrimary;
  secondaryClicks = nextSecondary;
  injectSeq += 1;
  rebuildFromCounters();
  ensurePulse();
  emit();
}

function applyServerState(state: DemoLedgerState | null): void {
  if (!state) return;
  applyCounters(state.epoch, state.primary, state.secondary);
}

// ---- Live pulse (feed + ticker) --------------------------------------------
function pulse(): void {
  tick += 1;
  emit();
}

function ensurePulse(): void {
  if (typeof window === "undefined") return;
  const shouldRun = active || epoch > 0;
  if (shouldRun && pulseTimer == null) {
    pulseTimer = setInterval(pulse, PULSE_MS);
  } else if (!shouldRun && pulseTimer != null) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
}

// ---- Backend polling (cross-device sync) -----------------------------------
function startPolling(): void {
  if (typeof window === "undefined" || pollTimer != null) return;
  void fetchDemoState().then(applyServerState);
  pollTimer = setInterval(() => {
    void fetchDemoState().then(applyServerState);
  }, POLL_MS);
}
startPolling();

// ---- Public API ------------------------------------------------------------

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a presentation is running (after a reset / first click). */
export function isPresentation(): boolean {
  return epoch > 0;
}

export function getPrimaryClicks(): number {
  return primaryClicks;
}

export function getSecondaryClicks(): number {
  return secondaryClicks;
}

/** True while the screen should read as a live system (badge hidden, feed moving).
 *  A running presentation counts as live, as does the manual pulse toggle. */
export function isDemoActive(): boolean {
  return active || epoch > 0;
}

/** Monotonic counter that advances every pulse — drives the continuous feed. */
export function getDemoTick(): number {
  return tick;
}

/** Bumps on every counter change — screens watch this to refetch and re-render. */
export function getInjectRevision(): number {
  return injectSeq;
}

export function getInjectedEvents(): LiveEvent[] {
  return injected;
}

export function getInjectedCount(): number {
  return injected.length;
}

/** Start a fresh presentation: zero the business on every device, then grow it. */
export function resetDemo(): void {
  applyCounters(epoch + 1, 0, 0);
  void postDemoAction("reset").then(applyServerState);
}

/** One more pulse of Primary Sales — goods coming into the business. */
export function injectPrimary(): void {
  applyCounters(epoch === 0 ? 1 : epoch, primaryClicks + 1, secondaryClicks);
  void postDemoAction("primary").then(applyServerState);
}

/** One more pulse of Secondary Sales — goods sold out to customers. */
export function injectSecondary(): void {
  applyCounters(epoch === 0 ? 1 : epoch, primaryClicks, secondaryClicks + 1);
  void postDemoAction("secondary").then(applyServerState);
}

/** Manual live-pulse toggle (the "Demo Mode" switch). */
export function setDemoActive(next: boolean): void {
  if (active === next) return;
  active = next;
  ensurePulse();
  emit();
}

export function toggleDemo(): void {
  setDemoActive(!active);
}

/** Backwards-compatible alias: a single "add sample data" press behaves like one
 *  Primary Sales pulse. */
export function injectSampleData(): void {
  injectPrimary();
}
