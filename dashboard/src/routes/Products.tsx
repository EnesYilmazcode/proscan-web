// Delta Board (MVP features 3+4) — the core products screen, the
// Excel-killer. URL contract (FROZEN): ?source=<sourceId> scopes the board
// to one source; ?asin=<asin> opens the HistoryDrawer.
//
// Reads (docs/ops/billing-runbook.md):
//   latest -> productsBySource / recentProducts, 200 at a time: the first
//             page is live, "Load more" pages on with a cursor (F-45)
//   total  -> getCountFromServer on the same query, so the header always
//             says how many there are, not how many are loaded
//   movers -> each source's latest two runs and their page chunks
//             (lib/movers.ts): price changes run against run, per source
// plus the sanctioned tiny sources listener for the scope dropdown. With a
// source in scope, Latest also shows deltas against that source's previous
// run. An exact ASIN in the search box is looked up directly.

import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useDocOnce, useServerCount, useSnapshotQuery, useWorkspace } from '../lib/hooks';
import { fetchAll, usePagedQuery, PAGE_SIZE } from '../lib/paging';
import { reportError } from '../lib/errors';
import {
  productRef,
  productsBySource,
  recentProducts,
  sources as sourcesQuery,
} from '../lib/queries';
import { asSeenBy } from '../lib/compare';
import { MOVERS_SHOWN, moverSources, useMoverRows, useSourceComparisons } from '../lib/movers';
import { ASIN_RE } from '../../../packages/schema/index.js';
import type { Product } from '../lib/types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SchemaNotice from '../components/SchemaNotice';
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
import { sortRows } from '../features/board/sortRows';
import '../features/board/board.css';

const fmt = (n: number) => n.toLocaleString('en-US');

/** Header count: how many there are, and how many of them are loaded. */
export function countLabel(
  visible: number,
  loaded: number,
  total: number | null,
  searching: boolean,
): string {
  const noun = (n: number) => (n === 1 ? 'product' : 'products');
  const all = total !== null && loaded >= total;
  if (searching) {
    const scope = all ? fmt(loaded) : `${fmt(loaded)} loaded`;
    return `${fmt(visible)} ${visible === 1 ? 'match' : 'matches'} in ${scope} ${noun(loaded)}`;
  }
  if (all || total === null) return `${fmt(total ?? loaded)} ${noun(total ?? loaded)}`;
  return `${fmt(loaded)} of ${fmt(total)} ${noun(total)} loaded`;
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

  const scopeQuery = () => {
    if (!wid) return null;
    return sourceId ? productsBySource(wid, sourceId, null) : recentProducts(wid, null);
  };

  const latest = usePagedQuery<Product>(
    () => (view === 'latest' ? scopeQuery() : null),
    [wid, view, sourceId],
    (p) => p.asin,
  );
  const total = useServerCount(() => (view === 'latest' ? scopeQuery() : null), [wid, view, sourceId]);

  const sourcesState = useSnapshotQuery(
    () => (wid ? sourcesQuery(wid) : null),
    [wid],
    'board:sources',
  );

  // Which sources to compare run against run: the one in scope, or for
  // Movers across all sources the most recently scanned ones.
  const compareIds = useMemo(() => {
    if (view === 'movers') {
      if (!sourceId && sourcesState.loading) return null;
      return moverSources(sourceId, sourcesState.data);
    }
    return sourceId ? [sourceId] : null;
  }, [view, sourceId, sourcesState.loading, sourcesState.data]);
  const comparisons = useSourceComparisons(wid, compareIds);
  const movers = useMoverRows(view === 'movers' ? wid : null, comparisons);

  // In a source's scope, Latest shows each product as that source's last
  // run saw it, with the delta against the run before.
  const overlay = view === 'latest' && sourceId ? comparisons.data[0] : undefined;
  const latestRows = useMemo(() => {
    if (!overlay) return latest.data;
    return latest.data.map((p) => {
      const cmp = overlay.byAsin.get(p.asin);
      return cmp ? asSeenBy(p, cmp, overlay.latest) : p;
    });
  }, [latest.data, overlay]);

  const scopedRows = view === 'movers' ? movers.data.rows : latestRows;
  const loaded = scopedRows;
  const state =
    view === 'movers'
      ? movers
      : {
          ...latest,
          loading: latest.loading || (sourceId !== null && comparisons.loading),
          error: latest.error ?? comparisons.error,
          invalid: [...latest.invalid, ...comparisons.invalid],
        };

  // An exact ASIN is read directly, so search reaches past the loaded pages.
  const query = search.trim().toLowerCase();
  const exactAsin = ASIN_RE.test(search.trim().toUpperCase()) ? search.trim().toUpperCase() : null;
  const exactRef = useMemo(
    () => (wid && exactAsin ? productRef(wid, exactAsin) : null),
    [wid, exactAsin],
  );
  const exact = useDocOnce(exactRef);

  const rows = useMemo(() => {
    if (!query) return scopedRows;
    const hits = scopedRows.filter(
      (p) =>
        p.asin.toLowerCase().includes(query) ||
        (p.name ?? '').toLowerCase().includes(query),
    );
    const found = exact.data;
    const inScope = found && (!sourceId || found.sourceIds?.includes(sourceId));
    if (found && inScope && !hits.some((p) => p.asin === found.asin)) return [found, ...hits];
    return hits;
  }, [scopedRows, query, exact.data, sourceId]);

  const columnVisibility = useMemo(() => dataColumnVisibility(loaded), [loaded]);

  const table = useReactTable({
    data: rows,
    columns: boardColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (p) => p.asin,
  });

  // Export writes the whole scope, not the loaded pages: every product,
  // searched and sorted like the table. Movers are all loaded already.
  const matches = (p: Product) =>
    !query || p.asin.toLowerCase().includes(query) || (p.name ?? '').toLowerCase().includes(query);
  const exportLoad = async (onProgress: (n: number) => void): Promise<Product[]> => {
    const base = scopeQuery();
    if (view === 'movers' || !base || !latest.hasMore) return table.getRowModel().rows.map((r) => r.original);
    const { rows: all, invalid } = await fetchAll(base, onProgress);
    if (invalid.length > 0) {
      reportError('export some rows', new Error(`${invalid.length} failed the schema check and were left out`));
    }
    const seen = overlay
      ? all.map((p) => {
          const cmp = overlay.byAsin.get(p.asin);
          return cmp ? asSeenBy(p, cmp, overlay.latest) : p;
        })
      : all;
    return sortRows(seen.filter(matches), sorting);
  };
  const exportCount = view === 'movers' || !latest.hasMore ? rows.length : query ? null : total;

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

  const loading = !wid || state.loading;

  const moversLine = () => {
    const { found, compared } = movers.data;
    const n = found > MOVERS_SHOWN ? `top ${fmt(MOVERS_SHOWN)} of ${fmt(found)} movers` : `${fmt(found)} ${found === 1 ? 'mover' : 'movers'}`;
    const only = compared.length === 1 ? compared[0] : null;
    if (only) {
      return only.prev
        ? `${n} · run of ${only.latest.dayKey} against ${only.prev.dayKey}`
        : `${n} · only one run so far`;
    }
    return `${n} across ${compared.length} ${compared.length === 1 ? 'source' : 'sources'}, each run against the one before`;
  };

  const subtitle = loading
    ? 'Loading the board…'
    : [
        view === 'movers' ? moversLine() : countLabel(rows.length, scopedRows.length, total, query !== ''),
        view === 'movers'
          ? 'biggest price drops first'
          : overlay?.prev
            ? `deltas against the run of ${overlay.prev.dayKey}`
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
  } else if (state.error) {
    body = (
      <ErrorState title="Couldn't load the board" error={state.error} />
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
        body={
          latest.hasMore && view === 'latest'
            ? `Nothing in the ${fmt(scopedRows.length)} loaded products matches "${search.trim()}". Load more, or search an exact ASIN.`
            : `Nothing matches "${search.trim()}".`
        }
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

  const showMore = view === 'latest' && !loading && !state.error && latest.hasMore;

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
            exportLoad={exportLoad}
            exportCount={exportCount}
          />
        }
      />
      <SchemaNotice invalid={[...state.invalid, ...sourcesState.invalid]} />
      {body}
      {showMore ? (
        <div className="board-more">
          <Button variant="ghost" onClick={latest.loadMore} disabled={latest.loadingMore}>
            {latest.loadingMore ? 'Loading…' : `Load ${fmt(PAGE_SIZE)} more`}
          </Button>
          <span className="board-more__count mono">
            {total !== null
              ? `${fmt(latest.data.length)} of ${fmt(total)} loaded`
              : `${fmt(latest.data.length)} loaded`}
          </span>
        </div>
      ) : null}
      {asin && wid ? (
        <HistoryDrawer wid={wid} asin={asin} onClose={closeDrawer} />
      ) : null}
    </>
  );
}
