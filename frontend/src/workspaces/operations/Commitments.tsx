import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Handshake, ShieldAlert } from "lucide-react";

import {
  fetchCommitmentDashboard,
  fetchCommitmentRisks,
  fetchCustomerCommitments,
  type ApiCommitmentDashboard,
  type ApiCommitmentRisk,
  type ApiCustomerCommitment,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Commitments (Phase 5A): promises made to customers — PO fill rate, OTIF,
// backorders, and the risks that threaten them.

const num = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value || 0));
const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: value >= 1_00_00_000 ? "compact" : "standard",
  }).format(value || 0);

const STATUS_FILTERS = ["all", "open", "partially_fulfilled", "delayed", "backordered", "fulfilled"] as const;

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusPill(status: string): string {
  if (status === "fulfilled") return "risk-low";
  if (status === "delayed" || status === "backordered") return "risk-critical";
  if (status === "partially_fulfilled") return "risk-medium";
  return "tag";
}

function riskPill(level: string): string {
  const key = level.toLowerCase();
  if (key === "critical" || key === "high") return "risk-critical";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

export function Commitments() {
  const reduced = prefersReducedMotion();
  const { country } = useCountry();
  const [rows, setRows] = useState<ApiCustomerCommitment[]>([]);
  const [dashboard, setDashboard] = useState<ApiCommitmentDashboard | null>(null);
  const [risks, setRisks] = useState<ApiCommitmentRisk[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchCustomerCommitments({
        status: statusFilter === "all" ? undefined : statusFilter,
        country: country || undefined,
      }),
      fetchCommitmentDashboard(),
      fetchCommitmentRisks(),
    ]).then(([list, dash, riskRows]) => {
      if (!active) return;
      if (list.status === "fulfilled") setRows(list.value);
      if (dash.status === "fulfilled") setDashboard(dash.value);
      if (riskRows.status === "fulfilled") setRisks(riskRows.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [statusFilter, country]);

  if (loading && rows.length === 0) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <motion.div
      className="finance-stage"
      key={`commitments-${country}-${statusFilter}`}
      variants={signatureVariants("glide", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Customer commitments · {country || "all stations"}</p>
            <h2>
              {dashboard && dashboard.total_commitments > 0
                ? `${dashboard.open_commitments} open promises · ${
                    dashboard.otif_pct == null ? "OTIF pending" : `${Math.round(dashboard.otif_pct)}% OTIF`
                  }`
                : "No customer commitments recorded"}
            </h2>
          </div>
          <div className="lane-switch" role="tablist" aria-label="Commitment status">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={statusFilter === option}
                className={statusFilter === option ? "lens-chip active" : "lens-chip"}
                onClick={() => setStatusFilter(option)}
              >
                <span>{humanize(option)}</span>
              </button>
            ))}
          </div>
        </div>
        {dashboard ? (
          <div className="vitals-row">
            <div className="vital">
              <strong>{dashboard.average_fill_rate_pct == null ? "—" : `${Math.round(dashboard.average_fill_rate_pct)}%`}</strong>
              <span>Average fill rate</span>
            </div>
            <div className={`vital ${dashboard.delayed_commitments > 0 ? "tone-warn" : "tone-good"}`}>
              <strong>{dashboard.delayed_commitments}</strong>
              <span>Delayed</span>
            </div>
            <div className={`vital ${dashboard.backordered_commitments > 0 ? "tone-bad" : "tone-good"}`}>
              <strong>{dashboard.backordered_commitments}</strong>
              <span>Backordered</span>
            </div>
            <div className={`vital ${dashboard.total_backorder_value > 0 ? "tone-bad" : "tone-good"}`}>
              <strong>{inr(dashboard.total_backorder_value)}</strong>
              <span>Backorder value</span>
            </div>
          </div>
        ) : null}
      </section>

      <div className="finance-columns">
        <section className="panel cockpit-panel finance-ledger">
          <div className="panel-heading">
            <div className="worklist-title">
              <Handshake size={16} aria-hidden="true" />
              <h2>Promises to customers</h2>
            </div>
            <span className="cc-panel-meta">{rows.length}</span>
          </div>
          {rows.length === 0 ? (
            <p className="empty-state">
              No {statusFilter === "all" ? "" : humanize(statusFilter).toLowerCase() + " "}commitments
              {country ? ` for ${country}` : ""}. Customer POs appear here once captured.
            </p>
          ) : (
            <motion.ul
              className="finance-rows"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {rows.slice(0, 40).map((row) => {
                const fillPct =
                  row.ordered_quantity > 0 ? Math.round((row.delivered_quantity / row.ordered_quantity) * 100) : 0;
                return (
                  <motion.li className="finance-row" key={row.commitment_id} variants={reduced ? undefined : itemVariants}>
                    <div className="finance-row-main">
                      <div className="finance-row-head">
                        <strong>{row.po_number}</strong>
                        <span className="tag">{row.material}</span>
                        <span className={`risk-pill ${statusPill(row.status)}`}>{humanize(row.status)}</span>
                      </div>
                      <small>
                        {row.customer} · {row.distributor} · {row.country} · needed by {row.required_delivery_date}
                      </small>
                      <div className="league-bar commitment-bar">
                        <span style={{ width: `${Math.min(fillPct, 100)}%` }} data-state={fillPct >= 100 ? "strong" : fillPct >= 70 ? "ok" : "low"} />
                      </div>
                    </div>
                    <div className="finance-row-figures">
                      <span>
                        <small>Ordered</small> {num(row.ordered_quantity)}
                      </span>
                      <span>
                        <small>Delivered</small> {num(row.delivered_quantity)}
                      </span>
                      {row.backorder_quantity > 0 ? (
                        <span>
                          <small>Backorder</small> <strong>{num(row.backorder_quantity)}</strong>
                        </span>
                      ) : null}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </section>

        <aside className="decision-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldAlert size={15} aria-hidden="true" />
                <h2>Commitment risk</h2>
              </div>
              <span className="cc-panel-meta">{risks.length}</span>
            </div>
            {risks.length === 0 ? (
              <p className="empty-state">No commitments at risk. Risk appears when stock cannot cover a promise.</p>
            ) : (
              <div className="worklist-body">
                {risks.slice(0, 8).map((risk) => (
                  <div className="worklist-row decision-similar" key={risk.commitment_id}>
                    <div>
                      <strong>
                        {risk.po_number} · {risk.customer}
                      </strong>
                      <small>
                        {risk.material} · fill {Math.round(risk.fill_rate_pct)}%
                        {risk.delay_days > 0 ? ` · ${risk.delay_days}d late` : ""}
                        {risk.backorder_value > 0 ? ` · ${inr(risk.backorder_value)} backorder` : ""}
                      </small>
                      {risk.reasons[0] ? <small>{risk.reasons[0]}</small> : null}
                    </div>
                    <span className={`risk-pill ${riskPill(risk.risk_level)}`}>{humanize(risk.risk_level)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </motion.div>
  );
}
