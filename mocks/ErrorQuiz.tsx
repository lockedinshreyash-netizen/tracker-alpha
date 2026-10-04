/* ── Errors, as a test ──
   A chapter's error log turned back into a paper. Three rules:

   · Options are shuffled per question, every run. A student who has seen a
     question three times remembers "it was C"; that is recall of a letter,
     not of physics, and the test would certify it.
   · Feedback is immediate — this is practice, not an exam — and a miss shows
     the student their own words from when they logged it.
   · Nothing touches AppState until the run ends (or is abandoned with answers
     in it): one write, one sync, however many questions. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorEntry } from '../types';
import { CLEAR_STREAK, OPTION_LETTERS, REASONS, isCleared } from './model';
import { practiceOrder } from './insights';
import { Overlay, btn, subjectDot, tokens } from './ui';
import { QFigures, QText, answerOf } from './QText';

/* Numerical answers match to two decimals, the way NTA rounds them. */
const numericRight = (typed: string, value: number): boolean => {
  const n = Number(typed.trim());
  return typed.trim() !== '' && Number.isFinite(n) && Math.abs(n - value) < 0.01 + 1e-9;
};

interface Props {
  title: string;
  errors: ErrorEntry[];
  dark: boolean;
  onFinish: (answers: Record<string, boolean>) => void;
  onClose: () => void;
}

interface Q { e: ErrorEntry; order: number[] }

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const build = (errors: ErrorEntry[]): Q[] => practiceOrder(errors).map(e => ({ e, order: shuffle([0, 1, 2, 3]) }));

const ErrorQuiz: React.FC<Props> = ({ title, errors, dark, onFinish, onClose }) => {
  const t = tokens(dark);
  const openCount = errors.filter(e => !isCleared(e)).length;
  const [skipCleared, setSkipCleared] = useState(openCount > 0 && openCount < errors.length);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [committed, setCommitted] = useState(false);
  const [typed, setTyped] = useState('');

  const pool = useMemo(() => (skipCleared ? errors.filter(e => !isCleared(e)) : errors), [errors, skipCleared]);

  const start = (list: ErrorEntry[]) => {
    setQs(build(list));
    setI(0);
    setPicked(null);
    setTyped('');
    setAnswers({});
    setCommitted(false);
    setPhase('run');
  };

  const commit = useCallback(() => {
    if (committed || !Object.keys(answers).length) return;
    setCommitted(true);
    onFinish(answers);
  }, [answers, committed, onFinish]);

  const close = () => { commit(); onClose(); };

  const q = qs[i];
  const isNumeric = q?.e.numeric !== undefined;
  const choose = (slot: number) => {
    if (picked !== null || !q || isNumeric) return;
    setPicked(slot);
    setAnswers(a => ({ ...a, [q.e.id]: q.order[slot] === q.e.correct }));
  };
  // A numerical question is "picked" once its typed answer is checked.
  const check = () => {
    if (picked !== null || !q || q.e.numeric === undefined || !typed.trim()) return;
    setPicked(0);
    setAnswers(a => ({ ...a, [q.e.id]: numericRight(typed, q.e.numeric as number) }));
  };
  const next = () => {
    if (i + 1 >= qs.length) { setPhase('done'); return; }
    setI(i + 1);
    setPicked(null);
    setTyped('');
  };

  useEffect(() => { if (phase === 'done') commit(); }, [phase, commit]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { close(); return; }
      if (phase !== 'run') return;
      if (isNumeric && picked === null) { if (ev.key === 'Enter') { ev.preventDefault(); check(); } return; }
      const k = ev.key.toLowerCase();
      const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? ['1', '2', '3', '4'].indexOf(k) : ['a', 'b', 'c', 'd'].indexOf(k);
      if (idx >= 0 && picked === null) choose(idx);
      else if ((ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowRight') && picked !== null) { ev.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  });

  const answered = Object.keys(answers).length;
  const right = Object.values(answers).filter(Boolean).length;
  const missed = qs.filter(x => answers[x.e.id] === false).map(x => x.e);
  const nowCleared = qs.filter(x => answers[x.e.id] && x.e.streak + 1 >= CLEAR_STREAK && !isCleared(x.e)).length;

  const shell = (children: React.ReactNode) => (
    <Overlay>
    <div className={`fixed inset-0 z-[130] flex flex-col font-ui mk-fade ${dark ? 'bg-[#0B0B0D]' : 'bg-[#FAFAF9]'}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`shrink-0 flex items-center gap-4 px-5 md:px-8 h-16 border-b ${t.rule}`}>
        <button onClick={close} aria-label="Close test" className={`w-9 h-9 -ml-2 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>Error test</p>
          <p className={`text-[14px] font-ui font-bold truncate ${t.heading}`}>{title}</p>
        </div>
        {phase === 'run' && (
          <span className={`text-[12px] font-ui font-bold tabular-nums ${t.body}`}>{i + 1} / {qs.length}</span>
        )}
      </div>
      {phase === 'run' && (
        <div className={`shrink-0 h-1 ${dark ? 'bg-white/[0.05]' : 'bg-zinc-200/70'}`}>
          <div className="h-full bg-[#E10600] transition-all duration-500" style={{ width: `${((i + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12">{children}</div>
      </div>
    </div>
    </Overlay>
  );

  if (phase === 'intro') {
    return shell(
      <div className="mk-rise">
        <p className={`font-display text-[34px] md:text-[44px] leading-[1.05] ${t.heading}`}>
          {pool.length} {pool.length === 1 ? 'question' : 'questions'} you got wrong.
        </p>
        <p className={`font-accent text-[20px] mt-2 ${t.muted}`}>Get them right this time.</p>
        <div className={`mt-8 rounded-2xl border p-5 space-y-3 ${t.card}`}>
          <div className="flex items-center justify-between text-[13px] font-ui">
            <span className={t.body}>Unresolved</span><b className={t.heading}>{openCount}</b>
          </div>
          <div className="flex items-center justify-between text-[13px] font-ui">
            <span className={t.body}>Already cleared</span><b className={t.heading}>{errors.length - openCount}</b>
          </div>
          {openCount > 0 && openCount < errors.length && (
            <label className={`flex items-center justify-between gap-3 pt-3 border-t cursor-pointer select-none ${t.rule}`}>
              <span className={`text-[13px] font-ui ${t.body}`}>Skip the cleared ones</span>
              <input type="checkbox" checked={skipCleared} onChange={e => setSkipCleared(e.target.checked)} className="w-4 h-4 accent-[#E10600]" />
            </label>
          )}
          <p className={`text-[12px] font-ui pt-1 ${t.muted}`}>Options are shuffled. Get one right twice in a row and it’s cleared.</p>
        </div>
        <button onClick={() => start(pool)} disabled={!pool.length} className={`${btn} w-full mt-6 py-4 text-[11px] ${t.primary}`}>Start the test</button>
        <p className={`text-center text-[11px] font-ui mt-3 ${t.faint}`}>Keys: 1–4 or A–D to answer · Enter for next</p>
      </div>
    );
  }

  if (phase === 'done') {
    const score = qs.length ? Math.round((right / qs.length) * 100) : 0;
    return shell(
      <div className="mk-rise text-center">
        <p className={`text-[11px] font-ui font-bold uppercase tracking-[0.1em] ${t.muted}`}>Result</p>
        <p className={`num-hero text-[88px] md:text-[112px] mt-2 ${t.heading}`}>{score}%</p>
        <p className={`text-[15px] font-ui ${t.body}`}>{right} of {qs.length} right{nowCleared ? ` · ${nowCleared} cleared for good` : ''}</p>
        <p className={`font-accent text-[18px] mt-2 ${t.muted}`}>
          {score === 100 ? 'Clean sweep. These don’t own you anymore.' : score >= 70 ? 'Nearly there. Hit the misses once more.' : 'These are still costing you marks. Again.'}
        </p>
        {missed.length > 0 && (
          // `missed` holds the copies the run started with; the retry reads the fresh ones from props,
          // which already carry this run's attempts.
          <div className="text-left mt-10 space-y-3">
            <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.06em] ${t.muted}`}>Still wrong</p>
            {missed.map(e => (
              <div key={e.id} className={`rounded-xl border p-4 ${t.card}`}>
                <p className={`text-[13px] font-ui leading-relaxed line-clamp-3 whitespace-pre-wrap ${t.heading}`}><QText e={e} text={e.question} /></p>
                <p className={`text-[12px] font-ui mt-2 ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>✓ <QText e={e} text={answerOf(e)} compact /></p>
                {e.why && <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>{e.why}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 mt-10">
          {missed.length > 0 && <button onClick={() => start(errors.filter(e => missed.some(m => m.id === e.id)))} className={`${btn} flex-1 py-4 ${t.primary}`}>Retry the {missed.length} you missed</button>}
          <button onClick={onClose} className={`${btn} flex-1 py-4 ${t.ghost}`}>Done</button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const wasRight = picked !== null && (isNumeric ? !!answers[q.e.id] : q.order[picked] === q.e.correct);
  return shell(
    <div key={q.e.id} className="mk-rise">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold border ${dark ? 'border-white/[0.08] text-zinc-300' : 'border-zinc-200 text-zinc-700'}`}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(q.e.subject) }} />
          {q.e.topic ?? q.e.chapter}
        </span>
        {q.e.attempts > 0 && (
          <span className={`text-[11px] font-ui ${t.faint}`}>Attempt {q.e.attempts + 1}{q.e.lastResult === 'wrong' ? ' · missed last time' : ''}</span>
        )}
      </div>
      <p className={`text-[18px] md:text-[21px] font-ui font-semibold leading-relaxed whitespace-pre-wrap ${t.heading}`}><QText e={q.e} text={q.e.question} /></p>
      <QFigures e={q.e} />

      {isNumeric ? (
        <div className="mt-7 max-w-sm">
          <div className="flex gap-2">
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              inputMode="decimal"
              disabled={picked !== null}
              autoFocus
              placeholder="Your answer"
              className={`${t.input} text-[17px] py-3`}
            />
            {picked === null && <button onClick={check} disabled={!typed.trim()} className={`${btn} px-5 ${t.primary}`}>Check</button>}
          </div>
          {picked !== null && !wasRight && (
            <p className={`text-[13px] font-ui mt-3 ${t.body}`}>Correct answer: <b className={dark ? 'text-emerald-300' : 'text-emerald-700'}>{q.e.numeric}</b></p>
          )}
        </div>
      ) : (
      <div className="mt-7 space-y-2.5">
        {q.order.map((orig, slot) => {
          const isRight = orig === q.e.correct;
          const isPicked = picked === slot;
          const state = picked === null ? 'idle' : isRight ? 'right' : isPicked ? 'wrong' : 'dim';
          const cls = {
            idle: dark ? 'border-white/[0.08] bg-[#111114] hover:border-white/[0.22] hover:bg-white/[0.02]' : 'border-zinc-200 bg-white hover:border-zinc-400 shadow-sm',
            right: dark ? 'border-emerald-400 bg-emerald-400/10' : 'border-emerald-500 bg-emerald-50',
            wrong: dark ? 'border-rose-400 bg-rose-400/10' : 'border-rose-500 bg-rose-50',
            dim: dark ? 'border-white/[0.05] bg-transparent opacity-50' : 'border-zinc-100 bg-white opacity-50',
          }[state];
          return (
            <button
              key={slot}
              type="button"
              onClick={() => choose(slot)}
              disabled={picked !== null}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${picked === null ? 'active:scale-[0.99]' : ''} ${cls}`}
            >
              <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-ui font-black ${
                state === 'right' ? 'bg-emerald-500 text-white' : state === 'wrong' ? 'bg-rose-500 text-white' : dark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {state === 'right' ? '✓' : state === 'wrong' ? '✕' : OPTION_LETTERS[slot]}
              </span>
              <span className={`text-[15px] font-ui whitespace-pre-wrap ${t.heading}`}><QText e={q.e} text={q.e.options[orig]} compact /></span>
            </button>
          );
        })}
      </div>
      )}

      {picked !== null && (
        <div className="mk-rise mt-6">
          <div className={`rounded-xl p-4 ${wasRight ? (dark ? 'bg-emerald-400/10' : 'bg-emerald-50') : dark ? 'bg-rose-400/10' : 'bg-rose-50'}`}>
            <p className={`text-[14px] font-ui font-bold ${wasRight ? (dark ? 'text-emerald-300' : 'text-emerald-800') : dark ? 'text-rose-300' : 'text-rose-800'}`}>
              {wasRight
                ? q.e.streak + 1 >= CLEAR_STREAK ? 'Right — and that clears it.' : 'Right. One more time and it’s cleared.'
                : 'Wrong again.'}
            </p>
            <p className={`text-[12px] font-ui mt-1 ${t.body}`}>
              Last time: <b>{REASONS[q.e.reason].label.toLowerCase()}</b>{q.e.why ? ` — “${q.e.why}”` : ''}
            </p>
          </div>
          <button onClick={next} autoFocus className={`${btn} w-full mt-4 py-4 ${t.primary}`}>
            {i + 1 >= qs.length ? 'See result' : 'Next question'}
          </button>
          <p className={`text-center text-[11px] font-ui mt-2 tabular-nums ${t.faint}`}>{right} / {answered} right so far</p>
        </div>
      )}
    </div>
  );
};

export default ErrorQuiz;
