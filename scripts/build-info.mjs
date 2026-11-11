// Build stamp shared by both Vite configs, so anyone can tell which commit
// is live: GET /version.json, the <meta name="proscan-build"> tag, or the
// dashboard sidebar footer.

import { execSync } from 'node:child_process';

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

let cached;
export function buildInfo() {
  if (cached) return cached;
  const sha = process.env.GITHUB_SHA || git('rev-parse HEAD') || 'unknown';
  // dist/ and node_modules are ignored, so this only sees source edits.
  const dirty = !process.env.GITHUB_SHA && git('status --porcelain') !== '';
  cached = {
    sha,
    short: sha.slice(0, 7) + (dirty ? '-dirty' : ''),
    dirty,
    builtAt: new Date().toISOString(),
  };
  return cached;
}

/** Vite plugin: stamps the HTML, exposes __PROSCAN_BUILD__ and, when
 *  `emitVersionJson` is set, writes version.json next to the HTML. */
export function buildStamp({ emitVersionJson = false } = {}) {
  const info = buildInfo();
  return {
    name: 'proscan-build-stamp',
    config: () => ({ define: { __PROSCAN_BUILD__: JSON.stringify(info) } }),
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'proscan-build', content: info.short }, injectTo: 'head' },
    ],
    generateBundle() {
      if (!emitVersionJson) return;
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(info, null, 2) + '\n',
      });
    },
  };
}
