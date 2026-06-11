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

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
