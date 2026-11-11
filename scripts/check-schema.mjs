// The vendored schema must be the extension's file byte for byte, and
// index.d.ts must declare everything index.js exports.
//
//   node scripts/check-schema.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEB_ROOT, findExtension } from './lib/extension.mjs';

const ours = resolve(WEB_ROOT, 'packages', 'schema', 'index.js');
const types = readFileSync(resolve(WEB_ROOT, 'packages', 'schema', 'index.d.ts'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` (${detail})`}`);
};

// Line endings are ignored: autocrlf checks files out with CRLF on Windows.
const lf = (text) => text.replace(/\r\n/g, '\n');
const src = lf(readFileSync(ours, 'utf8'));
const exported = [...src.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const missing = exported.filter((name) => !new RegExp(`declare (?:const|function) ${name}\\b`).test(types));
check('index.d.ts declares every export', missing.length === 0, missing.join(', '));

// Without the extension only the byte comparison is skipped; the check
// above still decides the exit code.
const ext = findExtension();
if (ext) {
  const theirs = lf(readFileSync(resolve(ext, 'packages', 'schema', 'index.js'), 'utf8'));
  check(`index.js matches ${ext}`, theirs === src, 'copy the extension file over ours');
} else if (process.env.PROSCAN_ALLOW_NO_EXT === '1') {
  console.log('  SKIP index.js matches the extension: no extension checkout (PROSCAN_ALLOW_NO_EXT=1)');
} else {
  check('extension checkout found', false, 'set PROSCAN_EXT, or PROSCAN_ALLOW_NO_EXT=1 to skip');
}

console.log(failed === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
