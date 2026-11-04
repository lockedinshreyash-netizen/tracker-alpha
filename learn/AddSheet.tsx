/* ── Putting a lecture on the shelf ──
   Paste a link, name it, file it. The link is read on the device (video/
   model.ts): Shorts and playlists are refused with a line that says why, and
   nothing is sent anywhere, not even to YouTube, so the title is the
   student's own. (Discover will prefill YouTube's.)

   Subject first, then class and chapter from the student's own syllabus, so
   a case is always filed somewhere real. A video already on the shelf is not
   added twice: the sheet says which case it is and opens it. */

import React, { useMemo, useState } from 'react';
import { Field, Sheet, btn, tokens } from '../ui/kit';
import { REFUSAL_COPY, parseVideoLink } from '../video/model';
import { LIMITS, chapterKeyOf, codeOf, live, type LearnSubject } from './model';
import { ChapterField, SubjectField, subjectsFor, type ClassId } from './LectureFields';
import type { LearnStore } from './store';
import type { ExamPreference } from '../types';

interface Props {
  store: LearnStore;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  onClose: () => void;
  onAdded: (id: string) => void;
  onOpenExisting: (id: string) => void;
  /** A chapter key (`11|Physics|Rotational Motion`) to file under, from a chapter's own shelf. */
  preset?: string;
}

export default function AddSheet({ store, dark, examPreference, currentClass, onClose, onAdded, onOpenExisting, preset }: Props) {
  const t = tokens(dark);
  const subjects = useMemo(() => subjectsFor(examPreference), [examPreference]);
  const start = useMemo(() => {
    const [c, s, ch] = (preset ?? '').split('|');
    const subject = subjects.find(x => x === s);
    return subject && (c === '11' || c === '12') && ch ? { subject, cls: c as ClassId, chapter: ch } : null;
  }, [preset, subjects]);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<LearnSubject>(start?.subject ?? subjects[0] ?? 'Physics');
  const [cls, setCls] = useState<ClassId>(start?.cls ?? (String(currentClass) as ClassId));
  const [chapter, setChapter] = useState(start?.chapter ?? '');
  const [topic, setTopic] = useState('');
  const [touched, setTouched] = useState(false);

  const parsed = parseVideoLink(link);
  const existing = parsed.ok ? live(store.getLibrary().lectures).find(l => l.videoId === parsed.id) : undefined;
  const ready = parsed.ok && !existing && title.trim().length > 0;

  const submit = () => {
    setTouched(true);
    if (!ready || !parsed.ok) return;
    const res = store.addLecture({
      videoId: parsed.id,
      title: title.trim(),
      titleSource: 'student',
      subject,
      chapterKey: chapter ? chapterKeyOf(Number(cls) as 11 | 12, subject, chapter) : undefined,
      topic: topic.trim() || undefined,
    });
    if (res.duplicate) onOpenExisting(res.lecture.id);
    else onAdded(res.lecture.id);
  };

  const linkNote = (() => {
    if (!link.trim()) return null;
    if (!parsed.ok) return parsed.reason === 'empty' ? null : REFUSAL_COPY[parsed.reason];
    if (existing) return null;
    return 'A YouTube video. Good.';
  })();

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label="Add a lecture"
      header={
        <div className="px-5 md:px-7 py-5">
          <h2 className={`font-display text-2xl ${t.heading}`}>Add a lecture</h2>
          <p className={`text-[13px] font-ui mt-1 ${t.muted}`}>It goes on your shelf with its own number.</p>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className={`${btn} h-11 px-5 ${t.ghost}`}>Cancel</button>
          <button type="button" onClick={submit} disabled={!ready} className={`${btn} h-11 px-5 ${t.primary}`}>Add to shelf</button>
        </div>
      }
    >
      <form
        className="px-5 md:px-7 py-6 space-y-6"
        onSubmit={e => { e.preventDefault(); submit(); }}
      >
        <Field label="YouTube link" dark={dark}>
          <input
            className={t.input}
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://youtu.be/…"
            aria-label="YouTube link"
            inputMode="url"
            autoComplete="off"
            autoFocus
          />
          {linkNote && <p className={`text-[12px] font-ui mt-2 ${parsed.ok ? t.faint : t.body}`}>{linkNote}</p>}
          {existing && (
            <p className={`text-[12px] font-ui mt-2 ${t.body}`}>
              Already on your shelf as {codeOf(existing)}.{' '}
              <button type="button" className="underline underline-offset-2 font-bold" onClick={() => onOpenExisting(existing.id)}>Open it</button>
            </p>
          )}
        </Field>

        <Field label="Title" dark={dark} hint={`${title.length}/${LIMITS.title}`}>
          <input
            className={t.input}
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, LIMITS.title))}
            placeholder="What's this lecture?"
            aria-label="Title"
          />
          {touched && !title.trim() && <p className={`text-[12px] font-ui mt-2 ${t.body}`}>Give it a name. It goes on the case.</p>}
        </Field>

        <SubjectField subjects={subjects} value={subject} onChange={s => { setSubject(s); setChapter(''); }} dark={dark} />
        <ChapterField exam={examPreference} subject={subject} cls={cls} chapter={chapter} onClass={setCls} onChapter={setChapter} dark={dark} />

        <Field label="Topic" dark={dark} hint="Optional">
          <input
            className={t.input}
            value={topic}
            onChange={e => setTopic(e.target.value.slice(0, LIMITS.topic))}
            placeholder="e.g. Moment of inertia"
            aria-label="Topic"
          />
        </Field>
        {/* Enter in any field adds; the visible button is the sheet's footer. */}
        <button type="submit" className="sr-only" tabIndex={-1}>Add to shelf</button>
      </form>
    </Sheet>
  );
}
