// Formatting helpers — THE only sanctioned way to render money, percentages
// and timestamps. All money flows through here as integer cents.

import { Timestamp } from 'firebase/firestore';
import type { Source } from './types';

const MS_PER_DAY = 86_400_000;

/** Integer cents -> '$12.34' (negative -> '-$2.00'). undefined/null -> '—'. */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem}`;
}

/** 7.66 -> '7.7%'. Pass signed=true for '+7.7%' / '-7.7%'. */
export function pct(
  value: number | null | undefined,
  opts: { digits?: number; signed?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { digits = 1, signed = false } = opts;
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** 1873 -> '1.9k', 1_200_000 -> '1.2M'. Integers below 1000 unchanged. */
export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  if (abs < 1_000_000) return `${trimZero((n / 1000).toFixed(1))}k`;
  if (abs < 1_000_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
  return `${trimZero((n / 1_000_000_000).toFixed(1))}B`;
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

type TimeLike = Timestamp | Date | number | null | undefined;

export function toMillis(at: TimeLike): number | null {
  if (at === null || at === undefined) return null;
  if (at instanceof Timestamp) return at.toMillis();
  if (at instanceof Date) return at.getTime();
  if (typeof at === 'number') return at;
  return null;
}

/** '3d ago' / '2h ago' / 'just now' / 'in 4d' (future). Unknown -> '—'. */
export function relativeTime(at: TimeLike): string {
  const ms = toMillis(at);
  if (ms === null) return '—';
  const diff = Date.now() - ms;
  const future = diff < 0;
  const abs = Math.abs(diff);
  let label: string;
  if (abs < 60_000) return 'just now';
  else if (abs < 3_600_000) label = `${Math.floor(abs / 60_000)}m`;
  else if (abs < MS_PER_DAY) label = `${Math.floor(abs / 3_600_000)}h`;
  else if (abs < 30 * MS_PER_DAY) label = `${Math.floor(abs / MS_PER_DAY)}d`;
  else if (abs < 365 * MS_PER_DAY) label = `${Math.floor(abs / (30 * MS_PER_DAY))}mo`;
  else label = `${Math.floor(abs / (365 * MS_PER_DAY))}y`;
  return future ? `in ${label}` : `${label} ago`;
}

/** UTC 'YYYY-MM-DD' for a date (default: now). Matches run/history dayKeys. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> Date at UTC midnight. */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** Days between two dayKeys (b − a). */
export function dayKeyDiff(a: string, b: string): number {
  return Math.round(
    (dayKeyToDate(b).getTime() - dayKeyToDate(a).getTime()) / MS_PER_DAY,
  );
}

/** 'YYYY-MM-DD' -> 'Jun 9' (table-friendly). */
export function shortDate(key: string | null | undefined): string {
  if (!key) return '—';
  const d = dayKeyToDate(key);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export type StalenessLevel = 'fresh' | 'due' | 'stale';

export interface Staleness {
  label: string;
  level: StalenessLevel;
}

/** Rescan-queue staleness: lastScrapedAt age vs cadenceDays.
 *  fresh = within cadence; due = past cadence; stale = past 2× cadence
 *  (or never scraped). */
export function staleness(
  source: Pick<Source, 'lastScrapedAt' | 'cadenceDays'>,
): Staleness {
  const last = toMillis(source.lastScrapedAt);
  if (last === null) return { label: 'Never scanned', level: 'stale' };
  const cadence = Math.max(1, source.cadenceDays ?? 7);
  const ageDays = (Date.now() - last) / MS_PER_DAY;
  const label = `Scanned ${relativeTime(last)}`;
  if (ageDays < cadence) return { label, level: 'fresh' };
  if (ageDays < cadence * 2) return { label, level: 'due' };
  return { label, level: 'stale' };
}
