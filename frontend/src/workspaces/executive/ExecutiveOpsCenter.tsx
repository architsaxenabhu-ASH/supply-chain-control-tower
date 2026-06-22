import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Clock,
  Gauge,
  Globe2,
  PackageCheck,
  PieChart,
  PlaneLanding,
  Radio,
  Send,
  ShieldCheck,
  Trophy,
  Warehouse,
} from "lucide-react";

import { WorldMap } from "../../components/WorldMap";
import { DonutChart } from "../../components/DonutChart";
import { BarMeter } from "../../components/charts/BarMeter";
import { CountUp } from "../../components/charts/CountUp";
import { Sparkline } from "../../components/charts/Sparkline";
import { FlowScene } from "../../components/scenes/FlowScene";
import { Term } from "../../components/InfoTip";
import { useCountry } from "../../context/CountryContext";
import { getCurrencyRevision, subscribeCurrency } from "../../lib/currency";
import { getDemoTick, getInjectRevision, getInjectedEvents, isDemoActive, subscribeDemo } from "../../lib/demoMode";
import { prefersReducedMotion } from "../../motion/motion";
import {
  buildExecutiveSnapshot,
  buildSampleEvents,
  buildSampleLane,
  SAMPLE_NOTICE,
  type ExecAttention,
  type ExecBand,
  type ExecBenchmark,
  type ExecStat,
  type ExecTone,
  type ExecWin,
} from "../../lib/sampleBusinessData";
import { LiveTicker } from "./LiveTicker";
import { ActivityFeed } from "./ActivityFeed";

// =============================================================================
// EXECUTIVE SUMMARY — the "Mission Control" page (Phase 7D)
// -----------------------------------------------------------------------------
// A SEPARATE page from the live Overview. It rolls the three operating screens
// (Primary / Inventory / Secondary) into one continuous executive story for
// board / CEO / MD / GM, blending five reading styles on one screen:
//   • Bloomberg terminal — dense tabular figures, a live ticker
//   • Mission control     — a live world map + signature flow animations
//   • Power BI            — gauges, donuts, sparklines, ranked bars
//   • ERP dashboard       — structured attention & regional tables
//   • Report viewer       — a clean, plain-language reading of each section
//
// Every figure is computed in buildExecutiveSnapshot and lifts as the presenter
// injects sample data (boost) or the demo pulses (tick), so the board breathes.
// =============================================================================

const EMPTY_EVENTS = [] as ReturnType<typeof buildSampleEvents>;

const TONE_CLASS: Record<ExecTone, string> = {
  good: "tone-good",
  warn: "tone-warn",
  bad: "tone-bad",
  info: "tone-info",
  neutral: "tone-neutral",
};
function toneClass(tone?: ExecStat["tone"]): string {
  return tone ? TONE_CLASS[tone] : "tone-neutral";
}

// A single live metric cell. The figure pops whenever its value changes.
function Cell({ stat, big }: { stat: ExecStat; big?: boolean }) {
  return (
    <div className={`ops-cell ${toneClass(stat.tone)}${big ? " is-big" : ""}`}>
      <span className="ops-cell-label">
        {stat.label}
        <Term label={stat.label} />
      </span>
      <strong className="ops-cell-value ops-figure" key={stat.value}>
        {stat.value}
      </strong>
      {stat.sub ? <span className="ops-cell-sub">{stat.sub}</span> : null}
    </div>
  );
}

function MetricRow({ stats, big }: { stats: ExecStat[]; big?: boolean }) {
  return (
    <div className="ops-metric-row">
      {stats.map((stat) => (
        <Cell key={stat.label} stat={stat} big={big} />
      ))}
    </div>
  );
}

// A Power-BI-style radial gauge for the headline vitals strip.
function RadialGauge({ label, pct, tone, caption }: { label: string; pct: number; tone: ExecTone; caption: string }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, pct));
  const dash = (value / 100) * circumference;
  return (
    <div className={`ops-gauge ${toneClass(tone)}`}>
      <div className="ops-gauge-ring">
        <svg viewBox="0 0 84 84" className="ops-gauge-svg" role="img" aria-label={`${label} ${value}%`}>
          <circle cx="42" cy="42" r={r} className="ops-gauge-track" />
          <circle
            cx="42"
            cy="42"
            r={r}
            className="ops-gauge-fill"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <strong className="ops-gauge-num ops-figure" key={value}>
          {value}
          <span>%</span>
        </strong>
      </div>
      <span className="ops-gauge-label">{label}</span>
      <span className="ops-gauge-cap">{caption}</span>
    </div>
  );
}

function Panel({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <article className="ops-panel">
      <header className="ops-panel-head">
        <h3>
          {icon}
          {title}
          <Term label={title} />
        </h3>
        {hint ? <span className="ops-panel-hint">{hint}</span> : null}
      </header>
      {children}
    </article>
  );
}

// Reveal-on-scroll: a section settles into view the first time it enters the
// viewport, so the long page reads as a story that unfolds. Visible by default
// when reduced-motion is on or IntersectionObserver is unavailable — content is
// never gated on the animation firing (emil's rule).
function useInView(): { ref: (node: HTMLElement | null) => void; inView: boolean } {
  const reduced = prefersReducedMotion();
  const supported = typeof IntersectionObserver !== "undefined";
  const [inView, setInView] = useState(reduced || !supported);
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (reduced || !supported || !node || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, reduced, supported, inView]);
  return { ref: setNode, inView };
}

function Section({
  index,
  kicker,
  title,
  question,
  accent,
  children,
}: {
  index: string;
  kicker: string;
  title: string;
  question?: string;
  accent: string;
  children: ReactNode;
}) {
  const { ref, inView } = useInView();
  return (
    <section
      ref={ref}
      className={`ops-section ${inView ? "is-in" : "is-pending"}`}
      style={{ ["--ops-accent" as string]: accent } as CSSProperties}
    >
      <header className="ops-section-head">
        <span className="ops-section-index">{index}</span>
        <div>
          <span className="ops-section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {question ? <p className="ops-section-q">{question}</p> : null}
      </header>
      {children}
    </section>
  );
}

function FlowNode({ title, icon, stats }: { title: string; icon: ReactNode; stats: ExecStat[] }) {
  return (
    <div className="ops-flow-node">
      <header>
        {icon}
        <span>{title}</span>
      </header>
      <ul>
        {stats.map((stat) => (
          <li key={stat.label}>
            <span>{stat.label}</span>
            <strong className="ops-figure" key={stat.value}>
              {stat.value}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowConnector({ intensity, reduced }: { intensity: number; reduced: boolean }) {
  const dots = reduced ? 0 : Math.max(2, Math.min(6, intensity));
  return (
    <div className="ops-flow-link" aria-hidden="true">
      <span className="ops-flow-line" />
      {Array.from({ length: dots }, (_, i) => (
        <span key={i} className="ops-flow-dot" style={{ animationDelay: `${(i * 1.8) / dots}s` }} />
      ))}
      <ArrowRight size={16} className="ops-flow-arrow" />
    </div>
  );
}

// Accent colours per section — gives the long scroll visual rhythm.
const ACCENT = {
  cyan: "var(--tower-cyan, #48e5ff)",
  amber: "var(--tower-amber, #ffbd4a)",
  violet: "#a78bfa",
  emerald: "var(--tower-emerald, #36e29b)",
  blue: "#60a5fa",
  crimson: "var(--tower-crimson, #ff5d6c)",
  slate: "#8aa5b5",
};

export function ExecutiveOpsCenter() {
  const { country } = useCountry();
  const reduced = prefersReducedMotion();

  const [rev, setRev] = useState(0);
  useEffect(() => subscribeCurrency(() => setRev(getCurrencyRevision())), []);

  const demoActive = useSyncExternalStore(subscribeDemo, isDemoActive, () => false);
  const tick = useSyncExternalStore(subscribeDemo, getDemoTick, () => 0);
  const boost = useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
  const injected = useSyncExternalStore(subscribeDemo, getInjectedEvents, () => EMPTY_EVENTS);

  const snap = useMemo(() => buildExecutiveSnapshot(rev, boost, tick), [rev, boost, tick]);
  const scenes = useMemo(
    () => ({
      air: buildSampleLane("primary", rev, boost, tick).scene,
      warehouse: buildSampleLane("inventory", rev, boost, tick).scene,
      truck: buildSampleLane("secondary", rev, boost, tick).scene,
    }),
    [rev, boost, tick],
  );

  const tickerEvents = useMemo(() => buildSampleEvents(0), []);
  const feedEvents = useMemo(() => {
    const base = buildSampleEvents(demoActive ? tick : 0);
    return injected.length ? [...injected, ...base] : base;
  }, [demoActive, tick, injected]);

  const asOf = useMemo(
    () => new Date(snap.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [snap.asOf],
  );

  // Top hubs by live network value — a horizontal ranking bar (px.bar-style) that
  // sits next to the map, so the busiest markets read at a glance and climb as the
  // presenter injects data (including any newly-entered expansion markets).
  const topHubs = useMemo(() => {
    const fmt = snap.map.formatValue;
    return Object.entries(snap.map.values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, value]) => ({ label: country, value, display: fmt(value) }));
  }, [snap.map]);

  return (
    <div className="ops-center">
      {/* ---- Live status bar -------------------------------------------- */}
      <div className="ops-statusbar">
        <span className="ops-live">
          <span className="ops-live-dot" aria-hidden="true" />
          LIVE
        </span>
        <span className="ops-statusbar-title">Executive Summary · Mission Control</span>
        <span className="ops-statusbar-sub">Primary + Inventory + Secondary, one screen</span>
        <span className="ops-statusbar-spacer" />
        {!demoActive ? <span className="ops-statusbar-sample">{SAMPLE_NOTICE}</span> : null}
        <span className="ops-statusbar-time">
          <Clock size={13} aria-hidden="true" /> as of {asOf}
        </span>
      </div>

      {/* ---- Vitals strip (Power-BI gauges) ----------------------------- */}
      <div className="ops-vitals">
        {snap.vitals.map((v) => (
          <RadialGauge key={v.label} label={v.label} pct={v.pct} tone={v.tone} caption={v.caption} />
        ))}
      </div>

      {/* ---- Section 1 — Live header ------------------------------------ */}
      <Section index="01" kicker="Live snapshot" title="What is the business doing right now?" accent={ACCENT.cyan}>
        <div className="ops-heroes">
          {snap.heroes.map((hero) => (
            <article className={`ops-hero ${toneClass(hero.tone)}`} key={hero.label}>
              <span className="ops-hero-label">{hero.label}</span>
              <strong className="ops-hero-value">
                <CountUp value={hero.value} format={hero.format} />
              </strong>
              <span className="ops-hero-sub">{hero.sub}</span>
            </article>
          ))}
        </div>
        <div className="ops-header-grid">
          <Panel title="Incoming" icon={<PlaneLanding size={15} aria-hidden="true" />} hint="Entering the business">
            <MetricRow stats={snap.header.incoming} big />
            <Sparkline points={snap.headerSpark.incoming} tone="good" />
          </Panel>
          <Panel title="Inventory" icon={<Warehouse size={15} aria-hidden="true" />} hint="What we hold">
            <MetricRow stats={snap.header.inventory} big />
            <Sparkline points={snap.headerSpark.inventory} tone="neutral" />
          </Panel>
          <Panel title="Outgoing" icon={<Send size={15} aria-hidden="true" />} hint="Leaving the business">
            <MetricRow stats={snap.header.outgoing} big />
            <Sparkline points={snap.headerSpark.outgoing} tone="good" />
          </Panel>
        </div>
      </Section>

      {/* ---- Section 2 — Supply-chain reliability ----------------------- */}
      <Section index="02" kicker="Reliability" title="Supply chain reliability" question="Can we reliably move product?" accent={ACCENT.amber}>
        <div className="ops-grid-4">
          <Panel title="Shipment reliability" icon={<ShieldCheck size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.reliability.shipment} />
          </Panel>
          <Panel title="Delay severity" icon={<AlertTriangle size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.reliability.severity} />
          </Panel>
          <Panel title="Customs reliability" icon={<PackageCheck size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.reliability.customs} />
          </Panel>
          <Panel title="Supply protection" icon={<ShieldCheck size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.reliability.protection} />
          </Panel>
        </div>
      </Section>

      {/* ---- Section 3 — Inventory health ------------------------------- */}
      <Section index="03" kicker="Inventory health" title="Do we have enough inventory?" question="Stock vs open customer demand" accent={ACCENT.violet}>
        <div className="ops-grid-3">
          <Panel title="Serviceability" icon={<Gauge size={15} aria-hidden="true" />} hint={`${snap.health.coverageDays} days coverage`}>
            <MetricRow stats={snap.health.serviceability} />
            <div className="ops-coverage">
              <span>Coverage</span>
              <strong className="ops-figure" key={snap.health.coverageDays}>
                {snap.health.coverageDays} days
              </strong>
            </div>
          </Panel>
          <Panel title="Stock state" icon={<PieChart size={15} aria-hidden="true" />} hint="part-to-whole">
            <DonutChart slices={snap.donuts.inventoryState} centerLabel="Units" formatValue={(v) => Intl.NumberFormat().format(v)} />
          </Panel>
          <Panel title="Inventory aging" icon={<Boxes size={15} aria-hidden="true" />}>
            <div className="ops-bands">
              {snap.health.aging.map((band: ExecBand) => (
                <div className={`ops-band ${toneClass(band.tone)}`} key={band.label}>
                  <div className="ops-band-top">
                    <span>{band.label}</span>
                    <strong>{band.value}</strong>
                  </div>
                  <div className="ops-band-track">
                    <span style={{ width: `${band.pct}%` }} />
                  </div>
                  <span className="ops-band-sub">
                    {band.volume} · {band.pct}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="ops-grid-3">
          <Panel title="Expiry & out of stock" icon={<AlertTriangle size={15} aria-hidden="true" />}>
            <MetricRow stats={[snap.health.nearExpiry, snap.health.writeOffRisk]} />
            <span className="ops-subhead">Out of stock</span>
            <MetricRow stats={snap.health.outOfStock} />
          </Panel>
        </div>
      </Section>

      {/* ---- Section 4 — Customer fulfilment ---------------------------- */}
      <Section index="04" kicker="Fulfilment" title="Customer fulfilment" question="Are customers receiving product as expected?" accent={ACCENT.emerald}>
        <div className="ops-grid-4">
          <Panel title="Orders" icon={<PackageCheck size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.fulfillment.orders} />
          </Panel>
          <Panel title="Order status" icon={<PieChart size={15} aria-hidden="true" />} hint="part-to-whole">
            <DonutChart slices={snap.donuts.orderState} centerLabel="Orders" formatValue={(v) => Intl.NumberFormat().format(v)} />
          </Panel>
          <Panel title="PO → POD cycle" icon={<Clock size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.fulfillment.cycle} />
          </Panel>
          <Panel title="Performance buckets" icon={<Gauge size={15} aria-hidden="true" />}>
            <MetricRow stats={snap.fulfillment.buckets} />
          </Panel>
        </div>
      </Section>

      {/* ---- Section 5 — Business flow + live map + scenes -------------- */}
      <Section index="05" kicker="Business flow" title="The business in motion" question="Primary sales → Inventory → Secondary sales" accent={ACCENT.cyan}>
        <div className="ops-flow">
          <FlowNode title="Incoming" icon={<PlaneLanding size={16} aria-hidden="true" />} stats={snap.flow.incoming} />
          <FlowConnector intensity={snap.flow.intensity.inbound} reduced={reduced} />
          <FlowNode title="Inventory" icon={<Warehouse size={16} aria-hidden="true" />} stats={snap.flow.inventory} />
          <FlowConnector intensity={snap.flow.intensity.outbound} reduced={reduced} />
          <FlowNode title="Outgoing" icon={<Send size={16} aria-hidden="true" />} stats={snap.flow.outgoing} />
        </div>

        <div className="ops-scenes">
          <FlowScene spec={scenes.air} reduced={reduced} />
          <FlowScene spec={scenes.warehouse} reduced={reduced} />
          <FlowScene spec={scenes.truck} reduced={reduced} />
        </div>

        <div className="ops-map-wrap">
          <WorldMap
            values={snap.map.values}
            tooltips={snap.map.tooltips}
            sidePanel={snap.map.sidePanel}
            cities={snap.map.cities}
            routes={snap.map.routes}
            activeCountry={country}
            formatValue={snap.map.formatValue}
            caption="Live network value by country — click a country to drop into its cities"
          />
          <div className="ops-map-legend" aria-hidden="true">
            <span className="ops-map-legend-title">Network value</span>
            <span className="ops-map-legend-bar" />
            <span className="ops-map-legend-scale">
              <span>Low</span>
              <span>High</span>
            </span>
          </div>
        </div>

        <div className="ops-throughput">
          <div className="ops-throughput-head">
            <h4>
              <BarChart3 size={15} aria-hidden="true" /> Top hubs by throughput
            </h4>
            <span className="ops-node-legend">
              <span className="ops-node-key"><i style={{ background: "#00e676" }} aria-hidden="true" />Optimal</span>
              <span className="ops-node-key"><i style={{ background: "#ffc400" }} aria-hidden="true" />High load</span>
              <span className="ops-node-key"><i style={{ background: "#ff5252" }} aria-hidden="true" />Holding / delay</span>
              <span className="ops-node-key"><i style={{ background: "#37e6ff" }} aria-hidden="true" />New market</span>
            </span>
          </div>
          <BarMeter rows={topHubs} format={snap.map.formatValue} />
          <p className="ops-throughput-cap">
            Markets ranked by live network value (incoming + stock + revenue). Map nodes share the same colour key, and
            new markets light up in cyan as they enter.
          </p>
        </div>
      </Section>

      {/* ---- Section 6 — Regional context ------------------------------- */}
      <Section index="06" kicker="Regional context" title="Country + Vertical vs region" question="Never compared globally — only against the region average" accent={ACCENT.blue}>
        <div className="ops-bench-grid">
          {snap.regional.map((row: ExecBenchmark, i) => (
            <article className={`ops-bench ${toneClass(row.tone)}`} key={`${row.country}-${row.metric}-${i}`}>
              <header>
                <strong>{row.country}</strong>
                <span className="ops-bench-vertical">{row.vertical}</span>
                <span className="ops-bench-region">{row.region}</span>
              </header>
              <div className="ops-bench-body">
                <div className="ops-bench-metric">
                  <span>{row.metric}</span>
                  <strong className="ops-figure">{row.value}</strong>
                </div>
                <div className="ops-bench-vs">
                  <span>{row.benchmark}</span>
                  <em className={toneClass(row.tone)}>{row.deltaLabel}</em>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ---- Section 7 — Management attention --------------------------- */}
      <Section index="07" kicker="Attention" title="Where management should focus" question="Ranked by business impact — Country + Vertical, value and volume" accent={ACCENT.crimson}>
        <div className="ops-attention">
          {snap.attention.length === 0 ? (
            <p className="ops-empty">No interventions needed right now — the network is running clean.</p>
          ) : (
            snap.attention.map((item: ExecAttention, i) => (
              <article className={`ops-attn ${toneClass(item.tone)}`} key={`${item.country}-${item.headline}-${i}`}>
                <span className={`ops-attn-flag ${toneClass(item.tone)}`} aria-hidden="true" />
                <div className="ops-attn-id">
                  <strong>
                    {item.country} <span className="ops-attn-vertical">{item.vertical}</span>
                  </strong>
                  <span className="ops-attn-headline">{item.headline}</span>
                </div>
                <div className="ops-attn-impact">
                  <span className="ops-attn-impact-label">{item.impact}</span>
                  <strong className="ops-figure">{item.value}</strong>
                  <span className="ops-attn-volume">{item.volume}</span>
                </div>
                <p className="ops-attn-reason">{item.reason}</p>
              </article>
            ))
          )}
        </div>
      </Section>

      {/* ---- Section 8 — Success stories -------------------------------- */}
      <Section index="08" kicker="What's going right" title="Success stories" question="Executives should see wins, not only problems" accent={ACCENT.emerald}>
        <div className="ops-wins">
          {snap.success.map((win: ExecWin, i) => (
            <article className="ops-win" key={`${win.title}-${i}`}>
              <Trophy size={15} aria-hidden="true" className="ops-win-icon" />
              <span className="ops-win-title">{win.title}</span>
              <strong className="ops-win-where">
                {win.country} <span>{win.vertical}</span>
              </strong>
              <p className="ops-win-detail">{win.detail}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ---- Section 9 — Live business feed ----------------------------- */}
      <Section index="09" kicker="Live feed" title="Live business feed" question="Leave it open all day — events stream in as they happen" accent={ACCENT.slate}>
        <div className="ops-feed-wrap">
          <div className="ops-feed-main">
            <div className="ops-feed-head">
              <Radio size={15} aria-hidden="true" /> Operational stream
              <span className="ops-feed-globe">
                <Globe2 size={13} aria-hidden="true" /> all markets
              </span>
            </div>
            <LiveTicker events={tickerEvents} />
          </div>
          <ActivityFeed events={feedEvents} defaultFilter="all" />
        </div>
        <div className="ops-feed-foot">
          <Activity size={13} aria-hidden="true" /> Continuous live pulse — board, CEO, MD and GM read one screen, no reports.
        </div>
      </Section>
    </div>
  );
}
