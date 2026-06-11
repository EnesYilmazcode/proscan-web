import { clsx } from 'clsx';
import { money } from '../lib/format';
import './components.css';

export interface MoneyCellProps {
  /** Integer cents. undefined/null renders an em-dash. */
  cents: number | null | undefined;
  strong?: boolean;
  muted?: boolean;
  className?: string;
}

/** Tabular-mono money value ('$12.34'). The ONLY way to print cents. */
export default function MoneyCell({ cents, strong, muted, className }: MoneyCellProps) {
  return (
    <span
      className={clsx(
        'money',
        strong && 'money--strong',
        muted && 'money--muted',
        className,
      )}
    >
      {money(cents)}
    </span>
  );
}
