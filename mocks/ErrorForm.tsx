/* ── Add an error ──
   One clean form, in the order a student actually thinks about a wrong
   answer: the question, its four options, which was right, why it went
   wrong, where it lives. Numbered so the order reads at a glance, and
   "Save & add another" keeps the chapter so logging five questions from one
   mock is five questions, not five chapter pickers. */

import React, { useEffect, useRef, useState } from 'react';
import { ErrorEntry, ErrorReason, ExamPreference, MockChapter, Subject } from '../types';
import { SingleChapterPicker, TopicChips } from './ChapterPicker';
import { OPTION_LETTERS, REASONS, REASON_ORDER } from './model';
import { Sheet, btn, subjectDot, tokens } from './ui';

export interface ErrorDraft {
  id?: string;
  question: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3 | null;
  reason: ErrorReason | null;
  why: string;
  chapter: Pick<MockChapter, 'classId' | 'subject' | 'chapter'> | null;
  topic: string;
  mockId?: string;
}

export const emptyDraft = (seed?: Partial<ErrorDraft>): ErrorDraft => ({
  question: '', options: ['', '', '', ''], correct: null, reason: null, why: '', chapter: null, topic: '', ...seed,
});

export const draftFrom = (e: ErrorEntry): ErrorDraft => ({
  id: e.id, question: e.question, options: [...e.options] as ErrorDraft['options'], correct: e.correct, reason: e.reason,
  why: e.why ?? '', chapter: { classId: e.classId, subject: e.subject, chapter: e.chapter }, topic: e.topic ?? '', mockId: e.mockId,
});

interface Props {
  initial: ErrorDraft;
  pref: ExamPreference;
  subjects: Subject[];
  suggestedChapters: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>[];
  library: Record<string, string[]>;
  mockName?: string;
  dark: boolean;
  onSave: (draft: ErrorDraft, again: boolean) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  onAddTopic: (key: string, name: string) => void;
  onForgetTopic: (key: string, name: string) => void;
}

const Step: React.FC<{ n: number; title: string; hint?: string; done: boolean; dark: boolean; children: React.ReactNode }> = ({ n, title, hint, done, dark, children }) => {
  const t = tokens(dark);
  return (
    <section className="relative pl-10">
      <span className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-ui font-black transition-all ${done ? 'bg-[#E10600] text-white' : dark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
        {done ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg> : n}
      </span>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h3 className={`text-[13px] font-ui font-bold ${t.heading}`}>{title}</h3>
        {hint && <span className={`text-[11px] font-ui ${t.faint}`}>{hint}</span>}
      </div>
      {children}
    </section>
  );
};

const ErrorForm: React.FC<Props> = ({ initial, pref, subjects, suggestedChapters, library, mockName, dark, onSave, onDelete, onClose, onAddTopic, onForgetTopic }) => {
  const t = tokens(dark);
  const [d, setD] = useState<ErrorDraft>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qRef = useRef<HTMLTextAreaElement>(null);
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (p: Partial<ErrorDraft>) => setD(prev => ({ ...prev, ...p }));

  useEffect(() => { setD(initial); setConfirmDelete(false); qRef.current?.focus(); }, [initial]);
  useEffect(() => {
    const el = qRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [d.question]);

  const filled = {
    question: d.question.trim().length > 0,
    options: d.options.every(o => o.trim()),
    correct: d.correct !== null,
    reason: d.reason !== null,
    chapter: d.chapter !== null,
  };
  const ready = Object.values(filled).every(Boolean);
  const missing = !filled.question ? 'Type the question.' : !filled.options ? 'Fill all four options.' : !filled.correct ? 'Mark the right answer.' : !filled.reason ? 'Say why you got it wrong.' : !filled.chapter ? 'Pick the chapter.' : '';

  const setOption = (i: number, v: string) => {
    const options = [...d.options] as ErrorDraft['options'];
    options[i] = v;
    set({ options });
  };

  const header = (
    <div className="px-5 md:px-7 pt-6 pb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>Error notebook</p>
        <p className={`font-display text-[22px] leading-tight mt-1.5 ${t.heading}`}>{d.id ? 'Edit error' : 'Add an error'}</p>
        {mockName && <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>From {mockName}</p>}
      </div>
      <button onClick={onClose} aria-label="Close" className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2.5">
      {d.id && onDelete && (
        confirmDelete
          ? <button onClick={() => onDelete(d.id!)} className={`${btn} px-3 py-3 text-[#E10600]`}>Delete for good</button>
          : <button onClick={() => setConfirmDelete(true)} className={`${btn} px-3 py-3 ${t.muted} hover:text-[#E10600]`}>Delete</button>
      )}
      <span className={`flex-1 text-[11px] font-ui ${t.muted} hidden sm:block truncate`}>{missing}</span>
      {!d.id && (
        <button onClick={() => onSave(d, true)} disabled={!ready} className={`${btn} px-4 py-3.5 ml-auto ${t.ghost}`}>Save & add another</button>
      )}
      <button onClick={() => onSave(d, false)} disabled={!ready} className={`${btn} px-5 py-3.5 ${d.id ? 'ml-auto' : ''} ${t.primary}`}>Save</button>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={onClose} label={d.id ? 'Edit error' : 'Add an error'} header={header} footer={footer} width="md:w-[580px]">
      <div className="px-5 md:px-7 py-6 space-y-8">
        <Step n={1} title="Question" done={filled.question} dark={dark}>
          <textarea
            ref={qRef}
            value={d.question}
            onChange={e => set({ question: e.target.value })}
            maxLength={1500}
            rows={3}
            placeholder="Type the question. Describe any figure in a line — “Block on 30° incline, μ = 0.2…”"
            className={`${t.input} resize-none leading-relaxed`}
          />
        </Step>

        <Step n={2} title="Options" done={filled.options} dark={dark}>
          <div className="space-y-2">
            {d.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-ui font-black ${d.correct === i ? 'bg-emerald-500 text-white' : dark ? 'bg-white/[0.05] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>{OPTION_LETTERS[i]}</span>
                <input
                  ref={el => { optRefs.current[i] = el; }}
                  value={o}
                  onChange={e => setOption(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); optRefs.current[i + 1]?.focus(); } }}
                  maxLength={300}
                  placeholder={`Option ${OPTION_LETTERS[i]}`}
                  className={t.input}
                />
              </div>
            ))}
          </div>
        </Step>

        <Step n={3} title="Correct option" done={filled.correct} dark={dark}>
          <div className="grid grid-cols-4 gap-2">
            {OPTION_LETTERS.map((L, i) => {
              const on = d.correct === i;
              return (
                <button
                  key={L}
                  type="button"
                  onClick={() => set({ correct: i as 0 | 1 | 2 | 3 })}
                  aria-pressed={on}
                  className={`py-3 rounded-xl border text-[15px] font-ui font-black transition-all active:scale-95 ${on ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_6px_20px_-8px_rgba(16,185,129,0.7)]' : dark ? 'border-white/[0.08] text-zinc-300 hover:border-white/[0.2]' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}
                >
                  {L}
                </button>
              );
            })}
          </div>
          {d.correct !== null && d.options[d.correct].trim() && (
            <p className={`text-[12px] font-ui mt-2 truncate ${t.muted}`}>Answer: <span className={t.heading}>{d.options[d.correct]}</span></p>
          )}
        </Step>

        <Step n={4} title="Why did I get it wrong?" done={filled.reason} dark={dark}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {REASON_ORDER.map(r => {
              const on = d.reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set({ reason: r })}
                  aria-pressed={on}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] ${on ? (dark ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-900') : dark ? 'border-white/[0.08] hover:border-white/[0.16]' : 'border-zinc-200 hover:border-zinc-300'}`}
                >
                  <span className={`block text-[12px] font-ui font-bold ${on ? '' : t.heading}`}>{REASONS[r].label}</span>
                  <span className={`block text-[10px] font-ui mt-0.5 ${on ? 'opacity-70' : t.muted}`}>{REASONS[r].hint}</span>
                </button>
              );
            })}
          </div>
          <textarea
            value={d.why}
            onChange={e => set({ why: e.target.value })}
            maxLength={600}
            rows={2}
            placeholder="What will you remember next time? (optional)"
            className={`${t.input} resize-none mt-2.5`}
          />
        </Step>

        <Step n={5} title="Chapter" done={filled.chapter} dark={dark}>
          <SingleChapterPicker
            subjects={subjects}
            pref={pref}
            value={d.chapter}
            onChange={chapter => set({ chapter, topic: '' })}
            suggested={suggestedChapters}
            dark={dark}
          />
        </Step>

        <Step n={6} title="Topic" hint="Optional" done={!!d.topic} dark={dark}>
          {d.chapter ? (
            <TopicChips
              single
              chapter={d.chapter}
              selected={d.topic ? [d.topic] : []}
              onToggle={name => set({ topic: d.topic === name ? '' : name })}
              library={library}
              onAddTopic={onAddTopic}
              onForgetTopic={(k, name) => { onForgetTopic(k, name); if (d.topic === name) set({ topic: '' }); }}
              dark={dark}
            />
          ) : (
            <p className={`text-[12px] font-ui ${t.faint}`}>Pick a chapter first.</p>
          )}
        </Step>

        {d.chapter && (
          <div className={`flex items-center gap-2 text-[11px] font-ui ${t.muted}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(d.chapter.subject) }} />
            Goes into your <b className={t.heading}>{d.chapter.chapter}</b> test{d.topic ? ` · ${d.topic}` : ''}.
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default ErrorForm;
