import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import './components.css';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

/** Gold primary / slate ghost / danger button. */
export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', className)}
      {...rest}
    />
  );
}
