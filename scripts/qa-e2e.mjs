// Throwaway integration-QA driver (Playwright, emulator-connected DEV server).
// Usage: node scripts/qa-e2e.mjs
// - signs in as dev@proscan.test / proscan-dev
// - walks every screen, screenshots to .screenshots/qa/
// - functional assertions: drawer URL contract, stage-change persistence,
//   nickname persistence, XLSX download, Movers reorder, legend popover
// - collects browser console on every screen; FAILS on errors
//   (favicon 404 + the one verbatim m.media-amazon.com fixture 404 ignored)

import { chromium } from 'playwright';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:5173/dashboard/';
const OUT = resolve('.screenshots/qa');
const WID = '9f8aKq2WLxYpB3vN7cE5dRm1tUo2';
const FIRESTORE_DOCS = `http://127.0.0.1:8080/v1/projects/demo-proscan/databases/(default)/documents/workspaces/${WID}`;

mkdirSync(OUT, { recursive: true });

const failures = [];
const consoleLog = []; // { screen, kind, text }
let currentScreen = 'boot';

const IGNORE_CONSOLE = [
  /favicon/i,
  /m\.media-amazon\.com/i, // verbatim B0C8XL4N2P fixture image 404s
];

function attachConsole(page, tag) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = msg.location()?.url ?? '';
    if (IGNORE_CONSOLE.some((re) => re.test(text) || re.test(url))) return;
    consoleLog.push({ screen: `${tag}:${currentScreen}`, kind: 'console.error', text: `${text} (${url})` });
  });
  page.on('pageerror', (err) => {
    consoleLog.push({ screen: `${tag}:${currentScreen}`, kind: 'pageerror', text: String(err) });
  });
}

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    console.log(`  FAIL ${name} ${detail}`);
    failures.push(`${name} ${detail}`.trim());
  }
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}` });
  console.log(`  shot ${name}`);
}

async function restDoc(path) {
  const res = await fetch(`${FIRESTORE_DOCS}/${path}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!res.ok) throw new Error(`REST GET ${path} -> ${res.status}`);
  return res.json();
}

async function signIn(page) {
  await page.goto(page.url().startsWith('http') ? page.url() : BASE);
  await page.waitForSelector('#auth-email', { timeout: 20000 });
  await page.fill('#auth-email', 'dev@proscan.test');
  await page.fill('#auth-password', 'proscan-dev');
  await page.click('.auth__cta');
}

const browser = await chromium.launch();

/* ════ DESKTOP ═══════════════════════════════════════════════════════ */
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
attachConsole(page, 'desktop');

// 1 · sign-in screen
currentScreen = 'signin';
console.log('[signin]');
await page.goto(BASE);
await page.waitForSelector('#auth-email', { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
await shot(page, 'signin.png');
await signIn(page);
await page.waitForSelector('.board-row', { timeout: 25000 });

// 2 · products board (Latest)
currentScreen = 'products';
console.log('[products]');
await page.waitForTimeout(400); // stagger animation settles
const subtitle = await page.locator('.page-header__sub').innerText();
check('board shows all 39 products', subtitle.includes('39 products'), `got "${subtitle}"`);
await shot(page, 'products.png');

// 3 · row click opens drawer with ?asin= in URL
const firstAsin = await page.locator('.board-row .board-asin').first().innerText();
await page.locator('.board-row').first().click();
await page.waitForSelector('.drawer', { timeout: 10000 });
const urlAfterClick = page.url();
check(
  'row click sets ?asin= in URL',
  urlAfterClick.includes(`asin=${firstAsin.replace(' ✓', '').trim()}`),
  `url=${urlAfterClick} firstAsin=${firstAsin}`,
);
await page.keyboard.press('Escape');
await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 });
check('Esc closes drawer and clears ?asin=', !page.url().includes('asin='), page.url());

// 4 · Movers toggle reorders
currentScreen = 'products-movers';
console.log('[products-movers]');
const latestFirst = await page.locator('.board-row .board-asin').first().innerText();
await page.click('.board-seg__btn:has-text("Movers")');
await page.waitForFunction(
  (prev) => {
    const el = document.querySelector('.board-row .board-asin');
    return el && el.textContent.trim() !== prev;
  },
  latestFirst.trim(),
  { timeout: 15000 },
);
const moversFirst = await page.locator('.board-row .board-asin').first().innerText();
check('Movers toggle reorders rows', moversFirst.trim() !== latestFirst.trim(), `${latestFirst} -> ${moversFirst}`);
const moversFirstDelta = await page.locator('.board-row').first().locator('.delta').first().innerText();
check('top mover is a price drop (▼ green semantics)', moversFirstDelta.includes('▼'), moversFirstDelta);
await page.waitForTimeout(250);
await shot(page, 'products-movers.png');

// 5 · legend popover opens
const legendBtn = page.locator('button:has-text("Legend")');
await legendBtn.click();
const legend = page.locator('[role="dialog"][aria-label="Delta color legend"]');
check('legend popover opens', await legend.isVisible());
const legendText = await legend.innerText();
check('legend explains buyer semantics', /opportunit/i.test(legendText), legendText.slice(0, 80));
await page.keyboard.press('Escape');
check('legend closes on Esc', !(await legend.isVisible().catch(() => false)));

// back to Latest
await page.click('.board-seg__btn:has-text("Latest")');
await page.waitForTimeout(500);

// 6 · source filter
currentScreen = 'products-source-filtered';
console.log('[products-source-filtered]');
await page.selectOption('.board-select', 's_A3K9XELT4QZ6M2');
await page.waitForFunction(() => window.location.search.includes('source=s_A3K9XELT4QZ6M2'));
await page.waitForFunction(() =>
  (document.querySelector('.page-header__sub')?.textContent ?? '').includes('28 products'),
  undefined,
  { timeout: 15000 },
);
const filteredSub = await page.locator('.page-header__sub').innerText();
check('source scope filters to 28 storefront products', filteredSub.includes('28 products'), filteredSub);
check('source scope shown in subtitle', filteredSub.includes('BrickHouse'), filteredSub);
await page.waitForTimeout(250);
await shot(page, 'products-source-filtered.png');

// 7 · filtered empty state (search with no matches, still source-scoped)
currentScreen = 'filtered-empty';
console.log('[filtered-empty]');
await page.fill('.board-search', 'zzzz-no-such-product');
await page.waitForSelector('.empty', { timeout: 10000 });
const emptyText = await page.locator('.empty').innerText();
check('no-match empty state renders', /No matches/.test(emptyText), emptyText.slice(0, 60));
await page.waitForTimeout(450); // stagger-rise animation settles
await shot(page, 'filtered-empty.png');
await page.fill('.board-search', '');

// 8 · drawer deep link: chart + spread + verdict for B0C8XL4N2P
currentScreen = 'drawer';
console.log('[drawer]');
await page.setViewportSize({ width: 1440, height: 1600 });
await page.goto(`${BASE}?asin=B0C8XL4N2P`);
await page.waitForSelector('.drawer', { timeout: 25000 });
await page.waitForSelector('.hd-verdict__pill', { timeout: 15000 });
await page.waitForSelector('.recharts-surface', { timeout: 20000 });
await page.waitForSelector('.hd-kv-grid', { timeout: 10000 });
const verdictSentence = await page.locator('.hd-verdict__sentence').innerText();
check(
  'verdict sentence (Max Buy $13.10 @ $22.45 median)',
  verdictSentence.includes('$13.10') && verdictSentence.includes('$22.45'),
  verdictSentence,
);
const pill = await page.locator('.hd-verdict__pill').innerText();
check('MAX BUY pill', pill.includes('MAX BUY') && pill.includes('$13.10'), pill);
check('offer table renders', (await page.locator('.hd-offers tbody tr').count()) === 2);
await page.waitForTimeout(350);
await shot(page, 'drawer.png');
await page.setViewportSize({ width: 1440, height: 900 });

// 9 · stage change persists (drawer for B09XJ4L8RT: reviewing -> approved)
currentScreen = 'stage-change';
console.log('[stage-change]');
await page.goto(`${BASE}?asin=B09XJ4L8RT`);
await page.waitForSelector('.hd-stages', { timeout: 25000 });
await page.getByRole('radio', { name: 'Approved' }).click();
await page.waitForTimeout(1500); // optimistic write lands
const prodDoc = await restDoc('products/B09XJ4L8RT');
const persistedStage = prodDoc.fields?.lead?.mapValue?.fields?.stage?.stringValue;
check('stage change persisted to Firestore', persistedStage === 'approved', `doc says "${persistedStage}"`);
const headerChip = await page.locator('.hd-head__meta .chip').innerText();
check('drawer header chip reflects new stage', headerChip === 'Approved', headerChip);
await page.keyboard.press('Escape');

// 10 · XLSX export downloads a non-empty workbook
currentScreen = 'export';
console.log('[export]');
await page.waitForSelector('.board-row', { timeout: 15000 });
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.click('button:has-text("Export XLSX")'),
]);
const suggested = download.suggestedFilename();
const savedPath = `${OUT}/${suggested}`;
await download.saveAs(savedPath);
const size = statSync(savedPath).size;
check('export filename is .xlsx', suggested.endsWith('.xlsx'), suggested);
check('exported workbook is non-empty', size > 0, `${size} bytes`);
console.log(`  export: ${suggested} (${size} bytes)`);

// 11 · runs inbox
currentScreen = 'runs';
console.log('[runs]');
await page.click('.nav-link:has-text("Runs")');
// real cards only — the loading state shows three .run-card--skeleton's
await page.waitForSelector('.run-card:not(.run-card--skeleton)', { timeout: 15000 });
await page.waitForFunction(
  () => document.querySelectorAll('.run-card--skeleton').length === 0,
  undefined,
  { timeout: 15000 },
);
const runCount = await page.locator('.run-card:not(.run-card--skeleton)').count();
check('5 run cards render', runCount === 5, `got ${runCount}`);
check('active run shows progress bar', (await page.locator('[role="progressbar"]').count()) === 1);
check('active StatusDot pulses', (await page.locator('.status-dot--active').count()) === 1);
const groupLabels = await page.locator('.runs-group').allInnerTexts();
check('run groups bucketed', groupLabels.length >= 2, groupLabels.join(' | '));
await page.waitForTimeout(350);
await shot(page, 'runs.png');

// 12 · watchlist + nickname edit persists
currentScreen = 'watchlist';
console.log('[watchlist]');
await page.click('.nav-link:has-text("Watchlist")');
await page.waitForSelector('.wl-row', { timeout: 15000 });
check('both sources listed', (await page.locator('.wl-row').count()) === 2);
await page.locator('button.wl-nick', { hasText: 'Wireless earbuds (keyword)' }).click();
await page.fill('.wl-nick-input', 'Earbuds radar QA');
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
const srcDoc = await restDoc('sources/k_wireless-earbuds');
const persistedNick = srcDoc.fields?.nickname?.stringValue;
check('nickname edit persisted to Firestore', persistedNick === 'Earbuds radar QA', `doc says "${persistedNick}"`);
check(
  'nickname visible in table after edit',
  (await page.locator('button.wl-nick', { hasText: 'Earbuds radar QA' }).count()) === 1,
);
await page.waitForTimeout(300);
await shot(page, 'watchlist.png');

await ctx.close();

/* ════ MOBILE (390x844) ══════════════════════════════════════════════ */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attachConsole(mpage, 'mobile');

currentScreen = 'mobile-products';
console.log('[mobile-products]');
await mpage.goto(BASE);
await signIn(mpage);
await mpage.waitForSelector('.board-row', { timeout: 25000 });
const railWidth = await mpage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
check('sidebar collapses to icon rail on mobile', railWidth <= 72, `width=${railWidth}px`);
const bodyOverflow = await mpage.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check('no page-level horizontal overflow on mobile', bodyOverflow <= 1, `overflow=${bodyOverflow}px`);
await mpage.waitForTimeout(400);
await shot(mpage, 'mobile-products.png');

currentScreen = 'mobile-drawer';
console.log('[mobile-drawer]');
await mpage.goto(`${BASE}?asin=B0C8XL4N2P`);
await mpage.waitForSelector('.drawer', { timeout: 25000 });
await mpage.waitForSelector('.recharts-surface', { timeout: 20000 });
const drawerBox = await mpage.locator('.drawer').boundingBox();
check('drawer fits the mobile viewport', drawerBox.width <= 390, `drawer width=${drawerBox.width}px`);
await mpage.waitForTimeout(350);
await shot(mpage, 'mobile-drawer.png');

await mctx.close();
await browser.close();

/* ════ VERDICT ═══════════════════════════════════════════════════════ */
console.log('\n──────── console errors by screen ────────');
if (consoleLog.length === 0) {
  console.log('  (none — favicon/amazon-fixture 404s ignored)');
} else {
  for (const e of consoleLog) console.log(`  [${e.screen}] ${e.kind}: ${e.text}`);
}

const consoleFailures = consoleLog.length;
console.log('\n──────── result ────────');
console.log(`assertion failures: ${failures.length}`);
console.log(`console errors:     ${consoleFailures}`);
if (failures.length > 0 || consoleFailures > 0) {
  for (const f of failures) console.log(`  FAILED: ${f}`);
  process.exit(1);
}
console.log('QA PASS');
