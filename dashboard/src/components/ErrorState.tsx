import type { ReactNode } from 'react';
import { describeError } from '../lib/errors';
import Button from './Button';
import './components.css';

export interface ErrorStateProps {
  title: string;
  error: unknown;
  /** Defaults to a full page reload. */
  onRetry?: () => void;
  extra?: ReactNode;
}

/** Failure view that shows the real Firestore code and message. */
export default function ErrorState({ title, error, onRetry, extra }: ErrorStateProps) {
  const info = describeError(error);
  return (
    <div className="empty errstate" role="alert">
      <div className="empty__title">{title}</div>
      <p className="empty__body">
        {info.code ? <code className="errstate__code">{info.code}</code> : null}
        {info.message}
      </p>
      {info.indexUrl ? (
        <p className="empty__body">
          <a href={info.indexUrl} target="_blank" rel="noopener noreferrer">
            Create the missing index
          </a>
        </p>
      ) : null}
      {extra}
      <Button variant="ghost" onClick={onRetry ?? (() => window.location.reload())}>
        Retry
      </Button>
    </div>
  );
}
