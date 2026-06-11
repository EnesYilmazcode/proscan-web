// ProScan data contract — TypeScript mirrors of the Firestore schema in
// docs/architecture/data-model.md. All money fields are INTEGER CENTS;
// format exclusively via lib/format.ts. Compact point keys are shared by
// latest / prev / history.d values / page items.

import type { Timestamp } from 'firebase/firestore';

/** Compact observation point. Every field may be absent (e.g. `p` is
 *  omitted when the price parse failed). Money fields are cents. */
export interface Point {
  /** price ¢ */
  p?: number;
  /** list/strike price ¢ */
  lp?: number;
  /** rating 0–5 */
  r?: number;
  /** review count */
  v?: number;
  /** prime 0/1 */
  pr?: 0 | 1;
  /** sponsored 0/1 (page chunks only) */
  sp?: 0 | 1;
  /** organic rank within the run */
  rk?: number;
  /** "N+ bought past month" lower bound */
  b?: number;
  /** "Only X left" stock count */
  st?: number;
  /** seller count (spread-day extra) */
  sc?: number;
  /** min offer ¢ (spread-day extra) */
  mn?: number;
  /** max offer ¢ (spread-day extra) */
  mx?: number;
  /** median offer ¢ (spread-day extra) */
  md?: number;
  /** coefficient of variation (spread-day extra) */
  cv?: number;
  /** total offer count (spread-day extra) */
  oc?: number;
  /** FBA offer count (spread-day extra) */
  fba?: number;
  /** Amazon-on-listing 0/1 — NUMERIC in points, boolean in Product.spread */
  az?: 0 | 1;
}

/** A Point as stored on product.latest / product.prev, with provenance. */
export interface ObservedPoint extends Point {
  at?: Timestamp;
  runId?: string;
  dayKey?: string;
}

/** Sortable vs-previous-observation deltas. `p` is cents (negative = price
 *  DROP = buying opportunity = green). */
export interface ProductDelta {
  p?: number;
  pPct?: number;
  r?: number;
  v?: number;
  days?: number;
}

/** Latest offer-spread summary (raw offers live in offerSnapshots). */
export interface ProductSpread {
  sc?: number;
  mn?: number;
  mx?: number;
  md?: number;
  mean?: number;
  sd?: number;
  cv?: number;
  iqr?: number;
  oc?: number;
  fba?: number;
  fbm?: number;
  /** BOOLEAN here (numeric 0/1 in history points). */
  az?: boolean;
  bb?: { p?: number; sellerId?: string; fba?: boolean };
  at?: Timestamp;
  runId?: string;
}

export interface ProductScores {
  opportunity?: number;
  arbitrage?: number;
  combined?: number;
  /** max buy price ¢ — median − fee heuristic − target ROI */
  maxBuy?: number;
  at?: Timestamp;
}

export type VerdictStatus = 'pass' | 'warn' | 'fail';

export interface ProductVerdict {
  status?: VerdictStatus;
  ruleSetId?: string;
  /** human-readable rule that fired, e.g. "9 FBA sellers > max 8" */
  fired?: string | null;
  at?: Timestamp;
}

export type LeadStage =
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'purchased'
  | 'rejected'
  | 'archived';

export const LEAD_STAGES: readonly LeadStage[] = [
  'new',
  'reviewing',
  'approved',
  'purchased',
  'rejected',
  'archived',
];

export interface ProductLead {
  stage?: LeadStage;
  stageChangedAt?: Timestamp;
  rejectedReason?: string | null;
  notes?: string | null;
  /** ¢ */
  buyPrice?: number | null;
  qty?: number | null;
  supplier?: string | null;
  orderRef?: string | null;
  /** v2 Re-Check Due Queue (reserved) */
  recheckAt?: Timestamp | null;
}

/** Canonical ASIN doc — workspaces/{wid}/products/{asin}.
 *  spread / scores / verdict / delta / lead MAY BE ABSENT. */
export interface Product {
  asin: string;
  mk: string;
  name?: string;
  img?: string;
  url?: string;
  latest?: ObservedPoint;
  prev?: ObservedPoint;
  delta?: ProductDelta;
  spread?: ProductSpread;
  scores?: ProductScores;
  verdict?: ProductVerdict;
  lead?: ProductLead;
  tags?: string[];
  sourceIds?: string[];
  firstSeenAt?: Timestamp;
  firstRunId?: string;
}

export type RunStatus = 'active' | 'complete' | 'stopped' | 'dead';

export interface RunCounters {
  placements?: number;
  uniqueAsins?: number;
  sponsored?: number;
  priceParseFailures?: number;
  newSeen?: number;
}

/** Scrape-run header — workspaces/{wid}/runs/{runId}. */
export interface Run {
  runId: string;
  sourceId: string;
  source?: {
    type?: SourceType;
    sellerId?: string | null;
    keyword?: string | null;
    url?: string;
  };
  mk?: string;
  /** UTC date of startedAt, 'YYYY-MM-DD' */
  dayKey?: string;
  startedAt?: Timestamp;
  /** null while active */
  finishedAt?: Timestamp | null;
  status: RunStatus;
  pagesDone?: number;
  pagesPlanned?: number;
  totalResultsOnSerp?: number;
  counters?: RunCounters;
  /** user-renamable run card */
  label?: string | null;
}

export type SourceType = 'storefront' | 'keyword';

/** Watchlist entry — workspaces/{wid}/sources/{sourceId}. */
export interface Source {
  sourceId: string;
  type: SourceType;
  /** null for keyword sources */
  sellerId?: string | null;
  keyword?: string | null;
  nickname?: string | null;
  url?: string;
  watched?: boolean;
  /** Rescan Queue: staleness = now − lastScrapedAt vs cadence */
  cadenceDays?: number;
  tags?: string[];
  catalogSize?: number;
  lastRunId?: string;
  lastScrapedAt?: Timestamp;
  notes?: string;
  createdAt?: Timestamp;
}

/** Date-keyed time-series — products/{asin}/history/daily.
 *  One Point per UTC dayKey; spread-day extras merged into the same entry. */
export interface HistoryDoc {
  asin: string;
  d: Record<string, Point>;
}

export interface Offer {
  /** seller id */
  sid?: string;
  name?: string;
  /** offer price ¢ */
  p?: number;
  /** shipping ¢ */
  ship?: number;
  fba?: 0 | 1;
  /** holds the buy box 0/1 */
  bb?: 0 | 1;
  cond?: string;
}

/** Raw spread capture — products/{asin}/offerSnapshots/{runId}. */
export interface OfferSnapshot {
  at?: Timestamp;
  expireAt?: Timestamp;
  /** condition=new offer prices ¢, NOT deduped */
  prices?: number[];
  /** AOD header count — AOD renders only ~10 offers; the header is truth */
  totalOfferCount?: number;
  offers?: Offer[];
}

/** Append-only lead activity event — products/{asin}/events/{epochMs_rand4}. */
export interface ProductEvent {
  type: string;
  from?: string;
  to?: string;
  at?: Timestamp;
  note?: string;
}

export interface WorkspaceSettings {
  defaultRoiPct: number;
  feeHeuristicPct: number;
  marketplace: string;
}

/** workspaces/{wid} — wid == owner uid today. */
export interface Workspace {
  ownerUid: string;
  name?: string;
  /** display mirror only; entitlement lives in custom claims */
  plan?: string;
  settings?: WorkspaceSettings;
  tagMeta?: Record<string, { color?: string }>;
  lastReviewedAt?: Timestamp;
  createdAt?: Timestamp;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultRoiPct: 30,
  feeHeuristicPct: 25,
  marketplace: 'US',
};
