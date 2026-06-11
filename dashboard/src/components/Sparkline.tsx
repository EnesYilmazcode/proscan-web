export interface SparklinePoint {
  /** dayKey or any ordinal label — only the ORDER matters for x. */
  x: string;
  y: number;
}

export interface SparklineProps {
  points: SparklinePoint[];
  width?: number;
  height?: number;
  /** CSS color; defaults to the slate ink token. */
  stroke?: string;
}

/** Hand-rolled SVG sparkline: polyline + end dot, no chart deps.
 *  Renders nothing meaningful below 2 points (a flat dash). */
export default function Sparkline({
  points,
  width = 96,
  height = 28,
  stroke = 'var(--ink)',
}: SparklineProps) {
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;

  if (points.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
    const y = pad + h - ((p.y - min) / span) * h;
    return [x, y] as const;
  });

  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.25" fill="var(--gold)" stroke="none" />
    </svg>
  );
}
