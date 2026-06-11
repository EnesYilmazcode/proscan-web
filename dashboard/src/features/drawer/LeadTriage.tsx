// LEAD TRIAGE — stage segmented control + notes / rejected-reason fields.
// Stage moves are optimistic: the parent's stage state flips immediately,
// then leadStageUpdate + appendEvent({type:'stageChange',from,to}) land;
// on failure the stage reverts and an error line shows. Text fields are
// debounced merge-writes to lead.* that do NOT bump stageChangedAt
// (drawer-local leadFieldPatch — leadStageUpdate is for stage moves only).

import { clsx } from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appendEvent, leadStageUpdate } from '../../lib/queries';
import { LEAD_STAGES, type LeadStage, type ProductLead } from '../../lib/types';
import { leadFieldPatch } from './data';
import './drawer.css';

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  approved: 'Approved',
  purchased: 'Purchased',
  rejected: 'Rejected',
  archived: 'Archived',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Debounced text persister: queue() on every keystroke, writes after
 *  `delayMs` of quiet; the pending value is flushed on unmount so closing
 *  the drawer mid-typing never loses a note. */
function useDebouncedSave(save: (value: string) => Promise<void>, delayMs = 600) {
  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [status, setStatus] = useState<SaveStatus>('idle');

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    saveRef
      .current(value)
      .then(() => setStatus('saved'))
      .catch(() => setStatus('error'));
  }, []);

  const queue = useCallback(
    (value: string) => {
      pending.current = value;
      setStatus('saving');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  // Best-effort flush of an in-flight edit when the drawer closes.
  useEffect(() => () => flush(), [flush]);

  return { queue, status };
}

function SaveHint({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const text =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed';
  return (
    <span
      className={clsx(
        'hd-field__status',
        status === 'error' && 'hd-field__status--error',
      )}
    >
      {text}
    </span>
  );
}

export interface LeadTriageProps {
  wid: string;
  asin: string;
  /** Current (optimistic) stage — owned by HistoryDrawer so the header
   *  chip stays in sync. */
  stage: LeadStage;
  /** Persisted lead doc fields (initial values for the text inputs). */
  lead: ProductLead | undefined;
  onStageChange: (next: LeadStage) => void;
}

export default function LeadTriage({
  wid,
  asin,
  stage,
  lead,
  onStageChange,
}: LeadTriageProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [reason, setReason] = useState(lead?.rejectedReason ?? '');

  const notesSave = useDebouncedSave(
    useCallback(
      (value: string) => leadFieldPatch(wid, asin, { notes: value || null }),
      [wid, asin],
    ),
  );
  const reasonSave = useDebouncedSave(
    useCallback(
      (value: string) =>
        leadFieldPatch(wid, asin, { rejectedReason: value || null }),
      [wid, asin],
    ),
  );

  const selectStage = (next: LeadStage) => {
    if (next === stage || busy) return;
    const prev = stage;
    setError(null);
    setBusy(true);
    onStageChange(next); // optimistic — revert below on failure
    Promise.all([
      leadStageUpdate(wid, asin, next),
      appendEvent(wid, asin, { type: 'stageChange', from: prev, to: next }),
    ])
      .then(() => setBusy(false))
      .catch(() => {
        onStageChange(prev);
        setBusy(false);
        setError('Stage change failed — check your connection and retry.');
      });
  };

  return (
    <div>
      <div className="hd-stages" role="radiogroup" aria-label="Lead stage">
        {LEAD_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === stage}
            className={clsx(
              'hd-stages__btn',
              s === stage && 'hd-stages__btn--active',
            )}
            disabled={busy && s !== stage}
            onClick={() => selectStage(s)}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? <div className="hd-error">{error}</div> : null}

      {stage === 'rejected' ? (
        <div className="hd-field">
          <label className="hd-field__label" htmlFor="hd-rejected-reason">
            Rejected reason
            <SaveHint status={reasonSave.status} />
          </label>
          <input
            id="hd-rejected-reason"
            className="hd-input"
            value={reason}
            placeholder="Why was this a pass?"
            onChange={(e) => {
              setReason(e.target.value);
              reasonSave.queue(e.target.value);
            }}
          />
        </div>
      ) : null}

      <div className="hd-field">
        <label className="hd-field__label" htmlFor="hd-notes">
          Notes
          <SaveHint status={notesSave.status} />
        </label>
        <textarea
          id="hd-notes"
          className="hd-textarea"
          value={notes}
          placeholder="Sourcing notes — supplier, bundle math, recheck reminders…"
          onChange={(e) => {
            setNotes(e.target.value);
            notesSave.queue(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
