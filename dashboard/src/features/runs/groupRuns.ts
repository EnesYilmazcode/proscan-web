// Date-bucketing for the Run Inbox: Today / This week / Earlier.
// Buckets key off the run's dayKey, the local date where it ran (falling
// back to startedAt), so the grouping matches the date on each card. Input arrives newest-
// first from runsNewestFirst(); bucketing preserves that order.

import type { Run } from '../../lib/types';
import { dayKeyDiff, localDayKey, toMillis } from '../../lib/format';

export type RunGroupKey = 'today' | 'week' | 'earlier';

export const GROUP_LABELS: Record<RunGroupKey, string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

export interface RunGroup {
  key: RunGroupKey;
  label: string;
  runs: Run[];
}

/** The run's dayKey, derived from startedAt when absent. */
function runDayKey(run: Run): string | null {
  if (run.dayKey) return run.dayKey;
  const ms = toMillis(run.startedAt);
  return ms === null ? null : localDayKey(new Date(ms));
}

/** today = same local day; week = 1–6 days ago; earlier = older / undated. */
export function groupKeyFor(run: Run, todayKey: string = localDayKey()): RunGroupKey {
  const key = runDayKey(run);
  if (!key) return 'earlier';
  const daysAgo = dayKeyDiff(key, todayKey);
  if (Number.isNaN(daysAgo)) return 'earlier';
  if (daysAgo <= 0) return 'today';
  if (daysAgo < 7) return 'week';
  return 'earlier';
}

/** Bucket runs (already newest-first) into ordered, non-empty groups. */
export function groupRuns(runs: Run[], todayKey: string = localDayKey()): RunGroup[] {
  const buckets: Record<RunGroupKey, Run[]> = { today: [], week: [], earlier: [] };
  for (const run of runs) buckets[groupKeyFor(run, todayKey)].push(run);
  return (['today', 'week', 'earlier'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: GROUP_LABELS[key], runs: buckets[key] }));
}
