// Sync rules test: the extension's real engine and sync.js (from its
// checkout, see scripts/lib/extension.mjs) write two runs of a storefront
// and a keyword into the emulator, and this repo's firestore.rules judge
// every write. Then every written document is read back and checked
// against the vendored schema, and the rules' create-only and tenant
// checks are probed directly.
//
// Web SDK, so rules are enforced. Run:  npm run test:rules

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import * as Schema from '../packages/schema/index.js';
import { requireExtension } from './lib/extension.mjs';
import { asinOf, cards, installExtension, loadExtension } from './lib/extension-sync.mjs';

const extDir = requireExtension('the sync rules test');
const ext = await loadExtension(extDir);

const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' }, 'sync-rules');
const auth = getAuth(app);
const db = getFirestore(app);
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` (${detail})`}`);
};
// A bug that lives in the extension: reported, not fixed here. Strict, so
// the mark has to come off once the extension fixes it.
let known = 0;
const knownFailure = (name, ok, detail = '') => {
  if (ok) {
    failed++;
    console.log(`  FAIL ${name} now passes; remove its known-failure mark`);
  } else {
    known++;
    console.log(`  KNOWN FAILURE ${name}${detail ? ` (${detail})` : ''}`);
  }
};
async function denied(name, fn) {
  let code = 'allowed';
  try {
    await fn();
  } catch (e) {
    code = e.code || e.message;
  }
  check(name, code === 'permission-denied', code);
}

const DAY = 86400000;
const STORE = 'https://www.amazon.com/s?me=A3K9XELT4QZ6M2&marketplaceID=ATVPDKIKX0DER';
const KEYWORD = 'https://www.amazon.com/s?k=insulated+tumbler';

try {
  console.log(`[sync] extension at ${extDir}`);
  const uid = (await createUserWithEmailAndPassword(auth, `qa-sync-${Date.now()}@proscan.test`, 'qa-pass-123')).user.uid;
  const ws = (...path) => doc(db, 'workspaces', uid, ...path);
  const install = installExtension(ext, { uid, db });

  const day1 = Date.parse('2026-06-02T15:00:00Z');
  const day8 = day1 + 7 * DAY;
  const run1 = await install.scrape(STORE, day1, cards(130), 48);
  // A week later every 10th price fails to parse and the rest drop by 100 cents.
  const run2 = await install.scrape(STORE, day8, cards(130, { price: (i) => (i % 10 === 0 ? null : 900 + i) }), 48);
  const run3 = await install.scrape(KEYWORD, day8 + 3600000, cards(20, { offset: 120 }), 48);

  console.log('[sync] flush through the rules');
  const totals = await install.flush();
  check('every outbox entry was written', totals.entries === 3 * 2 + 3 + 1 && (await install.pending()) === 0, JSON.stringify(totals));
  check('three runs, seven pages', totals.runs === 3 && totals.pages === 7, JSON.stringify(totals));

  console.log('[sync] read back and check against the schema');
  const kinds = [];
  for (const runId of [run1, run2, run3]) {
    const run = (await getDoc(ws('runs', runId))).data();
    kinds.push(['run', runId, Schema.validateRun(run)]);
    const pages = await getDocs(collection(db, 'workspaces', uid, 'runs', runId, 'pages'));
    for (const p of pages.docs) kinds.push(['page', p.ref.path, Schema.validatePage(p.data())]);
  }
  const products = await getDocs(collection(db, 'workspaces', uid, 'products'));
  for (const p of products.docs) kinds.push(['product', p.id, Schema.validateProduct(p.data())]);
  for (const id of ['s_A3K9XELT4QZ6M2', 'k_insulated-tumbler']) {
    kinds.push(['source', id, Schema.validateSource((await getDoc(ws('sources', id))).data())]);
  }
  kinds.push(['history', asinOf(11), Schema.validateHistory((await getDoc(ws('products', asinOf(11), 'history', 'daily'))).data())]);
  const bad = kinds.filter(([, , errs]) => errs.length > 0);
  check(`${kinds.length} documents match schema v${Schema.SV}`, bad.length === 0, bad.slice(0, 3).map(([k, id, e]) => `${k} ${id}: ${e[0]}`).join('; '));
  check('140 products, one per ASIN', products.size === 140, `size=${products.size}`);

  const moved = (await getDoc(ws('products', asinOf(11)))).data();
  check('latest is the second run', moved.latest.runId === run2 && moved.latest.p === 911, JSON.stringify(moved.latest));
  check('delta against the first run', moved.delta?.p === -100 && moved.delta?.days === 7, JSON.stringify(moved.delta));
  check('firstSeenAt stays on the first run', moved.firstRunId === run1 && moved.firstSeenAt.toMillis() === day1);
  const failedPrice = (await getDoc(ws('products', asinOf(10)))).data();
  check('a price that failed to parse is not kept from last week', !('p' in failedPrice.latest));
  const both = (await getDoc(ws('products', asinOf(125)))).data();
  // sync-plan.js names sourceIds in mergeFields, and a field in the mask is
  // replaced, so arrayUnion keeps only the last source.
  knownFailure('NEW-SYNC-1 (F-20 area): a product in two sources lists both', both.sourceIds.length === 2, JSON.stringify(both.sourceIds));
  check('rank is written', Number.isInteger(moved.latest.rk), JSON.stringify(moved.latest));

  const header = (await getDoc(ws('runs', run2))).data();
  check('run header counts the run', header.status === 'complete' && header.counters.uniqueAsins === 130 && header.pagesDone === 3, JSON.stringify(header.counters));

  console.log('[rules] create-only and forged values');
  await denied('rewrite firstSeenAt', () => updateDoc(ws('products', asinOf(11)), { firstSeenAt: Timestamp.now() }));
  await denied('drop firstRunId', () => setDoc(ws('products', asinOf(11)), { ...moved, firstRunId: null }));
  await denied('latest.at in 2099', () => updateDoc(ws('products', asinOf(11)), { 'latest.at': Timestamp.fromDate(new Date('2099-01-01')) }));
  await denied('price as a string', () => updateDoc(ws('products', asinOf(11)), { 'latest.p': '9.11' }));
  await denied('unknown product field', () => updateDoc(ws('products', asinOf(11)), { spread: { sc: 3 } }));
  await denied('run id that is not {sourceId}_{startMs}', () => setDoc(ws('runs', 'k_x_1'), { ...header, runId: 'k_x_1' }));
  await denied('page chunk under the wrong run', () => setDoc(ws('runs', run1, 'pages', 'p0009'), { sv: 1, runId: run2, page: 9, scrapedAt: Timestamp.now(), expireAt: Timestamp.now(), count: 0, placements: 0, kind: 'results', items: {} }));

  console.log('[rules] another account');
  await signOut(auth);
  await createUserWithEmailAndPassword(auth, `qa-sync-b-${Date.now()}@proscan.test`, 'qa-pass-123');
  const intruder = installExtension(ext, { uid, db });
  await intruder.scrape(KEYWORD, day8 + 7200000, cards(3), 48);
  let code = 'allowed';
  try {
    await intruder.flush();
  } catch (e) {
    code = e.code;
  }
  check('sync into another workspace is refused', code === 'permission-denied', code);
  check('and its entries stay queued', (await intruder.pending()) === 2);
  await denied('reading another workspace', () => getDoc(ws('products', asinOf(11))));
} catch (e) {
  console.error('[fatal]', e);
  failed++;
} finally {
  if (known) console.log(`\n${known} known failure(s), see above`);
  console.log(failed === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failed})`);
  try {
    await deleteApp(app);
  } catch {}
  process.exit(failed === 0 ? 0 : 1);
}
