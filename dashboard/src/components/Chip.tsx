import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';
import './components.css';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'gold' | 'green' | 'red';
}

/** Small bordered label chip. */
export default function Chip({ tone = 'neutral', className, ...rest }: ChipProps) {
  return (
    <span
      className={clsx('chip', tone !== 'neutral' && `chip--${tone}`, className)}
      {...rest}
    />
  );
}
