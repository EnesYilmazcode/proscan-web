// /dashboard/connect: one Google click signs in both the dashboard and the
// extension. The extension opens this page from its popup.

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, googleProvider } from '../firebase';
import { pickExtensionId, sendHandoff } from '../lib/handoff';
import { RadarIcon } from '../components/EmptyState';
import GoogleButton from './GoogleButton';
import './auth.css';

type State = 'idle' | 'busy' | 'done' | 'error';

declare const chrome: {
  runtime?: {
    sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
    lastError?: unknown;
  };
} | undefined;

const ABORTS = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export default function Connect() {
  const extId = pickExtensionId(window.location.search, import.meta.env.VITE_DEV_EXTENSION_IDS);
  const [state, setState] = useState<State>('idle');
  const [msg, setMsg] = useState('');

  const go = async () => {
    if (!extId) return;
    setState('busy');
    setMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
      if (!idToken) throw new Error('no-token');
      const rt = typeof chrome !== 'undefined' ? chrome?.runtime : undefined;
      const r = await sendHandoff(rt?.sendMessage?.bind(rt), extId, idToken, () => rt?.lastError);
      if (r.ok) {
        setState('done');
        setMsg(r.email ? `Signed in as ${r.email}.` : 'Signed in.');
      } else {
        setState('error');
        setMsg(r.error === 'no-extension'
          ? "Couldn't reach the extension. Open this page from the ProScan popup in Chrome."
          : "The extension couldn't sign in. Try again.");
      }
    } catch (err) {
      if (err instanceof FirebaseError && ABORTS.has(err.code)) {
        setState('idle');
        return;
      }
      setState('error');
      setMsg("Google sign-in didn't finish. Try again.");
    }
  };

  return (
    <div className="auth-solo chrome-texture">
      <div className="auth__panel">
        <div className="auth__brand">
          <RadarIcon size={28} />
          <span className="auth__wordmark">ProScan</span>
        </div>
        {!extId ? (
          <p className="auth__error" role="alert">This link isn't from ProScan.</p>
        ) : state === 'done' ? (
          <>
            <p className="auth__tagline">{msg} Your scans now sync to the dashboard.</p>
            <a className="auth__toggle" href="/dashboard/">Open the dashboard</a>
          </>
        ) : (
          <>
            <p className="auth__tagline">Connect the extension to your dashboard.</p>
            <GoogleButton onClick={go} busy={state === 'busy'} />
            {state === 'error' && <p className="auth__error" role="alert">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
