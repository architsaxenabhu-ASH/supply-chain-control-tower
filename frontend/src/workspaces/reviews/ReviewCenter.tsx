import { formatMoney, formatUnits } from "../../lib/currency";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardPen, ScrollText } from "lucide-react";

import {
  createDecision,
  fetchReview,
  type ApiAuthenticatedUser,
  type ApiReview,
  type ApiReviewItem,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { itemVariants, listVariants, prefersReducedMotion, signatureVariants } from "../../motion/motion";

// Review Center (Phase 5A): one workspace, seven reviews, one pattern —
// Summary → Exceptions → Transactions → Decision. Management reviews
// transactions, not dashboards; every review can end in a recorded decision.

type ReviewName =
  | "inventory"
  | "expiry"
  | "open-orders"
  | "receivables"
  | "distributor"
  | "country"
  | "vertical";

const REVIEWS: { id: ReviewName; label: string; problemType: string; owner: string }[] = [
  { id: "inventory", label: "Inventory", problemType: "commitment_risk", owner: "supply_chain" },
  { id: "expiry", label: "Expiry", problemType: "expiry_risk", owner: "supply_chain" },
  { id: "open-orders", label: "Open Orders", problemType: "shipment_delay", owner: "supply_chain" },
  { id: "receivables", label: "Receivables", problemType: "payment_risk", owner: "finance" },
  { id: "distributor", label: "Distributor", problemType: "distributor_performance", owner: "sales" },
  { id: "country", label: "Country", problemType: "country_performance", owner: "management" },
  { id: "vertical", label: "Vertical", problemType: "vertical_performance", owner: "management" },
];

const PROBLEM_TYPES = [
  "commitment_risk",
  "expiry_risk",
  "payment_risk",
  "consignment_risk",
  "shipment_delay",
  "country_performance",
  "vertical_performance",
  "distributor_performance",
];

const OWNERS = ["sales", "supply_chain", "finance", "management"];

const CURRENCY_KEY = /value|amount|outstanding|exposure|overdue|balance|credit/i;
const PERCENT_KEY = /pct|percent|rate/i;

const inr = (value: number) => formatMoney(value, { compact: true });

function humanize(key: string): string {
  const text = key.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSummaryValue(key: string, value: number | string | null): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (PERCENT_KEY.test(key)) return `${Math.round(value)}%`;
  if (CURRENCY_KEY.test(key)) return inr(value);
  return formatUnits(value);
}

function formatDetailValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return formatSummaryValue(key, value);
  return String(value);
}

// Most useful detail keys first; everything else stays behind the row count.
const DETAIL_PRIORITY = [
  "country",
  "vertical",
  "customer",
  "distributor",
  "item_code",
  "product",
  "batch",
  "quantity",
  "status",
];

function detailEntries(item: ApiReviewItem): [string, unknown][] {
  const entries = Object.entries(item.detail ?? {});
  return entries
    .sort(([a], [b]) => {
      const ia = DETAIL_PRIORITY.indexOf(a);
      const ib = DETAIL_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .slice(0, 5);
}

function itemCountry(item: ApiReviewItem): string | null {
  const value = item.detail?.country;
  return typeof value === "string" ? value : null;
}

export function ReviewCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const reduced = prefersReducedMotion();
  const { country } = useCountry();
  const [active, setActive] = useState<ReviewName>("inventory");
  const [review, setReview] = useState<ApiReview | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiReviewItem | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionType, setDecisionType] = useState("");
  const [reason, setReason] = useState("");
  const [problemType, setProblemType] = useState(REVIEWS[0].problemType);
  const [owner, setOwner] = useState(REVIEWS[0].owner);
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Counts for every review chip (lightweight: lengths only).
  useEffect(() => {
    let activeFlag = true;
    Promise.all(
      REVIEWS.map((entry) =>
        fetchReview(entry.id)
          .then((result) => [entry.id, result.items.length] as const)
          .catch(() => [entry.id, 0] as const),
      ),
    ).then((pairs) => {
      if (activeFlag) setCounts(Object.fromEntries(pairs));
    });
    return () => {
      activeFlag = false;
    };
  }, []);

  useEffect(() => {
    let activeFlag = true;
    setLoading(true);
    setSelected(null);
    setMessage(null);
    const meta = REVIEWS.find((entry) => entry.id === active) ?? REVIEWS[0];
    setProblemType(meta.problemType);
    setOwner(meta.owner);
    fetchReview(active)
      .then((result) => {
        if (!activeFlag) return;
        setReview(result);
        setLoading(false);
      })
      .catch(() => {
        if (!activeFlag) return;
        setReview(null);
        setLoading(false);
      });
    return () => {
      activeFlag = false;
    };
  }, [active]);

  const items = useMemo(() => {
    const rows = review?.items ?? [];
    if (!country) return rows;
    const scoped = rows.filter((row) => {
      const rowCountry = itemCountry(row);
      return !rowCountry || rowCountry.toLowerCase() === country.toLowerCase();
    });
    return scoped;
  }, [review, country]);

  const summaryEntries = useMemo(
    () => Object.entries(review?.summary ?? {}).slice(0, 6),
    [review],
  );

  const handleRecordDecision = async () => {
    if (!reason.trim()) {
      setMessage({ tone: "bad", text: "A decision needs a reason — that is what the business learns from." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createDecision({
        decision_type: decisionType.trim() || `${active.replace(/-/g, " ")} review decision`,
        reason: reason.trim(),
        user: currentUser.email,
        role: currentUser.role_name,
        problem_type: problemType,
        owner,
        context: selected
          ? `${active} review · ${selected.reference}`
          : `${active} review${country ? ` · ${country}` : ""}`,
        related_product: typeof selected?.detail?.item_code === "string" ? (selected.detail.item_code as string) : null,
        related_batch: typeof selected?.detail?.batch === "string" ? (selected.detail.batch as string) : null,
        related_customer:
          typeof selected?.detail?.customer === "string"
            ? (selected.detail.customer as string)
            : typeof selected?.detail?.distributor === "string"
              ? (selected.detail.distributor as string)
              : null,
        expected_outcome: expectedOutcome.trim() || null,
      });
      setMessage({ tone: "good", text: "Decision recorded. Track its outcome in the Decision Center." });
      setDecisionType("");
      setReason("");
      setExpectedOutcome("");
      setDecisionOpen(false);
      setSelected(null);
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "The decision could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="review-center">
      <nav className="review-switch" aria-label="Review types">
        {REVIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={active === entry.id ? "review-chip active" : "review-chip"}
            aria-current={active === entry.id ? "page" : undefined}
            onClick={() => setActive(entry.id)}
          >
            <span>{entry.label}</span>
            <strong>{counts[entry.id] ?? "·"}</strong>
          </button>
        ))}
      </nav>

      <motion.section
        key={`${active}-${country}`}
        className="panel cockpit-panel review-stage"
        variants={signatureVariants("sweep", reduced)}
        initial="initial"
        animate="animate"
      >
        <div className="panel-heading">
          <div className="worklist-title">
            <ScrollText size={16} aria-hidden="true" />
            <h2>{REVIEWS.find((entry) => entry.id === active)?.label} review</h2>
          </div>
          <span>{country ? `${country} scope` : "all stations"}</span>
        </div>

        {loading ? (
          <div className="cc-loading" aria-busy="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : !review ? (
          <p className="empty-state">This review is not available right now. Check that the backend is running.</p>
        ) : (
          <>
            {/* 1 · Summary */}
            {summaryEntries.length > 0 ? (
              <div className="vitals-row review-summary">
                {summaryEntries.map(([key, value]) => (
                  <div className="vital" key={key}>
                    <strong>{formatSummaryValue(key, value)}</strong>
                    <span>{humanize(key)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* 2+3 · Exceptions as transactions */}
            {items.length === 0 ? (
              <div className="signal-empty">
                <CheckCircle2 size={20} aria-hidden="true" />
                <p>
                  {country
                    ? `No ${active.replace(/-/g, " ")} exceptions for ${country}.`
                    : `No ${active.replace(/-/g, " ")} exceptions. This lane is clean.`}
                </p>
              </div>
            ) : (
              <motion.ul
                className="review-items"
                variants={reduced ? undefined : listVariants}
                initial={reduced ? undefined : "hidden"}
                animate={reduced ? undefined : "visible"}
              >
                {items.slice(0, 30).map((item) => {
                  const isSelected = selected?.reference === item.reference;
                  return (
                    <motion.li key={`${item.source}-${item.reference}`} variants={reduced ? undefined : itemVariants}>
                      <button
                        type="button"
                        className={isSelected ? "review-item selected" : "review-item"}
                        onClick={() => setSelected(isSelected ? null : item)}
                        aria-pressed={isSelected}
                      >
                        <div className="review-item-head">
                          <strong>{item.reference}</strong>
                          <span className="tag">{humanize(item.source)}</span>
                        </div>
                        <div className="review-item-detail">
                          {detailEntries(item).map(([key, value]) => (
                            <span key={key}>
                              <small>{humanize(key)}</small> {formatDetailValue(key, value)}
                            </span>
                          ))}
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
            {items.length > 30 ? (
              <p className="review-more">Showing the first 30 of {items.length} exceptions.</p>
            ) : null}

            {/* 4 · Decision */}
            <div className="review-decide">
              {message ? (
                <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>
                  {message.text}
                </p>
              ) : null}
              {!decisionOpen ? (
                <button type="button" className="review-decide-open" onClick={() => setDecisionOpen(true)}>
                  <ClipboardPen size={15} aria-hidden="true" />
                  Record a decision{selected ? ` for ${selected.reference}` : ""}
                </button>
              ) : (
                <div className="review-decision-form">
                  <div className="review-form-grid">
                    <label>
                      <span>Decision</span>
                      <input
                        type="text"
                        value={decisionType}
                        placeholder={`e.g. Reallocate stock, escalate ${active.replace(/-/g, " ")}`}
                        onChange={(event) => setDecisionType(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Problem type</span>
                      <select value={problemType} onChange={(event) => setProblemType(event.target.value)}>
                        {PROBLEM_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {humanize(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Owner</span>
                      <select value={owner} onChange={(event) => setOwner(event.target.value)}>
                        {OWNERS.map((option) => (
                          <option key={option} value={option}>
                            {humanize(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    <span>Reason (what did you see, what are you doing about it?)</span>
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={selected ? `Decision for ${selected.reference}…` : "Decision and why…"}
                    />
                  </label>
                  <label>
                    <span>Expected outcome (optional)</span>
                    <input
                      type="text"
                      value={expectedOutcome}
                      onChange={(event) => setExpectedOutcome(event.target.value)}
                      placeholder="e.g. Receivable cleared within 30 days"
                    />
                  </label>
                  <div className="review-form-actions">
                    <button type="button" className="secondary-action" onClick={() => setDecisionOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="review-decide-save" disabled={saving} onClick={handleRecordDecision}>
                      {saving ? "Recording…" : "Record decision"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </motion.section>
    </div>
  );
}
