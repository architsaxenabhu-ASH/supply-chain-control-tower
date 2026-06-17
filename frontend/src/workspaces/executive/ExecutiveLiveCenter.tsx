import { useEffect, useMemo, useState } from "react";
import { PlaneLanding, RadioTower, Send, Warehouse } from "lucide-react";

import { WorldMap } from "../../components/WorldMap";
import { useCountry } from "../../context/CountryContext";
import { formatDisplay, formatUnits, getCurrencyRevision, subscribeCurrency } from "../../lib/currency";
import {
  buildInventoryLane,
  buildPrimaryLane,
  buildSecondaryLane,
  type ExecLane,
  type LaneId,
} from "../../lib/executiveLive";
import { buildLiveStream, type LiveCategory } from "../../lib/liveTicker";
import {
  fetchAuditEvents,
  fetchCustomerCommitments,
  fetchCustomers,
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchMovements,
  fetchShipments,
  fetchWarehouses,
  type ApiAuditEvent,
  type ApiCustomer,
  type ApiCustomerCommitment,
  type ApiImportFileCandidate,
  type ApiInventoryBatch,
  type ApiMovementEvent,
  type ApiShipment,
  type ApiWarehouseLocation,
} from "../../lib/api";
import { LiveTicker } from "./LiveTicker";
import { ActivityFeed } from "./ActivityFeed";

// Executive Live Operations Center (Phase 7A). One observe-only screen per lane:
// a live world map, the single "current position" an owner reads in 30 seconds,
// a Bloomberg-style ticker, and a live activity feed — all from real platform
// data, refreshed on a steady heartbeat. No reports, no tables, no data entry.

const REFRESH_MS = 20_000;

const LANES: Record<LaneId, { title: string; question: string; icon: typeof PlaneLanding; category: LiveCategory }> = {
  primary: { title: "Primary Sales", question: "What is entering the business?", icon: PlaneLanding, category: "primary" },
  inventory: { title: "Inventory", question: "What do we currently own?", icon: Warehouse, category: "inventory" },
  secondary: { title: "Secondary Sales", question: "What is leaving the business?", icon: Send, category: "secondary" },
};

export function ExecutiveLiveCenter({ lane }: { lane: LaneId }) {
  const meta = LANES[lane];
  const { country } = useCountry();

  const [imports, setImports] = useState<ApiImportFileCandidate[]>([]);
  const [batches, setBatches] = useState<ApiInventoryBatch[]>([]);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouseLocation[]>([]);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [audit, setAudit] = useState<ApiAuditEvent[]>([]);
  const [movements, setMovements] = useState<ApiMovementEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => subscribeCurrency(() => setRev(getCurrencyRevision())), []);

  // Steady heartbeat: load now, then re-load every REFRESH_MS so the screen
  // stays live without the executive doing anything.
  useEffect(() => {
    let active = true;
    const guard = <T,>(setter: (value: T) => void) => (value: T) => {
      if (active) setter(value);
    };

    async function load(first: boolean) {
      if (first) setLoading(true);
      const tasks: Promise<unknown>[] = [
        fetchAuditEvents(120).then(guard(setAudit)),
        fetchMovements().then(guard(setMovements)),
      ];
      if (lane === "primary") {
        tasks.push(fetchImportCandidates().then(guard(setImports)));
        tasks.push(fetchWarehouses().then(guard(setWarehouses)));
      } else if (lane === "inventory") {
        tasks.push(fetchInventoryBatches().then(guard(setBatches)));
        tasks.push(fetchWarehouses().then(guard(setWarehouses)));
        tasks.push(fetchShipments().then(guard(setShipments)));
      } else {
        tasks.push(fetchShipments().then(guard(setShipments)));
        tasks.push(fetchCustomers().then(guard(setCustomers)));
        tasks.push(fetchInventoryBatches().then(guard(setBatches)));
        tasks.push(fetchCustomerCommitments().then(guard(setCommitments)));
      }
      await Promise.allSettled(tasks);
      if (!active) return;
      setLoading(false);
      setUpdatedAt(new Date());
    }

    load(true);
    const timer = window.setInterval(() => load(false), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [lane]);

  const data: ExecLane = useMemo(() => {
    void rev; // recompute when the display currency changes
    if (lane === "primary") return buildPrimaryLane(imports, warehouses);
    if (lane === "inventory") return buildInventoryLane(batches, warehouses, shipments);
    return buildSecondaryLane(shipments, customers, batches, commitments);
  }, [lane, imports, batches, shipments, customers, warehouses, commitments, rev]);

  const stream = useMemo(() => buildLiveStream(audit, movements), [audit, movements]);

  const Icon = meta.icon;
  const { position } = data;
  const hasActivity = Object.keys(data.values).length > 0;

  return (
    <section className="exec-live" aria-label={`Executive live — ${meta.title}`}>
      {/* Current position — the 30-second read */}
      <header className="exec-head">
        <div className="exec-head-id">
          <span className="exec-head-icon">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="exec-head-title">{meta.title}</h1>
            <p className="exec-head-question">{meta.question}</p>
          </div>
        </div>

        <div className="exec-position">
          <span className="exec-position-headline">{position.headline}</span>
          <div className="exec-position-figures">
            <div className="exec-figure">
              <strong>{formatUnits(position.count)}</strong>
              <span>{position.countLabel}</span>
            </div>
            <div className="exec-figure">
              <strong>{formatDisplay(position.value, { compact: true })}</strong>
              <span>Value</span>
            </div>
            <div className="exec-figure">
              <strong>{formatUnits(position.units)}</strong>
              <span>Units</span>
            </div>
          </div>
          <div className="exec-position-chips">
            {position.chips.map((chip) => (
              <span className={`exec-chip tone-${chip.tone ?? "neutral"}`} key={chip.label}>
                <b>{chip.value}</b> {chip.label}
              </span>
            ))}
          </div>
        </div>

        <div className="exec-live-flag" title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Connecting…"}>
          <span className={`exec-live-dot${loading ? " is-loading" : ""}`} aria-hidden="true" />
          <span>{loading ? "Syncing" : "Live"}</span>
        </div>
      </header>

      {/* Live map + activity feed */}
      <div className="exec-body">
        <div className="exec-map-wrap">
          <WorldMap
            values={data.values}
            tooltips={data.tooltips}
            sidePanel={data.sidePanel}
            cities={data.cities}
            routes={data.routes}
            activeCountry={country}
            formatValue={data.formatValue}
            caption={
              hasActivity
                ? `${meta.title} — live by country; click a country to drop into its cities`
                : `No ${meta.title.toLowerCase()} activity right now — the map shows zero and lights up the moment things move`
            }
          />
          {!hasActivity && !loading ? (
            <div className="exec-map-zero" aria-hidden="true">
              <RadioTower size={26} />
              <strong>0</strong>
              <span>Nothing in motion</span>
            </div>
          ) : null}
        </div>

        <ActivityFeed events={stream} defaultFilter={meta.category} />
      </div>

      {/* Live operational ticker */}
      <LiveTicker events={stream} />
    </section>
  );
}
