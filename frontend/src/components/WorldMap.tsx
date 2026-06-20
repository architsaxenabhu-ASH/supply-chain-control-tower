import { useEffect, useMemo, useRef, useState } from "react";
import { geoArea, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, MultiPolygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

import { cityCoords } from "../lib/cityGeo";
import { INDIA_CLAIM_GEOMETRY } from "../lib/indiaClaim";
import { prefersReducedMotion } from "../motion/motion";

// An interactive operational map (Phase 6J). World → Country → City drill-down:
// click a country to smoothly zoom in (the rest of the world dims but stays for
// context), see the cities receiving activity as pulsing nodes, and read a rich
// tooltip. Country geometry is reference data matched dynamically to whatever
// countries the application has learned — nothing about the business is
// hardcoded here.

const topology = worldTopo as unknown as Topology;
const countries = feature(
  topology,
  topology.objects.countries as GeometryCollection<{ name?: string }>,
) as FeatureCollection<Geometry, { name?: string }>;

const WIDTH = 960;
const HEIGHT = 460;
const EXTENT: [[number, number], [number, number]] = [
  [6, 6],
  [WIDTH - 6, HEIGHT - 6],
];

// India must be shown with the boundary officially accepted by the Government of
// India (full territorial claim). We replace the world-atlas (de-facto) India
// outline with that claim and draw it LAST, so in the disputed sectors India's
// claimed border sits on top of the neighbouring countries' fills.
//
// d3-geo fills a spherical polygon by winding order. If the imported claim is
// wound opposite to the world-atlas data, d3 fills its COMPLEMENT — a giant blob
// covering the whole map that swallows every click and breaks India's centroid
// (so the routes disappear). Detect that (spherical area > half the globe) and
// reverse every ring so India fills India.
function reverseRings(geometry: MultiPolygon): MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())),
  };
}

const indiaGeometry: MultiPolygon =
  geoArea({ type: "Feature", properties: {}, geometry: INDIA_CLAIM_GEOMETRY } as Feature<Geometry>) > 2 * Math.PI
    ? reverseRings(INDIA_CLAIM_GEOMETRY)
    : INDIA_CLAIM_GEOMETRY;

const INDIA_CLAIM_FEATURE = {
  type: "Feature",
  properties: { name: "India" },
  geometry: indiaGeometry,
} as Feature<Geometry, { name?: string }>;

const drawable = {
  type: "FeatureCollection",
  features: [
    ...countries.features.filter(
      (item) => item.properties?.name !== "Antarctica" && item.properties?.name !== "India",
    ),
    INDIA_CLAIM_FEATURE,
  ],
} as FeatureCollection<Geometry, { name?: string }>;

// One fixed world projection; zoom is done with a transform, so geometry never
// re-projects and the motion stays smooth.
const WORLD_PROJECTION = geoNaturalEarth1().fitExtent(EXTENT, drawable);
const WORLD_PATH = geoPath(WORLD_PROJECTION);

type NamedFeature = Feature<Geometry, { name?: string }>;
type CountryShape = { key: string; name: string; d: string; cx: number; cy: number; feature: NamedFeature };

const WORLD_SHAPES: CountryShape[] = drawable.features
  .map((item, index) => {
    const name = item.properties?.name ?? `country-${index}`;
    const d = WORLD_PATH(item);
    if (!d) return null;
    const [cx, cy] = WORLD_PATH.centroid(item);
    return { key: `${name}-${index}`, name, d, cx, cy, feature: item };
  })
  .filter((shape): shape is CountryShape => shape !== null);

// Common spelling variants → atlas names. Geographic normalisation only.
const NAME_ALIASES: Record<string, string> = {
  usa: "united states of america",
  us: "united states of america",
  "united states": "united states of america",
  uk: "united kingdom",
  "great britain": "united kingdom",
  uae: "united arab emirates",
  "czech republic": "czechia",
  "ivory coast": "côte d'ivoire",
};

function normalise(name: string): string {
  const key = name.trim().toLowerCase();
  return NAME_ALIASES[key] ?? key;
}

// Command-centre node palette: each city node is tinted by its operating status,
// the way a live control map flags load. Green = running clean, amber = under
// load, red = held/delayed, cyan = a brand-new market that just came online.
const STATUS_GREEN = "#00e676";
const STATUS_AMBER = "#ffc400";
const STATUS_RED = "#ff5252";
const STATUS_NEW = "#37e6ff";
function cityStatusColor(status?: string): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("new market")) return STATUS_NEW;
  if (s.includes("delay") || s.includes("risk") || s.includes("low") || s.includes("hold") || s.includes("late") || s.includes("expir")) return STATUS_RED;
  if (s.includes("po") || s.includes("load") || s.includes("watch") || s.includes("warn")) return STATUS_AMBER;
  return STATUS_GREEN;
}

const FEATURE_BY_NAME = new Map<string, NamedFeature>();
for (const shape of WORLD_SHAPES) FEATURE_BY_NAME.set(normalise(shape.name), shape.feature);

// Projected country centroids — used to draw animated routes between countries.
const CENTROID_BY_NAME = new Map<string, [number, number]>();
for (const shape of WORLD_SHAPES) CENTROID_BY_NAME.set(normalise(shape.name), [shape.cx, shape.cy]);

type Transform = { x: number; y: number; k: number };

function transformForFeatures(features: NamedFeature[]): Transform {
  if (features.length === 0) return { x: 0, y: 0, k: 1 };
  const [[x0, y0], [x1, y1]] = WORLD_PATH.bounds({ type: "FeatureCollection", features } as FeatureCollection);
  const bw = Math.max(x1 - x0, 1);
  const bh = Math.max(y1 - y0, 1);
  const k = Math.max(1, Math.min(7, Math.min(WIDTH / bw, HEIGHT / bh) * 0.82));
  return { x: WIDTH / 2 - (k * (x0 + x1)) / 2, y: HEIGHT / 2 - (k * (y0 + y1)) / 2, k };
}

export type MapDetailRow = { label: string; value: number };

// An animated route between two countries — drawn only at world level, and only
// when there is real in-motion activity to represent.
export type MapRoute = { from: string; to: string; intensity?: number; mode?: "air" | "sea" };

// A city receiving activity, placed by its geographic coordinates.
export type MapCity = {
  country: string;
  city: string;
  lon: number;
  lat: number;
  value: number; // magnitude → pulse size
  valueLabel?: string;
  volume?: string;
  movement?: string;
  status?: string;
};

export type WorldMapProps = {
  /** Country name (any casing) → magnitude. Zero/negative entries are ignored. */
  values: Record<string, number>;
  formatValue?: (value: number) => string;
  caption?: string;
  /** Current operating environment — rendered with an accent outline. */
  activeCountry?: string;
  /** Called with the original country name from `values` when a lit country is clicked. */
  onSelect?: (country: string) => void;
  /** Per-country breakdown shown in the hover tooltip, keyed like `values`. */
  details?: Record<string, MapDetailRow[]>;
  /** Pre-formatted hover rows per country; takes precedence over `details`. */
  tooltips?: Record<string, { label: string; value: string }[]>;
  /** Animated routes between countries; only drawn at world level (performance). */
  routes?: MapRoute[];
  /** City-level nodes; only rendered once a country is zoomed into (performance). */
  cities?: MapCity[];
  /** Persistent side-panel rows per country, shown when a country is selected. */
  sidePanel?: Record<string, { label: string; value: string; tone?: "good" | "bad" | "warn" }[]>;
  /** Auto-frame to the lit countries when nothing is clicked. */
  fitToRegion?: boolean;
};

const VIEW_CX = WIDTH / 2;
const VIEW_CY = HEIGHT / 2;

// Tooltip *content* only. Position is tracked separately (in a ref + rAF) so the
// cursor can move without re-rendering the whole map on every pixel.
type Hover =
  | { kind: "country"; title: string; total: string; rows: { label: string; value: string }[] }
  | { kind: "city"; title: string; sub: string; rows: { label: string; value: string }[] }
  | null;

export function WorldMap({
  values,
  formatValue,
  caption,
  activeCountry,
  onSelect,
  details,
  tooltips,
  routes,
  cities,
  sidePanel,
  fitToRegion,
}: WorldMapProps) {
  const reduced = prefersReducedMotion();
  const figureRef = useRef<HTMLElement | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<MapCity | null>(null);
  const [userZoom, setUserZoom] = useState(1);

  // Tooltip position lives outside React state: a ref holds the latest cursor
  // point and a single rAF nudges only the tooltip element. This keeps mouse
  // movement off the React render path entirely, so the map never re-renders
  // while you simply glide the cursor across it.
  const posRef = useRef({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const { byShape, max, detailByShape, tooltipByShape } = useMemo(() => {
    const map = new Map<string, { original: string; value: number }>();
    const det = new Map<string, MapDetailRow[]>();
    const tip = new Map<string, { label: string; value: string }[]>();
    let top = 0;
    for (const [original, value] of Object.entries(values)) {
      if (!original || !Number.isFinite(value) || value <= 0) continue;
      const key = normalise(original);
      const next = (map.get(key)?.value ?? 0) + value;
      map.set(key, { original, value: next });
      if (next > top) top = next;
    }
    for (const [original, rows] of Object.entries(details ?? {})) {
      det.set(normalise(original), rows);
    }
    for (const [original, rows] of Object.entries(tooltips ?? {})) {
      tip.set(normalise(original), rows);
    }
    return { byShape: map, max: top, detailByShape: det, tooltipByShape: tip };
  }, [values, details, tooltips]);

  // Resolve route name-pairs to projected arc paths; world level only.
  const resolvedRoutes = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    const out: { d: string; mode: "air" | "sea"; dur: number }[] = [];
    for (const r of routes) {
      const a = CENTROID_BY_NAME.get(normalise(r.from));
      const b = CENTROID_BY_NAME.get(normalise(r.to));
      if (!a || !b) continue;
      const [x0, y0] = a;
      const [x1, y1] = b;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      if (dist < 2) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2 - dist * 0.3;
      out.push({
        d: `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`,
        mode: r.mode ?? "air",
        dur: Math.max(3.5, 8 - (r.intensity ?? 1)),
      });
    }
    return out;
  }, [routes]);

  // What the map is focused on: a clicked country, else the lit region, else
  // the whole world. The focus drives a smooth transform-zoom.
  const focusFeatures = useMemo(() => {
    if (zoomed) {
      const f = FEATURE_BY_NAME.get(normalise(zoomed));
      return f ? [f] : [];
    }
    if (fitToRegion) {
      return [...byShape.keys()].map((n) => FEATURE_BY_NAME.get(n)).filter((f): f is NamedFeature => Boolean(f));
    }
    return [];
  }, [zoomed, fitToRegion, byShape]);

  const t = useMemo(() => transformForFeatures(focusFeatures), [focusFeatures]);

  const active = activeCountry ? normalise(activeCountry) : "";
  const fmt = (value: number) => (formatValue ? formatValue(value) : String(value));

  // Cities for the country in focus (only computed/rendered when zoomed).
  const cityList = useMemo(() => {
    if (!zoomed || !cities) return [];
    const z = normalise(zoomed);
    return cities
      .filter((c) => normalise(c.country) === z && Number.isFinite(c.lon) && Number.isFinite(c.lat))
      .sort((a, b) => b.value - a.value);
  }, [zoomed, cities]);
  const maxCity = Math.max(1, ...cityList.map((c) => c.value));

  function pointer(event: React.MouseEvent): { x: number; y: number } {
    const rect = figureRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  // Apply the latest cursor point to the tooltip element directly (no re-render),
  // flipping it to the other side of the cursor near the right/bottom edges so it
  // never overflows the map.
  function positionTooltip() {
    rafRef.current = null;
    const el = tooltipRef.current;
    const fig = figureRef.current;
    if (!el || !fig) return;
    const { x, y } = posRef.current;
    const w = fig.clientWidth;
    const h = fig.clientHeight;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    let tx = x + 16;
    let ty = y + 16;
    if (tx + tw > w - 8) tx = x - tw - 16;
    if (tx < 8) tx = 8;
    if (ty + th > h - 8) ty = y - th - 16;
    if (ty < 8) ty = 8;
    el.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function scheduleTooltip() {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(positionTooltip);
  }

  function trackPointer(event: React.MouseEvent) {
    if (!hover) return; // only follow the cursor while a tooltip is visible
    posRef.current = pointer(event);
    scheduleTooltip();
  }

  function hoverCountry(event: React.MouseEvent, shape: CountryShape, slot: { value: number }) {
    posRef.current = pointer(event);
    const key = normalise(shape.name);
    const preformatted = tooltipByShape.get(key);
    const rows = preformatted
      ? preformatted
      : (detailByShape.get(key) ?? []).map((r) => ({ label: r.label, value: fmt(r.value) }));
    setHover({ kind: "country", title: shape.name, total: fmt(slot.value), rows });
    scheduleTooltip();
  }

  function hoverCity(event: React.MouseEvent, c: MapCity) {
    posRef.current = pointer(event);
    const rows: { label: string; value: string }[] = [];
    if (c.volume) rows.push({ label: "Volume", value: c.volume });
    if (c.movement) rows.push({ label: "Movement", value: c.movement });
    if (c.status) rows.push({ label: "Status", value: c.status });
    rows.push({ label: "Value", value: c.valueLabel ?? fmt(c.value) });
    setHover({ kind: "city", title: c.city, sub: c.country, rows });
    scheduleTooltip();
  }

  function handleCountryClick(shape: CountryShape, slot: { original: string } | undefined) {
    setZoomed(shape.name);
    setSelectedCity(null);
    setHover(null);
    setUserZoom(1);
    if (slot && onSelect) onSelect(slot.original);
  }

  function backToWorld() {
    setZoomed(null);
    setSelectedCity(null);
    setHover(null);
    setUserZoom(1);
  }

  // Manual zoom is layered on top of the fit-to-focus transform, scaling around
  // the viewport centre so the controls always behave the same anywhere on the
  // map (no dead zones near the edges).
  const transformStyle = {
    transform: `translate(${VIEW_CX}px, ${VIEW_CY}px) scale(${userZoom}) translate(${-VIEW_CX}px, ${-VIEW_CY}px) translate(${t.x}px, ${t.y}px) scale(${t.k})`,
    transformOrigin: "0px 0px",
    transition: reduced ? "none" : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform",
  } as const;

  const panelRows = useMemo(() => {
    if (!zoomed || !sidePanel) return null;
    const z = normalise(zoomed);
    for (const [name, rows] of Object.entries(sidePanel)) if (normalise(name) === z) return rows;
    return null;
  }, [zoomed, sidePanel]);

  return (
    <figure
      className="world-map-figure"
      ref={figureRef}
      onMouseMove={trackPointer}
      onMouseLeave={() => setHover(null)}
    >
      {/* Breadcrumb / back controls — never lose context */}
      {zoomed ? (
        <nav className="map-breadcrumb" aria-label="Map location">
          <button type="button" onClick={backToWorld}>← World</button>
          <span aria-hidden="true">▸</span>
          {selectedCity ? (
            <>
              <button type="button" onClick={() => { setSelectedCity(null); setHover(null); }}>{zoomed}</button>
              <span aria-hidden="true">▸</span>
              <span className="map-breadcrumb-current">{selectedCity.city}</span>
            </>
          ) : (
            <span className="map-breadcrumb-current">{zoomed}</span>
          )}
        </nav>
      ) : null}

      <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption ?? "World map"}>
        <g style={transformStyle}>
          {WORLD_SHAPES.map((shape) => {
            const key = normalise(shape.name);
            const slot = byShape.get(key);
            const intensity = slot && max > 0 ? 30 + Math.round((slot.value / max) * 55) : 0;
            const isActive = active !== "" && key === active;
            const isZoomed = zoomed != null && key === normalise(zoomed);
            const dimmed = zoomed != null && !isZoomed;
            return (
              <path
                key={shape.key}
                className={`map-country${slot ? " has-value" : ""}${isActive ? " is-active" : ""}${isZoomed ? " is-zoomed" : ""}${dimmed ? " is-dimmed" : ""}`}
                d={shape.d}
                vectorEffect="non-scaling-stroke"
                aria-label={slot ? `${shape.name} — ${fmt(slot.value)}` : shape.name}
                style={slot ? { fill: `color-mix(in srgb, var(--country-accent) ${intensity}%, var(--map-land))` } : undefined}
                onClick={() => handleCountryClick(shape, slot)}
                onMouseEnter={slot ? (event) => hoverCountry(event, shape, slot) : undefined}
                onMouseLeave={slot ? () => setHover(null) : undefined}
              />
            );
          })}
          {/* Animated shipment routes — world level only; movement = real activity */}
          {!zoomed && resolvedRoutes.length > 0 ? (
            <g className="map-route-layer" aria-hidden="true">
              {resolvedRoutes.map((r, i) => (
                <g key={`route-${i}`} className={`map-route mode-${r.mode}`}>
                  <path
                    id={`exec-route-${i}`}
                    className="map-route-path"
                    d={r.d}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                  {!reduced ? (
                    <path
                      className="map-route-mover"
                      d={
                        r.mode === "sea"
                          ? "M-3.4 -1.5 L3.6 -1.5 L2.3 1.9 L-2.3 1.9 Z"
                          : "M4.4 0 L-3.1 -2.7 L-1.3 0 L-3.1 2.7 Z"
                      }
                    >
                      <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" rotate="auto">
                        <mpath href={`#exec-route-${i}`} />
                      </animateMotion>
                    </path>
                  ) : null}
                </g>
              ))}
            </g>
          ) : null}

          {/* Country activity dots — only at world level */}
          {!zoomed
            ? WORLD_SHAPES.filter((shape) => byShape.has(normalise(shape.name))).map((shape) => (
                <g key={`dot-${shape.key}`} aria-hidden="true">
                  <circle className="map-dot-pulse" cx={shape.cx} cy={shape.cy} r={5} />
                  <circle className="map-dot" cx={shape.cx} cy={shape.cy} r={3.2} />
                </g>
              ))
            : null}
        </g>

        {/* City nodes — screen-positioned, only after a country is zoomed in */}
        {zoomed && cityList.length > 0 ? (
          <g className="map-city-layer">
            {cityList.map((c) => {
              const p = WORLD_PROJECTION([c.lon, c.lat]);
              if (!p) return null;
              const bx = t.k * p[0] + t.x;
              const by = t.k * p[1] + t.y;
              const sx = VIEW_CX + userZoom * (bx - VIEW_CX);
              const sy = VIEW_CY + userZoom * (by - VIEW_CY);
              const r = 4 + 9 * Math.sqrt((c.value || 0) / maxCity);
              const isSel = selectedCity?.city === c.city;
              const color = cityStatusColor(c.status);
              return (
                <g
                  key={c.city}
                  className={`map-city${isSel ? " is-selected" : ""}`}
                  style={{
                    transform: `translate(${sx}px, ${sy}px)`,
                    transition: reduced ? undefined : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(event) => hoverCity(event, c)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelectedCity(c)}
                >
                  <circle className="map-dot-pulse" r={r} style={{ fill: color }} />
                  <circle className="map-city-dot" r={Math.max(3, r * 0.5)} style={{ fill: color, stroke: color }} />
                  <text className="map-city-label" y={-r - 5}>{c.city}</text>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>

      {/* Always-visible zoom controls — an HTML overlay, never clipped by the map */}
      <div className="map-zoom-controls" role="group" aria-label="Zoom controls">
        <button type="button" onClick={() => setUserZoom((z) => Math.min(z * 1.4, 6))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setUserZoom((z) => Math.max(z / 1.4, 0.6))} aria-label="Zoom out">−</button>
        <button type="button" onClick={backToWorld} aria-label="Reset view" title="Reset to world view">⤾</button>
      </div>

      {/* Persistent side panel — the selected country's numbers, not just a tooltip */}
      {panelRows ? (
        <aside className="map-side-panel">
          <h4>{zoomed}</h4>
          <ul>
            {panelRows.map((row) => (
              <li key={row.label} className={row.tone ? `tone-${row.tone}` : ""}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {/* Enhanced tooltip — stays while hovering; no native browser tooltip */}
      {hover ? (
        <div
          ref={tooltipRef}
          className="map-tooltip"
          style={{ transform: `translate(${posRef.current.x + 16}px, ${posRef.current.y + 16}px)` }}
          role="status"
        >
          <strong className="map-tooltip-name">{hover.title}</strong>
          {hover.kind === "city" ? <span className="map-tooltip-sub">{hover.sub}</span> : null}
          {hover.kind === "country" ? <span className="map-tooltip-total">{hover.total}</span> : null}
          {hover.rows.length > 0 ? (
            <ul className="map-tooltip-rows">
              {hover.rows.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* When a city is selected, a persistent read-out so context is kept */}
      {selectedCity ? (
        <div className="map-city-readout">
          <strong>{selectedCity.city}</strong>
          <span>{selectedCity.country}</span>
          <span className="map-city-readout-val">{selectedCity.valueLabel ?? fmt(selectedCity.value)}</span>
          {selectedCity.volume ? <span>{selectedCity.volume}</span> : null}
          {selectedCity.status ? <span className="tag">{selectedCity.status}</span> : null}
        </div>
      ) : null}

      {caption ? <figcaption className="map-caption">{caption}</figcaption> : null}
    </figure>
  );
}
