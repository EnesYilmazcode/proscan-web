// The vendored schema must be the extension's file byte for byte, and
// index.d.ts must declare everything index.js exports.
//
//   node scripts/check-schema.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEB_ROOT, requireExtension } from './lib/extension.mjs';

const ours = resolve(WEB_ROOT, 'packages', 'schema', 'index.js');
const types = readFileSync(resolve(WEB_ROOT, 'packages', 'schema', 'index.d.ts'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` (${detail})`}`);
};

const src = readFileSync(ours, 'utf8');
const exported = [...src.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const missing = exported.filter((name) => !new RegExp(`declare (?:const|function) ${name}\\b`).test(types));
check('index.d.ts declares every export', missing.length === 0, missing.join(', '));

const ext = requireExtension('the schema check');
const theirs = readFileSync(resolve(ext, 'packages', 'schema', 'index.js'), 'utf8');
check(`index.js matches ${ext}`, theirs === src, 'copy the extension file over ours');

console.log(failed === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
