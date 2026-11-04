/* ── Which chapter a search is about ──
   Pure and tested (`npm run test:learn`). A search typed into the spotlight
   ("rotational motion one shot") is matched against the student's own
   syllabus chapters on the device, so a lecture added from it lands filed
   under "System of Particles & Rotational Motion" without a question being
   asked. Nothing leaves the device for this. A weak match files nothing: a
   wrong chapter is worse than none, and the toast offers to set one. */

import type { LearnSubject } from '../model';
import type { ExamPreference } from '../../types';

export interface ChapterRef {
  classId: 11 | 12;
  subject: LearnSubject;
  chapter: string;
}

/* Words that say how a lecture is made, not what it is about. */
const STOP = new Set([
  'jee', 'neet', 'main', 'mains', 'advanced', 'lecture', 'lectures', 'class', 'one', 'shot', 'oneshot', 'chapter', 'full',
  'complete', 'the', 'of', 'and', 'in', 'a', 'an', 'to', 'for', 'part', 'revision', 'pyq', 'pyqs', 'questions', 'problems',
  'concept', 'concepts', 'notes', 'video', 'by', 'with', 'from', 'zero', 'live', '11', '12', '11th', '12th', 'cbse', 'ncert',
  '2025', '2026', '2027', '2028', 'all', 'basics', 'lec', 'l1', 'l2', 'l3', 'marathon', 'crash', 'course',
]);

export const words = (s: string): string[] =>
  s.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w));

/* "rotation" and "rotational", "thermodynamic" and "thermodynamics" are the
   same word to a student; a shared start of five letters is enough. */
const same = (a: string, b: string): boolean =>
  a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) && b.startsWith(a.slice(0, 5))));

/** The chapter a search names, when at least half of the chapter's own words appear in it. */
export const guessChapter = (query: string, chapters: ChapterRef[]): ChapterRef | null => {
  const q = words(query);
  if (!q.length) return null;
  let best: { ref: ChapterRef; score: number; hits: number } | null = null;
  for (const ref of chapters) {
    const c = words(ref.chapter);
    if (!c.length) continue;
    const hits = c.filter(w => q.some(x => same(x, w))).length;
    if (!hits) continue;
    const score = hits / c.length;
    if (score >= 0.5 && (!best || score > best.score || (score === best.score && hits > best.hits))) best = { ref, score, hits };
  }
  return best?.ref ?? null;
};

/** What Discover searches for a chapter, before the student edits it. */
export const chapterQuery = (chapter: string, exam: ExamPreference): string =>
  `${chapter.replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ').trim()} ${exam === 'NEET' ? 'NEET' : 'JEE'} lecture`;

/** "1:02:05" from seconds, for a duration chip. */
export const durationLabel = (s: number | null): string => {
  if (s === null || !Number.isFinite(s)) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
