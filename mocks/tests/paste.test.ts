import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePastedQuestion as parse } from '../paste';

test('options on their own lines, (A)–(D)', () => {
  const r = parse(`A block of mass 2 kg rests on a rough incline of 30°. The friction force is
(A) 5 N
(B) 10 N
(C) 15 N
(D) 20 N`);
  assert.equal(r.question, 'A block of mass 2 kg rests on a rough incline of 30°. The friction force is');
  assert.deepEqual(r.options, ['5 N', '10 N', '15 N', '20 N']);
  assert.equal(r.correct, null);
});

test('options inline, (a)–(d), commas dropped', () => {
  const r = parse('The dimension of impulse is (a) [MLT⁻¹], (b) [ML²T⁻²], (c) [MLT⁻²], (d) [M⁰LT]');
  assert.equal(r.question, 'The dimension of impulse is');
  assert.deepEqual(r.options, ['[MLT⁻¹]', '[ML²T⁻²]', '[MLT⁻²]', '[M⁰LT]']);
});

test('a question number is not option 1', () => {
  const r = parse(`1. Which of these is a scalar?
1. Velocity
2. Force
3. Work
4. Momentum`);
  assert.equal(r.question, 'Which of these is a scalar?');
  assert.deepEqual(r.options, ['Velocity', 'Force', 'Work', 'Momentum']);
});

test('"Q.12" and 1) markers', () => {
  const r = parse(`Q.12 The pH of 0.01 M HCl is
1) 1
2) 2
3) 12
4) 13`);
  assert.equal(r.question, 'The pH of 0.01 M HCl is');
  assert.deepEqual(r.options, ['1', '2', '12', '13']);
});

test('the answer line is read and the solution is cut', () => {
  const r = parse(`Find the derivative of x² at x = 3.
(A) 3 (B) 6 (C) 9 (D) 12
Ans. (B)
Sol. d/dx x² = 2x = 6. Hence (B).`);
  assert.deepEqual(r.options, ['3', '6', '9', '12']);
  assert.equal(r.correct, 1);
});

test('"Correct Answer: 3" on numbered options', () => {
  const r = parse(`Which gas is evolved?
(1) H2
(2) O2
(3) CO2
(4) N2
Correct Answer: 3`);
  assert.deepEqual(r.options, ['H2', 'O2', 'CO2', 'N2']);
  assert.equal(r.correct, 2);
});

test('an answer only inside the solution still counts', () => {
  const r = parse(`Value of sin 30° is
(A) 0 (B) 1/2 (C) 1 (D) √3/2
Solution: sin 30° = 1/2, so the correct answer is (B).`);
  assert.equal(r.correct, 1);
  assert.deepEqual(r.options, ['0', '1/2', '1', '√3/2']);
});

test('match the list: List-I (A)–(D) stays in the question, options are (1)–(4)', () => {
  const r = parse(`Match List-I with List-II.
List-I
(A) Gauss law
(B) Ampere law
(C) Faraday law
(D) Lenz law
List-II
(I) Electric flux
(II) Magnetic field
(III) Induced emf
(IV) Direction of current
Choose the correct answer from the options given below:
(1) (A)-(I), (B)-(II), (C)-(III), (D)-(IV)
(2) (A)-(II), (B)-(I), (C)-(IV), (D)-(III)
(3) (A)-(III), (B)-(IV), (C)-(I), (D)-(II)
(4) (A)-(IV), (B)-(III), (C)-(II), (D)-(I)`);
  assert.ok(r.question.startsWith('Match List-I with List-II.'));
  assert.ok(r.question.includes('(D) Lenz law'));
  assert.ok(r.question.endsWith('Choose the correct answer from the options given below:'));
  assert.deepEqual(r.options, [
    '(A)-(I), (B)-(II), (C)-(III), (D)-(IV)',
    '(A)-(II), (B)-(I), (C)-(IV), (D)-(III)',
    '(A)-(III), (B)-(IV), (C)-(I), (D)-(II)',
    '(A)-(IV), (B)-(III), (C)-(II), (D)-(I)',
  ]);
});

test('statements (i)–(iv) in the question, options (a)–(d)', () => {
  const r = parse(`Consider the statements:
(i) X is true
(ii) Y is true
(iii) Z is true
(iv) W is true
(a) Only (i) (b) (i) and (ii) (c) (ii) and (iii) (d) All`);
  assert.ok(r.question.includes('(iv) W is true'));
  assert.deepEqual(r.options, ['Only (i)', '(i) and (ii)', '(ii) and (iii)', 'All']);
});

test('decimals are not markers, negatives are options', () => {
  const r = parse('A 2.5 kg ball moves at 1.5 m/s. Its momentum is (A) 1.5 (B) 3.75 (C) -2.5 (D) -(1/2)');
  assert.equal(r.question, 'A 2.5 kg ball moves at 1.5 m/s. Its momentum is');
  assert.deepEqual(r.options, ['1.5', '3.75', '-2.5', '-(1/2)']);
});

test('two-by-two layout', () => {
  const r = parse(`Unit of power is
(A) joule      (B) watt
(C) newton     (D) pascal`);
  assert.deepEqual(r.options, ['joule', 'watt', 'newton', 'pascal']);
});

test("NTA's ids and statuses are dropped", () => {
  const r = parse(`Q.5 The SI unit of charge is
Options 1. ampere
2. coulomb
3. volt
4. ohm
Question Type : MCQ
Question ID : 4056781234
Option 1 ID : 40567812341
Status : Answered
Chosen Option : 1`);
  assert.equal(r.question, 'The SI unit of charge is');
  assert.deepEqual(r.options, ['ampere', 'coulomb', 'volt', 'ohm']);
  assert.equal(r.correct, null);
});

test('a line broken mid-sentence is joined', () => {
  const r = parse(`A particle moves in a circle of radius 2 m
with constant speed. Its acceleration is
(A) zero
(B) towards the centre
(C) tangential
(D) outward`);
  assert.equal(r.question, 'A particle moves in a circle of radius 2 m with constant speed. Its acceleration is');
});

test('"answer" in the question does not cut it', () => {
  const r = parse(`Write the answer 2 times the value. The answer is (A) 4 (B) 8 (C) 16 (D) 32`);
  assert.deepEqual(r.options, ['4', '8', '16', '32']);
  assert.equal(r.correct, null);
});

test('no options: only the question comes back', () => {
  const r = parse('12. A ball is thrown up at 20 m/s. Find the maximum height.');
  assert.equal(r.options, null);
  assert.equal(r.question, 'A ball is thrown up at 20 m/s. Find the maximum height.');
});

test('three options are not four', () => {
  assert.equal(parse('Pick one (A) x (B) y (C) z').options, null);
});

test('a "2.5 kg" question keeps its number', () => {
  const r = parse('2.5 kg of water is heated. Heat needed? (A) 1 (B) 2 (C) 3 (D) 4');
  assert.equal(r.question, '2.5 kg of water is heated. Heat needed?');
});
