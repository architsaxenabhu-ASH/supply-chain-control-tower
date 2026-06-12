import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, CheckCircle2, ShieldAlert, Stamp, XCircle } from "lucide-react";

import {
  decideApproval,
  fetchApprovals,
  type ApiApproval,
  type ApiAuthenticatedUser,
} from "../../lib/api";
import { itemVariants, listVariants, prefersReducedMotion, transition } from "../../motion/motion";

// Approval Center (Phase 5A): one workspace for everything waiting on a yes.
// Authority comes from permissions (never role names); Admin bypasses.
// Deciding plays the stamp signature — settle-in scale on the outcome chip.

type Lane = "pending" | "approved" | "rejected";

const LANES: { id: Lane; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

// Approval types are free-form business strings; map by keyword to the
// permission that authorizes the decision. Unknown types need Admin.
const TYPE_PERMISSIONS: { match: RegExp; permission: string }[] = [
  { match: /import|customs|clearance/i, permission: "import_approval" },
  { match: /shipment|allocation|order/i, permission: "shipment_approval" },
  { match: /dispatch|delivery/i, permission: "dispatch_approval" },
  { match: /inventory|stock|release/i, permission: "inventory_approval" },
  { match: /count|reconciliation|adjustment/i, permission: "reconciliation" },
];

function canDecide(user: ApiAuthenticatedUser, approvalType: string): boolean {
  if (user.role_name === "Admin") return true;
  const rule = TYPE_PERMISSIONS.find((entry) => entry.match.test(approvalType));
  if (!rule) return false;
  return user.permissions.includes(rule.permission);
}

function formatType(value: string): string {
  return value.replace(/[_-]/g, " ");
}

export function ApprovalCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const [lane, setLane] = useState<Lane>("pending");
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [stamped, setStamped] = useState<{ id: string; outcome: "approved" | "rejected" } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchApprovals(lane)
      .then((rows) => {
        if (!active) return;
        setApprovals(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Could not load approvals. Check that the backend is running.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lane]);

  const counts = useMemo(
    () => ({ visible: approvals.length, actionable: approvals.filter((a) => canDecide(currentUser, a.approval_type)).length }),
    [approvals, currentUser],
  );

  const handleDecide = async (approval: ApiApproval, outcome: "approved" | "rejected") => {
    setDecidingId(approval.approval_id);
    setError(null);
    try {
      await decideApproval(approval.approval_id, {
        outcome,
        approver: currentUser.email,
        note: note.trim() || null,
      });
      setStamped({ id: approval.approval_id, outcome });
      setNoteFor(null);
      setNote("");
      // Let the stamp play, then release the row from the pending lane.
      window.setTimeout(() => {
        setApprovals((rows) => rows.filter((row) => row.approval_id !== approval.approval_id));
        setStamped(null);
      }, reduced ? 0 : 420);
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "The decision could not be recorded.");
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="approval-center">
      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <Stamp size={16} aria-hidden="true" />
            <h2>Approval Center</h2>
          </div>
          <div className="lane-switch" role="tablist" aria-label="Approval lanes">
            {LANES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={lane === option.id}
                className={lane === option.id ? "lens-chip active" : "lens-chip"}
                onClick={() => setLane(option.id)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="approval-meta">
          {lane === "pending"
            ? counts.visible === 0
              ? "Nothing is waiting for approval."
              : `${counts.visible} waiting · ${counts.actionable} you can decide`
            : `${counts.visible} ${lane}`}
        </p>

        {error ? (
          <p className="approval-error" role="alert">
            <ShieldAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}

        {loading ? (
          <div className="cc-loading" aria-busy="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : approvals.length === 0 && !error ? (
          <div className="signal-empty">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>
              {lane === "pending"
                ? "The approval queue is clear. New requests appear here the moment they are raised."
                : `No ${lane} approvals yet.`}
            </p>
          </div>
        ) : (
          <motion.ul
            className="approval-list"
            variants={reduced ? undefined : listVariants}
            initial={reduced ? undefined : "hidden"}
            animate={reduced ? undefined : "visible"}
          >
            <AnimatePresence>
              {approvals.map((approval) => {
                const actionable = lane === "pending" && canDecide(currentUser, approval.approval_type);
                const isStamped = stamped?.id === approval.approval_id;
                const isDeciding = decidingId === approval.approval_id;
                const noteOpen = noteFor === approval.approval_id;
                return (
                  <motion.li
                    key={approval.approval_id}
                    className={`approval-row ${isStamped ? "stamped" : ""}`}
                    variants={reduced ? undefined : itemVariants}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition }}
                    layout={!reduced}
                  >
                    <div className="approval-body">
                      <div className="approval-title">
                        <strong>{formatType(approval.approval_type)}</strong>
                        {approval.reference ? <span className="tag">{approval.reference}</span> : null}
                      </div>
                      <small>
                        Raised by {approval.requestor} · {approval.request_date}
                        {approval.reason ? ` — ${approval.reason}` : ""}
                      </small>
                      {lane !== "pending" && approval.approver ? (
                        <small className="approval-outcome-line">
                          {approval.outcome === "approved" ? "Approved" : "Rejected"} by {approval.approver}
                          {approval.approval_date ? ` · ${approval.approval_date}` : ""}
                          {approval.note ? ` — “${approval.note}”` : ""}
                        </small>
                      ) : null}
                      {noteOpen ? (
                        <input
                          className="approval-note"
                          type="text"
                          value={note}
                          placeholder="Optional note for the audit trail"
                          onChange={(event) => setNote(event.target.value)}
                          aria-label="Decision note"
                          autoFocus
                        />
                      ) : null}
                    </div>

                    {isStamped ? (
                      <motion.span
                        className={`stamp-chip ${stamped?.outcome === "rejected" ? "stamp-rejected" : "stamp-approved"}`}
                        initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 1.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={transition}
                      >
                        <BadgeCheck size={14} aria-hidden="true" /> Recorded
                      </motion.span>
                    ) : lane === "pending" ? (
                      actionable ? (
                        <div className="approval-actions">
                          {!noteOpen ? (
                            <button type="button" className="approval-note-toggle" onClick={() => { setNoteFor(approval.approval_id); setNote(""); }}>
                              Add note
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="approval-approve"
                            disabled={isDeciding}
                            onClick={() => handleDecide(approval, "approved")}
                          >
                            <CheckCircle2 size={15} aria-hidden="true" /> Approve
                          </button>
                          <button
                            type="button"
                            className="approval-reject"
                            disabled={isDeciding}
                            onClick={() => handleDecide(approval, "rejected")}
                          >
                            <XCircle size={15} aria-hidden="true" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="approval-viewonly" title="Your permissions do not include this approval type">
                          View only
                        </span>
                      )
                    ) : (
                      <span className={`risk-pill ${approval.outcome === "approved" ? "risk-low" : "risk-critical"}`}>
                        {approval.outcome}
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </section>
    </div>
  );
}
