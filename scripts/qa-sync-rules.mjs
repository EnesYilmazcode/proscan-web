// Emulator integration QA — proves the ProScan extension's cloud-sync writes
// (scripts/background/sync.js :: syncToCloud) are ACCEPTED by the deployed
// firestore.rules, and that cross-tenant writes are DENIED.
//
// Uses the firebase WEB SDK (NOT firebase-admin) so security rules are
// ENFORCED on every call — admin bypasses rules and would prove nothing.
//
// Connects ONLY to the local emulator suite (auth 9099, firestore 8080).
// Run:  node scripts/qa-sync-rules.mjs   (emulator must be up)

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  writeBatch,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); };
const check = (name, cond, detail = '') => (cond ? pass(name, detail) : fail(name, detail));

// ── helpers faithful to sync.js shapes ───────────────────────────────────────
const round1 = (n) => Math.round(n * 10) / 10;
const intOrUndef = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : undefined);
const tsOf = (iso) => Timestamp.fromDate(new Date(iso));

function pointFrom(q) {
  const pt = {
    p: intOrUndef(q.priceCents),
    r: typeof q.rating === 'number' && q.rating > 0 ? round1(q.rating) : undefined,
    v: typeof q.reviewCount === 'number' && q.reviewCount > 0 ? Math.round(q.reviewCount) : undefined,
    pr: q.isPrime ? 1 : 0,
  };
  Object.keys(pt).forEach((k) => pt[k] === undefined && delete pt[k]);
  return pt;
}
function deltaBlock(q) {
  const d = q.delta;
  if (!d || d.isNew) return undefined;
  const out = {};
  if (typeof d.dPriceCents === 'number') {
    out.p = Math.round(d.dPriceCents);
    const prev = typeof q.priceCents === 'number' ? q.priceCents - d.dPriceCents : null;
    if (prev && prev !== 0) out.pPct = round1((d.dPriceCents / prev) * 100);
  }
  if (typeof d.dRating === 'number') out.r = round1(d.dRating);
  if (typeof d.dReviews === 'number') out.v = Math.round(d.dReviews);
  return Object.keys(out).length ? out : undefined;
}

/** Faithful port of sync.js :: syncToCloud — same four write types/shapes. */
async function syncToCloud(uid, bundle) {
  const queue = (bundle && bundle.syncQueue) || [];
  if (!queue.length) return { written: 0, runId: null, products: 0 };

  const meta = (bundle && bundle.scrapeRunMeta) || {};
  const sourceId = meta.sellerId ? `s_${meta.sellerId}` : meta.keyword
    ? `k_${String(meta.keyword).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
    : 'k_unknown';
  const startMs = meta.startedAt ? Date.parse(meta.startedAt) : Date.now();
  const runId = `${sourceId}_${startMs}`;
  const dayKey = new Date(startMs).toISOString().slice(0, 10);
  const mk = 'US';

  let products = 0;
  const batch = writeBatch(db);
  for (const q of queue) {
    if (!q || !q.asin) continue;
    const at = q.scrapedAt ? tsOf(q.scrapedAt) : serverTimestamp();
    const payload = {
      asin: q.asin,
      mk,
      name: q.name,
      url: q.url,
      latest: { ...pointFrom(q), at, runId, dayKey },
      sourceIds: arrayUnion(sourceId),
    };
    const d = deltaBlock(q);
    if (d) payload.delta = d;
    if (q.delta && q.delta.isNew) {
      payload.firstSeenAt = at;
      payload.firstRunId = runId;
    }
    // WRITE 1: products/{asin}
    batch.set(doc(db, 'workspaces', uid, 'products', q.asin), payload, { merge: true });
    // WRITE 2: products/{asin}/history/daily
    batch.set(
      doc(db, 'workspaces', uid, 'products', q.asin, 'history', 'daily'),
      { asin: q.asin, d: { [dayKey]: pointFrom(q) } },
      { merge: true },
    );
    products++;
  }
  await batch.commit();

  const head = writeBatch(db);
  // WRITE 3: runs/{runId}
  head.set(
    doc(db, 'workspaces', uid, 'runs', runId),
    {
      runId,
      sourceId,
      source: { type: meta.type || 'keyword', sellerId: meta.sellerId ?? null, keyword: meta.keyword ?? null, url: meta.url ?? null },
      mk,
      dayKey,
      startedAt: meta.startedAt ? tsOf(meta.startedAt) : serverTimestamp(),
      finishedAt: serverTimestamp(),
      status: 'complete',
      pagesDone: bundle.scrapeRunPages ? bundle.scrapeRunPages.length : null,
      pagesPlanned: bundle.scrapeRunPages ? bundle.scrapeRunPages.length : null,
      counters: {
        placements: queue.length,
        uniqueAsins: new Set(queue.map((q) => q.asin)).size,
        sponsored: 0,
        priceParseFailures: queue.filter((q) => q.priceCents == null).length,
        newSeen: queue.filter((q) => q.delta && q.delta.isNew).length,
      },
    },
    { merge: true },
  );
  // WRITE 4: sources/{sourceId}
  head.set(
    doc(db, 'workspaces', uid, 'sources', sourceId),
    {
      sourceId,
      type: meta.type === 'storefront' ? 'storefront' : 'keyword',
      sellerId: meta.sellerId ?? null,
      keyword: meta.keyword ?? null,
      url: meta.url ?? null,
      lastRunId: runId,
      lastScrapedAt: meta.startedAt ? tsOf(meta.startedAt) : serverTimestamp(),
    },
    { merge: true },
  );
  await head.commit();

  return { written: products * 2 + 2, runId, products, sourceId, dayKey };
}

// ── sample producer queue: one NEW product + one RETURNING product ───────────
const bundle = {
  scrapeRunMeta: {
    type: 'storefront',
    sellerId: 'A3K9XELT4QZ6M2',
    keyword: null,
    url: 'https://www.amazon.com/s?me=A3K9XELT4QZ6M2',
    startedAt: '2026-06-21T10:00:00Z',
  },
  scrapeRunPages: [{ page: 1 }, { page: 2 }],
  syncQueue: [
    {
      // RETURNING item — has a delta block (price dropped 200c from 2599 -> 2399)
      asin: 'B0QASYNC01',
      name: 'QA Returning Tumbler 40oz',
      url: 'https://www.amazon.com/dp/B0QASYNC01',
      priceCents: 2399,
      rating: 4.6,
      reviewCount: 1873,
      isPrime: true,
      scrapedAt: '2026-06-21T10:04:53Z',
      delta: { isNew: false, dPriceCents: -200, dRating: 0.1, dReviews: 172 },
    },
    {
      // NEW item — first-sight stamps, no delta
      asin: 'B0QASYNC02',
      name: 'QA New Mixing Bowl Set',
      url: 'https://www.amazon.com/dp/B0QASYNC02',
      priceCents: 1599,
      rating: 4.1,
      reviewCount: 233,
      isPrime: false,
      scrapedAt: '2026-06-21T10:05:10Z',
      delta: { isNew: true },
    },
  ],
};

let exitCode = 0;
try {
  console.log('[auth] signing in test user A …');
  const emailA = `qa-sync-A-${Date.now()}@proscan.test`;
  let credA;
  try {
    credA = await createUserWithEmailAndPassword(auth, emailA, 'qa-pass-123');
  } catch (e) {
    credA = await signInWithEmailAndPassword(auth, emailA, 'qa-pass-123');
  }
  const uidA = credA.user.uid;
  console.log(`  uid A = ${uidA}`);

  // ── POSITIVE: sync into the owner's own workspace ──────────────────────────
  console.log('\n[positive] syncToCloud(uidA) — faithful sync.js writes');
  let res;
  try {
    res = await syncToCloud(uidA, bundle);
    pass('all 4 write types committed (rules ACCEPTED)', `products=${res.products}, runId=${res.runId}`);
  } catch (e) {
    fail('writes rejected by rules', `${e.code || ''} ${e.message}`);
    throw e; // can't read back if writes failed
  }

  // ── READ-BACK each of the 4 write types ────────────────────────────────────
  console.log('\n[read-back] verifying each write type round-trips');

  // 1 · products/{asin} — returning (B0QASYNC01) with delta
  const p1 = await getDoc(doc(db, 'workspaces', uidA, 'products', 'B0QASYNC01'));
  check('WRITE 1 products/{asin} (returning) exists', p1.exists());
  if (p1.exists()) {
    const d = p1.data();
    check('  · asin field == doc id', d.asin === 'B0QASYNC01', `asin=${d.asin}`);
    check('  · latest.dayKey is string "2026-06-21"', d.latest?.dayKey === '2026-06-21', `dayKey=${d.latest?.dayKey}`);
    check('  · latest.p int == 2399', d.latest?.p === 2399, `p=${d.latest?.p}`);
    check('  · latest.v int == 1873', d.latest?.v === 1873, `v=${d.latest?.v}`);
    check('  · delta.p == -200, delta.pPct == -7.7', d.delta?.p === -200 && d.delta?.pPct === -7.7, `delta=${JSON.stringify(d.delta)}`);
    check('  · sourceIds arrayUnion has s_A3K9XELT4QZ6M2', Array.isArray(d.sourceIds) && d.sourceIds.includes('s_A3K9XELT4QZ6M2'), JSON.stringify(d.sourceIds));
    check('  · returning item has NO firstSeenAt stamp', d.firstSeenAt === undefined);
  }

  // 1b · products/{asin} — NEW (B0QASYNC02) with first-sight stamps
  const p2 = await getDoc(doc(db, 'workspaces', uidA, 'products', 'B0QASYNC02'));
  check('WRITE 1 products/{asin} (new) exists', p2.exists());
  if (p2.exists()) {
    const d = p2.data();
    check('  · new item stamped firstRunId', d.firstRunId === res.runId, `firstRunId=${d.firstRunId}`);
    check('  · new item has firstSeenAt timestamp', d.firstSeenAt instanceof Timestamp);
    check('  · new item has NO delta block', d.delta === undefined);
    check('  · latest.p int == 1599', d.latest?.p === 1599, `p=${d.latest?.p}`);
  }

  // 2 · products/{asin}/history/daily
  const h1 = await getDoc(doc(db, 'workspaces', uidA, 'products', 'B0QASYNC01', 'history', 'daily'));
  check('WRITE 2 products/{asin}/history/daily exists', h1.exists());
  if (h1.exists()) {
    const d = h1.data();
    check('  · history.d["2026-06-21"].p == 2399', d.d?.['2026-06-21']?.p === 2399, JSON.stringify(d.d?.['2026-06-21']));
  }

  // 3 · runs/{runId}
  const r1 = await getDoc(doc(db, 'workspaces', uidA, 'runs', res.runId));
  check('WRITE 3 runs/{runId} exists', r1.exists());
  if (r1.exists()) {
    const d = r1.data();
    check('  · status enum == "complete"', d.status === 'complete', `status=${d.status}`);
    check('  · dayKey is string', typeof d.dayKey === 'string', `dayKey=${d.dayKey}`);
    check('  · sourceId is string', typeof d.sourceId === 'string', `sourceId=${d.sourceId}`);
    check('  · counters.placements == 2', d.counters?.placements === 2, `placements=${d.counters?.placements}`);
    check('  · counters.newSeen == 1', d.counters?.newSeen === 1, `newSeen=${d.counters?.newSeen}`);
  }

  // 4 · sources/{sourceId}
  const s1 = await getDoc(doc(db, 'workspaces', uidA, 'sources', res.sourceId));
  check('WRITE 4 sources/{sourceId} exists', s1.exists());
  if (s1.exists()) {
    const d = s1.data();
    check('  · type enum == "storefront"', d.type === 'storefront', `type=${d.type}`);
    check('  · lastRunId == runId', d.lastRunId === res.runId, `lastRunId=${d.lastRunId}`);
    check('  · cadenceDays omitted (rules default 7 is int)', d.cadenceDays === undefined);
  }

  // ── NEGATIVE: cross-tenant write must be DENIED ────────────────────────────
  console.log('\n[negative] cross-tenant write — uidA -> workspaces/{B}/products');
  const uidB = 'someOtherTenantUid_000000000000';
  let denied = false;
  let errInfo = '';
  try {
    await import('firebase/firestore').then(({ setDoc }) =>
      setDoc(
        doc(db, 'workspaces', uidB, 'products', 'B0QASYNC01'),
        { asin: 'B0QASYNC01', mk: 'US', name: 'cross-tenant intrusion', latest: { dayKey: '2026-06-21', p: 1 } },
        { merge: true },
      ),
    );
  } catch (e) {
    denied = e.code === 'permission-denied' || /permission/i.test(e.message);
    errInfo = `${e.code || ''} ${e.message}`;
  }
  check('cross-tenant write DENIED (permission-denied)', denied, denied ? errInfo : 'WRITE WAS ACCEPTED — RULES NOT ENFORCING TENANT ISOLATION');

  // confirm nothing landed in B's workspace (read it back as A — also denied,
  // so a thrown read is itself proof the doc is unreachable / not created)
  let crossReadBlockedOrEmpty = false;
  try {
    const bdoc = await getDoc(doc(db, 'workspaces', uidB, 'products', 'B0QASYNC01'));
    crossReadBlockedOrEmpty = !bdoc.exists();
  } catch (e) {
    crossReadBlockedOrEmpty = true; // read denied too — also fine
  }
  check('cross-tenant doc absent/unreadable for uidA', crossReadBlockedOrEmpty);
} catch (e) {
  console.error('\n[fatal]', e);
  exitCode = 1;
} finally {
  // ── summary ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log('\n──────── SUMMARY ────────');
  console.log(`assertions: ${results.length}  passed: ${results.length - failed.length}  failed: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAILED: ${f.name} ${f.detail}`);
    exitCode = 1;
  }
  console.log(exitCode === 0 ? '\nRESULT: PASS' : '\nRESULT: FAIL');
  try { await deleteApp(app); } catch {}
  process.exit(exitCode);
}
