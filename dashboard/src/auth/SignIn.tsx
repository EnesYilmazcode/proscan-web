import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, googleProvider } from '../firebase';
import Button from '../components/Button';
import { RadarIcon } from '../components/EmptyState';
import GoogleButton from './GoogleButton';
import ScanBoard from './ScanBoard';
import './auth.css';

export const CWS_URL =
  'https://chromewebstore.google.com/detail/proscan-amazon-product-sc/bikgignfnljpbmchlemkbbpboigodgap';

const DEV_EMAIL = 'dev@proscan.test';
const DEV_PASSWORD = 'proscan-dev';

/** Error codes meaning "this auth provider is not enabled on the Firebase
 *  project yet" — production grace (owner gate B2 pending), not a user mistake. */
const AUTH_UNAVAILABLE_CODES = new Set([
  'auth/configuration-not-found',
  'auth/operation-not-allowed',
]);

/** Popup aborts that are NOT errors: the user closed/!double-clicked the
 *  chooser. Surfacing a red error here would itself read as broken. */
const POPUP_ABORT_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
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
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in window — allow pop-ups, or use email instead.';
      case 'auth/account-exists-with-different-credential':
        return 'This email is already registered with a different sign-in method.';
      default:
        return err.message.replace(/^Firebase:\s*/, '');
    }
  }
  return 'Something went wrong. Please try again.';
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'auth__brand auth__brand--compact' : 'auth__brand'}>
      <RadarIcon size={compact ? 24 : 30} />
      <span className="auth__wordmark">ProScan</span>
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}

/** Production grace: no auth provider is enabled for this project yet — the
 *  deployed app must look intentional, never broken. */
function SignInOpensSoon() {
  return (
    <div className="auth-solo chrome-texture">
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

/** Sign-in / create-account screen: a quiet control column beside the ambient
 *  scan-board instrument. Google is the primary path; email/password is the
 *  de-emphasized secondary path with the one gold action. */
export default function SignIn() {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  if (authUnavailable) return <SignInOpensSoon />;

  const clearMessages = () => {
    setError(null);
    setNote(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || googleBusy) return;
    setBusy(true);
    clearMessages();
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      // Success: AuthGate's onAuthStateChanged takes over and unmounts this.
    } catch (err) {
      if (err instanceof FirebaseError && AUTH_UNAVAILABLE_CODES.has(err.code)) {
        setAuthUnavailable(true);
      } else {
        setError(friendlyAuthError(err));
      }
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    clearMessages();
    try {
      await signInWithPopup(auth, googleProvider);
      // Success: AuthGate takes over; this component unmounts.
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (POPUP_ABORT_CODES.has(err.code)) {
          // User backed out of the chooser — not an error, say nothing.
        } else if (AUTH_UNAVAILABLE_CODES.has(err.code)) {
          // Provider off in prod (gate B2). Keep the email path fully usable.
          setNote("Google sign-in isn't switched on yet — use email for now.");
        } else {
          setError(friendlyAuthError(err));
        }
      } else {
        setError(friendlyAuthError(err));
      }
      setGoogleBusy(false);
    }
  };

  const handleForgot = async () => {
    clearMessages();
    const addr = email.trim();
    if (!addr) {
      setError('Enter your email above first, then tap “Forgot?” for a reset link.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, addr);
      setNote(`If an account exists for ${addr}, a reset link is on its way.`);
    } catch (err) {
      if (err instanceof FirebaseError && AUTH_UNAVAILABLE_CODES.has(err.code)) {
        setAuthUnavailable(true);
      } else {
        setError(friendlyAuthError(err));
      }
    }
  };

  const busyAny = busy || googleBusy;

  return (
    <div className="auth chrome-texture">
      <section className="auth__col">
        <div className="auth__panel stagger">
          <div className="auth__head">
            <Brand />
            <p className="auth__tagline">
              The instrument panel for your Amazon storefront scans.
            </p>
          </div>

          <GoogleButton onClick={signInGoogle} busy={googleBusy} disabled={busy} />

          <div className="auth__divider" role="separator">
            <span>{mode === 'signin' ? 'or sign in with email' : 'or sign up with email'}</span>
          </div>

          <form className="auth__form" onSubmit={submit} noValidate>
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
              <div className="auth__label-row">
                <label className="auth__label" htmlFor="auth-password">
                  Password
                </label>
                {mode === 'signin' ? (
                  <button
                    type="button"
                    className="auth__forgot"
                    onClick={handleForgot}
                  >
                    Forgot?
                  </button>
                ) : null}
              </div>
              <div className="auth__password">
                <input
                  id="auth-password"
                  className="auth__input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'create' ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth__reveal"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                >
                  <EyeIcon off={showPw} />
                </button>
              </div>
            </div>

            {error ? (
              <div className="auth__error" role="alert">
                {error}
              </div>
            ) : null}
            {note ? (
              <div className="auth__note" role="status" aria-live="polite">
                {note}
              </div>
            ) : null}

            <Button className="auth__cta" type="submit" disabled={busyAny}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <button
            type="button"
            className="auth__toggle"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'create' : 'signin'));
              clearMessages();
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

          <p className="auth__legal">
            By continuing you agree to ProScan's{' '}
            <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>

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
        </div>
      </section>

      <aside className="auth__showcase">
        <ScanBoard />
      </aside>
    </div>
  );
}
