import { formatMoney, formatUnits } from "../../lib/currency";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PackageOpen, ShieldAlert } from "lucide-react";

import {
  fetchConsignmentDashboard,
  fetchConsignmentRisks,
  fetchConsignments,
  type ApiConsignment,
  type ApiConsignmentDashboard,
  type ApiConsignmentRisk,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Consignment (Phase 5A): stock that left the warehouse but is still ours.
// Dashboard vitals, distributor-reported balances, and risk lanes.

const num = formatUnits;

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function riskPill(level: string): string {
  const key = level.toLowerCase();
  if (key === "critical" || key === "high") return "risk-critical";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

export function Consignment() {
  const reduced = prefersReducedMotion();
  const { country } = useCountry();
  const [rows, setRows] = useState<ApiConsignment[]>([]);
  const [dashboard, setDashboard] = useState<ApiConsignmentDashboard | null>(null);
  const [risks, setRisks] = useState<ApiConsignmentRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchConsignments({ country: country || undefined }),
      fetchConsignmentDashboard(),
      fetchConsignmentRisks(),
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
  }, [country]);

  const consumptionPct = useMemo(() => {
    const sent = rows.reduce((sum, row) => sum + row.quantity_sent, 0);
    const consumed = rows.reduce((sum, row) => sum + row.quantity_consumed, 0);
    return sent > 0 ? Math.round((consumed / sent) * 100) : null;
  }, [rows]);

  if (loading) {
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
      key={`consignment-${country}`}
      variants={signatureVariants("rise", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Consignment · {country || "all stations"}</p>
            <h2>
              {rows.length === 0
                ? "No consignment stock in the field"
                : `${num(rows.reduce((sum, row) => sum + row.quantity_remaining, 0))} units with distributors`}
            </h2>
          </div>
        </div>
        {dashboard ? (
          <div className="vitals-row">
            <div className="vital">
              <strong>{dashboard.total_consignments}</strong>
              <span>Consignments</span>
            </div>
            <div className="vital">
              <strong>{consumptionPct == null ? "—" : `${consumptionPct}%`}</strong>
              <span>Consumed</span>
            </div>
            <div className={`vital ${dashboard.no_report_count > 0 ? "tone-warn" : "tone-good"}`}>
              <strong>{dashboard.no_report_count}</strong>
              <span>Never reported</span>
            </div>
            <div className={`vital ${dashboard.high_risk_count > 0 ? "tone-bad" : "tone-good"}`}>
              <strong>{dashboard.high_risk_count}</strong>
              <span>High risk</span>
            </div>
          </div>
        ) : null}
      </section>

      <div className="finance-columns">
        <section className="panel cockpit-panel finance-ledger">
          <div className="panel-heading">
            <div className="worklist-title">
              <PackageOpen size={16} aria-hidden="true" />
              <h2>Field stock</h2>
            </div>
            <span className="cc-panel-meta">{rows.length}</span>
          </div>
          {rows.length === 0 ? (
            <p className="empty-state">
              No consignment stock{country ? ` in ${country}` : ""}. Records appear when stock ships on consignment.
            </p>
          ) : (
            <motion.ul
              className="finance-rows"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {rows.slice(0, 40).map((row) => (
                <motion.li className="finance-row" key={row.consignment_id} variants={reduced ? undefined : itemVariants}>
                  <div className="finance-row-main">
                    <div className="finance-row-head">
                      <strong>{row.material}</strong>
                      <span className="tag">{row.batch_number}</span>
                    </div>
                    <small>
                      {row.distributor} · {row.country} · sent {row.sent_date}
                      {row.last_report_date ? ` · last report ${row.last_report_date}` : " · never reported"}
                    </small>
                  </div>
                  <div className="finance-row-figures">
                    <span>
                      <small>Sent</small> {num(row.quantity_sent)}
                    </span>
                    <span>
                      <small>Consumed</small> {num(row.quantity_consumed)}
                    </span>
                    <span>
                      <small>Remaining</small> <strong>{num(row.quantity_remaining)}</strong>
                    </span>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>

        <aside className="decision-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldAlert size={15} aria-hidden="true" />
                <h2>Consignment risk</h2>
              </div>
              <span className="cc-panel-meta">{risks.length}</span>
            </div>
            {risks.length === 0 ? (
              <p className="empty-state">No flagged consignments. Risk appears when reports stop or stock ages.</p>
            ) : (
              <div className="worklist-body">
                {risks.slice(0, 8).map((risk) => (
                  <div className="worklist-row decision-similar" key={risk.consignment_id}>
                    <div>
                      <strong>
                        {risk.material} · {risk.distributor}
                      </strong>
                      <small>{risk.recommended_action}</small>
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
