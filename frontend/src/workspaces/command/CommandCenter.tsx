import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  GitBranch,
  Globe2,
  ScrollText,
  TrendingUp,
} from "lucide-react";

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
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, transition, workspaceVariants, prefersReducedMotion } from "../../motion/motion";

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const num = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value || 0));

const REVIEWS = ["inventory", "expiry", "open-orders", "receivables", "distributor", "country", "vertical"] as const;

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key === "critical") return "risk-critical";
  if (key === "high") return "risk-high";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

function reveal(reduced: boolean) {
  return reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { variants: workspaceVariants, initial: "hidden" as const, animate: "visible" as const };
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
  const can = (permission: string) => currentUser.role_name === "Admin" || currentUser.permissions.includes(permission);
  const seesFinance = can("reports_export") || can("audit") || currentUser.role_name === "Admin";

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
  const myActions = useMemo(() => {
    const owned = actions.filter((a) => (country ? true : true));
    return owned.slice(0, 8);
  }, [actions, country]);
  const visiblePerformance = useMemo(
    () => (country ? performance.filter((p) => p.name.toLowerCase() === country.toLowerCase()) : performance).slice(0, 6),
    [performance, country],
  );

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <motion.div className="command-center" {...reveal(reduced)}>
      <section className="cc-hero panel">
        <div className="cc-hero-mark">
          <Gauge size={26} aria-hidden="true" />
        </div>
        <div className="cc-hero-copy">
          <p className="eyebrow">Executive Command Center</p>
          <h2>Good {greeting()}, {currentUser.full_name?.split(" ")[0] || "there"}</h2>
          <p className="status-line">
            {country ? `Scoped to ${country}. ` : "All countries. "}
            Detect risk, review transactions, and capture decisions — the system recommends, you decide.
          </p>
        </div>
        {seesFinance && summary ? (
          <div className="cc-hero-exposure">
            <span>Net exposure</span>
            <strong className={summary.net_exposure < 0 ? "negative" : "positive"}>{currency(summary.net_exposure)}</strong>
            <small>{currency(summary.receivables_outstanding)} in · {currency(summary.payables_outstanding)} out</small>
          </div>
        ) : null}
      </section>

      {/* 1 — Sales performance */}
      <Panel title="Sales performance" meta={country || "All countries"} onMore={() => onNavigate("analytics")}>
        {visiblePerformance.length === 0 ? (
          <p className="empty-state">No commercial targets or realised sales recorded yet.</p>
        ) : (
          <div className="cc-perf-grid">
            {visiblePerformance.map((row) => (
              <div className="cc-perf-row" key={row.name}>
                <div className="cc-perf-head">
                  <span>{row.name}</span>
                  <strong>{row.value_achievement_pct == null ? "—" : `${row.value_achievement_pct}%`}</strong>
                </div>
                <div className="cc-perf-bar">
                  <span style={{ width: `${Math.min(row.value_achievement_pct ?? 0, 100)}%` }} data-state={achievementState(row.value_achievement_pct)} />
                </div>
                <small>{currency(row.actual_value)} of {currency(row.target_value)} · {row.diagnostics.sales_performance?.replace(/_/g, " ") ?? ""}</small>
              </div>
            ))}
          </div>
        )}
        {cc ? (
          <div className="cc-sales-stats">
            <Stat label="Confirmed demand" value={num(cc.confirmed_demand)} />
            <Stat label="Forecast demand" value={num(cc.forecast_demand)} />
            <Stat label="Demand coverage" value={cc.demand_coverage_pct == null ? "—" : `${cc.demand_coverage_pct}%`} />
            <Stat label="Inventory value" value={currency(cc.total_inventory_value)} />
          </div>
        ) : null}
      </Panel>

      {/* 2 — Management attention required */}
      {cc ? (
        <Panel title="Management attention required" meta={`${attentionTotal(cc, summary)} signals`}>
          <motion.div className="cc-attention" variants={reduced ? undefined : listVariants} initial={reduced ? undefined : "hidden"} animate={reduced ? undefined : "visible"}>
            <AttentionTile icon={ClipboardList} label="Open order risks" value={cc.reservations_expiring_soon + (summary?.command_center_v2 ? 0 : 0)} tone="amber" onClick={() => onNavigate("analytics")} subtitle={`${cc.shipments_missing_documents} missing docs`} />
            <AttentionTile icon={AlertTriangle} label="Expiry risks" value={cc.highest_expiry_risk_products.length} tone="crimson" onClick={() => onNavigate("expiry")} subtitle="batches near expiry" />
            {seesFinance ? <AttentionTile icon={TrendingUp} label="Receivable risks" value={summary?.payment_risk_count ?? 0} tone="amber" onClick={() => onNavigate("analytics")} subtitle="distributors" /> : null}
            {seesFinance ? <AttentionTile icon={TrendingUp} label="Payable risks" value={summary?.payables_risk_count ?? 0} tone="amber" onClick={() => onNavigate("analytics")} subtitle="partners" /> : null}
            <AttentionTile icon={ArrowRight} label="Shipment delays" value={cc.shipments_delayed} tone="crimson" onClick={() => onNavigate("goods-tracking")} subtitle="in transit" />
          </motion.div>
        </Panel>
      ) : null}

      <div className="cc-columns">
        {/* 3 — My actions */}
        <Panel title="My actions" meta={`${actions.length} open`}>
          {myActions.length === 0 ? (
            <p className="empty-state">No open actions. You are clear.</p>
          ) : (
            <motion.ul className="cc-queue" variants={reduced ? undefined : listVariants} initial={reduced ? undefined : "hidden"} animate={reduced ? undefined : "visible"}>
              {myActions.map((action, index) => (
                <motion.li className="cc-queue-row" key={`${action.action_type}-${action.reference}-${index}`} variants={reduced ? undefined : itemVariants}>
                  <span className={`risk-dot ${severityClass(action.severity)}`} aria-hidden="true" />
                  <div>
                    <strong>{action.title}</strong>
                    {action.detail ? <small>{action.detail}</small> : null}
                  </div>
                  <span className={`risk-pill ${severityClass(action.severity)}`}>{action.severity}</span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Panel>

        {/* 4 — My approvals */}
        <Panel title="My approvals" meta={`${approvals.length} pending`} onMore={() => onNavigate("security")}>
          {approvals.length === 0 ? (
            <p className="empty-state">No approvals waiting on you.</p>
          ) : (
            <ul className="cc-queue">
              {approvals.slice(0, 6).map((approval) => (
                <li className="cc-queue-row" key={approval.approval_id}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <div>
                    <strong>{approval.approval_type.replace(/_/g, " ")}</strong>
                    <small>{approval.reason ?? approval.reference ?? approval.requestor}</small>
                  </div>
                  <span className="tag">{approval.request_date}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="cc-columns">
        {/* 5 — Open decisions */}
        <Panel title="Open decisions" meta={`${decisions.length} open`}>
          {decisions.length === 0 ? (
            <p className="empty-state">No open decisions logged.</p>
          ) : (
            <ul className="cc-queue">
              {decisions.slice(0, 6).map((decision) => (
                <li className="cc-queue-row" key={decision.decision_id}>
                  <GitBranch size={16} aria-hidden="true" />
                  <div>
                    <strong>{decision.decision_type}</strong>
                    <small>{decision.problem_type?.replace(/_/g, " ") ?? decision.reason}</small>
                  </div>
                  {decision.owner ? <span className="tag">{decision.owner.replace(/_/g, " ")}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 6 — Recent reviews */}
        <Panel title="Reviews to run" meta="this week">
          <div className="cc-reviews">
            {REVIEWS.map((name) => (
              <button className="cc-review-chip" key={name} type="button" onClick={() => onNavigate("analytics")}>
                <ScrollText size={15} aria-hidden="true" />
                <span>{name.replace(/-/g, " ")}</span>
                <strong>{reviewCounts[name] ?? 0}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </motion.div>
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

function attentionTotal(cc: NonNullable<ApiExecutiveCommandCenterV3["command_center_v2"]>, summary: ApiExecutiveCommandCenterV3 | null): number {
  return (
    cc.shipments_delayed +
    cc.shipments_missing_documents +
    cc.highest_expiry_risk_products.length +
    (summary?.payment_risk_count ?? 0) +
    (summary?.payables_risk_count ?? 0)
  );
}

function Panel({ title, meta, children, onMore }: { title: string; meta: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <motion.section className="panel cc-panel" transition={transition}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <div className="cc-panel-meta">
          <span>{meta}</span>
          {onMore ? (
            <button type="button" className="cc-more" onClick={onMore} aria-label={`Open ${title}`}>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AttentionTile({
  icon: Icon,
  label,
  value,
  tone,
  subtitle,
  onClick,
}: {
  icon: typeof Globe2;
  label: string;
  value: number;
  tone: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <motion.button type="button" className={`cc-attention-tile tone-${tone}`} variants={itemVariants} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{subtitle}</small>
    </motion.button>
  );
}
