// Finds the extension checkout next to this repo: PROSCAN_EXT, else
// ../ext or ../AmazonSellerScraper. The schema check, the sync rules test
// and the e2e seed all run the extension's own files from there.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const WEB_ROOT = resolve(import.meta.dirname, '..', '..');

export function findExtension(env = process.env) {
  const candidates = env.PROSCAN_EXT
    ? [resolve(env.PROSCAN_EXT)]
    : [resolve(WEB_ROOT, '..', 'ext'), resolve(WEB_ROOT, '..', 'AmazonSellerScraper')];
  return candidates.find((dir) => existsSync(resolve(dir, 'packages', 'schema', 'index.js'))) ?? null;
}

/** The checkout, or exit: these checks mean nothing without the real files. */
export function requireExtension(what) {
  const dir = findExtension();
  if (dir) return dir;
  if (process.env.PROSCAN_ALLOW_NO_EXT === '1') {
    console.log(`SKIP ${what}: no extension checkout (PROSCAN_ALLOW_NO_EXT=1)`);
    process.exit(0);
  }
  console.error(`${what} needs the extension checkout. Set PROSCAN_EXT, or PROSCAN_ALLOW_NO_EXT=1 to skip.`);
  process.exit(1);
}
