import { useEffect, useMemo, useState } from "react";
import { Globe2, PlaneLanding, Send } from "lucide-react";

import {
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchShipments,
  type ApiImportFileCandidate,
  type ApiInventoryBatch,
  type ApiShipment,
} from "../lib/api";
import { computeMovement, type MovementMetrics, type MovementWindow } from "../lib/movement";
import { formatDisplay, formatUnits, getCurrencyRevision, subscribeCurrency } from "../lib/currency";
import { useCountry } from "../context/CountryContext";
import { useDemoRevision } from "../lib/useDemoRevision";
import { citiesForCountry } from "../lib/cityGeo";
import { WorldMap, type GeoRoute, type MapCity, type MapDetailRow } from "./WorldMap";

// India is the single source. Primary shipments fly from here to each country's
// delivery hub; secondary then distributes from that hub to the country's other
// major cities. Mumbai stands in for the origin gateway.
const ORIGIN_HUB: [number, number] = [72.8777, 19.076];

// Shipment movement, shown the way the user asked: four live metrics (active
// shipments, units, weight, value), a map that colours by the chosen metric,
// a time-range setting (what moved in a period), and a country breakdown that
// always splits Primary (inbound) vs Secondary (outbound). Nothing hardcoded —
// it recomputes from live records and updates as shipments move.

type Metric = "shipments" | "units" | "weight" | "value";

const METRICS: { id: Metric; label: string }[] = [
  { id: "shipments", label: "Shipments" },
  { id: "units", label: "Units" },
  { id: "weight", label: "Weight" },
  { id: "value", label: "Value" },
];

const WINDOWS: { id: MovementWindow; label: string }[] = [
  { id: "active", label: "In motion now" },
  { id: "month", label: "This month" },
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

function formatMetric(metric: Metric, value: number): string {
  if (metric === "value") return formatDisplay(value);
  if (metric === "weight") return `${formatUnits(value)} kg`;
  return formatUnits(value);
}

function metricOf(metrics: MovementMetrics, metric: Metric): number {
  return metrics[metric];
}

export function MovementPanel({ title = "Shipment movement", showDetail = true }: { title?: string; showDetail?: boolean }) {
  const { country } = useCountry();
  const injectRev = useDemoRevision();
  const [imports, setImports] = useState<ApiImportFileCandidate[]>([]);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [batches, setBatches] = useState<ApiInventoryBatch[]>([]);
  const [metric, setMetric] = useState<Metric>("shipments");
  const [window, setWindow] = useState<MovementWindow>("active");
  const [loading, setLoading] = useState(true);
  const [rev, setRev] = useState(0);

  // Value depends on the chosen display currency — recompute when it changes.
  useEffect(() => subscribeCurrency(() => setRev(getCurrencyRevision())), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchImportCandidates(), fetchShipments(), fetchInventoryBatches()]).then(([i, s, b]) => {
      if (!active) return;
      if (i.status === "fulfilled") setImports(i.value);
      if (s.status === "fulfilled") setShipments(s.value);
      if (b.status === "fulfilled") setBatches(b.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [injectRev]);

  const result = useMemo(
    () => computeMovement(imports, shipments, batches, window),
    [imports, shipments, batches, window, rev],
  );

  const { values, details } = useMemo(() => {
    const v: Record<string, number> = {};
    const d: Record<string, MapDetailRow[]> = {};
    for (const [name, cm] of Object.entries(result.byCountry)) {
      const total = metricOf(cm.total, metric);
      if (total > 0) v[name] = total;
      d[name] = [
        { label: "Primary (inbound)", value: metricOf(cm.primary, metric) },
        { label: "Secondary (outbound)", value: metricOf(cm.secondary, metric) },
      ];
    }
    return { values: v, details: d };
  }, [result, metric]);

  const rows = useMemo(
    () =>
      Object.values(result.byCountry).sort((a, b) => metricOf(b.total, metric) - metricOf(a.total, metric)),
    [result, metric],
  );

  // Persistent side-panel content for the selected country.
  const sidePanel = useMemo(() => {
    const out: Record<string, { label: string; value: string }[]> = {};
    for (const [name, cm] of Object.entries(result.byCountry)) {
      out[name] = [
        { label: "Shipments", value: formatUnits(cm.total.shipments) },
        { label: "Units", value: formatUnits(cm.total.units) },
        { label: "Value", value: formatDisplay(cm.total.value) },
        { label: "Inbound", value: formatUnits(cm.primary.shipments) },
        { label: "Outbound", value: formatUnits(cm.secondary.shipments) },
      ];
    }
    return out;
  }, [result]);

  // Animated movement: India → each active country's delivery hub (primary), and
  // hub → that country's other major cities (secondary distribution). A country
  // only gets routes when its shipments are actually moving.
  const geoRoutes = useMemo(() => {
    const out: GeoRoute[] = [];
    for (const cm of Object.values(result.byCountry)) {
      const geo = citiesForCountry(cm.country);
      if (!geo) continue;
      const hub: [number, number] = [geo.hub.lon, geo.hub.lat];
      if (cm.primary.shipments > 0) {
        out.push({ from: ORIGIN_HUB, to: hub, mode: "air", intensity: Math.min(5, cm.primary.shipments) });
      }
      if (cm.secondary.shipments > 0) {
        for (const c of geo.others.slice(0, 3)) {
          out.push({ from: hub, to: [c.lon, c.lat], mode: "road", intensity: Math.min(4, cm.secondary.shipments) });
        }
      }
    }
    return out;
  }, [result]);

  // City nodes shown on drill-in: the hub where primary lands, plus the cities
  // secondary distributes to within the same country.
  const mapCities = useMemo(() => {
    const out: MapCity[] = [];
    for (const cm of Object.values(result.byCountry)) {
      const geo = citiesForCountry(cm.country);
      if (!geo) continue;
      if (cm.primary.shipments <= 0 && cm.secondary.shipments <= 0) continue;
      out.push({
        country: cm.country,
        city: geo.hub.city,
        lon: geo.hub.lon,
        lat: geo.hub.lat,
        value: metricOf(cm.total, metric),
        valueLabel: formatMetric(metric, metricOf(cm.total, metric)),
        volume: `${formatUnits(cm.total.shipments)} shipments`,
        movement: `${formatUnits(cm.primary.shipments)} in · ${formatUnits(cm.secondary.shipments)} out`,
        status: "Delivery hub",
      });
      if (cm.secondary.shipments > 0) {
        const cities = geo.others.slice(0, 3);
        const per = metricOf(cm.secondary, metric) / Math.max(1, cities.length);
        for (const c of cities) {
          out.push({
            country: cm.country,
            city: c.city,
            lon: c.lon,
            lat: c.lat,
            value: per,
            valueLabel: formatMetric(metric, per),
            movement: "secondary distribution",
            status: "Distribution city",
          });
        }
      }
    }
    return out;
  }, [result, metric]);

  const isActive = window === "active";
  const countLabel = isActive ? "Active shipments" : "Shipments moved";
  const windowLabel = WINDOWS.find((w) => w.id === window)?.label ?? "";

  if (loading) {
    return (
      <section className="panel cockpit-panel">
        <div className="cc-loading" aria-busy="true">
          <div className="skeleton-row tall" />
          <div className="skeleton-row" />
        </div>
      </section>
    );
  }

  const stats: { metric: Metric; label: string; total: number; primary: number; secondary: number }[] = [
    { metric: "shipments", label: countLabel, total: result.totals.shipments, primary: result.primary.shipments, secondary: result.secondary.shipments },
    { metric: "units", label: "Units / quantity", total: result.totals.units, primary: result.primary.units, secondary: result.secondary.units },
    { metric: "weight", label: "Weight", total: result.totals.weight, primary: result.primary.weight, secondary: result.secondary.weight },
    { metric: "value", label: "Value", total: result.totals.value, primary: result.primary.value, secondary: result.secondary.value },
  ];

  return (
    <section className="panel cockpit-panel">
      <div className="panel-heading">
        <div className="worklist-title">
          <Globe2 size={16} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        <span className="cc-panel-meta">{isActive ? "in motion now" : windowLabel.toLowerCase()}</span>
      </div>

      {/* Time-range setting — what's moving now vs what moved in a period */}
      <div className="move-controls">
        <div className="move-seg" role="tablist" aria-label="Time range">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={window === w.id}
              className={window === w.id ? "active" : ""}
              onClick={() => setWindow(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* The four live metrics, each split Primary vs Secondary */}
      <div className="move-stats">
        {stats.map((stat) => (
          <button
            key={stat.metric}
            type="button"
            className={`move-stat${metric === stat.metric ? " active" : ""}`}
            onClick={() => setMetric(stat.metric)}
            aria-pressed={metric === stat.metric}
            title={`Colour the map by ${stat.label.toLowerCase()}`}
          >
            <span className="move-stat-label">{stat.label}</span>
            <strong>{formatMetric(stat.metric, stat.total)}</strong>
            <span className="move-stat-split">
              <PlaneLanding size={11} aria-hidden="true" /> {formatMetric(stat.metric, stat.primary)}
              <span className="move-stat-dot" aria-hidden="true">·</span>
              <Send size={11} aria-hidden="true" /> {formatMetric(stat.metric, stat.secondary)}
            </span>
          </button>
        ))}
      </div>

      <WorldMap
        values={values}
        details={details}
        sidePanel={sidePanel}
        geoRoutes={geoRoutes}
        cities={mapCities}
        activeCountry={country}
        formatValue={(v) => formatMetric(metric, v)}
        caption={
          Object.keys(values).length === 0
            ? `No ${isActive ? "movement" : "movement in this period"} — the map shows zero; it lights up as shipments move`
            : `${METRICS.find((m) => m.id === metric)?.label} by country — ${isActive ? "in motion now" : windowLabel.toLowerCase()}; hover for the Primary / Secondary split`
        }
      />

      {showDetail ? (
        <div className="move-detail">
          <div className="move-detail-head">
            <span>Country</span>
            <span><PlaneLanding size={12} aria-hidden="true" /> Primary</span>
            <span><Send size={12} aria-hidden="true" /> Secondary</span>
            <span>Total</span>
          </div>
          {rows.length === 0 ? (
            <p className="empty-state">No shipments {isActive ? "in motion" : "in this period"} yet — zero across the board.</p>
          ) : (
            rows.map((row) => (
              <div className="move-detail-row" key={row.country}>
                <span className="move-detail-country">{row.country}</span>
                <span>{formatMetric(metric, metricOf(row.primary, metric))}</span>
                <span>{formatMetric(metric, metricOf(row.secondary, metric))}</span>
                <strong>{formatMetric(metric, metricOf(row.total, metric))}</strong>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
