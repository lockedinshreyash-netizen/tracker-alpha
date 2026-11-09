import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clozeFrom, tokensOf } from '../cards';

const t = tokensOf('The SI unit of force is the newton (N).');

test('one hidden word is one blank', () => {
  assert.equal(clozeFrom(t, new Set([t.indexOf('newton')])), 'The SI unit of force is the {{c1::newton}} (N).');
});

test('neighbouring hidden words join into one blank; separate runs number up', () => {
  const hide = new Set([t.indexOf('SI'), t.indexOf('unit'), t.indexOf('newton')]);
  assert.equal(clozeFrom(t, hide), 'The {{c1::SI unit}} of force is the {{c2::newton}} (N).');
});

test('markup in the text is escaped', () => {
  const x = tokensOf('a < b & c');
  assert.equal(clozeFrom(x, new Set([x.indexOf('b')])), 'a &lt; {{c1::b}} &amp; c');
});
