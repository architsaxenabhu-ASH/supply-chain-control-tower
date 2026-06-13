import { useMemo, useRef, useState } from "react";
import { geoBounds, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

// Country geometry is geography reference data, not business master data:
// shapes are matched dynamically against whatever countries the application
// has learned, so nothing here hardcodes the business's country list.

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

type CountryShape = { key: string; name: string; d: string; cx: number; cy: number };

function shapesFor(pathOf: ReturnType<typeof geoPath>): CountryShape[] {
  return drawable.features
    .map((item, index) => {
      const name = item.properties?.name ?? `country-${index}`;
      const d = pathOf(item);
      if (!d) return null;
      const [cx, cy] = pathOf.centroid(item);
      return { key: `${name}-${index}`, name, d, cx, cy };
    })
    .filter((shape): shape is CountryShape => shape !== null);
}

// Default world view (computed once).
const WORLD_SHAPES = shapesFor(geoPath(geoNaturalEarth1().fitExtent(EXTENT, drawable)));

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

export type MapDetailRow = { label: string; value: number };

export type WorldMapProps = {
  /** Country name (any casing) → magnitude. Zero/negative entries are ignored. */
  values: Record<string, number>;
  formatValue?: (value: number) => string;
  caption?: string;
  /** Current operating environment — rendered with an accent outline. */
  activeCountry?: string;
  /** Called with the original country name from `values` when a lit country is clicked. */
  onSelect?: (country: string) => void;
  /** Per-country breakdown (e.g. by vertical) shown in the hover tooltip,
   *  keyed by the same country names as `values`. */
  details?: Record<string, MapDetailRow[]>;
  /** Zoom/fit the map to the region of the lit countries (plus surrounding
   *  countries), instead of showing the whole world. When nothing is lit, the
   *  world is shown so the map is never blank. */
  fitToRegion?: boolean;
};

function clampLat(value: number): number {
  return Math.max(-82, Math.min(82, value));
}

export function WorldMap({
  values,
  formatValue,
  caption,
  activeCountry,
  onSelect,
  details,
  fitToRegion,
}: WorldMapProps) {
  const figureRef = useRef<HTMLElement | null>(null);
  const [hover, setHover] = useState<{ name: string; original: string; value: number; x: number; y: number } | null>(
    null,
  );

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

  // Regional fit: build a projection around the lit countries (with a margin so
  // neighbouring / connecting countries stay visible), else show the world.
  const shapes = useMemo(() => {
    if (!fitToRegion || byShape.size === 0) return WORLD_SHAPES;
    const litNames = new Set(byShape.keys());
    const litFeatures = drawable.features.filter((f) => litNames.has(normalise(f.properties?.name ?? "")));
    if (litFeatures.length === 0) return WORLD_SHAPES;
    const [[west, south], [east, north]] = geoBounds({
      type: "FeatureCollection",
      features: litFeatures,
    } as FeatureCollection);
    const padLon = Math.max((east - west) * 0.6, 9);
    const padLat = Math.max((north - south) * 0.6, 9);
    const region: Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [Math.max(-179, west - padLon), clampLat(south - padLat)],
            [Math.min(179, east + padLon), clampLat(south - padLat)],
            [Math.min(179, east + padLon), clampLat(north + padLat)],
            [Math.max(-179, west - padLon), clampLat(north + padLat)],
            [Math.max(-179, west - padLon), clampLat(south - padLat)],
          ],
        ],
      },
    };
    return shapesFor(geoPath(geoNaturalEarth1().fitExtent(EXTENT, region)));
  }, [fitToRegion, byShape]);

  const active = activeCountry ? normalise(activeCountry) : "";

  function moveTooltip(event: React.MouseEvent, shape: CountryShape, slot: { original: string; value: number }) {
    const rect = figureRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      name: shape.name,
      original: slot.original,
      value: slot.value,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  const hoverRows = hover ? detailByShape.get(normalise(hover.name)) ?? [] : [];

  return (
    <figure className="world-map-figure" ref={figureRef} onMouseLeave={() => setHover(null)}>
      <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption ?? "World map"}>
        {shapes.map((shape) => {
          const slot = byShape.get(normalise(shape.name));
          const intensity = slot && max > 0 ? 30 + Math.round((slot.value / max) * 55) : 0;
          const isActive = active !== "" && normalise(shape.name) === active;
          return (
            <path
              key={shape.key}
              className={`map-country${slot ? " has-value" : ""}${isActive ? " is-active" : ""}`}
              d={shape.d}
              style={
                slot
                  ? { fill: `color-mix(in srgb, var(--country-accent) ${intensity}%, var(--map-land))` }
                  : undefined
              }
              onClick={slot && onSelect ? () => onSelect(slot.original) : undefined}
              onMouseEnter={slot ? (event) => moveTooltip(event, shape, slot) : undefined}
              onMouseMove={slot ? (event) => moveTooltip(event, shape, slot) : undefined}
              onMouseLeave={() => setHover(null)}
            >
              {/* Native title is a screen-reader / no-JS fallback. */}
              <title>
                {slot ? `${shape.name} — ${formatValue ? formatValue(slot.value) : slot.value}` : shape.name}
              </title>
            </path>
          );
        })}
        {shapes
          .filter((shape) => byShape.has(normalise(shape.name)))
          .map((shape) => (
            <g key={`dot-${shape.key}`} aria-hidden="true">
              <circle className="map-dot-pulse" cx={shape.cx} cy={shape.cy} r={5} />
              <circle className="map-dot" cx={shape.cx} cy={shape.cy} r={3.2} />
            </g>
          ))}
      </svg>
      {hover ? (
        <div
          className="map-tooltip"
          style={{
            left: Math.min(hover.x + 14, (figureRef.current?.clientWidth ?? WIDTH) - 8),
            top: hover.y + 14,
          }}
          role="status"
        >
          <strong className="map-tooltip-name">{hover.name}</strong>
          <span className="map-tooltip-total">{formatValue ? formatValue(hover.value) : hover.value}</span>
          {hoverRows.length > 0 ? (
            <ul className="map-tooltip-rows">
              {hoverRows.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{formatValue ? formatValue(row.value) : row.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {caption ? <figcaption className="map-caption">{caption}</figcaption> : null}
    </figure>
  );
}
