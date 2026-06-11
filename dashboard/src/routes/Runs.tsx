// Run Inbox (MVP feature 2) — the 30 most recent scrape-run headers as
// instrument cards, newest first, grouped Today / This week / Earlier.
// Source names are joined client-side from the (tiny, sanctioned) sources
// listener. Clicking a card opens the product board scoped to that
// run's source: /?source=<sourceId>.

import { Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnapshotQuery, useWorkspace } from '../lib/hooks';
import { runsRecent, sources } from '../lib/queries';
import type { Source } from '../lib/types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { CWS_URL } from '../auth/SignIn';
import RunCard, { RunCardSkeleton } from '../features/runs/RunCard';
import { groupRuns } from '../features/runs/groupRuns';
import '../features/runs/runs.css';

export default function Runs() {
  const { wid } = useWorkspace();
  const navigate = useNavigate();

  const runsState = useSnapshotQuery(
    () => (wid ? runsRecent(wid, 30) : null),
    [wid],
    'runs:recent30',
  );
  const sourcesState = useSnapshotQuery(
    () => (wid ? sources(wid) : null),
    [wid],
    'runs:sources-join',
  );

  const sourceById = useMemo(() => {
    const map = new Map<string, Source>();
    for (const s of sourcesState.data) map.set(s.sourceId, s);
    return map;
  }, [sourcesState.data]);

  const groups = useMemo(() => groupRuns(runsState.data), [runsState.data]);

  const openSource = (sourceId: string) =>
    navigate(`/?source=${encodeURIComponent(sourceId)}`);

  const loading = !wid || runsState.loading;

  let body;
  if (loading) {
    body = (
      <div className="runs-list">
        <RunCardSkeleton />
        <RunCardSkeleton />
        <RunCardSkeleton />
      </div>
    );
  } else if (runsState.error) {
    body = (
      <div className="runs-error" role="alert">
        Could not load runs: {runsState.error.message}
      </div>
    );
  } else if (runsState.data.length === 0) {
    body = (
      <EmptyState
        title="No scans yet"
        body="Start a scan from the extension on any storefront or keyword page — run headers stream in here live."
        cta={
          <Button onClick={() => window.open(CWS_URL, '_blank', 'noopener')}>
            Install the extension
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="runs-list">
        {groups.map((group) => (
          <Fragment key={group.key}>
            <h2 className="runs-group">{group.label}</h2>
            {group.runs.map((run) => (
              <RunCard
                key={run.runId}
                run={run}
                source={sourceById.get(run.sourceId)}
                onOpen={openSource}
              />
            ))}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Runs"
        subtitle="Your 30 most recent scrape runs — click one to open its products."
      />
      {body}
    </>
  );
}
