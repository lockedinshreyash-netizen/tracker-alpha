import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {
  buildTree, chapterIndex, createPage, descendants, movePage, purgePage, readPages, restorePage, trashPage, updatePage, orderBetween,
} from '../workspace';
import { fragmentText, fold, snippet } from '../text';
import { protectMath, restoreMath, looksLikeMarkdown } from '../editor/markdown';
import { fromB64, toB64 } from '../bytes';

// newId() reads crypto.getRandomValues, which Node has globally.

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};

test('pages nest, order and fold into a tree', () => {
  const ws = new Y.Doc();
  const phys = createPage(ws, { title: 'Physics' });
  const chem = createPage(ws, { title: 'Chemistry' });
  const rot = createPage(ws, { title: 'Rotation', parent: phys });
  const first = createPage(ws, { title: 'First', first: true });
  const tree = buildTree(readPages(ws));
  assert.deepEqual((tree.children.get('') ?? []).map(p => p.title), ['First', 'Physics', 'Chemistry']);
  assert.deepEqual((tree.children.get(phys) ?? []).map(p => p.id), [rot]);
  assert.ok(chem && first);
});

test('a page cannot be moved inside itself', () => {
  const ws = new Y.Doc();
  const a = createPage(ws, { title: 'A' });
  const b = createPage(ws, { title: 'B', parent: a });
  const c = createPage(ws, { title: 'C', parent: b });
  assert.equal(movePage(ws, a, c, 0), false);
  assert.equal(movePage(ws, a, a, 0), false);
  assert.equal(movePage(ws, c, null, 0), true);
  assert.deepEqual(descendants(readPages(ws), a), [b]);
});

test('trashing a parent hides its children, restoring brings them back', () => {
  const ws = new Y.Doc();
  const a = createPage(ws, { title: 'A' });
  const b = createPage(ws, { title: 'B', parent: a });
  trashPage(ws, a);
  let tree = buildTree(readPages(ws));
  assert.equal(tree.live.length, 0);
  assert.deepEqual(tree.trash.map(p => p.id), [a]); // B is inside A, not listed on its own
  restorePage(ws, a);
  tree = buildTree(readPages(ws));
  assert.deepEqual(tree.live.map(p => p.id).sort(), [a, b].sort());
});

test('restoring a child whose parent is still in the trash puts it at the top level', () => {
  const ws = new Y.Doc();
  const a = createPage(ws, { title: 'A' });
  const b = createPage(ws, { title: 'B', parent: a });
  trashPage(ws, b);
  trashPage(ws, a);
  restorePage(ws, b);
  const tree = buildTree(readPages(ws));
  assert.deepEqual(tree.live.map(p => p.id), [b]);
  assert.equal(tree.byId.get(b)?.parent, null);
});

test('purge leaves a tombstone an offline device cannot undo by editing', () => {
  const laptop = new Y.Doc();
  const a = createPage(laptop, { title: 'Old' });
  const phone = new Y.Doc();
  sync(laptop, phone);
  purgePage(laptop, a);
  updatePage(phone, a, { title: 'Edited offline' }); // concurrent
  sync(laptop, phone);
  for (const d of [laptop, phone]) assert.equal(buildTree(readPages(d)).live.length, 0);
});

test('two devices renaming and moving the same page keep both changes', () => {
  const laptop = new Y.Doc();
  const folder = createPage(laptop, { title: 'Folder' });
  const p = createPage(laptop, { title: 'Page' });
  const phone = new Y.Doc();
  sync(laptop, phone);
  updatePage(phone, p, { title: 'Renamed on phone' });
  movePage(laptop, p, folder, 0);
  sync(laptop, phone);
  for (const d of [laptop, phone]) {
    const page = buildTree(readPages(d)).byId.get(p)!;
    assert.equal(page.title, 'Renamed on phone');
    assert.equal(page.parent, folder);
  }
});

test('two devices typing offline into one body both keep their words', () => {
  const a = new Y.Doc();
  const fa = a.getXmlFragment('default');
  const para = new Y.XmlElement('paragraph');
  para.insert(0, [new Y.XmlText('Torque')]);
  fa.insert(0, [para]);
  const b = new Y.Doc();
  sync(a, b);
  ((a.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(6, ' is r × F');
  const pb = new Y.XmlElement('paragraph');
  pb.insert(0, [new Y.XmlText('Units: N m')]);
  b.getXmlFragment('default').insert(1, [pb]);
  // Through the outbox and back: base64, merged, applied twice.
  const upA = Y.mergeUpdates([Y.encodeStateAsUpdate(a)]);
  const roundTrip = fromB64(toB64(upA));
  Y.applyUpdate(b, roundTrip);
  Y.applyUpdate(b, roundTrip);
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  assert.equal(fragmentText(a.getXmlFragment('default')), 'Torque is r × F\nUnits: N m');
  assert.equal(fragmentText(b.getXmlFragment('default')), 'Torque is r × F\nUnits: N m');
});

test('search text includes equations and chapter mentions', () => {
  const d = new Y.Doc();
  const f = d.getXmlFragment('default');
  const p = new Y.XmlElement('paragraph');
  const m = new Y.XmlElement('mathInline');
  m.setAttribute('latex', '\\tau = rF');
  const c = new Y.XmlElement('chapterRef');
  c.setAttribute('name', 'Rotational Motion');
  p.insert(0, [new Y.XmlText('See '), c, new Y.XmlText(' and '), m]);
  f.insert(0, [p]);
  const text = fragmentText(f);
  assert.match(text, /Rotational Motion/);
  assert.match(text, /\\tau = rF/);
});

test('the chapter index points at the oldest live page for a chapter', () => {
  const ws = new Y.Doc();
  const a = createPage(ws, { title: 'A', chapter: '11|Physics|Kinematics' }, 1000);
  createPage(ws, { title: 'B', chapter: '11|Physics|Kinematics' }, 2000);
  assert.deepEqual(chapterIndex(buildTree(readPages(ws))), { '11|Physics|Kinematics': a });
  trashPage(ws, a);
  assert.notEqual(chapterIndex(buildTree(readPages(ws)))['11|Physics|Kinematics'], a);
});

test('order between neighbours', () => {
  assert.equal(orderBetween(null, null), 1);
  assert.equal(orderBetween(2, null), 3);
  assert.equal(orderBetween(null, 2), 1);
  assert.equal(orderBetween(1, 2), 1.5);
});

test('maths survives Markdown: protected before parsing, restored after', () => {
  const { md, stash } = protectMath('Area is $a_1 * b_1$ and\n\n$$\\int_0^1 x\\,dx$$\n\n`$not maths$`');
  assert.ok(!md.includes('a_1'));
  assert.ok(md.includes('`$not maths$`'));
  const json = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: md.split('\n\n')[0] }] },
      { type: 'paragraph', content: [{ type: 'text', text: md.split('\n\n')[1] }] },
    ],
  };
  const out = restoreMath(json, stash);
  assert.deepEqual(out.content?.[0].content?.[1], { type: 'mathInline', attrs: { latex: 'a_1 * b_1' } });
  assert.deepEqual(out.content?.[1], { type: 'mathBlock', attrs: { latex: '\\int_0^1 x\\,dx' } });
});

test('prices are not maths', () => {
  assert.equal(protectMath('It costs $5 and $6 a month').stash.length, 0);
});

test('markdown is recognised, prose is not', () => {
  assert.equal(looksLikeMarkdown('# Kinematics\n- velocity\n- acceleration'), true);
  assert.equal(looksLikeMarkdown('I think this is *probably* fine.'), false);
});

test('fold and snippet', () => {
  assert.equal(fold('Don’t'), "don't");
  assert.equal(snippet('a   b\n\nc'), 'a b c');
  assert.ok(snippet('x'.repeat(200), 20).endsWith('…'));
});
