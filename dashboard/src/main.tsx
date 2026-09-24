// Fonts: Archivo (UI/display, variable) + Spline Sans Mono (all numerals,
// prices, ASINs, deltas, table dates). Never system fonts, never Inter.
import '@fontsource-variable/archivo';
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/600.css';
import './theme/tokens.css';
import './theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

// After a deploy, an open tab asks for chunk hashes that no longer exist.
// Reload once to pick up the new index.html; the guard stops a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'proscan:preload-reload';
  let recent = true;
  try {
    recent = Date.now() - Number(sessionStorage.getItem(KEY) || 0) < 10_000;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: no guard, so let the error surface instead */
  }
  if (!recent) {
    event.preventDefault();
    window.location.reload();
  }
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
