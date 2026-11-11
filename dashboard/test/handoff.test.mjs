// Unit tests for lib/handoff.ts. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFF_TYPE, STORE_EXTENSION_ID, pickExtensionId, sendHandoff } from '../src/lib/handoff.ts';

const DEV = 'abcdefghijklmnopabcdefghijklmnop';

test('no ext param means the store extension', () => {
  assert.equal(pickExtensionId(''), STORE_EXTENSION_ID);
});

test('an unknown ext id gets nothing, so a link cannot redirect the token', () => {
  assert.equal(pickExtensionId('?ext=' + DEV), null);
  assert.equal(pickExtensionId('?ext=' + DEV, DEV), DEV);
});

test('malformed dev ids are ignored', () => {
  assert.equal(pickExtensionId('?ext=bad', 'bad'), null);
});

test('sendHandoff passes the token and returns the answer', async () => {
  let seen;
  const send = (id, msg, cb) => { seen = { id, msg }; cb({ ok: true, email: 'a@b.c' }); };
  const r = await sendHandoff(send, DEV, 'tok');
  assert.deepEqual(seen, { id: DEV, msg: { type: HANDOFF_TYPE, idToken: 'tok' } });
  assert.deepEqual(r, { ok: true, email: 'a@b.c' });
});

test('no extension installed reads as no-extension', async () => {
  assert.deepEqual(await sendHandoff(undefined, DEV, 't'), { ok: false, error: 'no-extension' });
  const send = (_i, _m, cb) => cb(undefined);
  assert.deepEqual(await sendHandoff(send, DEV, 't', () => ({ message: 'x' })), { ok: false, error: 'no-extension' });
});
