// HISTORY DRAWER + LEAD TRIAGE — the one-ASIN deep dive, rendered in the
// shared 480px Drawer (Esc / scrim close come from it). Opened by the
// Products route via ?asin=. Read budget per open (billing-runbook):
// product doc + history/daily as ONE-SHOT reads, newest offerSnapshot as a
// ONE-SHOT query only when the product has a spread — never listeners on
// history/snapshots. Recharts loads via React.lazy so it stays out of the
// main chunk.

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Chip from '../../components/Chip';
import Drawer from '../../components/Drawer';
import EmptyState from '../../components/EmptyState';
import KeyValue from '../../components/KeyValue';
import Skeleton from '../../components/Skeleton';
import Sparkline, { type SparklinePoint } from '../../components/Sparkline';
import { compactNumber, money, pct, relativeTime } from '../../lib/format';
import { useDocOnce, useWorkspace } from '../../lib/hooks';
import { historyDaily } from '../../lib/queries';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type LeadStage,
  type Offer,
} from '../../lib/types';
import { useLatestOfferSnapshot, useProductOnce } from './data';
import LeadTriage, { STAGE_LABELS } from './LeadTriage';
import type { PriceChartPoint } from './PriceHistoryChart';
import './drawer.css';

const PriceHistoryChart = lazy(() => import('./PriceHistoryChart'));

export interface HistoryDrawerProps {
  wid: string;
  asin: string;
  onClose: () => void;
}

const STAGE_TONES: Record<LeadStage, 'neutral' | 'gold' | 'green' | 'red'> = {
  new: 'neutral',
  reviewing: 'gold',
  approved: 'green',
  purchased: 'green',
  rejected: 'red',
  archived: 'neutral',
};

/** Buyer semantics on the trend strokes: rating/review GROWTH is green. */
function trendStroke(points: SparklinePoint[]): string {
  if (points.length < 2) return 'var(--muted)';
  const first = points[0].y;
  const last = points[points.length - 1].y;
  if (last === first) return 'var(--muted)';
  return last > first ? 'var(--green)' : 'var(--red)';
}

function DrawerSkeleton() {
  return (
    <>
      <Skeleton height={18} width="60%" />
      <div style={{ height: 'var(--space-4)' }} />
      <Skeleton height={120} />
      <div style={{ height: 'var(--space-4)' }} />
      <Skeleton variant="table-row" rows={6} />
    </>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <tr>
      <td className="hd-offers__seller" title={offer.name ?? offer.sid}>
        {offer.name ?? offer.sid ?? '—'}
      </td>
      <td className="hd-offers__num mono">{money(offer.p)}</td>
      <td className="hd-offers__num mono">
        {offer.ship === 0 ? 'Free' : money(offer.ship)}
      </td>
      <td>{offer.fba === 1 ? <Chip>FBA</Chip> : <span className="hd-muted">FBM</span>}</td>
      <td className="hd-offers__bb" title={offer.bb === 1 ? 'Holds the buy box' : undefined}>
        {offer.bb === 1 ? '★' : ''}
      </td>
    </tr>
  );
}

/** Right slide-over with the price/rating history, spread summary, Max Buy
 *  pill, the plain-English verdict sentence, and lead triage for one ASIN. */
export default function HistoryDrawer({ wid, asin, onClose }: HistoryDrawerProps) {
  const { workspace } = useWorkspace();
  const product = useProductOnce(wid, asin);
  const historyRef = useMemo(() => historyDaily(wid, asin), [wid, asin]);
  const history = useDocOnce(historyRef);
  const snapshot = useLatestOfferSnapshot(wid, asin, Boolean(product.data?.spread));

  // Optimistic lead stage — shared by the header chip and the triage control.
  const [optimisticStage, setOptimisticStage] = useState<LeadStage | null>(null);
  useEffect(() => setOptimisticStage(null), [asin]);

  const [copied, setCopied] = useState(false);
  const copyAsin = async () => {
    try {
      await navigator.clipboard.writeText(asin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  };

  const p = product.data;
  const spread = p?.spread;
  const maxBuy = p?.scores?.maxBuy;
  const stage: LeadStage = optimisticStage ?? p?.lead?.stage ?? 'new';
  const roiPct =
    workspace?.settings?.defaultRoiPct ?? DEFAULT_WORKSPACE_SETTINGS.defaultRoiPct;

  // history.d → ascending [dayKey, point] series (one doc = whole timeline).
  const series = useMemo(
    () => Object.entries(history.data?.d ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
    [history.data],
  );
  const chartData = useMemo<PriceChartPoint[]>(
    () => series.map(([day, pt]) => ({ day, p: pt.p, md: pt.md })),
    [series],
  );
  const pricePointCount = useMemo(
    () => series.reduce((n, [, pt]) => (typeof pt.p === 'number' ? n + 1 : n), 0),
    [series],
  );
  const ratingPoints = useMemo<SparklinePoint[]>(
    () =>
      series
        .filter(([, pt]) => typeof pt.r === 'number')
        .map(([day, pt]) => ({ x: day, y: pt.r as number })),
    [series],
  );
  const reviewPoints = useMemo<SparklinePoint[]>(
    () =>
      series
        .filter(([, pt]) => typeof pt.v === 'number')
        .map(([day, pt]) => ({ x: day, y: pt.v as number })),
    [series],
  );

  return (
    <Drawer title={<span className="mono">{asin}</span>} onClose={onClose}>
      {product.loading ? (
        <DrawerSkeleton />
      ) : !p ? (
        <EmptyState
          title="Not tracked yet"
          body="This ASIN isn't in your workspace. Scan a storefront or keyword that carries it and the full history lands here."
        />
      ) : (
        <>
          {/* 1 · header */}
          <section className="hd-section">
            <div className="hd-head">
              {p.img ? (
                <img className="hd-head__thumb" src={p.img} alt="" />
              ) : (
                <div className="hd-head__thumb hd-head__thumb--empty" aria-hidden="true">
                  ·
                </div>
              )}
              <div className="hd-head__main">
                <div className="hd-head__name" title={p.name}>
                  {p.name ?? asin}
                </div>
                <div className="hd-head__meta">
                  <button
                    type="button"
                    className="hd-asin mono"
                    onClick={copyAsin}
                    title="Copy ASIN"
                  >
                    {asin} <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
                  </button>
                  {p.url ? (
                    <a
                      className="hd-link"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Amazon ↗
                    </a>
                  ) : null}
                  <Chip tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Chip>
                </div>
              </div>
            </div>
          </section>

          {/* 2 · THE VERDICT BLOCK (signature) */}
          <section className="hd-section">
            {typeof maxBuy === 'number' && typeof spread?.md === 'number' ? (
              <div className="hd-verdict">
                <p className="hd-verdict__sentence">
                  Buy below <span className="mono">{money(maxBuy)}</span> to clear{' '}
                  {roiPct}% ROI at today&rsquo;s{' '}
                  <span className="mono">{money(spread.md)}</span> median.
                </p>
                <span className="maxbuy hd-verdict__pill">
                  MAX BUY {money(maxBuy)}
                </span>
              </div>
            ) : (
              <div className="hd-verdict hd-verdict--empty">
                Run a spread analysis in the extension to get a Max Buy price.
              </div>
            )}
          </section>

          {/* 3 · price history */}
          <section className="hd-section">
            <div className="hd-section__title">
              Price history
              {series.length > 0 ? (
                <span className="hd-section__aside mono">
                  {series.length} day{series.length === 1 ? '' : 's'} tracked
                </span>
              ) : null}
            </div>
            {history.loading ? (
              <Skeleton height={220} />
            ) : pricePointCount < 2 ? (
              <div className="hd-muted">History builds with each scan.</div>
            ) : (
              <Suspense fallback={<Skeleton height={220} />}>
                <PriceHistoryChart data={chartData} />
              </Suspense>
            )}
          </section>

          {/* 4 · rating / review trends */}
          <section className="hd-section">
            <div className="hd-section__title">Trends</div>
            <div className="hd-sparks">
              <div className="hd-spark">
                <div className="hd-spark__top">
                  <span className="hd-spark__label">Rating</span>
                  <span className="hd-spark__value mono">
                    {typeof p.latest?.r === 'number' ? p.latest.r.toFixed(1) : '—'}
                  </span>
                </div>
                {ratingPoints.length >= 2 ? (
                  <Sparkline
                    points={ratingPoints}
                    width={160}
                    height={32}
                    stroke={trendStroke(ratingPoints)}
                  />
                ) : (
                  <span className="hd-muted">Needs two scans</span>
                )}
              </div>
              <div className="hd-spark">
                <div className="hd-spark__top">
                  <span className="hd-spark__label">Reviews</span>
                  <span className="hd-spark__value mono">
                    {compactNumber(p.latest?.v)}
                  </span>
                </div>
                {reviewPoints.length >= 2 ? (
                  <Sparkline
                    points={reviewPoints}
                    width={160}
                    height={32}
                    stroke={trendStroke(reviewPoints)}
                  />
                ) : (
                  <span className="hd-muted">Needs two scans</span>
                )}
              </div>
            </div>
          </section>

          {/* 5 · spread detail (only when a spread exists) */}
          {spread ? (
            <section className="hd-section">
              <div className="hd-section__title">
                Offer spread
                {spread.at ? (
                  <span className="hd-section__aside mono">
                    {relativeTime(spread.at)}
                  </span>
                ) : null}
              </div>
              {spread.az ? (
                <div className="hd-az-warn">
                  <Chip tone="red">Amazon on listing</Chip>
                </div>
              ) : null}
              <div className="hd-kv-grid">
                <KeyValue label="Sellers" value={spread.sc ?? '—'} mono />
                <KeyValue
                  label="Range"
                  value={`${money(spread.mn)}–${money(spread.mx)}`}
                  mono
                />
                <KeyValue label="Median" value={money(spread.md)} mono />
                <KeyValue
                  label="CV"
                  value={
                    typeof spread.cv === 'number'
                      ? pct(spread.cv * 100, { digits: 0 })
                      : '—'
                  }
                  mono
                />
                <KeyValue label="Offers" value={spread.oc ?? '—'} mono />
                <KeyValue
                  label="FBA / FBM"
                  value={`${spread.fba ?? '—'} / ${spread.fbm ?? '—'}`}
                  mono
                />
                <KeyValue
                  label="Buy box"
                  value={
                    <span className="hd-bb-val">
                      <span className="mono">{money(spread.bb?.p)}</span>
                      {spread.bb?.fba ? <Chip>FBA</Chip> : null}
                    </span>
                  }
                />
              </div>
              {snapshot.loading ? (
                <div className="hd-offers-skeleton">
                  <Skeleton variant="table-row" rows={3} />
                </div>
              ) : snapshot.data?.offers?.length ? (
                <>
                  <table className="hd-offers">
                    <thead>
                      <tr>
                        <th>Seller</th>
                        <th className="hd-offers__num">Price</th>
                        <th className="hd-offers__num">Ship</th>
                        <th>FBA</th>
                        <th>BB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.data.offers.map((offer, i) => (
                        <OfferRow key={offer.sid ?? i} offer={offer} />
                      ))}
                    </tbody>
                  </table>
                  <div className="hd-offers-note">
                    AOD shows ~{snapshot.data.offers.length} of{' '}
                    {snapshot.data.totalOfferCount ??
                      spread.oc ??
                      snapshot.data.offers.length}{' '}
                    offers.
                  </div>
                </>
              ) : (
                <div className="hd-offers-note">
                  No raw offer snapshot for this ASIN yet.
                </div>
              )}
            </section>
          ) : null}

          {/* 6 · lead triage */}
          <section className="hd-section">
            <div className="hd-section__title">Lead triage</div>
            <LeadTriage
              key={asin}
              wid={wid}
              asin={asin}
              stage={stage}
              lead={p.lead}
              onStageChange={setOptimisticStage}
            />
          </section>

          {/* 7 · provenance */}
          <section className="hd-section">
            <div className="hd-section__title">Provenance</div>
            <div className="hd-prov">
              <span>First seen {relativeTime(p.firstSeenAt)}</span>
              {(p.sourceIds ?? []).map((sid) => (
                <Chip key={sid} className="mono">
                  {sid}
                </Chip>
              ))}
            </div>
          </section>
        </>
      )}
    </Drawer>
  );
}
