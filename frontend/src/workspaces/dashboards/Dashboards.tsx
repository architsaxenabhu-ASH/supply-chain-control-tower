import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Compass,
  Globe2,
  HandCoins,
  PlaneLanding,
  Send,
  Stamp,
  Wallet,
} from "lucide-react";

import {
  fetchApprovals,
  fetchCommitmentDashboard,
  fetchConsignmentDashboard,
  fetchCountryPerformanceV2,
  fetchCreditControl,
  fetchCustomerCommitments,
  fetchDecisions,
  fetchExecutiveActions,
  fetchImportCandidates,
  fetchImportDashboard,
  fetchInventoryDashboard,
  fetchPayables,
  fetchReceivables,
  fetchVerticalPerformance,
  type ApiApproval,
  type ApiCommitmentDashboard,
  type ApiConsignmentDashboard,
  type ApiCountryPerformance,
  type ApiCreditControl,
  type ApiCustomerCommitment,
  type ApiDecision,
  type ApiExecutiveAction,
  type ApiImportDashboard,
  type ApiImportFileCandidate,
  type ApiInventoryDashboard,
  type ApiPayable,
  type ApiReceivable,
} from "../../lib/api";
import { WorldMap } from "../../components/WorldMap";
import { DonutChart } from "../../components/DonutChart";
import {
  convertAmount,
  formatDisplay,
  formatMoney,
  formatUnits,
  getCurrencyRevision,
  subscribeCurrency,
} from "../../lib/currency";

// Five summary dashboards (Phase 5H). They roll up the operations workspaces;
// they are not operational screens. Each reuses the OPS visual language
// (cockpit-hero, vitals, seg-bar, score bars, world map, donut) and the
// book-aware currency engine.

const num = formatUnits;
const money = (value: number) => formatMoney(value, { compact: true });
const todayStamp = () => new Date().toISOString().slice(0, 10);

type Vital = { label: string; value: string; tone?: "good" | "warn" | "bad" };

// Every dashboard answers one management question (the eyebrow), leads with the
// answer (the title), and tells the story in one interpreted sentence.
function Hero({
  question,
  answer,
  story,
  vitals,
}: {
  question: string;
  answer: string;
  story: string;
  vitals: Vital[];
}) {
  return (
    <section className="cockpit-hero">
      <div className="cockpit-hero-top">
        <div>
          <p className="eyebrow">{question}</p>
          <h2>{answer}</h2>
          <p className="dash-story">{story}</p>
        </div>
      </div>
      <div className="vitals-row">
        {vitals.map((vital) => (
          <div className={`vital${vital.tone ? ` tone-${vital.tone}` : ""}`} key={vital.label}>
            <strong>{vital.value}</strong>
            <span>{vital.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Loading() {
  return (
    <div className="cc-loading" aria-busy="true">
      <div className="skeleton-row tall" />
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </div>
  );
}

// Composed empty state for low/no data — teaches what fills the panel so the
// system feels complete while data volume is still growing.
function EmptyStory({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Globe2;
  title: string;
  hint: string;
}) {
  return (
    <div className="empty-story">
      <span className="empty-story-mark">
        <Icon size={22} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );
}

function statusSegments(byStatus: Record<string, number>): { label: string; count: number; tone: string }[] {
  const tone = (status: string): string => {
    const key = status.toLowerCase();
    if (["received", "closed", "delivered", "fulfilled", "paid"].some((s) => key.includes(s))) return "good";
    if (["delay", "overdue", "cancel", "reject", "risk", "backorder"].some((s) => key.includes(s))) return "bad";
    if (["pending", "await", "transit", "progress", "partial"].some((s) => key.includes(s))) return "warn";
    return "info";
  };
  return Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ label: status.replace(/[_-]/g, " "), count, tone: tone(status) }));
}

function SegmentBar({ segments }: { segments: { label: string; count: number; tone: string }[] }) {
  if (segments.length === 0) return null;
  return (
    <>
      <div className="seg-bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(", ")}>
        {segments.map((segment) => (
          <span key={segment.label} className={`seg-${segment.tone}`} style={{ flexGrow: segment.count }} />
        ))}
      </div>
      <ul className="seg-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className={`seg-dot seg-${segment.tone}`} aria-hidden="true" /> {segment.label}{" "}
            <strong>{segment.count}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? "" : value >= 95 ? " tone-good" : value >= 85 ? " tone-warn" : " tone-bad";
  return (
    <div className="score-row">
      <div className="score-row-head">
        <span>{label}</span>
        <strong>{value === null ? "—" : `${Math.round(value)}%`}</strong>
      </div>
      <div className="score-row-track">
        <div className={`score-row-fill${tone}`} style={{ width: `${Math.min(Math.max(value ?? 0, 0), 100)}%` }} />
      </div>
    </div>
  );
}

// ============================ 1. PRIMARY SALES ============================

export function PrimarySalesDashboard() {
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [dash, setDash] = useState<ApiImportDashboard | null>(null);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [payables, setPayables] = useState<ApiPayable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchImportDashboard(), fetchImportCandidates(), fetchPayables()]).then(([d, c, p]) => {
      if (!active) return;
      if (d.status === "fulfilled") setDash(d.value);
      if (c.status === "fulfilled") setCandidates(c.value);
      if (p.status === "fulfilled") setPayables(p.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const today = todayStamp();
  const incomingValue = useMemo(() => {
    let sum = 0;
    for (const candidate of candidates) {
      if (["received", "closed", "cancelled"].includes(candidate.status.toLowerCase())) continue;
      for (const line of candidate.lines) {
        sum += convertAmount((line.unit_value ?? 0) * line.quantity, {
          from: line.currency,
          book: "primary",
          onDate: candidate.invoice_date,
        });
      }
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, rev]);

  const partnerCosts = useMemo(
    () => payables.reduce((sum, p) => sum + convertAmount(p.outstanding_value || 0, { book: "primary", onDate: p.invoice_date }), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payables, rev],
  );
  const delays = candidates.filter(
    (c) => c.flight_date && c.flight_date < today && !["received", "closed", "cancelled"].includes(c.status.toLowerCase()),
  ).length;
  const inbound = dash?.open_shipments ?? 0;
  const awaiting = dash?.awaiting_receipt ?? 0;

  if (loading) return <Loading />;

  const hasData = candidates.length > 0;
  const answer = !hasData
    ? "Nothing inbound yet — the pipeline is clear"
    : `${money(incomingValue)} of inventory is on its way from Meril India`;
  const story = !hasData
    ? "This is your inbound pipeline. As you assemble import shipments in Primary Sales → Operations, their value, status, and arrival risk surface here."
    : delays > 0
      ? `${delays} shipment${delays === 1 ? " is" : "s are"} past ETA and need chasing; ${awaiting} more ${awaiting === 1 ? "has" : "have"} landed and ${awaiting === 1 ? "is" : "are"} waiting to be received into stock.`
      : `${inbound} shipment${inbound === 1 ? "" : "s"} in motion and ${awaiting} waiting to be received — nothing is overdue right now.`;

  return (
    <div className="ops-stage">
      <Hero
        question="Primary Sales · What is coming?"
        answer={answer}
        story={story}
        vitals={[
          { label: "Incoming inventory value", value: money(incomingValue) },
          { label: "Open shipments", value: num(inbound) },
          { label: "Awaiting receipt", value: num(awaiting), tone: awaiting > 0 ? "warn" : undefined },
          { label: "Import delays", value: num(delays), tone: delays > 0 ? "bad" : "good" },
          { label: "Partner costs outstanding", value: money(partnerCosts) },
        ]}
      />
      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Globe2 size={16} aria-hidden="true" />
              <h2>Inbound shipments by destination</h2>
            </div>
          </div>
          {dash && Object.keys(dash.by_country).length > 0 ? (
            <WorldMap
              values={dash.by_country}
              formatValue={(v) => `${num(v)} shipment${v === 1 ? "" : "s"}`}
              caption="Open import shipments by destination country"
            />
          ) : (
            <EmptyStory
              icon={Globe2}
              title="The map lights up as imports arrive"
              hint="Assemble an import shipment with a destination country and it appears here, sized by how many shipments are heading to each subsidiary."
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <PlaneLanding size={16} aria-hidden="true" />
                <h2>Shipment status</h2>
              </div>
            </div>
            {dash && Object.keys(dash.by_status).length > 0 ? (
              <SegmentBar segments={statusSegments(dash.by_status)} />
            ) : (
              <EmptyStory
                icon={PlaneLanding}
                title="No shipments in flight"
                hint="Once shipments are moving, this bar shows how many are in transit, awaiting receipt, or received."
              />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ============================== 2. INVENTORY ==============================

export function InventoryDashboard() {
  useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [dash, setDash] = useState<ApiInventoryDashboard | null>(null);
  const [consignment, setConsignment] = useState<ApiConsignmentDashboard | null>(null);
  const [commitment, setCommitment] = useState<ApiCommitmentDashboard | null>(null);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchInventoryDashboard(),
      fetchConsignmentDashboard(),
      fetchCommitmentDashboard(),
      fetchCustomerCommitments(),
    ]).then(([d, cons, comm, list]) => {
      if (!active) return;
      if (d.status === "fulfilled") setDash(d.value);
      if (cons.status === "fulfilled") setConsignment(cons.value);
      if (comm.status === "fulfilled") setCommitment(comm.value);
      if (list.status === "fulfilled") setCommitments(list.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const allocated = commitments
    .filter((c) => !["fulfilled", "delivered", "cancelled", "closed"].includes(c.status.toLowerCase()))
    .reduce((sum, c) => sum + c.allocated_quantity, 0);
  const expiryRisk = (dash?.expiring_90 ?? 0) + (dash?.expired ?? 0);
  const categorySlices = useMemo(
    () => Object.entries(dash?.by_category_value ?? {}).map(([label, value]) => ({ label, value })),
    [dash],
  );

  if (loading) return <Loading />;

  const expirySegments = [
    { label: "0-30 days", count: dash?.expiring_30 ?? 0, tone: "bad" },
    { label: "31-60 days", count: dash?.expiring_60 ?? 0, tone: "warn" },
    { label: "61-90 days", count: dash?.expiring_90 ?? 0, tone: "info" },
    { label: "Expired", count: dash?.expired ?? 0, tone: "bad" },
  ].filter((s) => s.count > 0);

  const stockValue = dash?.total_value ?? 0;
  const stockQty = dash?.total_quantity ?? 0;
  const hasStock = stockQty > 0;
  const answer = !hasStock
    ? "No stock on the books yet"
    : `${money(stockValue)} of stock holds the bridge between buying and selling`;
  const story = !hasStock
    ? "Inventory is the heart of the subsidiary. The moment a goods receipt posts, available units, value, allocations, and expiry risk all appear here."
    : expiryRisk > 0
      ? `${num(allocated)} units are already promised to customers, and ${expiryRisk} batch${expiryRisk === 1 ? "" : "es"} need attention before they expire — clear those first to protect value.`
      : `${num(allocated)} units are committed to customers and ${num(consignment?.total_consignments ?? 0)} consignment line${(consignment?.total_consignments ?? 0) === 1 ? "" : "s"} sit in the field. Nothing is at expiry risk.`;

  return (
    <div className="ops-stage">
      <Hero
        question="Inventory · What do we have?"
        answer={answer}
        story={story}
        vitals={[
          { label: "Inventory value", value: money(stockValue) },
          { label: "Available units", value: num(stockQty) },
          { label: "Backordered (commitments)", value: num(commitment?.backordered_commitments ?? 0), tone: (commitment?.backordered_commitments ?? 0) > 0 ? "warn" : undefined },
          { label: "Allocated to customer POs", value: num(allocated) },
          { label: "Expiry risk batches", value: num(expiryRisk), tone: expiryRisk > 0 ? "bad" : "good" },
          { label: "Consignment in field", value: num(consignment?.total_consignments ?? 0) },
        ]}
      />
      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Boxes size={16} aria-hidden="true" />
              <h2>Value by vertical</h2>
            </div>
          </div>
          {categorySlices.length > 0 ? (
            <DonutChart slices={categorySlices} centerLabel="Stock value" formatValue={(v) => formatDisplay(v, { compact: true })} />
          ) : (
            <EmptyStory
              icon={Boxes}
              title="No stock to break down yet"
              hint="As goods are received, this donut splits your inventory value across product verticals so you see where the money sits."
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <AlertTriangle size={15} aria-hidden="true" />
                <h2>Expiry exposure</h2>
              </div>
            </div>
            {expirySegments.length > 0 ? (
              <SegmentBar segments={expirySegments} />
            ) : (
              <EmptyStory
                icon={AlertTriangle}
                title={hasStock ? "Nothing near expiry" : "Expiry watch is ready"}
                hint={hasStock ? "All stock is comfortably dated — this bar fills only when batches enter the 90-day windows." : "Batches with expiry dates appear here, banded by how soon they expire, so risk is visible early."}
              />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ========================== 3. SECONDARY SALES ==========================

export function SecondarySalesDashboard() {
  useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [dash, setDash] = useState<ApiCommitmentDashboard | null>(null);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchCommitmentDashboard(), fetchCustomerCommitments()]).then(([d, list]) => {
      if (!active) return;
      if (d.status === "fulfilled") setDash(d.value);
      if (list.status === "fulfilled") setCommitments(list.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const salesQty = commitments.reduce((sum, c) => sum + c.delivered_quantity, 0);
  const customers = new Set(commitments.map((c) => c.customer)).size;
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of commitments) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [commitments]);

  if (loading) return <Loading />;

  const open = dash?.open_commitments ?? 0;
  const back = dash?.backordered_commitments ?? 0;
  const otif = dash?.otif_pct;
  const hasOrders = commitments.length > 0;
  const answer = !hasOrders
    ? "No customer orders on the books yet"
    : `${num(open)} open order${open === 1 ? "" : "s"} promised to ${num(customers)} customer${customers === 1 ? "" : "s"}`;
  const story = !hasOrders
    ? "This is the promise side of the business. As customer POs are captured, what you owe, what you have delivered, and whether you are on time all read here."
    : back > 0
      ? `${back} order${back === 1 ? " is" : "s are"} short on stock and backordered${otif != null ? `, and on-time-in-full sits at ${Math.round(otif)}%` : ""} — these are the promises at risk.`
      : `Every open order is covered by stock${otif != null ? ` and on-time-in-full is ${Math.round(otif)}%` : ""}. You have delivered ${num(salesQty)} units so far.`;

  return (
    <div className="ops-stage">
      <Hero
        question="Secondary Sales · What have we promised and delivered?"
        answer={answer}
        story={story}
        vitals={[
          { label: "Backorder value", value: money(dash?.total_backorder_value ?? 0), tone: (dash?.total_backorder_value ?? 0) > 0 ? "warn" : undefined },
          { label: "Delivered units", value: num(salesQty) },
          { label: "Open orders", value: num(open) },
          { label: "Backorders", value: num(back), tone: back > 0 ? "bad" : "good" },
          { label: "OTIF", value: otif == null ? "—" : `${Math.round(otif)}%`, tone: otif != null && otif < 85 ? "bad" : "good" },
          { label: "Customers served", value: num(customers) },
        ]}
      />
      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Send size={16} aria-hidden="true" />
              <h2>Order status mix</h2>
            </div>
          </div>
          {Object.keys(byStatus).length > 0 ? (
            <SegmentBar segments={statusSegments(byStatus)} />
          ) : (
            <EmptyStory
              icon={Send}
              title="No customer orders yet"
              hint="As commitments are recorded, this bar shows how orders split across fulfilled, in-progress, backordered, and delayed."
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Send size={16} aria-hidden="true" />
                <h2>Service levels</h2>
              </div>
            </div>
            <div className="score-stack">
              <ScoreBar label="OTIF — on time, in full" value={dash?.otif_pct ?? null} />
              <ScoreBar label="Average fill rate" value={dash?.average_fill_rate_pct ?? null} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ============================= 4. BUSINESS =============================

export function BusinessDashboard() {
  const [countries, setCountries] = useState<ApiCountryPerformance[]>([]);
  const [verticals, setVerticals] = useState<ApiCountryPerformance[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [decisions, setDecisions] = useState<ApiDecision[]>([]);
  const [actions, setActions] = useState<ApiExecutiveAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchCountryPerformanceV2(),
      fetchVerticalPerformance(),
      fetchApprovals("pending"),
      fetchDecisions(),
      fetchExecutiveActions(),
    ]).then(([c, v, a, d, ex]) => {
      if (!active) return;
      if (c.status === "fulfilled") setCountries(c.value);
      if (v.status === "fulfilled") setVerticals(v.value);
      if (a.status === "fulfilled") setApprovals(a.value);
      if (d.status === "fulfilled") setDecisions(d.value);
      if (ex.status === "fulfilled") setActions(ex.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const topCountries = useMemo(
    () => [...countries].sort((a, b) => (b.value_achievement_pct ?? 0) - (a.value_achievement_pct ?? 0)).slice(0, 6),
    [countries],
  );
  const topVerticals = useMemo(
    () => [...verticals].sort((a, b) => (b.value_achievement_pct ?? 0) - (a.value_achievement_pct ?? 0)).slice(0, 6),
    [verticals],
  );

  if (loading) return <Loading />;

  const avgAchievement =
    topCountries.length > 0
      ? Math.round(
          topCountries.reduce((sum, c) => sum + (c.value_achievement_pct ?? 0), 0) / topCountries.length,
        )
      : null;
  const onTarget = countries.filter((c) => (c.value_achievement_pct ?? 0) >= 100).length;
  const hasTargets = countries.length > 0 || verticals.length > 0;
  const answer = !hasTargets
    ? "No targets set yet — achievement is not being tracked"
    : avgAchievement === null
      ? "Targets are set; achievement is building"
      : `${onTarget} of ${countries.length} countries are at or above target`;
  const story = !hasTargets
    ? "This is the executive view. Set country and vertical targets (Secondary Sales → Performance) and this dashboard tracks achievement, risk, and what needs a decision."
    : actions.length > 0 || approvals.length > 0
      ? `${approvals.length} approval${approvals.length === 1 ? "" : "s"} and ${actions.length} risk${actions.length === 1 ? "" : "s"} are waiting on management${avgAchievement !== null ? `, with average achievement at ${avgAchievement}%` : ""}.`
      : `Average achievement is ${avgAchievement}% and nothing is waiting on management attention — the business is running clean.`;

  return (
    <div className="ops-stage">
      <Hero
        question="Business · Are we achieving targets?"
        answer={answer}
        story={story}
        vitals={[
          { label: "Avg achievement", value: avgAchievement === null ? "—" : `${avgAchievement}%`, tone: avgAchievement === null ? undefined : avgAchievement >= 100 ? "good" : avgAchievement >= 85 ? "warn" : "bad" },
          { label: "Countries tracked", value: num(countries.length) },
          { label: "Verticals tracked", value: num(verticals.length) },
          { label: "Open approvals", value: num(approvals.length), tone: approvals.length > 0 ? "warn" : "good" },
          { label: "Open risks", value: num(actions.length), tone: actions.length > 0 ? "bad" : "good" },
          { label: "Decisions logged", value: num(decisions.length) },
        ]}
      />
      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Globe2 size={16} aria-hidden="true" />
              <h2>Country achievement</h2>
            </div>
          </div>
          {topCountries.length > 0 ? (
            <div className="score-stack">
              {topCountries.map((c) => (
                <ScoreBar key={c.name} label={c.name} value={c.value_achievement_pct} />
              ))}
            </div>
          ) : (
            <EmptyStory
              icon={Globe2}
              title="No country targets yet"
              hint="Set a target for a country in Secondary Sales → Performance and its achievement appears here as a progress bar."
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Compass size={15} aria-hidden="true" />
                <h2>Vertical achievement</h2>
              </div>
            </div>
            {topVerticals.length > 0 ? (
              <div className="score-stack">
                {topVerticals.map((v) => (
                  <ScoreBar key={v.name} label={v.name} value={v.value_achievement_pct} />
                ))}
              </div>
            ) : (
              <EmptyStory
                icon={Compass}
                title="No vertical targets yet"
                hint="Targets set per vertical (Cardio, Ortho, …) show their achievement here side by side."
              />
            )}
          </section>
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Stamp size={15} aria-hidden="true" />
                <h2>Management attention</h2>
              </div>
              <span className="cc-panel-meta">{actions.length}</span>
            </div>
            {actions.length === 0 ? (
              <EmptyStory
                icon={Stamp}
                title="Nothing needs management attention"
                hint="Risks, overdue approvals, and exceptions surface here the moment the system detects them — a clear panel means a clear desk."
              />
            ) : (
              <div className="worklist-body">
                {actions.slice(0, 6).map((action, index) => (
                  <div className="worklist-row" key={`${action.reference ?? action.title}-${index}`}>
                    <div>
                      <strong>{action.title}</strong>
                      {action.detail ? <small>{action.detail}</small> : null}
                    </div>
                    <span className={`risk-pill ${action.severity === "high" ? "risk-critical" : action.severity === "medium" ? "risk-medium" : "risk-low"}`}>
                      {action.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ============================== 5. FINANCE ==============================

export function FinanceDashboard() {
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [receivables, setReceivables] = useState<ApiReceivable[]>([]);
  const [payables, setPayables] = useState<ApiPayable[]>([]);
  const [credit, setCredit] = useState<ApiCreditControl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchReceivables(), fetchPayables(), fetchCreditControl()]).then(([r, p, c]) => {
      if (!active) return;
      if (r.status === "fulfilled") setReceivables(r.value);
      if (p.status === "fulfilled") setPayables(p.value);
      if (c.status === "fulfilled") setCredit(c.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const recvOutstanding = useMemo(
    () => receivables.reduce((sum, r) => sum + convertAmount(r.outstanding_value || 0, { from: r.currency, book: "secondary", onDate: r.invoice_date }), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receivables, rev],
  );
  const payOutstanding = useMemo(
    () => payables.reduce((sum, p) => sum + convertAmount(p.outstanding_value || 0, { book: "primary", onDate: p.invoice_date }), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payables, rev],
  );
  const recvOverdue = receivables.filter((r) => r.status === "overdue").reduce((sum, r) => sum + convertAmount(r.outstanding_value || 0, { from: r.currency, book: "secondary", onDate: r.invoice_date }), 0);
  const creditExposure = credit.reduce((sum, c) => sum + (c.outstanding_exposure || 0), 0);

  if (loading) return <Loading />;

  const net = recvOutstanding - payOutstanding;
  const hasFinance = receivables.length > 0 || payables.length > 0;
  const answer = !hasFinance
    ? "No exposure yet — no money is owed in either direction"
    : `${money(recvOutstanding)} to collect, ${money(payOutstanding)} to pay`;
  const story = !hasFinance
    ? "This is the money view. As customer invoices and partner costs are recorded, your collect-versus-pay position, credit exposure, and overdue amounts read here."
    : recvOverdue > 0
      ? `${money(recvOverdue)} of receivables is already overdue — collecting it is the fastest way to improve a net position of ${money(net)}.`
      : `Your net position is ${money(net)} and nothing is overdue. Watch credit exposure of ${money(creditExposure)} across distributors.`;

  return (
    <div className="ops-stage">
      <Hero
        question="Finance · What is our exposure?"
        answer={answer}
        story={story}
        vitals={[
          { label: "Receivables outstanding", value: money(recvOutstanding) },
          { label: "Payables outstanding", value: money(payOutstanding) },
          { label: "Net cash position", value: money(net), tone: net >= 0 ? "good" : "bad" },
          { label: "Credit exposure", value: formatDisplay(convertAmount(creditExposure, { book: "secondary" }), { compact: true }) },
          { label: "Receivables overdue", value: money(recvOverdue), tone: recvOverdue > 0 ? "bad" : "good" },
        ]}
      />
      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Banknote size={16} aria-hidden="true" />
              <h2>Receivables ageing</h2>
            </div>
            <span className="cc-panel-meta">{receivables.length}</span>
          </div>
          {receivables.length > 0 ? (
            <SegmentBar
              segments={statusSegments(
                receivables.reduce<Record<string, number>>((map, r) => {
                  map[r.status] = (map[r.status] ?? 0) + 1;
                  return map;
                }, {}),
              )}
            />
          ) : (
            <EmptyStory
              icon={Banknote}
              title="No receivables yet"
              hint="Customer invoices appear here as they are raised, banded by open, partially paid, overdue, and paid."
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <HandCoins size={15} aria-hidden="true" />
                <h2>Partner exposure (payables)</h2>
              </div>
              <span className="cc-panel-meta">{payables.length}</span>
            </div>
            {payables.length > 0 ? (
              <SegmentBar
                segments={statusSegments(
                  payables.reduce<Record<string, number>>((map, p) => {
                    map[p.status] = (map[p.status] ?? 0) + 1;
                    return map;
                  }, {}),
                )}
              />
            ) : (
              <EmptyStory
                icon={HandCoins}
                title="No partner costs yet"
                hint="Freight, customs, warehouse, and logistics invoices appear here as they are recorded, so exposure to each partner is visible."
              />
            )}
          </section>
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Wallet size={15} aria-hidden="true" />
                <h2>Credit control</h2>
              </div>
            </div>
            {credit.filter((c) => c.status !== "healthy").length === 0 ? (
              <p className="empty-state">All distributors are inside their credit limits.</p>
            ) : (
              <div className="worklist-body">
                {credit
                  .filter((c) => c.status !== "healthy")
                  .slice(0, 6)
                  .map((c) => (
                    <div className="worklist-row" key={c.distributor}>
                      <div>
                        <strong>{c.distributor}</strong>
                        <small>{money(c.outstanding_exposure)} of {money(c.credit_limit)} limit</small>
                      </div>
                      <span className={`risk-pill ${c.status === "blocked" ? "risk-critical" : "risk-medium"}`}>{c.status}</span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
