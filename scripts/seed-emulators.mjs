// ProScan emulator seed fixtures — see docs/architecture/data-model.md §4.
//
// SAFETY: this script may only ever talk to the local Firebase Emulator Suite.
// It defaults the emulator host env vars and hard-fails if either is empty, so
// writes against production Firestore/Auth are impossible by construction.
//
// Idempotent: every document is written with set() under a fixed ID — running
// the seed twice produces byte-identical data, never duplicates.
//
// Conventions (data-model.md §4): all money fields are integer cents; every
// timestamp field is a Firestore Timestamp (the ISO strings in the doc are
// display notation only — rules require e.g. `expireAt is timestamp`).

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is empty — refusing to run; production writes must be impossible.');
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('FIREBASE_AUTH_EMULATOR_HOST is empty — refusing to run; production writes must be impossible.');
}

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-proscan' });
const auth = getAuth();
const db = getFirestore();

/** ISO string -> Firestore Timestamp. */
const ts = (iso) => Timestamp.fromDate(new Date(iso));
/** ISO string + 400 days -> Firestore Timestamp (TTL stamp for cold docs, §8). */
const plus400d = (iso) => Timestamp.fromMillis(Date.parse(iso) + 400 * 86400 * 1000);

const UID = '9f8aKq2WLxYpB3vN7cE5dRm1tUo2';
const WID = UID; // wid == owner uid (data-model.md §1 principle 6)

const RUN1 = 's_A3K9XELT4QZ6M2_1748872700000'; // dayKey 2026-06-02
const RUN2 = 's_A3K9XELT4QZ6M2_1749477731000'; // dayKey 2026-06-09 (latest)
const RUN2_STARTED = '2026-06-09T14:02:11Z';

// ── Auth user ────────────────────────────────────────────────────────────────
try {
  await auth.createUser({
    uid: UID,
    email: 'dev@proscan.test',
    password: 'proscan-dev',
    displayName: 'Enes',
  });
  console.log('auth: created dev@proscan.test');
} catch (e) {
  const code = e?.errorInfo?.code ?? e?.code;
  if (code === 'auth/uid-already-exists' || code === 'auth/email-already-exists') {
    console.log('auth: dev@proscan.test already exists (ok)');
  } else {
    throw e;
  }
}

// ── users/{uid} (§4.1) ───────────────────────────────────────────────────────
await db.doc(`users/${UID}`).set({
  displayName: 'Enes',
  email: 'enesyilmaz5157@gmail.com',
  defaultWorkspace: WID, // == uid today
  createdAt: ts('2026-04-02T10:00:00Z'),
});

// ── workspaces/{wid} (§4.2) ──────────────────────────────────────────────────
const ws = db.doc(`workspaces/${WID}`);
await ws.set({
  ownerUid: UID,
  name: "Enes's workspace",
  plan: 'free', // display mirror only; entitlement enforced via custom claims
  settings: { defaultRoiPct: 30, feeHeuristicPct: 25, marketplace: 'US' },
  tagMeta: { kitchen: { color: '#f0c14b' }, 'tier-A': { color: '#2e7d32' } },
  lastReviewedAt: ts('2026-06-08T19:00:00Z'), // v2 What-Changed feed baseline (reserved)
  createdAt: ts('2026-04-02T10:00:00Z'),
});

// ── sources (§4.3) ───────────────────────────────────────────────────────────
await ws.collection('sources').doc('s_A3K9XELT4QZ6M2').set({
  sourceId: 's_A3K9XELT4QZ6M2',
  type: 'storefront',
  sellerId: 'A3K9XELT4QZ6M2',
  keyword: null,
  nickname: 'BrickHouse Deals (kitchen)',
  url: 'https://www.amazon.com/s?me=A3K9XELT4QZ6M2',
  watched: true,
  cadenceDays: 7,
  tags: ['kitchen', 'tier-A'],
  catalogSize: 412,
  lastRunId: RUN2,
  lastScrapedAt: ts('2026-06-09T14:19:40Z'),
  notes: '',
  createdAt: ts('2026-04-02T10:05:00Z'),
});

await ws.collection('sources').doc('k_wireless-earbuds').set({
  sourceId: 'k_wireless-earbuds',
  type: 'keyword',
  sellerId: null,
  keyword: 'wireless earbuds',
  nickname: 'Wireless earbuds (keyword)',
  url: 'https://www.amazon.com/s?k=wireless+earbuds',
  watched: true,
  cadenceDays: 7,
  tags: [],
  catalogSize: null, // populated by getTotalResults() on first run
  lastRunId: null,
  lastScrapedAt: null,
  notes: '',
  createdAt: ts('2026-05-15T09:00:00Z'),
});

// ── runs (§4.4) ──────────────────────────────────────────────────────────────
const runSource = {
  type: 'storefront',
  sellerId: 'A3K9XELT4QZ6M2',
  keyword: null,
  url: 'https://www.amazon.com/s?me=A3K9XELT4QZ6M2',
};
const runCounters = {
  placements: 442, // every card seen, incl. sponsored repeats
  uniqueAsins: 408,
  sponsored: 34,
  priceParseFailures: 3,
  newSeen: 12, // ASINs absent from lastValues at enqueue time
};

await ws.collection('runs').doc(RUN1).set({
  runId: RUN1,
  sourceId: 's_A3K9XELT4QZ6M2',
  source: runSource,
  mk: 'US',
  dayKey: '2026-06-02',
  startedAt: ts('2026-06-02T13:58:20Z'),
  finishedAt: ts('2026-06-02T14:13:05Z'),
  status: 'complete',
  pagesDone: 9,
  pagesPlanned: 9,
  totalResultsOnSerp: 412,
  counters: runCounters,
  label: null,
});

await ws.collection('runs').doc(RUN2).set({
  runId: RUN2,
  sourceId: 's_A3K9XELT4QZ6M2',
  source: runSource,
  mk: 'US',
  dayKey: '2026-06-09',
  startedAt: ts(RUN2_STARTED),
  finishedAt: ts('2026-06-09T14:19:40Z'),
  status: 'complete',
  pagesDone: 9,
  pagesPlanned: 9,
  totalResultsOnSerp: 412,
  counters: runCounters,
  label: null,
});

// ── runs/{RUN2}/pages/p0001..p0003 (§4.5) — cold observation chunks, TTL ─────
const pages = ws.collection('runs').doc(RUN2).collection('pages');

await pages.doc('p0001').set({
  page: 1,
  scrapedAt: ts('2026-06-09T14:02:40Z'),
  expireAt: plus400d(RUN2_STARTED), // 2027-07-14T14:02:11Z
  count: 5,
  items: {
    B0A3T6Y9KD: { p: 1599, lp: 1999, r: 4.7, v: 5211, pr: 1, sp: 0, rk: 1, b: 1000 },
    B0B7QK9M1T: { p: 1899, r: 4.2, v: 76, pr: 1, sp: 1, rk: 2 }, // sponsored placement
    B0CN5P2W7H: { p: 3249, r: 4.4, v: 612, pr: 1, sp: 0, rk: 3 },
    B08ZQR5V1M: { p: 2750, lp: 2999, r: 4.8, v: 2304, pr: 1, sp: 0, rk: 4, st: 3 },
    B0F1K7M3Q9: { r: 3.9, v: 41, pr: 0, sp: 0, rk: 5 }, // price parse failed -> p omitted
  },
});

await pages.doc('p0002').set({
  page: 2,
  scrapedAt: ts('2026-06-09T14:03:46Z'),
  expireAt: plus400d(RUN2_STARTED),
  count: 5,
  items: {
    B09XJ4L8RT: { p: 2199, r: 4.5, v: 980, pr: 1, sp: 0, rk: 49 },
    B0DJH2N4XS: { p: 899, r: 4.0, v: 153, pr: 1, sp: 0, rk: 50, b: 200 },
    B0BVC7G3LP: { p: 4599, lp: 5499, r: 4.3, v: 322, pr: 0, sp: 0, rk: 51 },
    B0E8M1R6TW: { p: 1299, r: 4.6, v: 2871, pr: 1, sp: 0, rk: 52 },
    B07PL9S2QF: { p: 759, r: 3.8, v: 67, pr: 1, sp: 0, rk: 53, st: 5 },
  },
});

// Verbatim example chunk from §4.5 (sponsored repeat + parse failure).
await pages.doc('p0003').set({
  page: 3,
  scrapedAt: ts('2026-06-09T14:04:53Z'),
  expireAt: ts('2027-07-14T14:04:53Z'),
  count: 48,
  items: {
    B0C8XL4N2P: { p: 2399, lp: 3299, r: 4.6, v: 1873, pr: 1, sp: 0, rk: 108, b: 400 },
    B0B7QK9M1T: { p: 1899, r: 4.2, v: 76, pr: 1, sp: 1, rk: 97 }, // sponsored repeat: recorded, not aggregated
    B0DQZJ8R4W: { r: 4.1, v: 233, pr: 0, sp: 0, rk: 111 }, // price parse failed -> p omitted
  },
});

// ── products (§4.6) — 12 docs, asin field == doc id ──────────────────────────
const products = ws.collection('products');
const SRC = ['s_A3K9XELT4QZ6M2'];
const img = (slug) => `https://m.media-amazon.com/images/I/${slug}._AC_UL320_.jpg`;
const leadOf = (stage, stageChangedAtIso, extra = {}) => ({
  stage,
  stageChangedAt: ts(stageChangedAtIso),
  rejectedReason: null,
  notes: '',
  buyPrice: null,
  qty: null,
  supplier: null,
  orderRef: null,
  recheckAt: null, // v2 Re-Check Due Queue (field reserved)
  ...extra,
});

// 4.6 verbatim: the canonical example doc (full spread/scores/verdict).
await products.doc('B0C8XL4N2P').set({
  asin: 'B0C8XL4N2P',
  mk: 'US',
  name: 'Stanley Quencher H2.0 Tumbler 40oz',
  img: 'https://m.media-amazon.com/images/I/71abcDEFgh._AC_UL320_.jpg',
  url: 'https://www.amazon.com/dp/B0C8XL4N2P',
  latest: { p: 2399, lp: 3299, r: 4.6, v: 1873, pr: 1, rk: 12, b: 400,
            at: ts('2026-06-09T14:04:53Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 2599, r: 4.5, v: 1701, rk: 18,
          at: ts('2026-06-02T13:58:20Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -200, pPct: -7.7, r: 0.1, v: 172, days: 7 },
  spread: { sc: 14, mn: 1849, mx: 3399, md: 2245, mean: 2310, sd: 412, cv: 0.21, iqr: 380,
            oc: 14, fba: 9, fbm: 5, az: false,
            bb: { p: 2245, sellerId: 'A9XK2M4L1P8Q', fba: true },
            at: ts('2026-06-09T14:11:02Z'), runId: RUN2 },
  scores: { opportunity: 7.2, arbitrage: 6.1, combined: 6.8, maxBuy: 1310,
            at: ts('2026-06-09T14:11:02Z') },
  verdict: { status: 'warn', ruleSetId: 'default', fired: '9 FBA sellers > max 8',
             at: ts('2026-06-09T18:02:00Z') },
  lead: leadOf('reviewing', '2026-06-08T19:30:00Z', { notes: 'check Walmart clearance' }),
  tags: ['kitchen', 'q3'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-04-07T11:20:09Z'),
  firstRunId: 's_A3K9XELT4QZ6M2_1743938400000',
});

// full blocks (spread/scores/verdict) #2
await products.doc('B0B7QK9M1T').set({
  asin: 'B0B7QK9M1T',
  mk: 'US',
  name: 'Mueller Pro-Series 10-in-1 Vegetable Chopper',
  img: img('61muellerVC'),
  url: 'https://www.amazon.com/dp/B0B7QK9M1T',
  latest: { p: 1899, r: 4.2, v: 76, pr: 1, rk: 97,
            at: ts('2026-06-09T14:04:53Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 2099, r: 4.2, v: 64, rk: 102,
          at: ts('2026-06-02T13:59:41Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -200, pPct: -9.5, r: 0, v: 12, days: 7 },
  spread: { sc: 6, mn: 1699, mx: 2399, md: 1899, mean: 1932, sd: 218, cv: 0.11, iqr: 240,
            oc: 6, fba: 4, fbm: 2, az: false,
            bb: { p: 1899, sellerId: 'A2QW8R5T9Y3Z', fba: false },
            at: ts('2026-06-09T14:11:02Z'), runId: RUN2 },
  scores: { opportunity: 5.4, arbitrage: 4.8, combined: 5.1, maxBuy: 1040,
            at: ts('2026-06-09T14:11:02Z') },
  verdict: { status: 'pass', ruleSetId: 'default', fired: null,
             at: ts('2026-06-09T18:02:00Z') },
  lead: leadOf('approved', '2026-06-09T19:05:00Z'),
  tags: ['kitchen'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-05-05T09:14:33Z'),
  firstRunId: RUN1,
});

// full blocks #3
await products.doc('B0CN5P2W7H').set({
  asin: 'B0CN5P2W7H',
  mk: 'US',
  name: 'Cuisinart 14-Cup Food Processor',
  img: img('71cuisFP14'),
  url: 'https://www.amazon.com/dp/B0CN5P2W7H',
  latest: { p: 3249, r: 4.4, v: 612, pr: 1, rk: 3,
            at: ts('2026-06-09T14:02:40Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 3599, r: 4.4, v: 598, rk: 6,
          at: ts('2026-06-02T13:58:20Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -350, pPct: -9.7, r: 0, v: 14, days: 7 },
  spread: { sc: 9, mn: 2999, mx: 3899, md: 3249, mean: 3301, sd: 287, cv: 0.09, iqr: 310,
            oc: 9, fba: 7, fbm: 2, az: true,
            bb: { p: 3249, sellerId: 'A9XK2M4L1P8Q', fba: true },
            at: ts('2026-06-09T14:11:02Z'), runId: RUN2 },
  scores: { opportunity: 4.1, arbitrage: 3.6, combined: 3.9, maxBuy: 1790,
            at: ts('2026-06-09T14:11:02Z') },
  verdict: { status: 'warn', ruleSetId: 'default', fired: 'CV 0.09 < min 0.15',
             at: ts('2026-06-09T18:02:00Z') },
  lead: leadOf('approved', '2026-06-09T18:30:00Z'),
  tags: ['kitchen', 'tier-A'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-05-05T09:14:33Z'),
  firstRunId: RUN1,
});

// full blocks #4
await products.doc('B08ZQR5V1M').set({
  asin: 'B08ZQR5V1M',
  mk: 'US',
  name: 'OXO Good Grips 3-Piece Mixing Bowl Set',
  img: img('71oxoBowls'),
  url: 'https://www.amazon.com/dp/B08ZQR5V1M',
  latest: { p: 2750, lp: 2999, r: 4.8, v: 2304, pr: 1, rk: 4, st: 3,
            at: ts('2026-06-09T14:02:40Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 2499, r: 4.8, v: 2230, rk: 4,
          at: ts('2026-06-02T13:58:20Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: 251, pPct: 10.0, r: 0, v: 74, days: 7 },
  spread: { sc: 11, mn: 2399, mx: 3199, md: 2699, mean: 2710, sd: 433, cv: 0.16, iqr: 420,
            oc: 11, fba: 5, fbm: 6, az: false,
            bb: { p: 2699, sellerId: 'A7LM3K9Q2W5E', fba: true },
            at: ts('2026-06-09T14:11:02Z'), runId: RUN2 },
  scores: { opportunity: 6.5, arbitrage: 5.9, combined: 6.2, maxBuy: 1480,
            at: ts('2026-06-09T14:11:02Z') },
  verdict: { status: 'pass', ruleSetId: 'default', fired: null,
             at: ts('2026-06-09T18:02:00Z') },
  lead: leadOf('purchased', '2026-06-09T20:11:00Z', {
    buyPrice: 1499, qty: 12, supplier: 'Target clearance', orderRef: 'PO-0043',
  }),
  tags: ['kitchen'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-04-14T08:02:51Z'),
  firstRunId: 's_A3K9XELT4QZ6M2_1743938400000',
});

// delta, no spread/scores/verdict
await products.doc('B09XJ4L8RT').set({
  asin: 'B09XJ4L8RT',
  mk: 'US',
  name: 'Lodge 10.25 Inch Cast Iron Skillet',
  img: img('81lodgeSk10'),
  url: 'https://www.amazon.com/dp/B09XJ4L8RT',
  latest: { p: 2199, r: 4.5, v: 980, pr: 1, rk: 49,
            at: ts('2026-06-09T14:03:46Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 2199, r: 4.5, v: 941, rk: 47,
          at: ts('2026-06-02T13:59:41Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: 0, pPct: 0, r: 0, v: 39, days: 7 },
  lead: leadOf('reviewing', '2026-06-09T18:40:00Z', { notes: 'compare to Walmart bundle' }),
  tags: ['kitchen', 'tier-A'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-04-21T10:33:12Z'),
  firstRunId: 's_A3K9XELT4QZ6M2_1743938400000',
});

// delta, purchased
await products.doc('B0A3T6Y9KD').set({
  asin: 'B0A3T6Y9KD',
  mk: 'US',
  name: 'Thermos Stainless King 16oz Travel Mug',
  img: img('61thermosSK'),
  url: 'https://www.amazon.com/dp/B0A3T6Y9KD',
  latest: { p: 1599, lp: 1999, r: 4.7, v: 5211, pr: 1, rk: 1, b: 1000,
            at: ts('2026-06-09T14:02:40Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 1799, r: 4.7, v: 5102, rk: 2,
          at: ts('2026-06-02T13:58:20Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -200, pPct: -11.1, r: 0, v: 109, days: 7 },
  lead: leadOf('purchased', '2026-06-05T16:20:00Z', {
    notes: 'first test buy', buyPrice: 1125, qty: 24, supplier: 'Walmart clearance', orderRef: 'PO-0042',
  }),
  tags: ['tier-A'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-04-07T11:20:09Z'),
  firstRunId: 's_A3K9XELT4QZ6M2_1743938400000',
});

// delta, rejected
await products.doc('B0DJH2N4XS').set({
  asin: 'B0DJH2N4XS',
  mk: 'US',
  name: 'Zulay Kitchen Milk Frother',
  img: img('61zulayMF'),
  url: 'https://www.amazon.com/dp/B0DJH2N4XS',
  latest: { p: 899, r: 4.0, v: 153, pr: 1, rk: 50, b: 200,
            at: ts('2026-06-09T14:03:46Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 999, r: 4.1, v: 150, rk: 44,
          at: ts('2026-06-02T13:59:41Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -100, pPct: -10.0, r: -0.1, v: 3, days: 7 },
  lead: leadOf('rejected', '2026-06-09T18:55:00Z', {
    rejectedReason: 'price too low to clear ROI after fees',
  }),
  tags: [],
  sourceIds: SRC,
  firstSeenAt: ts('2026-05-05T09:14:33Z'),
  firstRunId: RUN1,
});

// delta, archived; also discovered via the keyword source
await products.doc('B0E8M1R6TW').set({
  asin: 'B0E8M1R6TW',
  mk: 'US',
  name: 'Soundcore by Anker P20i Wireless Earbuds',
  img: img('61ankerP20i'),
  url: 'https://www.amazon.com/dp/B0E8M1R6TW',
  latest: { p: 1299, r: 4.6, v: 2871, pr: 1, rk: 52,
            at: ts('2026-06-09T14:03:46Z'), runId: RUN2, dayKey: '2026-06-09' },
  prev: { p: 1399, r: 4.6, v: 2790, rk: 58,
          at: ts('2026-06-02T13:59:41Z'), runId: RUN1, dayKey: '2026-06-02' },
  delta: { p: -100, pPct: -7.1, r: 0, v: 81, days: 7 },
  lead: leadOf('archived', '2026-05-20T10:00:00Z'),
  tags: [],
  sourceIds: ['s_A3K9XELT4QZ6M2', 'k_wireless-earbuds'],
  firstSeenAt: ts('2026-05-05T09:14:33Z'),
  firstRunId: RUN1,
});

// no delta (new this run, parse failure -> latest.p omitted)
await products.doc('B0DQZJ8R4W').set({
  asin: 'B0DQZJ8R4W',
  mk: 'US',
  name: 'Joseph Joseph Nest 9-Piece Mixing Bowl Set',
  img: img('71jjNest9'),
  url: 'https://www.amazon.com/dp/B0DQZJ8R4W',
  latest: { r: 4.1, v: 233, pr: 0, rk: 111,
            at: ts('2026-06-09T14:04:53Z'), runId: RUN2, dayKey: '2026-06-09' },
  lead: leadOf('new', '2026-06-09T14:04:53Z'),
  tags: [],
  sourceIds: SRC,
  firstSeenAt: ts('2026-06-09T14:04:53Z'),
  firstRunId: RUN2,
});

// no delta (new this run, parse failure -> latest.p omitted)
await products.doc('B0F1K7M3Q9').set({
  asin: 'B0F1K7M3Q9',
  mk: 'US',
  name: 'Farberware Dishwasher-Safe Knife Block Set',
  img: img('71farberKB'),
  url: 'https://www.amazon.com/dp/B0F1K7M3Q9',
  latest: { r: 3.9, v: 41, pr: 0, rk: 5,
            at: ts('2026-06-09T14:02:40Z'), runId: RUN2, dayKey: '2026-06-09' },
  lead: leadOf('new', '2026-06-09T14:02:40Z'),
  tags: [],
  sourceIds: SRC,
  firstSeenAt: ts('2026-06-09T14:02:40Z'),
  firstRunId: RUN2,
});

// no delta, rejected
await products.doc('B0BVC7G3LP').set({
  asin: 'B0BVC7G3LP',
  mk: 'US',
  name: 'Ninja Air Fryer Pro 5qt',
  img: img('81ninjaAF5'),
  url: 'https://www.amazon.com/dp/B0BVC7G3LP',
  latest: { p: 4599, lp: 5499, r: 4.3, v: 322, pr: 0, rk: 51,
            at: ts('2026-06-09T14:03:46Z'), runId: RUN2, dayKey: '2026-06-09' },
  lead: leadOf('rejected', '2026-06-09T19:01:00Z', { rejectedReason: 'gated brand' }),
  tags: ['kitchen'],
  sourceIds: SRC,
  firstSeenAt: ts('2026-06-09T14:03:46Z'),
  firstRunId: RUN2,
});

// no delta, archived
await products.doc('B07PL9S2QF').set({
  asin: 'B07PL9S2QF',
  mk: 'US',
  name: 'Chef Craft Silicone Spatula Set',
  img: img('61chefcraftSp'),
  url: 'https://www.amazon.com/dp/B07PL9S2QF',
  latest: { p: 759, r: 3.8, v: 67, pr: 1, rk: 53, st: 5,
            at: ts('2026-06-09T14:03:46Z'), runId: RUN2, dayKey: '2026-06-09' },
  lead: leadOf('archived', '2026-06-09T21:00:00Z'),
  tags: [],
  sourceIds: SRC,
  firstSeenAt: ts('2026-06-09T14:03:46Z'),
  firstRunId: RUN2,
});

// ── history/daily (§4.7) — az is NUMERIC 0/1 in history points ───────────────
// 4.7 verbatim example.
await products.doc('B0C8XL4N2P').collection('history').doc('daily').set({
  asin: 'B0C8XL4N2P',
  d: {
    '2026-04-07': { p: 2799, r: 4.4, v: 1103, rk: 22 },
    '2026-05-05': { p: 2649, r: 4.5, v: 1190, rk: 15,
                    sc: 11, md: 2399, cv: 0.14, oc: 11, fba: 7, az: 0 },
    '2026-06-09': { p: 2399, lp: 3299, r: 4.6, v: 1873, rk: 12, b: 400,
                    sc: 14, mn: 1849, mx: 3399, md: 2245, cv: 0.21, oc: 14, fba: 9, az: 0 },
  },
});

await products.doc('B0B7QK9M1T').collection('history').doc('daily').set({
  asin: 'B0B7QK9M1T',
  d: {
    '2026-05-05': { p: 2249, r: 4.1, v: 38, rk: 120 },
    '2026-06-02': { p: 2099, r: 4.2, v: 64, rk: 102 },
    '2026-06-09': { p: 1899, r: 4.2, v: 76, rk: 97,
                    sc: 6, mn: 1699, mx: 2399, md: 1899, cv: 0.11, oc: 6, fba: 4, az: 0 },
  },
});

await products.doc('B0CN5P2W7H').collection('history').doc('daily').set({
  asin: 'B0CN5P2W7H',
  d: {
    '2026-06-02': { p: 3599, r: 4.4, v: 598, rk: 6 },
    '2026-06-09': { p: 3249, r: 4.4, v: 612, rk: 3,
                    sc: 9, mn: 2999, mx: 3899, md: 3249, cv: 0.09, oc: 9, fba: 7, az: 1 },
  },
});

await products.doc('B08ZQR5V1M').collection('history').doc('daily').set({
  asin: 'B08ZQR5V1M',
  d: {
    '2026-05-05': { p: 2399, r: 4.8, v: 2105, rk: 7 },
    '2026-06-02': { p: 2499, r: 4.8, v: 2230, rk: 4 },
    '2026-06-09': { p: 2750, lp: 2999, r: 4.8, v: 2304, rk: 4,
                    sc: 11, mn: 2399, mx: 3199, md: 2699, cv: 0.16, oc: 11, fba: 5, az: 0 },
  },
});

// ── offerSnapshots (§4.8 verbatim) — cold raw AOD capture, TTL ───────────────
await products.doc('B0C8XL4N2P').collection('offerSnapshots').doc(RUN2).set({
  at: ts('2026-06-09T14:11:02Z'),
  expireAt: plus400d('2026-06-09T14:11:02Z'), // 2027-07-14T14:11:02Z
  prices: [1849, 1999, 1999, 2199, 2245, 2399, 2450, 2599, 2799, 3399], // condition=new only; NOT deduped
  totalOfferCount: 14, // AOD header count — AOD renders only ~10 offers; header is truth
  offers: [
    { sid: 'A9XK2M4L1P8Q', name: 'KitchenDealsCo', p: 2245, ship: 0,   fba: 1, bb: 1, cond: 'new' },
    { sid: 'A2QW8R5T9Y3Z', name: 'ToyLiquidators', p: 1849, ship: 499, fba: 0, bb: 0, cond: 'new' },
  ],
});

// ── sellers (§4.9 verbatim — no counter fields) ──────────────────────────────
await ws.collection('sellers').doc('A2QW8R5T9Y3Z').set({
  sellerId: 'A2QW8R5T9Y3Z',
  name: 'ToyLiquidators',
  asins: ['B0C8XL4N2P', 'B0B7QK9M1T'],
  storefrontUrl: 'https://www.amazon.com/s?me=A2QW8R5T9Y3Z',
  lastSeenAt: ts('2026-06-09T14:11:02Z'),
  watchlisted: false,
});

// ── rules / views / events (§4.10 verbatim) ──────────────────────────────────
await ws.collection('rules').doc('default').set({
  name: 'Cautious first flip',
  preset: 'cautious-first-flip',
  autoReject: false,
  conditions: [
    { field: 'latest.p',  op: '>=', value: 1500 },
    { field: 'latest.p',  op: '<=', value: 5000 },
    { field: 'latest.r',  op: '>=', value: 4.0 },
    { field: 'latest.v',  op: '>=', value: 50 },
    { field: 'spread.fba', op: '<=', value: 8 },
    { field: 'spread.az', op: '==', value: false },
    { field: 'spread.cv', op: '>=', value: 0.15 },
  ],
});

await ws.collection('views').doc('v_greens').set({
  name: "Maria's queue",
  filterSpec: { 'verdict.status': 'pass', 'lead.stage': 'reviewing' },
  columns: ['name', 'latest.p', 'delta.pPct', 'spread.md', 'scores.maxBuy'],
  pinned: true,
});

// {epochMs}_{rand4} event id — fixed so re-seeding stays idempotent.
await products.doc('B0C8XL4N2P').collection('events').doc('1749500000000_k3xq').set({
  type: 'stageChange',
  from: 'new',
  to: 'reviewing',
  at: ts('2026-06-08T19:30:00Z'),
  note: 'good CV, crowded but watch',
});

console.log('seed complete:');
console.log('  users: 1, workspaces: 1, sources: 2, runs: 2, pages: 3');
console.log('  products: 12, history/daily: 4, offerSnapshots: 1');
console.log('  sellers: 1, rules: 1, views: 1, events: 1');
console.log(`  workspace: workspaces/${WID} (dev@proscan.test / proscan-dev)`);
