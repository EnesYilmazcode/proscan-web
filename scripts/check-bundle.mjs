// Checks the built dist/ before a deploy: the build stamp is there, and the
// production dashboard bundle has no emulator wiring (and vice versa with
// --emulator, for a VITE_USE_EMULATOR=true build).

import { readFileSync, readdirSync } from 'node:fs';

const emulator = process.argv.includes('--emulator');
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` (${detail})`}`);
};

const version = JSON.parse(readFileSync('dist/version.json', 'utf8'));
check('dist/version.json has a commit sha', /^[0-9a-f]{40}$/.test(version.sha), version.sha);

const html = readFileSync('dist/dashboard/index.html', 'utf8');
const meta = html.match(/<meta name="proscan-build" content="([^"]+)"/);
check('dashboard html carries the same build', meta?.[1] === version.short, meta?.[1]);

const js = readdirSync('dist/dashboard/assets')
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(`dist/dashboard/assets/${f}`, 'utf8'))
  .join('\n');
if (emulator) {
  check('emulator bundle targets demo-proscan', js.includes('demo-proscan'));
  check('emulator bundle has no production project', !js.includes('proscanbot'));
} else {
  check('prod bundle targets proscanbot', js.includes('proscanbot'));
  check('prod bundle has no demo project', !js.includes('demo-proscan'));
  check('prod bundle has no emulator host', !js.includes('127.0.0.1'));
}

console.log(failed === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
