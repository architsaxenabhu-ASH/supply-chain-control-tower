import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HandCoins, ShieldAlert } from "lucide-react";

import {
  fetchPayables,
  fetchPayablesRisks,
  recordPayablePayment,
  type ApiAuthenticatedUser,
  type ApiPayable,
  type ApiPayablesRisk,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Payables (Phase 5A): the money flowing out — supplier, logistics, customs
// and warehouse partners. Same ledger pattern as Receivables, mirrored.

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: value >= 1_00_00_000 ? "compact" : "standard",
  }).format(value || 0);

const STATUS_FILTERS = ["all", "open", "partially_paid", "overdue", "paid"] as const;

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusPill(status: string): string {
  if (status === "paid") return "risk-low";
  if (status === "overdue") return "risk-critical";
  if (status === "partially_paid") return "risk-medium";
  return "tag";
}

function riskPill(level: string): string {
  const key = level.toLowerCase();
  if (key === "critical" || key === "high") return "risk-critical";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

export function Payables({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const { country } = useCountry();
  const [payables, setPayables] = useState<ApiPayable[]>([]);
  const [risks, setRisks] = useState<ApiPayablesRisk[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      fetchPayables({ status: statusFilter === "all" ? undefined : statusFilter }),
      fetchPayablesRisks(),
    ]).then(([ledger, riskRows]) => {
      if (ledger.status === "fulfilled") setPayables(ledger.value);
      if (riskRows.status === "fulfilled") setRisks(riskRows.value);
      setLoading(false);
    });
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Payables carry a country; respect the selected environment client-side.
  const visible = useMemo(
    () =>
      country
        ? payables.filter((row) => row.country.toLowerCase() === country.toLowerCase())
        : payables,
    [payables, country],
  );

  const totals = useMemo(() => {
    const outstanding = visible.reduce((sum, row) => sum + (row.outstanding_value || 0), 0);
    const overdue = visible
      .filter((row) => row.status === "overdue")
      .reduce((sum, row) => sum + (row.outstanding_value || 0), 0);
    return { outstanding, overdue, count: visible.length, riskCount: risks.length };
  }, [visible, risks]);

  const handleRecordPayment = async (row: ApiPayable) => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ tone: "bad", text: "Enter the amount paid." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordPayablePayment(row.payable_id, { amount, actor: currentUser.email });
      setMessage({ tone: "good", text: `Payment of ${inr(amount)} recorded against ${row.invoice_number}.` });
      setPayingId(null);
      setPaymentAmount("");
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The payment could not be recorded." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="finance-stage"
      key={`payables-${country}`}
      variants={signatureVariants("flow", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Payables · {country || "all stations"}</p>
            <h2>{inr(totals.outstanding)} owed to partners{totals.overdue > 0 ? ` · ${inr(totals.overdue)} overdue` : ""}</h2>
          </div>
          <div className="lane-switch" role="tablist" aria-label="Payable status">
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
        <div className="vitals-row">
          <div className="vital">
            <strong>{inr(totals.outstanding)}</strong>
            <span>Outstanding</span>
          </div>
          <div className={`vital ${totals.overdue > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{inr(totals.overdue)}</strong>
            <span>Overdue</span>
          </div>
          <div className="vital">
            <strong>{totals.count}</strong>
            <span>Invoices in view</span>
          </div>
          <div className={`vital ${totals.riskCount > 0 ? "tone-warn" : "tone-good"}`}>
            <strong>{totals.riskCount}</strong>
            <span>Partner risks</span>
          </div>
        </div>
      </section>

      {message ? (
        <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}

      <div className="finance-columns">
        <section className="panel cockpit-panel finance-ledger">
          <div className="panel-heading">
            <div className="worklist-title">
              <HandCoins size={16} aria-hidden="true" />
              <h2>Partner invoices</h2>
            </div>
            <span className="cc-panel-meta">{visible.length}</span>
          </div>
          {loading ? (
            <div className="cc-loading" aria-busy="true">
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          ) : visible.length === 0 ? (
            <p className="empty-state">
              No {statusFilter === "all" ? "" : humanize(statusFilter).toLowerCase() + " "}payables
              {country ? ` for ${country}` : ""}. Partner invoices appear here once raised or uploaded.
            </p>
          ) : (
            <motion.ul
              className="finance-rows"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {visible.slice(0, 40).map((row) => (
                <motion.li className="finance-row" key={row.payable_id} variants={reduced ? undefined : itemVariants}>
                  <div className="finance-row-main">
                    <div className="finance-row-head">
                      <strong>{row.invoice_number}</strong>
                      <span className="tag">{humanize(row.partner_type)}</span>
                      <span className={`risk-pill ${statusPill(row.status)}`}>{humanize(row.status)}</span>
                    </div>
                    <small>
                      {row.partner_name} · {row.country} · due {row.due_date}
                    </small>
                  </div>
                  <div className="finance-row-figures">
                    <span>
                      <small>Invoice</small> {inr(row.invoice_value)}
                    </span>
                    <span>
                      <small>Outstanding</small> <strong>{inr(row.outstanding_value)}</strong>
                    </span>
                  </div>
                  {row.status !== "paid" ? (
                    payingId === row.payable_id ? (
                      <div className="score-target-form">
                        <input
                          type="number"
                          min="0"
                          placeholder="Amount paid"
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          aria-label={`Payment amount for ${row.invoice_number}`}
                          autoFocus
                        />
                        <button type="button" className="review-decide-save" disabled={saving} onClick={() => handleRecordPayment(row)}>
                          {saving ? "Saving…" : "Record"}
                        </button>
                        <button type="button" className="secondary-action" onClick={() => setPayingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="signal-act"
                        onClick={() => {
                          setPayingId(row.payable_id);
                          setPaymentAmount("");
                        }}
                      >
                        Record payment
                      </button>
                    )
                  ) : null}
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
                <h2>Partner risk</h2>
              </div>
              <span className="cc-panel-meta">{risks.length}</span>
            </div>
            {risks.length === 0 ? (
              <p className="empty-state">No partners are flagged. Risk appears as dues age or dependency grows.</p>
            ) : (
              <div className="worklist-body">
                {risks.slice(0, 8).map((risk) => (
                  <div className="worklist-row decision-similar" key={`${risk.partner_type}-${risk.partner_name}`}>
                    <div>
                      <strong>{risk.partner_name}</strong>
                      <small>
                        {humanize(risk.partner_type)} · {inr(risk.past_due_amount)} past due
                        {risk.days_to_next_due != null ? ` · next due in ${risk.days_to_next_due}d` : ""}
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
