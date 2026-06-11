import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../firebase';
import Button from '../components/Button';
import { RadarIcon } from '../components/EmptyState';
import './auth.css';

export const CWS_URL =
  'https://chromewebstore.google.com/detail/proscan-amazon-product-sc/bikgignfnljpbmchlemkbbpboigodgap';

const DEV_EMAIL = 'dev@proscan.test';
const DEV_PASSWORD = 'proscan-dev';

/** Error codes meaning "email/password auth is not enabled on this Firebase
 *  project yet" — production grace, not a user mistake. */
const AUTH_UNAVAILABLE_CODES = new Set([
  'auth/configuration-not-found',
  'auth/operation-not-allowed',
]);

function friendlyAuthError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.';
      case 'auth/invalid-email':
        return 'That email address does not look valid.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists — sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a minute and try again.';
      case 'auth/network-request-failed':
        return 'Network error — check your connection and try again.';
      default:
        return err.message.replace(/^Firebase:\s*/, '');
    }
  }
  return 'Something went wrong. Please try again.';
}

function Brand() {
  return (
    <div className="auth__brand">
      <RadarIcon size={32} />
      <span className="auth__wordmark">ProScan</span>
    </div>
  );
}

/** Production grace: Firebase Auth isn't enabled for this project yet —
 *  the deployed app must look intentional, never broken. */
function SignInOpensSoon() {
  return (
    <div className="auth chrome-texture">
      <div className="auth__panel">
        <Brand />
        <h1 className="auth__soon-title">Sign-in opens soon</h1>
        <p className="auth__soon-body">
          The ProScan dashboard is rolling out. Accounts open shortly — in the
          meantime, the Chrome extension scans storefronts and keywords today.
        </p>
        <Button
          className="auth__cta"
          onClick={() => window.open(CWS_URL, '_blank', 'noopener')}
        >
          Install the extension
        </Button>
        <div className="auth__links">
          <a href="/">Back to proscan home</a>
        </div>
      </div>
    </div>
  );
}

/** Full-screen chrome-dark sign-in / create-account panel. */
export default function SignIn() {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  if (authUnavailable) return <SignInOpensSoon />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      // Success: AuthGate's onAuthStateChanged takes over.
    } catch (err) {
      if (err instanceof FirebaseError && AUTH_UNAVAILABLE_CODES.has(err.code)) {
        setAuthUnavailable(true);
      } else {
        setError(friendlyAuthError(err));
      }
      setBusy(false);
    }
  };

  return (
    <div className="auth chrome-texture">
      <form className="auth__panel" onSubmit={submit}>
        <Brand />
        <p className="auth__tagline">
          The instrument panel for your Amazon storefront scans.
        </p>

        <div className="auth__field">
          <label className="auth__label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="auth__input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            className="auth__input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder={mode === 'create' ? 'At least 6 characters' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? <div className="auth__error">{error}</div> : null}

        <Button className="auth__cta" type="submit" disabled={busy}>
          {busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </Button>

        <button
          type="button"
          className="auth__toggle"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'create' : 'signin'));
            setError(null);
          }}
        >
          {mode === 'signin' ? (
            <>
              New to ProScan? <b>Create an account</b>
            </>
          ) : (
            <>
              Already registered? <b>Sign in</b>
            </>
          )}
        </button>

        {import.meta.env.DEV ? (
          <button
            type="button"
            className="auth__hint"
            title="Click to fill the emulator dev account"
            onClick={() => {
              setEmail(DEV_EMAIL);
              setPassword(DEV_PASSWORD);
            }}
          >
            dev: {DEV_EMAIL} / {DEV_PASSWORD}
          </button>
        ) : null}
      </form>
    </div>
  );
}
