import { createBrowserRouter } from 'react-router-dom';
import Home from './routes/Home';
import NotFound from './routes/NotFound';

// The Firebase Hosting rewrite sends every unknown /dashboard/* path into this
// SPA, so the catch-all '*' route is required to render a proper not-found page.
export const router = createBrowserRouter(
  [
    { index: true, element: <Home /> },
    { path: '*', element: <NotFound /> },
  ],
  { basename: '/dashboard' },
);
