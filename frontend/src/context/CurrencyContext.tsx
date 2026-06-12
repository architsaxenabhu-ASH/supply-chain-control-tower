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
  PINNED_CURRENCIES,
  currencyForCountry,
  setDisplayCurrency,
} from "../lib/currency";
import { useCountry } from "./CountryContext";

// Currency environment (Phase 5D). The display currency converts every money
// figure at the rate locked for the chosen date — the ECB end-of-day reference
// rate (published ~16:00 CET) — unless someone overrides it manually, which is
// recorded in the audit trail (module "currency").

type CurrencyStatus = "loading" | "locked" | "manual" | "unavailable";

type CurrencyContextValue = {
  choice: string; // "LOCAL" or an ISO currency code
  setChoice: (choice: string) => void;
  effectiveCurrency: string;
  rateDate: string;
  setRateDate: (date: string) => void;
  rateSet: ApiCurrencyRateSet | null;
  status: CurrencyStatus;
  availableCurrencies: string[];
  override: (rates: Record<string, number>, actor: string | null, reason: string) => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { country } = useCountry();
  const [choice, setChoice] = useState<string>("LOCAL");
  const [rateDate, setRateDate] = useState<string>(todayStamp());
  const [rateSet, setRateSet] = useState<ApiCurrencyRateSet | null>(null);
  const [status, setStatus] = useState<CurrencyStatus>("loading");
  const lockingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    (async () => {
      // 1. Rates already locked for this date in our own store.
      try {
        const saved = await fetchCurrencyRates(rateDate);
        if (!active) return;
        setRateSet(saved);
        setStatus(saved.source === "manual" ? "manual" : "locked");
        return;
      } catch {
        /* nothing locked yet */
      }
      // 2. Lock the ECB end-of-day reference rate for the selected date.
      if (!lockingRef.current) {
        lockingRef.current = true;
        try {
          const response = await fetch(`https://api.frankfurter.dev/v1/${rateDate}?base=${BASE_CURRENCY}`);
          if (response.ok) {
            const data = (await response.json()) as {
              base: string;
              date: string;
              rates: Record<string, number>;
            };
            const locked = await saveCurrencyRates({
              rate_date: rateDate,
              base_currency: BASE_CURRENCY,
              rates: data.rates,
              source: "ecb_reference_1600cet",
              reason: `Locked from ECB reference rates published for ${data.date}`,
            });
            if (!active) return;
            setRateSet(locked);
            setStatus("locked");
            return;
          }
        } catch {
          /* offline or rate service unreachable */
        } finally {
          lockingRef.current = false;
        }
      }
      // 3. Fall back to the most recent locked set so money still reads sensibly.
      try {
        const recent = await listCurrencyRates(1);
        if (!active) return;
        if (recent.length > 0) {
          setRateSet(recent[0]);
          setStatus(recent[0].source === "manual" ? "manual" : "locked");
          return;
        }
      } catch {
        /* backend unreachable */
      }
      if (active) {
        setRateSet(null);
        setStatus("unavailable");
      }
    })();
    return () => {
      active = false;
    };
  }, [rateDate]);

  const effectiveCurrency = useMemo(() => {
    const wanted = choice === "LOCAL" ? currencyForCountry(country) : choice;
    if (wanted === (rateSet?.base_currency ?? BASE_CURRENCY)) return wanted;
    return rateSet?.rates?.[wanted] ? wanted : BASE_CURRENCY;
  }, [choice, country, rateSet]);

  useEffect(() => {
    const base = rateSet?.base_currency ?? BASE_CURRENCY;
    const rate = effectiveCurrency === base ? 1 : (rateSet?.rates?.[effectiveCurrency] ?? 1);
    setDisplayCurrency(effectiveCurrency, rate);
  }, [effectiveCurrency, rateSet]);

  const availableCurrencies = useMemo(() => {
    const codes = new Set<string>(PINNED_CURRENCIES);
    for (const code of Object.keys(rateSet?.rates ?? {})) codes.add(code);
    return [...codes].sort();
  }, [rateSet]);

  const override = useCallback(
    async (rates: Record<string, number>, actor: string | null, reason: string) => {
      const saved = await saveCurrencyRates({
        rate_date: rateDate,
        base_currency: rateSet?.base_currency ?? BASE_CURRENCY,
        rates: { ...(rateSet?.rates ?? {}), ...rates },
        source: "manual",
        actor,
        reason,
      });
      setRateSet(saved);
      setStatus("manual");
    },
    [rateDate, rateSet],
  );

  const value = useMemo(
    () => ({
      choice,
      setChoice,
      effectiveCurrency,
      rateDate,
      setRateDate,
      rateSet,
      status,
      availableCurrencies,
      override,
    }),
    [choice, effectiveCurrency, rateDate, rateSet, status, availableCurrencies, override],
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
      rateSet: null,
      status: "unavailable",
      availableCurrencies: PINNED_CURRENCIES,
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

// Rates panel: pick the rate date, see the locked rates, and override them.
// Overrides require a reason and land in the audit trail (Access → Audit).
export function CurrencyRatesPanel({ actor }: { actor: string | null }) {
  const { country } = useCountry();
  const { rateDate, setRateDate, rateSet, status, override } = useCurrency();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
  }, [rateSet]);

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
    if (Object.keys(changed).length === 0 || !reason.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await override(changed, actor, reason.trim());
      setReason("");
      setMessage("Saved. The override is recorded in the audit trail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the override.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = Object.entries(drafts).some(([code, text]) => {
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
                  <span>
                    1 {code} =
                  </span>
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
              {saving ? "Saving…" : "Save override"}
            </button>
            <small>Edits are traced in Access → Audit (module: currency).</small>
          </div>
          {message ? <p className="rates-message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
