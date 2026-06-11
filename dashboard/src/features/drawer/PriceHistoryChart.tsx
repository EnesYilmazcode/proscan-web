// Price history chart — loaded via React.lazy from HistoryDrawer so the
// Recharts bundle stays out of the main chunk. Solid ink line = observed
// price; dashed muted line = median offer on spread days; gold dot = the
// latest priced observation. Money is cents in, lib/format.money out; all
// colors are tokens.css custom properties (var() resolves in SVG
// presentation attributes).

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { money, shortDate } from '../../lib/format';
import './drawer.css';

export interface PriceChartPoint {
  /** dayKey 'YYYY-MM-DD' (ascending) */
  day: string;
  /** observed price ¢ */
  p?: number;
  /** median offer ¢ (spread days only) */
  md?: number;
}

const SERIES_NAMES: Record<string, string> = { p: 'Price', md: 'Median' };

function ChartTip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((entry) => typeof entry.value === 'number');
  if (rows.length === 0) return null;
  return (
    <div className="hd-tip">
      <div className="hd-tip__day mono">{shortDate(String(label))}</div>
      {rows.map((entry) => (
        <div className="hd-tip__row" key={String(entry.dataKey)}>
          <span>{SERIES_NAMES[String(entry.dataKey)] ?? String(entry.dataKey)}</span>
          <span className="mono">{money(entry.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

const TICK_STYLE = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  fill: 'var(--muted)',
} as const;

export default function PriceHistoryChart({ data }: { data: PriceChartPoint[] }) {
  // Latest priced observation gets the signature gold dot.
  let latest: { day: string; p: number } | null = null;
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const point = data[i];
    if (point && typeof point.p === 'number') {
      latest = { day: point.day, p: point.p };
      break;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={{ stroke: 'var(--line)' }}
          tickFormatter={(value) => shortDate(String(value))}
          minTickGap={28}
        />
        <YAxis
          width={56}
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(value) => money(Math.round(Number(value)))}
        />
        <Tooltip
          content={ChartTip}
          cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
          isAnimationActive={false}
        />
        <Line
          dataKey="md"
          type="monotone"
          stroke="var(--muted)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          activeDot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey="p"
          type="monotone"
          stroke="var(--ink)"
          strokeWidth={1.75}
          dot={false}
          activeDot={{ r: 3, fill: 'var(--gold)', stroke: 'var(--ink)', strokeWidth: 1 }}
          connectNulls
          isAnimationActive={false}
        />
        {latest ? (
          <ReferenceDot
            x={latest.day}
            y={latest.p}
            r={4}
            fill="var(--gold)"
            stroke="var(--ink)"
            strokeWidth={1}
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
