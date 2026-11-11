// Rules test for the drawer's lead writes (F-44). Typing a note on a product
// that was never moved off "New" must be accepted: the drawer shows stage
// 'new' by default but never stores it. Web SDK, so rules are enforced.
// Run:  npm run test:rules

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { productDoc } from './lib/docs.mjs';

const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' }, 'lead-rules');
const auth = getAuth(app);
const db = getFirestore(app);
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));

let failed = 0;
async function expect(name, want, fn) {
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

// Same write shapes as dashboard/src/features/drawer/data.ts and lib/queries.ts.
const leadFieldPatch = (ref, patch) => setDoc(ref, { lead: patch }, { merge: true });
const leadStageUpdate = (ref, stage) =>
  setDoc(ref, { lead: { stage, stageChangedAt: serverTimestamp() } }, { merge: true });

try {
  const cred = await createUserWithEmailAndPassword(auth, `qa-lead-${Date.now()}@proscan.test`, 'qa-pass-123');
  const uid = cred.user.uid;
  const product = (asin) => doc(db, 'workspaces', uid, 'products', asin);

  // A product as sync.js writes it: no lead map at all.
  const seed = (asin) => setDoc(product(asin), productDoc(asin));

  console.log('[lead] notes on an untriaged product');
  await seed('B0QALEAD01');
  await expect('F-44 notes patch with no stored stage', 'allow', () =>
    leadFieldPatch(product('B0QALEAD01'), { notes: 'call supplier' }),
  );
  const saved = (await getDoc(product('B0QALEAD01'))).data();
  const noteKept = saved?.lead?.notes === 'call supplier';
  if (!noteKept) failed++;
  console.log(`  ${noteKept ? 'PASS' : 'FAIL'} note reads back`);

  await expect('rejectedReason patch with no stored stage', 'allow', () =>
    leadFieldPatch(product('B0QALEAD01'), { rejectedReason: 'thin margin' }),
  );

  console.log('[lead] stage moves');
  await seed('B0QALEAD02');
  await expect('stage move to reviewing', 'allow', () =>
    leadStageUpdate(product('B0QALEAD02'), 'reviewing'),
  );
  await expect('notes after a stage move', 'allow', () =>
    leadFieldPatch(product('B0QALEAD02'), { notes: 'second look' }),
  );
  await expect('unknown stage', 'deny', () => leadStageUpdate(product('B0QALEAD02'), 'bogus'));
  await expect('lead that is not a map', 'deny', () =>
    setDoc(product('B0QALEAD02'), { lead: 'reviewing' }, { merge: true }),
  );
} catch (e) {
  console.error('[fatal]', e);
  failed++;
} finally {
  console.log(failed === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failed})`);
  try {
    await deleteApp(app);
  } catch {}
  process.exit(failed === 0 ? 0 : 1);
}
