// Data hooks — the ONLY sanctioned way to attach Firestore listeners.
// Read-cost hygiene (docs/ops/billing-runbook.md):
//   * one listener per mounted view, detached on unmount (enforced here);
//   * history/offerSnapshots are one-shot reads (useDocOnce / getDocs);
//   * never subscribe to the whole products collection unscoped — use the
//     scoped builders in lib/queries.ts as the queryFactory.

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Workspace } from './types';

/* ── scan activity signal ─────────────────────────────────────────────
   Tracks snapshot listeners still waiting on their FIRST data. The
   sidebar logo's radar sweep runs only while this is non-empty. */

const pendingFirstLoads = new Set<symbol>();
const scanSubscribers = new Set<() => void>();

function notifyScan(): void {
  for (const fn of scanSubscribers) fn();
}

function scanStart(): symbol {
  const token = Symbol('first-load');
  pendingFirstLoads.add(token);
  notifyScan();
  return token;
}

function scanEnd(token: symbol): void {
  if (pendingFirstLoads.delete(token)) notifyScan();
}

function subscribeScan(fn: () => void): () => void {
  scanSubscribers.add(fn);
  return () => scanSubscribers.delete(fn);
}

/** True while any mounted snapshot listener is receiving its first data.
 *  Drives the sidebar logo radar sweep — nothing else. */
export function useScanActivity(): boolean {
  return useSyncExternalStore(
    subscribeScan,
    () => pendingFirstLoads.size > 0,
    () => false,
  );
}

/* ── auth ───────────────────────────────────────────────────────────── */

export interface AuthState {
  user: User | null;
  loading: boolean;
}

/** Subscribes to Firebase auth state. `loading` is true until the first
 *  onAuthStateChanged callback fires. */
export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: auth.currentUser,
    loading: true,
  });
  useEffect(
    () => onAuthStateChanged(auth, (user) => setState({ user, loading: false })),
    [],
  );
  return state;
}

/* ── snapshot query (live, scoped, self-detaching) ──────────────────── */

export interface SnapshotQueryState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/** Live query subscription. The factory may return null to mean "not ready
 *  yet" (e.g. uid unknown) — no listener is attached in that case.
 *  Detaches on unmount / dep change. In dev, logs a per-mount read counter
 *  so read-cost regressions are visible in the console. */
export function useSnapshotQuery<T>(
  queryFactory: () => Query<T> | null,
  deps: DependencyList,
  debugLabel?: string,
): SnapshotQueryState<T> {
  const [state, setState] = useState<SnapshotQueryState<T>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const q = queryFactory();
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const token = scanStart();
    let firstSnapshot = true;
    let mountReads = 0;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          scanEnd(token);
        }
        if (import.meta.env.DEV) {
          const delta = snap.docChanges().length;
          mountReads += delta;
          console.debug(
            `[proscan:reads] ${debugLabel ?? 'query'} +${delta} docs (mount total ${mountReads})`,
          );
        }
        setState({
          data: snap.docs.map((d) => d.data()),
          loading: false,
          error: null,
        });
      },
      (error) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          scanEnd(token);
        }
        if (import.meta.env.DEV) {
          console.debug(`[proscan:reads] ${debugLabel ?? 'query'} error`, error);
        }
        setState({ data: [], loading: false, error });
      },
    );
    return () => {
      scanEnd(token);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/* ── one-shot doc read (history / snapshots — NEVER listeners) ──────── */

export interface DocOnceState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** One-shot getDoc. Pass null while the ref isn't ready. Re-fetches only
 *  when the document PATH changes, not on referential churn. */
export function useDocOnce<T>(ref: DocumentReference<T> | null): DocOnceState<T> {
  const [state, setState] = useState<DocOnceState<T>>({
    data: null,
    loading: ref !== null,
    error: null,
  });
  const path = ref ? ref.path : null;

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getDoc(ref)
      .then((snap) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.debug(`[proscan:reads] doc-once ${snap.ref.path} +1`);
        }
        setState({
          data: snap.exists() ? snap.data() : null,
          loading: false,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return state;
}

/* ── workspace (single shared listener via context) ─────────────────── */

export interface WorkspaceState {
  /** workspace id == signed-in uid */
  wid: string | null;
  workspace: Workspace | null;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceState>({
  wid: null,
  workspace: null,
  loading: false,
});

/** Mounted ONCE by AuthGate after sign-in: owns the single doc listener on
 *  workspaces/{uid} so that any number of useWorkspace() consumers share
 *  one listener (read-cost hygiene). */
export function WorkspaceProvider({
  uid,
  children,
}: {
  uid: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<WorkspaceState>({
    wid: uid,
    workspace: null,
    loading: true,
  });

  useEffect(() => {
    setState({ wid: uid, workspace: null, loading: true });
    const unsubscribe = onSnapshot(
      doc(db, 'workspaces', uid),
      (snap) => {
        setState({
          wid: uid,
          workspace: snap.exists() ? (snap.data() as Workspace) : null,
          loading: false,
        });
      },
      () => setState({ wid: uid, workspace: null, loading: false }),
    );
    return unsubscribe;
  }, [uid]);

  return createElement(WorkspaceContext.Provider, { value: state }, children);
}

/** Workspace doc (settings, tagMeta, plan) + wid. Reads the provider's
 *  shared listener — safe to call from any component under AuthGate. */
export function useWorkspace(): WorkspaceState {
  return useContext(WorkspaceContext);
}
