import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterRefs, headingIn, proposeMap } from '../mapping';

const SYLLABUS: Record<string, string[]> = {
  '11|Physics': ['Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Waves'],
  '12|Physics': ['Electric Charges & Fields', 'Wave Optics'],
  '11|Chemistry': ['Some Basic Concepts of Chemistry', 'Structure of Atom'],
  '12|Chemistry': ['Solutions'],
};
const refs = chapterRefs(['Physics', 'Chemistry'], (c, s) => SYLLABUS[`${c}|${s}`] ?? []);

test('an NCERT heading gives the chapter name', () => {
  assert.equal(headingIn('CHAPTER TWO\nMOTION IN A STRAIGHT LINE\n2.1 Introduction'), 'MOTION IN A STRAIGHT LINE 2.1 Introduction');
  assert.equal(headingIn('Chapter 1: Units and Measurement'), 'Units and Measurement');
  assert.equal(headingIn('Exercises and answers'), null);
});

test('a one-chapter NCERT file is filed from its first page', () => {
  const p = proposeMap({ pages: 24, outline: [], firstText: 'CHAPTER TWO\nMOTION IN A STRAIGHT LINE\n2.1 Introduction', title: 'keph102' }, refs);
  assert.deepEqual(p.sections, [{ from: 1, to: 24, chapterKey: '11|Physics|Motion in a Straight Line' }]);
  assert.equal(p.subject, 'Physics');
  assert.equal(p.classId, 11);
});

test('a whole book is mapped from its headings, and its class is the class of most pages', () => {
  const p = proposeMap({
    pages: 120,
    outline: [
      { title: 'Units and Measurement', page: 3 },
      { title: 'Motion in a Straight Line', page: 20 },
      { title: 'Laws of Motion', page: 60 },
      { title: 'Appendix: wave optics in brief', page: 117 },
    ],
    firstText: '',
    title: 'Physics Part 1',
  }, refs);
  assert.equal(p.classId, 11);
  assert.deepEqual(p.sections.map(s => [s.from, s.to, s.chapterKey.split('|')[2]]), [
    [3, 19, 'Units & Measurements'], [20, 59, 'Motion in a Straight Line'], [60, 116, 'Laws of Motion'], [117, 120, 'Wave Optics'],
  ]);
});

test('a file that names nothing is not filed', () => {
  assert.deepEqual(proposeMap({ pages: 6, outline: [], firstText: 'DPP 04\nQ1. A particle', title: 'dpp-04' }, refs), { sections: [] });
});
