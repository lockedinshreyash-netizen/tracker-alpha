import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterRefs, chapterTitle, headingIn, isContentsPage, opensWith, parseContents, pickChapterEntries, proposeMap, toPdfPages,
} from '../mapping';

const SYLLABUS: Record<string, string[]> = {
  '11|Physics': ['Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy & Power', 'Gravitation', 'Oscillations', 'Waves'],
  '12|Physics': ['Electric Charges & Fields', 'Current Electricity', 'Wave Optics'],
  '11|Chemistry': ['Some Basic Concepts of Chemistry', 'Structure of Atom'],
  '12|Chemistry': ['Solutions', 'Coordination Compounds'],
  '12|Biology': ['Neural Control and Coordination'],
};
const refs = chapterRefs(['Physics', 'Chemistry', 'Biology'], (c, s) => SYLLABUS[`${c}|${s}`] ?? []);
const name = (k: string) => k.split('|')[2];

test('chapter titles are told from section titles', () => {
  assert.equal(chapterTitle('Chapter 3 Vectors'), 'Vectors');
  assert.equal(chapterTitle('CHAPTER TWO: Motion Along a Straight Line'), 'Motion Along a Straight Line');
  assert.equal(chapterTitle('3 Vectors'), 'Vectors');
  assert.equal(chapterTitle('12. Equilibrium and Elasticity'), 'Equilibrium and Elasticity');
  assert.equal(chapterTitle('3-2 Unit Vectors, Adding Vectors by Components'), null);
  assert.equal(chapterTitle('3.1 Coordinate Systems'), null);
  assert.equal(chapterTitle('Preface'), null);
  assert.equal(chapterTitle('123 Something'), null);
});

test('bookmarks: chapters at any depth, never their sections', () => {
  const picked = pickChapterEntries([
    { title: 'Cover', page: 1, depth: 0 },
    { title: 'Part 1', page: 20, depth: 0 },
    { title: 'Chapter 1 Measurement', page: 21, depth: 1 },
    { title: '1-1 Measuring Things', page: 21, depth: 2 },
    { title: 'Chapter 3 Vectors', page: 60, depth: 1 },
    { title: '3-1 Coordinate Systems', page: 61, depth: 2 },
  ]);
  assert.deepEqual(picked, [{ title: 'Measurement', page: 21 }, { title: 'Vectors', page: 60 }]);
});

test('bookmarks that are not numbered fall back to the top level only', () => {
  const picked = pickChapterEntries([
    { title: 'Electric Charges and Fields', page: 3, depth: 0 },
    { title: 'Coulomb’s law', page: 9, depth: 1 },
    { title: 'Current Electricity', page: 40, depth: 0 },
  ]);
  assert.deepEqual(picked.map(p => p.title), ['Electric Charges and Fields', 'Current Electricity']);
});

/* A Halliday-shaped Contents: a heading, chapter lines with dot leaders,
   section lines under them (one mentions coordinates), across two pages. */
const page1 = [
  'CONTENTS',
  '1 Measurement ........ 1',
  '1-1 Measuring Things, Including Lengths 1',
  '2 Motion Along a Straight Line ........ 13',
  '2-1 Position, Displacement, and Average Velocity 13',
  '3 Vectors ........ 40',
  '3-1 Vectors and Their Components 41',
  '3-2 Coordinate Systems 44',
];
const page2 = [
  '4 Motion in Two and Three Dimensions 61',
  '5 Force and Motion—I 94',
  '7 Kinetic Energy and Work 149',
  '15 Oscillations 413',
  '16 Waves—I 444',
  'Appendices A-1',
];

test('a Contents page is found and its chapter lines read in order', () => {
  assert.equal(isContentsPage(page1), true);
  assert.equal(isContentsPage(['Preface', 'This book is for students who…']), false);
  const toc = parseContents([page1, page2]);
  assert.deepEqual(toc.map(e => [e.title, e.printed]), [
    ['Measurement', 1], ['Motion Along a Straight Line', 13], ['Vectors', 40], ['Motion in Two and Three Dimensions', 61],
    ['Force and Motion—I', 94], ['Kinetic Energy and Work', 149], ['Oscillations', 413], ['Waves—I', 444],
  ]);
});

test('printed pages become PDF pages by labels, else by one offset', () => {
  const toc = [{ title: 'Measurement', printed: 1 }, { title: 'Vectors', printed: 40 }];
  const labels = ['i', 'ii', 'iii', ...Array.from({ length: 60 }, (_, i) => String(i + 1))];
  assert.deepEqual(toPdfPages(toc, 63, { labels }), [{ title: 'Measurement', page: 4 }, { title: 'Vectors', page: 43 }]);
  assert.deepEqual(toPdfPages(toc, 63, { offset: 22 }), [{ title: 'Measurement', page: 23 }, { title: 'Vectors', page: 62 }]);
  // A page past the end of the file is dropped, not invented.
  assert.deepEqual(toPdfPages(toc, 50, { offset: 22 }), [{ title: 'Measurement', page: 23 }]);
  assert.equal(opensWith('C H A P T E R 1 MEASUREMENT 1-1 Measuring Things', 'Measurement'), true);
});

test('a physics book is filed under physics only: no Coordination Compounds', () => {
  const chapters = [
    { title: 'Measurement', page: 23 },
    { title: 'Motion Along a Straight Line', page: 35 },
    { title: 'Vectors', page: 62 },
    { title: 'Coordinate Systems and Coordination', page: 70 },
    { title: 'Motion in Two and Three Dimensions', page: 83 },
    { title: 'Force and Motion—I', page: 116 },
    { title: 'Force and Motion—II', page: 146 },
    { title: 'Oscillations', page: 435 },
    { title: 'Waves—I', page: 466 },
  ];
  const p = proposeMap({ pages: 1300, chapters, firstText: '', title: 'Fundamentals of Physics' }, refs);
  assert.equal(p.subject, 'Physics');
  assert.equal(p.classId, 11);
  assert.ok(p.sections.every(s => s.chapterKey.includes('|Physics|')), 'nothing filed under another subject');
  assert.deepEqual(p.sections.map(s => [name(s.chapterKey), s.from, s.to]), [
    ['Units & Measurements', 23, 34],
    ['Motion in a Straight Line', 35, 61],
    // NCERT teaches vectors in Motion in a Plane. The "Coordinate" entry at 70 matches nothing and keeps its pages.
    ['Motion in a Plane', 62, 69],
    ['Motion in a Plane', 83, 115],
    // A tie between Laws of Motion and Motion in a Plane: the plane is taken, so Laws of Motion; part II continues it.
    ['Laws of Motion', 116, 434],
    ['Oscillations', 435, 465],
    ['Waves', 466, 1300],
  ]);
});

test('an NCERT heading gives the chapter name', () => {
  assert.equal(headingIn('CHAPTER TWO\nMOTION IN A STRAIGHT LINE\n2.1 Introduction'), 'MOTION IN A STRAIGHT LINE');
  assert.equal(headingIn('Chapter 1: Units and Measurement'), 'Units and Measurement');
  assert.equal(headingIn('Exercises and answers'), null);
});

test('a one-chapter NCERT file is filed from its first page', () => {
  const p = proposeMap({ pages: 24, chapters: [], firstText: 'CHAPTER TWO\nMOTION IN A STRAIGHT LINE\n2.1 Introduction', title: 'keph102' }, refs);
  assert.deepEqual(p.sections, [{ from: 1, to: 24, chapterKey: '11|Physics|Motion in a Straight Line' }]);
  assert.equal(p.subject, 'Physics');
});

test('a file that names nothing is not filed', () => {
  assert.deepEqual(proposeMap({ pages: 6, chapters: [], firstText: 'DPP 04\nQ1. A particle', title: 'dpp-04' }, refs), { sections: [] });
});

test("Halliday's own chapter names land on NCERT's chapters", () => {
  const full = chapterRefs(['Physics'], (c) => (c === 11
    ? ['Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy & Power', 'System of Particles & Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves']
    : ['Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity', 'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics & Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation & Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics']));
  const titles = [
    ['Measurement', 'Units & Measurements'], ['Motion Along a Straight Line', 'Motion in a Straight Line'], ['Vectors', 'Motion in a Plane'],
    ['Motion in Two and Three Dimensions', 'Motion in a Plane'], ['Force and Motion—I', 'Laws of Motion'], ['Force and Motion—II', 'Laws of Motion'],
    ['Kinetic Energy and Work', 'Work, Energy & Power'], ['Potential Energy and Conservation of Energy', 'Work, Energy & Power'],
    ['Center of Mass and Linear Momentum', 'System of Particles & Rotational Motion'], ['Rolling, Torque, and Angular Momentum', 'System of Particles & Rotational Motion'],
    ['Equilibrium and Elasticity', 'Mechanical Properties of Solids'], ['Gravitation', 'Gravitation'], ['Fluids', 'Mechanical Properties of Fluids'],
    ['Oscillations', 'Oscillations'], ['Waves—I', 'Waves'], ['Temperature, Heat, and the First Law of Thermodynamics', 'Thermodynamics'],
    ['The Kinetic Theory of Gases', 'Kinetic Theory'], ['Coulomb’s Law', 'Electric Charges & Fields'], ['Gauss’ Law', 'Electric Charges & Fields'],
    ['Electric Potential', 'Electrostatic Potential & Capacitance'], ['Capacitance', 'Electrostatic Potential & Capacitance'],
    ['Current and Resistance', 'Current Electricity'], ['Circuits', 'Current Electricity'], ['Magnetic Fields Due to Currents', 'Moving Charges & Magnetism'],
    ['Induction and Inductance', 'Electromagnetic Induction'], ['Electromagnetic Oscillations and Alternating Current', 'Alternating Current'],
    ['Maxwell’s Equations; Magnetism of Matter', 'Magnetism & Matter'], ['Electromagnetic Waves', 'Electromagnetic Waves'], ['Images', 'Ray Optics & Optical Instruments'],
    ['Interference', 'Wave Optics'], ['Diffraction', 'Wave Optics'], ['Photons and Matter Waves', 'Dual Nature of Radiation & Matter'],
    ['All About Atoms', 'Atoms'], ['Conduction of Electricity in Solids', 'Semiconductor Electronics'], ['Nuclear Physics', 'Nuclei'],
  ];
  // One chapter per entry, each 10 pages, so every entry's own match shows.
  const chapters = titles.map(([t], i) => ({ title: t, page: 1 + i * 10 }));
  const p = proposeMap({ pages: 400, chapters, firstText: '', title: 'Fundamentals of Physics' }, full);
  const got = new Map(p.sections.map(s => [s.from, name(s.chapterKey)]));
  const wrong = titles.filter(([, want], i) => {
    // Neighbouring entries on one chapter are joined into one section, which starts at the first of them.
    const start = [...got.keys()].filter(k => k <= 1 + i * 10).pop();
    return start === undefined || got.get(start) !== want;
  });
  assert.deepEqual(wrong, []);
  assert.ok(!titles.some(([t]) => t === 'Relativity'));
});

test('a long book whose contents cannot be found is left for the student, not filed as chapter 1', () => {
  const p = proposeMap({ pages: 600, chapters: [], firstText: 'CHAPTER ONE\nUNITS AND MEASUREMENT', title: 'Physics' }, refs);
  assert.deepEqual(p, { sections: [] });
});

test('machine-made bookmarks are ignored, not read as chapters', () => {
  // The shape of a real DPP's bookmarks: every text run turned into an entry.
  const junk = [
    { title: 'Chemistry', page: 1, depth: 0 },
    { title: 'Aldehydes, Ketones and Carboxylic Acids', page: 1, depth: 0 },
    { title: 'Practice assignment', page: 1, depth: 0 },
    { title: '2 H5MgBr', page: 2, depth: 2 },
    { title: '2 andC2H5MgBr', page: 2, depth: 2 },
    { title: '1. Mg,THF 2. X', page: 6, depth: 2 },
    { title: '7 COOH', page: 7, depth: 2 },
    { title: '7 CH3', page: 7, depth: 2 },
  ];
  assert.deepEqual(pickChapterEntries(junk, 44), []);
  assert.equal(chapterTitle('2 H5MgBr'), null);
  assert.equal(chapterTitle('1. Mg,THF 2. X'), null);
  assert.equal(chapterTitle('5 Force and Motion—I'), 'Force and Motion—I');
});

test('a sheet that prints its chapter near the top, without the word Chapter, is filed by it', () => {
  const chem = chapterRefs(['Chemistry'], (c) => (c === 12 ? ['Solutions', 'Aldehydes, Ketones & Carboxylic Acids', 'Amines'] : ['Structure of Atom']));
  const p = proposeMap({ pages: 44, chapters: [], firstText: 'Chemistry\nAldehydes, Ketones and Carboxylic Acids\nPractice assignment\n8. Stability of gem diol depends on', title: 'dpp' }, chem);
  assert.deepEqual(p.sections, [{ from: 1, to: 44, chapterKey: '12|Chemistry|Aldehydes, Ketones & Carboxylic Acids' }]);
});
