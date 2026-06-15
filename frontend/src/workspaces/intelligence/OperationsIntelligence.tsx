import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Gauge,
  Globe2,
  Handshake,
  Banknote,
  ShieldCheck,
  Stamp,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import {
  fetchApprovals,
  fetchAuditEvents,
  fetchCommitmentDashboard,
  fetchCountryPerformanceV2,
  fetchDistributorPerformanceV2,
  fetchExecutiveActions,
  fetchInventoryDashboard,
  fetchLearningInsights,
  fetchValidationQueue,
  type ApiApproval,
  type ApiAuthenticatedUser,
  type ApiAuditEvent,
  type ApiCommitmentDashboard,
  type ApiCountryPerformance,
  type ApiExecutiveAction,
  type ApiInventoryDashboard,
  type ApiLearningInsights,
  type ApiValidationQueueResponse,
} from "../../lib/api";
import type { DashboardNav } from "../dashboards/Dashboards";
import { SituationRoom, type ResponsibilityDomain, type SituationSpec } from "./SituationRoom";
import { MovementPanel } from "../../components/MovementPanel";

// Operations Intelligence Center (Phase 6, P1 of this sprint) — the primary
// management workspace. It does not only show what is wrong: it shows what
// needs attention, what is healthy, and what has improved. Composed from the
// existing engines (executive actions, performance scorecards, commitment and
// inventory dashboards, approvals, validation queue, audit trail) — no new
// business logic, only contextualisation.

type Lane = "attention" | "performing" | "resolved";

type IntelItem = {
  id: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  detail: string;
  pill: string;
  pillClass: string;
  view?: string; // navigate straight to a screen
  situation?: SituationSpec; // open a Situation Room to investigate
};

// Map a situation's wording to a responsibility domain.
function domainFor(text: string): ResponsibilityDomain {
  const t = text.toLowerCase();
  if (/(payment|receivable|payable|overdue|credit|collect)/.test(t)) return "finance";
  if (/(shipment|delay|eta|carrier|customs|logistic)/.test(t)) return "logistics";
  if (/(expiry|stock|inventory|consignment|batch)/.test(t)) return "inventory";
  if (/(target|distributor|customer|otif|backorder|order|sales)/.test(t)) return "sales";
  if (/(plan|projection|shortage|surplus)/.test(t)) return "planning";
  return "management";
}

function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key === "high" || key === "critical") return "risk-critical";
  if (key === "medium" || key === "active") return "risk-medium";
  return "risk-low";
}

// Route an attention item to the screen where it can be worked.
function viewForAction(action: ApiExecutiveAction): string {
  const text = `${action.action_type} ${action.title} ${action.source}`.toLowerCase();
  if (text.includes("expiry") || text.includes("expire")) return "expiry";
  if (text.includes("backorder") || text.includes("commitment") || text.includes("fulfil")) return "commitments";
  if (text.includes("delay") || text.includes("eta") || text.includes("shipment")) return "goods-tracking";
  if (text.includes("payment") || text.includes("receivable") || text.includes("overdue")) return "receivables";
  if (text.includes("approval")) return "approvals";
  if (text.includes("consignment")) return "consignment";
  if (text.includes("inventory") || text.includes("stock")) return "inventory-hub";
  return "decision-center";
}

// Recently-resolved signals read from the audit trail: which recorded actions
// represent a good thing closing out.
const RESOLVED_ACTIONS: { match: (event: ApiAuditEvent) => boolean; label: string; icon: IntelItem["icon"] }[] = [
  { match: (e) => /payment|collect|receivable_payment|payable_payment/i.test(e.action), label: "Payment recorded", icon: Banknote },
  { match: (e) => /receipt|received|increase|goods/i.test(`${e.action} ${e.module_name}`), label: "Stock received", icon: Database },
  { match: (e) => /fulfil|delivered|dispatch|consume/i.test(e.action), label: "Order progressed", icon: Handshake },
  { match: (e) => /approve|decide|approval/i.test(e.action), label: "Approval completed", icon: Stamp },
  { match: (e) => /outcome|effective|resolved|close/i.test(e.action), label: "Decision closed", icon: CheckCircle2 },
];

function resolvedFor(event: ApiAuditEvent): { label: string; icon: IntelItem["icon"] } | null {
  for (const rule of RESOLVED_ACTIONS) if (rule.match(event)) return { label: rule.label, icon: rule.icon };
  return null;
}

export function OperationsIntelligence({ onNavigate, currentUser }: DashboardNav & { currentUser: ApiAuthenticatedUser }) {
  const [lane, setLane] = useState<Lane>("attention");
  const [openSituation, setOpenSituation] = useState<SituationSpec | null>(null);
  const [actions, setActions] = useState<ApiExecutiveAction[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [validation, setValidation] = useState<ApiValidationQueueResponse | null>(null);
  const [learning, setLearning] = useState<ApiLearningInsights | null>(null);
  const [countries, setCountries] = useState<ApiCountryPerformance[]>([]);
  const [distributors, setDistributors] = useState<ApiCountryPerformance[]>([]);
  const [commitment, setCommitment] = useState<ApiCommitmentDashboard | null>(null);
  const [inventory, setInventory] = useState<ApiInventoryDashboard | null>(null);
  const [audit, setAudit] = useState<ApiAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchExecutiveActions(),
      fetchApprovals("pending"),
      fetchValidationQueue(),
      fetchLearningInsights(),
      fetchCountryPerformanceV2(),
      fetchDistributorPerformanceV2(),
      fetchCommitmentDashboard(),
      fetchInventoryDashboard(),
      fetchAuditEvents(60),
    ]).then((results) => {
      if (!active) return;
      const [a, ap, v, l, c, d, cm, inv, au] = results;
      if (a.status === "fulfilled") setActions(a.value);
      if (ap.status === "fulfilled") setApprovals(ap.value);
      if (v.status === "fulfilled") setValidation(v.value);
      if (l.status === "fulfilled") setLearning(l.value);
      if (c.status === "fulfilled") setCountries(c.value);
      if (d.status === "fulfilled") setDistributors(d.value);
      if (cm.status === "fulfilled") setCommitment(cm.value);
      if (inv.status === "fulfilled") setInventory(inv.value);
      if (au.status === "fulfilled") setAudit(au.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const attention: IntelItem[] = useMemo(() => {
    const items: IntelItem[] = actions.map((action, index) => {
      const type = humanize(action.action_type) || "Operational risk";
      return {
        id: `action-${index}`,
        icon: TriangleAlert,
        title: action.title,
        detail: action.detail ?? humanize(action.source),
        pill: action.severity,
        pillClass: severityClass(action.severity),
        situation: {
          kind: "negative",
          type,
          severity: action.severity,
          title: action.title,
          detail: action.detail ?? humanize(action.source),
          domain: domainFor(`${action.action_type} ${action.title} ${action.source}`),
          reference: action.reference ?? undefined,
          workView: viewForAction(action),
        },
      };
    });
    if (approvals.length > 0) {
      items.push({
        id: "approvals",
        icon: Stamp,
        title: `${approvals.length} approval${approvals.length === 1 ? "" : "s"} waiting`,
        detail: "Decisions are blocked until these are cleared",
        pill: "bottleneck",
        pillClass: "risk-medium",
        view: "approvals",
      });
    }
    const ocrPending = (validation?.pending_review_count ?? 0) + (validation?.missing_required_count ?? 0);
    if (ocrPending > 0) {
      items.push({
        id: "ocr",
        icon: ClipboardCheck,
        title: `${ocrPending} extracted field${ocrPending === 1 ? "" : "s"} need validation`,
        detail: "OCR never auto-posts — a human must confirm before it becomes a transaction",
        pill: "validate",
        pillClass: "risk-medium",
        view: "import-validation",
      });
    }
    const masterIssues =
      (learning?.total_warehouse_candidates ?? 0) > 0
        ? learning?.total_warehouse_candidates ?? 0
        : 0;
    if (masterIssues > 0) {
      items.push({
        id: "master",
        icon: Database,
        title: `${masterIssues} master-data candidate${masterIssues === 1 ? "" : "s"} pending`,
        detail: "Unknown entities discovered from documents, awaiting governance",
        pill: "review",
        pillClass: "risk-low",
        view: "learning",
      });
    }
    return items;
  }, [actions, approvals, validation, learning]);

  const performing: IntelItem[] = useMemo(() => {
    const items: IntelItem[] = [];
    for (const country of countries.filter((c) => (c.value_achievement_pct ?? 0) >= 100).slice(0, 6)) {
      const detail = `${Math.round(country.value_achievement_pct ?? 0)}% of value target achieved`;
      items.push({
        id: `country-${country.name}`,
        icon: Globe2,
        title: `${country.name} is hitting target`,
        detail,
        pill: "on target",
        pillClass: "risk-low",
        situation: {
          kind: "positive",
          type: "Target Achievement",
          severity: "win",
          title: `${country.name} is hitting target`,
          detail,
          domain: "sales",
          country: country.name,
          workView: "commercial",
        },
      });
    }
    for (const dist of distributors.filter((d) => (d.value_achievement_pct ?? 0) >= 100).slice(0, 4)) {
      const detail = `${Math.round(dist.value_achievement_pct ?? 0)}% of target`;
      items.push({
        id: `dist-${dist.name}`,
        icon: TrendingUp,
        title: `${dist.name} is performing`,
        detail,
        pill: "on target",
        pillClass: "risk-low",
        situation: {
          kind: "positive",
          type: "Distributor Achievement",
          severity: "win",
          title: `${dist.name} is performing`,
          detail,
          domain: "sales",
          workView: "commercial",
        },
      });
    }
    if (commitment?.otif_pct != null && commitment.otif_pct >= 90) {
      items.push({
        id: "otif",
        icon: Gauge,
        title: `OTIF at ${Math.round(commitment.otif_pct)}%`,
        detail: "Orders are arriving on time and in full",
        pill: "strong",
        pillClass: "risk-low",
        view: "dash-secondary",
      });
    }
    if (inventory && inventory.batch_count > 0 && inventory.expiring_90 + inventory.expired === 0) {
      items.push({
        id: "inv-health",
        icon: ShieldCheck,
        title: "Inventory is healthy",
        detail: `${inventory.batch_count} batches, none inside the 90-day expiry window`,
        pill: "healthy",
        pillClass: "risk-low",
        view: "dash-inventory",
      });
    }
    return items;
  }, [countries, distributors, commitment, inventory]);

  const resolved: IntelItem[] = useMemo(() => {
    const items: IntelItem[] = [];
    for (const event of audit) {
      const hit = resolvedFor(event);
      if (!hit) continue;
      items.push({
        id: `audit-${event.id}`,
        icon: hit.icon,
        title: hit.label,
        detail: `${humanize(event.module_name)} · ${event.entity_name}${event.actor ? ` · ${event.actor}` : ""}`,
        pill: event.created_at.slice(0, 10),
        pillClass: "tag",
      });
      if (items.length >= 12) break;
    }
    return items;
  }, [audit]);

  const lanes: { id: Lane; label: string; items: IntelItem[]; tone: string }[] = [
    { id: "attention", label: "Attention required", items: attention, tone: "bad" },
    { id: "performing", label: "Performing well", items: performing, tone: "good" },
    { id: "resolved", label: "Recently resolved", items: resolved, tone: "info" },
  ];
  const activeItems = lanes.find((l) => l.id === lane)?.items ?? [];

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  // Detect → investigate: a selected item opens its Situation Room in place.
  if (openSituation) {
    return (
      <SituationRoom
        situation={openSituation}
        currentUser={currentUser}
        onBack={() => setOpenSituation(null)}
        onNavigate={onNavigate}
      />
    );
  }

  const story =
    attention.length > 0
      ? `${attention.length} thing${attention.length === 1 ? "" : "s"} need a look, and ${performing.length} part${performing.length === 1 ? " is" : "s are"} running well. Clear the red, keep the green.`
      : performing.length > 0
        ? `Nothing is flagged for attention — ${performing.length} part${performing.length === 1 ? " is" : "s are"} performing and ${resolved.length} recent win${resolved.length === 1 ? "" : "s"} are on the board.`
        : "The floor is quiet. Items appear here the moment the system detects something worth a manager's eye.";

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Operations Intelligence · the management floor</p>
            <h2>
              {attention.length} need{attention.length === 1 ? "s" : ""} attention · {performing.length} performing ·{" "}
              {resolved.length} resolved
            </h2>
            <p className="dash-story">{story}</p>
          </div>
        </div>
        <div className="vitals-row">
          <div className={`vital ${attention.length > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{attention.length}</strong>
            <span>Need attention</span>
          </div>
          <div className="vital tone-good">
            <strong>{performing.length}</strong>
            <span>Performing well</span>
          </div>
          <div className="vital">
            <strong>{resolved.length}</strong>
            <span>Recently resolved</span>
          </div>
        </div>
      </section>

      {/* Movement map — four live metrics, time range, Primary/Secondary split */}
      <MovementPanel title="Shipment movement" />

      <div className="oic-lanes" role="tablist" aria-label="Operations intelligence lanes">
        {lanes.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={lane === l.id}
            className={`oic-lane-tab${lane === l.id ? " active" : ""}`}
            onClick={() => setLane(l.id)}
          >
            <span className={`oic-lane-dot tone-${l.tone}`} aria-hidden="true" />
            {l.label}
            <span className="oic-lane-count">{l.items.length}</span>
          </button>
        ))}
      </div>

      <section className="panel cockpit-panel">
        {activeItems.length === 0 ? (
          <div className="empty-story">
            <span className="empty-story-mark">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <strong>
              {lane === "attention"
                ? "Nothing needs attention right now"
                : lane === "performing"
                  ? "Performance signals will appear here"
                  : "Recent wins will appear here"}
            </strong>
            <span>
              {lane === "attention"
                ? "Risks, bottlenecks, and pending validations surface here the instant the system detects them."
                : lane === "performing"
                  ? "Countries, distributors, OTIF, and inventory health show here once targets and orders are in play."
                  : "As payments are collected, stock is received, approvals clear, and decisions close, they land here."}
            </span>
          </div>
        ) : (
          <ul className="oic-list">
            {activeItems.map((item) => {
              const Icon = item.icon;
              const clickable = Boolean(item.view || item.situation);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`oic-item${clickable ? " is-clickable" : ""}`}
                    onClick={() => {
                      if (item.situation) setOpenSituation(item.situation);
                      else if (item.view) onNavigate(item.view);
                    }}
                    disabled={!clickable}
                  >
                    <span className="oic-item-icon">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="oic-item-body">
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <span className={`risk-pill ${item.pillClass}`}>{humanize(item.pill)}</span>
                    {clickable ? <ArrowUpRight size={15} aria-hidden="true" className="oic-item-go" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {activeItems.length > 0 && lane !== "resolved" ? (
          <p className="access-note">
            <Activity size={13} aria-hidden="true" /> Open any item to enter its Situation Room — the full story, impact,
            timeline, past decisions, and a direct line into the Decision cockpit.
          </p>
        ) : null}
      </section>
    </div>
  );
}
