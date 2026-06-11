// Delta-board columns — TanStack Table v8 column defs + cell renderers.
// Buyer semantics throughout (DeltaBadge owns the coloring): price DROP =
// green opportunity. Absent delta/spread/scores render em-dashes, never
// NaN. All numerals are Spline Sans Mono via the global .mono utility or
// the shared MoneyCell / DeltaBadge components.

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import Chip from '../../components/Chip';
import Tag from '../../components/Tag';
import MoneyCell from '../../components/MoneyCell';
import DeltaBadge from '../../components/DeltaBadge';
import { compactNumber, money, pct } from '../../lib/format';
import { LEAD_STAGES, type LeadStage, type Product } from '../../lib/types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** th/td modifier class (e.g. right alignment). */
    className?: string;
    /** Fixed <col> width in px; omit to let the column flex. */
    width?: number;
  }
}

const MAX_TAGS_SHOWN = 2;
const COPIED_MS = 1400;

/* ── small shared bits ──────────────────────────────────────────── */

function Dash() {
  return <span className="board-dim mono">—</span>;
}

/** Click-to-copy ASIN — small mono under the product name. */
function AsinCopy({ asin }: { asin: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // never open the drawer from a copy click
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(asin)
      .then(() => {
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          setCopied(false);
        }, COPIED_MS);
      })
      .catch(() => {
        /* clipboard denied — ignore */
      });
  };

  return (
    <button
      type="button"
      className={copied ? 'board-asin board-asin--copied' : 'board-asin'}
      onClick={copy}
      title={copied ? 'Copied' : 'Copy ASIN'}
      aria-label={`Copy ASIN ${asin}`}
    >
      {asin}
      {copied ? ' ✓' : ''}
    </button>
  );
}

/* ── cell renderers ─────────────────────────────────────────────── */

function ProductCell({ p }: { p: Product }) {
  return (
    <div className="board-prod">
      {p.img ? (
        <img
          className="board-prod__img"
          src={p.img}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="board-prod__img board-prod__img--blank" aria-hidden="true" />
      )}
      <div className="board-prod__text">
        <div className="board-prod__name" title={p.name ?? p.asin}>
          {p.name ?? <span className="board-dim">Unnamed product</span>}
        </div>
        <AsinCopy asin={p.asin} />
      </div>
    </div>
  );
}

function PriceCell({ p }: { p: Product }) {
  const cur = p.latest?.p;
  const lp = p.latest?.lp;
  return (
    <span className="board-price">
      <MoneyCell cents={cur} strong />
      {cur !== undefined && lp !== undefined && lp > cur ? (
        <s className="board-price__list" title={`List price ${money(lp)}`}>
          {money(lp)}
        </s>
      ) : null}
    </span>
  );
}

function RatingCell({ p }: { p: Product }) {
  const r = p.latest?.r;
  const dr = p.delta?.r;
  return (
    <span className="board-pair">
      <span className="mono">{r === undefined ? '—' : r.toFixed(1)}</span>
      {dr !== undefined && dr !== 0 ? <DeltaBadge value={dr} kind="rating" /> : null}
    </span>
  );
}

function ReviewsCell({ p }: { p: Product }) {
  const v = p.latest?.v;
  const dv = p.delta?.v;
  return (
    <span className="board-pair">
      <span className="mono">{compactNumber(v)}</span>
      {dv !== undefined && dv !== 0 ? <DeltaBadge value={dv} kind="reviews" /> : null}
    </span>
  );
}

function RankCell({ p }: { p: Product }) {
  const rk = p.latest?.rk;
  if (rk === undefined) return <Dash />;
  return <span className="mono">#{rk}</span>;
}

/** "{sc} sellers · {md} md · {cv}% cv" — muted mono; em-dash when absent. */
function SpreadCell({ p }: { p: Product }) {
  const s = p.spread;
  const parts: string[] = [];
  if (s?.sc !== undefined) parts.push(`${s.sc} sellers`);
  if (s?.md !== undefined) parts.push(`${money(s.md)} md`);
  if (s?.cv !== undefined) parts.push(`${pct(s.cv * 100, { digits: 0 })} cv`);
  if (parts.length === 0) return <Dash />;
  const detail = [
    s?.mn !== undefined ? `min ${money(s.mn)}` : null,
    s?.md !== undefined ? `median ${money(s.md)}` : null,
    s?.mx !== undefined ? `max ${money(s.mx)}` : null,
    s?.oc !== undefined ? `${s.oc} offers` : null,
    s?.fba !== undefined ? `${s.fba} FBA` : null,
    s?.az ? 'Amazon on listing' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="mono board-dim" title={detail || undefined}>
      {parts.join(' · ')}
    </span>
  );
}

/** Signature element: gold-bordered Max Buy pill. */
function MaxBuyCell({ p }: { p: Product }) {
  const mb = p.scores?.maxBuy;
  if (mb === undefined) return <Dash />;
  return (
    <span className="maxbuy" title={`Buy below ${money(mb)} to clear target ROI`}>
      MAX BUY {money(mb)}
    </span>
  );
}

const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  approved: 'Approved',
  purchased: 'Purchased',
  rejected: 'Rejected',
  archived: 'Archived',
};

const STAGE_TONE: Record<LeadStage, 'neutral' | 'gold' | 'green' | 'red'> = {
  new: 'neutral',
  reviewing: 'gold',
  approved: 'green',
  purchased: 'green',
  rejected: 'red',
  archived: 'neutral',
};

function StageCell({ p }: { p: Product }) {
  const stage = p.lead?.stage;
  if (!stage) return <Dash />;
  return <Chip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Chip>;
}

function TagsCell({ p }: { p: Product }) {
  const tags = p.tags ?? [];
  if (tags.length === 0) return <Dash />;
  return (
    <span className="board-tags">
      {tags.slice(0, MAX_TAGS_SHOWN).map((t) => (
        <Tag key={t} label={t} />
      ))}
      {tags.length > MAX_TAGS_SHOWN ? (
        <span
          className="board-tags-more"
          title={tags.slice(MAX_TAGS_SHOWN).join(', ')}
        >
          +{tags.length - MAX_TAGS_SHOWN}
        </span>
      ) : null}
    </span>
  );
}

/* ── column definitions ─────────────────────────────────────────── */

/** Client-side sortable columns over the loaded set. `sortUndefined: 'last'`
 *  keeps absent values (no delta / spread / scores) at the bottom. */
export const boardColumns: ColumnDef<Product>[] = [
  {
    id: 'product',
    header: 'Product',
    accessorFn: (p) => (p.name ?? p.asin).toLowerCase(),
    sortDescFirst: false,
    cell: ({ row }) => <ProductCell p={row.original} />,
  },
  {
    id: 'price',
    header: 'Price',
    accessorFn: (p) => p.latest?.p,
    sortUndefined: 'last',
    sortDescFirst: true,
    meta: { className: 'board-cell--num', width: 110 },
    cell: ({ row }) => <PriceCell p={row.original} />,
  },
  {
    id: 'deltaP',
    header: 'Δ Price',
    accessorFn: (p) => p.delta?.pPct,
    sortUndefined: 'last',
    // Ascending first: most-negative %, i.e. biggest drop = best buy, on top.
    sortDescFirst: false,
    meta: { className: 'board-cell--num', width: 124 },
    cell: ({ row }) => (
      <DeltaBadge
        value={row.original.delta?.p}
        pct={row.original.delta?.pPct}
        kind="price"
      />
    ),
  },
  {
    id: 'rating',
    header: 'Rating',
    accessorFn: (p) => p.latest?.r,
    sortUndefined: 'last',
    sortDescFirst: true,
    meta: { className: 'board-cell--num', width: 92 },
    cell: ({ row }) => <RatingCell p={row.original} />,
  },
  {
    id: 'reviews',
    header: 'Reviews',
    accessorFn: (p) => p.latest?.v,
    sortUndefined: 'last',
    sortDescFirst: true,
    meta: { className: 'board-cell--num', width: 104 },
    cell: ({ row }) => <ReviewsCell p={row.original} />,
  },
  {
    id: 'rank',
    header: 'Rank',
    accessorFn: (p) => p.latest?.rk,
    sortUndefined: 'last',
    sortDescFirst: false, // rank #1 is best
    meta: { className: 'board-cell--num', width: 64 },
    cell: ({ row }) => <RankCell p={row.original} />,
  },
  {
    id: 'spread',
    header: 'Spread',
    accessorFn: (p) => p.spread?.md,
    sortUndefined: 'last',
    sortDescFirst: true,
    meta: { width: 200 },
    cell: ({ row }) => <SpreadCell p={row.original} />,
  },
  {
    id: 'maxBuy',
    header: 'Max Buy',
    accessorFn: (p) => p.scores?.maxBuy,
    sortUndefined: 'last',
    sortDescFirst: true,
    meta: { width: 150 },
    cell: ({ row }) => <MaxBuyCell p={row.original} />,
  },
  {
    id: 'stage',
    header: 'Stage',
    accessorFn: (p) => {
      const s = p.lead?.stage;
      return s ? LEAD_STAGES.indexOf(s) : undefined;
    },
    sortUndefined: 'last',
    sortDescFirst: false, // pipeline order: new -> ... -> archived
    meta: { width: 100 },
    cell: ({ row }) => <StageCell p={row.original} />,
  },
  {
    id: 'tags',
    header: 'Tags',
    enableSorting: false,
    meta: { width: 140 },
    cell: ({ row }) => <TagsCell p={row.original} />,
  },
];
