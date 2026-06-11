import type { ReactNode } from 'react';
import './components.css';

export interface EmptyStateProps {
  /** Custom inline SVG; defaults to the radar motif. */
  icon?: ReactNode;
  title: string;
  body?: string;
  /** Gold CTA element (Button or anchor). */
  cta?: ReactNode;
}

/** Simple inline radar motif — the "scan" brand mark for empty states. */
export function RadarIcon({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="24" opacity="0.35" />
      <circle cx="28" cy="28" r="16" opacity="0.5" />
      <circle cx="28" cy="28" r="8" opacity="0.7" />
      <line x1="28" y1="28" x2="46" y2="14" />
      <circle cx="38" cy="20" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="28" cy="28" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Centered empty state, max 360px: icon + headline + one sentence + CTA. */
export default function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon ?? <RadarIcon />}</div>
      <div className="empty__title">{title}</div>
      {body ? <p className="empty__body">{body}</p> : null}
      {cta}
    </div>
  );
}
