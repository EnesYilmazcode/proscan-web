import { useEffect, type ReactNode } from 'react';
import './components.css';

export interface DrawerProps {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Right slide-over (480px) with scrim. Closes on Esc or scrim click.
 *  Slides in over 240ms with the instrument easing curve. */
export default function Drawer({ title, onClose, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__head">
          <div className="drawer__title">{title}</div>
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </>
  );
}
