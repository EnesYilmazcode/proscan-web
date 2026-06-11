import { useLocation } from 'react-router-dom';
import './shell.css';

/** Route-derived view title for the slim topbar. */
function viewTitle(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Products';
  if (pathname.startsWith('/runs')) return 'Runs';
  if (pathname.startsWith('/watchlist')) return 'Watchlist';
  return 'Not found';
}

/** Portal target id for route-level topbar actions:
 *  createPortal(actions, document.getElementById(TOPBAR_ACTIONS_ID)!). */
export const TOPBAR_ACTIONS_ID = 'topbar-actions';

/** Slim dark strip: current view title + right-side actions portal slot. */
export default function Topbar() {
  const { pathname } = useLocation();
  return (
    <header className="topbar chrome-texture">
      <span className="topbar__title">{viewTitle(pathname)}</span>
      <div className="topbar__actions" id={TOPBAR_ACTIONS_ID} />
    </header>
  );
}
