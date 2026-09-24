// Delta Board (MVP features 3+4) — the core products screen, the
// Excel-killer. URL contract (FROZEN): ?source=<sourceId> scopes the board
// to one source; ?asin=<asin> opens the HistoryDrawer.
//
// Read hygiene (docs/ops/billing-runbook.md): exactly ONE scoped products
// listener at a time —
//   movers  -> topMovers(wid, 100)                 (global biggest drops)
//   source  -> productsBySource(wid, sourceId, 500)
//   default -> recentProducts(wid, 300)
// plus the sanctioned tiny sources listener for the scope dropdown.
// Search, sorting, export and the movers' has-delta filter are client-side
// over the loaded set only, so the header says when that set is capped and
// shows the server-side total (F-45). Real pagination lands in Phase 4.

import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useServerCount, useSnapshotQuery, useWorkspace } from '../lib/hooks';
import {
  productsBySource,
  recentProducts,
  sources as sourcesQuery,
  topMovers,
} from '../lib/queries';
import type { Product } from '../lib/types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import HistoryDrawer from '../features/drawer/HistoryDrawer';
import { CWS_URL } from '../auth/SignIn';
import BoardToolbar, {
  sourceLabel,
  type BoardView,
} from '../features/board/BoardToolbar';
import BoardTable from '../features/board/BoardTable';
import { boardColumns, dataColumnVisibility } from '../features/board/columns';
import '../features/board/board.css';

const LIMITS = { movers: 100, source: 500, recent: 300 } as const;

const fmt = (n: number) => n.toLocaleString('en-US');

/** Header count. Never presents a capped window as the whole workspace. */
function countLabel(
  visible: number,
  loaded: number,
  capped: boolean,
  total: number | null,
): string {
  const noun = loaded === 1 ? 'product' : 'products';
  if (!capped) {
    return visible === loaded ? `${fmt(loaded)} ${noun}` : `${fmt(visible)} of ${fmt(loaded)} ${noun}`;
  }
  const span =
    total !== null && total > loaded
      ? `first ${fmt(loaded)} of ${fmt(total)} ${noun}`
      : `first ${fmt(loaded)} ${noun}, more not loaded`;
  return visible === loaded ? `Showing the ${span}` : `${fmt(visible)} matches in the ${span}`;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { wid } = useWorkspace();

  // Board scope — the delta board filters by this source when present.
  const sourceId = searchParams.get('source');
  // Drawer target.
  const asin = searchParams.get('asin');

  const [view, setView] = useState<BoardView>('latest');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const limit =
    view === 'movers' ? LIMITS.movers : sourceId ? LIMITS.source : LIMITS.recent;

  const products = useSnapshotQuery<Product>(
    () => {
      if (!wid) return null;
      if (view === 'movers') return topMovers(wid, limit);
      if (sourceId) return productsBySource(wid, sourceId, limit);
      return recentProducts(wid, limit);
    },
    [wid, view, sourceId],
    view === 'movers' ? 'board:movers' : sourceId ? 'board:by-source' : 'board:recent',
  );

  // Only ask the server for a total once the window is actually full.
  const capped = products.data.length >= limit;
  const total = useServerCount(
    () => {
      if (!wid || !capped) return null;
      if (view === 'movers') return topMovers(wid, null);
      if (sourceId) return productsBySource(wid, sourceId, null);
      return recentProducts(wid, null);
    },
    [wid, view, sourceId, capped],
  );

  const sourcesState = useSnapshotQuery(
    () => (wid ? sourcesQuery(wid) : null),
    [wid],
    'board:sources',
  );

  // Movers shows only rows that actually carry a delta; a source scope in
  // movers view narrows client-side (the movers query is global).
  const scopedRows = useMemo(() => {
    if (view !== 'movers') return products.data;
    let list = products.data.filter(
      (p) => p.delta?.pPct !== undefined || p.delta?.p !== undefined,
    );
    if (sourceId) list = list.filter((p) => p.sourceIds?.includes(sourceId));
    return list;
  }, [products.data, view, sourceId]);

  // Search-in-loaded-set: name or ASIN, case-insensitive.
  const query = search.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!query) return scopedRows;
    return scopedRows.filter(
      (p) =>
        p.asin.toLowerCase().includes(query) ||
        (p.name ?? '').toLowerCase().includes(query),
    );
  }, [scopedRows, query]);

  const columnVisibility = useMemo(() => dataColumnVisibility(products.data), [products.data]);

  const table = useReactTable({
    data: rows,
    columns: boardColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (p) => p.asin,
  });

  // What the user currently sees, in sorted order — the export contract.
  const visibleSortedRows = table.getRowModel().rows.map((r) => r.original);

  /* ── URL writers ──────────────────────────────────────────────── */

  const openDrawer = (nextAsin: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('asin', nextAsin);
    setSearchParams(next);
  };

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('asin');
    setSearchParams(next, { replace: true });
  };

  const changeSource = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('source', id);
    else next.delete('source');
    setSearchParams(next, { replace: true });
  };

  /* ── header summary ───────────────────────────────────────────── */

  const sourceName = useMemo(() => {
    if (!sourceId) return null;
    const s = sourcesState.data.find((x) => x.sourceId === sourceId);
    return s ? sourceLabel(s) : sourceId;
  }, [sourceId, sourcesState.data]);

  const loading = !wid || products.loading;

  const subtitle = loading
    ? 'Loading the board…'
    : [
        countLabel(rows.length, scopedRows.length, capped && !(view === 'movers' && sourceId), total),
        view === 'movers'
          ? sourceId
            ? `biggest drops within the global top ${limit}`
            : 'biggest price drops first'
          : 'latest observations',
        sourceName ? `source: ${sourceName}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  /* ── body states ──────────────────────────────────────────────── */

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="board-card">
        <Skeleton variant="table-row" rows={8} />
      </div>
    );
  } else if (products.error) {
    body = (
      <ErrorState title="Couldn't load the board" error={products.error} />
    );
  } else if (scopedRows.length === 0) {
    if (view === 'movers') {
      body = (
        <EmptyState
          title="No movers yet"
          body="Price deltas appear once a source has been scanned at least twice — rescan a storefront and the biggest drops surface here."
          cta={
            <Button variant="ghost" onClick={() => setView('latest')}>
              Back to Latest
            </Button>
          }
        />
      );
    } else if (sourceId) {
      body = (
        <EmptyState
          title="Nothing from this source yet"
          body="Run a scan on this storefront or keyword from the extension — its products land here with buyer-side deltas."
          cta={
            <Button variant="ghost" onClick={() => changeSource(null)}>
              Show all sources
            </Button>
          }
        />
      );
    } else {
      body = (
        <EmptyState
          title="No scans yet"
          body="Run the ProScan extension on a storefront or keyword search — every product it sees lands here with price deltas from the buyer's side."
          cta={
            <Button onClick={() => window.open(CWS_URL, '_blank', 'noopener')}>
              Install the extension
            </Button>
          }
        />
      );
    }
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        title="No matches"
        body={`Nothing in the loaded set matches "${search.trim()}".`}
        cta={
          <Button variant="ghost" onClick={() => setSearch('')}>
            Clear search
          </Button>
        }
      />
    );
  } else {
    body = <BoardTable table={table} onOpen={openDrawer} />;
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={subtitle}
        actions={
          <BoardToolbar
            search={search}
            onSearchChange={setSearch}
            view={view}
            onViewChange={setView}
            sourceId={sourceId}
            sources={sourcesState.data}
            onSourceChange={changeSource}
            exportRows={visibleSortedRows}
          />
        }
      />
      {body}
      {asin && wid ? (
        <HistoryDrawer wid={wid} asin={asin} onClose={closeDrawer} />
      ) : null}
    </>
  );
}
