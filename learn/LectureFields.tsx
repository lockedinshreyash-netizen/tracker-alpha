/* ── The fields a lecture is filed by ──
   Shared by the add sheet and the edit sheet, so a case is filed the same way
   whichever door it came through: a subject from the student's exam, then a
   class and a chapter from their own syllabus (getChaptersFor, the list the
   Syllabus tab shows). */

import React, { useMemo } from 'react';
import { Chip, Field, Segmented, tokens } from '../ui/kit';
import { getChaptersFor, getCoreSubjects } from '../constants';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { LearnSubject } from './model';
import type { ExamPreference } from '../types';

const isLearnSubject = (s: string): s is LearnSubject => s === 'Physics' || s === 'Chemistry' || s === 'Maths' || s === 'Biology';

export const subjectsFor = (exam: ExamPreference): LearnSubject[] => getCoreSubjects(exam).filter(isLearnSubject);

export type ClassId = '11' | '12';

/** A stored chapter key's class and chapter, for an editor opening on it. */
export const splitChapterKey = (key: string | undefined, fallback: ClassId): { cls: ClassId; chapter: string } => {
  const [c, , chapter] = (key ?? '').split('|');
  return c === '11' || c === '12' ? { cls: c, chapter: chapter ?? '' } : { cls: fallback, chapter: '' };
};

interface SubjectProps {
  subjects: LearnSubject[];
  value: LearnSubject;
  onChange: (s: LearnSubject) => void;
  dark: boolean;
}

export const SubjectField = ({ subjects, value, onChange, dark }: SubjectProps) => (
  <Field label="Subject" dark={dark}>
    <div className="flex flex-wrap gap-2">
      {subjects.map(s => (
        <Chip key={s} on={value === s} dark={dark} color={SUBJECT_COLORS[s].dot} onClick={() => onChange(s)}>
          {s}
        </Chip>
      ))}
    </div>
  </Field>
);

interface ChapterProps {
  exam: ExamPreference;
  subject: LearnSubject;
  cls: ClassId;
  chapter: string;
  onClass: (c: ClassId) => void;
  onChapter: (c: string) => void;
  dark: boolean;
}

export const ChapterField = ({ exam, subject, cls, chapter, onClass, onChapter, dark }: ChapterProps) => {
  const t = tokens(dark);
  const chapters = useMemo(() => getChaptersFor(exam, Number(cls) as 11 | 12, subject), [exam, cls, subject]);
  // A chapter saved under another exam's list is still shown, so opening the editor never drops it.
  const options = chapter && !chapters.includes(chapter) ? [chapter, ...chapters] : chapters;
  return (
    <Field label="Chapter" dark={dark} hint="Optional">
      <div className="flex flex-col sm:flex-row gap-3">
        <Segmented
          value={cls}
          onChange={v => { onClass(v); onChapter(''); }}
          dark={dark}
          label="Class"
          options={[
            { value: '11', label: <span className="whitespace-nowrap">Class 11</span> },
            { value: '12', label: <span className="whitespace-nowrap">Class 12</span> },
          ]}
        />
        <select className={t.input} value={chapter} onChange={e => onChapter(e.target.value)} aria-label="Chapter">
          <option value="">No chapter</option>
          {options.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </Field>
  );
};
