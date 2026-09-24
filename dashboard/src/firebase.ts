import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// Vite inlines VITE_* values at build time, so this is a literal in the
// bundle. `VITE_USE_EMULATOR=true npm run build:dashboard` gives a prod-shaped
// bundle that talks to the emulators, and dev can opt out with =false.
const flag = import.meta.env.VITE_USE_EMULATOR;
export const USE_EMULATOR = flag === 'true' || (flag !== 'false' && import.meta.env.DEV);

const AUTH_PORT = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099);
const FIRESTORE_PORT = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);

// The 'demo-' project-id prefix is reserved by Firebase for emulator-only
// projects, so this config can never reach production.
const devConfig = {
  projectId: 'demo-proscan',
  apiKey: 'demo-key',
  authDomain: 'demo-proscan.firebaseapp.com',
};

// Public client config for the production project. Firebase web API keys are
// identifiers, not secrets — safe to commit (access is governed by security rules).
const prodConfig = {
  projectId: 'proscanbot',
  appId: '1:886322190589:web:496bad0e5793cf90eec694',
  apiKey: 'AIzaSyAp0HrcvFwpMxrlqbxa9xjUvwGoTa7QpUU',
  authDomain: 'proscanbot.firebaseapp.com',
  storageBucket: 'proscanbot.firebasestorage.app',
  messagingSenderId: '886322190589',
};

export const app = initializeApp(USE_EMULATOR ? devConfig : prodConfig);
export const auth = getAuth(app);

// Single shared Google provider. `select_account` forces the chooser every
// time, so a shared machine never silently reuses the last Google session.
// The dashboard is the canonical Google entry point; the extension later
// adopts this same Firebase identity (no separate OAuth client).
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);

if (USE_EMULATOR) {
  connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_PORT}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', FIRESTORE_PORT);
}
