// Delta-board toolbar — search-in-loaded-set, Latest|Movers segmented
// toggle (gold active), source scope dropdown (synced to ?source=), the
// buyer-semantics legend popover and the XLSX export of the currently
// visible sorted rows. Pure presentation: all state lives in the route.

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import Button from '../../components/Button';
import DeltaBadge, { BUYER_SEMANTICS_LEGEND } from '../../components/DeltaBadge';
import ExportButton from '../export/ExportButton';
import type { Product, Source } from '../../lib/types';
import './board.css';

export type BoardView = 'latest' | 'movers';

/** Human label for a source: nickname > sellerId > keyword > raw id. */
export function sourceLabel(s: Source): string {
  return s.nickname ?? s.sellerId ?? s.keyword ?? s.sourceId;
}

/** "▼ green = price dropped = buying opportunity" — the one-line buyer
 *  semantics explainer, demonstrated with real DeltaBadge chips. */
function LegendPopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (
        wrapRef.current &&
        e.target instanceof Node &&
        !wrapRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="board-legend" ref={wrapRef}>
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="What do the delta colors mean?"
      >
        Legend
      </Button>
      {open ? (
        <div className="board-legend__pop" role="dialog" aria-label="Delta color legend">
          <div className="board-legend__row">
            <DeltaBadge value={-200} pct={7.7} kind="price" />
            <span>price dropped = buying opportunity</span>
          </div>
          <div className="board-legend__row">
            <DeltaBadge value={110} pct={3.2} kind="price" />
            <span>price rose = worse buy</span>
          </div>
          <p className="board-legend__note">{BUYER_SEMANTICS_LEGEND}</p>
        </div>
      ) : null}
    </div>
  );
}

export interface BoardToolbarProps {
  search: string;
  onSearchChange: (q: string) => void;
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  /** Current ?source= scope (null = all sources). */
  sourceId: string | null;
  sources: Source[];
  onSourceChange: (sourceId: string | null) => void;
  /** Currently visible rows in sorted order — exactly what Export writes. */
  exportRows: Product[];
}

export default function BoardToolbar({
  search,
  onSearchChange,
  view,
  onViewChange,
  sourceId,
  sources,
  onSourceChange,
  exportRows,
}: BoardToolbarProps) {
  const options = [...sources].sort((a, b) =>
    sourceLabel(a).localeCompare(sourceLabel(b)),
  );
  // ?source= may point at a source the listener doesn't know (yet) —
  // keep the <select> truthful with a raw-id fallback option.
  const known = sourceId === null || sources.some((s) => s.sourceId === sourceId);

  return (
    <div className="board-toolbar">
      <input
        className="board-search"
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search name or ASIN"
        aria-label="Search loaded products by name or ASIN"
        spellCheck={false}
      />
      <div className="board-seg" aria-label="View mode">
        <button
          type="button"
          className={clsx('board-seg__btn', view === 'latest' && 'board-seg__btn--on')}
          aria-pressed={view === 'latest'}
          onClick={() => onViewChange('latest')}
        >
          Latest
        </button>
        <button
          type="button"
          className={clsx('board-seg__btn', view === 'movers' && 'board-seg__btn--on')}
          aria-pressed={view === 'movers'}
          title="Biggest price drops across all sources"
          onClick={() => onViewChange('movers')}
        >
          Movers
        </button>
      </div>
      <select
        className="board-select"
        value={sourceId ?? ''}
        onChange={(e) => onSourceChange(e.target.value === '' ? null : e.target.value)}
        aria-label="Scope the board to one source"
        title="Scope the board to one source"
      >
        <option value="">All sources</option>
        {!known && sourceId ? <option value={sourceId}>{sourceId}</option> : null}
        {options.map((s) => (
          <option key={s.sourceId} value={s.sourceId}>
            {sourceLabel(s)}
          </option>
        ))}
      </select>
      <LegendPopover />
      <ExportButton rows={exportRows} />
    </div>
  );
}
