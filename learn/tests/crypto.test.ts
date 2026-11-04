import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRawKey, importKey, isSealed, keyFromB64, keyToB64, makeCheck, seal, unseal, verifyCheck } from '../crypto';

const lecture = { id: 'lec_1xx', videoId: 'M7lc1UVf-VE', title: 'Rotational Motion', subject: 'Physics' };

test('a record opens with its key in its own slot', async () => {
  const key = await importKey(generateRawKey());
  const sealed = await seal(key, 'lectures:lec_1xx', lecture);
  assert.ok(isSealed(sealed));
  assert.deepEqual(await unseal(key, 'lectures:lec_1xx', sealed), lecture);
});

test('the stored bytes do not contain the words', async () => {
  const key = await importKey(generateRawKey());
  const sealed = await seal(key, 'lectures:lec_1xx', lecture);
  const text = new TextDecoder('latin1').decode(sealed.data);
  assert.ok(!text.includes('Rotational'));
  assert.ok(!text.includes('M7lc1UVf-VE'));
});

test('a wrong key, a wrong slot or one changed byte all fail to open', async () => {
  const key = await importKey(generateRawKey());
  const other = await importKey(generateRawKey());
  const sealed = await seal(key, 'lectures:lec_1xx', lecture);
  await assert.rejects(unseal(other, 'lectures:lec_1xx', sealed));
  await assert.rejects(unseal(key, 'lectures:lec_2xx', sealed), 'a record moved to another row');
  await assert.rejects(unseal(key, 'marks:lec_1xx', sealed), 'a record moved to another store');
  const bytes = new Uint8Array(sealed.data.slice(0));
  bytes[3] ^= 1;
  await assert.rejects(unseal(key, 'lectures:lec_1xx', { iv: sealed.iv, data: bytes.buffer }));
});

test('every seal uses a fresh IV', async () => {
  const key = await importKey(generateRawKey());
  const a = await seal(key, 's', 1);
  const b = await seal(key, 's', 1);
  assert.notDeepEqual(Array.from(a.iv), Array.from(b.iv));
});

test('the key cannot be read back out once imported', async () => {
  const key = await importKey(generateRawKey());
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', key));
  await assert.rejects(importKey(new Uint8Array(16)), 'only 256-bit keys');
});

test('the check tells the right key from a wrong one', async () => {
  const key = await importKey(generateRawKey());
  const other = await importKey(generateRawKey());
  const check = await makeCheck(key);
  assert.equal(await verifyCheck(key, check), true);
  assert.equal(await verifyCheck(other, check), false);
});

test('the key survives its trip as base64, and nothing else passes for one', () => {
  const raw = generateRawKey();
  assert.deepEqual(keyFromB64(keyToB64(raw)), raw);
  assert.equal(keyFromB64('not base64!'), null);
  assert.equal(keyFromB64(btoa('short')), null);
});
