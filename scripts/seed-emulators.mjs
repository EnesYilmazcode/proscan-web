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

// Deterministic inline-SVG monogram thumbnails (fake Amazon CDN slugs 404
// and spam the browser console / break screenshots). Same slug -> same data
// URI, so re-seeding stays byte-identical.
const IMG_PALETTE = ['#f0c14b', '#0a7d4f', '#2a6f97', '#7d5ba6', '#b35c00', '#5a646e'];
const img = (slug) => {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 997;
  const bg = IMG_PALETTE[h % IMG_PALETTE.length];
  const txt = (slug.replace(/[^A-Za-z]/g, '').slice(0, 2) || 'PS').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
    `<rect width="64" height="64" rx="8" fill="${bg}"/>` +
    `<text x="32" y="42" font-family="monospace" font-size="26" font-weight="bold" text-anchor="middle" fill="#fff">${txt}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
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

// Weekly series (6 points) — the 2026-06-02 / 2026-06-09 values stay in
// lock-step with the product doc's prev / latest blocks above.
await products.doc('B0B7QK9M1T').collection('history').doc('daily').set({
  asin: 'B0B7QK9M1T',
  d: {
    '2026-05-05': { p: 2249, r: 4.1, v: 38, rk: 120 },
    '2026-05-12': { p: 2199, r: 4.1, v: 44, rk: 116 },
    '2026-05-19': { p: 2149, r: 4.2, v: 51, rk: 110 },
    '2026-05-26': { p: 2120, r: 4.2, v: 57, rk: 107 },
    '2026-06-02': { p: 2099, r: 4.2, v: 64, rk: 102 },
    '2026-06-09': { p: 1899, r: 4.2, v: 76, rk: 97,
                    sc: 6, mn: 1699, mx: 2399, md: 1899, cv: 0.11, oc: 6, fba: 4, az: 0 },
  },
});

await products.doc('B0CN5P2W7H').collection('history').doc('daily').set({
  asin: 'B0CN5P2W7H',
  d: {
    '2026-05-05': { p: 3699, r: 4.4, v: 561, rk: 9 },
    '2026-05-12': { p: 3649, r: 4.4, v: 570, rk: 8 },
    '2026-05-19': { p: 3599, r: 4.4, v: 581, rk: 8 },
    '2026-05-26': { p: 3580, r: 4.4, v: 590, rk: 7 },
    '2026-06-02': { p: 3599, r: 4.4, v: 598, rk: 6 },
    '2026-06-09': { p: 3249, r: 4.4, v: 612, rk: 3,
                    sc: 9, mn: 2999, mx: 3899, md: 3249, cv: 0.09, oc: 9, fba: 7, az: 1 },
  },
});

await products.doc('B08ZQR5V1M').collection('history').doc('daily').set({
  asin: 'B08ZQR5V1M',
  d: {
    '2026-05-05': { p: 2399, r: 4.8, v: 2105, rk: 7 },
    '2026-05-12': { p: 2449, r: 4.8, v: 2141, rk: 6 },
    '2026-05-19': { p: 2399, r: 4.8, v: 2178, rk: 5 },
    '2026-05-26': { p: 2475, r: 4.8, v: 2204, rk: 5 },
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

// ════════════════════════════════════════════════════════════════════════════
// QA ENRICHMENT FIXTURES — integration-test breadth. Idempotent fixed IDs,
// deterministic values (no RNG), data-model.md §4 shapes throughout.
// ~40 products across both sources, ~15 weekly history series (6–10 points),
// ~10 full spread/scores/verdict blocks, varied lead stages/tags, plus two
// extra storefront run headers (one live 'active' 4/9) and one keyword run.
// ════════════════════════════════════════════════════════════════════════════

const SF = 's_A3K9XELT4QZ6M2';
const KW = 'k_wireless-earbuds';

const RUN0 = 's_A3K9XELT4QZ6M2_1779544860000'; // dayKey 2026-05-26 (complete)
const RUN3 = 's_A3K9XELT4QZ6M2_1781081232000'; // dayKey 2026-06-11 (ACTIVE 4/9)
const KRUN = 'k_wireless-earbuds_1781001000000'; // dayKey 2026-06-10 (complete)
// Older keyword run whose header was trimmed — referenced by prev.runId /
// firstRunId on keyword products only (the dashboard never joins on it).
const KRUN_PREV = 'k_wireless-earbuds_1780396320000';

const RUN1_AT = '2026-06-02T13:59:41Z';
const RUN2_AT = '2026-06-09T14:04:53Z';
const KRUN_AT = '2026-06-10T10:38:21Z';
const KPREV_AT = '2026-06-03T10:32:11Z';

// ── extra runs (§4.4) ────────────────────────────────────────────────────────
await ws.collection('runs').doc(RUN0).set({
  runId: RUN0,
  sourceId: SF,
  source: runSource,
  mk: 'US',
  dayKey: '2026-05-26',
  startedAt: ts('2026-05-26T14:01:00Z'),
  finishedAt: ts('2026-05-26T14:15:48Z'),
  status: 'complete',
  pagesDone: 9,
  pagesPlanned: 9,
  totalResultsOnSerp: 409,
  counters: { placements: 438, uniqueAsins: 405, sponsored: 31, priceParseFailures: 2, newSeen: 7 },
  label: 'Baseline crawl',
});

// The live run — drives the active StatusDot pulse + gold progress bar.
// startedAt is the seed's ONE wall-clock-relative value (doc ID stays fixed,
// so re-seeding never duplicates): an 'active' run must read like a scan
// that began minutes ago and bucket under "Today" whenever it is seeded.
const RUN3_STARTED = Timestamp.fromMillis(Date.now() - 6 * 60 * 1000);
await ws.collection('runs').doc(RUN3).set({
  runId: RUN3,
  sourceId: SF,
  source: runSource,
  mk: 'US',
  dayKey: new Date(RUN3_STARTED.toMillis()).toISOString().slice(0, 10),
  startedAt: RUN3_STARTED,
  finishedAt: null,
  status: 'active',
  pagesDone: 4,
  pagesPlanned: 9,
  totalResultsOnSerp: 412,
  counters: { placements: 196, uniqueAsins: 187, sponsored: 14, priceParseFailures: 1, newSeen: 3 },
  label: null,
});

await ws.collection('runs').doc(KRUN).set({
  runId: KRUN,
  sourceId: KW,
  source: {
    type: 'keyword',
    sellerId: null,
    keyword: 'wireless earbuds',
    url: 'https://www.amazon.com/s?k=wireless+earbuds',
  },
  mk: 'US',
  dayKey: '2026-06-10',
  startedAt: ts('2026-06-10T10:30:00Z'),
  finishedAt: ts('2026-06-10T10:41:30Z'),
  status: 'complete',
  pagesDone: 7,
  pagesPlanned: 7,
  totalResultsOnSerp: 1184,
  counters: { placements: 322, uniqueAsins: 286, sponsored: 58, priceParseFailures: 2, newSeen: 41 },
  label: null,
});

// Keyword source has now been scanned — mirror the run onto its watch fields.
await ws.collection('sources').doc(KW).set(
  {
    catalogSize: 1184,
    lastRunId: KRUN,
    lastScrapedAt: ts('2026-06-10T10:41:30Z'),
  },
  { merge: true },
);

// ── enriched products (§4.6/§4.7) — spec-driven, deterministic ───────────────

/** Weekly dayKeys ascending, ending at endKey. */
const weeklyKeys = (endKey, n) => {
  const end = Date.parse(`${endKey}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(end - (n - 1 - i) * 7 * 86400000).toISOString().slice(0, 10),
  );
};

/** Deterministic ±50¢ wobble derived from the ASIN — no RNG, so re-seeding
 *  produces byte-identical history series. */
const wob = (asin, i) =>
  (((asin.charCodeAt(2) + asin.charCodeAt(5) + i * 7) % 5) - 2) * 25;

const round5 = (n) => Math.round(n / 5) * 5;

/**
 * Writes one product doc (+ optional history/daily) from a compact spec:
 * { asin, name, p, lp?, r, v, rk, b?, pr?, src: 'sf'|'kw'|'both',
 *   weeks?  — >=2 seeds a weekly history/daily series ending at the latest run,
 *   startP? — first history price (default p × 1.14),
 *   prevP?  — forces prev.p (and the second-to-last history point),
 *   spread? — {sc,mn,mx,md,cv,fba,az,status,fired,opp,maxBuy,...} -> full
 *             spread + scores + verdict blocks,
 *   stage?, stageAt?, leadExtra?, tags? }
 * No weeks and no prevP -> "new this run" (no prev/delta), like §4.6.
 */
async function seedEnriched(spec) {
  const kw = spec.src === 'kw';
  const sourceIds = spec.src === 'both' ? [SF, KW] : kw ? [KW] : [SF];
  const endKey = kw ? '2026-06-10' : '2026-06-09';
  const prevKey = kw ? '2026-06-03' : '2026-06-02';
  const latestRun = kw ? KRUN : RUN2;
  const prevRun = kw ? KRUN_PREV : RUN1;
  const latestAtIso = kw ? KRUN_AT : RUN2_AT;
  const prevAtIso = kw ? KPREV_AT : RUN1_AT;
  const spreadAtIso = kw ? '2026-06-10T10:44:02Z' : '2026-06-09T14:11:02Z';
  const verdictAtIso = kw ? '2026-06-10T18:02:00Z' : '2026-06-09T18:02:00Z';

  const weeks = spec.weeks ?? 0;

  const latest = {
    p: spec.p,
    r: spec.r,
    v: spec.v,
    pr: spec.pr ?? 1,
    rk: spec.rk,
    at: ts(latestAtIso),
    runId: latestRun,
    dayKey: endKey,
  };
  if (spec.lp) latest.lp = spec.lp;
  if (spec.b) latest.b = spec.b;

  let historyD = null;
  let prevPoint = null;

  if (weeks >= 2) {
    const keys = weeklyKeys(endKey, weeks);
    const p0 = spec.startP ?? round5(Math.round(spec.p * 1.14));
    const prices = keys.map((_, i) => {
      if (i === keys.length - 1) return spec.p;
      const t = i / (keys.length - 1);
      return Math.max(99, round5(p0 + (spec.p - p0) * t) + wob(spec.asin, i));
    });
    if (spec.prevP !== undefined) prices[keys.length - 2] = spec.prevP;
    const vStep = Math.max(1, Math.round(spec.v * 0.012));
    const rAt = (i) =>
      Math.round((spec.r - 0.1 * Math.min(2, keys.length - 1 - i)) * 10) / 10;
    historyD = {};
    keys.forEach((k, i) => {
      const point = {
        p: prices[i],
        r: rAt(i),
        v: spec.v - (keys.length - 1 - i) * vStep,
        rk: spec.rk + (keys.length - 1 - i),
      };
      if (i === keys.length - 1) {
        if (spec.lp) point.lp = spec.lp;
        if (spec.b) point.b = spec.b;
        if (spec.spread) {
          const s = spec.spread;
          // az is NUMERIC 0/1 in history points (boolean only on product.spread)
          Object.assign(point, {
            sc: s.sc, mn: s.mn, mx: s.mx, md: s.md, cv: s.cv,
            oc: s.oc ?? s.sc, fba: s.fba, az: s.az ? 1 : 0,
          });
        }
      }
      historyD[k] = point;
    });
    prevPoint = {
      p: prices[keys.length - 2],
      r: rAt(keys.length - 2),
      v: spec.v - vStep,
      rk: spec.rk + 1,
      at: ts(prevAtIso),
      runId: prevRun,
      dayKey: prevKey,
    };
  } else if (spec.prevP !== undefined) {
    prevPoint = {
      p: spec.prevP,
      r: spec.prevR ?? spec.r,
      v: Math.max(0, spec.v - Math.max(1, Math.round(spec.v * 0.012))),
      rk: spec.rk + 2,
      at: ts(prevAtIso),
      runId: prevRun,
      dayKey: prevKey,
    };
  }

  const docData = {
    asin: spec.asin,
    mk: 'US',
    name: spec.name,
    img: img(spec.asin),
    url: `https://www.amazon.com/dp/${spec.asin}`,
    latest,
    lead: leadOf(spec.stage ?? 'new', spec.stageAt ?? latestAtIso, spec.leadExtra ?? {}),
    tags: spec.tags ?? [],
    sourceIds,
    firstSeenAt: ts(
      weeks >= 2 ? `${weeklyKeys(endKey, weeks)[0]}T12:00:00Z` : latestAtIso,
    ),
    firstRunId:
      weeks >= 2 || prevPoint
        ? kw
          ? KRUN_PREV
          : 's_A3K9XELT4QZ6M2_1743938400000'
        : latestRun,
  };

  if (prevPoint) {
    docData.prev = prevPoint;
    docData.delta = {
      p: spec.p - prevPoint.p,
      pPct: Math.round(((spec.p - prevPoint.p) / prevPoint.p) * 1000) / 10,
      r: Math.round((spec.r - prevPoint.r) * 10) / 10,
      v: spec.v - prevPoint.v,
      days: 7,
    };
  }

  if (spec.spread) {
    const s = spec.spread;
    const oc = s.oc ?? s.sc;
    const opp = s.opp ?? 5.0;
    const arb = s.arb ?? Math.round(opp * 9) / 10;
    docData.spread = {
      sc: s.sc,
      mn: s.mn,
      mx: s.mx,
      md: s.md,
      mean: s.mean ?? Math.round((s.mn + s.mx + 2 * s.md) / 4),
      sd: s.sd ?? Math.round((s.mx - s.mn) / 4),
      cv: s.cv,
      iqr: s.iqr ?? Math.round((s.mx - s.mn) / 3),
      oc,
      fba: s.fba,
      fbm: oc - s.fba,
      az: s.az ?? false, // BOOLEAN on the product doc
      bb: { p: s.bb ?? s.md, sellerId: s.bbSeller ?? 'A9XK2M4L1P8Q', fba: s.bbFba ?? true },
      at: ts(spreadAtIso),
      runId: latestRun,
    };
    docData.scores = {
      opportunity: opp,
      arbitrage: arb,
      combined: Math.round((opp * 0.6 + arb * 0.4) * 10) / 10,
      maxBuy: s.maxBuy ?? round5(Math.round(s.md * 0.58)),
      at: ts(spreadAtIso),
    };
    docData.verdict = {
      status: s.status ?? 'pass',
      ruleSetId: 'default',
      fired: s.fired ?? null,
      at: ts(verdictAtIso),
    };
  }

  await products.doc(spec.asin).set(docData);
  if (historyD) {
    await products
      .doc(spec.asin)
      .collection('history')
      .doc('daily')
      .set({ asin: spec.asin, d: historyD });
  }
}

const ENRICHED = [
  // ── storefront (BrickHouse Deals — kitchen) ────────────────────────────────
  { asin: 'B0G4WN8XQ1', src: 'sf', name: 'KitchenAid Classic 4.5qt Stand Mixer', p: 27999, lp: 32999, r: 4.7, v: 8412, rk: 7, weeks: 8,
    spread: { sc: 17, mn: 25900, mx: 33900, md: 27950, cv: 0.18, fba: 11, az: true, status: 'warn', fired: 'Amazon on listing', opp: 6.4, maxBuy: 16210 },
    stage: 'reviewing', stageAt: '2026-06-09T19:12:00Z', tags: ['kitchen', 'premium'] },
  { asin: 'B0H2TR5MK8', src: 'sf', name: 'Pyrex 18-Piece Glass Food Storage Set', p: 3499, lp: 4499, r: 4.8, v: 12044, rk: 9, weeks: 10,
    spread: { sc: 12, mn: 3199, mx: 4699, md: 3549, cv: 0.17, fba: 8, az: false, status: 'pass', opp: 7.8, maxBuy: 2060 },
    stage: 'approved', stageAt: '2026-06-10T08:30:00Z', tags: ['kitchen', 'tier-A'] },
  { asin: 'B09KQW7Y3D', src: 'sf', name: 'Instant Pot Duo 7-in-1 Pressure Cooker 6qt', p: 7999, lp: 9999, r: 4.7, v: 154211, rk: 2, b: 5000, weeks: 9,
    spread: { sc: 21, mn: 6999, mx: 9899, md: 7949, cv: 0.16, fba: 13, az: false, status: 'pass', opp: 8.1, maxBuy: 4610 },
    stage: 'reviewing', stageAt: '2026-06-09T20:01:00Z', tags: ['kitchen', 'tier-A'] },
  { asin: 'B0FJX3P8VL', src: 'sf', name: 'Rubbermaid Brilliance 10pc Pantry Set', p: 2899, r: 4.9, v: 3320, rk: 21, prevP: 3199,
    stage: 'new', tags: ['kitchen'] },
  { asin: 'B08MV4N6TQ', src: 'sf', name: 'Hamilton Beach 2-Slice Toaster', p: 2249, lp: 2799, r: 4.4, v: 9870, rk: 33, weeks: 6, startP: 2999, prevP: 2799,
    stage: 'rejected', stageAt: '2026-06-09T21:14:00Z', leadExtra: { rejectedReason: 'margin too thin after fees' }, tags: ['budget'] },
  { asin: 'B0CYD8K2RH', src: 'sf', name: 'Le Creuset Silicone Spatula Craft Series', p: 1450, r: 4.8, v: 540, rk: 75, prevP: 1450,
    stage: 'approved', stageAt: '2026-06-08T15:00:00Z', tags: ['kitchen', 'premium'] },
  { asin: 'B07GN5XW2B', src: 'sf', name: 'OXO Good Grips Salad Spinner', p: 2999, r: 4.8, v: 21055, rk: 14, weeks: 8,
    stage: 'purchased', stageAt: '2026-06-07T11:40:00Z',
    leadExtra: { buyPrice: 1850, qty: 18, supplier: 'HomeGoods', orderRef: 'PO-0044' }, tags: ['kitchen', 'tier-A'] },
  { asin: 'B0DKR7L4WX', src: 'sf', name: 'ThermoPro TP19 Instant-Read Meat Thermometer', p: 1699, lp: 2499, r: 4.6, v: 28930, rk: 11, b: 3000, weeks: 9,
    spread: { sc: 9, mn: 1549, mx: 2199, md: 1699, cv: 0.08, fba: 6, az: false, status: 'warn', fired: 'CV 0.08 < min 0.15', opp: 4.6, maxBuy: 985 },
    stage: 'reviewing', stageAt: '2026-06-10T07:55:00Z', tags: ['kitchen'] },
  { asin: 'B0BHT6Q9ZF', src: 'sf', name: 'Caraway Nonstick Ceramic Frying Pan 10.5"', p: 9500, lp: 10500, r: 4.5, v: 1860, rk: 41,
    stage: 'new', tags: ['premium'] },
  { asin: 'B09ZV3M8LD', src: 'sf', name: 'Brita Standard 10-Cup Water Pitcher', p: 1899, r: 4.6, v: 88412, rk: 5, b: 10000, prevP: 1799,
    stage: 'archived', stageAt: '2026-05-30T09:00:00Z', tags: [] },
  { asin: 'B0AQN2C7JS', src: 'sf', name: 'Simple Modern 24oz Insulated Tumbler', p: 1799, lp: 2199, r: 4.7, v: 6230, rk: 17, weeks: 8,
    spread: { sc: 13, mn: 1599, mx: 2399, md: 1849, cv: 0.19, fba: 7, az: false, status: 'pass', opp: 7.1, maxBuy: 1070 },
    stage: 'approved', stageAt: '2026-06-09T22:05:00Z', tags: ['kitchen', 'q3'] },
  { asin: 'B08WJR9T4Y', src: 'sf', name: 'Bentgo Kids Leak-Proof Lunch Box', p: 2799, lp: 3999, r: 4.8, v: 33120, rk: 25, prevP: 2999,
    stage: 'reviewing', stageAt: '2026-06-09T18:47:00Z',
    leadExtra: { notes: 'school season Q3 ramp — recheck stock depth' }, tags: ['tier-A'] },
  { asin: 'B0EYW5H8NC', src: 'sf', name: 'Misen 8" Chef\'s Knife', p: 6500, r: 4.7, v: 990, rk: 88,
    stage: 'new', tags: ['premium'] },
  { asin: 'B07ZSD4Q1V', src: 'sf', name: 'Crock-Pot 7qt Oval Slow Cooker', p: 3499, lp: 4499, r: 4.7, v: 41200, rk: 19, prevP: 3299,
    stage: 'rejected', stageAt: '2026-06-09T19:30:00Z', leadExtra: { rejectedReason: 'seasonal demand only' }, tags: ['kitchen'] },
  { asin: 'B0CGL9X2TM', src: 'sf', name: 'Vitamix E310 Explorian Blender', p: 28995, lp: 34995, r: 4.7, v: 11540, rk: 12, weeks: 10,
    spread: { sc: 8, mn: 27500, mx: 31999, md: 28995, cv: 0.05, fba: 6, az: false, status: 'warn', fired: 'CV 0.05 < min 0.15', opp: 3.9, maxBuy: 16820 },
    stage: 'purchased', stageAt: '2026-06-06T10:22:00Z',
    leadExtra: { buyPrice: 19999, qty: 4, supplier: 'Costco roadshow', orderRef: 'PO-0045' },
    tags: ['kitchen', 'premium', 'tier-A'] },
  { asin: 'B06XKP3R8M', src: 'sf', name: 'Lodge 6qt Enameled Dutch Oven', p: 7990, lp: 9995, r: 4.6, v: 17840, rk: 28, prevP: 8490,
    stage: 'new', tags: ['kitchen'] },

  // ── keyword ("wireless earbuds") ───────────────────────────────────────────
  { asin: 'B0KWX8N3JP', src: 'kw', name: 'Sony WF-1000XM5 Noise Canceling Earbuds', p: 24800, lp: 29999, r: 4.4, v: 9320, rk: 1, b: 2000, weeks: 8,
    stage: 'reviewing', stageAt: '2026-06-10T12:10:00Z', tags: ['audio', 'premium'] },
  { asin: 'B0JQM4T7RD', src: 'kw', name: 'Apple AirPods Pro 2 (USB-C)', p: 18999, lp: 24900, r: 4.7, v: 124550, rk: 2, b: 10000, weeks: 10, startP: 24900,
    stage: 'rejected', stageAt: '2026-06-10T13:02:00Z', leadExtra: { rejectedReason: 'gated brand' }, tags: ['audio'] },
  { asin: 'B0HPL2V9KX', src: 'kw', name: 'Samsung Galaxy Buds3', p: 11999, lp: 17999, r: 4.5, v: 8120, rk: 3, prevP: 13499,
    stage: 'reviewing', stageAt: '2026-06-10T12:30:00Z', tags: ['audio'] },
  { asin: 'B0GTZ6W4QN', src: 'kw', name: 'Beats Studio Buds Plus', p: 12995, lp: 16995, r: 4.4, v: 41230, rk: 5, prevP: 12995,
    stage: 'new', tags: ['audio'] },
  { asin: 'B0FDK9R2MV', src: 'kw', name: 'JLab Go Air Pop True Wireless Earbuds', p: 1988, lp: 2499, r: 4.4, v: 230540, rk: 6, b: 10000, weeks: 9,
    stage: 'approved', stageAt: '2026-06-10T14:15:00Z', tags: ['audio', 'budget'] },
  { asin: 'B0ENB5X8WT', src: 'kw', name: 'TOZO T6 Wireless Earbuds', p: 2399, lp: 3599, r: 4.4, v: 312080, rk: 8, weeks: 8,
    stage: 'purchased', stageAt: '2026-06-05T09:18:00Z',
    leadExtra: { buyPrice: 1500, qty: 30, supplier: 'AliExpress sample', orderRef: 'PO-0046' }, tags: ['audio', 'budget'] },
  { asin: 'B0DRC3K7LH', src: 'kw', name: 'Skullcandy Dime 3 In-Ear Earbuds', p: 2488, r: 4.3, v: 18450, rk: 11,
    stage: 'new', tags: ['budget'] },
  { asin: 'B0CVF7M1XS', src: 'kw', name: 'Bose QuietComfort Ultra Earbuds', p: 24900, lp: 29900, r: 4.3, v: 6890, rk: 4, weeks: 7,
    stage: 'reviewing', stageAt: '2026-06-10T15:44:00Z',
    leadExtra: { notes: 'price floor watch — MAP enforced?' }, tags: ['audio', 'premium'] },
  { asin: 'B0BXG5T9PW', src: 'kw', name: 'Anker Soundcore Life P3 Earbuds', p: 6999, lp: 7999, r: 4.5, v: 28760, rk: 9, prevP: 7499,
    stage: 'archived', stageAt: '2026-06-01T17:00:00Z', tags: ['audio'] },
  { asin: 'B0AHJ8Q4ZC', src: 'kw', name: 'JBL Tune Flex True Wireless Earbuds', p: 6995, lp: 9995, r: 4.4, v: 11290, rk: 12,
    stage: 'new', tags: ['audio'] },
  { asin: 'B09WSN6Y2F', src: 'kw', name: 'Raycon Everyday Earbuds', p: 7999, lp: 11999, r: 4.3, v: 71230, rk: 14, prevP: 7499,
    stage: 'rejected', stageAt: '2026-06-10T16:20:00Z', leadExtra: { rejectedReason: 'review velocity stalling' }, tags: ['audio'] },
];

for (const spec of ENRICHED) await seedEnriched(spec);

const enrichedHistories = ENRICHED.filter((s) => (s.weeks ?? 0) >= 2).length;

console.log('seed complete:');
console.log('  users: 1, workspaces: 1, sources: 2, runs: 5, pages: 3');
console.log(`  products: ${12 + ENRICHED.length}, history/daily: ${4 + enrichedHistories}, offerSnapshots: 1`);
console.log('  sellers: 1, rules: 1, views: 1, events: 1');
console.log(`  workspace: workspaces/${WID} (dev@proscan.test / proscan-dev)`);
