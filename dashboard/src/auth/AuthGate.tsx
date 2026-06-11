import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { useAuthUser, WorkspaceProvider } from '../lib/hooks';
import { DEFAULT_WORKSPACE_SETTINGS } from '../lib/types';
import { RadarIcon } from '../components/EmptyState';
import SignIn from './SignIn';
import './auth.css';

function Splash() {
  return (
    <div className="auth-splash chrome-texture">
      <span className="auth-splash__mark">
        <RadarIcon size={40} />
      </span>
      <span className="auth__wordmark">ProScan</span>
    </div>
  );
}

/** Idempotent first-sign-in bootstrap: users/{uid} profile mirror +
 *  workspaces/{uid} with default settings. createdAt is stamped only when
 *  the doc didn't exist; an existing workspace is left untouched so user
 *  edits (settings, tagMeta, name) are never clobbered by a sign-in. */
async function bootstrapWorkspace(user: User): Promise<void> {
  const uid = user.uid;
  const userRef = doc(db, 'users', uid);
  const wsRef = doc(db, 'workspaces', uid);
  const [userSnap, wsSnap] = await Promise.all([getDoc(userRef), getDoc(wsRef)]);

  const displayName =
    user.displayName ?? user.email?.split('@')[0] ?? 'ProScan user';

  await setDoc(
    userRef,
    {
      displayName,
      email: user.email ?? null,
      defaultWorkspace: uid,
      ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  if (!wsSnap.exists()) {
    await setDoc(
      wsRef,
      {
        ownerUid: uid,
        name: `${displayName}'s workspace`,
        plan: 'free',
        settings: DEFAULT_WORKSPACE_SETTINGS,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

/** Wraps the whole app: splash while auth resolves, SignIn when signed out,
 *  bootstrap-then-children when signed in. Also mounts the single shared
 *  workspace listener (WorkspaceProvider). */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();
  const [bootstrappedUid, setBootstrappedUid] = useState<string | null>(null);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!user) {
      setBootstrappedUid(null);
      return;
    }
    let cancelled = false;
    bootstrapWorkspace(user)
      .catch((err) => {
        // Non-fatal: the app degrades to live-query errors rather than a
        // hard wall; first write retries on next sign-in.
        console.error('[proscan] workspace bootstrap failed', err);
      })
      .finally(() => {
        if (!cancelled) setBootstrappedUid(user.uid);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Splash />;
  if (!user || !uid) return <SignIn />;
  if (bootstrappedUid !== uid) return <Splash />;

  return <WorkspaceProvider uid={uid}>{children}</WorkspaceProvider>;
}
