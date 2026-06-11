import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();

/**
 * Mints a Firebase custom token for the calling (already signed-in) user so the
 * ProScan extension can authenticate as the same user via signInWithCustomToken.
 */
export const mintExtensionToken = onCall(async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first');
  }
  return { token: await getAuth().createCustomToken(req.auth.uid) };
});
