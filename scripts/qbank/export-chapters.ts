/* Prints the syllabus chapter names the app tags questions with, as JSON, for
   scripts/qbank/extract.py. Run `npm run qbank:chapters` after a chapter is
   renamed or added in constants.tsx — the importer drops any chapter name it
   does not recognise to "needs review", so a stale list costs review time, not
   correctness. */
import { getChaptersFor } from '../../constants';

const subjects = ['Physics', 'Chemistry', 'Maths'] as const;
const out: Record<string, Record<string, string[]>> = {};
subjects.forEach(s => {
  out[s] = { 11: getChaptersFor('JEE', 11, s), 12: getChaptersFor('JEE', 12, s) };
});
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
