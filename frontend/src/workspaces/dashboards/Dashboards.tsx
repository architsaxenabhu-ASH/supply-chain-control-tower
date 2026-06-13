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

function Hero({
  eyebrow,
  title,
  vitals,
}: {
  eyebrow: string;
  title: string;
  vitals: Vital[];
}) {
  return (
    <section className="cockpit-hero">
      <div className="cockpit-hero-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
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

  if (loading) return <Loading />;

  return (
    <div className="ops-stage">
      <Hero
        eyebrow="Dashboard · Primary Sales"
        title={`${money(incomingValue)} of inventory inbound from Meril India`}
        vitals={[
          { label: "Incoming inventory value", value: money(incomingValue) },
          { label: "Open shipments", value: num(dash?.open_shipments ?? 0) },
          { label: "Awaiting receipt", value: num(dash?.awaiting_receipt ?? 0), tone: (dash?.awaiting_receipt ?? 0) > 0 ? "warn" : undefined },
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
            <p className="empty-state">Shipments appear here as imports are assembled with a destination country.</p>
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
              <p className="empty-state">No shipments in flight.</p>
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

  return (
    <div className="ops-stage">
      <Hero
        eyebrow="Dashboard · Inventory"
        title={`${money(dash?.total_value ?? 0)} of stock holds the bridge between buying and selling`}
        vitals={[
          { label: "Inventory value", value: money(dash?.total_value ?? 0) },
          { label: "Available units", value: num(dash?.total_quantity ?? 0) },
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
          <DonutChart slices={categorySlices} centerLabel="Stock value" formatValue={(v) => formatDisplay(v, { compact: true })} />
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
              <p className="empty-state">No stock inside the expiry windows.</p>
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

  return (
    <div className="ops-stage">
      <Hero
        eyebrow="Dashboard · Secondary Sales"
        title={`${num(dash?.open_commitments ?? 0)} open customer orders in play`}
        vitals={[
          { label: "Backorder value", value: money(dash?.total_backorder_value ?? 0), tone: (dash?.total_backorder_value ?? 0) > 0 ? "warn" : undefined },
          { label: "Delivered units", value: num(salesQty) },
          { label: "Open orders", value: num(dash?.open_commitments ?? 0) },
          { label: "Backorders", value: num(dash?.backordered_commitments ?? 0), tone: (dash?.backordered_commitments ?? 0) > 0 ? "bad" : "good" },
          { label: "OTIF", value: dash?.otif_pct == null ? "—" : `${Math.round(dash.otif_pct)}%`, tone: dash?.otif_pct != null && dash.otif_pct < 85 ? "bad" : "good" },
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
            <p className="empty-state">Customer orders appear here as commitments are recorded.</p>
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

  return (
    <div className="ops-stage">
      <Hero
        eyebrow="Dashboard · Business"
        title="Executive overview — achievement, risk, and what needs a decision"
        vitals={[
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
            <p className="empty-state">Set country targets to track achievement here.</p>
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
              <p className="empty-state">Set vertical targets to track achievement here.</p>
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
              <p className="empty-state">Nothing flagged for attention.</p>
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

  return (
    <div className="ops-stage">
      <Hero
        eyebrow="Dashboard · Finance"
        title={`${money(recvOutstanding)} to collect · ${money(payOutstanding)} to pay`}
        vitals={[
          { label: "Receivables outstanding", value: money(recvOutstanding) },
          { label: "Payables outstanding", value: money(payOutstanding) },
          { label: "Net cash position", value: money(recvOutstanding - payOutstanding), tone: recvOutstanding - payOutstanding >= 0 ? "good" : "bad" },
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
            <p className="empty-state">Invoices appear here as they are raised.</p>
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
              <p className="empty-state">Partner invoices appear here as costs are recorded.</p>
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
