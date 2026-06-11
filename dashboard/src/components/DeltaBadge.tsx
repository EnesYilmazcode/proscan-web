import { clsx } from 'clsx';
import { compactNumber, money, pct } from '../lib/format';
import './components.css';

export interface DeltaBadgeProps {
  /** The signed change. Price: cents. Rating: stars. Reviews: count. */
  value: number | null | undefined;
  /** Optional percent change (e.g. delta.pPct for price). */
  pct?: number;
  kind: 'price' | 'rating' | 'reviews';
}

/** BUYER-semantics legend used in the title tooltip on every badge. */
export const BUYER_SEMANTICS_LEGEND =
  'Buyer view: price drops are buying opportunities (green); price rises are red. Rating and review growth are green.';

/** Delta chip in mono, buyer's perspective: a price DROP is an opportunity
 *  (green, ▼); a price RISE is red (▲). Rating/review increases are green.
 *  Form: "▼ $2.00 · 7.7%". */
export default function DeltaBadge({ value, pct: pctValue, kind }: DeltaBadgeProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="delta delta--flat" title={BUYER_SEMANTICS_LEGEND}>
        —
      </span>
    );
  }

  const arrow = value < 0 ? '▼' : value > 0 ? '▲' : '·';
  // Buyer semantics: for price, DOWN is good; for rating/reviews, UP is good.
  const good = kind === 'price' ? value < 0 : value > 0;
  const toneClass = value === 0 ? 'delta--flat' : good ? 'delta--good' : 'delta--bad';

  const magnitude =
    kind === 'price'
      ? money(Math.abs(value))
      : kind === 'rating'
        ? Math.abs(value).toFixed(1)
        : compactNumber(Math.abs(value));

  const pctPart =
    pctValue !== undefined && !Number.isNaN(pctValue)
      ? ` · ${pct(Math.abs(pctValue))}`
      : '';

  return (
    <span className={clsx('delta', toneClass)} title={BUYER_SEMANTICS_LEGEND}>
      {value === 0 ? '· 0' : `${arrow} ${magnitude}${pctPart}`}
    </span>
  );
}
