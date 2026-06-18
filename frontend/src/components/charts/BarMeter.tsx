// Ranked horizontal bar list (Phase 7B). Plain HTML/CSS — a label, a proportional
// bar, and the formatted value. Used for "top markets / top customers" rankings.

export type BarRow = { label: string; sub?: string; value: number; display?: string };

export function BarMeter({
  rows,
  format,
}: {
  rows: BarRow[];
  format: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return <p className="empty-state">No ranking to show yet.</p>;
  }

  return (
    <ul className="barmeter">
      {rows.map((row, index) => (
        <li className="barmeter-row" key={row.label}>
          <div className="barmeter-head">
            <span className="barmeter-rank">{index + 1}</span>
            <span className="barmeter-label">{row.label}</span>
            <strong className="barmeter-value">{row.display ?? format(row.value)}</strong>
          </div>
          <div className="barmeter-track">
            <span
              className={`barmeter-fill${index === 0 ? " is-top" : ""}`}
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
          {row.sub ? <span className="barmeter-sub">{row.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}
