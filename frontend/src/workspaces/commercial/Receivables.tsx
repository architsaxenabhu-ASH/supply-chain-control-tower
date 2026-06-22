import {
  BASE_CURRENCY,
  convertAmount,
  formatDisplay,
  formatIn,
  formatMoney,
  getCurrencyRevision,
  subscribeCurrency,
} from "../../lib/currency";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Banknote, ShieldAlert, Wallet } from "lucide-react";

import {
  fetchCreditControl,
  fetchPaymentRisks,
  fetchReceivables,
  recordReceivablePayment,
  type ApiAuthenticatedUser,
  type ApiCreditControl,
  type ApiPaymentRisk,
  type ApiReceivable,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { useDemoRevision } from "../../lib/useDemoRevision";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Receivables (Phase 5A): the money flowing in. Aging ledger, payment risk,
// credit control — and payments recorded right on the invoice row.

const inr = (value: number) => formatMoney(value, { compact: true });
// Receivables belong to the subsidiary → customer flow, so they convert on the
// secondary book at the rate locked for each invoice's own date.
const rowMoney = (value: number, currency: string | null, onDate: string | null) =>
  formatMoney(value, { compact: true, from: currency, book: "secondary", onDate });
const total = (value: number) => formatDisplay(value, { compact: true });

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

export function Receivables({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const { country } = useCountry();
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const injectRev = useDemoRevision();
  const [receivables, setReceivables] = useState<ApiReceivable[]>([]);
  const [risks, setRisks] = useState<ApiPaymentRisk[]>([]);
  const [credit, setCredit] = useState<ApiCreditControl[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const load = useCallback(() => {
    void injectRev; // re-run on every presenter click so the ledger grows live
    setLoading(true);
    Promise.allSettled([
      fetchReceivables({
        status: statusFilter === "all" ? undefined : statusFilter,
        country: country || undefined,
      }),
      fetchPaymentRisks(),
      fetchCreditControl(),
    ]).then(([ledger, riskRows, creditRows]) => {
      if (ledger.status === "fulfilled") setReceivables(ledger.value);
      if (riskRows.status === "fulfilled") setRisks(riskRows.value);
      if (creditRows.status === "fulfilled") setCredit(creditRows.value);
      setLoading(false);
    });
  }, [statusFilter, country, injectRev]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const convert = (row: ApiReceivable) =>
      convertAmount(row.outstanding_value || 0, {
        from: row.currency,
        book: "secondary",
        onDate: row.invoice_date,
      });
    const outstanding = receivables.reduce((sum, row) => sum + convert(row), 0);
    const overdue = receivables
      .filter((row) => row.status === "overdue")
      .reduce((sum, row) => sum + convert(row), 0);
    return { outstanding, overdue, count: receivables.length, riskCount: risks.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivables, risks, rev]);

  const blockedCredit = useMemo(
    () => credit.filter((row) => row.status !== "healthy").slice(0, 5),
    [credit],
  );

  const handleRecordPayment = async (row: ApiReceivable) => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ tone: "bad", text: "Enter the amount received." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordReceivablePayment(row.receivable_id, { amount, actor: currentUser.email });
      setMessage({
        tone: "good",
        text: `Payment of ${formatIn(row.currency ?? BASE_CURRENCY, amount)} recorded against ${row.invoice_number}.`,
      });
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
      key={`receivables-${country}`}
      variants={signatureVariants("flow", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Receivables · {country || "all stations"}</p>
            <h2>{total(totals.outstanding)} outstanding{totals.overdue > 0 ? ` · ${total(totals.overdue)} overdue` : ""}</h2>
          </div>
          <div className="lane-switch" role="tablist" aria-label="Receivable status">
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
            <strong>{total(totals.outstanding)}</strong>
            <span>Outstanding</span>
          </div>
          <div className={`vital ${totals.overdue > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{total(totals.overdue)}</strong>
            <span>Overdue</span>
          </div>
          <div className="vital">
            <strong>{totals.count}</strong>
            <span>Invoices in view</span>
          </div>
          <div className={`vital ${totals.riskCount > 0 ? "tone-warn" : "tone-good"}`}>
            <strong>{totals.riskCount}</strong>
            <span>Payment risks</span>
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
              <Banknote size={16} aria-hidden="true" />
              <h2>Invoice ledger</h2>
            </div>
            <span className="cc-panel-meta">{receivables.length}</span>
          </div>
          {loading ? (
            <div className="cc-loading" aria-busy="true">
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          ) : receivables.length === 0 ? (
            <p className="empty-state">
              No {statusFilter === "all" ? "" : humanize(statusFilter).toLowerCase() + " "}receivables
              {country ? ` for ${country}` : ""}. Invoices appear here as they are raised or uploaded.
            </p>
          ) : (
            <motion.ul
              className="finance-rows"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {receivables.slice(0, 40).map((row) => (
                <motion.li className="finance-row" key={row.receivable_id} variants={reduced ? undefined : itemVariants}>
                  <div className="finance-row-main">
                    <div className="finance-row-head">
                      <strong>{row.invoice_number}</strong>
                      {row.currency ? <span className="tag">{row.currency}</span> : null}
                      <span className={`risk-pill ${statusPill(row.status)}`}>{humanize(row.status)}</span>
                    </div>
                    <small>
                      {row.distributor} · {row.country} · due {row.due_date}
                    </small>
                  </div>
                  <div className="finance-row-figures">
                    <span>
                      <small>Invoice</small> {rowMoney(row.invoice_value, row.currency, row.invoice_date)}
                    </span>
                    <span>
                      <small>Outstanding</small>{" "}
                      <strong>{rowMoney(row.outstanding_value, row.currency, row.invoice_date)}</strong>
                    </span>
                  </div>
                  {row.status !== "paid" ? (
                    payingId === row.receivable_id ? (
                      <div className="score-target-form">
                        <input
                          type="number"
                          min="0"
                          placeholder="Amount received"
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
                          setPayingId(row.receivable_id);
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
                <h2>Payment risk</h2>
              </div>
              <span className="cc-panel-meta">{risks.length}</span>
            </div>
            {risks.length === 0 ? (
              <p className="empty-state">No distributors are flagged. Risk appears when invoices age.</p>
            ) : (
              <div className="worklist-body">
                {risks.slice(0, 6).map((risk) => (
                  <div className="worklist-row decision-similar" key={risk.distributor}>
                    <div>
                      <strong>{risk.distributor}</strong>
                      <small>
                        {inr(risk.past_due_amount)} past due · {risk.past_due_days}d · trend {risk.payment_trend}
                      </small>
                      {risk.reasons[0] ? <small>{risk.reasons[0]}</small> : null}
                    </div>
                    <span className={`risk-pill ${riskPill(risk.risk_level)}`}>{humanize(risk.risk_level)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Wallet size={15} aria-hidden="true" />
                <h2>Credit control</h2>
              </div>
              <span className="cc-panel-meta">{blockedCredit.length} flagged</span>
            </div>
            {blockedCredit.length === 0 ? (
              <p className="empty-state">All distributors are inside their credit limits.</p>
            ) : (
              <div className="worklist-body">
                {blockedCredit.map((row) => (
                  <div className="worklist-row decision-similar" key={row.distributor}>
                    <div>
                      <strong>{row.distributor}</strong>
                      <small>
                        {inr(row.outstanding_exposure)} of {inr(row.credit_limit)} limit
                        {row.override ? " · override active" : ""}
                      </small>
                    </div>
                    <span className={`risk-pill ${row.status === "blocked" ? "risk-critical" : "risk-medium"}`}>
                      {humanize(row.status)}
                    </span>
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
