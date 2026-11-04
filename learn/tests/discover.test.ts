import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterQuery, durationLabel, guessChapter, words, type ChapterRef } from '../discover/match';

const CH: ChapterRef[] = [
  { classId: 11, subject: 'Physics', chapter: 'System of Particles & Rotational Motion' },
  { classId: 11, subject: 'Physics', chapter: 'Laws of Motion' },
  { classId: 11, subject: 'Physics', chapter: 'Motion in a Straight Line' },
  { classId: 11, subject: 'Physics', chapter: 'Thermodynamics' },
  { classId: 11, subject: 'Chemistry', chapter: 'Thermodynamics' },
  { classId: 11, subject: 'Chemistry', chapter: 'Chemical Bonding and Molecular Structure' },
  { classId: 12, subject: 'Maths', chapter: 'Integrals' },
  { classId: 12, subject: 'Physics', chapter: 'Electrostatic Potential and Capacitance' },
];

test('words drop how a lecture is made and keep what it is about', () => {
  assert.deepEqual(words('Rotational Motion ONE SHOT | JEE Mains 2027'), ['rotational', 'motion']);
  assert.deepEqual(words('Particles & Rotation'), ['particles', 'rotation']);
});

test('a search lands on the chapter it names', () => {
  assert.equal(guessChapter('rotational motion one shot', CH)?.chapter, 'System of Particles & Rotational Motion');
  assert.equal(guessChapter('laws of motion jee', CH)?.chapter, 'Laws of Motion');
  assert.equal(guessChapter('integration by parts', CH)?.chapter, 'Integrals');
  assert.equal(guessChapter('chemical bonding class 11', CH)?.chapter, 'Chemical Bonding and Molecular Structure');
  assert.equal(guessChapter('capacitance and potential', CH)?.chapter, 'Electrostatic Potential and Capacitance');
});

test('a weak or empty match files nothing', () => {
  assert.equal(guessChapter('jee one shot lecture', CH), null);
  assert.equal(guessChapter('motivation for toppers', CH), null);
  assert.equal(guessChapter('', CH), null);
});

test('the first chapter wins a tie, so the subject in front comes first', () => {
  // Thermodynamics is in both; the caller orders chapters by the subject in view.
  assert.equal(guessChapter('thermodynamics first law', CH)?.subject, 'Physics');
});

test('a chapter search reads like what a student types', () => {
  assert.equal(chapterQuery('System of Particles & Rotational Motion', 'JEE'), 'System of Particles and Rotational Motion JEE lecture');
  assert.equal(chapterQuery('Human Physiology', 'NEET'), 'Human Physiology NEET lecture');
});

test('durations print like YouTube’s', () => {
  assert.equal(durationLabel(754), '12:34');
  assert.equal(durationLabel(3725), '1:02:05');
  assert.equal(durationLabel(null), '');
});
