// Reads for run comparisons: a source's latest two run headers and their
// page chunks (one-shot, never listeners), and the product documents of
// the movers for names and images. Per source that is 2 + pages reads,
// plus one per mover shown.

import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';
import { splitChecked, type SchemaProblem } from './checked';
import { asSeenBy, compareRuns, daysBetween, moversOf, type Comparison } from './compare';
import { productsByAsin, runPages, runsOfSource } from './queries';
import type { Product, Run, Source } from './types';

/** Sources compared when the board is not scoped to one. */
export const MOVER_SOURCES = 8;
/** Movers joined to their product documents and shown. */
export const MOVERS_SHOWN = 500;

export interface SourceComparison {
  sourceId: string;
  latest: Run;
  prev: Run | null;
  byAsin: Map<string, Comparison>;
}

async function compareSource(
  wid: string,
  sourceId: string,
  invalid: SchemaProblem[],
): Promise<SourceComparison | null> {
  const runsSnap = await getDocs(runsOfSource(wid, sourceId, 2));
  const runs = splitChecked(runsSnap.docs.map((d) => d.data()));
  invalid.push(...runs.invalid);
  const [latest, prev = null] = runs.valid;
  if (!latest) return null;
  const pagesOf = async (run: Run) => {
    const snap = await getDocs(runPages(wid, run.runId));
    const pages = splitChecked(snap.docs.map((d) => d.data()));
    invalid.push(...pages.invalid);
    return pages.valid;
  };
  const [latestPages, prevPages] = await Promise.all([pagesOf(latest), prev ? pagesOf(prev) : null]);
  const days = prev ? daysBetween(latest, prev) : null;
  return { sourceId, latest, prev, byAsin: compareRuns(latestPages, prevPages, days) };
}

interface State<T> {
  data: T;
  invalid: SchemaProblem[];
  loading: boolean;
  error: Error | null;
}

/** The latest-two-runs comparison of each source in `sourceIds`. */
export function useSourceComparisons(
  wid: string | null,
  sourceIds: string[] | null,
): State<SourceComparison[]> {
  const key = sourceIds ? sourceIds.join('\n') : null;
  const [state, setState] = useState<State<SourceComparison[]>>({
    data: [],
    invalid: [],
    loading: key !== null,
    error: null,
  });

  useEffect(() => {
    if (!wid || key === null) {
      setState({ data: [], invalid: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: [], invalid: [], loading: true, error: null });
    const invalid: SchemaProblem[] = [];
    Promise.all(key.split('\n').filter(Boolean).map((id) => compareSource(wid, id, invalid)))
      .then((all) => {
        if (cancelled) return;
        setState({ data: all.filter((c): c is SourceComparison => c !== null), invalid, loading: false, error: null });
      })
      .catch((error: Error) => {
        console.error('[proscan] run comparison failed', error);
        if (!cancelled) setState({ data: [], invalid, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [wid, key]);

  return state;
}

/** The sources Movers compares: the one in scope, else the most recently scanned. */
export function moverSources(sourceId: string | null, sources: Source[]): string[] {
  if (sourceId) return [sourceId];
  return [...sources]
    .filter((s) => s.lastRunId)
    .sort((a, b) => (b.lastScrapedAt?.toMillis() ?? 0) - (a.lastScrapedAt?.toMillis() ?? 0))
    .slice(0, MOVER_SOURCES)
    .map((s) => s.sourceId);
}

export interface MoverRows {
  rows: Product[];
  /** price changes found, before the MOVERS_SHOWN cap */
  found: number;
  compared: SourceComparison[];
}

/**
 * Movers across the given comparisons, biggest drop first, as board rows:
 * each ASIN as its source's latest run saw it. An ASIN in several sources
 * shows under the most recently scanned one.
 */
export function useMoverRows(wid: string | null, comparisons: State<SourceComparison[]>): State<MoverRows> {
  const [state, setState] = useState<State<MoverRows>>({
    data: { rows: [], found: 0, compared: [] },
    invalid: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!wid || comparisons.loading || comparisons.error) {
      setState({ data: { rows: [], found: 0, compared: [] }, invalid: [], loading: comparisons.loading, error: comparisons.error });
      return;
    }
    const picked = new Map<string, { cmp: Comparison; run: Run }>();
    for (const sc of comparisons.data) {
      for (const cmp of moversOf(sc.byAsin.values())) {
        if (!picked.has(cmp.asin)) picked.set(cmp.asin, { cmp, run: sc.latest });
      }
    }
    const ordered = moversOf([...picked.values()].map((p) => p.cmp));
    const shown = ordered.slice(0, MOVERS_SHOWN);
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const chunks: string[][] = [];
    for (let i = 0; i < shown.length; i += 30) chunks.push(shown.slice(i, i + 30).map((c) => c.asin));
    Promise.all(chunks.map((asins) => getDocs(productsByAsin(wid, asins))))
      .then((snaps) => {
        if (cancelled) return;
        const { valid, invalid } = splitChecked(snaps.flatMap((s) => s.docs.map((d) => d.data())));
        const docs = new Map(valid.map((p) => [p.asin, p]));
        const rows = shown.map((cmp) => {
          const product = docs.get(cmp.asin) ?? { asin: cmp.asin, mk: 'US' };
          return asSeenBy(product, cmp, picked.get(cmp.asin)!.run);
        });
        setState({
          data: { rows, found: ordered.length, compared: comparisons.data },
          invalid: [...comparisons.invalid, ...invalid],
          loading: false,
          error: null,
        });
      })
      .catch((error: Error) => {
        console.error('[proscan] mover products failed', error);
        if (!cancelled) setState({ data: { rows: [], found: 0, compared: [] }, invalid: [], loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [wid, comparisons]);

  return state;
}
