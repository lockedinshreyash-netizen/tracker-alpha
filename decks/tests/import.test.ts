import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, sniffDelimiter, writeCsv } from '../csv';
import { readAnkiFile, toNotes, parseTags } from '../anki';
import { exportNotes } from '../exportCsv';
import { contentHash, normalizeForHash } from '../hash';
import { toPlain, mediaNames, isMediaName } from '../html';

const okNotes = (text: string, header?: boolean) => {
  const f = readAnkiFile(text);
  return toNotes(f, header ?? f.headerGuess);
};

test('csv: plain rows', () => {
  assert.deepEqual(parseCsv('a,b,c\nd,e,f').rows, [['a', 'b', 'c'], ['d', 'e', 'f']]);
});

test('csv: quoted commas, escaped quotes, multiline', () => {
  const r = parseCsv('"Aldehydes, ketones","He said ""hi""","line1\nline2"\nx,y,z\n');
  assert.deepEqual(r.rows, [['Aldehydes, ketones', 'He said "hi"', 'line1\nline2'], ['x', 'y', 'z']]);
  assert.deepEqual(r.lines, [1, 3]);
});

test('csv: CRLF, BOM, empty fields, trailing newline', () => {
  assert.deepEqual(parseCsv('﻿a,,c\r\n,,\r\n').rows, [['a', '', 'c'], ['', '', '']]);
});

test('csv: quote inside an unquoted field is literal', () => {
  assert.deepEqual(parseCsv('<img src="a.png">,b').rows, [['<img src="a.png">', 'b']]);
});

test('csv: unterminated quote is reported with its line', () => {
  const r = parseCsv('ok,row\n"never closes,x\nmore');
  assert.equal(r.error?.line, 2);
});

test('csv: unicode — Hindi, emoji, subscripts, LaTeX', () => {
  const r = parseCsv('"अम्ल {{c1::H₂SO₄}} 🔥","\\(\\frac{a}{b}\\)"');
  assert.deepEqual(r.rows[0], ['अम्ल {{c1::H₂SO₄}} 🔥', '\\(\\frac{a}{b}\\)']);
});

test('csv: write/read round trip', () => {
  const rows = [['a,b', 'q"uote', 'multi\nline', ' pad '], ['x', '', 'y', 'z']];
  assert.deepEqual(parseCsv(writeCsv(rows)).rows, rows);
});

test('sniff: tab, semicolon, comma', () => {
  assert.equal(sniffDelimiter('a\tb\tc\nd\te\tf'), '\t');
  assert.equal(sniffDelimiter('a;b;c\nd;e;f'), ';');
  assert.equal(sniffDelimiter('"x, y",b,c\nd,e,f'), ',');
});

test('anki: headerless cloze CSV keeps the first row', () => {
  const rows = okNotes('Aldehydes reduce to {{c1::primary alcohols}},,organic reduction\nKetones to {{c1::secondary}},extra,organic');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'ok');
  if (rows[0].status === 'ok') {
    assert.equal(rows[0].note.kind, 'cloze');
    assert.deepEqual(rows[0].note.tags, ['organic', 'reduction']);
  }
});

test('anki: a real header row is detected and dropped', () => {
  const f = readAnkiFile('Front,Back,Tags\nWhat is LiAlH4?,A reducing agent,chem');
  assert.equal(f.headerGuess, true);
  const rows = toNotes(f, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status === 'ok' && rows[0].note.kind, 'basic');
});

test('anki: a first card that merely contains "front" is not a header', () => {
  const f = readAnkiFile('Front of the cell,Membrane\nb,c');
  assert.equal(f.headerGuess, false);
});

test('anki: directives — tab, html, tags/guid/notetype columns', () => {
  const text = [
    '#separator:tab', '#html:true', '#guid column:1', '#notetype column:2', '#tags column:5',
    'Xa1\tCloze\t{{c1::LiAlH4}} reduces aldehydes\t<b>strong</b> reducer\torganic high-yield',
  ].join('\n');
  const f = readAnkiFile(text);
  assert.equal(f.anki, true);
  assert.equal(f.delimiterName, 'tab-separated');
  const rows = toNotes(f, false);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].status === 'ok');
  if (rows[0].status === 'ok') {
    assert.equal(rows[0].note.front, '{{c1::LiAlH4}} reduces aldehydes');
    assert.equal(rows[0].note.back, '<b>strong</b> reducer');
    assert.equal(rows[0].note.guid, 'Xa1');
    assert.deepEqual(rows[0].note.tags, ['organic', 'high-yield']);
  }
});

test('anki: #html:false escapes text and keeps line breaks', () => {
  const rows = okNotes('#separator:comma\n#html:false\n"a < b\nnext",x');
  assert.ok(rows[0].status === 'ok' && rows[0].note.front === 'a &lt; b<br>next');
});

test('anki: empty tags and empty optional back', () => {
  const rows = okNotes('{{c1::x}},,');
  assert.ok(rows[0].status === 'ok' && rows[0].note.tags.length === 0 && rows[0].note.back === '');
});

test('anki: problems are reported per row, skipped rows are blank', () => {
  const rows = okNotes('{{c1::fine}},a\n,only back\n{{c1::never closed,b\n\n{{c1:typo}},c');
  const s = rows.map(r => r.status);
  assert.deepEqual(s, ['ok', 'problem', 'problem', 'skipped', 'problem']);
  const p = rows[2];
  assert.ok(p.status === 'problem' && /closed/.test(p.reason));
  assert.equal(rows[2].line, 3);
});

test('anki: large file stays fast', () => {
  const body = Array.from({ length: 10000 }, (_, i) => `"Card ${i}: {{c1::answer ${i}}}, with comma","back ${i}",tag${i % 7}`).join('\n');
  const t = performance.now();
  const rows = okNotes(body);
  const ms = performance.now() - t;
  assert.equal(rows.filter(r => r.status === 'ok').length, 10000);
  assert.ok(ms < 2000, `took ${ms}ms`);
});

test('tags: space-separated, deduped, hierarchical kept', () => {
  assert.deepEqual(parseTags(' organic  organic chem::aldehydes #jee '), ['organic', 'chem::aldehydes', 'jee']);
});

test('export round trip: same notes back', () => {
  const notes = [
    { id: 'n1', kind: 'cloze' as const, front: 'A, "quoted" {{c1::x::hint}}\nline', back: '<b>b</b>', tags: ['t1', 't2'], guid: 'G1' },
    { id: 'n2', kind: 'basic' as const, front: 'Q?', back: 'A', tags: [], guid: null },
  ];
  const rows = okNotes(exportNotes(notes));
  assert.equal(rows.length, 2);
  rows.forEach((r, i) => {
    assert.ok(r.status === 'ok');
    if (r.status !== 'ok') return;
    assert.equal(r.note.kind, notes[i].kind);
    assert.equal(r.note.front, notes[i].front.includes('<') ? notes[i].front : notes[i].front.replace('\n', '<br>'));
    assert.equal(r.note.back, notes[i].back);
    assert.deepEqual(r.note.tags, notes[i].tags);
    assert.equal(r.note.guid, notes[i].guid ?? notes[i].id);
  });
});

test('hash: formatting-insensitive, case-sensitive, cloze-number-sensitive', async () => {
  assert.equal(await contentHash('<b>LiAlH4</b>  reduces', ''), await contentHash('LiAlH4 reduces', ''));
  assert.notEqual(await contentHash('LiAlH4', ''), await contentHash('lialh4', ''));
  assert.notEqual(await contentHash('{{c1::x}}', ''), await contentHash('{{c2::x}}', ''));
  assert.notEqual(await contentHash('<img src="a.png">', ''), await contentHash('<img src="b.png">', ''));
  assert.match(await contentHash('a', 'b'), /^[0-9a-f]{64}$/);
  assert.notEqual(normalizeForHash('ab', ''), normalizeForHash('a', 'b'));
});

test('plain text and media names', () => {
  assert.equal(toPlain('a&nbsp;&amp;<br>b&#8322;'), 'a & b₂');
  assert.deepEqual(mediaNames('<img src="benzene.png"> <img src=\'https://x/y.png\'>'), ['benzene.png']);
  assert.equal(isMediaName('../etc.png'), false);
  assert.equal(isMediaName('ring_1.JPG'), true);
});
