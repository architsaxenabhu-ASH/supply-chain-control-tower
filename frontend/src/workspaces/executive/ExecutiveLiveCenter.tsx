import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Info,
  PieChart,
  PlaneLanding,
  Send,
  TrendingUp,
  Warehouse,
} from "lucide-react";

import { WorldMap } from "../../components/WorldMap";
import { DonutChart } from "../../components/DonutChart";
import { BarMeter } from "../../components/charts/BarMeter";
import { Sparkline } from "../../components/charts/Sparkline";
import { TrendArea } from "../../components/charts/TrendArea";
import { FlowScene } from "../../components/scenes/FlowScene";
import { useCountry } from "../../context/CountryContext";
import { getCurrencyRevision, subscribeCurrency } from "../../lib/currency";
import { getDemoTick, getInjectRevision, getInjectedEvents, isDemoActive, subscribeDemo } from "../../lib/demoMode";
import { prefersReducedMotion } from "../../motion/motion";
import { buildSampleEvents, buildSampleLane, SAMPLE_NOTICE, type Kpi, type LaneId } from "../../lib/sampleBusinessData";
import { LiveTicker } from "./LiveTicker";
import { ActivityFeed } from "./ActivityFeed";

// Overview — the live business observation center (Phase 7B redesign).
//
// One page, three MODES (Primary Sales / Inventory / Secondary Sales) switched
// from an animated stat-toggle that also shows each mode's headline number. The
// whole page adopts the active mode's identity colour. Each mode reads in ~30
// seconds: a current-position headline, four KPI cards (value + trend + delta +
// plain-language reading), a live world map with a value legend, a charts row
// (trend, ranking, composition — each interpreted), a filterable feed and a
// continuous ticker. Figures come from the representative international sample
// dataset and convert with the live currency.

// Stable empty array for the external-store server snapshot (avoids re-renders).
const EMPTY_EVENTS = [] as ReturnType<typeof buildSampleEvents>;

const MODES: { id: LaneId; title: string; question: string; metric: string; icon: typeof PlaneLanding }[] = [
  { id: "primary", title: "Primary Sales", question: "What is entering the business?", metric: "Inbound value", icon: PlaneLanding },
  { id: "inventory", title: "Inventory", question: "What do we currently own?", metric: "Stock value", icon: Warehouse },
  { id: "secondary", title: "Secondary Sales", question: "What is leaving the business?", metric: "Revenue out", icon: Send },
];

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const up = kpi.delta >= 0;
  return (
    <article className={`exec-kpi exec-rise tone-${kpi.tone}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="exec-kpi-top">
        <span className="exec-kpi-label">{kpi.label}</span>
        {kpi.deltaLabel ? (
          <span className="exec-kpi-delta is-note">{kpi.deltaLabel}</span>
        ) : (
          <span className={`exec-kpi-delta ${up ? "is-up" : "is-down"}`}>
            {up ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
            {Math.abs(kpi.delta)}%
          </span>
        )}
      </div>
      <strong className="exec-kpi-value exec-figure-tick" key={kpi.value}>
        {kpi.value}
      </strong>
      <Sparkline points={kpi.spark} tone={kpi.tone} />
      <p className="exec-kpi-hint">{kpi.hint}</p>
    </article>
  );
}

// A small "what visual is this" chip. The label names the technique; hovering
// reveals the plain-language explanation — so the concept behind every chart is
// always on show, never hidden.
function ConceptTag({ label, how }: { label: string; how: string }) {
  return (
    <span className="exec-concept" title={how}>
      <Info size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ExecutiveLiveCenter({ lane = "primary" }: { lane?: LaneId }) {
  const { country } = useCountry();
  const reduced = prefersReducedMotion();
  const [mode, setMode] = useState<LaneId>(lane);
  useEffect(() => setMode(lane), [lane]);

  // Re-format figures when the display currency changes (value recomputes).
  const [rev, setRev] = useState(0);
  useEffect(() => subscribeCurrency(() => setRev(getCurrencyRevision())), []);

  // Demo Mode: when the presenter starts the demo, the activity stream pulses so
  // a fresh line flows into the feed continuously, and the "Sample data" badge
  // is hidden so the screen reads as a real live system.
  const demoActive = useSyncExternalStore(subscribeDemo, isDemoActive, () => false);
  const demoTick = useSyncExternalStore(subscribeDemo, getDemoTick, () => 0);
  const boost = useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
  const injected = useSyncExternalStore(subscribeDemo, getInjectedEvents, () => EMPTY_EVENTS);

  // Pressing "Add Sample Data" (boost) and the demo pulse (tick) lift the lane
  // figures, so the headline numbers, KPIs, map and charts visibly grow here too
  // — not just in the Executive Summary.
  const lanes = useMemo(
    () => ({
      primary: buildSampleLane("primary", rev, boost, demoTick),
      inventory: buildSampleLane("inventory", rev, boost, demoTick),
      secondary: buildSampleLane("secondary", rev, boost, demoTick),
    }),
    [rev, boost, demoTick],
  );
  // The ticker scrolls continuously on its own, so keep its source stable; the
  // feed receives the pulsing stream so new lines visibly arrive during a demo.
  const tickerEvents = useMemo(() => buildSampleEvents(0), []);
  const feedEvents = useMemo(() => {
    const base = buildSampleEvents(demoActive ? demoTick : 0);
    return injected.length ? [...injected, ...base] : base;
  }, [demoActive, demoTick, injected]);
  const data = lanes[mode];
  const meta = MODES.find((option) => option.id === mode) ?? MODES[0];
  const Icon = meta.icon;

  return (
    <section className={`exec-live mode-${mode}`} aria-label={`Live operations — ${meta.title}`}>
      {/* Identity + animated mode toggle + live status */}
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

        <div className="exec-modes" role="tablist" aria-label="Overview mode">
          {MODES.map((option) => {
            const ModeIcon = option.icon;
            const active = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`exec-mode${active ? " active" : ""}`}
                data-mode={option.id}
                onClick={() => setMode(option.id)}
              >
                {active && !reduced ? (
                  <motion.span className="exec-mode-glow" layoutId="exec-mode-glow" aria-hidden="true" />
                ) : null}
                <span className="exec-mode-icon">
                  <ModeIcon size={16} aria-hidden="true" />
                </span>
                <span className="exec-mode-text">
                  <span className="exec-mode-title">{option.title}</span>
                  <span className="exec-mode-stat">{lanes[option.id].tag}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="exec-head-status">
          {!demoActive ? (
            <span className="exec-sample" title="Representative sample data for demonstration">
              {SAMPLE_NOTICE}
            </span>
          ) : null}
          <div className="exec-live-flag">
            <span className="exec-live-dot" aria-hidden="true" />
            <span>Live</span>
          </div>
        </div>
      </header>

      {/* The 30-second read */}
      <p className="exec-headline">{data.headline}</p>

      {/* Signature motion scene for this mode (plane / warehouse / truck) */}
      <FlowScene spec={data.scene} reduced={reduced} />

      {/* KPI cards: value + spark + delta + interpretation */}
      <div className="exec-kpis">
        {data.kpis.map((kpi, index) => (
          <KpiCard kpi={kpi} index={index} key={kpi.label} />
        ))}
      </div>

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
            caption={`${meta.title} — live by country; click a country to drop into its cities`}
          />
          <div className="exec-map-legend" aria-hidden="true">
            <span className="exec-map-legend-title">{meta.metric}</span>
            <span className="exec-map-legend-bar" />
            <span className="exec-map-legend-scale">
              <span>Low</span>
              <span>High</span>
            </span>
          </div>
        </div>
        <ActivityFeed events={feedEvents} defaultFilter={mode} />
      </div>

      {/* Charts: trend, ranking, composition — each interpreted in plain language */}
      <div className="exec-charts">
        <article className="exec-chart exec-chart-wide exec-rise">
          <div className="exec-chart-head">
            <h3>
              <TrendingUp size={15} aria-hidden="true" /> {data.trend.title}
            </h3>
            <ConceptTag label={data.trend.concept} how={data.trend.technique} />
          </div>
          <TrendArea series={data.trend.series} format={data.trend.format} legend={data.trend.legend} />
          <p className="exec-chart-cap">{data.trend.caption}</p>
        </article>

        <article className="exec-chart exec-rise" style={{ animationDelay: "80ms" }}>
          <div className="exec-chart-head">
            <h3>
              <BarChart3 size={15} aria-hidden="true" /> {data.ranking.title}
            </h3>
            <ConceptTag label={data.ranking.concept} how={data.ranking.technique} />
          </div>
          <BarMeter rows={data.ranking.rows} format={data.ranking.format} />
          <p className="exec-chart-cap">{data.ranking.caption}</p>
        </article>

        <article className="exec-chart exec-rise" style={{ animationDelay: "160ms" }}>
          <div className="exec-chart-head">
            <h3>
              <PieChart size={15} aria-hidden="true" /> {data.composition.title}
            </h3>
            <ConceptTag label={data.composition.concept} how={data.composition.technique} />
          </div>
          <DonutChart
            slices={data.composition.slices}
            centerLabel={data.composition.centerLabel}
            formatValue={data.composition.format}
          />
          <p className="exec-chart-cap">{data.composition.caption}</p>
        </article>
      </div>

      {/* Continuous operational ticker */}
      <LiveTicker events={tickerEvents} />
    </section>
  );
}
