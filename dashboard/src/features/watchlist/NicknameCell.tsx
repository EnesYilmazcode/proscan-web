// Click-to-edit nickname cell. Display = nickname, or the sellerId/keyword
// as an italic placeholder. Enter/blur commits via sourcePatch (merge-only);
// Escape cancels. Clearing the field stores nickname: null.

import { useRef, useState, type KeyboardEvent } from 'react';
import { sourcePatch } from '../../lib/queries';
import type { Source } from '../../lib/types';
import './watchlist.css';

export interface NicknameCellProps {
  wid: string;
  source: Source;
}

export default function NicknameCell({ wid, source }: NicknameCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);

  const placeholder = source.sellerId ?? source.keyword ?? source.sourceId;

  const begin = () => {
    cancelRef.current = false;
    setDraft(source.nickname ?? '');
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === (source.nickname ?? '')) return;
    sourcePatch(wid, source.sourceId, { nickname: next || null }).catch(
      (err: unknown) =>
        console.error('[proscan:watchlist] nickname patch failed', err),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      cancelRef.current = true;
      e.currentTarget.blur();
    }
  };

  if (editing) {
    return (
      <input
        className="wl-nick-input"
        value={draft}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (cancelRef.current) {
            cancelRef.current = false;
            setEditing(false);
          } else {
            commit();
          }
        }}
        aria-label="Source nickname"
      />
    );
  }

  return (
    <button
      type="button"
      className={
        source.nickname ? 'wl-nick' : 'wl-nick wl-nick--placeholder'
      }
      onClick={begin}
      title="Click to rename"
    >
      {source.nickname ?? placeholder}
    </button>
  );
}
