// Unit tests for lib/compare.ts. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asSeenBy, compareRuns, daysBetween, itemsOf, moversOf } from '../src/lib/compare.ts';

const page = (n, items) => ({ page: n, items });

test('itemsOf keeps the first page an ASIN was on and drops the sponsored flag', () => {
  const items = itemsOf([page(2, { B000000001: { p: 900, sp: 1 } }), page(1, { B000000001: { p: 1000, rk: 3, sp: 0 } })]);
  assert.deepEqual(items.get('B000000001'), { p: 1000, rk: 3 });
});

test('compareRuns diffs each ASIN of the latest run against the earlier one', () => {
  const latest = [page(1, { B000000001: { p: 900, r: 4.5, v: 110 }, B000000002: { p: 500 } })];
  const prev = [page(1, { B000000001: { p: 1000, r: 4.5, v: 100 } })];
  const cmp = compareRuns(latest, prev, 7);
  assert.deepEqual(cmp.get('B000000001').delta, { p: -100, pPct: -10, r: 0, v: 10, days: 7 });
  assert.equal(cmp.get('B000000002').prev, null, 'new to this source');
  assert.equal(cmp.get('B000000002').delta, null);
});

test('a price missing from either run gives no price delta, not a zero', () => {
  const cmp = compareRuns([page(1, { B000000001: { v: 12 } })], [page(1, { B000000001: { p: 1000, v: 10 } })]);
  assert.deepEqual(cmp.get('B000000001').delta, { v: 2 });
  assert.deepEqual(moversOf(cmp.values()), []);
});

test('with no earlier run nothing has a delta', () => {
  const cmp = compareRuns([page(1, { B000000001: { p: 1 } })], null);
  assert.equal(cmp.get('B000000001').delta, null);
});

test('moversOf lists price changes only, biggest drop first', () => {
  const cmp = compareRuns(
    [page(1, { B000000001: { p: 950 }, B000000002: { p: 500 }, B000000003: { p: 1100 }, B000000004: { p: 700 } })],
    [page(1, { B000000001: { p: 1000 }, B000000002: { p: 1000 }, B000000003: { p: 1000 }, B000000004: { p: 700 } })],
  );
  assert.deepEqual(moversOf(cmp.values()).map((c) => c.asin), ['B000000002', 'B000000001', 'B000000003']);
});

test('daysBetween counts whole days between run starts', () => {
  const at = (ms) => ({ startedAt: { toMillis: () => ms } });
  assert.equal(daysBetween(at(8.5 * 86400000), at(1 * 86400000)), 7);
});

test('asSeenBy shows the run point and delta over the product document', () => {
  const product = { asin: 'B000000001', mk: 'US', name: 'Mug', latest: { p: 1, runId: 'other' }, delta: { p: 5 } };
  const cmp = { asin: 'B000000001', now: { p: 900 }, prev: { p: 1000 }, delta: { p: -100, pPct: -10 } };
  const row = asSeenBy(product, cmp, { runId: 'k_mug_2', dayKey: '2026-06-09', startedAt: 't' });
  assert.equal(row.name, 'Mug');
  assert.deepEqual(row.latest, { p: 900, at: 't', runId: 'k_mug_2', dayKey: '2026-06-09' });
  assert.deepEqual(row.delta, { p: -100, pPct: -10 });
});
