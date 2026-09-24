// Adversarial rules probes, from the audit's firestore-rules harness: tenant
// isolation, plan and owner forgery, oversized and malformed documents,
// forged timestamps, the append-only trail, owner delete, and the writes
// the dashboard really makes. Two signed-in tenants, web SDK, so rules are
// enforced. Run:  npm run test:rules

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { productDoc } from './lib/docs.mjs';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');

const apps = [];
function tenant(name) {
  const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' }, name);
  apps.push(app);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
  return { auth, db };
}

let failed = 0;
let count = 0;
async function probe(name, want, fn) {
  count++;
  let got = 'allow';
  let detail = '';
  try {
    await fn();
  } catch (e) {
    got = e.code === 'permission-denied' ? 'deny' : 'error';
    detail = ` (${e.code || e.message})`;
  }
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}: want ${want}, got ${got}${ok ? '' : detail}`);
}

const big = 'x'.repeat(900 * 1024);
const future = Timestamp.fromDate(new Date('2099-01-01'));
const past = Timestamp.fromDate(new Date('2001-01-01'));

try {
  const A = tenant('adv-a');
  const B = tenant('adv-b');
  const ua = (await createUserWithEmailAndPassword(A.auth, `adv-a-${Date.now()}@proscan.test`, 'qa-pass-123')).user.uid;
  const ub = (await createUserWithEmailAndPassword(B.auth, `adv-b-${Date.now()}@proscan.test`, 'qa-pass-123')).user.uid;
  const a = A.db;
  const b = B.db;

  console.log('[bootstrap] the dashboard sign-in writes');
  await probe('users/{uid} profile mirror', 'allow', () =>
    setDoc(doc(b, 'users', ub), { displayName: 'B', email: 'b@proscan.test', defaultWorkspace: ub, createdAt: serverTimestamp() }, { merge: true }),
  );
  await probe('workspace create', 'allow', () =>
    setDoc(doc(b, 'workspaces', ub), { ownerUid: ub, name: "B's workspace", plan: 'free', settings: { defaultRoiPct: 30 }, createdAt: serverTimestamp() }, { merge: true }),
  );
  await setDoc(doc(a, 'workspaces', ua), { ownerUid: ua, plan: 'free', createdAt: serverTimestamp() });
  await setDoc(doc(b, 'workspaces', ub, 'products', 'B0SECRET01'), productDoc('B0SECRET01'));

  console.log('[tenants] isolation');
  await probe('A reads users/B', 'deny', () => getDoc(doc(a, 'users', ub)));
  await probe('A reads workspaces/B', 'deny', () => getDoc(doc(a, 'workspaces', ub)));
  await probe('A reads a B product', 'deny', () => getDoc(doc(a, 'workspaces', ub, 'products', 'B0SECRET01')));
  await probe('A lists B products', 'deny', () => getDocs(collection(a, 'workspaces', ub, 'products')));
  await probe('A writes B sellers', 'deny', () => setDoc(doc(a, 'workspaces', ub, 'sellers', 'x'), { x: 1 }));
  await probe('A squats an unclaimed workspace', 'deny', () => setDoc(doc(a, 'workspaces', 'unclaimedUid123'), { ownerUid: ua, plan: 'free' }));
  await probe('A deletes a B product', 'deny', () => deleteDoc(doc(a, 'workspaces', ub, 'products', 'B0SECRET01')));
  await probe('A deletes workspaces/B', 'deny', () => deleteDoc(doc(a, 'workspaces', ub)));

  console.log('[forgery] plan and owner');
  await probe('A sets its plan to pro', 'deny', () => updateDoc(doc(a, 'workspaces', ua), { plan: 'pro' }));
  await probe('A changes ownerUid', 'deny', () => updateDoc(doc(a, 'workspaces', ua), { ownerUid: ub }));
  await probe('A writes plan and role on users/A', 'deny', () => setDoc(doc(a, 'users', ua), { plan: 'pro', role: 'admin' }, { merge: true }));
  await probe('A adds members and seats', 'deny', () => updateDoc(doc(a, 'workspaces', ua), { members: [ub], seats: 999 }));
  await probe('A writes a limit counter', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'counters', 'sources'), { count: 0 }));
  await probe('A removes its plan field', 'deny', () => updateDoc(doc(a, 'workspaces', ua), { plan: deleteField() }));
  await probe('A rewrites workspace createdAt', 'deny', () => updateDoc(doc(a, 'workspaces', ua), { createdAt: past }));

  console.log('[shape] oversized and malformed');
  await probe('900 KB product name', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0BIG00001'), { ...productDoc('B0BIG00001'), name: big }));
  await probe('product with junk fields and a bad id', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'NOTANASIN!'), { asin: 'NOTANASIN!', junk: { deep: [1, 2, 3] }, spread: 'lol' }));
  await probe('negative price and a bad dayKey', 'deny', () => {
    const d = productDoc('B0NEG00001');
    return setDoc(doc(a, 'workspaces', ua, 'products', 'B0NEG00001'), { ...d, latest: { ...d.latest, p: -500, dayKey: 'not-a-date' } });
  });
  await probe('1400-byte product id', 'deny', () => {
    const id = 'Z'.repeat(1400);
    return setDoc(doc(a, 'workspaces', ua, 'products', id), { asin: id });
  });
  await probe('javascript: product url', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0URL00001'), { ...productDoc('B0URL00001'), url: 'javascript:alert(1)' }));
  await probe('history d as a 900 KB string', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOEXIST1', 'history', 'daily'), { sv: 1, asin: 'B0NOEXIST1', d: big }));
  await probe('event with a 900 KB payload', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOEXIST1', 'events', 'e1'), { type: 'x', blob: big, at: serverTimestamp() }));
  await probe('900 KB sellers doc', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'sellers', 'S1'), { blob: big }));
  await probe('arbitrary alert webhook', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'alerts', 'a1'), { webhook: 'http://evil' }));
  await probe('run with forged counters', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'runs', 'r1'), { status: 'complete', dayKey: 'x', sourceId: 'y', counters: { uniqueAsins: -99999, placements: 'many' } }));
  await probe('source cadenceDays 0', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'sources', 'k_s1'), { type: 'keyword', cadenceDays: 0 }));
  await probe('page chunk expiring in 9999', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'runs', 'k_x_1', 'pages', 'p0001'), { sv: 1, runId: 'k_x_1', page: 1, scrapedAt: Timestamp.now(), expireAt: Timestamp.fromDate(new Date('9999-01-01')), count: 0, placements: 0, kind: 'results', items: {} }));

  console.log('[time] forged timestamps');
  await probe('latest.at in 2099', 'deny', () => {
    const d = productDoc('B0FUTURE01');
    return setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01'), { ...d, latest: { ...d.latest, at: future } });
  });
  await setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01'), productDoc('B0FUTURE01'));
  await probe('event backdated to 2001', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01', 'events', 'e2'), { type: 'stageChange', from: 'new', to: 'purchased', at: past }));
  await probe('lead.stageChangedAt forged', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01'), { lead: { stage: 'approved', stageChangedAt: future } }, { merge: true }));

  console.log('[events] append-only, owner may delete');
  await probe('event stamped by the server', 'allow', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01', 'events', 'e3'), { type: 'stageChange', from: 'new', to: 'reviewing', at: serverTimestamp() }));
  await probe('event overwrite', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01', 'events', 'e3'), { type: 'rewritten', at: serverTimestamp() }));
  await probe('owner deletes an event', 'allow', () => deleteDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01', 'events', 'e3')));
  await probe('owner deletes a product', 'allow', () => deleteDoc(doc(a, 'workspaces', ua, 'products', 'B0FUTURE01')));

  console.log('[dashboard] real write shapes');
  await setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOLEAD01'), productDoc('B0NOLEAD01'));
  await probe('notes on a product with no stage yet', 'allow', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOLEAD01'), { lead: { notes: 'call supplier' } }, { merge: true }));
  await probe('stage move then notes', 'allow', async () => {
    await setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOLEAD01'), { lead: { stage: 'reviewing', stageChangedAt: serverTimestamp() } }, { merge: true });
    await setDoc(doc(a, 'workspaces', ua, 'products', 'B0NOLEAD01'), { lead: { notes: 'second look' } }, { merge: true });
  });
  await probe('stage move on an ASIN with no product', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'products', 'B0GHOST001'), { lead: { stage: 'reviewing', stageChangedAt: serverTimestamp() } }, { merge: true }));
  await setDoc(doc(a, 'workspaces', ua, 'sources', 'k_known'), { sv: 1, sourceId: 'k_known', type: 'keyword', sellerId: null, keyword: 'known', url: null, lastRunId: 'k_known_1', lastScrapedAt: Timestamp.now() });
  await probe('nickname on a scanned source', 'allow', () => setDoc(doc(a, 'workspaces', ua, 'sources', 'k_known'), { nickname: 'Known' }, { merge: true }));
  await probe('nickname on a source never scanned', 'deny', () => setDoc(doc(a, 'workspaces', ua, 'sources', 'k_new'), { nickname: 'x' }, { merge: true }));
  await probe('owner deletes its workspace', 'allow', () => deleteDoc(doc(a, 'workspaces', ua)));
  await probe('owner deletes its user profile', 'allow', () => deleteDoc(doc(b, 'users', ub)));
} catch (e) {
  console.error('[fatal]', e);
  failed++;
} finally {
  console.log(failed === 0 ? `\n${count} probes. RESULT: PASS` : `\n${count} probes. RESULT: FAIL (${failed})`);
  for (const app of apps) await deleteApp(app).catch(() => {});
  process.exit(failed === 0 ? 0 : 1);
}
