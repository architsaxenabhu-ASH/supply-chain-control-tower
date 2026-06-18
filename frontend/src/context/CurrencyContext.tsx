import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Coins, Lock, PencilLine } from "lucide-react";

import {
  fetchCurrencyRates,
  listCurrencyRates,
  saveCurrencyRates,
  type ApiCurrencyRateSet,
} from "../lib/api";
import {
  BASE_CURRENCY,
  FALLBACK_CURRENCIES,
  PINNED_CURRENCIES,
  RATE_BOOKS,
  currencyForCountry,
  drainMissingRateDates,
  setDisplayState,
  setRateTable,
  type RateBook,
} from "../lib/currency";
import { useCountry } from "./CountryContext";

// Currency environment (Phase 5D/5G). Money figures convert at the rate locked
// for the transaction's own date, from one of two rate books:
//   primary   — Meril India → subsidiary; default for inventory valuation too
//   secondary — subsidiary → customer
// Rates lock to the ECB end-of-day reference (published ~16:00 CET); manual
// overrides per book are recorded in the audit trail (module "currency").

type CurrencyStatus = "loading" | "locked" | "manual" | "unavailable";

type CurrencyContextValue = {
  choice: string; // "LOCAL" or an ISO currency code
  setChoice: (choice: string) => void;
  effectiveCurrency: string;
  rateDate: string;
  setRateDate: (date: string) => void;
  primarySet: ApiCurrencyRateSet | null;
  secondarySet: ApiCurrencyRateSet | null;
  status: CurrencyStatus;
  availableCurrencies: string[];
  activeBook: RateBook;
  override: (book: RateBook, rates: Record<string, number>, actor: string | null, reason: string) => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// Views that belong to the subsidiary → customer flow use the secondary rate
// book; everything else (imports, inventory, operations) uses primary.
const SECONDARY_VIEWS = new Set([
  "secondary-sales",
  "dispatches",
  "commitments",
  "commercial",
  "receivables",
  "customers",
  "dash-secondary",
]);

function bookForView(view: string | undefined): RateBook {
  return view && SECONDARY_VIEWS.has(view) ? "secondary" : "primary";
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Load the locked rate set for a book + date: our own store first, else lock
// the ECB reference rate for that date, else fall back to the latest set.
// Both books default to the same ECB reference and only diverge once someone
// overrides one of them.
async function loadBookRates(date: string, book: RateBook): Promise<ApiCurrencyRateSet | null> {
  try {
    return await fetchCurrencyRates(date, BASE_CURRENCY, book);
  } catch {
    /* nothing locked yet for this book + date */
  }
  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/${date}?base=${BASE_CURRENCY}`);
    if (response.ok) {
      const data = (await response.json()) as { base: string; date: string; rates: Record<string, number> };
      return await saveCurrencyRates({
        rate_date: date,
        base_currency: BASE_CURRENCY,
        rates: data.rates,
        source: "ecb_reference_1600cet",
        book,
        reason: `Locked from ECB reference rates published for ${data.date}`,
      });
    }
  } catch {
    /* offline or rate service unreachable */
  }
  try {
    const recent = await listCurrencyRates(1, book);
    if (recent.length > 0) return recent[0];
  } catch {
    /* backend unreachable */
  }
  return null;
}

export function CurrencyProvider({ activeView, children }: { activeView?: string; children: ReactNode }) {
  const { country } = useCountry();
  const [choice, setChoice] = useState<string>("LOCAL");
  const [rateDate, setRateDate] = useState<string>(todayStamp());
  const [primarySet, setPrimarySet] = useState<ApiCurrencyRateSet | null>(null);
  const [secondarySet, setSecondarySet] = useState<ApiCurrencyRateSet | null>(null);
  const [status, setStatus] = useState<CurrencyStatus>("loading");
  const activeBook = bookForView(activeView);

  // Load (or lock) both books for the active reference date.
  useEffect(() => {
    let active = true;
    setStatus("loading");
    Promise.all([loadBookRates(rateDate, "primary"), loadBookRates(rateDate, "secondary")]).then(
      ([primary, secondary]) => {
        if (!active) return;
        setPrimarySet(primary);
        setSecondarySet(secondary);
        if (primary) setRateTable("primary", rateDate, primary.base_currency, primary.rates);
        if (secondary) setRateTable("secondary", rateDate, secondary.base_currency, secondary.rates);
        const anyManual = primary?.source === "manual" || secondary?.source === "manual";
        setStatus(primary || secondary ? (anyManual ? "manual" : "locked") : "unavailable");
      },
    );
    return () => {
      active = false;
    };
  }, [rateDate]);

  // Lazily lock rates for historical transaction dates that views request
  // (a batch's registration date, an invoice date) but aren't cached yet.
  const inFlight = useRef<Set<string>>(new Set());
  useEffect(() => {
    const interval = window.setInterval(() => {
      const missing = drainMissingRateDates();
      for (const { book, date } of missing) {
        const key = `${book}|${date}`;
        if (inFlight.current.has(key)) continue;
        inFlight.current.add(key);
        void loadBookRates(date, book)
          .then((set) => {
            if (set) setRateTable(book, date, set.base_currency, set.rates);
          })
          .finally(() => inFlight.current.delete(key));
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const availableCurrencies = useMemo(() => {
    const codes = new Set<string>([...PINNED_CURRENCIES, ...FALLBACK_CURRENCIES]);
    for (const code of Object.keys(primarySet?.rates ?? {})) codes.add(code);
    for (const code of Object.keys(secondarySet?.rates ?? {})) codes.add(code);
    return [...codes].sort();
  }, [primarySet, secondarySet]);

  const effectiveCurrency = useMemo(() => {
    const wanted = choice === "LOCAL" ? currencyForCountry(country) : choice;
    if (wanted === BASE_CURRENCY) return wanted;
    return availableCurrencies.includes(wanted) ? wanted : BASE_CURRENCY;
  }, [choice, country, availableCurrencies]);

  // Publish display state to the engine store — this is what makes every
  // figure across the app re-render together on any change.
  useEffect(() => {
    setDisplayState(effectiveCurrency, activeBook, rateDate);
  }, [effectiveCurrency, activeBook, rateDate]);

  const override = useCallback(
    async (book: RateBook, rates: Record<string, number>, actor: string | null, reason: string) => {
      const existing = book === "secondary" ? secondarySet : primarySet;
      const saved = await saveCurrencyRates({
        rate_date: rateDate,
        base_currency: existing?.base_currency ?? BASE_CURRENCY,
        rates: { ...(existing?.rates ?? {}), ...rates },
        source: "manual",
        book,
        actor,
        reason,
      });
      if (book === "secondary") setSecondarySet(saved);
      else setPrimarySet(saved);
      setRateTable(book, rateDate, saved.base_currency, saved.rates);
      setStatus("manual");
    },
    [rateDate, primarySet, secondarySet],
  );

  const value = useMemo(
    () => ({
      choice,
      setChoice,
      effectiveCurrency,
      rateDate,
      setRateDate,
      primarySet,
      secondarySet,
      status,
      availableCurrencies,
      activeBook,
      override,
    }),
    [choice, effectiveCurrency, rateDate, primarySet, secondarySet, status, availableCurrencies, activeBook, override],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext);
  if (!value) {
    return {
      choice: "LOCAL",
      setChoice: () => undefined,
      effectiveCurrency: BASE_CURRENCY,
      rateDate: todayStamp(),
      setRateDate: () => undefined,
      primarySet: null,
      secondarySet: null,
      status: "unavailable",
      availableCurrencies: PINNED_CURRENCIES,
      activeBook: "primary",
      override: async () => undefined,
    };
  }
  return value;
}

// Top-bar display currency selector: Local (country currency) + every
// currency with a locked rate. Money everywhere converts instantly.
export function CurrencySelector() {
  const { country } = useCountry();
  const { choice, setChoice, effectiveCurrency, availableCurrencies } = useCurrency();
  const localCode = currencyForCountry(country);
  return (
    <label className="currency-selector" title="Display currency — converted at the locked rate">
      <span className="currency-badge" aria-hidden="true">
        {effectiveCurrency}
      </span>
      <select value={choice} onChange={(event) => setChoice(event.target.value)} aria-label="Display currency">
        <option value="LOCAL">Local ({localCode})</option>
        {availableCurrencies.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}

function describeSource(rateSet: ApiCurrencyRateSet | null, status: CurrencyStatus): string {
  if (status === "loading") return "Loading locked rates…";
  if (!rateSet) return "No rates available — showing base currency amounts.";
  if (rateSet.source === "manual") {
    return `Manual override by ${rateSet.updated_by ?? "unknown"}${rateSet.note ? ` — ${rateSet.note}` : ""}`;
  }
  return `ECB end-of-day reference rates (published ~16:00 CET) locked for ${rateSet.rate_date}`;
}

const BOOK_LABEL: Record<RateBook, string> = {
  primary: "Primary (India → subsidiary, inventory)",
  secondary: "Secondary (subsidiary → customer)",
};

// Rates panel: choose the rate date and book (primary / secondary), see the
// locked rates, and override them. Overrides require a reason and land in the
// audit trail (Access → Audit).
export function CurrencyRatesPanel({ actor }: { actor: string | null }) {
  const { country } = useCountry();
  const { rateDate, setRateDate, primarySet, secondarySet, status, override } = useCurrency();
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<RateBook>("primary");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addCode, setAddCode] = useState("");
  const [addValue, setAddValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const rateSet = book === "secondary" ? secondarySet : primarySet;
  const base = rateSet?.base_currency ?? BASE_CURRENCY;
  const localCode = currencyForCountry(country);
  const editableCodes = useMemo(() => {
    const codes = new Set<string>(PINNED_CURRENCIES.filter((code) => code !== base));
    if (localCode !== base) codes.add(localCode);
    return [...codes].sort();
  }, [base, localCode]);

  useEffect(() => {
    setDrafts({});
    setMessage("");
  }, [rateSet, book]);

  // Rates are stored as "1 base = X code"; people think in "1 code = Y base".
  const baseUnitsFor = (code: string): number | null => {
    const rate = rateSet?.rates?.[code];
    return rate && rate > 0 ? 1 / rate : null;
  };

  async function handleSave() {
    const changed: Record<string, number> = {};
    for (const [code, text] of Object.entries(drafts)) {
      const baseUnits = Number(text);
      if (!Number.isFinite(baseUnits) || baseUnits <= 0) continue;
      changed[code] = 1 / baseUnits;
    }
    const extraCode = addCode.trim().toUpperCase();
    const extraBaseUnits = Number(addValue);
    if (/^[A-Z]{3}$/.test(extraCode) && Number.isFinite(extraBaseUnits) && extraBaseUnits > 0) {
      changed[extraCode] = 1 / extraBaseUnits;
    }
    if (Object.keys(changed).length === 0 || !reason.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await override(book, changed, actor, reason.trim());
      setReason("");
      setAddCode("");
      setAddValue("");
      setMessage("Saved. The override is recorded in the audit trail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the override.");
    } finally {
      setSaving(false);
    }
  }

  const addingValid =
    /^[A-Za-z]{3}$/.test(addCode.trim()) && Number.isFinite(Number(addValue)) && Number(addValue) > 0;
  const dirty =
    addingValid ||
    Object.entries(drafts).some(([code, text]) => {
      const current = baseUnitsFor(code);
      const next = Number(text);
      return Number.isFinite(next) && next > 0 && (current === null || Math.abs(next - current) > 1e-9);
    });

  return (
    <div className="rates-anchor">
      <button
        className="secondary-action"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        title="Exchange rates"
      >
        <Coins size={16} aria-hidden="true" />
        Rates
      </button>
      {open ? (
        <div className="rates-popover" role="dialog" aria-label="Exchange rates">
          <div className="rates-books" role="tablist" aria-label="Rate book">
            {RATE_BOOKS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={book === option}
                className={book === option ? "rates-book active" : "rates-book"}
                onClick={() => setBook(option)}
                title={BOOK_LABEL[option]}
              >
                {option === "primary" ? "Primary" : "Secondary"}
              </button>
            ))}
          </div>
          <p className="rates-book-hint">{BOOK_LABEL[book]}</p>
          <div className="rates-head">
            <label className="filter-control">
              <span>Rate date (locked at the end-of-day rate)</span>
              <input
                type="date"
                value={rateDate}
                max={todayStamp()}
                onChange={(event) => setRateDate(event.target.value)}
              />
            </label>
          </div>
          <p className="rates-source">
            {rateSet?.source === "manual" ? (
              <PencilLine size={13} aria-hidden="true" />
            ) : (
              <Lock size={13} aria-hidden="true" />
            )}
            {describeSource(rateSet, status)}
          </p>
          <div className="rates-rows">
            {editableCodes.map((code) => {
              const current = baseUnitsFor(code);
              return (
                <label className="rates-row" key={code}>
                  <span>1 {code} =</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={current === null ? "no rate" : String(Number(current.toFixed(4)))}
                    value={drafts[code] ?? ""}
                    onChange={(event) => setDrafts((d) => ({ ...d, [code]: event.target.value }))}
                  />
                  <strong>{base}</strong>
                </label>
              );
            })}
          </div>
          <label className="rates-row rates-add">
            <input
              type="text"
              maxLength={3}
              placeholder="Code"
              aria-label="Add currency code"
              value={addCode}
              onChange={(event) => setAddCode(event.target.value.toUpperCase())}
            />
            <input
              type="number"
              min="0"
              step="any"
              placeholder={`Value of 1 unit in ${base}`}
              aria-label="Base units per unit of added currency"
              value={addValue}
              onChange={(event) => setAddValue(event.target.value)}
            />
            <strong>{base}</strong>
          </label>
          <input
            className="rates-reason"
            placeholder="Reason for override (required, goes to audit)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="rates-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={!dirty || !reason.trim() || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : `Save ${book} override`}
            </button>
            <small>Edits are traced in Access → Audit (module: currency).</small>
          </div>
          {message ? <p className="rates-message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
