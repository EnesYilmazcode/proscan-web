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
// Search, sorting and the movers' has-delta filter are client-side over
// the loaded set only.

import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useSnapshotQuery, useWorkspace } from '../lib/hooks';
import {
  productsBySource,
  recentProducts,
  sources as sourcesQuery,
  topMovers,
} from '../lib/queries';
import type { Product } from '../lib/types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import HistoryDrawer from '../features/drawer/HistoryDrawer';
import { CWS_URL } from '../auth/SignIn';
import BoardToolbar, {
  sourceLabel,
  type BoardView,
} from '../features/board/BoardToolbar';
import BoardTable from '../features/board/BoardTable';
import { boardColumns } from '../features/board/columns';
import '../features/board/board.css';

function countLabel(visible: number, total: number): string {
  const noun = total === 1 ? 'product' : 'products';
  return visible === total ? `${total} ${noun}` : `${visible} of ${total} ${noun}`;
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

  const products = useSnapshotQuery<Product>(
    () => {
      if (!wid) return null;
      if (view === 'movers') return topMovers(wid, 100);
      if (sourceId) return productsBySource(wid, sourceId, 500);
      return recentProducts(wid, 300);
    },
    [wid, view, sourceId],
    view === 'movers' ? 'board:movers' : sourceId ? 'board:by-source' : 'board:recent',
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

  const table = useReactTable({
    data: rows,
    columns: boardColumns,
    state: { sorting },
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
        countLabel(rows.length, scopedRows.length),
        view === 'movers' ? 'biggest price drops first' : 'latest observations',
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
      <EmptyState
        title="Couldn't load the board"
        body="The products listener failed — check your connection and reload."
      />
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
