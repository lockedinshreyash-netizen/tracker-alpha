import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMS, defaultExam, defaultYear, examDateFor, examsIn, normalizeTarget, prefOf, streamOf, targetExams, targetLabel, yearChoices,
} from '../exams';
import { paperPresets, perQuestionFor, schemeFor } from '../../mocks/model';

const OCT_2026 = new Date(2026, 9, 25);
const FEB_2027 = new Date(2027, 1, 10);

test('exams: every exam is in a stream, and ids are unique', () => {
  assert.equal(new Set(EXAMS.map(e => e.id)).size, EXAMS.length);
  EXAMS.forEach(e => assert.ok(e.streams.length > 0, e.id));
  assert.deepEqual(examsIn('PCB').map(e => e.id), ['mht-cet', 'kcet', 'neet-ug']);
  assert.ok(examsIn('PCM').some(e => e.id === 'bitsat'));
});

test('stream: the old JEE/NEET choice is the stream', () => {
  assert.equal(streamOf('JEE'), 'PCM');
  assert.equal(streamOf('NEET'), 'PCB');
  assert.equal(streamOf(undefined), 'PCM');
  assert.equal(prefOf('PCB'), 'NEET');
  assert.equal(defaultExam('PCB'), 'neet-ug');
});

test('year: from the class and the season', () => {
  // October: this season's exams are next year's.
  assert.equal(defaultYear(12, OCT_2026), 2027);
  assert.equal(defaultYear(11, OCT_2026), 2028);
  // February: the season is under way, Class 12 writes this year.
  assert.equal(defaultYear(12, FEB_2027), 2027);
  assert.equal(defaultYear(11, FEB_2027), 2028);
  assert.deepEqual(yearChoices(OCT_2026), [2027, 2028, 2029, 2030]);
});

test('migration: an old JEE or NEET choice becomes a full target', () => {
  assert.deepEqual(normalizeTarget(undefined, 'PCM', 12, OCT_2026), { primary: 'jee-main', also: [], year: 2027 });
  // Not asked yet: this season, whatever the class.
  assert.deepEqual(normalizeTarget(undefined, 'PCB', 11, OCT_2026), { primary: 'neet-ug', also: [], year: 2027 });
});

test('normalize: exams stay in their stream, unique, capped, with Main before Advanced', () => {
  // NEET is not a PCM exam: the stream wins and its default replaces it.
  assert.equal(normalizeTarget({ primary: 'neet-ug', also: [], year: 2027 }, 'PCM', 12, OCT_2026).primary, 'jee-main');
  // Others from the wrong stream, repeats and the primary itself are dropped.
  assert.deepEqual(
    normalizeTarget({ primary: 'bitsat', also: ['bitsat', 'neet-ug', 'kcet', 'kcet'], year: 2027 }, 'PCM', 12, OCT_2026).also,
    ['kcet'],
  );
  // Advanced as the main exam brings Main along.
  assert.deepEqual(normalizeTarget({ primary: 'jee-advanced', also: [], year: 2027 }, 'PCM', 12, OCT_2026).also, ['jee-main']);
  // Advanced among the others brings Main too.
  assert.ok(normalizeTarget({ primary: 'bitsat', also: ['jee-advanced'], year: 2027 }, 'PCM', 12, OCT_2026).also.includes('jee-main'));
  // At most four others.
  assert.equal(normalizeTarget({ primary: 'jee-main', also: ['bitsat', 'mht-cet', 'wbjee', 'kcet', 'comedk', 'viteee'], year: 2027 }, 'PCM', 12, OCT_2026).also.length, 4);
  // A year far from now, or no year, falls back to this season, whatever the class.
  assert.equal(normalizeTarget({ primary: 'jee-main', also: [], year: 1999 }, 'PCM', 11, OCT_2026).year, 2027);
  assert.equal(normalizeTarget({ primary: 'jee-main', also: [], year: 2029 }, 'PCM', 12, OCT_2026).year, 2029);
  // Garbage is a default target, not a crash.
  assert.equal(normalizeTarget('nonsense', 'PCB', 12, OCT_2026).primary, 'neet-ug');
  assert.deepEqual(targetExams({ primary: 'bitsat', also: ['kcet'], year: 2027 }), ['bitsat', 'kcet']);
});

test('dates: the usual window, NEET on the first Sunday of May', () => {
  const neet = examDateFor('neet-ug', 2027);
  assert.equal(neet.official, false);
  assert.equal(neet.date.getMonth(), 4);
  assert.equal(neet.date.getDay(), 0);
  assert.ok(neet.date.getDate() <= 7);
  assert.equal(examDateFor('jee-main', 2027).date.getTime(), new Date(2027, 0, 1).getTime());
  assert.equal(examDateFor('bitsat', 2028).date.getMonth(), 4);
  assert.equal(targetLabel('bitsat', 2028), 'BITSAT 2028');
  assert.equal(targetLabel('mht-cet', 2028, true), 'MHT CET ’28');
});

test('mocks: exams without a paper of their own are presets, marked by their scheme', () => {
  assert.deepEqual(paperPresets(['jee-main', 'bitsat', 'jee-advanced', 'mht-cet']).map(p => [p.name, p.maxMarks]), [['BITSAT', 390], ['MHT CET', 200]]);
  assert.deepEqual(schemeFor({ exam: 'other', paperName: 'BITSAT' }), { right: 3, wrong: -1 });
  assert.deepEqual(schemeFor({ exam: 'other', paperName: 'comedk' }), { right: 1, wrong: 0 }, 'the short name works too, any case');
  assert.equal(schemeFor({ exam: 'other', paperName: 'MHT CET' }), undefined, 'mixed marking: typed by hand');
  assert.equal(schemeFor({ exam: 'other', paperName: 'School pre-board' }), undefined);
  assert.deepEqual(schemeFor({ exam: 'mains' }), { right: 4, wrong: -1 });
  assert.equal(perQuestionFor({ exam: 'other', paperName: 'BITSAT' }), 3);
  assert.equal(perQuestionFor({ exam: 'other' }), 4);
});

import { EXAM_COLORS, examColor } from '../exams';

test('colours: every exam has one, never the action red, and shared hues are outlined', () => {
  for (const e of EXAMS) {
    const c = EXAM_COLORS[e.id];
    assert.ok(c, e.id);
    assert.match(c.light, /^#[0-9a-f]{6}$/);
    assert.match(c.dark, /^#[0-9a-f]{6}$/);
    assert.notEqual(c.light.toLowerCase(), '#e10600');
    assert.notEqual(c.dark.toLowerCase(), '#e10600');
  }
  // A hue used twice is filled once and outlined once, never filled twice.
  const filled = EXAMS.filter(e => !EXAM_COLORS[e.id].outline).map(e => EXAM_COLORS[e.id].light);
  assert.equal(new Set(filled).size, filled.length);
  EXAMS.filter(e => EXAM_COLORS[e.id].outline).forEach(e => assert.ok(filled.includes(EXAM_COLORS[e.id].light), `${e.id} borrows a filled hue`));
  // The three most-written exams get the three hues that pass side by side.
  assert.deepEqual(['jee-main', 'jee-advanced', 'neet-ug'].map(id => examColor(id as 'jee-main', false)), ['#2a78d6', '#eb6834', '#1baf7a']);
});
