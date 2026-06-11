import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuthUser, useScanActivity } from '../lib/hooks';
import { RadarIcon } from '../components/EmptyState';
import './shell.css';

function ProductsGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function RunsGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <polyline points="1.5,8 4.5,8 6.5,3.5 9,11.5 10.8,8 13.5,8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function WatchlistGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M1.5 7.5C3 4.5 5 3 7.5 3s4.5 1.5 6 4.5c-1.5 3-3.5 4.5-6 4.5s-4.5-1.5-6-4.5Z" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="2" />
    </svg>
  );
}

/** Dark chrome rail: wordmark + radar-sweep logo (animates ONLY while a
 *  snapshot listener is receiving its first data), nav, session controls. */
export default function Sidebar() {
  const { user } = useAuthUser();
  const scanning = useScanActivity();

  return (
    <aside className="sidebar chrome-texture">
      <div className="sidebar__brand">
        <span className="logo-mark">
          {scanning ? <span className="logo-mark__sweep" /> : null}
          <RadarIcon size={26} />
        </span>
        <span className="sidebar__wordmark">ProScan</span>
      </div>

      <nav className="sidebar__nav">
        <NavLink to="/" end className="nav-link">
          <ProductsGlyph />
          Products
        </NavLink>
        <NavLink to="/runs" className="nav-link">
          <RunsGlyph />
          Runs
        </NavLink>
        <NavLink to="/watchlist" className="nav-link">
          <WatchlistGlyph />
          Watchlist
        </NavLink>
      </nav>

      <div className="sidebar__foot">
        <span className="sidebar__email" title={user?.email ?? undefined}>
          {user?.email ?? '—'}
        </span>
        <button
          type="button"
          className="sidebar__signout"
          onClick={() => void signOut(auth)}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
