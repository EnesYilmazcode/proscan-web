import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import './components.css';

export interface KeyValueProps {
  label: string;
  value: ReactNode;
  /** Render the value in tabular mono (numbers, prices, ASINs, dates). */
  mono?: boolean;
}

/** Mini-stat: uppercase micro label over a decisive value. */
export default function KeyValue({ label, value, mono }: KeyValueProps) {
  return (
    <div className="kv">
      <span className="kv__label">{label}</span>
      <span className={clsx('kv__value', mono && 'kv__value--mono')}>{value}</span>
    </div>
  );
}
