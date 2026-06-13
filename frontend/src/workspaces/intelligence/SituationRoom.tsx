import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Compass,
  GitBranch,
  Layers,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import {
  fetchCustomerCommitments,
  fetchDecisionLearningInsights,
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchPayables,
  fetchProducts,
  fetchReceivables,
  fetchSimilarDecisions,
  type ApiAuthenticatedUser,
  type ApiCustomerCommitment,
  type ApiDecisionLearningInsights,
  type ApiImportFileCandidate,
  type ApiInventoryBatch,
  type ApiPayable,
  type ApiProduct,
  type ApiReceivable,
  type ApiSimilarDecision,
} from "../../lib/api";
import {
  convertAmount,
  formatDisplay,
  formatUnits,
  getCurrencyRevision,
  subscribeCurrency,
} from "../../lib/currency";

// Situation Room (Phase 6) — a management investigation workspace, not a risk
// screen. Operations Intelligence detects → the Situation Room investigates →
// the Decision Center decides → outcomes are tracked. It pulls the whole
// picture for one situation together (impact, timeline, history, recommended
// actions, product intelligence) and links straight into the decision loop.
//
// It reuses existing engines (decision similarity, learning foundation,
// planning calculation) — no duplicate business logic.

export type ResponsibilityDomain =
  | "logistics"
  | "inventory"
  | "sales"
  | "finance"
  | "planning"
  | "management";

export type SituationSpec = {
  kind: "negative" | "positive";
  type: string; // "Shipment Delay", "Inventory Shortage", "Target Achievement", …
  severity: string;
  title: string;
  detail: string;
  domain: ResponsibilityDomain;
  country?: string;
  vertical?: string;
  product?: string;
  reference?: string;
  workView?: string; // operational screen with the affected records
};

const num = formatUnits;
const todayStamp = () => new Date().toISOString().slice(0, 10);
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CLOSED_COMMITMENT = new Set(["fulfilled", "delivered", "cancelled", "closed"]);
const CLOSED_IMPORT = new Set(["received", "closed", "cancelled"]);
const HORIZONS = [0, 15, 30, 45] as const;

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key === "high" || key === "critical") return "risk-critical";
  if (key === "medium" || key === "active") return "risk-medium";
  return "risk-low";
}

// Recommended next steps by situation type — advisory only; the system never
// decides.
function recommendedActions(spec: SituationSpec): string[] {
  if (spec.kind === "positive") return ["Recognise the win", "Replicate the play elsewhere", "Reinforce what worked", "Record the decision"];
  const t = spec.type.toLowerCase();
  if (t.includes("shipment") || t.includes("delay")) return ["Expedite the shipment", "Escalate to the carrier", "Reallocate from another source", "Hold and monitor"];
  if (t.includes("expiry")) return ["Reallocate nearest-dated stock", "Discount to move volume", "Return to supplier", "Write off if unavoidable"];
  if (t.includes("shortage") || t.includes("inventory")) return ["Push pending sales", "Reallocate across countries", "Pull forward incoming supply", "Substitute an equivalent product"];
  if (t.includes("commitment") || t.includes("backorder")) return ["Pull forward supply", "Split the order", "Offer a substitute", "Reset the customer's expectation"];
  if (t.includes("receivable") || t.includes("payment")) return ["Trigger a collection call", "Hold further orders on credit", "Escalate to finance", "Agree a payment plan"];
  if (t.includes("consignment")) return ["Request a distributor stock report", "Reconcile field inventory", "Recall ageing stock"];
  return ["Investigate the detail", "Weigh the options", "Record the decision so it is traceable"];
}

function DomainLabel(domain: ResponsibilityDomain): string {
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export function SituationRoom({
  situation,
  currentUser,
  onBack,
  onNavigate,
}: {
  situation: SituationSpec;
  currentUser: ApiAuthenticatedUser;
  onBack: () => void;
  onNavigate: (view: string) => void;
}) {
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [batches, setBatches] = useState<ApiInventoryBatch[]>([]);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [receivables, setReceivables] = useState<ApiReceivable[]>([]);
  const [payables, setPayables] = useState<ApiPayable[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [similar, setSimilar] = useState<ApiSimilarDecision[]>([]);
  const [learning, setLearning] = useState<ApiDecisionLearningInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchInventoryBatches(),
      fetchImportCandidates(),
      fetchCustomerCommitments(),
      fetchReceivables(),
      fetchPayables(),
      fetchProducts(),
      fetchSimilarDecisions({ decision_type: situation.type, problem_type: situation.type, limit: 6 }),
      fetchDecisionLearningInsights(),
    ]).then((r) => {
      if (!active) return;
      const [b, c, m, rc, pa, p, sd, li] = r;
      if (b.status === "fulfilled") setBatches(b.value);
      if (c.status === "fulfilled") setCandidates(c.value);
      if (m.status === "fulfilled") setCommitments(m.value);
      if (rc.status === "fulfilled") setReceivables(rc.value);
      if (pa.status === "fulfilled") setPayables(pa.value);
      if (p.status === "fulfilled") setProducts(p.value);
      if (sd.status === "fulfilled") setSimilar(sd.value);
      if (li.status === "fulfilled") setLearning(li.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [situation.type]);

  const categoryOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.item_code.toLowerCase(), p.product_category || "Unclassified");
    for (const b of batches) if (!map.has(b.item_code.toLowerCase())) map.set(b.item_code.toLowerCase(), b.product_category || "Unclassified");
    return (item: string) => map.get(item.toLowerCase()) ?? "Unclassified";
  }, [products, batches]);

  // Scope helpers — respect the situation's country / vertical / product.
  const inVertical = (vertical: string) => !situation.vertical || vertical.toLowerCase() === situation.vertical.toLowerCase();
  const inProduct = (item: string) => !situation.product || item.toLowerCase() === situation.product.toLowerCase();
  const inCountry = (country: string) => !situation.country || country.toLowerCase() === situation.country.toLowerCase();

  const scoped = useMemo(() => {
    const inv = batches.filter((b) => inVertical(b.product_category) && inProduct(b.item_code));
    const comm = commitments.filter((c) => inCountry(c.country) && inVertical(categoryOf(c.material)) && inProduct(c.material));
    const cand = candidates.filter((c) => inCountry(c.destination_country) && (!situation.vertical || (c.shipment_vertical ?? "").toLowerCase() === situation.vertical.toLowerCase()));
    const recv = receivables.filter((r) => inCountry(r.country));
    const pay = payables.filter((p) => inCountry(p.country));

    const invUnits = inv.reduce((s, b) => s + b.quantity_available, 0);
    const invValue = inv.reduce((s, b) => s + convertAmount(b.inventory_value, { from: b.currency, book: "primary", onDate: b.registered_date }), 0);
    const recvOut = recv.reduce((s, r) => s + convertAmount(r.outstanding_value || 0, { from: r.currency, book: "secondary", onDate: r.invoice_date }), 0);
    const payOut = pay.reduce((s, p) => s + convertAmount(p.outstanding_value || 0, { book: "primary", onDate: p.invoice_date }), 0);
    const openComm = comm.filter((c) => !CLOSED_COMMITMENT.has(c.status.toLowerCase()));
    const movement = cand.filter((c) => !CLOSED_IMPORT.has(c.status.toLowerCase())).length + openComm.length;

    return {
      inv,
      comm,
      cand,
      recv,
      pay,
      invUnits,
      invValue,
      recvOut,
      payOut,
      openComm,
      movement,
      countries: new Set([...comm.map((c) => c.country), ...cand.map((c) => c.destination_country)].filter(Boolean)),
      customers: new Set(comm.map((c) => c.customer).filter(Boolean)),
      distributors: new Set(comm.map((c) => c.distributor).filter(Boolean)),
      categories: new Set([...inv.map((b) => b.product_category), ...comm.map((c) => categoryOf(c.material))].filter(Boolean)),
      products: new Set([...inv.map((b) => b.item_code), ...comm.map((c) => c.material)].filter(Boolean)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, candidates, commitments, receivables, payables, categoryOf, situation, rev]);

  // Projected position across the planning horizons, scoped to this situation.
  const projection = useMemo(() => {
    return HORIZONS.map((h) => {
      const horizonDate = addDays(h);
      const current = scoped.inv.reduce((s, b) => s + b.quantity_available, 0);
      const incoming = scoped.cand
        .filter((c) => !CLOSED_IMPORT.has(c.status.toLowerCase()) && (!c.flight_date || c.flight_date <= horizonDate))
        .reduce((s, c) => s + c.lines.filter((l) => inProduct(l.item_code)).reduce((a, l) => a + l.quantity, 0), 0);
      const demand = scoped.openComm
        .filter((c) => c.required_delivery_date <= horizonDate)
        .reduce((s, c) => s + Math.max(c.ordered_quantity - c.delivered_quantity, 0), 0);
      return { horizon: h, label: h === 0 ? "Today" : `+${h}d`, projected: current + incoming - demand, incoming, demand };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped]);

  // Product Intelligence — Country + Vertical → Category → Product (value /
  // volume / movement). Verticals are never benchmarked against each other.
  const productIntel = useMemo(() => {
    const map = new Map<string, { category: string; item: string; value: number; volume: number; movement: number }>();
    for (const b of scoped.inv) {
      const key = `${b.product_category}|${b.item_code}`;
      const entry = map.get(key) ?? { category: b.product_category || "Unclassified", item: b.item_code, value: 0, volume: 0, movement: 0 };
      entry.value += convertAmount(b.inventory_value, { from: b.currency, book: "primary", onDate: b.registered_date });
      entry.volume += b.quantity_available;
      map.set(key, entry);
    }
    for (const c of scoped.openComm) {
      const key = `${categoryOf(c.material)}|${c.material}`;
      const entry = map.get(key) ?? { category: categoryOf(c.material), item: c.material, value: 0, volume: 0, movement: 0 };
      entry.movement += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped]);

  const money = (v: number) => formatDisplay(v, { compact: true });
  const isFinance = /receivable|payment/i.test(situation.type);
  const headlineValue = isFinance ? scoped.recvOut : scoped.invValue;

  // Portfolio scope of the signed-in user (vertical scope + responsibility
  // domains arrive with the Advanced RBAC matrix).
  const userCountries = currentUser.country_scope?.length ? currentUser.country_scope.join(", ") : "All countries";

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <div className="ops-stage situation-room">
      {/* Section 1 — Situation summary */}
      <section className={`cockpit-hero situation-hero ${situation.kind}`}>
        <div className="cockpit-hero-top">
          <div>
            <button type="button" className="situation-back" onClick={onBack}>
              <ArrowLeft size={15} aria-hidden="true" /> Operations Intelligence
            </button>
            <p className="eyebrow">
              {situation.kind === "positive" ? "Situation Room · win to replicate" : "Situation Room · investigate"} ·{" "}
              {DomainLabel(situation.domain)}
            </p>
            <h2>{situation.title}</h2>
            <p className="dash-story">{situation.detail}</p>
            <div className="situation-tags">
              <span className={`risk-pill ${severityClass(situation.severity)}`}>{situation.severity}</span>
              <span className="tag">{situation.type}</span>
              {situation.country ? <span className="tag">{situation.country}</span> : null}
              {situation.vertical ? <span className="tag">{situation.vertical}</span> : null}
              {situation.product ? <span className="tag">{situation.product}</span> : null}
            </div>
          </div>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{money(headlineValue)}</strong>
            <span>Value impact</span>
          </div>
          <div className="vital">
            <strong>{num(scoped.invUnits)}</strong>
            <span>Volume impact (units)</span>
          </div>
          <div className="vital">
            <strong>{num(scoped.movement)}</strong>
            <span>Movement (active flows)</span>
          </div>
          <div className="vital">
            <strong>{situation.country ?? `${scoped.countries.size}`}</strong>
            <span>{situation.country ? "Country" : "Affected countries"}</span>
          </div>
          <div className="vital">
            <strong>{situation.vertical ?? `${scoped.categories.size}`}</strong>
            <span>{situation.vertical ? "Vertical" : "Affected categories"}</span>
          </div>
        </div>
      </section>

      <div className="hub-columns">
        <main className="decision-cockpit-main">
          {/* Section 2 — Impact analysis */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Users size={16} aria-hidden="true" />
                <h2>Impact analysis</h2>
              </div>
            </div>
            <div className="situation-impact-grid">
              {[
                { label: "Countries", value: scoped.countries.size },
                { label: "Customers", value: scoped.customers.size },
                { label: "Distributors", value: scoped.distributors.size },
                { label: "Inventory batches", value: scoped.inv.length },
                { label: "Open orders", value: scoped.openComm.length },
                { label: "Inbound shipments", value: scoped.cand.length },
                { label: "Receivables", value: scoped.recv.length },
                { label: "Payables", value: scoped.pay.length },
                { label: "Product categories", value: scoped.categories.size },
                { label: "Products", value: scoped.products.size },
              ].map((cell) => (
                <div className="situation-impact-cell" key={cell.label}>
                  <strong>{num(cell.value)}</strong>
                  <span>{cell.label}</span>
                </div>
              ))}
            </div>
            {situation.workView ? (
              <div className="review-form-actions">
                <button type="button" className="secondary-action" onClick={() => onNavigate(situation.workView as string)}>
                  Open affected records
                </button>
              </div>
            ) : null}
          </section>

          {/* Section 3 — Timeline (projected position across planning horizons) */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <CalendarClock size={16} aria-hidden="true" />
                <h2>Timeline · projected position</h2>
              </div>
            </div>
            <div className="situation-timeline">
              {projection.map((p) => (
                <div className="situation-timeline-step" key={p.horizon}>
                  <span className="situation-timeline-label">{p.label}</span>
                  <strong className={p.projected < 0 ? "tone-bad-text" : ""}>{num(p.projected)}</strong>
                  <small>
                    +{num(p.incoming)} in · −{num(p.demand)} out
                  </small>
                </div>
              ))}
            </div>
            <p className="access-note">
              <small>Current stock + incoming supply − committed demand, by Today / +15 / +30 / +45 days, for this situation's scope.</small>
            </p>
          </section>

          {/* Section 7 — Product Intelligence */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Layers size={16} aria-hidden="true" />
                <h2>Product intelligence · category → product</h2>
              </div>
            </div>
            {productIntel.length === 0 ? (
              <p className="empty-state">No products in this situation's scope yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Product</th>
                    <th>Value</th>
                    <th>Volume</th>
                    <th>Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {productIntel.map((row) => (
                    <tr key={`${row.category}-${row.item}`}>
                      <td>{row.category}</td>
                      <td>{row.item}</td>
                      <td>{money(row.value)}</td>
                      <td>{num(row.volume)}</td>
                      <td>{num(row.movement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <aside className="decision-rail">
          {/* Section 5 — Recommended actions */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Lightbulb size={15} aria-hidden="true" />
                <h2>Recommended actions</h2>
              </div>
            </div>
            <ul className="situation-actions">
              {recommendedActions(situation).map((action) => (
                <li key={action}>
                  <ListChecks size={14} aria-hidden="true" /> {action}
                </li>
              ))}
            </ul>
            <p className="access-note">
              <small>Recommendations only — the system never decides.</small>
            </p>
          </section>

          {/* Section 6 — Decisions */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Target size={15} aria-hidden="true" />
                <h2>Decision</h2>
              </div>
            </div>
            <div className="review-form-actions">
              <button type="button" className="review-decide-save" onClick={() => onNavigate("decision-center")}>
                <GitBranch size={15} aria-hidden="true" /> Record a decision
              </button>
            </div>
            <p className="access-note">
              <small>Opens the Decision cockpit, where this call is captured, tracked, and its outcome closed.</small>
            </p>
          </section>

          {/* Section 4 — Historical context */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Sparkles size={15} aria-hidden="true" />
                <h2>How we handled this before</h2>
              </div>
              <span className="cc-panel-meta">{similar.length}</span>
            </div>
            {learning && learning.overall_success_rate_pct != null ? (
              <p className="access-note">
                <small>
                  Past decisions of this kind succeeded {Math.round(learning.overall_success_rate_pct)}% of the time
                  {learning.most_successful_decisions[0]
                    ? ` — most effective: ${learning.most_successful_decisions[0].key.replace(/[_-]/g, " ")}`
                    : ""}
                  .
                </small>
              </p>
            ) : null}
            {similar.length === 0 ? (
              <p className="empty-state">No similar past decisions yet — this one breaks new ground.</p>
            ) : (
              <div className="worklist-body">
                {similar.map((row) => (
                  <div className="worklist-row" key={row.decision_id}>
                    <div>
                      <strong>{row.decision_type.replace(/[_-]/g, " ")}</strong>
                      <small>{row.reason}</small>
                      {row.actual_outcome ? <small className="decision-similar-outcome">→ {row.actual_outcome}</small> : null}
                    </div>
                    <span className={`risk-pill ${row.effectiveness === "effective" ? "risk-low" : row.effectiveness === "ineffective" ? "risk-critical" : "tag"}`}>
                      {row.effectiveness ? row.effectiveness.replace(/[_-]/g, " ") : "Open"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sections 8/9/10 — Governance (portfolio, escalation, review) */}
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldCheck size={15} aria-hidden="true" />
                <h2>Governance</h2>
              </div>
            </div>
            <dl className="situation-governance">
              <div>
                <dt>Owner</dt>
                <dd>{currentUser.email}</dd>
              </div>
              <div>
                <dt>Your portfolio</dt>
                <dd>{userCountries} · {DomainLabel(situation.domain)} domain</dd>
              </div>
              <div>
                <dt>Escalation</dt>
                <dd className="muted-cell">Not escalated — chains are set in the Escalation Matrix Designer (coming next)</dd>
              </div>
              <div>
                <dt>Last review</dt>
                <dd className="muted-cell">Review Governance arrives with the App-Manager cockpit (coming next)</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
