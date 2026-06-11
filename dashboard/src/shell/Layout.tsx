import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './shell.css';

/** App shell grid: 232px chrome sidebar + topbar + light content area.
 *  Route content renders inside a 1400px container with the one-shot
 *  stagger animation, re-keyed per pathname so it replays on navigation. */
export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <Topbar />
        <main className="shell__content">
          <div className="shell__container stagger" key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
