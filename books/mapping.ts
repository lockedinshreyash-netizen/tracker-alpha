/* ── Which pages are which chapter, guessed before anyone is asked ──
   Pure and tested. A file's outline (or the chapter headings found on its
   pages, books/pdf.ts headingsOf) is matched against the student's own
   syllabus with Learn's matcher (learn/discover/match.ts guessChapter), the
   one that files a searched lecture: half the chapter's words, five-letter
   stems, and a weak match files nothing. A wrong chapter is worse than none;
   the student confirms the map on one screen before it is saved. */

import { guessChapter, type ChapterRef } from '../learn/discover/match';
import { proposeSections, type BookSubject, type OutlineEntry, type Section } from './model';

export const keyOfRef = (r: ChapterRef): string => `${r.classId}|${r.subject}|${r.chapter}`;

/** Every syllabus chapter a file could be about, both classes, the student's subjects. */
export const chapterRefs = (
  subjects: BookSubject[],
  chaptersFor: (classId: 11 | 12, subject: BookSubject) => string[],
): ChapterRef[] =>
  ([11, 12] as const).flatMap(classId => subjects.flatMap(subject => chaptersFor(classId, subject).map(chapter => ({ classId, subject, chapter }))));

/* Headings like "CHAPTER TWO  MOTION IN A STRAIGHT LINE" lead with words the
   matcher would otherwise weigh; only what follows the number is the name. */
const HEAD = /\b(?:chapter|unit)\s+(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\b[\s.:–-]*([^\n]{3,90})(?:\n([^\n]{3,90}))?/i;

export const headingIn = (text: string): string | null => {
  const m = HEAD.exec(text);
  return m ? [m[1], m[2]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() : null;
};

export interface MapProposal {
  subject?: BookSubject;
  classId?: 11 | 12;
  sections: Section[];
}

/* Most pages decide the book's subject and class: a Class 11 Physics book may
   quote a Class 12 chapter in an appendix, and that should not file it there. */
const majority = (sections: Section[]): Pick<MapProposal, 'subject' | 'classId'> => {
  const weight = new Map<string, number>();
  for (const s of sections) {
    const [c, subj] = s.chapterKey.split('|');
    const k = `${c}|${subj}`;
    weight.set(k, (weight.get(k) ?? 0) + (s.to - s.from + 1));
  }
  const best = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!best) return {};
  const [c, subj] = best.split('|');
  return { classId: Number(c) as 11 | 12, subject: subj as BookSubject };
};

export const proposeMap = (
  facts: { pages: number; outline: OutlineEntry[]; firstText: string; title: string },
  refs: ChapterRef[],
): MapProposal => {
  const guess = (title: string) => {
    const r = guessChapter(headingIn(title) ?? title, refs);
    return r ? keyOfRef(r) : null;
  };
  const sections = proposeSections(facts.outline, facts.pages, guess);
  if (sections.length) return { sections, ...majority(sections) };

  // One chapter, perhaps: the heading on page 1, else the file's own title.
  const head = headingIn(facts.firstText);
  const key = (head && guess(head)) || guess(facts.title);
  if (!key) return { sections: [] };
  const one: Section[] = [{ from: 1, to: facts.pages, chapterKey: key }];
  return { sections: one, ...majority(one) };
};
