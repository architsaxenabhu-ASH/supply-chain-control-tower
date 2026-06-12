import { useMemo } from "react";

// Contribution donut (Phase 5C reference pattern). Pure SVG, no chart library.

const DONUT_COLORS = [
  "var(--country-accent)",
  "var(--tower-emerald, #34d399)",
  "var(--tower-amber, #fbbf24)",
  "#8b7cf6",
  "var(--tower-cyan, #38bdf8)",
  "var(--tower-crimson, #f87171)",
];

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type DonutSlice = { label: string; value: number };

export function DonutChart({
  slices,
  centerLabel,
  formatValue,
  maxSlices = 5,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  formatValue: (value: number) => string;
  maxSlices?: number;
}) {
  const { segments, total } = useMemo(() => {
    const positive = slices
      .filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
      .sort((a, b) => b.value - a.value);
    const head = positive.slice(0, maxSlices);
    const rest = positive.slice(maxSlices);
    const restTotal = rest.reduce((sum, slice) => sum + slice.value, 0);
    const grouped = restTotal > 0 ? [...head, { label: `Other (${rest.length})`, value: restTotal }] : head;
    const sum = grouped.reduce((acc, slice) => acc + slice.value, 0);
    let offset = 0;
    const segments = grouped.map((slice, index) => {
      const length = sum > 0 ? (slice.value / sum) * CIRCUMFERENCE : 0;
      const segment = {
        ...slice,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
        length,
        offset,
        share: sum > 0 ? Math.round((slice.value / sum) * 100) : 0,
      };
      offset += length;
      return segment;
    });
    return { segments, total: sum };
  }, [slices, maxSlices]);

  if (total <= 0) {
    return <p className="empty-state">Nothing to chart yet — values appear as soon as data exists.</p>;
  }

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 132 132" role="img" aria-label={centerLabel}>
        <circle className="donut-track" cx="66" cy="66" r={RADIUS} />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            className="donut-segment"
            cx="66"
            cy="66"
            r={RADIUS}
            stroke={segment.color}
            strokeDasharray={`${Math.max(segment.length - 2, 0.5)} ${CIRCUMFERENCE - Math.max(segment.length - 2, 0.5)}`}
            strokeDashoffset={-segment.offset}
          >
            <title>{`${segment.label} — ${formatValue(segment.value)} (${segment.share}%)`}</title>
          </circle>
        ))}
        <text className="donut-center-value" x="66" y="63" textAnchor="middle">
          {formatValue(total)}
        </text>
        <text className="donut-center-label" x="66" y="79" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>
      <ul className="donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className="seg-dot" style={{ background: segment.color }} aria-hidden="true" />
            <span className="donut-legend-label">{segment.label}</span>
            <strong>{formatValue(segment.value)}</strong>
            <small>{segment.share}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
