// Typed Firestore query builders + the few dashboard writers.
// Every read the dashboard performs is built HERE so read-cost hygiene is
// auditable in one file (docs/ops/billing-runbook.md):
//   * products are ALWAYS scoped (per-source / top-N / recent-N) — never
//     the whole collection;
//   * runs list is capped at 30;
//   * sources is the only whole-collection read (tiny by design);
//   * history + offerSnapshots are one-shot fetch material.

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type Query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  HistoryDoc,
  LeadStage,
  OfferSnapshot,
  Product,
  ProductEvent,
  ProductLead,
  Run,
  Source,
} from './types';

/* ── converters (id-stamping, cast-only — schema lives in types.ts) ─── */

function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore: (snap) => snap.data() as T,
  };
}

const productConverter = converter<Product>();
const runConverter = converter<Run>();
const sourceConverter = converter<Source>();
const historyConverter = converter<HistoryDoc>();
const snapshotConverter = converter<OfferSnapshot>();

function productsCol(wid: string) {
  return collection(db, 'workspaces', wid, 'products').withConverter(
    productConverter,
  );
}

/* ── product queries (ALWAYS scoped) ────────────────────────────────── */

/** Per-source product board — the default table view.
 *  Index: products(sourceIds contains, latest.at desc). */
export function productsBySource(
  wid: string,
  sourceId: string,
  lim = 400,
): Query<Product> {
  return query(
    productsCol(wid),
    where('sourceIds', 'array-contains', sourceId),
    orderBy('latest.at', 'desc'),
    limit(lim),
  );
}

/** Global Movers / Flip Radar: biggest price DROPS first (delta.pPct asc —
 *  most-negative = best buying opportunity). Single-field index. */
export function topMovers(wid: string, lim = 100): Query<Product> {
  return query(productsCol(wid), orderBy('delta.pPct', 'asc'), limit(lim));
}

/** Most recently observed products across all sources. */
export function recentProducts(wid: string, lim = 200): Query<Product> {
  return query(productsCol(wid), orderBy('latest.at', 'desc'), limit(lim));
}

/* ── runs / sources ─────────────────────────────────────────────────── */

/** Run Inbox — newest first, HARD-capped at 30 (read hygiene). */
export function runsRecent(wid: string, lim = 30): Query<Run> {
  return query(
    collection(db, 'workspaces', wid, 'runs').withConverter(runConverter),
    orderBy('startedAt', 'desc'),
    limit(Math.min(lim, 30)),
  );
}

/** Whole sources collection (the watchlist spine — tiny by design;
 *  staleness sorting happens client-side via format.staleness). */
export function sources(wid: string): Query<Source> {
  return query(
    collection(db, 'workspaces', wid, 'sources').withConverter(sourceConverter),
  );
}

/* ── drawer material (one-shot reads, NEVER listeners) ──────────────── */

/** products/{asin}/history/daily — pass to useDocOnce (one read renders
 *  the whole time series). */
export function historyDaily(
  wid: string,
  asin: string,
): DocumentReference<HistoryDoc> {
  return doc(
    db,
    'workspaces',
    wid,
    'products',
    asin,
    'history',
    'daily',
  ).withConverter(historyConverter);
}

/** One-shot fetch of the newest raw offer snapshot for an ASIN (snapshot
 *  doc ids are runIds; ordered by capture time). Null when none exist. */
export async function latestOfferSnapshot(
  wid: string,
  asin: string,
): Promise<(OfferSnapshot & { runId: string }) | null> {
  const snap = await getDocs(
    query(
      collection(
        db,
        'workspaces',
        wid,
        'products',
        asin,
        'offerSnapshots',
      ).withConverter(snapshotConverter),
      orderBy('at', 'desc'),
      limit(1),
    ),
  );
  const first = snap.docs[0];
  if (!first) return null;
  return { ...first.data(), runId: first.id };
}

/* ── writers (dashboard-owned fields only) ──────────────────────────── */

/** Move a product through the lead pipeline. Deep-merges `lead` so notes /
 *  buyPrice / etc. survive a stage change unless explicitly overwritten. */
export function leadStageUpdate(
  wid: string,
  asin: string,
  stage: LeadStage,
  extras: Partial<Omit<ProductLead, 'stage' | 'stageChangedAt'>> = {},
): Promise<void> {
  return setDoc(
    doc(db, 'workspaces', wid, 'products', asin),
    { lead: { stage, stageChangedAt: serverTimestamp(), ...extras } },
    { merge: true },
  );
}

/** Append-only lead activity trail. Doc id = `${epochMs}_${rand4}` per the
 *  data-model dedup scheme; events are never updated or deleted. */
export function appendEvent(
  wid: string,
  asin: string,
  event: Omit<ProductEvent, 'at'>,
): Promise<void> {
  const rand4 = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const eventId = `${Date.now()}_${rand4}`;
  return setDoc(
    doc(db, 'workspaces', wid, 'products', asin, 'events', eventId),
    { ...event, at: serverTimestamp() },
  );
}

/** The dashboard-settable source fields (everything else on a source doc
 *  is extension-written). */
export type SourcePatch = Partial<
  Pick<Source, 'watched' | 'nickname' | 'cadenceDays' | 'tags'>
>;

/** Patch watchlist controls on a source (merge — never clobbers the
 *  extension-written scan fields). */
export function sourcePatch(
  wid: string,
  sourceId: string,
  patch: SourcePatch,
): Promise<void> {
  return setDoc(doc(db, 'workspaces', wid, 'sources', sourceId), patch, {
    merge: true,
  });
}
