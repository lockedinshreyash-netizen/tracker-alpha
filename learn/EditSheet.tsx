/* ── Editing a case ──
   Title, subject, chapter, topic. Changing the title makes it the student's
   (model.ts updateLecture): a YouTube title they rewrote is never refreshed
   over. Moving a lecture to another subject gives it a number in that
   subject, and the sheet says so before it happens, because the number on
   the case is how the student finds it. */

import React, { useMemo, useState } from 'react';
import { Field, Sheet, btn, tokens } from '../ui/kit';
import { LIMITS, chapterKeyOf, codeOf, nextCode, type LearnSubject, type Lecture } from './model';
import { ChapterField, SubjectField, splitChapterKey, subjectsFor, type ClassId } from './LectureFields';
import type { LearnStore } from './store';
import type { ExamPreference } from '../types';

interface Props {
  store: LearnStore;
  lecture: Lecture;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  onClose: () => void;
}

export default function EditSheet({ store, lecture, dark, examPreference, currentClass, onClose }: Props) {
  const t = tokens(dark);
  const start = splitChapterKey(lecture.chapterKey, String(currentClass) as ClassId);
  const subjects = useMemo(() => {
    const list = subjectsFor(examPreference);
    return list.includes(lecture.subject) ? list : [lecture.subject, ...list];
  }, [examPreference, lecture.subject]);
  const [title, setTitle] = useState(lecture.title);
  const [subject, setSubject] = useState<LearnSubject>(lecture.subject);
  const [cls, setCls] = useState<ClassId>(start.cls);
  const [chapter, setChapter] = useState(start.chapter);
  const [topic, setTopic] = useState(lecture.topic ?? '');

  const moving = subject !== lecture.subject;
  const newCode = moving ? nextCode(store.getLibrary(), subject) : codeOf(lecture);
  const ready = title.trim().length > 0;

  const save = () => {
    if (!ready) return;
    store.updateLecture(lecture.id, {
      title: title.trim(),
      subject,
      chapterKey: chapter ? chapterKeyOf(Number(cls) as 11 | 12, subject, chapter) : null,
      topic: topic.trim() || null,
    });
    onClose();
  };

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label={`Edit ${codeOf(lecture)}`}
      header={
        <div className="px-5 md:px-7 py-5">
          <h2 className={`font-display text-2xl ${t.heading}`}>Edit {codeOf(lecture)}</h2>
          <p className={`text-[13px] font-ui mt-1 ${t.muted}`}>
            {moving ? `Moving it to ${subject} files it as ${newCode}. ${codeOf(lecture)} is retired.` : 'Same case, same number.'}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className={`${btn} h-11 px-5 ${t.ghost}`}>Cancel</button>
          <button type="button" onClick={save} disabled={!ready} className={`${btn} h-11 px-5 ${t.primary}`}>Save</button>
        </div>
      }
    >
      <form className="px-5 md:px-7 py-6 space-y-6" onSubmit={e => { e.preventDefault(); save(); }}>
        <Field label="Title" dark={dark} hint={`${title.length}/${LIMITS.title}`}>
          <input className={t.input} value={title} onChange={e => setTitle(e.target.value.slice(0, LIMITS.title))} aria-label="Title" autoFocus />
        </Field>
        <SubjectField subjects={subjects} value={subject} onChange={s => { setSubject(s); setChapter(''); }} dark={dark} />
        <ChapterField exam={examPreference} subject={subject} cls={cls} chapter={chapter} onClass={setCls} onChapter={setChapter} dark={dark} />
        <Field label="Topic" dark={dark} hint="Optional">
          <input className={t.input} value={topic} onChange={e => setTopic(e.target.value.slice(0, LIMITS.topic))} aria-label="Topic" />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Sheet>
  );
}
