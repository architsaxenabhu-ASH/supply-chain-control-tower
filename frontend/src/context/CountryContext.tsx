import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Country is a first-class experience (Phase 5A). The selector is constrained to
// the user's country scope; "" means All Countries. Switching re-scopes
// country-aware screens in place.
type CountryContextValue = {
  country: string; // "" = all
  setCountry: (country: string) => void;
  available: string[];
};

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({
  scope,
  children,
}: {
  scope: string[];
  children: ReactNode;
}) {
  const [country, setCountry] = useState<string>("");
  const available = useMemo(() => [...scope].filter(Boolean).sort(), [scope]);
  const value = useMemo(() => ({ country, setCountry, available }), [country, available]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryContextValue {
  const value = useContext(CountryContext);
  if (!value) {
    return { country: "", setCountry: () => undefined, available: [] };
  }
  return value;
}

// A short, stable flag-ish glyph from a country name (no hardcoded country list).
export function countryGlyph(country: string): string {
  if (!country) return "GL";
  const cleaned = country.trim();
  return cleaned.slice(0, 2).toUpperCase();
}

// Global country selector for the top bar. Constrained to the user's scope.
export function CountrySelector() {
  const { country, setCountry, available } = useCountry();
  return (
    <label className="country-selector" title="Country scope">
      <span className="country-badge" aria-hidden="true">{countryGlyph(country)}</span>
      <select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Select country scope">
        <option value="">All countries</option>
        {available.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
