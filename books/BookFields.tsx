/* ── What a book is: the fields, shared by adding and editing ──
   One form for both, like Learn's lecture fields. In the order a student
   thinks about a file: what it is called, what kind of thing it is, which
   subject, which chapters are in it, and what it looks like on the shelf.

   The chapter map has two shapes. Most files are one chapter (an NCERT
   chapter PDF, a DPP, a set of notes), so that is one picker. A whole book
   or module is a list of page ranges, proposed from the file before the
   sheet opens (books/mapping.ts) and only confirmed here. */

import React, { useMemo, useState } from 'react';
import { Chip, Field, Segmented, tokens, btn } from '../ui/kit';
import { getChaptersFor } from '../constants';
import { SUBJECT_COLORS } from '../schedule/colors';
import { ChapterField, subjectsFor, type ClassId } from '../learn/LectureFields';
import { Cover, COVER_DESIGNS, defaultDesign } from './Cover';
import {
  BOOK_KINDS, KIND_LABEL, addChapterAt, chapterOfKey, cleanSections,
  type BookCover, type BookKind, type BookSubject, type Section,
} from './model';
import type { ExamPreference } from '../types';

export interface Draft {
  title: string;
  kind: BookKind;
  subject?: BookSubject;
  classId: 11 | 12;
  sections: Section[];
  cover: BookCover;
}

interface Props {
  /** The book's id (or the id it will get), for its default cover. */
  id: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  pages: number;
  exam: ExamPreference;
  dark: boolean;
  thumb: string | null;
}

const SINGLE_KINDS: BookKind[] = ['dpp', 'notes'];

export const singleChapter = (d: Pick<Draft, 'sections' | 'kind'>, pages: number): boolean =>
  d.sections.length === 0 ? SINGLE_KINDS.includes(d.kind) || pages < 60 : d.sections.length === 1 && d.sections[0].from === 1 && d.sections[0].to === pages;

export const BookFields = ({ id, draft, onChange, pages, exam, dark, thumb }: Props) => {
  const t = tokens(dark);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const subjects = subjectsFor(exam) as BookSubject[];
  const [mode, setMode] = useState<'one' | 'pages'>(() => (singleChapter(draft, pages) ? 'one' : 'pages'));

  return (
    <div className="space-y-7">
      <Field label="Title" dark={dark}>
        <input
          className={t.input}
          value={draft.title}
          maxLength={160}
          onChange={e => set({ title: e.target.value })}
          placeholder="Physics Part 1"
          aria-label="Title"
        />
      </Field>

      <Field label="What is it?" dark={dark}>
        <div className="flex flex-wrap gap-2">
          {BOOK_KINDS.map(k => (
            <Chip key={k} on={draft.kind === k} dark={dark} onClick={() => set({ kind: k })}>{KIND_LABEL[k]}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Subject" dark={dark}>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <Chip
              key={s}
              on={draft.subject === s}
              dark={dark}
              color={SUBJECT_COLORS[s].dot}
              onClick={() => set({ subject: s, sections: draft.subject === s ? draft.sections : [] })}
            >
              {s}
            </Chip>
          ))}
          <Chip on={!draft.subject} dark={dark} onClick={() => set({ subject: undefined, sections: [] })}>None</Chip>
        </div>
      </Field>

      {draft.subject && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Chapters in this file</span>
            <Segmented
              value={mode}
              onChange={m => {
                setMode(m);
                // Going to one chapter keeps the first; going to pages keeps what there is.
                if (m === 'one' && draft.sections.length) set({ sections: [{ ...draft.sections[0], from: 1, to: pages }] });
              }}
              dark={dark}
              label="Chapters in this file"
              options={[{ value: 'one', label: 'One chapter' }, { value: 'pages', label: 'Several' }]}
            />
          </div>
          {mode === 'one' ? (
            <OneChapter draft={draft} pages={pages} exam={exam} dark={dark} onChange={set} />
          ) : (
            <PageMap draft={draft} pages={pages} exam={exam} dark={dark} onChange={set} />
          )}
        </div>
      )}

      <CoverPicker id={id} draft={draft} dark={dark} thumb={thumb} onChange={cover => set({ cover })} />
    </div>
  );
};

/* ── One chapter for the whole file ── */

const OneChapter = ({ draft, pages, exam, dark, onChange }: {
  draft: Draft; pages: number; exam: ExamPreference; dark: boolean; onChange: (p: Partial<Draft>) => void;
}) => {
  const current = draft.sections[0];
  const cls: ClassId = current ? (current.chapterKey.split('|')[0] as ClassId) : (String(draft.classId) as ClassId);
  const chapter = current ? chapterOfKey(current.chapterKey) : '';
  const put = (c: ClassId, ch: string) => onChange({
    classId: Number(c) as 11 | 12,
    sections: ch && draft.subject ? [{ from: 1, to: pages, chapterKey: `${c}|${draft.subject}|${ch}` }] : [],
  });
  return (
    <ChapterField
      exam={exam}
      subject={draft.subject!}
      cls={cls}
      chapter={chapter}
      onClass={c => put(c, '')}
      onChapter={ch => put(cls, ch)}
      dark={dark}
    />
  );
};

/* ── Page ranges for a whole book ── */

const PageMap = ({ draft, pages, exam, dark, onChange }: {
  draft: Draft; pages: number; exam: ExamPreference; dark: boolean; onChange: (p: Partial<Draft>) => void;
}) => {
  const t = tokens(dark);
  const subject = draft.subject!;
  const cls = draft.classId;
  const chapters = useMemo(() => getChaptersFor(exam, cls, subject), [exam, cls, subject]);
  const rows = draft.sections;
  const put = (next: Section[]) => onChange({ sections: next });
  const num = `${t.input} !w-[76px] text-center tabular-nums`;

  /* Adding by hand: a chapter and the page it starts on. It runs to the next
     chapter, and cuts short a chapter it lands inside (books/model.ts). */
  const used = new Set(rows.map(r => r.chapterKey));
  const [newChapter, setNewChapter] = useState('');
  const [newStart, setNewStart] = useState('');
  const start = Math.round(Number(newStart));
  const canAdd = !!newChapter && Number.isFinite(start) && start >= 1 && start <= pages;
  const add = () => {
    if (!canAdd) return;
    put(addChapterAt(rows, start, `${cls}|${subject}|${newChapter}`, pages));
    setNewChapter('');
    setNewStart('');
  };

  return (
    <div className="space-y-3">
      <Segmented
        value={String(cls) as ClassId}
        onChange={c => onChange({ classId: Number(c) as 11 | 12 })}
        dark={dark}
        label="Class"
        options={[{ value: '11', label: 'Class 11' }, { value: '12', label: 'Class 12' }]}
      />
      {rows.length === 0 && (
        <p className={`text-[13px] font-ui ${t.muted}`}>No chapters yet. Add each one below with the page it starts on. Or open the book, go to a chapter's first page, and add it from Contents.</p>
      )}
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const [rc, , name] = r.chapterKey.split('|');
          const options = getChaptersFor(exam, Number(rc) as 11 | 12, subject);
          const list = options.includes(name) ? options : [name, ...options];
          const edit = (patch: Partial<Section>) => {
            const next = rows.map((x, j) => (j === i ? { ...x, ...patch } : x));
            put(next);
          };
          return (
            <li key={`${r.chapterKey}-${i}`} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                className={`${t.input} sm:flex-1 min-w-0`}
                value={name}
                onChange={e => edit({ chapterKey: `${rc}|${subject}|${e.target.value}` })}
                aria-label={`Chapter ${i + 1}`}
              >
                {list.map(c => <option key={c} value={c}>{rc !== String(cls) ? `${c} (Class ${rc})` : c}</option>)}
              </select>
              <span className="flex items-center gap-2">
                <span className={`text-[11px] font-ui ${t.faint}`}>p.</span>
                <input
                  type="number" inputMode="numeric" min={1} max={pages} className={num} value={r.from}
                  onChange={e => edit({ from: Number(e.target.value) || 1 })}
                  onBlur={() => put(cleanSections(rows, pages))}
                  aria-label={`Chapter ${i + 1} first page`}
                />
                <span className={t.faint}>–</span>
                <input
                  type="number" inputMode="numeric" min={1} max={pages} className={num} value={r.to}
                  onChange={e => edit({ to: Number(e.target.value) || 1 })}
                  onBlur={() => put(cleanSections(rows, pages))}
                  aria-label={`Chapter ${i + 1} last page`}
                />
                <button
                  type="button"
                  onClick={() => put(rows.filter((_, j) => j !== i))}
                  className={`h-9 w-9 rounded-lg ${t.ghost}`}
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className={`rounded-lg border p-3 space-y-2 ${t.inset}`}>
        <span className={`block text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Add a chapter</span>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <select className={`${t.input} sm:flex-1 min-w-0`} value={newChapter} onChange={e => setNewChapter(e.target.value)} aria-label="Chapter to add">
            <option value="">Choose the chapter</option>
            {chapters.map(c => <option key={c} value={c}>{c}{used.has(`${cls}|${subject}|${c}`) ? ' · already added' : ''}</option>)}
          </select>
          <span className="flex items-center gap-2">
            <span className={`text-[11px] font-ui whitespace-nowrap ${t.faint}`}>starts on p.</span>
            <input
              type="number" inputMode="numeric" min={1} max={pages} className={num} value={newStart} placeholder="1"
              onChange={e => setNewStart(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              aria-label="Page the chapter starts on"
            />
            <button type="button" onClick={add} disabled={!canAdd} className={`${btn} h-10 px-4 ${t.primary}`}>Add</button>
          </span>
        </div>
      </div>
      <p className={`text-[11px] font-ui ${t.faint}`}>{pages} pages in this file.</p>
    </div>
  );
};

/* ── The cover ── */

const CoverPicker = ({ id, draft, dark, thumb, onChange }: {
  id: string; draft: Draft; dark: boolean; thumb: string | null; onChange: (c: BookCover) => void;
}) => {
  const t = tokens(dark);
  const chosen = draft.cover.firstPage ? 'first' : (COVER_DESIGNS.includes(draft.cover.design) ? draft.cover.design : defaultDesign(id, draft.subject));
  const kicker = draft.sections.length === 1
    ? chapterOfKey(draft.sections[0].chapterKey)
    : draft.subject ? `Class ${draft.classId} · ${draft.subject}` : null;
  return (
    <Field label="Cover" dark={dark} hint={<span className="inline-flex"><Segmented
      value={draft.cover.finish}
      onChange={finish => onChange({ ...draft.cover, finish })}
      dark={dark}
      label="Finish"
      options={[{ value: 'ink', label: 'Ink' }, { value: 'paper', label: 'Paper' }]}
    /></span>}>
      <div className="flex gap-5 items-start">
        <div className="hidden sm:block shrink-0">
          <Cover id={id} title={draft.title || 'Untitled'} kind={draft.kind} subject={draft.subject} cover={draft.cover} width={150} kicker={kicker} thumb={thumb} />
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5 max-h-[300px] overflow-y-auto p-1 -m-1 flex-1">
          {thumb && (
            <button
              type="button"
              onClick={() => onChange({ ...draft.cover, firstPage: true })}
              className={`bk-swatch ${chosen === 'first' ? 'is-on' : ''}`}
              aria-pressed={chosen === 'first'}
              title="The file's first page"
            >
              <Cover id={id} title="" kind="other" subject={draft.subject} cover={{ ...draft.cover, firstPage: true }} width={52} thumb={thumb} />
            </button>
          )}
          {COVER_DESIGNS.map(design => (
            <button
              key={design}
              type="button"
              onClick={() => onChange({ design, finish: draft.cover.finish })}
              className={`bk-swatch ${chosen === design ? 'is-on' : ''}`}
              aria-pressed={chosen === design}
              title={design.replace('-', ' · ')}
            >
              <Cover id={id} title="" kind="other" subject={draft.subject} cover={{ design, finish: draft.cover.finish }} width={52} />
            </button>
          ))}
        </div>
      </div>
      <p className={`mt-3 text-[11px] font-ui ${t.faint}`}>Thirty designs, coloured by subject. Or use the file's first page.</p>
    </Field>
  );
};
