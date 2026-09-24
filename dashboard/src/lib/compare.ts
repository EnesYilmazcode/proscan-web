// Deltas and movers for one source, from its latest two runs. The page
// chunks of each run hold every ASIN the run saw with its point, so two
// runs of the same source compare like with like: the product document's
// own delta is against whatever run saw it last, from any source.
//
// Pure: page documents in, comparisons out.

import { deltaOf, timeMs, type Delta, type Point } from '../../../packages/schema/index.js';
import type { PageDoc, Product, Run } from './types';

const DAY_MS = 86400000;

export interface Comparison {
  asin: string;
  now: Point;
  /** null when the earlier run did not see this ASIN */
  prev: Point | null;
  delta: Delta | null;
}

/** Every ASIN in a run's pages with its point, first page first. */
export function itemsOf(pages: Pick<PageDoc, 'page' | 'items'>[]): Map<string, Point> {
  const items = new Map<string, Point>();
  for (const page of [...pages].sort((a, b) => a.page - b.page)) {
    for (const [asin, pt] of Object.entries(page.items)) {
      if (items.has(asin)) continue;
      const { sp: _sp, ...point } = pt;
      items.set(asin, point);
    }
  }
  return items;
}

/** Whole days from the earlier run's start to the later one's. */
export function daysBetween(latest: Pick<Run, 'startedAt'>, prev: Pick<Run, 'startedAt'>): number | null {
  const a = timeMs(latest.startedAt);
  const b = timeMs(prev.startedAt);
  return a === null || b === null ? null : Math.floor((a - b) / DAY_MS);
}

/** Each ASIN of the latest run against the earlier run. */
export function compareRuns(
  latestPages: Pick<PageDoc, 'page' | 'items'>[],
  prevPages: Pick<PageDoc, 'page' | 'items'>[] | null,
  days: number | null = null,
): Map<string, Comparison> {
  const now = itemsOf(latestPages);
  const before = prevPages ? itemsOf(prevPages) : new Map<string, Point>();
  const out = new Map<string, Comparison>();
  for (const [asin, pt] of now) {
    const prev = before.get(asin) ?? null;
    out.set(asin, { asin, now: pt, prev, delta: prev ? deltaOf(pt, prev, days) : null });
  }
  return out;
}

/** ASINs whose price changed, biggest drop first. */
export function moversOf(comparisons: Iterable<Comparison>): Comparison[] {
  return [...comparisons]
    .filter((c) => c.delta?.p !== undefined && c.delta.p !== 0)
    .sort((a, b) => (a.delta!.pPct ?? 0) - (b.delta!.pPct ?? 0) || a.delta!.p! - b.delta!.p!);
}

/**
 * A board row for a product as this source's latest run saw it: its point
 * and its delta against the source's previous run.
 */
export function asSeenBy(product: Product, cmp: Comparison, run: Pick<Run, 'runId' | 'dayKey' | 'startedAt'>): Product {
  return {
    ...product,
    latest: { ...cmp.now, at: run.startedAt, runId: run.runId, dayKey: run.dayKey },
    prev: cmp.prev,
    delta: cmp.delta,
  };
}
