import type { CSSProperties } from 'react';
import './components.css';

export interface SkeletonProps {
  variant?: 'block' | 'table-row';
  /** block: CSS size values. */
  width?: number | string;
  height?: number | string;
  /** table-row: how many rows to render. */
  rows?: number;
}

/** Loading placeholder with the slow gold-tinted scan sweep. */
export default function Skeleton({
  variant = 'block',
  width = '100%',
  height = 14,
  rows = 5,
}: SkeletonProps) {
  if (variant === 'table-row') {
    return (
      <div role="presentation" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton--row" key={i}>
            <div className="skeleton" style={{ width: '28%' }} />
            <div className="skeleton" style={{ width: '14%' }} />
            <div className="skeleton" style={{ width: '10%' }} />
            <div className="skeleton" style={{ width: '18%' }} />
            <div className="skeleton" style={{ width: '8%' }} />
          </div>
        ))}
      </div>
    );
  }
  const style: CSSProperties = { width, height };
  return <div className="skeleton" style={style} aria-hidden="true" />;
}
