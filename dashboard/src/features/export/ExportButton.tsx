// Gold "Export XLSX" action for table views. Exports the already-loaded
// rows via exportProductsXlsx (which dynamic-imports xlsx on first click).
// Props contract is FROZEN: { rows, disabled? }.

import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import type { Product } from '../../lib/types';
import { exportProductsXlsx } from './exportXlsx';
import './export.css';

export interface ExportButtonProps {
  rows: Product[];
  disabled?: boolean;
}

type Phase = 'idle' | 'working' | 'done';

const CONFIRM_MS = 1500;

export default function ExportButton({ rows, disabled }: ExportButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (phase === 'working' || rows.length === 0) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('working');
    try {
      // Async-aware: the first click also awaits the xlsx chunk download.
      await exportProductsXlsx(rows);
      if (!mountedRef.current) return;
      setPhase('done');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPhase('idle');
      }, CONFIRM_MS);
    } catch (err) {
      console.error('[proscan] XLSX export failed', err);
      if (mountedRef.current) setPhase('idle');
    }
  };

  const empty = rows.length === 0;

  return (
    <Button
      onClick={() => void handleClick()}
      disabled={disabled || empty || phase === 'working'}
      aria-busy={phase === 'working'}
      title={
        empty
          ? 'Nothing to export'
          : `Export ${rows.length.toLocaleString('en-US')} rows to Excel`
      }
    >
      {phase === 'done' ? (
        'Exported ✓'
      ) : (
        <>
          {phase === 'working' ? 'Exporting…' : 'Export XLSX'}
          {!empty && (
            <span className="export-btn__count" aria-label={`${rows.length} rows`}>
              {rows.length.toLocaleString('en-US')}
            </span>
          )}
        </>
      )}
    </Button>
  );
}
