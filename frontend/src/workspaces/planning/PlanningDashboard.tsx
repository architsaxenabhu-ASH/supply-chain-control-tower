import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CalendarRange, Layers, MoveRight, PackageOpen, PlaneLanding, Send } from "lucide-react";

import {
  fetchCustomerCommitments,
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchProducts,
  type ApiCustomerCommitment,
  type ApiImportFileCandidate,
  type ApiInventoryBatch,
  type ApiProduct,
} from "../../lib/api";
import type { DashboardNav } from "../dashboards/Dashboards";
import { formatUnits, getCurrencyRevision, subscribeCurrency } from "../../lib/currency";

// Planning Dashboard (Phase 6) — the management planning cockpit. Past · Present
// · Future in one view, by pure calculation (no forecasting, no models):
//
//   Projected inventory = current available + incoming − demand due by horizon
//
// Everything is derived from data the platform already holds (inventory,
// import shipments, customer commitments), so there is no duplicate business
// logic and the system still only detects, contextualises, and recommends.

const num = formatUnits;
const todayStamp = () => new Date().toISOString().slice(0, 10);

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const CLOSED_COMMITMENT = new Set(["fulfilled", "delivered", "cancelled", "closed"]);
const CLOSED_IMPORT = new Set(["received", "closed", "cancelled"]);

// Horizons tuned to a medical-device subsidiary's decision cycle (most calls
// are made within 15 / 30 / 45 days), not a manufacturing planning cadence.
type Horizon = 0 | 15 | 30 | 45 | "custom";
const HORIZON_OPTIONS: { value: 0 | 15 | 30 | 45; label: string }[] = [
  { value: 0, label: "Today" },
  { value: 15, label: "+15d" },
  { value: 30, label: "+30d" },
  { value: 45, label: "+45d" },
];

type VerticalRow = {
  vertical: string;
  current: number;
  incoming: number;
  demand: number;
  projected: number;
  coverage: number | null;
  status: "shortage" | "covered" | "surplus" | "idle";
};

export function PlanningDashboard({ onNavigate }: DashboardNav) {
  useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [batches, setBatches] = useState<ApiInventoryBatch[]>([]);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [horizon, setHorizon] = useState<Horizon>(15);
  const [customDate, setCustomDate] = useState(addDays(60));

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchInventoryBatches(),
      fetchImportCandidates(),
      fetchCustomerCommitments(),
      fetchProducts(),
    ]).then(([b, c, m, p]) => {
      if (!active) return;
      if (b.status === "fulfilled") setBatches(b.value);
      if (c.status === "fulfilled") setCandidates(c.value);
      if (m.status === "fulfilled") setCommitments(m.value);
      if (p.status === "fulfilled") setProducts(p.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const horizonDate = horizon === "custom" ? customDate : addDays(horizon);
  const horizonLabel = horizon === "custom" ? customDate : horizon === 0 ? "today" : `+${horizon} days`;

  // item_code → vertical (product category), learned from products + inventory.
  const categoryOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) map.set(product.item_code.toLowerCase(), product.product_category || "Unclassified");
    for (const batch of batches)
      if (!map.has(batch.item_code.toLowerCase())) map.set(batch.item_code.toLowerCase(), batch.product_category || "Unclassified");
    return (itemCode: string) => map.get(itemCode.toLowerCase()) ?? "Unclassified";
  }, [products, batches]);

  // Per-item position: current on hand, incoming by horizon, demand by horizon.
  const itemRows = useMemo(() => {
    const current = new Map<string, number>();
    const incoming = new Map<string, number>();
    const demand = new Map<string, number>();

    for (const batch of batches) {
      current.set(batch.item_code, (current.get(batch.item_code) ?? 0) + batch.quantity_available);
    }
    for (const candidate of candidates) {
      if (CLOSED_IMPORT.has(candidate.status.toLowerCase())) continue;
      // Count incoming that should arrive by the horizon (no date = treat as inbound).
      if (candidate.flight_date && candidate.flight_date > horizonDate) continue;
      for (const line of candidate.lines) {
        incoming.set(line.item_code, (incoming.get(line.item_code) ?? 0) + line.quantity);
      }
    }
    for (const commitment of commitments) {
      if (CLOSED_COMMITMENT.has(commitment.status.toLowerCase())) continue;
      if (commitment.required_delivery_date > horizonDate) continue;
      const remaining = Math.max(commitment.ordered_quantity - commitment.delivered_quantity, 0);
      demand.set(commitment.material, (demand.get(commitment.material) ?? 0) + remaining);
    }

    const items = new Set<string>([...current.keys(), ...incoming.keys(), ...demand.keys()]);
    return [...items].map((item) => {
      const cur = current.get(item) ?? 0;
      const inc = incoming.get(item) ?? 0;
      const dem = demand.get(item) ?? 0;
      const supply = cur + inc;
      return { item, vertical: categoryOf(item), current: cur, incoming: inc, demand: dem, supply, projected: supply - dem };
    });
  }, [batches, candidates, commitments, categoryOf, horizonDate]);

  const verticalRows: VerticalRow[] = useMemo(() => {
    const map = new Map<string, { current: number; incoming: number; demand: number }>();
    for (const row of itemRows) {
      const entry = map.get(row.vertical) ?? { current: 0, incoming: 0, demand: 0 };
      entry.current += row.current;
      entry.incoming += row.incoming;
      entry.demand += row.demand;
      map.set(row.vertical, entry);
    }
    return [...map.entries()]
      .map(([vertical, e]) => {
        const supply = e.current + e.incoming;
        const projected = supply - e.demand;
        const coverage = e.demand > 0 ? Math.round((supply / e.demand) * 100) : null;
        const status: VerticalRow["status"] =
          e.demand === 0 && supply === 0 ? "idle" : projected < 0 ? "shortage" : e.demand === 0 ? "surplus" : "covered";
        return { vertical, current: e.current, incoming: e.incoming, demand: e.demand, projected, coverage, status };
      })
      .sort((a, b) => a.projected - b.projected);
  }, [itemRows]);

  const currentUnits = itemRows.reduce((sum, row) => sum + row.current, 0);
  const incomingUnits = itemRows.reduce((sum, row) => sum + row.incoming, 0);
  const demandUnits = itemRows.reduce((sum, row) => sum + row.demand, 0);
  const projectedUnits = currentUnits + incomingUnits - demandUnits;
  const shortages = itemRows.filter((row) => row.projected < 0);
  const surpluses = itemRows.filter((row) => row.demand > 0 && row.projected > row.demand * 0.5);

  // Incoming supply timeline (P4): open imports, soonest first.
  const supplyTimeline = useMemo(
    () =>
      [...candidates]
        .filter((c) => !CLOSED_IMPORT.has(c.status.toLowerCase()))
        .sort((a, b) => (a.flight_date ?? "9999").localeCompare(b.flight_date ?? "9999"))
        .slice(0, 8),
    [candidates],
  );

  // At-risk commitments (P5): open, soonest required date first.
  const commitmentTimeline = useMemo(
    () =>
      [...commitments]
        .filter((c) => !CLOSED_COMMITMENT.has(c.status.toLowerCase()))
        .sort((a, b) => a.required_delivery_date.localeCompare(b.required_delivery_date))
        .slice(0, 8),
    [commitments],
  );

  const today = todayStamp();

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  const story =
    shortages.length > 0
      ? `${shortages.length} product${shortages.length === 1 ? "" : "s"} will run short by ${horizonLabel} if nothing changes — incoming supply does not cover committed demand. Pull these forward or reallocate.`
      : demandUnits > 0
        ? `Every committed order through ${horizonLabel} is covered by stock on hand plus incoming supply. ${surpluses.length} product${surpluses.length === 1 ? " is" : "s are"} building surplus.`
        : `No committed demand falls inside ${horizonLabel}. ${num(incomingUnits)} units are inbound to add to stock.`;

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Planning · Past · Present · Future</p>
            <h2>
              {horizon === 0
                ? `${num(currentUnits)} units available today`
                : `${num(currentUnits)} units now → ${num(projectedUnits)} projected by ${horizonLabel}`}
            </h2>
            <p className="dash-story">{story}</p>
          </div>
          <div className="lens-switch" role="tablist" aria-label="Planning horizon">
            {HORIZON_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={horizon === option.value}
                className={horizon === option.value ? "lens-chip active" : "lens-chip"}
                onClick={() => setHorizon(option.value)}
              >
                <span>{option.label}</span>
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={horizon === "custom"}
              className={horizon === "custom" ? "lens-chip active" : "lens-chip"}
              onClick={() => setHorizon("custom")}
            >
              <span>Custom</span>
            </button>
          </div>
        </div>
        {horizon === "custom" ? (
          <label className="filter-control">
            <span>Planning date</span>
            <input type="date" min={today} value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
          </label>
        ) : null}
        <div className="vitals-row">
          <div className="vital">
            <strong>{num(currentUnits)}</strong>
            <span>Available now (present)</span>
          </div>
          <div className="vital">
            <strong>+{num(incomingUnits)}</strong>
            <span>Incoming by {horizonLabel}</span>
          </div>
          <div className="vital">
            <strong>−{num(demandUnits)}</strong>
            <span>Committed demand by {horizonLabel}</span>
          </div>
          <div className={`vital ${projectedUnits < 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{num(projectedUnits)}</strong>
            <span>Projected available (future)</span>
          </div>
          <div className={`vital ${shortages.length > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{shortages.length}</strong>
            <span>Products heading short</span>
          </div>
        </div>
      </section>

      {/* P3 — Requirement gap by vertical */}
      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <Layers size={16} aria-hidden="true" />
            <h2>Requirement gap by vertical · {horizonLabel}</h2>
          </div>
          <span className="cc-panel-meta">{verticalRows.length}</span>
        </div>
        {verticalRows.length === 0 ? (
          <div className="empty-story">
            <span className="empty-story-mark">
              <Layers size={22} aria-hidden="true" />
            </span>
            <strong>No position to plan yet</strong>
            <span>
              As stock is received and customer orders are recorded, this table projects supply against demand for
              each vertical and flags where shortages or surpluses are developing.
            </span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vertical</th>
                <th>On hand</th>
                <th>Incoming</th>
                <th>Demand</th>
                <th>Projected</th>
                <th>Coverage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {verticalRows.map((row) => (
                <tr key={row.vertical}>
                  <td>{row.vertical}</td>
                  <td>{num(row.current)}</td>
                  <td>+{num(row.incoming)}</td>
                  <td>−{num(row.demand)}</td>
                  <td>{num(row.projected)}</td>
                  <td>
                    {row.coverage === null ? (
                      <span className="muted-cell">—</span>
                    ) : (
                      <div className="planning-coverage">
                        <div className="score-row-track">
                          <div
                            className={`score-row-fill${row.coverage >= 100 ? " tone-good" : row.coverage >= 60 ? " tone-warn" : " tone-bad"}`}
                            style={{ width: `${Math.min(row.coverage, 100)}%` }}
                          />
                        </div>
                        <span>{row.coverage}%</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`dot-pill ${
                        row.status === "shortage" ? "tone-bad" : row.status === "surplus" ? "tone-warn" : row.status === "covered" ? "tone-good" : ""
                      }`}
                    >
                      <span className="seg-dot" aria-hidden="true" />
                      {row.status === "shortage"
                        ? "Shortage"
                        : row.status === "surplus"
                          ? "Surplus"
                          : row.status === "covered"
                            ? "Covered"
                            : "Idle"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="hub-columns">
        {/* P4 — Incoming supply timeline */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <PlaneLanding size={16} aria-hidden="true" />
              <h2>Incoming supply</h2>
            </div>
            <span className="cc-panel-meta">{supplyTimeline.length}</span>
          </div>
          {supplyTimeline.length === 0 ? (
            <p className="empty-state">No inbound shipments. Incoming supply appears here as imports are assembled.</p>
          ) : (
            <ul className="num-rows">
              {supplyTimeline.map((candidate, index) => {
                const overdue = candidate.flight_date && candidate.flight_date < today;
                return (
                  <li className="num-row" key={candidate.import_file_number}>
                    <span className="num-row-index">{index + 1}</span>
                    <div className="num-row-main">
                      <strong>{candidate.shipment_name ?? candidate.import_file_number}</strong>
                      <small className="num-row-route">
                        {candidate.origin_country ?? "Origin pending"}
                        <MoveRight size={13} aria-hidden="true" />
                        {candidate.destination_country}
                        {candidate.flight_date ? ` · ETA ${candidate.flight_date}` : " · ETA pending"}
                      </small>
                    </div>
                    <span className={`dot-pill ${overdue ? "tone-bad" : "tone-info"}`}>
                      <span className="seg-dot" aria-hidden="true" />
                      {overdue ? "Delayed" : "On track"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* P5 — Customer commitments timeline */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Send size={16} aria-hidden="true" />
              <h2>Customer commitments</h2>
            </div>
            <span className="cc-panel-meta">{commitmentTimeline.length}</span>
          </div>
          {commitmentTimeline.length === 0 ? (
            <p className="empty-state">No open commitments. Customer orders appear here with their required dates.</p>
          ) : (
            <ul className="num-rows">
              {commitmentTimeline.map((commitment, index) => {
                const late = commitment.required_delivery_date < today && commitment.delivered_quantity < commitment.ordered_quantity;
                const back = commitment.backorder_quantity > 0;
                return (
                  <li className="num-row" key={commitment.commitment_id}>
                    <span className="num-row-index">{index + 1}</span>
                    <div className="num-row-main">
                      <strong>
                        {commitment.po_number} · {commitment.customer}
                      </strong>
                      <small>
                        {commitment.material} · due {commitment.required_delivery_date} · {num(commitment.delivered_quantity)}/
                        {num(commitment.ordered_quantity)} delivered
                      </small>
                    </div>
                    <span className={`dot-pill ${late ? "tone-bad" : back ? "tone-warn" : "tone-good"}`}>
                      <span className="seg-dot" aria-hidden="true" />
                      {late ? "Late" : back ? "Backorder" : "On track"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Risk areas → action */}
      {shortages.length > 0 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <AlertTriangle size={16} aria-hidden="true" />
              <h2>Shortages developing by {horizonLabel}</h2>
            </div>
            <span className="cc-panel-meta">{shortages.length}</span>
          </div>
          <ul className="num-rows">
            {shortages.slice(0, 8).map((row) => (
              <li className="num-row" key={row.item}>
                <span className="num-row-index">
                  <PackageOpen size={14} aria-hidden="true" />
                </span>
                <div className="num-row-main">
                  <strong>{row.item}</strong>
                  <small>
                    {row.vertical} · on hand {num(row.current)} + incoming {num(row.incoming)} − demand {num(row.demand)}
                  </small>
                </div>
                <span className="dot-pill tone-bad">
                  <span className="seg-dot" aria-hidden="true" />
                  short {num(Math.abs(row.projected))}
                </span>
              </li>
            ))}
          </ul>
          <div className="launchpad" style={{ marginTop: 12 }}>
            <div className="launchpad-row">
              <button type="button" className="launch-action" onClick={() => onNavigate("primary-sales")}>
                <span className="launch-action-icon">
                  <PlaneLanding size={17} aria-hidden="true" />
                </span>
                <span className="launch-action-body">
                  <strong>Pull forward supply</strong>
                  <small>review inbound shipments</small>
                </span>
              </button>
              <button type="button" className="launch-action" onClick={() => onNavigate("decision-center")}>
                <span className="launch-action-icon">
                  <AlertTriangle size={17} aria-hidden="true" />
                </span>
                <span className="launch-action-body">
                  <strong>Record a decision</strong>
                  <small>reallocate or split orders</small>
                </span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
