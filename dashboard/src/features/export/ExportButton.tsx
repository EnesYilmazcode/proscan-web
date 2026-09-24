// Gold "Export XLSX" action for table views. `load` fetches the rows to
// write, a page at a time when the scope is bigger than what is loaded,
// then exportProductsXlsx writes them (it dynamic-imports xlsx on first
// click). `count` is what the badge shows, when it is known up front.

import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import type { Product } from '../../lib/types';
import { exportProductsXlsx } from './exportXlsx';
import { reportError } from '../../lib/errors';
import './export.css';

export interface ExportButtonProps {
  load: (onProgress: (loaded: number) => void) => Promise<Product[]>;
  count: number | null;
  disabled?: boolean;
}

type Phase = 'idle' | 'working' | 'done';

const CONFIRM_MS = 1500;

export default function ExportButton({ load, count, disabled }: ExportButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [written, setWritten] = useState(0);
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
    if (phase === 'working' || count === 0) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('working');
    setProgress(0);
    try {
      const rows = await load((n) => {
        if (mountedRef.current) setProgress(n);
      });
      if (rows.length === 0) throw new Error('nothing to export');
      await exportProductsXlsx(rows);
      if (!mountedRef.current) return;
      setWritten(rows.length);
      setPhase('done');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPhase('idle');
      }, CONFIRM_MS);
    } catch (err) {
      reportError('export XLSX', err);
      if (mountedRef.current) setPhase('idle');
    }
  };

  const empty = count === 0;
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <Button
      onClick={() => void handleClick()}
      disabled={disabled || empty || phase === 'working'}
      aria-busy={phase === 'working'}
      title={
        empty
          ? 'Nothing to export'
          : count === null
            ? 'Export every matching product to Excel'
            : `Export ${fmt(count)} rows to Excel`
      }
    >
      {phase === 'done' ? (
        `Exported ${fmt(written)} ✓`
      ) : (
        <>
          {phase === 'working' ? `Exporting… ${progress > 0 ? fmt(progress) : ''}` : 'Export XLSX'}
          {phase !== 'working' && count !== null && !empty ? (
            <span className="export-btn__count" aria-label={`${count} rows`}>
              {fmt(count)}
            </span>
          ) : null}
        </>
      )}
    </Button>
  );
}
