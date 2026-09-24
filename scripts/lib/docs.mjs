// Schema-valid documents for rules tests that need a product in place
// before they probe something else. Checked with the vendored schema, so a
// schema change breaks these loudly instead of quietly.

import { Timestamp } from 'firebase/firestore';
import { SV, MK, assertValid, dayKeyOf, runIdOf } from '../../packages/schema/index.js';

/** A product as sync writes it after one run of `sourceId`. */
export function productDoc(asin, { cents = 1999, atMs = Date.parse('2026-09-01T12:00:00Z'), sourceId = 'k_qa' } = {}) {
  const runId = runIdOf(sourceId, atMs);
  const doc = {
    sv: SV,
    asin,
    mk: MK,
    name: `QA product ${asin}`,
    url: `https://www.amazon.com/dp/${asin}`,
    latest: { p: cents, r: 4.5, v: 120, at: Timestamp.fromMillis(atMs), runId, dayKey: dayKeyOf(atMs) },
    prev: null,
    delta: null,
    sourceIds: [sourceId],
    firstSeenAt: Timestamp.fromMillis(atMs),
    firstRunId: runId,
  };
  return assertValid('product', doc);
}
