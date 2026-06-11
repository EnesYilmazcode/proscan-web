import { createBrowserRouter } from 'react-router-dom';
import AuthGate from './auth/AuthGate';
import Layout from './shell/Layout';
import Products from './routes/Products';
import Runs from './routes/Runs';
import Watchlist from './routes/Watchlist';
import NotFound from './routes/NotFound';

// AuthGate wraps the shell: splash -> sign-in -> bootstrap -> app.
// The Firebase Hosting rewrite sends every unknown /dashboard/* path into
// this SPA, so the catch-all '*' route renders a proper not-found view.
export const router = createBrowserRouter(
  [
    {
      element: (
        <AuthGate>
          <Layout />
        </AuthGate>
      ),
      children: [
        { index: true, element: <Products /> },
        { path: 'runs', element: <Runs /> },
        { path: 'watchlist', element: <Watchlist /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/dashboard' },
);
