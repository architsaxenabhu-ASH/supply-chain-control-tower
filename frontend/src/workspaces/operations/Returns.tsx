import { formatMoney, formatUnits } from "../../lib/currency";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw, Search } from "lucide-react";

import {
  fetchReturnDashboard,
  fetchReturns,
  inspectReturn,
  verifyReturn,
  type ApiAuthenticatedUser,
  type ApiReturnDashboard,
  type ApiReturnRecord,
} from "../../lib/api";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Returns (Phase 5A): the return loop — returned → inspection → verification →
// available or rejected. Inspect and verify happen right on the row.

const num = formatUnits;

const STATUS_FILTERS = ["all", "returned", "inspection", "verification", "available", "rejected"] as const;

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusPill(status: string): string {
  if (status === "available") return "risk-low";
  if (status === "rejected") return "risk-critical";
  if (status === "returned") return "risk-medium";
  return "tag";
}

export function Returns({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const [rows, setRows] = useState<ApiReturnRecord[]>([]);
  const [dashboard, setDashboard] = useState<ApiReturnDashboard | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [reusableQty, setReusableQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const canInspect =
    currentUser.role_name === "Admin" ||
    currentUser.permissions.includes("goods_receipt") ||
    currentUser.permissions.includes("inventory_count");

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      fetchReturns({ status: statusFilter === "all" ? undefined : statusFilter }),
      fetchReturnDashboard(),
    ]).then(([list, dash]) => {
      if (list.status === "fulfilled") setRows(list.value);
      if (dash.status === "fulfilled") setDashboard(dash.value);
      setLoading(false);
    });
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInspect = async (row: ApiReturnRecord) => {
    const reusable = Number(reusableQty) || 0;
    const rejected = Number(rejectedQty) || 0;
    if (reusable + rejected <= 0) {
      setMessage({ tone: "bad", text: "Enter the reusable and/or rejected quantities found in inspection." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = reusable > 0 && rejected > 0 ? "partial" : rejected > 0 ? "fail" : "pass";
      await inspectReturn(row.return_id, {
        inspection_result: result,
        reusable_quantity: reusable,
        rejected_quantity: rejected,
        actor: currentUser.email,
      });
      setMessage({ tone: "good", text: `Inspection recorded for ${row.material}. It now waits for verification.` });
      setWorkingId(null);
      setReusableQty("");
      setRejectedQty("");
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The inspection could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (row: ApiReturnRecord, result: "pass" | "fail") => {
    setSaving(true);
    setMessage(null);
    try {
      await verifyReturn(row.return_id, { verification_result: result, actor: currentUser.email });
      setMessage({
        tone: "good",
        text:
          result === "pass"
            ? `${row.material} verified — reusable stock returns to inventory.`
            : `${row.material} rejected at verification.`,
      });
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The verification could not be saved." });
    } finally {
      setSaving(false);
    }
  };

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
      key={statusFilter}
      variants={signatureVariants("loop", reduced)}
      initial="initial"
      animate="animate"
    >
      <section className="cockpit-hero finance-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Returns · the loop back</p>
            <h2>
              {dashboard && dashboard.total_returns > 0
                ? `${dashboard.pending_inspection + dashboard.pending_verification} returns waiting on you`
                : "No returns in the loop"}
            </h2>
          </div>
          <div className="lane-switch" role="tablist" aria-label="Return status">
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
              <strong>{dashboard.total_returns}</strong>
              <span>Total returns</span>
            </div>
            <div className={`vital ${dashboard.pending_inspection > 0 ? "tone-warn" : "tone-good"}`}>
              <strong>{dashboard.pending_inspection}</strong>
              <span>Awaiting inspection</span>
            </div>
            <div className={`vital ${dashboard.pending_verification > 0 ? "tone-warn" : "tone-good"}`}>
              <strong>{dashboard.pending_verification}</strong>
              <span>Awaiting verification</span>
            </div>
            <div className="vital tone-good">
              <strong>{num(dashboard.available_quantity)}</strong>
              <span>Back in stock</span>
            </div>
          </div>
        ) : null}
      </section>

      {message ? (
        <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}

      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <RotateCcw size={16} aria-hidden="true" />
            <h2>Return records</h2>
          </div>
          <span className="cc-panel-meta">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty-state">
            No {statusFilter === "all" ? "" : humanize(statusFilter).toLowerCase() + " "}returns. Returns enter the
            loop when stock comes back from the field.
          </p>
        ) : (
          <motion.ul
            className="finance-rows"
            variants={reduced ? undefined : listVariants}
            initial={reduced ? undefined : "hidden"}
            animate={reduced ? undefined : "visible"}
          >
            {rows.slice(0, 40).map((row) => {
              const working = workingId === row.return_id;
              return (
                <motion.li className="finance-row" key={row.return_id} variants={reduced ? undefined : itemVariants}>
                  <div className="finance-row-main">
                    <div className="finance-row-head">
                      <strong>{row.material}</strong>
                      {row.batch_number ? <span className="tag">{row.batch_number}</span> : null}
                      <span className={`risk-pill ${statusPill(row.status)}`}>{humanize(row.status)}</span>
                    </div>
                    <small>
                      {num(row.returned_quantity)} returned
                      {row.return_reason ? ` · ${row.return_reason}` : ""}
                      {row.reusable_quantity > 0 ? ` · ${num(row.reusable_quantity)} reusable` : ""}
                      {row.rejected_quantity > 0 ? ` · ${num(row.rejected_quantity)} rejected` : ""}
                    </small>
                  </div>
                  {canInspect && (row.status === "returned" || row.status === "inspection") ? (
                    working ? (
                      <div className="score-target-form">
                        <input
                          type="number"
                          min="0"
                          placeholder="Reusable qty"
                          value={reusableQty}
                          onChange={(event) => setReusableQty(event.target.value)}
                          aria-label={`Reusable quantity for ${row.material}`}
                          autoFocus
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Rejected qty"
                          value={rejectedQty}
                          onChange={(event) => setRejectedQty(event.target.value)}
                          aria-label={`Rejected quantity for ${row.material}`}
                        />
                        <button type="button" className="review-decide-save" disabled={saving} onClick={() => handleInspect(row)}>
                          {saving ? "Saving…" : "Record"}
                        </button>
                        <button type="button" className="secondary-action" onClick={() => setWorkingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="signal-act"
                        onClick={() => {
                          setWorkingId(row.return_id);
                          setReusableQty("");
                          setRejectedQty("");
                        }}
                      >
                        <Search size={14} aria-hidden="true" /> Inspect
                      </button>
                    )
                  ) : canInspect && row.status === "verification" ? (
                    <div className="approval-actions">
                      <button type="button" className="approval-approve" disabled={saving} onClick={() => handleVerify(row, "pass")}>
                        <CheckCircle2 size={15} aria-hidden="true" /> Verify
                      </button>
                      <button type="button" className="approval-reject" disabled={saving} onClick={() => handleVerify(row, "fail")}>
                        Reject
                      </button>
                    </div>
                  ) : null}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </section>
    </motion.div>
  );
}
