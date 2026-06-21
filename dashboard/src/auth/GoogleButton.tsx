import '@fontsource/roboto/500.css';
import './auth.css';

/**
 * The official multi-color Google "G". Per Google's Sign-In branding
 * guidelines this mark must never be recolored, cropped, or restyled — it
 * carries its own keyline and is used verbatim. aria-hidden because the
 * button's visible text supplies the accessible name.
 */
function GoogleG() {
  return (
    <svg
      className="google-btn__g"
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}

/**
 * Google-branding-compliant "Continue with Google" button (dark theme:
 * #131314 fill / #E3E3E3 text / #8E918F hairline, Roboto Medium 14/20).
 *
 * Deliberately NOT the gold <Button> — it stays a recognizable third-party
 * control so it reads as the real Google chip, never a recolored pill. Gold
 * is reserved for ProScan's own submit, so the two paths never compete.
 */
export default function GoogleButton({ onClick, busy, disabled }: GoogleButtonProps) {
  return (
    <button
      type="button"
      className="google-btn"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      <GoogleG />
      <span className="google-btn__label">
        {busy ? 'Connecting…' : 'Continue with Google'}
      </span>
    </button>
  );
}
