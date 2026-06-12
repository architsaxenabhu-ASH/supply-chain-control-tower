import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Compass, GitBranch, Sparkles } from "lucide-react";

import {
  fetchDecisionLearningInsights,
  fetchDecisions,
  fetchSimilarDecisions,
  recordDecisionOutcome,
  type ApiAuthenticatedUser,
  type ApiDecision,
  type ApiDecisionLearningInsights,
  type ApiSimilarDecision,
} from "../../lib/api";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Decision Center (Phase 5A signature feature): the organization's decision
// memory as a timeline. Problem → Context → Options → Decision → Reason →
// Expected vs Actual outcome, with similar decisions and effectiveness so the
// business learns what works.

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

export function DecisionCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [decisions, setDecisions] = useState<ApiDecision[]>([]);
  const [insights, setInsights] = useState<ApiDecisionLearningInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<ApiSimilarDecision[]>([]);
  const [actualOutcome, setActualOutcome] = useState("");
  const [effectiveness, setEffectiveness] = useState<(typeof EFFECTIVENESS_OPTIONS)[number]["id"]>("effective");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const load = (filter: StatusFilter) => {
    setLoading(true);
    Promise.allSettled([
      fetchDecisions(filter === "all" ? undefined : filter),
      fetchDecisionLearningInsights(),
    ]).then(([decisionsResult, insightsResult]) => {
      if (decisionsResult.status === "fulfilled") setDecisions(decisionsResult.value);
      if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
      setLoading(false);
    });
  };

  useEffect(() => {
    load(statusFilter);
    setSelectedId(null);
    setMessage(null);
  }, [statusFilter]);

  const selected = useMemo(
    () => decisions.find((decision) => decision.decision_id === selectedId) ?? null,
    [decisions, selectedId],
  );

  // Similar decisions follow the selection — the "have we seen this before?" rail.
  useEffect(() => {
    if (!selected) {
      setSimilar([]);
      return;
    }
    let active = true;
    fetchSimilarDecisions({
      problem_type: selected.problem_type ?? undefined,
      decision_type: selected.decision_type,
      related_product: selected.related_product ?? undefined,
      related_customer: selected.related_customer ?? undefined,
      limit: 5,
    })
      .then((rows) => {
        if (active) setSimilar(rows.filter((row) => row.decision_id !== selected.decision_id));
      })
      .catch(() => {
        if (active) setSimilar([]);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const handleRecordOutcome = async () => {
    if (!selected) return;
    if (!actualOutcome.trim()) {
      setMessage({ tone: "bad", text: "Describe what actually happened — that is how the playbook learns." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordDecisionOutcome(selected.decision_id, {
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
  };

  if (loading && decisions.length === 0) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <div className="decision-center">
      {/* Decision intelligence header */}
      <section className="cockpit-hero decision-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Decision intelligence</p>
            <h2>
              {insights && insights.total_decisions > 0
                ? `${insights.total_decisions} decisions recorded · ${
                    insights.overall_success_rate_pct == null
                      ? "outcomes pending"
                      : `${Math.round(insights.overall_success_rate_pct)}% effective`
                  }`
                : "Start the decision playbook"}
            </h2>
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
        {insights && insights.total_decisions > 0 ? (
          <div className="vitals-row">
            <div className="vital">
              <strong>{insights.total_decisions}</strong>
              <span>Decisions recorded</span>
            </div>
            <div className="vital">
              <strong>{insights.decisions_with_outcome}</strong>
              <span>With outcomes</span>
            </div>
            <div className={`vital ${insights.overall_success_rate_pct != null && insights.overall_success_rate_pct >= 70 ? "tone-good" : "tone-neutral"}`}>
              <strong>{insights.overall_success_rate_pct == null ? "—" : `${Math.round(insights.overall_success_rate_pct)}%`}</strong>
              <span>Overall effectiveness</span>
            </div>
            {insights.most_successful_decisions[0] ? (
              <div className="vital tone-good">
                <strong className="vital-text">{humanize(insights.most_successful_decisions[0].key)}</strong>
                <span>Most effective play</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="decision-empty-hint">
            Record decisions from any review — what you saw, what you decided, why. Outcomes close the loop.
          </p>
        )}
      </section>

      <div className="decision-columns">
        {/* Timeline */}
        <motion.section
          key={statusFilter}
          className="decision-timeline"
          variants={signatureVariants("path", reduced)}
          initial="initial"
          animate="animate"
          aria-label="Decision timeline"
        >
          {decisions.length === 0 ? (
            <div className="signal-empty">
              <CheckCircle2 size={20} aria-hidden="true" />
              <p>No {statusFilter === "all" ? "" : statusFilter + " "}decisions yet. Record one from any review.</p>
            </div>
          ) : (
            <motion.ol
              className="decision-list"
              variants={reduced ? undefined : listVariants}
              initial={reduced ? undefined : "hidden"}
              animate={reduced ? undefined : "visible"}
            >
              {decisions.slice(0, 25).map((decision) => {
                const isSelected = decision.decision_id === selectedId;
                return (
                  <motion.li key={decision.decision_id} variants={reduced ? undefined : itemVariants}>
                    <button
                      type="button"
                      className={isSelected ? "decision-card selected" : "decision-card"}
                      onClick={() => {
                        setSelectedId(isSelected ? null : decision.decision_id);
                        setMessage(null);
                        setActualOutcome("");
                      }}
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
                        <span className={`risk-pill ${decision.status === "open" ? "risk-medium" : effectivenessClass(decision.effectiveness)}`}>
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
                  </motion.li>
                );
              })}
            </motion.ol>
          )}
        </motion.section>

        {/* Side rail: similar decisions + outcome */}
        {selected ? (
          <aside className="decision-rail" aria-label="Decision intelligence rail">
            {selected.status === "open" ? (
              <section className="panel cockpit-panel">
                <div className="panel-heading">
                  <div className="worklist-title">
                    <GitBranch size={15} aria-hidden="true" />
                    <h2>Close the loop</h2>
                  </div>
                </div>
                {message ? (
                  <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
                    {message.text}
                  </p>
                ) : null}
                <div className="review-decision-form decision-outcome-form">
                  <label>
                    <span>What actually happened?</span>
                    <textarea
                      rows={3}
                      value={actualOutcome}
                      onChange={(event) => setActualOutcome(event.target.value)}
                      placeholder={selected.expected_outcome ? `Expected: ${selected.expected_outcome}` : "Actual outcome…"}
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
            ) : message ? (
              <p className={`review-message ${message.tone}`} role="status">
                {message.text}
              </p>
            ) : null}

            <section className="panel cockpit-panel">
              <div className="panel-heading">
                <div className="worklist-title">
                  <Sparkles size={15} aria-hidden="true" />
                  <h2>Similar decisions</h2>
                </div>
                <span className="cc-panel-meta">{similar.length}</span>
              </div>
              {similar.length === 0 ? (
                <p className="empty-state">No similar decisions yet — this one is breaking new ground.</p>
              ) : (
                <div className="worklist-body">
                  {similar.map((row) => (
                    <div className="worklist-row decision-similar" key={row.decision_id}>
                      <div>
                        <strong>{humanize(row.decision_type)}</strong>
                        <small>{row.reason}</small>
                        {row.actual_outcome ? <small className="decision-similar-outcome">→ {row.actual_outcome}</small> : null}
                      </div>
                      <span className={`risk-pill ${effectivenessClass(row.effectiveness)}`}>
                        {row.effectiveness ? humanize(row.effectiveness) : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        ) : (
          <aside className="decision-rail decision-rail-hint" aria-hidden="true">
            <div className="signal-empty">
              <Compass size={20} aria-hidden="true" />
              <p>Select a decision to see its full story, similar decisions, and record its outcome.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
