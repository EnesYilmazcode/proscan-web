// Checks the built dist/ through the hosting emulator (F-43): SPA routes get
// the dashboard shell with no-cache, real assets are immutable, and a missing
// asset is a 404 instead of index.html served as JavaScript for a year.
// Run:  npm run build && npm run test:hosting

import { readdirSync } from 'node:fs';

// superstatic turns request paths into backslash paths on Windows, so the
// emulator there ignores every regex rewrite and glob header. Run this on
// Linux (CI does) or in WSL.
if (process.platform === 'win32') {
  console.log('SKIP: the hosting emulator mangles paths on Windows; run in CI or WSL');
  process.exit(0);
}

const BASE = `http://127.0.0.1:${process.env.EMU_HOSTING_PORT || 5000}`;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` (${detail})`}`);
};

async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  const body = await res.text();
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    cache: res.headers.get('cache-control') ?? '',
    body,
  };
}

const dashAsset = readdirSync('dist/dashboard/assets').find((f) => f.endsWith('.js'));

for (const path of ['/dashboard/', '/dashboard/runs', '/dashboard/watchlist']) {
  const r = await get(path);
  check(`${path} serves the dashboard shell`, r.status === 200 && r.body.includes('id="root"'), `${r.status}`);
  check(`${path} is no-cache`, r.cache === 'no-cache', r.cache);
}

const landing = await get('/');
check('/ is no-cache', landing.status === 200 && landing.cache === 'no-cache', `${landing.status} ${landing.cache}`);

const asset = await get(`/dashboard/assets/${dashAsset}`);
check('real asset is JavaScript', asset.status === 200 && asset.type.includes('javascript'), asset.type);
check('real asset is immutable', asset.cache.includes('immutable'), asset.cache);

const missing = await get('/dashboard/assets/PriceHistoryChart-OLDHASH.js');
check('missing asset is a 404', missing.status === 404, `${missing.status} ${missing.type}`);
check('missing asset is not the SPA shell', !missing.body.includes('id="root"'));

console.log(failed === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
