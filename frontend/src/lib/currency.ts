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

let displayCurrency = BASE_CURRENCY;
let rateToDisplay = 1; // 1 base unit = rateToDisplay display units

export function setDisplayCurrency(code: string, rate: number): void {
  displayCurrency = code || BASE_CURRENCY;
  rateToDisplay = Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function getDisplayCurrency(): string {
  return displayCurrency;
}

export function convertFromBase(value: number): number {
  return (value || 0) * rateToDisplay;
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

export function formatMoney(value: number, options?: { compact?: boolean }): string {
  const converted = convertFromBase(value);
  const compact = Boolean(options?.compact) && Math.abs(converted) >= 1_000_000;
  const decimals = Math.abs(converted) > 0 && Math.abs(converted) < 1000;
  try {
    return moneyFormatter(displayCurrency, compact, decimals).format(converted);
  } catch {
    return `${displayCurrency} ${Math.round(converted).toLocaleString("en-US")}`;
  }
}

const unitFormatter = new Intl.NumberFormat("en-US");

export function formatUnits(value: number): string {
  return unitFormatter.format(Math.round(value || 0));
}
