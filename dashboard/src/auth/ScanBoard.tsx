import type { CSSProperties } from 'react';

/**
 * The login's signature: an ambient "scan board" — a slow gold radar sweep
 * (the shipped radar-sweep motif) passing over a sample ProScan readout of
 * storefront rows with buyer-semantic deltas (price drop = green) and the
 * real Max Buy pill. It reuses the dashboard's actual component styles
 * (.delta, .maxbuy, .status-dot, Spline Sans Mono) so the login reads as the
 * same instrument the user is about to walk into — not an ad for it.
 *
 * Purely decorative and aria-hidden; nothing functional lives here, so it is
 * dropped entirely below 920px with no loss.
 */
const ROWS: { name: string; price: string; delta: string; kind: 'good' | 'bad' | 'flat' }[] = [
  { name: 'ECHO BUDS PRO', price: '$24.10', delta: '▼ 12%', kind: 'good' },
  { name: 'USB-C 100W HUB', price: '$31.50', delta: '▲ 4%', kind: 'bad' },
  { name: 'STEEL TUMBLER 30OZ', price: '$18.90', delta: '▼ 7%', kind: 'good' },
  { name: 'LED DESK LAMP', price: '$42.00', delta: '— 0%', kind: 'flat' },
  { name: 'MINI PHONE TRIPOD', price: '$12.75', delta: '▼ 9%', kind: 'good' },
];

export default function ScanBoard() {
  return (
    <div className="scanboard" aria-hidden="true">
      <div className="scanboard__sweep" />
      <div className="scanboard__inner">
        <div className="scanboard__head">
          <span className="status-dot status-dot--active scanboard__status">
            Scanning storefront
          </span>
          <span className="scanboard__count mono">3 / 5</span>
        </div>

        <div className="scanboard__rows">
          {ROWS.map((r, i) => (
            <div
              className="scanboard__row"
              style={{ '--row': i } as CSSProperties}
              key={r.name}
            >
              <span className="scanboard__name">{r.name}</span>
              <span className="scanboard__price mono">{r.price}</span>
              <span className={`delta delta--${r.kind} scanboard__delta`}>{r.delta}</span>
            </div>
          ))}
        </div>

        <div className="scanboard__verdict">
          <span className="maxbuy">MAX BUY&nbsp;&nbsp;$18.40</span>
          <span className="scanboard__verdict-text">Buy below to clear ~35% ROI.</span>
        </div>
      </div>
    </div>
  );
}
