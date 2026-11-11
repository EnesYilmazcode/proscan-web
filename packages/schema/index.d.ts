// Types for index.js, the cloud schema vendored from the extension
// (packages/schema/index.js there). index.js is copied byte for byte;
// this file is ours. scripts/check-schema.mjs keeps the two in step.

export declare const SV: 1;
export declare const MK: 'US';
export declare const ASIN_RE: RegExp;
export declare const DAY_KEY_RE: RegExp;
export declare const PAGE_TTL_DAYS: number;
export declare const MAX_PAGE_ITEMS: number;
export declare const RUN_STATUS: readonly ['active', 'complete', 'stopped', 'dead'];
export declare const SOURCE_TYPES: readonly ['storefront', 'keyword'];

export type RunStatus = (typeof RUN_STATUS)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Anything timeMs understands: ms, a Date, or a Timestamp. */
export type TimeLike = number | Date | { toMillis(): number };

/** One observation. Unknown values are left out, never null or 0. */
export interface Point {
  /** price, cents */
  p?: number;
  /** rating, 0 to 5 */
  r?: number;
  /** review count */
  v?: number;
  pr?: 0 | 1;
  /** organic rank within the run, from 1 */
  rk?: number;
  /** sponsored card, page items only */
  sp?: 0 | 1;
}

export interface Delta {
  p?: number;
  pPct?: number;
  r?: number;
  v?: number;
  days?: number;
}

export interface Source {
  type: SourceType;
  sellerId: string | null;
  keyword: string | null;
  url: string | null;
}

export interface SourceDoc<T = TimeLike> {
  sv: number;
  sourceId: string;
  type: SourceType;
  sellerId: string | null;
  keyword: string | null;
  url: string | null;
  lastRunId: string;
  lastScrapedAt: T;
  catalogSize?: number;
}

export interface RunCounters {
  placements: number;
  uniqueAsins: number;
  sponsored: number;
  priceParseFailures: number;
  newSeen: number;
}

export interface RunDoc<T = TimeLike> {
  sv: number;
  runId: string;
  sourceId: string;
  source: Source;
  mk: string;
  dayKey: string;
  startedAt: T;
  finishedAt: T | null;
  status: RunStatus;
  reason: string | null;
  pagesDone: number;
  maxPages: number;
  pagesPlanned: number | null;
  totalResultsOnSerp: number | null;
  counters: RunCounters;
}

export interface PageDoc<T = TimeLike> {
  sv: number;
  runId: string;
  page: number;
  scrapedAt: T;
  expireAt: T;
  count: number;
  placements: number;
  kind: string;
  items: Record<string, Point>;
  /** result count Amazon showed; sync-plan.js writes it, the typedef there omits it */
  total?: number;
  truncated?: boolean;
}

export interface ProductDoc<T = TimeLike> {
  sv: number;
  asin: string;
  mk: string;
  name?: string | null;
  url: string;
  img?: string | null;
  latest: Point & { at: T; runId: string; dayKey: string };
  prev: (Point & { at?: T }) | null;
  delta: Delta | null;
  sourceIds: string[];
  firstSeenAt?: T;
  firstRunId?: string;
}

export interface HistoryDoc {
  sv: number;
  asin: string;
  d: Record<string, Point>;
}

export declare function hash(s: string): string;
export declare function slugify(s: string): string;
export declare function sourceOf(url: string): Source;
export declare function sourceIdOf(source: Source): string;
export declare function runIdOf(sourceId: string, startMs: number): string;
export declare function pageIdOf(page: number): string;
export declare function dayKeyOf(ms: number, tzOffsetMin?: number): string;
export declare function expireAtMs(startMs: number): number;
export declare function runStatusOf(state: string): RunStatus;
export declare function timeMs(v: unknown): number | null;
export declare function pointOf(rec: {
  priceCents?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  isPrime?: boolean;
  organicRank?: number | null;
}): Point;
export declare function deltaOf(now: Point, prev: Point | null, days?: number | null): Delta | null;

export declare function validateSource(doc: unknown): string[];
export declare function validateRun(doc: unknown): string[];
export declare function validatePage(doc: unknown): string[];
export declare function validateProduct(doc: unknown): string[];
export declare function validateHistory(doc: unknown): string[];

export type DocKind = 'source' | 'run' | 'page' | 'product' | 'history';
export declare function assertValid<D>(kind: DocKind, doc: D): D;
