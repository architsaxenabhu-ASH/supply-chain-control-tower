import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { ArrowUpRight, CheckCircle2, GitBranch, Globe2, Radar, ScrollText } from "lucide-react";

import {
  fetchApprovals,
  fetchCountryPerformanceV2,
  fetchDecisions,
  fetchExecutiveActions,
  fetchExecutiveCommandCenterV3,
  fetchReview,
  type ApiApproval,
  type ApiAuthenticatedUser,
  type ApiCountryPerformance,
  type ApiDecision,
  type ApiExecutiveAction,
  type ApiExecutiveCommandCenterV3,
} from "../../lib/api";
import { CountryEnvironment, useCountry, type EnvironmentVital } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion } from "../../motion/motion";

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0, notation: value >= 1_00_00_000 ? "compact" : "standard" }).format(value || 0);
const num = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value || 0));

const REVIEWS = ["inventory", "expiry", "open-orders", "receivables", "distributor", "country", "vertical"] as const;

type LensId = "country_manager" | "general_manager" | "supply_chain" | "finance";
const LENSES: { id: LensId; label: string; tagline: string; perms: string[] }[] = [
  { id: "country_manager", label: "Country Manager", tagline: "My station", perms: ["country_dashboard", "import_approval", "shipment_approval"] },
  { id: "general_manager", label: "General Manager", tagline: "The map", perms: ["audit", "reports_export"] },
  { id: "supply_chain", label: "Supply Chain", tagline: "The flow", perms: ["goods_receipt", "dispatch", "inventory_approval", "inventory_value"] },
  { id: "finance", label: "Finance", tagline: "The ledger", perms: ["reports_export", "audit"] },
];

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key === "critical") return "risk-critical";
  if (key === "high") return "risk-high";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

// Count-up for the calm hero vitals (respects reduced motion).
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const start = useRef<number | null>(null);
  const done = useRef(!enabled);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      done.current = true;
      return;
    }
    start.current = null;
    done.current = false; // restart when the target changes (e.g. lens switch)
  }, [target, enabled]);
  useAnimationFrame((t) => {
    if (done.current) return;
    if (start.current === null) start.current = t;
    const progress = Math.min((t - start.current) / 900, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setValue(target * eased);
    if (progress >= 1) {
      setValue(target);
      done.current = true;
    }
  });
  return value;
}

type Vital = { label: string; value: number; kind: "currency" | "number" | "percent"; tone?: string };

function formatVital(v: Vital, animated: number): string {
  if (v.kind === "currency") return inr(animated);
  if (v.kind === "percent") return `${Math.round(animated)}%`;
  return num(animated);
}

function VitalReadout({ vital, animate }: { vital: Vital; animate: boolean }) {
  const animated = useCountUp(vital.value, animate);
  return (
    <div className={`vital tone-${vital.tone ?? "neutral"}`}>
      <strong>{formatVital(vital, animate ? animated : vital.value)}</strong>
      <span>{vital.label}</span>
    </div>
  );
}

export function CommandCenter({
  currentUser,
  onNavigate,
}: {
  currentUser: ApiAuthenticatedUser;
  onNavigate: (view: string) => void;
}) {
  const { country } = useCountry();
  const reduced = prefersReducedMotion();
  const isAdmin = currentUser.role_name === "Admin";
  const can = (permission: string) => isAdmin || currentUser.permissions.includes(permission);

  const availableLenses = useMemo(
    () => LENSES.filter((lens) => isAdmin || lens.perms.some((p) => currentUser.permissions.includes(p))),
    [currentUser, isAdmin],
  );
  const [lens, setLens] = useState<LensId>(availableLenses[0]?.id ?? "general_manager");

  const [summary, setSummary] = useState<ApiExecutiveCommandCenterV3 | null>(null);
  const [actions, setActions] = useState<ApiExecutiveAction[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [decisions, setDecisions] = useState<ApiDecision[]>([]);
  const [performance, setPerformance] = useState<ApiCountryPerformance[]>([]);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchExecutiveCommandCenterV3(),
      fetchExecutiveActions(),
      fetchApprovals("pending"),
      fetchDecisions("open"),
      fetchCountryPerformanceV2(),
      Promise.all(REVIEWS.map((name) => fetchReview(name).then((r) => [name, r.items.length] as const).catch(() => [name, 0] as const))),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setSummary(results[0].value);
      if (results[1].status === "fulfilled") setActions(results[1].value);
      if (results[2].status === "fulfilled") setApprovals(results[2].value);
      if (results[3].status === "fulfilled") setDecisions(results[3].value);
      if (results[4].status === "fulfilled") setPerformance(results[4].value);
      if (results[5].status === "fulfilled") setReviewCounts(Object.fromEntries(results[5].value));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const cc = summary?.command_center_v2;
  const critical = actions.filter((a) => a.severity.toLowerCase() === "critical").length;
  const signals = actions.slice(0, 7);
  const countryRow = country ? performance.find((p) => p.name.toLowerCase() === country.toLowerCase()) : undefined;

  const vitals: Vital[] = useMemo(() => {
    if (!cc || !summary) return [];
    const seesFinance = can("reports_export") || can("audit") || isAdmin;
    if (lens === "finance" && seesFinance) {
      return [
        { label: "Net exposure", value: summary.net_exposure, kind: "currency", tone: summary.net_exposure < 0 ? "warn" : "good" },
        { label: "Receivables", value: summary.receivables_outstanding, kind: "currency" },
        { label: "Payables", value: summary.payables_outstanding, kind: "currency" },
        { label: "Payment risks", value: summary.payment_risk_count, kind: "number", tone: summary.payment_risk_count ? "bad" : "good" },
      ];
    }
    if (lens === "supply_chain") {
      const expiryRisk = cc.highest_expiry_risk_products?.length ?? 0;
      return [
        { label: "Available inventory", value: cc.available_inventory ?? 0, kind: "number" },
        { label: "Inventory value", value: cc.total_inventory_value ?? 0, kind: "currency" },
        { label: "Shipments delayed", value: cc.shipments_delayed ?? 0, kind: "number", tone: cc.shipments_delayed ? "warn" : "good" },
        { label: "Expiry-risk products", value: expiryRisk, kind: "number", tone: expiryRisk ? "warn" : "good" },
      ];
    }
    // country_manager / general_manager
    return [
      { label: "Inventory value", value: cc.total_inventory_value, kind: "currency" },
      { label: "Open signals", value: actions.length, kind: "number", tone: critical ? "bad" : actions.length ? "warn" : "good" },
      { label: "Net exposure", value: summary.net_exposure, kind: "currency", tone: summary.net_exposure < 0 ? "warn" : "good" },
      { label: "Demand coverage", value: cc.demand_coverage_pct ?? 0, kind: "percent" },
    ];
  }, [cc, summary, lens, actions.length, critical, can, isAdmin]);

  const environmentVitals: EnvironmentVital[] = useMemo(() => {
    if (countryRow) {
      return [
        { label: "Achievement", value: countryRow.value_achievement_pct == null ? "—" : `${countryRow.value_achievement_pct}%`, tone: achievementTone(countryRow.value_achievement_pct) },
        { label: "Actual", value: inr(countryRow.actual_value) },
        { label: "Open signals", value: String(actions.length), tone: critical ? "bad" : "neutral" },
      ];
    }
    if (cc) {
      return [
        { label: "Inventory value", value: inr(cc.total_inventory_value) },
        { label: "Open signals", value: String(actions.length), tone: critical ? "bad" : actions.length ? "warn" : "good" },
        { label: "Shipments in motion", value: String(cc.shipments_delayed + cc.shipments_missing_documents) },
      ];
    }
    return [];
  }, [countryRow, cc, actions.length, critical]);

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  const situational =
    critical > 0
      ? `${actions.length} signals need you · ${critical} critical`
      : actions.length > 0
        ? `${actions.length} signals need you · none critical`
        : "All clear — no open signals";

  return (
    <div className="cockpit">
      {/* Immersive country station */}
      <CountryEnvironment vitals={environmentVitals} />

      {/* Mission-status hero */}
      <section className="cockpit-hero">
        <div className="cockpit-current" aria-hidden="true" />
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Mission status · {greeting()}</p>
            <h2>{currentUser.full_name?.split(" ")[0] || "Welcome"} — {situational}</h2>
          </div>
          {availableLenses.length > 1 ? (
            <div className="lens-switch" role="tablist" aria-label="Executive lens">
              {availableLenses.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={lens === option.id}
                  className={lens === option.id ? "lens-chip active" : "lens-chip"}
                  onClick={() => setLens(option.id)}
                >
                  <span>{option.label}</span>
                  <small>{option.tagline}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="vitals-row">
          {vitals.map((vital) => (
            <VitalReadout key={vital.label} vital={vital} animate={!reduced} />
          ))}
        </div>
      </section>

      {/* Signal board — risk as living signals */}
      <section className="signal-board">
        <div className="signal-head">
          <div className="signal-title">
            <Radar size={17} aria-hidden="true" />
            <h3>Signal board</h3>
          </div>
          <span className="signal-meta">{actions.length} open · {critical} critical</span>
        </div>
        {signals.length === 0 ? (
          <div className="signal-empty">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>No open signals. The board is calm — exactly where you want it.</p>
          </div>
        ) : (
          <motion.ul className="signal-list" variants={reduced ? undefined : listVariants} initial={reduced ? undefined : "hidden"} animate={reduced ? undefined : "visible"}>
            {signals.map((signal, index) => {
              const sev = severityClass(signal.severity);
              return (
                <motion.li
                  key={`${signal.action_type}-${signal.reference}-${index}`}
                  className={`signal ${sev} ${signal.severity.toLowerCase() === "critical" ? "is-critical" : ""}`}
                  variants={reduced ? undefined : itemVariants}
                >
                  <span className={`signal-pulse ${sev}`} aria-hidden="true" />
                  <div className="signal-body">
                    <strong>{signal.title}</strong>
                    {signal.detail ? <small>{signal.detail}</small> : null}
                    <span className="signal-source">{signal.source.replace(/_/g, " ")}</span>
                  </div>
                  <button type="button" className="signal-act" onClick={() => onNavigate(routeFor(signal.source))}>
                    Review <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </section>

      {/* Country league (general manager / country) */}
      {(lens === "general_manager" || lens === "country_manager") && performance.length > 0 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <h2>{country ? `${country} performance` : "Country performance"}</h2>
            <span>{country ? "your station" : "the map"}</span>
          </div>
          <div className="league">
            {(country ? performance.filter((p) => p.name.toLowerCase() === country.toLowerCase()) : performance).slice(0, 6).map((row) => (
              <div className="league-row" key={row.name}>
                <span className="league-name">{row.name}</span>
                <div className="league-bar">
                  <span style={{ width: `${Math.min(row.value_achievement_pct ?? 0, 100)}%` }} data-state={achievementState(row.value_achievement_pct)} />
                </div>
                <strong className="league-pct">{row.value_achievement_pct == null ? "—" : `${row.value_achievement_pct}%`}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Worklists */}
      <div className="cockpit-columns">
        <Worklist title="My approvals" meta={`${approvals.length} pending`} icon={CheckCircle2} onMore={() => onNavigate("security")}>
          {approvals.length === 0 ? (
            <p className="empty-state">No approvals waiting on you.</p>
          ) : (
            approvals.slice(0, 5).map((a) => (
              <WorklistRow key={a.approval_id} title={a.approval_type.replace(/_/g, " ")} detail={a.reason ?? a.reference ?? a.requestor} tag={a.request_date} />
            ))
          )}
        </Worklist>

        <Worklist title="Open decisions" meta={`${decisions.length} open`} icon={GitBranch}>
          {decisions.length === 0 ? (
            <p className="empty-state">No open decisions logged.</p>
          ) : (
            decisions.slice(0, 5).map((d) => (
              <WorklistRow key={d.decision_id} title={d.decision_type} detail={d.problem_type?.replace(/_/g, " ") ?? d.reason} tag={d.owner?.replace(/_/g, " ")} />
            ))
          )}
        </Worklist>

        <Worklist title="Reviews to run" meta="this week" icon={ScrollText}>
          <div className="cc-reviews">
            {REVIEWS.map((name) => (
              <button className="cc-review-chip" key={name} type="button" onClick={() => onNavigate("analytics")}>
                <span>{name.replace(/-/g, " ")}</span>
                <strong>{reviewCounts[name] ?? 0}</strong>
              </button>
            ))}
          </div>
        </Worklist>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function achievementState(pct: number | null): string {
  if (pct == null) return "none";
  if (pct >= 100) return "strong";
  if (pct >= 70) return "ok";
  return "low";
}

function achievementTone(pct: number | null): EnvironmentVital["tone"] {
  if (pct == null) return "neutral";
  if (pct >= 100) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

function routeFor(source: string): string {
  switch (source) {
    case "inventory":
    case "release":
      return "inventory";
    case "shipments":
      return "goods-tracking";
    case "demand":
    case "receivables":
    case "credit_control":
      return "analytics";
    default:
      return "analytics";
  }
}

function Worklist({
  title,
  meta,
  icon: Icon,
  children,
  onMore,
}: {
  title: string;
  meta: string;
  icon: typeof Globe2;
  children: React.ReactNode;
  onMore?: () => void;
}) {
  return (
    <section className="panel cockpit-panel worklist">
      <div className="panel-heading">
        <div className="worklist-title">
          <Icon size={16} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        <div className="cc-panel-meta">
          <span>{meta}</span>
          {onMore ? (
            <button type="button" className="cc-more" onClick={onMore} aria-label={`Open ${title}`}>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="worklist-body">{children}</div>
    </section>
  );
}

function WorklistRow({ title, detail, tag }: { title: string; detail?: string | null; tag?: string | null }) {
  return (
    <div className="worklist-row">
      <div>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
      {tag ? <span className="tag">{tag}</span> : null}
    </div>
  );
}
