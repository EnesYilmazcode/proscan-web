// End to end: the extension's real engine and sync module (from its
// checkout) seed the emulator with 1,050 products over three runs on
// different days, then the production dashboard bundle, built against the
// emulators and served by `vite preview`, is signed in to and checked:
// every promised column fills, counts are true, Load more pages on, Movers
// compares runs, Export writes the whole scope, and a Google account can
// set a password the extension then signs in with (F-50).
//
//   npm run test:e2e
//
// Runs inside `firebase emulators:exec` (scripts/emulators.mjs). No Amazon
// traffic: every amazon.com and media-amazon.com request is answered here.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
import { requireExtension, WEB_ROOT } from './lib/extension.mjs';
import { asinOf, cards, installExtension, loadExtension } from './lib/extension-sync.mjs';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!AUTH_HOST || !FS_HOST) throw new Error('run through npm run test:e2e, which starts the emulators');

const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT || 4179);
const BASE = `http://localhost:${PREVIEW_PORT}/dashboard/`;
const OUT_DIR = resolve(WEB_ROOT, 'dist-e2e', 'dashboard');
const SHOTS = resolve(WEB_ROOT, '.screenshots', 'e2e');
const DEADLINE = Date.now() + 7 * 60 * 1000;
const DAY = 86400000;

const EMAIL = `e2e-${Date.now()}@proscan.test`;
const PASSWORD = 'e2e-pass-1234';
const STORE = 'https://www.amazon.com/s?me=A3K9XELT4QZ6M2&marketplaceID=ATVPDKIKX0DER';
const KEYWORD = 'https://www.amazon.com/s?k=stainless+tumbler';

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
// Bugs that live in the extension: reported, not fixed here. Strict, so
// the mark has to come off once the extension fixes them.
let known = 0;
const knownFailure = (name, ok, detail = '') => {
  if (ok) {
    failed++;
    console.log(`  FAIL ${name} now passes; remove its known-failure mark`);
  } else {
    known++;
    console.log(`  KNOWN FAILURE ${name}${detail ? ` (${detail})` : ''}`);
  }
};
const fmt = (n) => n.toLocaleString('en-US');

function firebase(name) {
  const app = initializeApp({ projectId: 'demo-proscan', apiKey: 'demo-key' }, name);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const [h, p] = FS_HOST.split(':');
  connectFirestoreEmulator(db, h, Number(p));
  return { app, auth, db };
}

/* ── the scan data ───────────────────────────────────────────────── */

// Run 2 moves a third of the storefront down, a third up, keeps the rest,
// and loses every 10th price to a parse failure.
const run2Price = (i) => (i % 10 === 0 ? null : i % 3 === 0 ? 1000 + i - 50 * ((i % 7) + 1) : i % 3 === 1 ? 1000 + i + 25 : 1000 + i);
const STORE_N = 700;
const KEYWORD_FROM = 650;
const KEYWORD_N = 400;
const UNIQUE = KEYWORD_FROM + KEYWORD_N; // 1,050
let expectedMovers = 0;
for (let i = 0; i < STORE_N; i++) {
  const p = run2Price(i);
  if (p !== null && p !== 1000 + i) expectedMovers++;
}

async function seed() {
  const ext = await loadExtension(requireExtension('the e2e seed'));
  const fb = firebase('e2e-seed');
  const uid = (await createUserWithEmailAndPassword(fb.auth, EMAIL, PASSWORD)).user.uid;
  const install = installExtension(ext, { uid, db: fb.db });
  const day1 = Date.parse('2026-09-01T14:00:00Z');
  const runs = [
    await install.scrape(STORE, day1, cards(STORE_N), 48),
    await install.scrape(STORE, day1 + 7 * DAY, cards(STORE_N, { price: run2Price }), 48),
    await install.scrape(KEYWORD, day1 + 8 * DAY, cards(KEYWORD_N, { offset: KEYWORD_FROM }), 48),
  ];
  const t0 = Date.now();
  const totals = await install.flush();
  console.log(`[seed] ${JSON.stringify(totals)} in ${Math.round((Date.now() - t0) / 1000)}s`);
  check('the extension synced three runs', totals.runs === 3 && (await install.pending()) === 0, JSON.stringify(totals));
  await terminate(fb.db);
  await deleteApp(fb.app);
  return { uid, runs, day1, ext };
}

/* ── the production bundle ───────────────────────────────────────── */

function build() {
  rmSync(resolve(WEB_ROOT, 'dist-e2e'), { recursive: true, force: true });
  const res = spawnSync('npx', ['vite', 'build', '--config', 'vite.dashboard.config.ts', '--outDir', OUT_DIR, '--emptyOutDir'], {
    cwd: WEB_ROOT,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, VITE_USE_EMULATOR: 'true' },
    timeout: 3 * 60 * 1000,
  });
  if (res.status !== 0) throw new Error('dashboard build failed');
}

async function preview() {
  // A server left over from an earlier run would stand in for this build.
  const taken = await fetch(BASE).then(() => true, () => false);
  if (taken) throw new Error(`port ${PREVIEW_PORT} already answers; stop that server or set E2E_PREVIEW_PORT`);
  const child = spawn(
    'npx',
    ['vite', 'preview', '--config', 'vite.dashboard.config.ts', '--outDir', OUT_DIR, '--port', String(PREVIEW_PORT), '--strictPort'],
    // Its own process group off Windows, so kill() takes vite down with npx.
    { cwd: WEB_ROOT, shell: true, stdio: 'ignore', detached: process.platform !== 'win32' },
  );
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`vite preview exited with ${child.exitCode}`);
    try {
      const res = await fetch(BASE);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  kill(child);
  throw new Error(`vite preview did not answer on ${BASE}`);
}

function kill(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

/* ── the browser ─────────────────────────────────────────────────── */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function newPage(browser, consoleErrors) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, acceptDownloads: true });
  await ctx.route(/^https?:\/\/([^/]*\.)?(amazon\.com|media-amazon\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  // Hosting serves public/ at the root, which vite preview of the dashboard
  // alone does not; without this the favicon 404s into the console check.
  await ctx.route(`http://localhost:${PREVIEW_PORT}/icon128.png`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', path: resolve(WEB_ROOT, 'public', 'icon128.png') }),
  );
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  return { ctx, page };
}

async function signIn(page, email, password) {
  await page.goto(BASE);
  await page.waitForSelector('#auth-email', { timeout: 30000 });
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', password);
  await page.click('.auth__cta');
}

const subtitle = (page) => page.locator('.page-header__sub').innerText();

async function waitSubtitle(page, re, timeout = 30000) {
  await page.waitForFunction(
    (src) => new RegExp(src).test(document.querySelector('.page-header__sub')?.textContent ?? ''),
    re.source,
    { timeout },
  );
  return subtitle(page);
}

/** The rendered board as {headers, rows: [{Header: text}], imgs}. */
function readBoard(page) {
  return page.evaluate(() => {
    const headers = [...document.querySelectorAll('.board-table thead th')].map((th) => th.textContent.trim());
    const rows = [...document.querySelectorAll('.board-row')].map((tr) => {
      const cells = [...tr.querySelectorAll('td')];
      const out = {};
      headers.forEach((h, i) => (out[h] = (cells[i]?.textContent ?? '').trim()));
      out.__img = tr.querySelector('img.board-prod__img')?.getAttribute('src') ?? '';
      return out;
    });
    return { headers, rows };
  });
}

const header = (headers, prefix) => headers.find((h) => h.startsWith(prefix));
const share = (rows, fn) => (rows.length === 0 ? 0 : rows.filter(fn).length / rows.length);

async function checkColumns(page, label, { deltas }) {
  const { headers, rows } = await readBoard(page);
  const need = ['Product', 'Price', 'Δ Price', 'Rating', 'Reviews', 'Rank'];
  const missing = need.filter((h) => !header(headers, h));
  check(`${label}: promised columns are shown`, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : headers.join(' | '));
  check(`${label}: rows render`, rows.length >= 20, `${rows.length} rows`);
  const col = (h) => header(headers, h);
  check(`${label}: every row has a name`, share(rows, (r) => /Test product \d+/.test(r[col('Product')])) === 1);
  check(`${label}: every row has an image`, share(rows, (r) => r.__img.startsWith('https://m.media-amazon.com/')) === 1);
  const price = share(rows, (r) => /^\$\d/.test(r[col('Price')]));
  check(`${label}: price fills`, price >= 0.85, `${Math.round(price * 100)}%`);
  check(`${label}: rating fills`, share(rows, (r) => /^\d\.\d/.test(r[col('Rating')])) === 1);
  check(`${label}: reviews fill`, share(rows, (r) => /^\d/.test(r[col('Reviews')])) === 1);
  check(`${label}: rank fills`, share(rows, (r) => /^#\d+/.test(r[col('Rank')])) === 1);
  if (deltas) {
    const d = share(rows, (r) => /\$\d/.test(r[col('Δ Price')]));
    check(`${label}: Δ price fills where the price moved`, d >= deltas, `${Math.round(d * 100)}%`);
  }
  return { headers, rows };
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  console.log('[seed] the extension scrapes and syncs');
  const { ext } = await seed();

  console.log('[build] production bundle against the emulators');
  build();
  const server = await preview();
  const consoleErrors = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM || undefined });
    const { ctx, page } = await newPage(browser, consoleErrors);

    console.log('[board] all sources, latest');
    await signIn(page, EMAIL, PASSWORD);
    await page.waitForSelector('.board-row', { timeout: 40000 });
    let sub = await waitSubtitle(page, /of 1,050 products loaded/);
    check('header gives the true total', sub.includes(`200 of ${fmt(UNIQUE)} products loaded`), sub);
    await checkColumns(page, 'all sources', { deltas: 0 });
    check('no password card for an email account', (await page.locator('.extpw').count()) === 0);
    await page.screenshot({ path: resolve(SHOTS, 'board.png') });

    await page.click('.board-more button');
    sub = await waitSubtitle(page, /400 of 1,050/);
    check('Load more pages on with a cursor', sub.includes(`400 of ${fmt(UNIQUE)}`), sub);

    const lookFor = asinOf(3); // storefront only, not on the loaded pages
    await page.fill('.board-search', lookFor);
    await page.waitForSelector(`.board-row:has-text("${lookFor}")`, { timeout: 15000 });
    check('an exact ASIN is found past the loaded pages', (await page.locator('.board-row').count()) === 1);
    await page.fill('.board-search', '');

    console.log('[export] whole scope');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.click('button:has-text("Export XLSX")'),
    ]);
    const file = resolve(SHOTS, download.suggestedFilename());
    await download.saveAs(file);
    const sheet = XLSX.read(readFileSync(file)).Sheets['ProScan Leads'];
    const table = XLSX.utils.sheet_to_json(sheet, { defval: null });
    check('export writes every product, not the loaded pages', table.length === UNIQUE, `${table.length} rows`);
    const filled = (key) => share(table, (r) => r[key] !== null && r[key] !== '');
    check('export: names', filled('Product Name') === 1);
    check('export: prices', filled('Current Price') >= 0.85, `${Math.round(filled('Current Price') * 100)}%`);
    check('export: ranks', filled('Rank') === 1);
    check('export: source ids', filled('Source IDs') === 1);
    check('export: last scanned', filled('Last Scanned') === 1);

    console.log('[board] one source: deltas against its previous run');
    await page.selectOption('.board-select', 's_A3K9XELT4QZ6M2');
    sub = await waitSubtitle(page, /deltas against the run of/);
    // The 50 ASINs the keyword run also saw lose the storefront from sourceIds.
    knownFailure('NEW-SYNC-1 (F-20 area): storefront scope counts all its products', sub.includes(`200 of ${fmt(STORE_N)} products loaded`), sub);
    await checkColumns(page, 'storefront', { deltas: 0.5 });
    await page.screenshot({ path: resolve(SHOTS, 'board-storefront.png') });

    console.log('[movers] run against run');
    await page.click('.board-seg__btn:has-text("Movers")');
    sub = await waitSubtitle(page, /movers · run of/);
    check('storefront movers are counted run against run', sub.includes(`${fmt(expectedMovers)} movers`), `${sub} (want ${expectedMovers})`);
    const movers = await checkColumns(page, 'movers', { deltas: 1 });
    const firstDelta = movers.rows[0]?.[header(movers.headers, 'Δ Price')] ?? '';
    check('the biggest drop is on top', firstDelta.startsWith('▼'), firstDelta);
    await page.screenshot({ path: resolve(SHOTS, 'movers.png') });

    await page.selectOption('.board-select', '');
    sub = await waitSubtitle(page, /across 2 sources/);
    check('movers across all sources', sub.includes(`${fmt(expectedMovers)} movers across 2 sources`), sub);

    console.log('[drawer]');
    await page.goto(`${BASE}?asin=${asinOf(9)}`);
    await page.waitForSelector('.drawer', { timeout: 20000 });
    await page.waitForSelector('.recharts-surface', { timeout: 20000 });
    check('drawer draws the price history', (await page.locator('.drawer [role="alert"]').count()) === 0);
    await page.keyboard.press('Escape');

    console.log('[runs] and [watchlist]');
    await page.click('.nav-link:has-text("Runs")');
    await page.waitForSelector('.run-card:not(.run-card--skeleton)', { timeout: 20000 });
    sub = await waitSubtitle(page, /3 runs/);
    check('three run cards', (await page.locator('.run-card:not(.run-card--skeleton)').count()) === 3, sub);
    await page.click('.nav-link:has-text("Watchlist")');
    await page.waitForSelector('.wl-row', { timeout: 20000 });
    check('two sources on the watchlist', (await page.locator('.wl-row').count()) === 2);
    await ctx.close();

    console.log('[F-50] a Google account sets a password for the extension');
    const googleErrors = [];
    await googlePassword(browser, googleErrors, ext);
    // The emulator refuses to link the account's own email with a 400 and
    // the dashboard falls back to updatePassword; nothing else may log.
    consoleErrors.push(...googleErrors.filter((t) => !/status of 400/.test(t)));
  } finally {
    await browser?.close().catch(() => {});
    kill(server);
  }

  const noise = consoleErrors.filter((t) => !/favicon/i.test(t));
  check('no console errors', noise.length === 0, noise.slice(0, 3).join(' | '));
}

async function googlePassword(browser, consoleErrors, ext) {
  const email = `google-${Date.now()}@proscan.test`;
  const { ctx, page } = await newPage(browser, consoleErrors);
  // A Google sign-in, made in Node against the Auth emulator and handed to
  // the page as its saved session. The emulator's popup relays through
  // Google's gapi script from apis.google.com, which the test must not need.
  const idp = firebase('e2e-google-idp');
  const token = JSON.stringify({ sub: `g${Date.now()}`, email, email_verified: true, name: 'Google Tester' });
  const google = await signInWithCredential(idp.auth, GoogleAuthProvider.credential(token));
  check('the account signs in with Google only', google.user.providerData.map((p) => p.providerId).join() === 'google.com');
  const saved = { key: 'firebase:authUser:demo-key:[DEFAULT]', value: google.user.toJSON() };
  await terminate(idp.db);
  await deleteApp(idp.app);

  await page.goto(BASE);
  await page.waitForSelector('.auth__cta', { timeout: 30000 });
  await page.evaluate(
    ({ key, value }) =>
      new Promise((done, fail) => {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onerror = () => fail(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('firebaseLocalStorage', 'readwrite');
          tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value });
          tx.oncomplete = () => done();
          tx.onerror = () => fail(tx.error);
        };
      }),
    saved,
  );
  await page.reload();
  const offered = await page.waitForSelector('.extpw', { timeout: 30000 }).then(() => true, () => false);
  if (!offered) {
    await page.screenshot({ path: resolve(SHOTS, 'google-signin-failed.png') });
    const text = (await page.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' ');
    check('a Google account is offered a password for the extension', false, text);
    await ctx.close();
    return;
  }
  check('a Google account is offered a password for the extension', (await page.locator('#extpw-title').count()) === 1);
  await page.screenshot({ path: resolve(SHOTS, 'extension-password.png') });

  await page.click('.extpw button:has-text("Set a password")');
  await page.fill('#extpw-new', 'short');
  await page.fill('#extpw-confirm', 'short');
  await page.click('.extpw button:has-text("Save password")');
  check('a short password is refused', (await page.locator('.extpw__error').innerText()).includes('8 characters'));
  const password = 'google-then-pass-1';
  await page.fill('#extpw-new', password);
  await page.fill('#extpw-confirm', password);
  await page.click('.extpw button:has-text("Save password")');
  const linked = await page.waitForSelector('.extpw--done', { timeout: 20000 }).then(() => true, () => false);
  check('the password is linked', linked, linked ? '' : await page.locator('.extpw').innerText().catch(() => 'no card'));
  if (!linked) {
    await page.screenshot({ path: resolve(SHOTS, 'extension-password-failed.png') });
    await ctx.close();
    return;
  }

  // The extension signs in with email and password: it now can, as the same account.
  const fb = firebase('e2e-google');
  const cred = await signInWithEmailAndPassword(fb.auth, email, password);
  const googleUid = await page.evaluate(() => document.querySelector('.sidebar__email')?.textContent ?? '');
  check('the extension can sign in with it', !!cred.user.uid && googleUid.includes(email), googleUid);
  const install = installExtension(ext, { uid: cred.user.uid, db: fb.db });
  await install.scrape(KEYWORD, Date.parse('2026-09-12T10:00:00Z'), cards(5, { offset: 5000 }), 48);
  await install.flush();
  await terminate(fb.db);
  await deleteApp(fb.app);

  await page.reload();
  await page.waitForSelector('.board-row', { timeout: 30000 });
  const sub = await waitSubtitle(page, /products/);
  check("and its scans reach the Google account's dashboard", sub.startsWith('5 products'), sub);
  await ctx.close();
}

const timer = setTimeout(() => {
  console.error('[e2e] over the time limit');
  process.exit(1);
}, DEADLINE - Date.now());

try {
  await main();
} catch (e) {
  console.error('[fatal]', e);
  failed++;
} finally {
  clearTimeout(timer);
  if (known) console.log(`\n${known} known failure(s), see above`);
  console.log(failed === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failed})`);
  process.exit(failed === 0 ? 0 : 1);
}
