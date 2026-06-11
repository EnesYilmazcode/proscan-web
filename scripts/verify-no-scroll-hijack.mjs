// Behavioral regression test for the hero scan animation scroll hijack.
//
// Bug: scrollToItemView used scrollIntoView, which scrolls every scrollable
// ancestor — so the 3s scan tick yanked the PAGE back to the mockup whenever
// any part of it was visible.
//
// Test: load the page, scroll so the mockup is partially visible, then wait
// through several scan ticks. The page's scrollY must not move.
//
//   node scripts/verify-no-scroll-hijack.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node scripts/verify-no-scroll-hijack.mjs <url>'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });

// Position the page so the mockup is PARTIALLY visible (the bug's trigger zone).
// --y=N overrides the computed position.
const yArg = process.argv.find(a => a.startsWith('--y='));
const mockup = await page.locator('.browser-mockup').boundingBox();
const targetY = yArg ? Number(yArg.split('=')[1])
  : Math.max(0, Math.round(mockup.y + mockup.height / 2 - 900));
await page.evaluate(y => window.scrollTo(0, y), targetY);
await page.waitForTimeout(500);
const before = await page.evaluate(() => window.scrollY);

// Wait through 3+ scan ticks (interval is 3000ms) plus smooth-scroll time.
await page.waitForTimeout(10500);
const after = await page.evaluate(() => window.scrollY);

// Also confirm the inner mockup container DID scroll (animation still works).
const innerScrolled = await page.evaluate(() => {
  const el = document.querySelector('#hero .browser-content');
  return el ? el.scrollTop : -1;
});

await browser.close();

console.log(`page scrollY before=${before} after=${after}; inner mockup scrollTop=${innerScrolled}`);
if (after !== before) {
  console.error(`FAIL: page scroll moved by ${after - before}px during scan ticks (hijack still present)`);
  process.exit(1);
}
if (innerScrolled <= 0) {
  console.error('WARN: inner mockup container has not scrolled — animation may be broken (check manually)');
  process.exit(1);
}
console.log('PASS: page scroll stable across scan ticks; inner animation still scrolling');
