// Hands a Google sign-in from the dashboard to the ProScan extension, so the
// extension never shows a password form. The site sends the Google ID token
// to the extension, which signs in to the same Firebase account with it.

// The store build. A dev build's unpacked id is added at build time through
// VITE_DEV_EXTENSION_IDS (comma separated). Never trust an id from the URL
// alone: the token would go to whatever extension the link names.
export const STORE_EXTENSION_ID = 'bikgignfnljpbmchlemkbbpboigodgap';

export const HANDOFF_TYPE = 'PROSCAN_GOOGLE_HANDOFF';

export function allowedExtensionIds(devIds = ''): string[] {
  const extra = devIds.split(',').map((s) => s.trim()).filter((s) => /^[a-p]{32}$/.test(s));
  return [STORE_EXTENSION_ID, ...extra];
}

/** The extension id to hand off to: the `ext` query value if allowed, else the store id. */
export function pickExtensionId(search: string, devIds = ''): string | null {
  const asked = new URLSearchParams(search).get('ext');
  const allowed = allowedExtensionIds(devIds);
  if (!asked) return STORE_EXTENSION_ID;
  return allowed.includes(asked) ? asked : null;
}

type SendMessage = (id: string, msg: unknown, cb: (resp: unknown) => void) => void;

export interface HandoffResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/** Sends the token. Resolves with the extension's answer, or an error when no extension listens. */
export function sendHandoff(
  send: SendMessage | undefined,
  extId: string,
  idToken: string,
  lastError: () => unknown = () => undefined,
): Promise<HandoffResult> {
  if (!send) return Promise.resolve({ ok: false, error: 'no-extension' });
  return new Promise((resolve) => {
    try {
      send(extId, { type: HANDOFF_TYPE, idToken }, (resp) => {
        if (lastError() || !resp || typeof resp !== 'object') {
          resolve({ ok: false, error: 'no-extension' });
          return;
        }
        resolve(resp as HandoffResult);
      });
    } catch {
      resolve({ ok: false, error: 'no-extension' });
    }
  });
}
