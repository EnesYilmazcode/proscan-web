import { defineConfig } from 'vite';
import { buildStamp } from './scripts/build-info.mjs';

// Phase 0 layout:
//   index.html  -> Vite entry (the marketing landing page)
//   src/        -> bundled source (style.css, main.js)
//   public/     -> copied verbatim to dist/ (icon128.png, 404.html, Google verification)
//   dist/       -> build output served by Firebase Hosting (firebase.json: public = "dist")
//
// The static landing page stays byte-for-byte identical to what shipped before —
// this only introduces a real source -> build pipeline so the revamp (auth + /dashboard)
// has somewhere clean to grow. See REVAMP_PLAN.md.
//
// emptyOutDir is off so running build:landing alone can't delete
// dist/dashboard; `npm run build` cleans dist/ first.
export default defineConfig({
  plugins: [buildStamp({ emitVersionJson: true })],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
});
