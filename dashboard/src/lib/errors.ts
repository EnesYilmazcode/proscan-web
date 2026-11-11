// Error plumbing: every failure is logged in every build, and write
// failures also raise a toast so they never disappear into the console.

import { useSyncExternalStore } from 'react';

export interface ErrorInfo {
  code: string | null;
  message: string;
  /** Firestore puts a "create this index" console link in failed-precondition errors. */
  indexUrl: string | null;
}

export function describeError(err: unknown): ErrorInfo {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : null;
  const message =
    typeof e?.message === 'string' && e.message ? e.message : String(err ?? 'Unknown error');
  const link = message.match(/https:\/\/console\.firebase\.google\.com\/\S+/);
  return { code, message, indexUrl: link ? link[0] : null };
}

/** Short form for inline text: the Firestore code, else the message. */
export function errorLabel(err: unknown): string {
  const info = describeError(err);
  return info.code ?? info.message;
}

/* ── toasts ─────────────────────────────────────────────────────── */

export interface Toast {
  id: number;
  text: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Log a failure and show it to the user. `what` reads as "Couldn't <what>". */
export function reportError(what: string, err: unknown): void {
  console.error(`[proscan] ${what} failed`, err);
  const id = nextId++;
  toasts = [...toasts, { id, text: `Couldn't ${what}: ${errorLabel(err)}` }].slice(-4);
  emit();
  window.setTimeout(() => dismissToast(id), 8000);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => toasts,
    () => toasts,
  );
}
