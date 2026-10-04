/* ── Build a paper ──
   Three shapes, the same three Mocks already classifies by: a full JEE Main
   paper (75 questions, 3 hours), one subject (25, an hour), or chosen chapters
   (any count, Main's pace). The paper is generated live as the choices change,
   so what the sheet says it will build is what Start builds — including the
   notes about anything the bank was too thin for. */

import React, { useMemo, useState } from 'react';
import { ChapterProgress } from '../types';
import { getWeight } from '../content';
import { Chip, Segmented, Sheet, btn, subjectDot, tokens } from '../mocks/ui';
import { BankQuestion, ChapterRef, CbtSubject, PaperSpec } from './types';
import { GenInput, JEE_MAIN, chapterOf, generatePaper, newSeed, paperTitle, refKey } from './generate';

interface Props {
  questions: BankQuestion[];
  progress: ChapterProgress[];
  lastSeen: Map<string, number>;
  openErrors: Set<string>;
  weakChapters: Set<string>;
  dark: boolean;
  busy: boolean;
  onStart: (spec: PaperSpec, seed: number, generated: ReturnType<typeof generatePaper>) => void;
  onClose: () => void;
}

type Kind = PaperSpec['kind'];
const COUNTS = [10, 15, 20, 30, 45];

const GenerateSheet: React.FC<Props> = ({ questions, progress, lastSeen, openErrors, weakChapters, dark, busy, onStart, onClose }) => {
  const t = tokens(dark);
  const [kind, setKind] = useState<Kind>('full');
  const [subject, setSubject] = useState<CbtSubject>('Physics');
  const [chosen, setChosen] = useState<ChapterRef[]>([]);
  const [count, setCount] = useState(20);
  const [onlyStarted, setOnlyStarted] = useState(false);
  const [seed, setSeed] = useState(newSeed);

  const ready = useMemo(() => questions.filter(q => q.status === 'ready' && q.chapter && q.classId), [questions]);

  const started = useMemo(() => new Set(
    progress.filter(p => p.status !== 'not_started').map(p => `${p.classId}|${p.subject}|${p.chapter}`),
  ), [progress]);

  // Chapters you can actually pick: the ones with ready questions, heaviest first.
  const chapterChoices = useMemo(() => {
    const m = new Map<string, { ref: ChapterRef; n: number }>();
    ready.forEach(q => {
      const k = chapterOf(q);
      const cur = m.get(k) ?? { ref: { classId: q.classId as 11 | 12, subject: q.subject, chapter: q.chapter as string }, n: 0 };
      cur.n += 1;
      m.set(k, cur);
    });
    return Array.from(m.values());
  }, [ready]);

  const spec: PaperSpec = kind === 'full' ? { kind } : kind === 'subject' ? { kind, subject } : { kind, chapters: chosen, count };

  const generated = useMemo(() => {
    if (kind === 'chapters' && !chosen.length) return null;
    const input: GenInput = {
      questions: ready,
      spec,
      lastSeen,
      openErrors,
      weakChapters,
      allowedChapters: onlyStarted && kind !== 'chapters' ? started : null,
      weightOf: q => (q.classId && q.chapter ? getWeight('JEE', q.classId, q.subject, q.chapter)?.percent ?? 1.5 : 1.5),
      now: Date.now(),
      seed,
    };
    return generatePaper(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, kind, subject, chosen, count, onlyStarted, seed, lastSeen, openErrors, weakChapters, started]);

  const total = generated?.questionIds.length ?? 0;
  const want = generated?.blueprint.sections.reduce((a, s) => a + s.want, 0) ?? 0;

  const toggle = (ref: ChapterRef) => setChosen(cs => (cs.some(c => refKey(c) === refKey(ref)) ? cs.filter(c => refKey(c) !== refKey(ref)) : [...cs, ref]));

  const header = (
    <div className="px-5 md:px-7 pt-6 pb-5 flex items-start justify-between gap-4">
      <div>
        <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>CBT</p>
        <p className={`font-display text-[22px] leading-tight mt-1.5 ${t.heading}`}>Build a paper</p>
      </div>
      <button onClick={onClose} aria-label="Close" className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-3">
      <span className={`flex-1 text-[12px] font-ui ${t.muted}`}>
        {generated ? `${total} questions · ${generated.blueprint.durationMins} min` : 'Pick at least one chapter.'}
      </span>
      <button onClick={() => setSeed(newSeed())} disabled={!generated} className={`${btn} px-3 py-3.5 ${t.ghost}`} title="Same rules, different questions">Reshuffle</button>
      <button onClick={() => generated && onStart(spec, seed, generated)} disabled={!generated || !total || busy} className={`${btn} px-6 py-3.5 ${t.primary}`}>
        {busy ? 'Building…' : 'Start paper'}
      </button>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={onClose} label="Build a paper" header={header} footer={footer} width="md:w-[600px]">
      <div className="px-5 md:px-7 py-6 space-y-7 font-ui">
        <Segmented
          full
          value={kind}
          onChange={setKind}
          dark={dark}
          label="Paper"
          options={[
            { value: 'full', label: 'Full paper', hint: '75 questions · 3 hours' },
            { value: 'subject', label: 'One subject', hint: '25 questions · 1 hour' },
            { value: 'chapters', label: 'Chapters', hint: 'Your pick' },
          ]}
        />

        {kind === 'subject' && (
          <div className="flex flex-wrap gap-2">
            {JEE_MAIN.subjects.map(s => (
              <Chip key={s} on={subject === s} onClick={() => setSubject(s)} dark={dark} color={subjectDot(s)}>{s}</Chip>
            ))}
          </div>
        )}

        {kind === 'chapters' && (
          <div className="space-y-5">
            {JEE_MAIN.subjects.map(s => {
              const here = chapterChoices.filter(c => c.ref.subject === s).sort((a, b) => a.ref.classId - b.ref.classId || (a.ref.chapter < b.ref.chapter ? -1 : 1));
              if (!here.length) return null;
              return (
                <div key={s}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-2 ${t.muted}`}>{s}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {here.map(c => (
                      <Chip key={refKey(c.ref)} on={chosen.some(x => refKey(x) === refKey(c.ref))} onClick={() => toggle(c.ref)} dark={dark} color={subjectDot(s)}>
                        {c.ref.chapter} <span className="opacity-50 tabular-nums">{c.n}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })}
            {!chapterChoices.length && <p className={`text-[13px] ${t.muted}`}>No ready questions yet. Import a bundle first.</p>}
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-2 ${t.muted}`}>Questions</p>
              <div className="flex flex-wrap gap-1.5">
                {COUNTS.map(n => <Chip key={n} on={count === n} onClick={() => setCount(n)} dark={dark}>{n}</Chip>)}
              </div>
            </div>
          </div>
        )}

        {kind !== 'chapters' && (
          <label className={`flex items-center justify-between gap-3 cursor-pointer select-none rounded-xl border px-4 py-3 ${t.inset}`}>
            <span>
              <span className={`block text-[13px] font-bold ${t.heading}`}>Only chapters I’ve started</span>
              <span className={`block text-[11px] mt-0.5 ${t.muted}`}>From your Syllabus tab. Off means the whole syllabus.</span>
            </span>
            <input type="checkbox" checked={onlyStarted} onChange={e => setOnlyStarted(e.target.checked)} className="w-4 h-4 accent-[#E10600]" />
          </label>
        )}

        {generated && (
          <div className={`rounded-xl border p-4 space-y-3 ${t.card}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-[13px] font-bold ${t.heading}`}>{paperTitle(spec)}</p>
              <p className={`text-[12px] tabular-nums ${total < want ? 'text-amber-500' : t.muted}`}>{total} / {want}</p>
            </div>
            <div className="space-y-1.5">
              {generated.blueprint.sections.map(s => (
                <div key={`${s.subject}${s.kind}`} className={`flex items-center gap-2 text-[12px] ${t.body}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(s.subject) }} />
                  <span className="flex-1">{s.subject} · {s.kind === 'mcq' ? 'Section A (MCQ)' : 'Section B (numerical)'}</span>
                  <span className={`tabular-nums ${s.ids.length < s.want ? 'text-amber-500' : t.muted}`}>{s.ids.length} / {s.want}</span>
                </div>
              ))}
            </div>
            {generated.blueprint.notes.length > 0 && (
              <div className={`pt-3 border-t space-y-1 ${t.rule}`}>
                {generated.blueprint.notes.map((n, i) => <p key={i} className={`text-[11px] ${dark ? 'text-amber-300/90' : 'text-amber-700'}`}>{n}</p>)}
              </div>
            )}
            <p className={`text-[11px] ${t.faint}`}>Picked by JEE weightage, fresh questions first, your open notebook errors back after a week.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default GenerateSheet;
