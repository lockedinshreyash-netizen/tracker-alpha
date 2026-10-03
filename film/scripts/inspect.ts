import { TIMELINE, FPS, PRE_ROLL } from '../src/score/timeline';
import { YEAR, TOTAL_CHAPTERS } from '../src/score/year';
import { longestStreak, longestVerifiedStreak } from '../../utils';

const t = (f: number) => (f / FPS).toFixed(2) + 's';
console.log('duration', TIMELINE.durationInFrames, t(TIMELINE.durationInFrames), 'exam', t(TIMELINE.examFrame));
console.log('title', t(TIMELINE.titleIn), t(TIMELINE.titleOut), 'ignition', t(TIMELINE.ignition));
for (const e of TIMELINE.events) {
  if (e.type === 'chord' || e.type === 'mock') continue;
  console.log(t(e.frame).padStart(8), `DAY ${e.d + 1}`.padEnd(9), e.type, JSON.stringify({ ...e, type: undefined, frame: undefined, d: undefined }));
}
console.log('gates', TIMELINE.gates.map(g => ({ d: g.d + 1, best: g.best, from: t(g.from), until: t(g.until), passed: g.passed })));
console.log('notes', TIMELINE.notes.length, 'chords', TIMELINE.events.filter(e => e.type === 'chord').map(e => `${t(e.frame)} ${(e as any).chord.name}`).join(' | '));
console.log('mocks', TIMELINE.events.filter(e => e.type === 'mock').length);
const sample = [30, 60, 100, 150, 197, 202, 250, 300, 318, 330, 364];
for (const d of sample) { const y = YEAR[d - 1]; console.log(`DAY ${d}`, 'chapters', y.chaptersDone + '/' + TOTAL_CHAPTERS, 'errors', y.errorsOpen, y.logs.map(l => `${l.subject[0]}${l.hours}h:${l.chapter}`).join(', ')); }
// Cross-check against the app's own streak maths.
const logs = YEAR.flatMap(y => y.logs.map((l, i) => ({ id: `${y.day}-${i}`, date: new Date(Date.UTC(2026, 0, 2 + y.day - 1)).toISOString().slice(0, 10), subject: l.subject, hours: l.hours, quality: l.quality, distractions: l.distractions, source: l.source })));
console.log('app longestStreak', longestStreak(logs as any, '2027-01-01'), 'verified', longestVerifiedStreak(logs as any, '2027-01-01'));
console.log('pre-roll', PRE_ROLL);
