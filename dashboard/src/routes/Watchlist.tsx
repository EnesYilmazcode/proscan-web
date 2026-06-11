// Storefront Watchlist — the organizing spine. One live listener on the
// whole sources collection (tiny by design — see lib/queries.ts), staleness
// computed client-side against each source's cadence.

import { useMemo, type ReactNode } from 'react';
import { useSnapshotQuery, useWorkspace } from '../lib/hooks';
import { sources } from '../lib/queries';
import { staleness } from '../lib/format';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { CWS_URL } from '../auth/SignIn';
import WatchlistTable from '../features/watchlist/WatchlistTable';
import '../features/watchlist/watchlist.css';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function Watchlist() {
  const { wid } = useWorkspace();
  const { data, loading, error } = useSnapshotQuery(
    () => (wid ? sources(wid) : null),
    [wid],
    'watchlist:sources',
  );

  // "8 storefronts · 2 keywords · 3 due for rescan"
  const summary = useMemo(() => {
    if (data.length === 0) return null;
    const storefronts = data.filter((s) => s.type === 'storefront').length;
    const keywords = data.length - storefronts;
    const due = data.filter((s) => staleness(s).level !== 'fresh').length;
    const parts: string[] = [];
    if (storefronts > 0) parts.push(plural(storefronts, 'storefront'));
    if (keywords > 0) parts.push(plural(keywords, 'keyword'));
    parts.push(due > 0 ? `${due} due for rescan` : 'all fresh');
    return parts.join(' · ');
  }, [data]);

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="wl-card">
        <Skeleton variant="table-row" rows={6} />
      </div>
    );
  } else if (error) {
    body = (
      <EmptyState
        title="Couldn't load the watchlist"
        body="The sources listener failed — check your connection and reload."
      />
    );
  } else if (!wid || data.length === 0) {
    body = (
      <EmptyState
        title="Nothing watched yet"
        body="Scan a storefront once and it appears here — set a cadence and ProScan tells you when it's due for a rescan."
        cta={
          <Button onClick={() => window.open(CWS_URL, '_blank', 'noopener')}>
            Run your first scan
          </Button>
        }
      />
    );
  } else {
    body = <WatchlistTable wid={wid} sources={data} />;
  }

  return (
    <>
      <PageHeader
        title="Watchlist"
        subtitle="Storefronts and keywords on a rescan cadence — fresh within cadence, due past it, stale past twice it."
        actions={summary ? <span className="wl-summary">{summary}</span> : undefined}
      />
      {body}
    </>
  );
}
