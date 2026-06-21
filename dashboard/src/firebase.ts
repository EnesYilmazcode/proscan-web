import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

// In dev the app runs entirely against the local emulator suite. The 'demo-'
// project-id prefix is reserved by Firebase for emulator-only projects, so the
// SDK can never reach production from a dev build.
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

export const app = initializeApp(import.meta.env.DEV ? devConfig : prodConfig);
export const auth = getAuth(app);

// Single shared Google provider. `select_account` forces the chooser every
// time, so a shared machine never silently reuses the last Google session.
// The dashboard is the canonical Google entry point; the extension later
// adopts this same Firebase identity (no separate OAuth client).
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
