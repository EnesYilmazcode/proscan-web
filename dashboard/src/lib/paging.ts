// Cursor pagination over an ordered query. The first page is a live
// listener, so a scan that is syncing shows up without a reload; each
// "load more" is a one-shot getDocs that starts after the last document
// already loaded. Nothing is ever capped silently: `hasMore` says when
// the server has more.

import { useCallback, useEffect, useMemo, useRef, useState, type DependencyList } from 'react';
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
import { reportError } from './errors';

export const PAGE_SIZE = 200;

export interface PagedState<T> {
  data: T[];
  invalid: SchemaProblem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
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

/**
 * Pages through `queryFactory()` (ordered, no limit) `size` documents at a
 * time. `keyOf` dedupes a row that moved from one page into another while
 * the live first page changed.
 */
export function usePagedQuery<T>(
  queryFactory: () => Query<T> | null,
  deps: DependencyList,
  keyOf: (row: T) => string,
  size: number = PAGE_SIZE,
): PagedState<T> {
  const [first, setFirst] = useState<Page<T> | null>(null);
  const [more, setMore] = useState<Page<T>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [active, setActive] = useState(true);
  const base = useRef<Query<T> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const q = queryFactory();
    base.current = q;
    generation.current++;
    setFirst(null);
    setMore([]);
    setError(null);
    setLoadingMore(false);
    setActive(q !== null);
    if (!q) return;
    return onSnapshot(
      query(q, limit(size)),
      (snap) => setFirst(toPage(snap.docs, size)),
      (err) => {
        console.error('[proscan] first page failed', err);
        setError(err);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const lastPage = more.length > 0 ? more[more.length - 1] : first;
  const hasMore = !!lastPage && lastPage.full;

  const loadMore = useCallback(() => {
    const q = base.current;
    if (!q || !lastPage?.last || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    getDocs(query(q, startAfter(lastPage.last), limit(size)))
      .then((snap) => {
        if (gen !== generation.current) return;
        setMore((pages) => [...pages, toPage(snap.docs, size)]);
      })
      .catch((err: unknown) => {
        if (gen === generation.current) reportError('load more products', err);
      })
      .finally(() => {
        if (gen === generation.current) setLoadingMore(false);
      });
  }, [lastPage, loadingMore, size]);

  const { data, invalid } = useMemo(() => {
    const pages = first ? [first, ...more] : [];
    const seen = new Set<string>();
    const rows: T[] = [];
    for (const page of pages) {
      for (const row of page.rows) {
        const k = keyOf(row);
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push(row);
      }
    }
    return { data: rows, invalid: pages.flatMap((p) => p.invalid) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, more]);

  return {
    data,
    invalid,
    loading: !error && active && first === null,
    error,
    hasMore,
    loadingMore,
    loadMore,
  };
}
