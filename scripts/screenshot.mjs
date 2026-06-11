// Screenshot tool for visual verification.
//
//   node scripts/screenshot.mjs <url> <out.png> [--full] [--width=1440] [--height=900] [--wait=1500] [--scroll=<y>]
//
// --full     full-page screenshot instead of the viewport
// --wait     ms to wait after load (animations settle)
// --scroll   scroll the page to y before capturing
import { chromium } from 'playwright';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [--full] [--width=N] [--height=N] [--wait=ms] [--scroll=y]');
  process.exit(2);
}
const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const full = process.argv.includes('--full');
const width = arg('width', 1440);
const height = arg('height', 900);
const wait = arg('wait', 1500);
const scroll = arg('scroll', 0);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle' });
if (scroll) await page.evaluate(y => window.scrollTo(0, y), scroll);
await page.waitForTimeout(wait);
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log(`captured ${url} -> ${out} (${width}x${height}${full ? ', full-page' : ''}${scroll ? `, scrolled to ${scroll}` : ''})`);
