import { formatMoney, formatUnits } from "../../lib/currency";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Target, TrendingUp } from "lucide-react";

import {
  fetchCountryPerformanceV2,
  fetchCustomerPerformance,
  fetchDistributorPerformanceV2,
  fetchVerticalPerformance,
  setCommercialTarget,
  type ApiAuthenticatedUser,
  type ApiPerformanceScorecard,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { useDemoRevision } from "../../lib/useDemoRevision";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Commercial Performance (Phase 5A): the management drill-down —
// Country → Vertical → Distributor → Customer. Target vs actual at every
// level, diagnostics on demand, targets set in place (never hardcoded).

type Level = "country" | "vertical" | "distributor" | "customer";

const LEVELS: Level[] = ["country", "vertical", "distributor", "customer"];

const inr = (value: number) => formatMoney(value, { compact: true });
const num = formatUnits;

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function achievementState(pct: number | null): string {
  if (pct == null) return "none";
  if (pct >= 100) return "strong";
  if (pct >= 70) return "ok";
  return "low";
}

type Path = { country?: string; vertical?: string; distributor?: string };

export function CommercialPerformance({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const { country: envCountry } = useCountry();
  const injectRev = useDemoRevision();
  const [path, setPath] = useState<Path>({});
  const [rows, setRows] = useState<ApiPerformanceScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [targetFor, setTargetFor] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const canSetTargets =
    currentUser.role_name === "Admin" || currentUser.permissions.includes("reports_export");

  // The country environment selector steers the starting level.
  useEffect(() => {
    setPath(envCountry ? { country: envCountry } : {});
  }, [envCountry]);

  const level: Level = !path.country
    ? "country"
    : !path.vertical
      ? "vertical"
      : !path.distributor
        ? "distributor"
        : "customer";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setMessage(null);
    setTargetFor(null);
    const request =
      level === "country"
        ? fetchCountryPerformanceV2()
        : level === "vertical"
          ? fetchVerticalPerformance(path.country)
          : level === "distributor"
            ? fetchDistributorPerformanceV2({ country: path.country, vertical: path.vertical })
            : fetchCustomerPerformance({
                country: path.country,
                vertical: path.vertical,
                distributor: path.distributor,
              });
    request
      .then((result) => {
        if (!active) return;
        setRows(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [level, path.country, path.vertical, path.distributor, injectRev]);

  const totals = useMemo(() => {
    const actual = rows.reduce((sum, row) => sum + (row.actual_value || 0), 0);
    const target = rows.reduce((sum, row) => sum + (row.target_value || 0), 0);
    const quantity = rows.reduce((sum, row) => sum + (row.actual_quantity || 0), 0);
    return {
      actual,
      target,
      quantity,
      pct: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  }, [rows]);

  const drill = (name: string) => {
    if (level === "country") setPath({ country: name });
    else if (level === "vertical") setPath({ ...path, vertical: name });
    else if (level === "distributor") setPath({ ...path, distributor: name });
  };

  const jumpTo = (target: Level) => {
    if (target === "country") setPath({});
    else if (target === "vertical") setPath({ country: path.country });
    else if (target === "distributor") setPath({ country: path.country, vertical: path.vertical });
  };

  const handleSaveTarget = async (name: string) => {
    const value = Number(targetValue);
    const quantity = Number(targetQuantity);
    if (!Number.isFinite(value) && !Number.isFinite(quantity)) {
      setMessage({ tone: "bad", text: "Enter a target value or quantity." });
      return;
    }
    setSavingTarget(true);
    setMessage(null);
    try {
      await setCommercialTarget({
        scope: level,
        scope_value: name,
        target_value: Number.isFinite(value) ? value : 0,
        target_quantity: Number.isFinite(quantity) ? quantity : 0,
        actor: currentUser.email,
      });
      setMessage({ tone: "good", text: `Target saved for ${name}.` });
      setTargetFor(null);
      setTargetValue("");
      setTargetQuantity("");
      // Refresh the level so achievement bars pick up the new target.
      setPath({ ...path });
    } catch (saveError) {
      setMessage({
        tone: "bad",
        text: saveError instanceof Error ? saveError.message : "The target could not be saved.",
      });
    } finally {
      setSavingTarget(false);
    }
  };

  const crumbs: { level: Level; label: string }[] = [
    { level: "country", label: "Countries" },
    ...(path.country ? [{ level: "vertical" as Level, label: path.country }] : []),
    ...(path.vertical ? [{ level: "distributor" as Level, label: path.vertical }] : []),
    ...(path.distributor ? [{ level: "customer" as Level, label: path.distributor }] : []),
  ];

  return (
    <div className="commercial-perf">
      <nav className="drill-path" aria-label="Drill-down path">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span className="drill-crumb-wrap" key={`${crumb.level}-${crumb.label}`}>
              {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {isLast ? (
                <span className="drill-crumb current" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <button type="button" className="drill-crumb" onClick={() => jumpTo(crumb.level)}>
                  {crumb.label}
                </button>
              )}
            </span>
          );
        })}
        <span className="drill-level tag">{humanize(level)} level</span>
      </nav>

      <motion.section
        key={`${level}-${path.country}-${path.vertical}-${path.distributor}`}
        className="panel cockpit-panel commercial-stage"
        variants={signatureVariants("network", reduced)}
        initial="initial"
        animate="animate"
      >
        <div className="panel-heading">
          <div className="worklist-title">
            <TrendingUp size={16} aria-hidden="true" />
            <h2>{humanize(level)} performance</h2>
          </div>
          <span>
            {totals.pct == null ? "no targets yet" : `${totals.pct}% of target`} · {inr(totals.actual)} ·{" "}
            {num(totals.quantity)} units
          </span>
        </div>

        {message ? (
          <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
            {message.text}
          </p>
        ) : null}

        {loading ? (
          <div className="cc-loading" aria-busy="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : error ? (
          <p className="empty-state">Performance data is unavailable. Check that the backend is running.</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">
            No {level} data here yet. Performance appears as soon as dispatches and targets exist for this scope.
          </p>
        ) : (
          <motion.ul
            className="score-grid"
            variants={reduced ? undefined : listVariants}
            initial={reduced ? undefined : "hidden"}
            animate={reduced ? undefined : "visible"}
          >
            {rows.map((row) => {
              const diagnostics = Object.entries(row.diagnostics ?? {});
              const targetOpen = targetFor === row.name;
              return (
                <motion.li className="score-card" key={`${row.scope}-${row.name}`} variants={reduced ? undefined : itemVariants}>
                  <div className="score-head">
                    <strong className="score-name">{row.name}</strong>
                    {row.growth_pct != null ? (
                      <span className={`risk-pill ${row.growth_pct >= 0 ? "risk-low" : "risk-high"}`}>
                        {row.growth_pct >= 0 ? "+" : ""}
                        {row.growth_pct}%
                      </span>
                    ) : null}
                  </div>
                  <div className="league-bar">
                    <span
                      style={{ width: `${Math.min(row.value_achievement_pct ?? 0, 100)}%` }}
                      data-state={achievementState(row.value_achievement_pct)}
                    />
                  </div>
                  <div className="score-figures">
                    <span>
                      <small>Value</small> {inr(row.actual_value)}
                      {row.target_value > 0 ? ` / ${inr(row.target_value)}` : ""}
                    </span>
                    <span>
                      <small>Qty</small> {num(row.actual_quantity)}
                      {row.target_quantity > 0 ? ` / ${num(row.target_quantity)}` : ""}
                    </span>
                    <strong className="score-pct">
                      {row.value_achievement_pct == null ? "—" : `${row.value_achievement_pct}%`}
                    </strong>
                  </div>
                  {diagnostics.length > 0 ? (
                    <div className="score-diagnostics">
                      {diagnostics.slice(0, 3).map(([key, value]) => (
                        <span key={key}>
                          <small>{humanize(key)}</small> {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {targetOpen ? (
                    <div className="score-target-form">
                      <input
                        type="number"
                        min="0"
                        placeholder="Target value (INR)"
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                        aria-label={`Target value for ${row.name}`}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Target qty"
                        value={targetQuantity}
                        onChange={(event) => setTargetQuantity(event.target.value)}
                        aria-label={`Target quantity for ${row.name}`}
                      />
                      <button type="button" className="review-decide-save" disabled={savingTarget} onClick={() => handleSaveTarget(row.name)}>
                        {savingTarget ? "Saving…" : "Save"}
                      </button>
                      <button type="button" className="secondary-action" onClick={() => setTargetFor(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="score-actions">
                      {level !== "customer" ? (
                        <button type="button" className="signal-act" onClick={() => drill(row.name)}>
                          Open {LEVELS[LEVELS.indexOf(level) + 1]}s <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                      {canSetTargets ? (
                        <button
                          type="button"
                          className="score-set-target"
                          onClick={() => {
                            setTargetFor(row.name);
                            setTargetValue(row.target_value ? String(row.target_value) : "");
                            setTargetQuantity(row.target_quantity ? String(row.target_quantity) : "");
                          }}
                        >
                          <Target size={13} aria-hidden="true" /> Set target
                        </button>
                      ) : null}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.section>
    </div>
  );
}
