import type { RunStatus } from '../lib/types';
import './components.css';

export interface StatusDotProps {
  status: RunStatus;
  /** Hide the text label and show only the dot. */
  dotOnly?: boolean;
}

const LABELS: Record<RunStatus, string> = {
  active: 'Active',
  complete: 'Complete',
  stopped: 'Stopped',
  dead: 'Dead',
};

/** Run status indicator: active=gold pulse, complete=green, stopped=slate,
 *  dead=red. */
export default function StatusDot({ status, dotOnly }: StatusDotProps) {
  return (
    <span className={`status-dot status-dot--${status}`} title={LABELS[status]}>
      {dotOnly ? null : LABELS[status]}
    </span>
  );
}
