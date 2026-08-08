/**
 * Content validation. Run before changing any weightage number.
 *
 *   node scripts/checkContent.mjs
 *
 * Checks, per exam:
 *   1. every SYLLABUS_DATA chapter the exam uses has a weightage row (and no
 *      row points at a chapter that does not exist)
 *   2. per-subject totals land near 100% — a large shortfall means the source
 *      dataset is weighted over a syllabus that no longer matches ours
 *   3. foundational chapters sitting in a low/medium tier are listed, because
 *      the UI must never offer to deprioritise them
 */

import { readFileSync } from 'fs';

const consts = readFileSync('constants.tsx', 'utf8');
const block = consts.slice(consts.indexOf('export const SYLLABUS_DATA'));

const syllabus = {};
let cls = null, subj = null;
for (const line of block.split('\n')) {
  const c = line.match(/^\s{2}(11|12):\s*\{/);
  if (c) { cls = c[1]; syllabus[cls] = {}; continue; }
  const s = line.match(/^\s{4}(Physics|Chemistry|Maths|Biology):\s*\[/);
  if (s) { subj = s[1]; syllabus[cls][subj] = []; }
  if (subj && cls) {
    for (const m of line.matchAll(/'([^']+)'/g)) syllabus[cls][subj].push(m[1]);
    if (line.includes(']')) subj = null;
  }
}

// Exam-specific chapters layered on top of the shared SYLLABUS_DATA base.
const extras = { JEE: {}, NEET: {} };
{
  const blk = consts.slice(consts.indexOf('export const EXAM_EXTRA_CHAPTERS'), consts.indexOf('export const getChaptersFor'));
  let exam = null, cl = null;
  for (const line of blk.split('\n')) {
    const e = line.match(/^\s{2}(JEE|NEET):\s*\{/);
    if (e) { exam = e[1]; continue; }
    const c = line.match(/^\s{4}(11|12):\s*\{(.*)$/);
    if (c && exam) {
      cl = c[1];
      extras[exam][cl] = extras[exam][cl] || {};
      for (const sm of c[2].matchAll(/(Physics|Chemistry|Maths|Biology):\s*\[([^\]]*)\]/g)) {
        extras[exam][cl][sm[1]] = [...sm[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      }
    }
  }
}

const chaptersFor = (exam, cl, sub) =>
  [...(syllabus[cl][sub] || []), ...((extras[exam][cl] || {})[sub] || [])];

const parseRows = (file) =>
  [...readFileSync(file, 'utf8').matchAll(
    /\{ chapter: '((?:[^'\\]|\\.)+)', classId: (11|12), subject: '(\w+)',(?: stream: '(\w+)',)? percent: ([\d.]+), tier: '(\w+)', confidence: '(\w+)', foundational: (true|false)/g,
  )].map((m) => ({
    chapter: m[1].replace(/\\'/g, "'"), classId: m[2], subject: m[3], stream: m[4],
    percent: +m[5], tier: m[6], confidence: m[7], foundational: m[8] === 'true',
  }));

// NEET drops Maths; JEE drops Biology. Each exam is only checked against the
// subjects it actually examines.
const EXAMS = [
  { name: 'JEE',  file: 'content/weightageJEE.ts',  subjects: ['Physics', 'Chemistry', 'Maths'] },
  { name: 'NEET', file: 'content/weightageNEET.ts', subjects: ['Physics', 'Chemistry', 'Biology'] },
];

let failures = 0;

for (const exam of EXAMS) {
  const rows = parseRows(exam.file);
  console.log(`\n=== ${exam.name} — ${rows.length} rows ===`);

  let missing = 0, orphan = 0;
  for (const cl of ['11', '12']) {
    for (const sub of exam.subjects) {
      const chapters = chaptersFor(exam.name, cl, sub);
      for (const ch of chapters) {
        if (!rows.find((r) => r.chapter === ch && r.classId === cl && r.subject === sub)) {
          console.log(`  MISSING  ${cl} ${sub}: ${ch}`); missing++;
        }
      }
      for (const r of rows.filter((r) => r.classId === cl && r.subject === sub)) {
        if (!chapters.includes(r.chapter)) { console.log(`  ORPHAN   ${cl} ${sub}: ${r.chapter}`); orphan++; }
      }
    }
  }
  console.log(`  coverage: missing=${missing} orphan=${orphan}`);
  failures += missing + orphan;

  for (const sub of exam.subjects) {
    const inSub = rows.filter((r) => r.subject === sub);
    if (sub === 'Biology') {
      for (const st of ['botany', 'zoology']) {
        const t = inSub.filter((r) => r.stream === st).reduce((a, r) => a + r.percent, 0);
        console.log(`  Biology/${st.padEnd(8)} total=${t.toFixed(1)}%${t < 90 ? '   <-- SHORTFALL' : ''}`);
      }
    } else {
      const t = inSub.reduce((a, r) => a + r.percent, 0);
      console.log(`  ${sub.padEnd(16)} total=${t.toFixed(1)}%${t < 90 ? '   <-- SHORTFALL, source may predate syllabus changes' : ''}`);
    }
  }

  const low = rows.filter((r) => r.confidence === 'low');
  console.log(`  low-confidence: ${low.length}${low.length ? ' -> ' + low.map((r) => r.chapter).join(', ') : ''}`);

  const trap = rows.filter((r) => r.foundational && (r.tier === 'low' || r.tier === 'medium'));
  console.log(`  foundational but low/medium tier (never show as skippable): ${trap.length}`);
}

console.log(failures ? `\nFAIL — ${failures} coverage problem(s)` : '\nOK — coverage complete for both exams');
process.exit(failures ? 1 : 0);
