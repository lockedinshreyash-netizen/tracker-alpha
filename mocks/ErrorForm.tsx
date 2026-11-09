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
import { QFigures, QText, answerOf } from './QText';
import { parsePastedQuestion } from './paste';
import { imageFrom, saveErrorImage } from './images';
import ErrorImage from './ErrorImage';

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
  /** A pasted picture of the question (mocks/images.ts). */
  image?: string;
  /** Where in a book it came from (a snip or a highlight, books/). */
  source?: ErrorEntry['source'];
  /* An error from a CBT paper: its question and answer come from the bank and
     are shown, not edited — retyping LaTeX by hand would only break it. */
  bank?: Pick<ErrorEntry, 'qbankId' | 'figures' | 'numeric'>;
}

export const emptyDraft = (seed?: Partial<ErrorDraft>): ErrorDraft => ({
  question: '', options: ['', '', '', ''], correct: null, reason: null, why: '', chapter: null, topic: '', ...seed,
});

export const draftFrom = (e: ErrorEntry): ErrorDraft => ({
  id: e.id, question: e.question, options: [...e.options] as ErrorDraft['options'], correct: e.correct, reason: e.reason,
  why: e.why ?? '', chapter: { classId: e.classId, subject: e.subject, chapter: e.chapter }, topic: e.topic ?? '', mockId: e.mockId, image: e.image, source: e.source,
  ...(e.qbankId ? { bank: { qbankId: e.qbankId, figures: e.figures, numeric: e.numeric } } : {}),
});

interface Props {
  initial: ErrorDraft;
  pref: ExamPreference;
  subjects: Subject[];
  suggestedChapters: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>[];
  library: Record<string, string[]>;
  mockName?: string;
  /** Whose pictures these are on this device: the user id, or 'guest'. */
  imageOwner: string;
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

const ErrorForm: React.FC<Props> = ({ initial, pref, subjects, suggestedChapters, library, mockName, imageOwner, dark, onSave, onDelete, onClose, onAddTopic, onForgetTopic }) => {
  const t = tokens(dark);
  const [d, setD] = useState<ErrorDraft>(initial);
  const qRef = useRef<HTMLTextAreaElement>(null);
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (p: Partial<ErrorDraft>) => setD(prev => ({ ...prev, ...p }));
  /* The last paste that was split into fields, kept so Undo can put it back
     exactly as pasted. Cleared by the next edit to the question or options. */
  const [split, setSplit] = useState<{ before: ErrorDraft; raw: string; into: 'question' | number; answer: boolean } | null>(null);

  /* Paste a whole question — number, text, four options, maybe "Ans: B" — and
     it fills steps 1–3 at once. Only when the paste really has four options,
     and never over options already typed (unless the paste lands in an
     option box, which can only mean "these are the options"). */
  const onPasteBlock = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>, into: 'question' | number) => {
    // A screenshot wins over any text that came with it (the window listener takes it).
    if (imageFrom(e.clipboardData.files)) return;
    const raw = e.clipboardData.getData('text/plain');
    if (!raw.trim()) return;
    const p = parsePastedQuestion(raw);
    if (!p.options) return;
    if (into === 'question') {
      const el = e.currentTarget;
      const replacesAll = !d.question.trim() || (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (!replacesAll || d.options.some(o => o.trim())) return;
    }
    e.preventDefault();
    const answer = p.correct !== null && d.correct === null;
    setSplit({ before: d, raw, into, answer });
    set({
      options: p.options,
      question: p.question && (into === 'question' || !d.question.trim()) ? p.question : d.question,
      ...(answer ? { correct: p.correct } : {}),
    });
  };

  const undoSplit = () => {
    if (!split) return;
    const { before, raw, into } = split;
    if (into === 'question') setD({ ...before, question: raw.trim().slice(0, 1500) });
    else {
      const options = [...before.options] as ErrorDraft['options'];
      options[into] = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
      setD({ ...before, options });
    }
    setSplit(null);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [imageError, setImageError] = useState('');
  // A picture usually shows the options, so their boxes wait behind a link.
  const [typeOptions, setTypeOptions] = useState(false);

  useEffect(() => { setD(initial); setTypeOptions(false); setImageError(''); qRef.current?.focus(); }, [initial]);

  const addImage = (file: File) => {
    if (adding) return;
    setAdding(true);
    setImageError('');
    saveErrorImage(file, imageOwner)
      .then(image => set({ image }))
      .catch((err: unknown) => setImageError(err instanceof Error ? err.message : 'Couldn’t add that picture.'))
      .finally(() => setAdding(false));
  };

  /* A screenshot pasted anywhere while the form is open — ⌘V / Ctrl+V, or
     long-press Paste in the question box — becomes the question's picture.
     A paste the text splitter already took is left alone. */
  const addImageRef = useRef(addImage);
  addImageRef.current = addImage;
  const bankEntry = !!initial.bank;
  useEffect(() => {
    if (bankEntry) return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const file = imageFrom(e.clipboardData?.files);
      if (!file) return;
      e.preventDefault();
      addImageRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [bankEntry]);
  useEffect(() => {
    const el = qRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [d.question]);

  const filled = {
    question: d.question.trim().length > 0 || !!d.image,
    options: d.bank?.numeric !== undefined || !!d.image || d.options.every(o => o.trim()),
    correct: d.correct !== null,
    reason: d.reason !== null,
    chapter: d.chapter !== null,
  };
  const ready = Object.values(filled).every(Boolean);
  const missing = adding ? 'Adding the picture…' : !filled.question ? 'Paste or type the question.' : !filled.options ? 'Fill all four options.' : !filled.correct ? 'Mark the right answer.' : !filled.reason ? 'Say why you got it wrong.' : !filled.chapter ? 'Pick the chapter.' : '';

  const setOption = (i: number, v: string) => {
    const options = [...d.options] as ErrorDraft['options'];
    options[i] = v;
    set({ options });
    setSplit(null);
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
      {/* One tap: the notebook offers Undo afterwards. */}
      {d.id && onDelete && (
        <button onClick={() => onDelete(d.id!)} className={`${btn} px-3 py-3 ${t.muted} hover:text-[#E10600]`}>Delete</button>
      )}
      <span className={`flex-1 text-[11px] font-ui ${t.muted} hidden sm:block truncate`}>{missing}</span>
      {!d.id && (
        <button onClick={() => onSave(d, true)} disabled={!ready || adding} className={`${btn} px-4 py-3.5 ml-auto ${t.ghost}`}>Save & add another</button>
      )}
      <button onClick={() => onSave(d, false)} disabled={!ready || adding} className={`${btn} px-5 py-3.5 ${d.id ? 'ml-auto' : ''} ${t.primary}`}>Save</button>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={onClose} label={d.id ? 'Edit error' : 'Add an error'} header={header} footer={footer} width="md:w-[580px]">
      <div className="px-5 md:px-7 py-6 space-y-8">
        {d.bank ? (
          <Step n={1} title="Question" hint="From a CBT paper" done dark={dark}>
            <div className={`rounded-xl border p-4 text-[14px] leading-relaxed ${t.heading} ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-zinc-100 bg-zinc-50'}`}>
              <QText e={d.bank} text={d.question} />
              <QFigures e={{ ...d.bank, question: d.question, options: d.options }} />
              <p className={`text-[12px] font-ui mt-3 ${t.muted}`}>
                Answer: <b className={dark ? 'text-emerald-300' : 'text-emerald-700'}>
                  {d.bank.numeric !== undefined ? d.bank.numeric : <>{OPTION_LETTERS[d.correct ?? 0]} · <QText e={d.bank} text={answerOf({ numeric: undefined, options: d.options, correct: d.correct ?? 0 })} compact /></>}
                </b>
              </p>
            </div>
          </Step>
        ) : (<>
        <Step n={1} title="Question" hint={d.image ? undefined : 'Paste a screenshot or the text'} done={filled.question} dark={dark}>
          <div
            onDragOver={e => { if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file')) e.preventDefault(); }}
            onDrop={e => { const f = imageFrom(e.dataTransfer.files); if (f) { e.preventDefault(); addImage(f); } }}
          >
            {d.image && (
              <div className="relative inline-block max-w-full mb-2.5 mk-fade">
                <ErrorImage id={d.image} dark={dark} maxHeight={360} />
                <button
                  type="button"
                  onClick={() => set({ image: undefined })}
                  aria-label="Remove the picture"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/70 text-white text-[12px] hover:bg-black"
                >✕</button>
              </div>
            )}
            {adding && <p className={`text-[12px] font-ui mb-2.5 ${t.muted}`}>Adding the picture…</p>}
            {imageError && <p role="alert" className="text-[12px] font-ui mb-2.5 text-[#E10600]">{imageError}</p>}
            <textarea
              ref={qRef}
              value={d.question}
              onChange={e => { set({ question: e.target.value }); setSplit(null); }}
              onPaste={e => onPasteBlock(e, 'question')}
              maxLength={1500}
              rows={d.image ? 1 : 3}
              placeholder={d.image ? 'Add a line about it (optional)' : 'Paste a screenshot of the question, or type it.'}
              className={`${t.input} resize-none leading-relaxed`}
            />
            {!d.image && !adding && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`mt-2 inline-flex items-center gap-2 text-[12px] font-ui font-bold ${t.muted} ${dark ? 'hover:text-white' : 'hover:text-zinc-900'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-7 7" /></svg>
                Add a picture
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => { const f = imageFrom(e.target.files); e.target.value = ''; if (f) addImage(f); }}
            />
          </div>
        </Step>

        <Step n={2} title="Options" hint={d.image && (typeOptions || d.options.some(o => o.trim())) ? 'Optional' : undefined} done={filled.options} dark={dark}>
          {d.image && !typeOptions && d.options.every(o => !o.trim()) ? (
            <p className={`text-[13px] font-ui ${t.muted}`}>
              They’re in the picture.{' '}
              <button type="button" onClick={() => setTypeOptions(true)} className={`font-bold underline underline-offset-2 ${t.heading}`}>Type them anyway</button>
            </p>
          ) : (
          <div className="space-y-2">
            {d.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-ui font-black ${d.correct === i ? 'bg-emerald-500 text-white' : dark ? 'bg-white/[0.05] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>{OPTION_LETTERS[i]}</span>
                <input
                  ref={el => { optRefs.current[i] = el; }}
                  value={o}
                  onChange={e => setOption(i, e.target.value)}
                  onPaste={e => onPasteBlock(e, i)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); optRefs.current[i + 1]?.focus(); } }}
                  maxLength={300}
                  placeholder={`Option ${OPTION_LETTERS[i]}`}
                  className={t.input}
                />
              </div>
            ))}
          </div>
          )}
          {split && (
            <div role="status" className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px] font-ui ${dark ? 'bg-emerald-500/[0.08] text-emerald-200' : 'bg-emerald-50 text-emerald-800'}`}>
              <svg className="mt-[1px] shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
              <span className="flex-1">
                Split into the question and 4 options.
                {split.answer && d.correct !== null && <> Answer {OPTION_LETTERS[d.correct]} taken from your paste.</>}
                {' '}Check them.
              </span>
              <button type="button" onClick={undoSplit} className="shrink-0 font-bold underline underline-offset-2">Undo</button>
            </div>
          )}
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
        </>)}

        <Step n={d.bank ? 2 : 4} title="Why did I get it wrong?" done={filled.reason} dark={dark}>
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

        <Step n={d.bank ? 3 : 5} title="Chapter" done={filled.chapter} dark={dark}>
          <SingleChapterPicker
            subjects={subjects}
            pref={pref}
            value={d.chapter}
            onChange={chapter => set({ chapter, topic: '' })}
            suggested={suggestedChapters}
            dark={dark}
          />
        </Step>

        <Step n={d.bank ? 4 : 6} title="Topic" hint="Optional" done={!!d.topic} dark={dark}>
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
