// Multi-currency display engine (Phase 5D). Stored amounts are kept in the
// base currency (INR — Meril India is the parent company). Display conversion
// uses the rate set locked for the chosen date: the ECB end-of-day reference
// rate (published ~16:00 CET) or a manual, audited override.

export const BASE_CURRENCY = "INR";
export const PINNED_CURRENCIES = ["EUR", "USD", "GBP", "AED", BASE_CURRENCY];

// Built-in reference rates (1 INR = X currency), used ONLY as a fallback when no
// live/ECB rate table has loaded yet (offline, or the rate service is
// unreachable). Live rates always take precedence once cached. These keep the
// currency switcher working everywhere — figures genuinely re-denominate instead
// of silently staying in the base currency. Approximate, mid-2026 levels.
const FALLBACK_RATES: Record<string, number> = {
  INR: 1,
  EUR: 0.0111, // ≈ ₹90 / €1
  USD: 0.012, // ≈ ₹83 / $1
  GBP: 0.0095, // ≈ ₹105 / £1
  AED: 0.044, // ≈ ₹22.7 / AED 1
  SAR: 0.045,
  JPY: 1.78,
  CNY: 0.087,
  BRL: 0.06,
  TRY: 0.39,
  SGD: 0.016,
  CHF: 0.0105,
  CAD: 0.0163,
  AUD: 0.0182,
  PLN: 0.0475,
};

/** Currencies that always work in the switcher, even offline. */
export const FALLBACK_CURRENCIES = Object.keys(FALLBACK_RATES);

// Country → currency is geography/finance reference data (like the world map
// shapes), matched dynamically against whatever countries the application has
// learned. Unknown countries fall back to the base currency.
const COUNTRY_CURRENCY: Record<string, string> = {
  india: "INR",
  italy: "EUR",
  germany: "EUR",
  france: "EUR",
  spain: "EUR",
  netherlands: "EUR",
  belgium: "EUR",
  austria: "EUR",
  portugal: "EUR",
  ireland: "EUR",
  greece: "EUR",
  finland: "EUR",
  "united states": "USD",
  usa: "USD",
  "united states of america": "USD",
  "united kingdom": "GBP",
  uk: "GBP",
  switzerland: "CHF",
  japan: "JPY",
  china: "CNY",
  brazil: "BRL",
  mexico: "MXN",
  turkey: "TRY",
  "south africa": "ZAR",
  "united arab emirates": "AED",
  uae: "AED",
  "saudi arabia": "SAR",
  singapore: "SGD",
  malaysia: "MYR",
  thailand: "THB",
  indonesia: "IDR",
  vietnam: "VND",
  philippines: "PHP",
  "south korea": "KRW",
  australia: "AUD",
  canada: "CAD",
  "new zealand": "NZD",
  poland: "PLN",
  "czech republic": "CZK",
  czechia: "CZK",
  hungary: "HUF",
  romania: "RON",
  sweden: "SEK",
  norway: "NOK",
  denmark: "DKK",
  egypt: "EGP",
  nigeria: "NGN",
  kenya: "KES",
  israel: "ILS",
  argentina: "ARS",
  chile: "CLP",
  colombia: "COP",
  peru: "PEN",
  bangladesh: "BDT",
  "sri lanka": "LKR",
  nepal: "NPR",
  pakistan: "PKR",
};

export function currencyForCountry(country: string): string {
  if (!country) return BASE_CURRENCY;
  return COUNTRY_CURRENCY[country.trim().toLowerCase()] ?? BASE_CURRENCY;
}

// ---- Rate books and dates (Phase 5G) ---------------------------------------
// Two rate books exist because the business runs two flows with their own
// exchange rates:
//   primary   — Meril India → subsidiary; also the default for valuing inventory
//   secondary — subsidiary → customer
// Rates are also date-specific: an amount converts at the rate locked for the
// date the transaction was registered (a batch's goods-receipt date, an
// invoice's date), not today's rate — unless a view explicitly asks for the
// current-date rate (inventory offers this as an option).

export type RateBook = "primary" | "secondary";
export const RATE_BOOKS: RateBook[] = ["primary", "secondary"];

type RateTable = { base: string; rates: Record<string, number> };

// ---- Module-global display state -------------------------------------------
// Legacy views call these plain functions (no hooks); an external store (below)
// makes the whole app re-render whenever any of this changes, so every figure
// refreshes together when the display currency, book, date, or rates change.

let displayCurrency = BASE_CURRENCY;
let activeBook: RateBook = "primary";
let activeDate = new Date().toISOString().slice(0, 10);
const tables = new Map<string, RateTable>(); // key `${book}|${date}`
const missingDates = new Set<string>(); // `${book}|${date}` requested but not cached

function tableKey(book: RateBook, date: string): string {
  return `${book}|${date}`;
}

// ---- External store: fixes reactivity for module-function consumers ---------
let revision = 0;
const listeners = new Set<() => void>();

export function subscribeCurrency(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrencyRevision(): number {
  return revision;
}

function notify(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

/** Set which currency is shown, and which book + reference date are active. */
export function setDisplayState(code: string, book: RateBook, date: string): void {
  displayCurrency = (code || BASE_CURRENCY).toUpperCase();
  activeBook = RATE_BOOKS.includes(book) ? book : "primary";
  activeDate = date || activeDate;
  notify();
}

/** Cache a locked rate table for a book + date. Called by the provider after
 *  loading or locking rates. */
export function setRateTable(book: RateBook, date: string, base: string, rates: Record<string, number>): void {
  tables.set(tableKey(book, date), { base: (base || BASE_CURRENCY).toUpperCase(), rates: rates ?? {} });
  missingDates.delete(tableKey(book, date));
  notify();
}

/** Rate tables the provider should fetch/lock (requested at historical dates
 *  not yet cached). Drained by the provider. */
export function drainMissingRateDates(): Array<{ book: RateBook; date: string }> {
  const out = [...missingDates].map((key) => {
    const [book, date] = key.split("|");
    return { book: book as RateBook, date };
  });
  missingDates.clear();
  return out;
}

export function getActiveBook(): RateBook {
  return activeBook;
}

export function getDisplayCurrency(): string {
  return displayCurrency;
}

const FALLBACK_TABLE: RateTable = { base: BASE_CURRENCY, rates: FALLBACK_RATES };

function resolveTable(book: RateBook, date: string): RateTable | null {
  const exact = tables.get(tableKey(book, date));
  if (exact) return exact;
  // Remember the gap so the provider can lock this date's rate, then fall back
  // to the active reference table so figures still read sensibly meanwhile, and
  // finally to the built-in reference rates so conversion always works.
  if (date && date !== activeDate) missingDates.add(tableKey(book, date));
  return (
    tables.get(tableKey(book, activeDate)) ??
    tables.get(tableKey("primary", activeDate)) ??
    FALLBACK_TABLE
  );
}

function rateFor(table: RateTable | null, code: string): number | null {
  const wanted = code.toUpperCase();
  const base = table?.base ?? BASE_CURRENCY;
  if (wanted === base) return 1;
  const rate = table?.rates?.[wanted];
  return Number.isFinite(rate) && rate && rate > 0 ? rate : null;
}

export type ConvertOptions = { from?: string | null; book?: RateBook; onDate?: string | null };

/** True when an amount in `from` can be expressed in the display currency
 *  using the relevant book + date table. */
export function canConvert(options?: ConvertOptions): boolean {
  const book = options?.book ?? activeBook;
  const date = options?.onDate || activeDate;
  const table = resolveTable(book, date);
  const base = table?.base ?? BASE_CURRENCY;
  const src = (options?.from ?? base).toUpperCase();
  if (src === displayCurrency) return true;
  return rateFor(table, src) !== null && rateFor(table, displayCurrency) !== null;
}

/** Convert an amount from its source currency into the display currency using
 *  the book + date rate. Unconvertible amounts are returned unchanged. */
export function convertAmount(value: number, options?: ConvertOptions): number {
  const book = options?.book ?? activeBook;
  const date = options?.onDate || activeDate;
  const table = resolveTable(book, date);
  const base = table?.base ?? BASE_CURRENCY;
  const src = (options?.from ?? base).toUpperCase();
  if (src === displayCurrency) return value || 0;
  const srcRate = rateFor(table, src);
  const dstRate = rateFor(table, displayCurrency);
  if (srcRate === null || dstRate === null) return value || 0;
  return ((value || 0) / srcRate) * dstRate;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(code: string, compact: boolean, decimals: boolean): Intl.NumberFormat {
  const key = `${code}|${compact}|${decimals}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: decimals ? 2 : 0,
      notation: compact ? "compact" : "standard",
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Format an amount in a specific currency, without any conversion. */
export function formatIn(code: string, value: number, compactOption?: boolean): string {
  const amount = value || 0;
  const compact = Boolean(compactOption) && Math.abs(amount) >= 1_000_000;
  const decimals = Math.abs(amount) > 0 && Math.abs(amount) < 1000;
  try {
    return moneyFormatter(code.toUpperCase(), compact, decimals).format(amount);
  } catch {
    return `${code.toUpperCase()} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

/** Format an amount already expressed in the display currency (no conversion). */
export function formatDisplay(value: number, options?: { compact?: boolean }): string {
  return formatIn(displayCurrency, value, options?.compact);
}

/** Format an amount given in its source currency, converted to the display
 *  currency at the relevant book + date rate. Falls back to the original
 *  currency when no rate is available (honest, never silently wrong). */
export function formatMoney(
  value: number,
  options?: { compact?: boolean; from?: string | null; book?: RateBook; onDate?: string | null },
): string {
  const src = (options?.from ?? BASE_CURRENCY).toUpperCase();
  if (src !== displayCurrency && !canConvert(options)) {
    return formatIn(src, value, options?.compact);
  }
  return formatDisplay(convertAmount(value, options), options);
}

const unitFormatter = new Intl.NumberFormat("en-US");

export function formatUnits(value: number): string {
  return unitFormatter.format(Math.round(value || 0));
}
