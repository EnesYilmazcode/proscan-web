// Date-bucketing for the Run Inbox: Today / This week / Earlier.
// Buckets key off the run's UTC dayKey (falling back to startedAt) so the
// grouping matches the dayKey shown on each card. Input arrives newest-
// first from runsRecent(); bucketing preserves that order.

import type { Run } from '../../lib/types';
import { dayKey, dayKeyDiff, toMillis } from '../../lib/format';

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

/** The run's UTC dayKey, derived from startedAt when absent. */
function runDayKey(run: Run): string | null {
  if (run.dayKey) return run.dayKey;
  const ms = toMillis(run.startedAt);
  return ms === null ? null : dayKey(new Date(ms));
}

/** today = same UTC day; week = 1–6 days ago; earlier = older / undated. */
export function groupKeyFor(run: Run, todayKey: string = dayKey()): RunGroupKey {
  const key = runDayKey(run);
  if (!key) return 'earlier';
  const daysAgo = dayKeyDiff(key, todayKey);
  if (Number.isNaN(daysAgo)) return 'earlier';
  if (daysAgo <= 0) return 'today';
  if (daysAgo < 7) return 'week';
  return 'earlier';
}

/** Bucket runs (already newest-first) into ordered, non-empty groups. */
export function groupRuns(runs: Run[], todayKey: string = dayKey()): RunGroup[] {
  const buckets: Record<RunGroupKey, Run[]> = { today: [], week: [], earlier: [] };
  for (const run of runs) buckets[groupKeyFor(run, todayKey)].push(run);
  return (['today', 'week', 'earlier'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: GROUP_LABELS[key], runs: buckets[key] }));
}
