import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { prefersReducedMotion } from "../motion/motion";

// Country is a first-class *environment*, not a filter (Phase 5A design language).
// Selecting a country shifts the room's ambient accent and brings up that
// station's situation. The accent hue is derived from the country's identity —
// no hardcoded country list.
type CountryContextValue = {
  country: string; // "" = global
  setCountry: (country: string) => void;
  available: string[];
};

const CountryContext = createContext<CountryContextValue | null>(null);

const BRAND_HUE = 196; // teal — the platform's own voice, used for the global view

export function countryHue(country: string): number {
  if (!country) return BRAND_HUE;
  let hash = 0;
  for (const ch of country) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  // Avoid the brand band so a station reads as "elsewhere".
  return (hash + 40) % 360;
}

function applyAccent(country: string) {
  if (typeof document === "undefined") return;
  const hue = countryHue(country);
  const root = document.documentElement.style;
  root.setProperty("--country-accent", `oklch(0.74 0.13 ${hue})`);
  root.setProperty("--country-accent-strong", `oklch(0.7 0.16 ${hue})`);
  root.setProperty("--country-accent-soft", `oklch(0.74 0.13 ${hue} / 0.16)`);
  root.setProperty("--country-accent-glow", `oklch(0.7 0.16 ${hue} / 0.28)`);
}

export function CountryProvider({ scope, children }: { scope: string[]; children: ReactNode }) {
  const [country, setCountry] = useState<string>("");
  const available = useMemo(() => [...scope].filter(Boolean).sort(), [scope]);
  useEffect(() => {
    applyAccent(country);
  }, [country]);
  const value = useMemo(() => ({ country, setCountry, available }), [country, available]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryContextValue {
  const value = useContext(CountryContext);
  if (!value) return { country: "", setCountry: () => undefined, available: [] };
  return value;
}

export function countryGlyph(country: string): string {
  if (!country) return "GL";
  return country.trim().slice(0, 2).toUpperCase();
}

// Global country selector for the top bar. Constrained to the user's scope.
export function CountrySelector() {
  const { country, setCountry, available } = useCountry();
  return (
    <label className="country-selector" title="Operating environment">
      <span className="country-badge" aria-hidden="true">{countryGlyph(country)}</span>
      <select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Select operating environment">
        <option value="">Global view</option>
        {available.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export type EnvironmentVital = { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" };

// The immersive "station" strip. Re-mounts on country change (key) so the
// horizon sweep + accent bloom play — arriving in the environment, not filtering.
export function CountryEnvironment({ vitals }: { vitals: EnvironmentVital[] }) {
  const { country } = useCountry();
  const reduced = prefersReducedMotion();
  const label = country || "Global operations";
  const sub = country ? "Operating environment" : "All stations · consolidated";

  const entry = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
        animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      };

  return (
    <motion.section key={country || "global"} className="country-env" {...entry} aria-label={`${label} environment`}>
      <div className="country-env-horizon" aria-hidden="true" />
      <div className="country-env-id">
        <span className="country-env-ring">{countryGlyph(country)}</span>
        <div>
          <p className="country-env-sub">{sub}</p>
          <h3 className="country-env-name">{label}</h3>
        </div>
      </div>
      <div className="country-env-vitals">
        {vitals.map((vital) => (
          <div className={`country-env-vital tone-${vital.tone ?? "neutral"}`} key={vital.label}>
            <strong>{vital.value}</strong>
            <span>{vital.label}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
