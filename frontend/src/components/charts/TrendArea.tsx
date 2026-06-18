import { useId, useMemo, useRef, useState } from "react";

// Trend area chart (Phase 7B). A primary series as a gradient area + line, with
// a lighter dashed overlay (e.g. a 4-week moving average) for context. Hovering
// reveals a crosshair with the exact week and value. Pure SVG, themed; strokes
// are non-scaling so the plot stretches to any width while staying crisp.

export type TrendPoint = { label: string; value: number; value2?: number };

const W = 600;
const H = 200;
const PAD_T = 14;
const PAD_B = 10;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export function TrendArea({
  series,
  format,
  legend,
  height = 200,
}: {
  series: TrendPoint[];
  format: (value: number) => string;
  legend: [string, string];
  height?: number;
}) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const primary = series.map((point) => point.value);
    const overlay = series.map((point) => point.value2 ?? point.value);
    const max = Math.max(1, ...primary, ...overlay);
    const n = series.length;
    const x = (index: number) => (n > 1 ? (index / (n - 1)) * W : 0);
    const y = (value: number) => PAD_T + (1 - value / max) * (H - PAD_T - PAD_B);

    const xs = primary.map((_, index) => x(index));
    const ysPrimary = primary.map((value) => y(value));
    const lineFor = (values: number[]) =>
      values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");

    const mainLine = lineFor(primary);
    const overlayLine = lineFor(overlay);
    const area = `${mainLine} L ${W} ${H - PAD_B} L 0 ${H - PAD_B} Z`;
    const gridYs = [0, max / 2, max].map((value) => ({ value, y: y(value) }));
    const last = { x: x(n - 1), y: y(primary[n - 1] ?? 0) };
    return { mainLine, overlayLine, area, gridYs, last, xs, ysPrimary, max };
  }, [series]);

  function onMove(event: React.MouseEvent) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || series.length < 2) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setHover(clamp(Math.round(ratio * (series.length - 1)), 0, series.length - 1));
  }

  const point = hover != null ? series[hover] : null;
  const guideX = hover != null ? model.xs[hover] : 0;
  const leftPct = series.length > 1 && hover != null ? clamp((hover / (series.length - 1)) * 100, 7, 93) : 0;

  return (
    <div className="trend">
      <div
        className="trend-plot"
        ref={plotRef}
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Trend over the last 12 weeks">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--country-accent)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--country-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {model.gridYs.map((grid, index) => (
            <line key={index} className="trend-grid" x1="0" x2={W} y1={grid.y} y2={grid.y} vectorEffect="non-scaling-stroke" />
          ))}
          <path className="trend-area" d={model.area} fill={`url(#${gradientId})`} />
          <path className="trend-overlay" d={model.overlayLine} fill="none" vectorEffect="non-scaling-stroke" />
          <path className="trend-line" d={model.mainLine} fill="none" vectorEffect="non-scaling-stroke" />
          {hover != null ? (
            <>
              <line className="trend-guide" x1={guideX} x2={guideX} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
              <circle className="trend-hot" cx={guideX} cy={model.ysPrimary[hover]} r={4} />
            </>
          ) : null}
          <circle className="trend-last" cx={model.last.x} cy={model.last.y} r={3.4} />
        </svg>
        <div className="trend-ymax">{format(model.max)}</div>
        {point ? (
          <div className="trend-tip" style={{ left: `${leftPct}%` }}>
            <strong>{format(point.value)}</strong>
            <span>{point.label}</span>
          </div>
        ) : null}
      </div>
      <div className="trend-x">
        {series.map((entry, index) => (
          <span key={entry.label} className={index % 3 === 0 || index === series.length - 1 ? "" : "is-hidden"}>
            {entry.label}
          </span>
        ))}
      </div>
      <div className="trend-legend">
        <span className="trend-legend-item">
          <span className="trend-swatch trend-swatch-line" aria-hidden="true" />
          {legend[0]}
        </span>
        <span className="trend-legend-item">
          <span className="trend-swatch trend-swatch-dash" aria-hidden="true" />
          {legend[1]}
        </span>
      </div>
    </div>
  );
}
