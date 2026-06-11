// Drawer-local data access. Read budget per drawer open (read-cost hygiene,
// docs/ops/billing-runbook.md):
//   product doc     — ONE-SHOT getDoc (single doc, cheap; lead writes are
//                     reflected via optimistic UI, no listener needed)
//   history/daily   — ONE-SHOT via useDocOnce(historyDaily) in HistoryDrawer
//   offerSnapshots  — ONE-SHOT latestOfferSnapshot, fetched only when the
//                     product actually has a spread (skips the 1-read
//                     minimum query charge for spread-less ASINs)
// NEVER listeners on history / snapshots.

import { useEffect, useMemo, useState } from 'react';
import {
  doc,
  setDoc,
  type DocumentData,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useDocOnce, type DocOnceState } from '../../lib/hooks';
import { latestOfferSnapshot } from '../../lib/queries';
import type { OfferSnapshot, Product, ProductLead } from '../../lib/types';

const productConverter: FirestoreDataConverter<Product> = {
  toFirestore: (data) => data as DocumentData,
  fromFirestore: (snap) => snap.data() as Product,
};

/** One-shot read of workspaces/{wid}/products/{asin}. Re-fetches only when
 *  the doc path changes (useDocOnce keys on path). */
export function useProductOnce(wid: string, asin: string): DocOnceState<Product> {
  const ref = useMemo(
    () =>
      doc(db, 'workspaces', wid, 'products', asin).withConverter(
        productConverter,
      ),
    [wid, asin],
  );
  return useDocOnce(ref);
}

export interface OfferSnapshotState {
  data: (OfferSnapshot & { runId: string }) | null;
  loading: boolean;
}

/** One-shot fetch of the newest raw offer snapshot. Pass enabled=false to
 *  skip the read entirely (a product without a spread has no snapshots
 *  worth paying a query for). */
export function useLatestOfferSnapshot(
  wid: string,
  asin: string,
  enabled: boolean,
): OfferSnapshotState {
  const [state, setState] = useState<OfferSnapshotState>({
    data: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true });
    latestOfferSnapshot(wid, asin)
      .then((snap) => {
        if (!cancelled) setState({ data: snap, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [wid, asin, enabled]);

  return state;
}

/** The lead fields the drawer edits in place (everything except stage). */
export type LeadFieldPatch = Partial<
  Pick<
    ProductLead,
    'notes' | 'rejectedReason' | 'buyPrice' | 'qty' | 'supplier' | 'orderRef'
  >
>;

/** Merge-write lead.* fields WITHOUT bumping lead.stageChangedAt —
 *  queries.leadStageUpdate is reserved for actual stage moves. */
export function leadFieldPatch(
  wid: string,
  asin: string,
  patch: LeadFieldPatch,
): Promise<void> {
  return setDoc(
    doc(db, 'workspaces', wid, 'products', asin),
    { lead: patch },
    { merge: true },
  );
}
