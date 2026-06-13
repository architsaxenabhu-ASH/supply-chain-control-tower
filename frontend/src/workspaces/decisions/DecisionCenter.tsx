import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Compass, GitBranch, History, Lightbulb, Sparkles, Target } from "lucide-react";

import {
  createDecision,
  fetchDecisionLearningInsights,
  fetchDecisions,
  fetchExecutiveActions,
  fetchSimilarDecisions,
  recordDecisionOutcome,
  type ApiAuthenticatedUser,
  type ApiDecision,
  type ApiDecisionLearningInsights,
  type ApiExecutiveAction,
  type ApiSimilarDecision,
} from "../../lib/api";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Decision Center — the management decision cockpit (Phase 5L). The signature
// feature: not a transaction screen but a place to run the management loop
//   Situation → Options → Decision → Reason → Outcome
// Live situations arrive needing a call; the cockpit recommends an action,
// shows how similar situations were handled and how they turned out, captures
// the decision, then tracks the outcome so the business learns what works.

type StatusFilter = "open" | "closed" | "all";

const EFFECTIVENESS_OPTIONS = [
  { id: "effective", label: "Effective" },
  { id: "partially_effective", label: "Partially effective" },
  { id: "ineffective", label: "Ineffective" },
] as const;

function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function effectivenessClass(value: string | null): string {
  if (value === "effective") return "risk-low";
  if (value === "partially_effective") return "risk-medium";
  if (value === "ineffective") return "risk-critical";
  return "tag";
}

function severityPill(severity: string): string {
  const key = severity.toLowerCase();
  if (key === "high" || key === "critical") return "risk-critical";
  if (key === "medium" || key === "active") return "risk-medium";
  return "risk-low";
}

// A recommended next step, derived from the kind of situation. Recommendations
// are advisory — the manager still owns the call.
function recommendFor(action: ApiExecutiveAction): string {
  const text = `${action.action_type} ${action.title}`.toLowerCase();
  if (text.includes("expiry") || text.includes("expire")) return "Reallocate or discount the nearest-dated stock before it expires.";
  if (text.includes("backorder") || text.includes("short")) return "Pull forward inbound stock or split the order to protect OTIF.";
  if (text.includes("delay") || text.includes("eta")) return "Chase the carrier and reset the customer's expected date.";
  if (text.includes("overdue") || text.includes("receivable") || text.includes("payment")) return "Trigger a collection call and hold further credit until cleared.";
  if (text.includes("approval")) return "Review and clear the pending approval so the flow can continue.";
  if (text.includes("consignment")) return "Request a distributor stock report and reconcile field inventory.";
  return "Review the detail, weigh the options, and record the call so it is traceable.";
}

export function DecisionCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [situations, setSituations] = useState<ApiExecutiveAction[]>([]);
  const [decisions, setDecisions] = useState<ApiDecision[]>([]);
  const [insights, setInsights] = useState<ApiDecisionLearningInsights | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection drives the cockpit rail: a live situation (capture a new decision)
  // or a past decision (read it / close its outcome).
  const [selectedSituation, setSelectedSituation] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<ApiSimilarDecision[]>([]);

  // Decision-capture form (Situation → Options → Decision → Reason → Outcome).
  const [decisionType, setDecisionType] = useState("");
  const [context, setContext] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");

  // Outcome form for a past open decision.
  const [actualOutcome, setActualOutcome] = useState("");
  const [effectiveness, setEffectiveness] = useState<(typeof EFFECTIVENESS_OPTIONS)[number]["id"]>("effective");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const load = (filter: StatusFilter) => {
    setLoading(true);
    Promise.allSettled([
      fetchExecutiveActions(),
      fetchDecisions(filter === "all" ? undefined : filter),
      fetchDecisionLearningInsights(),
    ]).then(([situationsResult, decisionsResult, insightsResult]) => {
      if (situationsResult.status === "fulfilled") setSituations(situationsResult.value);
      if (decisionsResult.status === "fulfilled") setDecisions(decisionsResult.value);
      if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
      setLoading(false);
    });
  };

  useEffect(() => {
    load(statusFilter);
    setSelectedId(null);
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selectedDecision = useMemo(
    () => decisions.find((decision) => decision.decision_id === selectedId) ?? null,
    [decisions, selectedId],
  );
  const activeSituation = selectedSituation != null ? situations[selectedSituation] ?? null : null;

  // Similar past cases follow whichever thing is selected — the cockpit's
  // "have we seen this before, and how did it go?" intelligence.
  useEffect(() => {
    const problemType = activeSituation?.action_type ?? selectedDecision?.problem_type ?? undefined;
    const decisionType = activeSituation?.action_type ?? selectedDecision?.decision_type;
    if (!problemType && !decisionType) {
      setSimilar([]);
      return;
    }
    let active = true;
    fetchSimilarDecisions({
      problem_type: problemType,
      decision_type: decisionType,
      related_product: selectedDecision?.related_product ?? undefined,
      related_customer: selectedDecision?.related_customer ?? undefined,
      limit: 5,
    })
      .then((rows) => {
        if (active) setSimilar(rows.filter((row) => row.decision_id !== selectedId));
      })
      .catch(() => {
        if (active) setSimilar([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSituation, selectedDecision]);

  function openSituation(index: number) {
    const situation = situations[index];
    setSelectedSituation(index);
    setSelectedId(null);
    setMessage(null);
    setDecisionType(humanize(situation.action_type));
    setContext(`${situation.title}${situation.detail ? ` — ${situation.detail}` : ""}`);
    setOptionsText("");
    setReason("");
    setExpected("");
  }

  function openDecision(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setSelectedSituation(null);
    setMessage(null);
    setActualOutcome("");
  }

  async function handleCaptureDecision() {
    if (!reason.trim()) {
      setMessage({ tone: "bad", text: "Give the reason for the call — that is what the playbook learns from." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createDecision({
        decision_type: decisionType.trim() || "Management decision",
        reason: reason.trim(),
        user: currentUser.email,
        role: currentUser.role_name,
        problem_type: activeSituation?.action_type ?? null,
        context: context.trim() || null,
        options_considered: optionsText
          .split(/[\n;]+/)
          .map((option) => option.trim())
          .filter(Boolean),
        related_shipment: activeSituation?.reference ?? null,
        expected_outcome: expected.trim() || null,
        status: "open",
      });
      setMessage({ tone: "good", text: "Decision captured. Track its outcome later to close the loop." });
      setSelectedSituation(null);
      load(statusFilter);
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The decision could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordOutcome() {
    if (!selectedDecision) return;
    if (!actualOutcome.trim()) {
      setMessage({ tone: "bad", text: "Describe what actually happened — that is how the playbook learns." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordDecisionOutcome(selectedDecision.decision_id, {
        actual_outcome: actualOutcome.trim(),
        effectiveness,
        status: "closed",
        actor: currentUser.email,
      });
      setMessage({ tone: "good", text: "Outcome recorded. This decision now teaches the next one." });
      setActualOutcome("");
      load(statusFilter);
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The outcome could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  if (loading && decisions.length === 0 && situations.length === 0) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  const openDecisions = decisions.filter((decision) => decision.status === "open").length;

  return (
    <div className="decision-center">
      <section className="cockpit-hero decision-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Decision cockpit</p>
            <h2>
              {situations.length > 0
                ? `${situations.length} situation${situations.length === 1 ? "" : "s"} need a call`
                : insights && insights.total_decisions > 0
                  ? `${insights.total_decisions} decisions recorded · ${
                      insights.overall_success_rate_pct == null
                        ? "outcomes pending"
                        : `${Math.round(insights.overall_success_rate_pct)}% effective`
                    }`
                  : "No open situations — the floor is calm"}
            </h2>
            <p className="dash-story">
              Run the management loop here: a situation arrives, you weigh the options against how similar
              calls turned out, record the decision and the reason, then track the outcome so the next call is
              sharper.
            </p>
          </div>
        </div>
        <div className="vitals-row">
          <div className={`vital ${situations.length > 0 ? "tone-warn" : "tone-good"}`}>
            <strong>{situations.length}</strong>
            <span>Situations awaiting a call</span>
          </div>
          <div className="vital">
            <strong>{openDecisions}</strong>
            <span>Decisions open (outcome pending)</span>
          </div>
          <div className="vital">
            <strong>{insights?.total_decisions ?? 0}</strong>
            <span>Decisions in the playbook</span>
          </div>
          <div
            className={`vital ${
              insights?.overall_success_rate_pct != null && insights.overall_success_rate_pct >= 70
                ? "tone-good"
                : ""
            }`}
          >
            <strong>
              {insights?.overall_success_rate_pct == null ? "—" : `${Math.round(insights.overall_success_rate_pct)}%`}
            </strong>
            <span>Decision effectiveness</span>
          </div>
          {insights?.most_successful_decisions[0] ? (
            <div className="vital tone-good">
              <strong className="vital-text">{humanize(insights.most_successful_decisions[0].key)}</strong>
              <span>Most effective play</span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="decision-cockpit-grid">
        <main className="decision-cockpit-main">
          {/* Situation-driven entry */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <AlertTriangle size={16} aria-hidden="true" />
                <h2>Situations awaiting a decision</h2>
              </div>
              <span className="cc-panel-meta">{situations.length}</span>
            </div>
            {situations.length === 0 ? (
              <div className="empty-story">
                <span className="empty-story-mark">
                  <CheckCircle2 size={22} aria-hidden="true" />
                </span>
                <strong>Nothing needs a decision right now</strong>
                <span>
                  Live risks — expiry, backorders, delays, overdue payments, pending approvals — surface here as
                  situations the moment the system detects them. You can also record a decision from any review.
                </span>
              </div>
            ) : (
              <motion.ul
                className="situation-list"
                variants={reduced ? undefined : listVariants}
                initial={reduced ? undefined : "hidden"}
                animate={reduced ? undefined : "visible"}
              >
                {situations.map((situation, index) => (
                  <motion.li key={`${situation.reference ?? situation.title}-${index}`} variants={reduced ? undefined : itemVariants}>
                    <button
                      type="button"
                      className={`situation-card${selectedSituation === index ? " selected" : ""}`}
                      onClick={() => openSituation(index)}
                      aria-expanded={selectedSituation === index}
                    >
                      <span className={`situation-pip ${severityPill(situation.severity)}`} aria-hidden="true" />
                      <span className="situation-body">
                        <strong>{situation.title}</strong>
                        {situation.detail ? <small>{situation.detail}</small> : null}
                        <small className="situation-source">{humanize(situation.source)}</small>
                      </span>
                      <span className={`risk-pill ${severityPill(situation.severity)}`}>{situation.severity}</span>
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </section>

          {/* Decision history */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <History size={16} aria-hidden="true" />
                <h2>Decision history</h2>
              </div>
              <div className="lane-switch" role="tablist" aria-label="Decision status">
                {(["open", "closed", "all"] as StatusFilter[]).map((option) => (
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
            {decisions.length === 0 ? (
              <p className="empty-state">
                No {statusFilter === "all" ? "" : statusFilter + " "}decisions yet. Capture one from a situation above.
              </p>
            ) : (
              <motion.ol
                className="decision-list"
                key={statusFilter}
                variants={signatureVariants("path", reduced)}
                initial="initial"
                animate="animate"
              >
                {decisions.slice(0, 25).map((decision) => {
                  const isSelected = decision.decision_id === selectedId;
                  return (
                    <li key={decision.decision_id}>
                      <button
                        type="button"
                        className={isSelected ? "decision-card selected" : "decision-card"}
                        onClick={() => openDecision(decision.decision_id)}
                        aria-expanded={isSelected}
                      >
                        <span className="decision-node" aria-hidden="true" />
                        <div className="decision-card-head">
                          <strong>{humanize(decision.decision_type)}</strong>
                          <span className="decision-date">{decision.decided_at}</span>
                        </div>
                        <div className="decision-card-tags">
                          {decision.problem_type ? <span className="tag">{humanize(decision.problem_type)}</span> : null}
                          {decision.owner ? <span className="tag">{humanize(decision.owner)}</span> : null}
                          <span
                            className={`risk-pill ${
                              decision.status === "open" ? "risk-medium" : effectivenessClass(decision.effectiveness)
                            }`}
                          >
                            {decision.status === "open" ? "Open" : humanize(decision.effectiveness ?? "closed")}
                          </span>
                        </div>
                        <p className="decision-reason">{decision.reason}</p>
                        {isSelected ? (
                          <dl className="decision-detail">
                            {decision.context ? (
                              <div>
                                <dt>Context</dt>
                                <dd>{decision.context}</dd>
                              </div>
                            ) : null}
                            {decision.options_considered.length > 0 ? (
                              <div>
                                <dt>Options considered</dt>
                                <dd>{decision.options_considered.join(" · ")}</dd>
                              </div>
                            ) : null}
                            {decision.expected_outcome ? (
                              <div>
                                <dt>Expected outcome</dt>
                                <dd>{decision.expected_outcome}</dd>
                              </div>
                            ) : null}
                            {decision.actual_outcome ? (
                              <div>
                                <dt>Actual outcome</dt>
                                <dd>{decision.actual_outcome}</dd>
                              </div>
                            ) : null}
                            <div>
                              <dt>Decided by</dt>
                              <dd>
                                {decision.user}
                                {decision.role ? ` · ${decision.role}` : ""}
                              </dd>
                            </div>
                          </dl>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </motion.ol>
            )}
          </section>
        </main>

        {/* Cockpit rail — capture a decision for a situation, or close a past one */}
        <aside className="decision-rail" aria-label="Decision cockpit">
          {message ? (
            <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}

          {activeSituation ? (
            <>
              <section className="panel cockpit-panel">
                <div className="panel-heading">
                  <div className="worklist-title">
                    <Lightbulb size={15} aria-hidden="true" />
                    <h2>Recommended action</h2>
                  </div>
                </div>
                <p className="decision-recommend">{recommendFor(activeSituation)}</p>
              </section>

              <section className="panel cockpit-panel">
                <div className="panel-heading">
                  <div className="worklist-title">
                    <Target size={15} aria-hidden="true" />
                    <h2>Record the decision</h2>
                  </div>
                </div>
                <div className="review-decision-form decision-capture-form">
                  <label>
                    <span>Situation</span>
                    <textarea rows={2} value={context} onChange={(event) => setContext(event.target.value)} />
                  </label>
                  <label>
                    <span>Options considered (one per line)</span>
                    <textarea
                      rows={2}
                      value={optionsText}
                      onChange={(event) => setOptionsText(event.target.value)}
                      placeholder="Reallocate stock&#10;Split the order&#10;Hold and chase the carrier"
                    />
                  </label>
                  <label>
                    <span>Decision</span>
                    <input value={decisionType} onChange={(event) => setDecisionType(event.target.value)} />
                  </label>
                  <label>
                    <span>Reason for the call</span>
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why this option, weighed against the others"
                    />
                  </label>
                  <label>
                    <span>Expected outcome</span>
                    <input
                      value={expected}
                      onChange={(event) => setExpected(event.target.value)}
                      placeholder="What success looks like"
                    />
                  </label>
                  <div className="review-form-actions">
                    <button type="button" className="review-decide-save" disabled={saving} onClick={handleCaptureDecision}>
                      {saving ? "Recording…" : "Capture decision"}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => setSelectedSituation(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </section>

              <SimilarPanel similar={similar} />
            </>
          ) : selectedDecision ? (
            <>
              {selectedDecision.status === "open" ? (
                <section className="panel cockpit-panel">
                  <div className="panel-heading">
                    <div className="worklist-title">
                      <GitBranch size={15} aria-hidden="true" />
                      <h2>Close the loop</h2>
                    </div>
                  </div>
                  <div className="review-decision-form decision-outcome-form">
                    <label>
                      <span>What actually happened?</span>
                      <textarea
                        rows={3}
                        value={actualOutcome}
                        onChange={(event) => setActualOutcome(event.target.value)}
                        placeholder={
                          selectedDecision.expected_outcome ? `Expected: ${selectedDecision.expected_outcome}` : "Actual outcome…"
                        }
                      />
                    </label>
                    <label>
                      <span>How effective was the decision?</span>
                      <select value={effectiveness} onChange={(event) => setEffectiveness(event.target.value as typeof effectiveness)}>
                        {EFFECTIVENESS_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="review-form-actions">
                      <button type="button" className="review-decide-save" disabled={saving} onClick={handleRecordOutcome}>
                        {saving ? "Recording…" : "Record outcome"}
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
              <SimilarPanel similar={similar} />
            </>
          ) : (
            <div className="signal-empty decision-rail-hint">
              <Compass size={20} aria-hidden="true" />
              <p>Pick a situation to weigh the options and record a decision, or a past decision to close its outcome.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SimilarPanel({ similar }: { similar: ApiSimilarDecision[] }) {
  return (
    <section className="panel cockpit-panel">
      <div className="panel-heading">
        <div className="worklist-title">
          <Sparkles size={15} aria-hidden="true" />
          <h2>How we handled this before</h2>
        </div>
        <span className="cc-panel-meta">{similar.length}</span>
      </div>
      {similar.length === 0 ? (
        <p className="empty-state">No similar past decisions yet — this one is breaking new ground.</p>
      ) : (
        <div className="worklist-body">
          {similar.map((row) => (
            <div className="worklist-row decision-similar" key={row.decision_id}>
              <div>
                <strong>{humanize(row.decision_type)}</strong>
                <small>{row.reason}</small>
                {row.actual_outcome ? <small className="decision-similar-outcome">→ {row.actual_outcome}</small> : null}
              </div>
              <span className={`risk-pill ${row.effectiveness ? effectivenessClass(row.effectiveness) : "tag"}`}>
                {row.effectiveness ? humanize(row.effectiveness) : "Open"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
