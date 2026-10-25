/* ── Your exams ──
   Settings → Exam. Three questions, top to bottom: which stream (Engineering
   or Medical, the stream that decides subjects and syllabus), which exams you
   are writing in it, and the year. Opened from the Exam row (ExamRow), saved
   with one press.

   Exams are a set with one main exam. Tapping an exam adds or removes it; the
   main one is the first you pick, and any other can be made main. The main
   exam is the one the countdown counts to; every exam in the set is listed
   under it. JEE Advanced brings JEE Main along, because only Main qualifiers
   sit Advanced. Changing stream keeps the year and starts the set again from
   that stream's national exam: an exam cannot belong to a stream it is not
   written in. */

import React, { useState } from 'react';
import { Card, Segmented, Sheet, Switch, btn, tokens } from '../ui/kit';
import { ExamChip } from './ExamChip';
import {
  MAX_ALSO, STREAM_LABEL, defaultExam, examById, examDateFor, examsIn, normalizeTarget, targetExams, targetLabel, yearChoices,
  type ExamId, type ExamTarget, type Stream,
} from '../content/exams';
import { getDaysRemaining } from '../utils';

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
);

/* ── The choice being made ──
   Shared by the Settings sheet and the one-time launch modal (ExamLaunch.tsx):
   the same three questions, the same rules, one place. */

export interface ExamDraft {
  stream: Stream;
  picked: ExamId[];
  year: number;
  full: boolean;
  changeStream: (s: Stream) => void;
  toggle: (id: ExamId) => void;
  makeMain: (id: ExamId) => void;
  setYear: (y: number) => void;
  /** The draft as a target, made whole for its stream. */
  result: (cls: 11 | 12) => ExamTarget;
}

export const useExamDraft = (stream0: Stream, target0: ExamTarget): ExamDraft => {
  const [stream, setStream] = useState<Stream>(stream0);
  const [picked, setPicked] = useState<ExamId[]>(targetExams(target0));
  const [year, setYear] = useState(target0.year);
  const full = picked.length >= MAX_ALSO + 1;

  const changeStream = (s: Stream) => {
    if (s === stream) return;
    setStream(s);
    setPicked([defaultExam(s)]);
  };

  const toggle = (id: ExamId) => setPicked(list => {
    if (list.includes(id)) {
      if (list.length === 1) return list; // there is always a main exam
      // Main cannot be removed while Advanced still needs it.
      if (list.some(x => x !== id && examById(x).requires === id)) return list;
      return list.filter(x => x !== id);
    }
    if (list.length >= MAX_ALSO + 1) return list;
    const need = examById(id).requires;
    return need && !list.includes(need) ? [...list, need, id] : [...list, id];
  });

  const makeMain = (id: ExamId) => setPicked(list => [id, ...list.filter(x => x !== id)]);

  const result = (cls: 11 | 12) => normalizeTarget({ primary: picked[0], also: picked.slice(1), year }, stream, cls);

  return { stream, picked, year, full, changeStream, toggle, makeMain, setYear, result };
};

/** "Jan 2027", the month an exam is held (or expected) in the chosen year. */
const monthOf = (d: Date) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);

/** Stream, exams and year, top to bottom. Each exam says when it is in the chosen year. */
export const ExamFields = ({ dark, draft }: { dark: boolean; draft: ExamDraft }) => {
  const t = tokens(dark);
  const { stream, picked, year, full, changeStream, toggle, makeMain, setYear } = draft;
  return (
    <div className="space-y-7 font-ui">
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-3 ${t.faint}`}>Stream</p>
        <Segmented
          full
          value={stream}
          onChange={changeStream}
          dark={dark}
          label="Stream"
          options={(['PCM', 'PCB'] as Stream[]).map(s => ({ value: s, label: STREAM_LABEL[s].title, hint: STREAM_LABEL[s].sub }))}
        />
        <p className={`text-[12px] mt-2 ${t.muted}`}>{STREAM_LABEL[stream].sub}. Your other stream's progress stays saved.</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${t.faint}`}>Exams</p>
          <p className={`text-[11px] ${t.faint}`}>Up to {MAX_ALSO + 1}</p>
        </div>
        <ul className="space-y-2">
          {examsIn(stream).map(e => {
            const on = picked.includes(e.id);
            const main = picked[0] === e.id;
            const blocked = !on && full;
            const when = examDateFor(e.id, year);
            return (
              <li key={e.id}>
                <div className={`flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors ${on
                  ? dark ? 'bg-white/[0.06] ring-1 ring-inset ring-white/[0.14]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-300'
                  : dark ? 'ring-1 ring-inset ring-white/[0.07]' : 'ring-1 ring-inset ring-zinc-200'} ${blocked ? 'opacity-45' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    disabled={blocked}
                    aria-pressed={on}
                    aria-label={`${e.name}${main ? ', main exam' : ''}, ${when.official ? '' : 'expected '}${monthOf(when.date)}`}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? (dark ? 'bg-white text-black' : 'bg-zinc-900 text-white') : dark ? 'ring-1 ring-inset ring-white/20' : 'ring-1 ring-inset ring-zinc-300'}`}>
                      {on && <Check />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[14px] font-bold ${t.heading}`}>{e.name}</span>
                      <span className={`block text-[12px] truncate ${t.muted}`}>
                        {when.official ? '' : 'Expected '}{monthOf(when.date)} · {e.body}{e.requires ? ` · needs ${examById(e.requires).name}` : ''}{e.extra ? ` · also ${e.extra.join(', ')}` : ''}
                      </span>
                    </span>
                  </button>
                  {main ? (
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>Main</span>
                  ) : on ? (
                    <button type="button" onClick={() => makeMain(e.id)} className={`shrink-0 text-[12px] font-semibold underline underline-offset-2 ${t.muted}`}>Make main</button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div role="radiogroup" aria-label="Year">
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-3 ${t.faint}`}>Year you write them</p>
        <div className="grid grid-cols-4 gap-2">
          {yearChoices().map(y => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={year === y}
              onClick={() => setYear(y)}
              className={`h-11 rounded-xl text-[14px] font-bold transition-colors ${year === y
                ? dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                : dark ? 'text-zinc-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.04]' : 'text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SheetProps {
  dark: boolean;
  stream: Stream;
  target: ExamTarget;
  cls: 11 | 12;
  onClose: () => void;
  onSave: (stream: Stream, target: ExamTarget) => void;
}

export const ExamSheet = ({ dark, stream: stream0, target: target0, cls, onClose, onSave }: SheetProps) => {
  const t = tokens(dark);
  const draft = useExamDraft(stream0, target0);

  const save = () => {
    onSave(draft.stream, draft.result(cls));
    onClose();
  };

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label="Your exams"
      width="md:w-[520px]"
      header={
        <div className="px-5 md:px-7 py-4">
          <p className={`font-display text-[20px] ${t.heading}`}>Your exams</p>
          <p className={`text-[12px] mt-0.5 ${t.muted}`}>Pick every exam you're writing. The countdown follows your main one.</p>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${btn} px-5 py-3 ${t.ghost}`}>Cancel</button>
          <button onClick={save} className={`${btn} px-6 py-3 ${t.primary}`}>Save</button>
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6">
        <ExamFields dark={dark} draft={draft} />
      </div>
    </Sheet>
  );
};

interface RowProps {
  dark: boolean;
  delay: number;
  stream: Stream;
  target: ExamTarget;
  cls: 11 | 12;
  onChange: (stream: Stream, target: ExamTarget) => void;
  showExam: boolean;
  onShowExam: (on: boolean) => void;
  /** The chip is only ever seen by others when there is an account. */
  signedIn: boolean;
}

/** The Exam row in Review / Profile: what you are writing, Change, and whether others see it. */
export const ExamRow = ({ dark, delay, stream, target, cls, onChange, showExam, onShowExam, signedIn }: RowProps) => {
  const t = tokens(dark);
  const [open, setOpen] = useState(false);
  const main = examDateFor(target.primary, target.year);
  const days = Math.max(0, getDaysRemaining(main.date));
  const others = target.also.map(id => examById(id).short).join(', ');
  return (
    <>
      <Card dark={dark} delay={delay} className="p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className={`text-[15px] font-ui font-bold ${t.heading}`}>Exam</p>
            <div className={`text-[13px] font-ui mt-1 ${t.muted}`}>
              <b className={t.heading}>{targetLabel(target.primary, target.year)}</b>
              {others ? <> · also {others}</> : null}
              {' · '}{STREAM_LABEL[stream].title}. {days} {days === 1 ? 'day' : 'days'} to go{main.official ? '' : ', expected'}.
            </div>
          </div>
          <button onClick={() => setOpen(true)} className={`${btn} px-5 py-3 ${t.ghost} shrink-0`}>Change</button>
        </div>
        <div className={`flex items-center justify-between gap-4 mt-5 pt-5 border-t ${t.rule}`}>
          <div className="min-w-0">
            <p className={`text-[13px] font-ui font-semibold flex flex-wrap items-center gap-2 ${t.heading}`}>
              Show my exam on my profile <ExamChip exam={target.primary} year={target.year} dark={dark} />
            </p>
            <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>
              {signedIn
                ? showExam ? 'Others see this next to your name in Ranks and Groups.' : 'Hidden. Others see your name without it.'
                : 'Others see it next to your name in Ranks and Groups once you sign in.'}
            </p>
          </div>
          <Switch dark={dark} on={showExam} onToggle={onShowExam} label="Show my exam on my profile" />
        </div>
      </Card>
      {open && <ExamSheet dark={dark} stream={stream} target={target} cls={cls} onClose={() => setOpen(false)} onSave={onChange} />}
    </>
  );
};
