import { useId } from "react";

// Tiny trend line for KPI cards (Phase 7B). Pure SVG, themed by tone. The path
// stroke does not scale, so it stays crisp at any width.

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  good: "var(--tower-emerald, #34d399)",
  warn: "var(--tower-amber, #fbbf24)",
  bad: "var(--tower-crimson, #f87171)",
  neutral: "var(--country-accent)",
};

export function Sparkline({
  points,
  tone = "neutral",
  width = 132,
  height = 36,
}: {
  points: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const top = 3;
  const usable = height - top - 3;

  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = top + (1 - (value - min) / span) * usable;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${width.toFixed(1)} ${height} L 0 ${height} Z`;
  const color = TONE_COLOR[tone];
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      style={{ color }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
    </svg>
  );
}
