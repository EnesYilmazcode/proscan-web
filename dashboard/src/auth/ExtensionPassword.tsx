// "Set a password for the extension" (F-50). The extension signs in with
// email and password only, so an account made with Google has nothing to
// type there and its workspace never fills. Linking an email credential to
// the same account gives it a password without making a second account.

import { useState, type FormEvent } from 'react';
import {
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { googleProvider } from '../firebase';
import { useAuthUser } from '../lib/hooks';
import Button from '../components/Button';
import './extpw.css';

export const MIN_PASSWORD = 8;

export function hasPassword(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}

function message(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/weak-password':
      return `Use at least ${MIN_PASSWORD} characters.`;
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return 'Another ProScan account already uses this email with a password. Sign in to the extension with that password, or reset it from the extension.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before it finished. Try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return code ? `Couldn't set the password (${code}).` : "Couldn't set the password.";
  }
}

async function link(user: User, password: string): Promise<void> {
  const credential = EmailAuthProvider.credential(user.email!, password);
  try {
    await linkWithCredential(user, credential);
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'auth/provider-already-linked') return;
    if (!(err instanceof FirebaseError) || err.code !== 'auth/requires-recent-login') throw err;
    // An old Google session: confirm it, then link.
    await reauthenticateWithPopup(user, googleProvider);
    await linkWithCredential(user, EmailAuthProvider.credential(user.email!, password));
  }
  await user.reload();
}

const DISMISS_KEY = (uid: string) => `proscan:extension-password-later:${uid}`;

function readLater(uid: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY(uid)) === '1';
  } catch {
    return false;
  }
}

function writeLater(uid: string, later: boolean): void {
  try {
    if (later) window.localStorage.setItem(DISMISS_KEY(uid), '1');
    else window.localStorage.removeItem(DISMISS_KEY(uid));
  } catch {
    /* storage blocked: the card just comes back next visit */
  }
}

/** Shown above every view to a signed-in user who has no password yet. */
export default function ExtensionPassword() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(() => (user ? readLater(user.uid) : false));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!user || !user.email) return null;
  if (done) {
    return (
      <div className="extpw extpw--done" role="status">
        <b>Password set.</b> In the extension, sign in with <span className="mono">{user.email}</span> and
        this password. Your scans will sync here.
        <button type="button" className="extpw__link" onClick={() => setDone(false)}>
          Dismiss
        </button>
      </div>
    );
  }
  if (hasPassword(user)) return null;

  if (later && !open) {
    return (
      <div className="extpw extpw--slim">
        The extension needs a password for <span className="mono">{user.email}</span>.
        <button
          type="button"
          className="extpw__link"
          onClick={() => {
            setLater(false);
            writeLater(user.uid, false);
            setOpen(true);
          }}
        >
          Set a password for the extension
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await link(user, password);
      setPassword('');
      setConfirm('');
      setOpen(false);
      setDone(true);
    } catch (err) {
      console.error('[proscan] linking a password failed', err);
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="extpw" aria-labelledby="extpw-title">
      <div className="extpw__text">
        <h2 id="extpw-title" className="extpw__title">
          Set a password for the extension
        </h2>
        <p className="extpw__body">
          The ProScan extension signs in with an email and password. You signed in here with
          Google, so the extension has nothing to sign in with yet and no scans can reach this
          dashboard. Set a password for <span className="mono">{user.email}</span>, then use it in
          the extension. It stays the same account.
        </p>
      </div>
      {open ? (
        <form className="extpw__form" onSubmit={submit} noValidate>
          <label className="extpw__label" htmlFor="extpw-new">
            New password
          </label>
          <input
            id="extpw-new"
            className="extpw__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
          />
          <label className="extpw__label" htmlFor="extpw-confirm">
            Type it again
          </label>
          <input
            id="extpw-confirm"
            className="extpw__input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error ? (
            <div className="extpw__error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="extpw__actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="extpw__actions">
          <Button onClick={() => setOpen(true)}>Set a password</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setLater(true);
              writeLater(user.uid, true);
            }}
          >
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}
