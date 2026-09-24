// Dev seed through the extension: its real engine and sync.js scan a
// storefront twice a week apart and a keyword once, into the running
// emulators, as dev@proscan.test / proscan-dev. Unlike seed-emulators.mjs
// (firebase-admin fixtures with Phase 5 fields), this is exactly what the
// extension writes.
//
//   npm run emulators          (one terminal)
//   npm run seed:extension     (another)

process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${process.env.EMU_FIRESTORE_PORT || 8080}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `127.0.0.1:${process.env.EMU_AUTH_PORT || 9099}`;

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
import { requireExtension } from './lib/extension.mjs';
import { cards, installExtension, loadExtension } from './lib/extension-sync.mjs';

const EMAIL = 'dev@proscan.test';
const PASSWORD = 'proscan-dev';
const DAY = 86400000;

const ext = await loadExtension(requireExtension('the extension seed'));
const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
connectFirestoreEmulator(db, host, Number(port));

const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD).catch(() =>
  createUserWithEmailAndPassword(auth, EMAIL, PASSWORD),
);
const install = installExtension(ext, { uid: cred.user.uid, db });
const start = Date.now() - 8 * DAY;
const moved = (i) => (i % 10 === 0 ? null : i % 3 === 0 ? 1000 + i - 50 * ((i % 7) + 1) : 1000 + i);
await install.scrape('https://www.amazon.com/s?me=A3K9XELT4QZ6M2', start, cards(300), 48);
await install.scrape('https://www.amazon.com/s?me=A3K9XELT4QZ6M2', start + 7 * DAY, cards(300, { price: moved }), 48);
await install.scrape('https://www.amazon.com/s?k=stainless+tumbler', start + 7 * DAY + 3600000, cards(120, { offset: 280 }), 48);
console.log('synced', await install.flush());
await terminate(db);
await deleteApp(app);
process.exit(0);
