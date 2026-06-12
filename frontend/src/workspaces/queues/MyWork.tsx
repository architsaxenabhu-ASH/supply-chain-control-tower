import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Compass, Inbox, Radar, ScrollText } from "lucide-react";

import {
  fetchApprovals,
  fetchDecisions,
  fetchExecutiveActions,
  fetchReview,
  type ApiApproval,
  type ApiAuthenticatedUser,
  type ApiDecision,
  type ApiExecutiveAction,
} from "../../lib/api";
import { itemVariants, listVariants, prefersReducedMotion } from "../../motion/motion";

// My Work (Phase 5A): the queue system. No notifications — users work from
// four queues: Actions, Reviews, Approvals, Decisions. Every row leads
// somewhere real; nothing begs for attention.

const REVIEWS = ["inventory", "expiry", "open-orders", "receivables", "distributor", "country", "vertical"] as const;

const ACTION_ROUTES: { match: RegExp; view: string }[] = [
  { match: /inventory|release|stock/i, view: "inventory" },
  { match: /shipment/i, view: "goods-tracking" },
  { match: /expiry/i, view: "expiry" },
  { match: /receivable|payment|credit/i, view: "reviews" },
  { match: /demand|order/i, view: "reviews" },
];

function routeForAction(action: ApiExecutiveAction): string {
  const rule = ACTION_ROUTES.find((entry) => entry.match.test(`${action.source} ${action.action_type}`));
  return rule?.view ?? "reviews";
}

function severityRank(severity: string): number {
  const key = severity.toLowerCase();
  if (key === "critical") return 0;
  if (key === "high") return 1;
  if (key === "medium") return 2;
  return 3;
}

export function MyWork({
  currentUser,
  onNavigate,
}: {
  currentUser: ApiAuthenticatedUser;
  onNavigate: (view: string) => void;
}) {
  const reduced = prefersReducedMotion();
  const [actions, setActions] = useState<ApiExecutiveAction[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [decisions, setDecisions] = useState<ApiDecision[]>([]);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchExecutiveActions(),
      fetchApprovals("pending"),
      fetchDecisions("open"),
      Promise.all(
        REVIEWS.map((name) =>
          fetchReview(name)
            .then((review) => [name, review.items.length] as const)
            .catch(() => [name, 0] as const),
        ),
      ),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setActions(results[0].value);
      if (results[1].status === "fulfilled") setApprovals(results[1].value);
      if (results[2].status === "fulfilled") setDecisions(results[2].value);
      if (results[3].status === "fulfilled") setReviewCounts(Object.fromEntries(results[3].value));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const sortedActions = useMemo(
    () => [...actions].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    [actions],
  );
  const myDecisions = useMemo(() => {
    const me = currentUser.email.toLowerCase();
    const name = currentUser.full_name.toLowerCase();
    const mine = decisions.filter((d) => {
      const owner = (d.owner ?? d.user ?? "").toLowerCase();
      return !owner || owner.includes(me) || owner.includes(name);
    });
    return mine.length > 0 ? mine : decisions;
  }, [decisions, currentUser]);
  const reviewBacklog = useMemo(
    () => REVIEWS.map((name) => ({ name, count: reviewCounts[name] ?? 0 })).sort((a, b) => b.count - a.count),
    [reviewCounts],
  );
  const totalReviewItems = reviewBacklog.reduce((total, entry) => total + entry.count, 0);

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  const openCount = sortedActions.length + approvals.length + myDecisions.length + totalReviewItems;

  return (
    <div className="cockpit mywork">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Work queues · {currentUser.full_name}</p>
            <h2>
              {openCount === 0
                ? "All queues are clear."
                : `${openCount} items across your queues`}
            </h2>
          </div>
        </div>
        <div className="vitals-row">
          <QueueVital label="Actions" value={sortedActions.length} onOpen={null} />
          <QueueVital label="Reviews" value={totalReviewItems} onOpen={null} />
          <QueueVital label="Approvals" value={approvals.length} onOpen={null} />
          <QueueVital label="Decisions" value={myDecisions.length} onOpen={null} />
        </div>
      </section>

      <div className="queue-grid">
        <QueuePanel
          icon={Radar}
          title="My actions"
          meta={`${sortedActions.length} open`}
          empty="No actions waiting. Signals land here when something needs a manager."
          reduced={reduced}
        >
          {sortedActions.slice(0, 6).map((action, index) => (
            <QueueRow
              key={`${action.action_type}-${action.reference}-${index}`}
              reduced={reduced}
              title={action.title}
              detail={action.detail ?? action.source.replace(/_/g, " ")}
              pill={action.severity}
              pillClass={`risk-pill risk-${action.severity.toLowerCase() === "critical" ? "critical" : action.severity.toLowerCase()}`}
              actionLabel="Work it"
              onAction={() => onNavigate(routeForAction(action))}
            />
          ))}
        </QueuePanel>

        <QueuePanel
          icon={ScrollText}
          title="My reviews"
          meta={`${totalReviewItems} items to review`}
          empty="Nothing to review — every lane is clean."
          reduced={reduced}
        >
          {reviewBacklog
            .filter((entry) => entry.count > 0)
            .slice(0, 7)
            .map((entry) => (
              <QueueRow
                key={entry.name}
                reduced={reduced}
                title={`${entry.name.replace(/-/g, " ")} review`}
                detail={`${entry.count} transactions flagged`}
                actionLabel="Review"
                onAction={() => onNavigate("reviews")}
              />
            ))}
        </QueuePanel>

        <QueuePanel
          icon={CheckCircle2}
          title="My approvals"
          meta={`${approvals.length} pending`}
          empty="No approvals waiting on you."
          reduced={reduced}
        >
          {approvals.slice(0, 6).map((approval) => (
            <QueueRow
              key={approval.approval_id}
              reduced={reduced}
              title={approval.approval_type.replace(/[_-]/g, " ")}
              detail={approval.reason ?? approval.reference ?? approval.requestor}
              pill={approval.request_date}
              actionLabel="Decide"
              onAction={() => onNavigate("approvals")}
            />
          ))}
        </QueuePanel>

        <QueuePanel
          icon={Compass}
          title="My decisions"
          meta={`${myDecisions.length} open`}
          empty="No open decisions. Recorded decisions build the playbook."
          reduced={reduced}
        >
          {myDecisions.slice(0, 6).map((decision) => (
            <QueueRow
              key={decision.decision_id}
              reduced={reduced}
              title={decision.decision_type.replace(/[_-]/g, " ")}
              detail={decision.problem_type?.replace(/[_-]/g, " ") ?? decision.reason}
              pill={decision.owner?.replace(/[_-]/g, " ") ?? undefined}
              actionLabel="Open"
              onAction={() => onNavigate("decision-center")}
            />
          ))}
        </QueuePanel>
      </div>
    </div>
  );
}

function QueueVital({ label, value, onOpen }: { label: string; value: number; onOpen: (() => void) | null }) {
  return (
    <div className={`vital ${value === 0 ? "tone-good" : "tone-neutral"}`}>
      <strong>{value}</strong>
      <span>
        {label}
        {onOpen ? (
          <button type="button" className="cc-more" onClick={onOpen} aria-label={`Open ${label}`}>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function QueuePanel({
  icon: Icon,
  title,
  meta,
  empty,
  reduced,
  children,
}: {
  icon: typeof Inbox;
  title: string;
  meta: string;
  empty: string;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="panel cockpit-panel worklist">
      <div className="panel-heading">
        <div className="worklist-title">
          <Icon size={16} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        <span className="cc-panel-meta">{meta}</span>
      </div>
      {hasRows ? (
        <motion.div
          className="worklist-body"
          variants={reduced ? undefined : listVariants}
          initial={reduced ? undefined : "hidden"}
          animate={reduced ? undefined : "visible"}
        >
          {children}
        </motion.div>
      ) : (
        <p className="empty-state">{empty}</p>
      )}
    </section>
  );
}

function QueueRow({
  title,
  detail,
  pill,
  pillClass,
  actionLabel,
  onAction,
  reduced,
}: {
  title: string;
  detail?: string | null;
  pill?: string;
  pillClass?: string;
  actionLabel: string;
  onAction: () => void;
  reduced: boolean;
}) {
  return (
    <motion.div className="worklist-row queue-row-5a" variants={reduced ? undefined : itemVariants}>
      <div className="queue-row-main">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
      <div className="queue-row-side">
        {pill ? <span className={pillClass ?? "tag"}>{pill}</span> : null}
        <button type="button" className="signal-act" onClick={onAction}>
          {actionLabel} <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
