import { useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

import { cityCoords } from "../lib/cityGeo";

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

const drawable = {
  type: "FeatureCollection",
  features: countries.features.filter((item) => item.properties?.name !== "Antarctica"),
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

const FEATURE_BY_NAME = new Map<string, NamedFeature>();
for (const shape of WORLD_SHAPES) FEATURE_BY_NAME.set(normalise(shape.name), shape.feature);

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
  /** City-level nodes; only rendered once a country is zoomed into (performance). */
  cities?: MapCity[];
  /** Persistent side-panel rows per country, shown when a country is selected. */
  sidePanel?: Record<string, { label: string; value: string; tone?: "good" | "bad" | "warn" }[]>;
  /** Auto-frame to the lit countries when nothing is clicked. */
  fitToRegion?: boolean;
};

const VIEW_CX = WIDTH / 2;
const VIEW_CY = HEIGHT / 2;

type Hover =
  | { kind: "country"; title: string; total: string; rows: { label: string; value: string }[]; x: number; y: number }
  | { kind: "city"; title: string; sub: string; rows: { label: string; value: string }[]; x: number; y: number }
  | null;

export function WorldMap({
  values,
  formatValue,
  caption,
  activeCountry,
  onSelect,
  details,
  cities,
  sidePanel,
  fitToRegion,
}: WorldMapProps) {
  const figureRef = useRef<HTMLElement | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<MapCity | null>(null);
  const [userZoom, setUserZoom] = useState(1);

  const { byShape, max, detailByShape } = useMemo(() => {
    const map = new Map<string, { original: string; value: number }>();
    const det = new Map<string, MapDetailRow[]>();
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
    return { byShape: map, max: top, detailByShape: det };
  }, [values, details]);

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

  function hoverCountry(event: React.MouseEvent, shape: CountryShape, slot: { value: number }) {
    const rows = (detailByShape.get(normalise(shape.name)) ?? []).map((r) => ({ label: r.label, value: fmt(r.value) }));
    setHover({ kind: "country", title: shape.name, total: fmt(slot.value), rows, ...pointer(event) });
  }

  function hoverCity(event: React.MouseEvent, c: MapCity) {
    const rows: { label: string; value: string }[] = [];
    if (c.volume) rows.push({ label: "Volume", value: c.volume });
    if (c.movement) rows.push({ label: "Movement", value: c.movement });
    if (c.status) rows.push({ label: "Status", value: c.status });
    rows.push({ label: "Value", value: c.valueLabel ?? fmt(c.value) });
    setHover({ kind: "city", title: c.city, sub: c.country, rows, ...pointer(event) });
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
    transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
  } as const;

  const panelRows = useMemo(() => {
    if (!zoomed || !sidePanel) return null;
    const z = normalise(zoomed);
    for (const [name, rows] of Object.entries(sidePanel)) if (normalise(name) === z) return rows;
    return null;
  }, [zoomed, sidePanel]);

  return (
    <figure className="world-map-figure" ref={figureRef} onMouseLeave={() => setHover(null)}>
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
                onMouseMove={slot ? (event) => hoverCountry(event, shape, slot) : undefined}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
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
              return (
                <g
                  key={c.city}
                  className={`map-city${isSel ? " is-selected" : ""}`}
                  transform={`translate(${sx}, ${sy})`}
                  onMouseEnter={(event) => hoverCity(event, c)}
                  onMouseMove={(event) => hoverCity(event, c)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelectedCity(c)}
                >
                  <circle className="map-dot-pulse" r={r} />
                  <circle className="map-city-dot" r={Math.max(3, r * 0.5)} />
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
          className="map-tooltip"
          style={{
            left: Math.min(hover.x + 14, (figureRef.current?.clientWidth ?? WIDTH) - 8),
            top: hover.y + 14,
          }}
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
