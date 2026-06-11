// Run Inbox instrument card — one scrape-run header, joined client-side
// with its source doc for the display name. The whole card is a button:
// clicking opens the product board scoped to the run's source.

import { clsx } from 'clsx';
import type { Run, Source } from '../../lib/types';
import StatusDot from '../../components/StatusDot';
import Chip from '../../components/Chip';
import Skeleton from '../../components/Skeleton';
import { relativeTime } from '../../lib/format';
import './runs.css';

export interface RunCardProps {
  run: Run;
  /** Joined from the sources listener — may lag the run snapshot. */
  source: Source | undefined;
  onOpen: (sourceId: string) => void;
}

/** Display name: user label → source nickname → sellerId/keyword → id. */
function runTitle(run: Run, source: Source | undefined): string {
  return (
    run.label ||
    source?.nickname ||
    run.source?.sellerId ||
    run.source?.keyword ||
    source?.sellerId ||
    source?.keyword ||
    run.sourceId
  );
}

function fmtCount(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString('en-US');
}

export default function RunCard({ run, source, onOpen }: RunCardProps) {
  const counters = run.counters ?? {};
  const done = run.pagesDone ?? 0;
  const planned = run.pagesPlanned;
  const newSeen = counters.newSeen ?? 0;
  const failures = counters.priceParseFailures ?? 0;
  const hasPlan = typeof planned === 'number' && planned > 0;
  const progressPct = hasPlan ? Math.min(100, (done / planned) * 100) : 100;

  return (
    <button
      type="button"
      className={clsx('run-card', run.status === 'dead' && 'run-card--dead')}
      onClick={() => onOpen(run.sourceId)}
    >
      <div className="run-card__top">
        <span className="run-card__title">{runTitle(run, source)}</span>
        <StatusDot status={run.status} />
      </div>

      <div className="run-card__meta mono">
        <span>{run.dayKey ?? '—'}</span>
        <span aria-hidden="true">·</span>
        <span>{relativeTime(run.startedAt)}</span>
      </div>

      <div className="run-card__counters">
        <span className="run-card__count">
          <span className="mono run-card__num">
            {hasPlan ? `${done}/${planned}` : done}
          </span>{' '}
          pages
        </span>
        <span className="run-card__count">
          <span className="mono run-card__num">{fmtCount(counters.placements)}</span>{' '}
          placements
        </span>
        <span className="run-card__count">
          <span className="mono run-card__num">{fmtCount(counters.uniqueAsins)}</span>{' '}
          asins
        </span>
        <span className="run-card__count">
          <span className="mono run-card__num">{fmtCount(counters.sponsored)}</span>{' '}
          sponsored
        </span>
        {newSeen > 0 ? (
          <Chip tone="green" className="mono">
            {newSeen} new
          </Chip>
        ) : null}
        {failures > 0 ? (
          <Chip tone="gold" className="mono" title="Price parse failures">
            {failures} parse {failures === 1 ? 'fail' : 'fails'}
          </Chip>
        ) : null}
      </div>

      {run.status === 'active' ? (
        <div
          className="run-progress"
          role="progressbar"
          aria-label="Scan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasPlan ? Math.round(progressPct) : undefined}
        >
          <div
            className="run-progress__fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}
    </button>
  );
}

/** Loading placeholder — the inbox shows three while the first snapshot
 *  is inbound. */
export function RunCardSkeleton() {
  return (
    <div className="run-card run-card--skeleton" aria-hidden="true">
      <div className="run-card__top">
        <Skeleton width="42%" height={14} />
        <Skeleton width={72} height={12} />
      </div>
      <Skeleton width="30%" height={11} />
      <Skeleton width="58%" height={11} />
    </div>
  );
}
