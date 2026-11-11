// Pagination over an ordered query. One live listener covers every page
// loaded so far (limit(size * pages)), so a scan that is syncing shows up
// without a reload and a row pushed down past a page boundary is never
// dropped between pages. "Load more" grows the listener by one page, which
// re-reads what is already loaded; that is the price of never losing rows.
// Nothing is ever capped silently: `hasMore` says when the server has more.

import { useEffect, useState, type DependencyList } from 'react';
import {
  getDocs,
  limit,
  onSnapshot,
  query,
  startAfter,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { splitChecked, type SchemaProblem } from './checked';

export const PAGE_SIZE = 200;

export interface PagedState<T> {
  data: T[];
  invalid: SchemaProblem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  /** Bumps on every server snapshot that changed documents. */
  changes: number;
}

interface Page<T> {
  rows: T[];
  invalid: SchemaProblem[];
  last: QueryDocumentSnapshot<T> | null;
  full: boolean;
}

function toPage<T>(docs: QueryDocumentSnapshot<T>[], size: number): Page<T> {
  const { valid, invalid } = splitChecked(docs.map((d) => d.data() as T & object));
  return { rows: valid, invalid, last: docs[docs.length - 1] ?? null, full: docs.length >= size };
}

const sameDeps = (a: DependencyList, b: DependencyList) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

interface Shown<T> extends Page<T> {
  deps: DependencyList;
  pages: number;
}

/** Pages through `queryFactory()` (ordered, no limit) `size` documents at a time. */
export function usePagedQuery<T>(
  queryFactory: () => Query<T> | null,
  deps: DependencyList,
  size: number = PAGE_SIZE,
): PagedState<T> {
  // Pages wanted for these deps; a deps change starts again at one page.
  const [grow, setGrow] = useState({ deps, pages: 1 });
  const pages = sameDeps(grow.deps, deps) ? grow.pages : 1;
  const [shownRaw, setShown] = useState<Shown<T> | null>(null);
  const shown = shownRaw && sameDeps(shownRaw.deps, deps) ? shownRaw : null;
  const [error, setError] = useState<{ deps: DependencyList; err: Error } | null>(null);
  const [changes, setChanges] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const q = queryFactory();
    setError(null);
    setActive(q !== null);
    if (!q) return;
    const want = size * pages;
    let fromServer = false;
    // Metadata changes too, so the server's answer arrives even when it
    // matches an empty cache (F-48). A grown listener also skips its cache
    // answer, which would briefly show fewer rows than were loaded.
    return onSnapshot(
      query(q, limit(want)),
      { includeMetadataChanges: true },
      (snap) => {
        const cached = snap.metadata.fromCache;
        if (cached && !fromServer && (snap.empty || pages > 1)) return;
        if (!cached) fromServer = true;
        setShown({ ...toPage(snap.docs, want), deps, pages });
        if (!cached && snap.docChanges().length > 0) setChanges((n) => n + 1);
      },
      (err) => {
        console.error('[proscan] paged query failed', err);
        setError({ deps, err });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pages, size]);

  const hasMore = !!shown && shown.full;
  const loadingMore = !!shown && shown.pages < pages;
  const loadMore = () => {
    if (hasMore && !loadingMore) setGrow({ deps, pages: pages + 1 });
  };
  const err = error && sameDeps(error.deps, deps) ? error.err : null;

  return {
    data: shown?.rows ?? [],
    invalid: shown?.invalid ?? [],
    loading: !err && active && shown === null,
    error: err,
    hasMore,
    loadingMore,
    loadMore,
    changes,
  };
}

/** The count to show for a paged list. When everything is loaded that is
 *  the loaded rows (invalid documents are reported apart). Otherwise it is
 *  the server count minus the invalid documents seen, and never below what
 *  is already on screen, since the count can lag a live sync. */
export function pagedTotal(state: PagedState<unknown>, serverCount: number | null): number | null {
  if (state.loading) return serverCount;
  if (!state.hasMore) return state.data.length;
  if (serverCount === null) return null;
  return Math.max(serverCount - state.invalid.length, state.data.length);
}

/** Every document of `q`, read `size` at a time with a cursor. For export. */
export async function fetchAll<T>(
  q: Query<T>,
  onProgress?: (loaded: number) => void,
  size = 500,
): Promise<{ rows: T[]; invalid: SchemaProblem[] }> {
  const rows: T[] = [];
  const invalid: SchemaProblem[] = [];
  let cursor: QueryDocumentSnapshot<T> | null = null;
  for (;;) {
    const page: Query<T> = cursor ? query(q, startAfter(cursor), limit(size)) : query(q, limit(size));
    const snap = await getDocs(page);
    const part: Page<T> = toPage(snap.docs, size);
    rows.push(...part.rows);
    invalid.push(...part.invalid);
    onProgress?.(rows.length);
    if (!part.full || !part.last) break;
    cursor = part.last;
  }
  return { rows, invalid };
}
