import { defineConfig } from 'vite';

// Phase 0 layout:
//   index.html  -> Vite entry (the marketing landing page)
//   src/        -> bundled source (style.css, main.js)
//   public/     -> copied verbatim to dist/ (icon128.png, 404.html, Google verification)
//   dist/       -> build output served by Firebase Hosting (firebase.json: public = "dist")
//
// The static landing page stays byte-for-byte identical to what shipped before —
// this only introduces a real source -> build pipeline so the revamp (auth + /dashboard)
// has somewhere clean to grow. See REVAMP_PLAN.md.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
