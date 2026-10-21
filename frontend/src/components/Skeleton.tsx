// Reusable shimmer skeleton (Phase 7G). A calm placeholder for rows that are
// still loading, so a screen reads as "filling in" rather than blank or broken.
// The shimmer is pure CSS (.skeleton) and is disabled under prefers-reduced-
// motion. Sizing is caller-controlled via style/width/height.

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

export function Skeleton({ width, height, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{
        display: "block",
        width: width ?? "100%",
        height: height ?? 12,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

// A small stack of shimmer lines — the common "list is loading" placeholder.
export function SkeletonLines({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={`skeleton-group${className ? ` ${className}` : ""}`} role="status" aria-label="Loading">
      {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
        <Skeleton
          key={index}
          className="skeleton-line"
          width={index === rows - 1 ? "68%" : "100%"}
        />
      ))}
    </div>
  );
}
