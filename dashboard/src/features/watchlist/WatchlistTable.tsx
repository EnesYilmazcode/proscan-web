// Dense watchlist table — the storefront/keyword rescan spine.
// Sort: watched first, then stalest first (age ÷ cadence, never-scanned =
// most stale). Row click (never on controls) scopes the Products board via
// /?source=<id>. All edits flow through sourcePatch (merge-only writer).

import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Chip from '../../components/Chip';
import Tag from '../../components/Tag';
import { sourcePatch } from '../../lib/queries';
import {
  compactNumber,
  relativeTime,
  staleness,
  toMillis,
  type Staleness,
  type StalenessLevel,
} from '../../lib/format';
import type { Source } from '../../lib/types';
import NicknameCell from './NicknameCell';
import './watchlist.css';

const MS_PER_DAY = 86_400_000;
const CADENCE_OPTIONS = [3, 7, 14, 30];
const MAX_TAGS_SHOWN = 3;

const LEVEL_TONE: Record<StalenessLevel, 'green' | 'gold' | 'red'> = {
  fresh: 'green',
  due: 'gold', // amber = scan gold
  stale: 'red',
};

const LEVEL_TEXT: Record<StalenessLevel, string> = {
  fresh: 'Fresh',
  due: 'Due',
  stale: 'Stale',
};

/** Sort key for "stalest first": age in days ÷ cadence. Never scanned
 *  sorts above everything (Infinity). */
function stalenessRatio(source: Source): number {
  const last = toMillis(source.lastScrapedAt);
  if (last === null) return Number.POSITIVE_INFINITY;
  const cadence = Math.max(1, source.cadenceDays ?? 7);
  return (Date.now() - last) / MS_PER_DAY / cadence;
}

function identity(source: Source): string {
  return source.sellerId ?? source.keyword ?? source.sourceId;
}

function logPatchError(err: unknown): void {
  console.error('[proscan:watchlist] source patch failed', err);
}

/* ── inline icons (16px, stroke = currentColor) ─────────────────── */

function EyeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── row ────────────────────────────────────────────────────────── */

interface RowModel {
  source: Source;
  stale: Staleness;
}

function WatchlistRow({
  wid,
  source,
  stale,
  onOpen,
}: {
  wid: string;
  source: Source;
  stale: Staleness;
  onOpen: (sourceId: string) => void;
}) {
  const watched = source.watched === true;
  const cadence = source.cadenceDays ?? 7;
  const cadenceOptions = CADENCE_OPTIONS.includes(cadence)
    ? CADENCE_OPTIONS
    : [...CADENCE_OPTIONS, cadence].sort((a, b) => a - b);
  const tags = source.tags ?? [];
  const ident = identity(source);
  const neverScanned = toMillis(source.lastScrapedAt) === null;

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    // Controls handle themselves — only bare-cell clicks navigate.
    if ((e.target as Element).closest('button, a, input, select')) return;
    onOpen(source.sourceId);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      onOpen(source.sourceId);
    }
  };

  return (
    <tr
      className="wl-row"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      aria-label={`Open products from ${source.nickname ?? ident}`}
    >
      <td className="wl-cell--ctl">
        <button
          type="button"
          className={watched ? 'wl-iconbtn wl-iconbtn--on' : 'wl-iconbtn'}
          aria-pressed={watched}
          title={
            watched
              ? 'Watching — click to pause rescan reminders'
              : 'Not watching — click to watch'
          }
          onClick={() =>
            sourcePatch(wid, source.sourceId, { watched: !watched }).catch(
              logPatchError,
            )
          }
        >
          {watched ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </td>
      <td>
        <NicknameCell wid={wid} source={source} />
      </td>
      <td>
        <Chip>{source.type === 'storefront' ? 'Storefront' : 'Keyword'}</Chip>
      </td>
      <td className="mono wl-cell--id" title={ident}>
        {ident}
      </td>
      <td className="mono wl-cell--num">
        {compactNumber(source.catalogSize)}
      </td>
      <td className="mono wl-cell--muted">
        {relativeTime(source.lastScrapedAt)}
      </td>
      <td>
        <Chip tone={LEVEL_TONE[stale.level]} title={stale.label}>
          {neverScanned ? 'Never' : LEVEL_TEXT[stale.level]}
        </Chip>
      </td>
      <td>
        <select
          className="wl-cadence"
          value={cadence}
          aria-label="Rescan cadence in days"
          title="Rescan cadence"
          onChange={(e) =>
            sourcePatch(wid, source.sourceId, {
              cadenceDays: Number(e.target.value),
            }).catch(logPatchError)
          }
        >
          {cadenceOptions.map((d) => (
            <option key={d} value={d}>
              {d}d
            </option>
          ))}
        </select>
      </td>
      <td>
        {tags.length === 0 ? (
          <span className="wl-dash">—</span>
        ) : (
          <span className="wl-tags">
            {tags.slice(0, MAX_TAGS_SHOWN).map((t) => (
              <Tag key={t} label={t} />
            ))}
            {tags.length > MAX_TAGS_SHOWN ? (
              <span
                className="wl-tags-more"
                title={tags.slice(MAX_TAGS_SHOWN).join(', ')}
              >
                +{tags.length - MAX_TAGS_SHOWN}
              </span>
            ) : null}
          </span>
        )}
      </td>
      <td className="wl-cell--ctl">
        {source.url ? (
          <a
            className="wl-iconbtn"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Amazon"
            aria-label="Open in Amazon"
          >
            <ExternalIcon />
          </a>
        ) : null}
      </td>
    </tr>
  );
}

/* ── table ──────────────────────────────────────────────────────── */

export interface WatchlistTableProps {
  wid: string;
  sources: Source[];
}

export default function WatchlistTable({ wid, sources }: WatchlistTableProps) {
  const navigate = useNavigate();

  const rows = useMemo<RowModel[]>(() => {
    const models = sources.map((source) => ({
      source,
      stale: staleness(source),
      ratio: stalenessRatio(source),
    }));
    models.sort((a, b) => {
      const watchedDiff =
        (b.source.watched === true ? 1 : 0) -
        (a.source.watched === true ? 1 : 0);
      if (watchedDiff !== 0) return watchedDiff;
      if (a.ratio !== b.ratio) return b.ratio - a.ratio;
      return identity(a.source).localeCompare(identity(b.source));
    });
    return models;
  }, [sources]);

  const openSource = (sourceId: string) => {
    navigate(`/?source=${encodeURIComponent(sourceId)}`);
  };

  return (
    <div className="wl-card">
      <table className="wl-table">
        <thead>
          <tr>
            <th className="wl-cell--ctl" aria-label="Watched" />
            <th>Nickname</th>
            <th>Type</th>
            <th>Seller / keyword</th>
            <th className="wl-cell--num">Catalog</th>
            <th>Last scan</th>
            <th>Status</th>
            <th>Cadence</th>
            <th>Tags</th>
            <th className="wl-cell--ctl" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ source, stale }) => (
            <WatchlistRow
              key={source.sourceId}
              wid={wid}
              source={source}
              stale={stale}
              onOpen={openSource}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
