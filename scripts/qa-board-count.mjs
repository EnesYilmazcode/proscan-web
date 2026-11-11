// Rules test for the board's server-side count (F-45): the owner can run
// getCountFromServer on the same ordered queries the board listens to, and
// the count reaches past the listener's limit. Another tenant cannot.
// Run:  npm run test:rules

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getCountFromServer,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { productDoc } from './lib/docs.mjs';

const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' }, 'board-count');
const auth = getAuth(app);
const db = getFirestore(app);
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));

const N = 320; // more than the 300-row recent window
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

try {
  const cred = await createUserWithEmailAndPassword(auth, `qa-count-${Date.now()}@proscan.test`, 'qa-pass-123');
  const uid = cred.user.uid;
  const col = collection(db, 'workspaces', uid, 'products');

  const batch = writeBatch(db);
  for (let i = 0; i < N; i++) {
    const asin = `B0QACNT${String(i).padStart(3, '0')}`;
    batch.set(doc(col, asin), productDoc(asin, { cents: 1000 + i, atMs: 1e12 + i, sourceId: i % 2 ? 's_ODD' : 's_EVEN' }));
  }
  await batch.commit();

  const recent = await getCountFromServer(query(col, orderBy('latest.at', 'desc')));
  check('recent count sees every product', recent.data().count === N, `count=${recent.data().count}`);

  const bySource = await getCountFromServer(
    query(col, where('sourceIds', 'array-contains', 's_ODD'), orderBy('latest.at', 'desc')),
  );
  check('per-source count', bySource.data().count === N / 2, `count=${bySource.data().count}`);

  const window = await getCountFromServer(query(col, orderBy('latest.at', 'desc'), limit(300)));
  check('limited query stays capped', window.data().count === 300, `count=${window.data().count}`);

  let denied = false;
  try {
    await getCountFromServer(collection(db, 'workspaces', 'someOtherTenantUid_0000', 'products'));
  } catch (e) {
    denied = e.code === 'permission-denied';
  }
  check('cross-tenant count denied', denied);
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
