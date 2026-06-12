// Multi-currency display engine (Phase 5D). Stored amounts are kept in the
// base currency (INR — Meril India is the parent company). Display conversion
// uses the rate set locked for the chosen date: the ECB end-of-day reference
// rate (published ~16:00 CET) or a manual, audited override.

export const BASE_CURRENCY = "INR";
export const PINNED_CURRENCIES = ["EUR", "USD", BASE_CURRENCY];

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

// ---- Module-global display state -------------------------------------------
// The CurrencyProvider keeps this in sync. Module-level formatters let the
// legacy views (plain functions, no hooks) stay unchanged apart from
// delegating here; the provider re-renders the app on every change, so each
// view re-reads the formatter with fresh state.
//
// Cross-currency model (Phase 5E): every amount carries its own source
// currency (captured from the uploaded invoice). Conversion goes source →
// base → display using the rate set locked for the chosen date. An amount in
// a currency without a locked rate is shown in its original currency rather
// than converted wrongly.

let displayCurrency = BASE_CURRENCY;
let baseCurrency = BASE_CURRENCY;
let baseRates: Record<string, number> = {}; // 1 base unit = baseRates[code] code units

export function setDisplayState(code: string, base: string, rates: Record<string, number>): void {
  baseCurrency = (base || BASE_CURRENCY).toUpperCase();
  displayCurrency = (code || baseCurrency).toUpperCase();
  baseRates = rates ?? {};
}

export function getDisplayCurrency(): string {
  return displayCurrency;
}

function rateFor(code: string): number | null {
  const wanted = code.toUpperCase();
  if (wanted === baseCurrency) return 1;
  const rate = baseRates[wanted];
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** True when an amount in `from` can be expressed in the display currency. */
export function canConvert(from?: string | null): boolean {
  const src = (from ?? baseCurrency).toUpperCase();
  if (src === displayCurrency) return true;
  return rateFor(src) !== null && rateFor(displayCurrency) !== null;
}

/** Convert an amount from its source currency into the display currency.
 *  Unconvertible amounts are returned unchanged (caller may keep original). */
export function convertAmount(value: number, from?: string | null): number {
  const src = (from ?? baseCurrency).toUpperCase();
  if (src === displayCurrency) return value || 0;
  const srcRate = rateFor(src);
  const dstRate = rateFor(displayCurrency);
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
 *  currency at the locked rate. Falls back to the original currency when no
 *  rate is locked for it (honest, never silently wrong). */
export function formatMoney(value: number, options?: { compact?: boolean; from?: string | null }): string {
  const src = (options?.from ?? baseCurrency).toUpperCase();
  if (src !== displayCurrency && !canConvert(src)) {
    return formatIn(src, value, options?.compact);
  }
  return formatDisplay(convertAmount(value, src), options);
}

const unitFormatter = new Intl.NumberFormat("en-US");

export function formatUnits(value: number): string {
  return unitFormatter.format(Math.round(value || 0));
}
