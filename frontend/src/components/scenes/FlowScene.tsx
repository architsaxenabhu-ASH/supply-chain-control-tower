import type { CSSProperties } from "react";
import { Boxes, Plane, Truck } from "lucide-react";

import type { SceneSpec } from "../../lib/sampleBusinessData";

// FlowScene (Phase 7C) — a signature motion scene per Overview mode. Instead of a
// single dot crawling the map, each mode gets a live, themed animation that makes
// its activity feel real:
//   primary   → cargo planes flying out of India (air-freight inbound)
//   inventory → a working 3-D warehouse: racks, a conveyor and a moving forklift
//   secondary → a delivery truck driving, wheels spinning, road scrolling
// Everything is hand-built CSS/SVG (no 3-D library), themed by the active mode's
// accent colour, and fully frozen under prefers-reduced-motion. The scene also
// names the visual concept it uses and overlays 2–3 live figures from the lane.

type Styled = CSSProperties & Record<string, string | number>;

const ICON = { air: Plane, warehouse: Boxes, truck: Truck } as const;

function range(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

// ---- Air freight: cargo planes climbing out over a globe horizon -------------

function AirScene({ intensity }: { intensity: number }) {
  const planes = Math.min(3, Math.max(1, Math.round(intensity / 2) + 1));
  const speed = 11 - intensity; // higher intensity → faster crossing
  return (
    <div className="air" aria-hidden="true">
      <div className="air-glow" />
      {range(5).map((index) => (
        <span key={`cloud-${index}`} className="air-cloud" style={{ "--i": index } as Styled} />
      ))}
      <div className="air-horizon">
        <span className="air-lat" style={{ "--o": 0 } as Styled} />
        <span className="air-lat" style={{ "--o": 1 } as Styled} />
        <span className="air-lat" style={{ "--o": 2 } as Styled} />
        <span className="air-origin" />
      </div>
      {range(planes).map((index) => (
        <div
          key={`plane-${index}`}
          className="air-lane"
          style={{ "--lane": index, "--speed": `${speed + index * 2}s`, "--delay": `${index * 1.6}s` } as Styled}
        >
          <span className="air-trail" />
          <span className="air-plane">
            <Plane size={30} strokeWidth={1.6} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Working warehouse: racks + conveyor + a forklift that lifts a pallet -----

function Crate({ tone, style }: { tone?: "load"; style?: Styled }) {
  return (
    <span className={`crate${tone === "load" ? " is-load" : ""}`} style={style}>
      <span className="crate-top" />
      <span className="crate-side" />
    </span>
  );
}

function WarehouseScene({ intensity }: { intensity: number }) {
  const parcels = Math.min(5, 2 + intensity); // conveyor throughput
  const cycle = 7 - Math.min(4, intensity); // forklift round-trip seconds
  return (
    <div className="wh" aria-hidden="true">
      <div className="wh-back" />
      <div className="wh-floor" />

      {/* Back-aisle shelving, two depths for a sense of room */}
      <div className="wh-rack wh-rack-far">
        {range(3).map((shelf) => (
          <span key={`far-${shelf}`} className="wh-shelf">
            {range(4).map((box) => (
              <Crate key={box} style={{ "--c": (box % 3) + 1 } as Styled} />
            ))}
          </span>
        ))}
      </div>
      <div className="wh-rack wh-rack-near">
        {range(3).map((shelf) => (
          <span key={`near-${shelf}`} className="wh-shelf">
            {range(5).map((box) => (
              <Crate key={box} style={{ "--c": ((box + shelf) % 3) + 1 } as Styled} />
            ))}
          </span>
        ))}
      </div>

      {/* Conveyor belt carrying parcels across the back */}
      <div className="wh-conveyor">
        <span className="wh-belt" />
        {range(parcels).map((index) => (
          <span
            key={`parcel-${index}`}
            className="wh-parcel"
            style={{ "--d": `${(index / parcels) * (parcels * 1.4)}s`, "--dur": `${parcels * 1.4}s` } as Styled}
          />
        ))}
      </div>

      {/* The forklift: drives the front aisle, raising its pallet at the rack */}
      <div className="forklift" style={{ "--cycle": `${cycle}s` } as Styled}>
        <svg viewBox="0 0 170 120" className="forklift-svg" role="img" aria-label="Forklift">
          <g className="fork-mast">
            <rect x="104" y="10" width="6" height="86" rx="2" />
            <rect x="114" y="10" width="6" height="86" rx="2" />
          </g>
          <g className="fork-carriage">
            <rect x="108" y="40" width="8" height="40" rx="2" />
            <polygon points="116,74 150,74 150,80 116,82" />
            <g className="fork-load">
              <rect x="120" y="46" width="30" height="26" rx="2" className="fork-pallet-box" />
              <rect x="120" y="72" width="30" height="6" className="fork-pallet" />
            </g>
          </g>
          <path className="fork-body" d="M16 58 L70 58 L84 74 L84 92 L12 92 L12 70 Z" />
          <rect className="fork-cab" x="60" y="34" width="26" height="26" rx="3" />
          <circle className="fork-wheel" cx="34" cy="96" r="15" />
          <circle className="fork-wheel" cx="92" cy="98" r="12" />
        </svg>
      </div>

      {/* Activity pips rising as stock is handled */}
      {range(3).map((index) => (
        <span key={`pip-${index}`} className="wh-pip" style={{ "--i": index } as Styled} />
      ))}
    </div>
  );
}

// ---- Last-mile dispatch: a truck driving, world scrolling behind it ----------

function TruckScene({ intensity }: { intensity: number }) {
  const road = (7 - Math.min(5, intensity)) * 0.18; // lane-dash scroll seconds
  const skyline = 9 - Math.min(5, intensity); // skyline scroll seconds
  return (
    <div className="truck-scene" aria-hidden="true">
      <div className="ts-sky" />
      <div className="ts-skyline" style={{ "--dur": `${skyline}s` } as Styled} />
      <div className="ts-road">
        <span className="ts-lane" style={{ "--dur": `${road}s` } as Styled} />
      </div>
      {range(3).map((index) => (
        <span key={`speed-${index}`} className="ts-speed" style={{ "--i": index } as Styled} />
      ))}
      <div className="truck">
        <svg viewBox="0 0 240 120" className="truck-svg" role="img" aria-label="Delivery truck">
          <rect className="truck-box" x="16" y="26" width="124" height="60" rx="5" />
          <line className="truck-seam" x1="46" y1="26" x2="46" y2="86" />
          <line className="truck-seam" x1="80" y1="26" x2="80" y2="86" />
          <line className="truck-seam" x1="114" y1="26" x2="114" y2="86" />
          <path className="truck-cab" d="M140 44 L176 44 L196 64 L196 86 L140 86 Z" />
          <rect className="truck-window" x="150" y="50" width="26" height="18" rx="2" />
          <circle className="truck-light" cx="192" cy="80" r="3.4" />
          <rect className="truck-bumper" x="14" y="86" width="184" height="8" rx="3" />
          <g className="truck-wheel">
            <circle className="tyre" cx="58" cy="96" r="17" />
            <circle className="hub" cx="58" cy="96" r="6.5" />
            <line className="spoke" x1="58" y1="83" x2="58" y2="109" />
            <line className="spoke" x1="45" y1="96" x2="71" y2="96" />
          </g>
          <g className="truck-wheel">
            <circle className="tyre" cx="160" cy="96" r="17" />
            <circle className="hub" cx="160" cy="96" r="6.5" />
            <line className="spoke" x1="160" y1="83" x2="160" y2="109" />
            <line className="spoke" x1="147" y1="96" x2="173" y2="96" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export function FlowScene({ spec, reduced }: { spec: SceneSpec; reduced: boolean }) {
  const Icon = ICON[spec.kind];
  return (
    <figure className={`scene scene-${spec.kind}${reduced ? " is-static" : ""}`} aria-label={spec.caption}>
      <div className="scene-stage">
        {spec.kind === "air" ? <AirScene intensity={spec.intensity} /> : null}
        {spec.kind === "warehouse" ? <WarehouseScene intensity={spec.intensity} /> : null}
        {spec.kind === "truck" ? <TruckScene intensity={spec.intensity} /> : null}
      </div>

      <figcaption className="scene-hud">
        <div className="scene-hud-row">
          <span className="scene-concept" title={spec.technique}>
            <Icon size={13} aria-hidden="true" />
            {spec.concept}
          </span>
          <ul className="scene-stats">
            {spec.stats.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="scene-cap">{spec.caption}</p>
      </figcaption>
    </figure>
  );
}
