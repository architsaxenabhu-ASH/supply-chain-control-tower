import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
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

const drawable = {
  type: "FeatureCollection",
  features: countries.features.filter((item) => item.properties?.name !== "Antarctica"),
} as FeatureCollection<Geometry, { name?: string }>;

const projection = geoNaturalEarth1().fitExtent(
  [
    [6, 6],
    [WIDTH - 6, HEIGHT - 6],
  ],
  drawable,
);
const pathOf = geoPath(projection);

type CountryShape = { key: string; name: string; d: string; cx: number; cy: number };

const SHAPES: CountryShape[] = drawable.features
  .map((item, index) => {
    const name = item.properties?.name ?? `country-${index}`;
    const d = pathOf(item);
    if (!d) return null;
    const [cx, cy] = pathOf.centroid(item);
    return { key: `${name}-${index}`, name, d, cx, cy };
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

export type WorldMapProps = {
  /** Country name (any casing) → magnitude. Zero/negative entries are ignored. */
  values: Record<string, number>;
  formatValue?: (value: number) => string;
  caption?: string;
  /** Current operating environment — rendered with an accent outline. */
  activeCountry?: string;
  /** Called with the original country name from `values` when a lit country is clicked. */
  onSelect?: (country: string) => void;
};

export function WorldMap({ values, formatValue, caption, activeCountry, onSelect }: WorldMapProps) {
  const { byShape, max } = useMemo(() => {
    const map = new Map<string, { original: string; value: number }>();
    let top = 0;
    for (const [original, value] of Object.entries(values)) {
      if (!original || !Number.isFinite(value) || value <= 0) continue;
      const key = normalise(original);
      const next = (map.get(key)?.value ?? 0) + value;
      map.set(key, { original, value: next });
      if (next > top) top = next;
    }
    return { byShape: map, max: top };
  }, [values]);

  const active = activeCountry ? normalise(activeCountry) : "";

  return (
    <figure className="world-map-figure">
      <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption ?? "World map"}>
        {SHAPES.map((shape) => {
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
            >
              <title>
                {slot ? `${shape.name} — ${formatValue ? formatValue(slot.value) : slot.value}` : shape.name}
              </title>
            </path>
          );
        })}
        {SHAPES.filter((shape) => byShape.has(normalise(shape.name))).map((shape) => (
          <g key={`dot-${shape.key}`} aria-hidden="true">
            <circle className="map-dot-pulse" cx={shape.cx} cy={shape.cy} r={5} />
            <circle className="map-dot" cx={shape.cx} cy={shape.cy} r={3.2} />
          </g>
        ))}
      </svg>
      {caption ? <figcaption className="map-caption">{caption}</figcaption> : null}
    </figure>
  );
}
