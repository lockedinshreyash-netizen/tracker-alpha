/* ── The exam ──
   NTA's computer-based test, closely enough that the real one feels familiar:
   subject tabs, a numbered palette in NTA's five states, Save & Next, Mark for
   Review & Next, Clear Response, an on-screen keypad for numericals and a
   clock that auto-submits at zero.

   The rule that matters most is NTA's own: **an answer counts only once it is
   saved.** Picking an option and moving on with Next or the palette drops it,
   exactly as it does in the hall. Getting that habit wrong in practice is how
   marks go missing in the exam.

   The clock is wall time from `startedAt`. Leaving the screen does not pause
   it — the hall does not pause either — and a paper reopened past its end is
   submitted on the spot.

   Responses are written to localStorage on every change (a refresh or a
   crashed tab loses nothing) and handed to `onProgress` every minute, on a
   subject change and when the tab hides. The paper is written to the database
   in full once, at submit. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BankQuestion, CbtPaper, CbtSubject, Resp, RespStatus } from './types';
import { EMPTY_RESP, clock, statusCounts } from './score';
import Tex, { LooseFigures } from './Tex';
import { Overlay, btn, subjectDot, tokens } from '../mocks/ui';
import { OPTION_LETTERS } from '../mocks/model';

interface Props {
  paper: CbtPaper;
  questions: Map<string, BankQuestion>;
  dark: boolean;
  /** Periodic save while the paper runs. */
  onProgress: (responses: Record<string, Resp>, startedAt: string) => void;
  onSubmit: (responses: Record<string, Resp>, startedAt: string) => void;
  /** Leave without submitting. The clock keeps running. */
  onLeave: () => void;
}

interface Slot { id: string; subject: CbtSubject; n: number; section: 'A' | 'B' }

const runKey = (id: string) => `cbt_run_v1:${id}`;
const readRun = (id: string): { responses: Record<string, Resp>; idx: number; startedAt?: string } | null => {
  try { const raw = localStorage.getItem(runKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const clearRun = (id: string) => { try { localStorage.removeItem(runKey(id)); } catch { /* nothing to clear */ } };

const NUMERIC = /^-?\d{0,7}(\.\d{0,3})?$/;

/* ── Palette marks, in NTA's shapes ── */

const STATUS_LABEL: Record<RespStatus, string> = {
  nv: 'Not visited',
  na: 'Not answered',
  ans: 'Answered',
  mr: 'Marked for review',
  amr: 'Answered & marked (counts)',
};

const markStyle = (s: RespStatus, dark: boolean): React.CSSProperties => {
  const base: React.CSSProperties = { width: 40, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, position: 'relative' };
  switch (s) {
    case 'ans': return { ...base, background: '#16a34a', color: '#fff', clipPath: 'polygon(50% 0, 100% 28%, 100% 100%, 0 100%, 0 28%)' };
    case 'na': return { ...base, background: '#e11d48', color: '#fff', clipPath: 'polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)' };
    case 'mr':
    case 'amr': return { ...base, width: 36, background: '#7c3aed', color: '#fff', borderRadius: 999 };
    default: return { ...base, borderRadius: 6, background: dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5', color: dark ? '#a1a1aa' : '#52525b', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e4e4e7'}` };
  }
};

const Mark: React.FC<{ s: RespStatus; dark: boolean; children: React.ReactNode; current?: boolean }> = ({ s, dark, children, current }) => (
  <span className="relative inline-flex">
    <span style={markStyle(s, dark)}>{children}</span>
    {s === 'amr' && <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-[#16a34a] border-2" style={{ borderColor: dark ? '#111114' : '#fff' }} />}
    {current && <span className="absolute -inset-1 rounded-lg border-2 pointer-events-none" style={{ borderColor: dark ? '#fff' : '#18181b' }} />}
  </span>
);

const CbtExam: React.FC<Props> = ({ paper, questions, dark, onProgress, onSubmit, onLeave }) => {
  const t = tokens(dark);

  /* ── The paper, flattened ── */
  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    const nBySubject = new Map<CbtSubject, number>();
    paper.blueprint.sections.forEach(sec => sec.ids.forEach(id => {
      const n = (nBySubject.get(sec.subject) ?? 0) + 1;
      nBySubject.set(sec.subject, n);
      out.push({ id, subject: sec.subject, n, section: sec.kind === 'mcq' ? 'A' : 'B' });
    }));
    return out;
  }, [paper]);
  const subjects = useMemo(() => Array.from(new Set(slots.map(s => s.subject))), [slots]);

  /* ── State ── */
  const saved = useMemo(() => readRun(paper.id), [paper.id]);
  const [phase, setPhase] = useState<'instructions' | 'exam' | 'confirm'>(paper.startedAt || saved?.startedAt ? 'exam' : 'instructions');
  const [startedAt, setStartedAt] = useState<string | null>(paper.startedAt ?? saved?.startedAt ?? null);
  const [responses, setResponses] = useState<Record<string, Resp>>(() => ({ ...paper.responses, ...(saved?.responses ?? {}) }));
  const [idx, setIdx] = useState(() => Math.min(saved?.idx ?? 0, Math.max(0, slots.length - 1)));
  const draftFor = (i: number): number | string | null => (slots[i] ? responses[slots[i].id]?.a ?? null : null);
  const [draft, setDraft] = useState<number | string | null>(() => draftFor(idx));
  const [now, setNow] = useState(() => Date.now());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const enteredAt = useRef(Date.now());
  const submitted = useRef(false);
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

  const slot = slots[idx];
  const q = slot ? questions.get(slot.id) : undefined;
  const resp = slot ? responses[slot.id] ?? EMPTY_RESP : EMPTY_RESP;
  const deadline = startedAt ? Date.parse(startedAt) + paper.blueprint.durationMins * 60_000 : null;
  const left = deadline === null ? paper.blueprint.durationMins * 60_000 : deadline - now;

  /* Opening a question shows its saved answer; anything picked and not saved
     is gone the moment you look away — NTA's rule. Set in the same update as
     the move, never in an effect after it: a fast double-press of "Mark for
     Review & Next" would otherwise land on the next question while it still
     held the last one's pick, and save it there. */
  const moveTo = (i: number) => {
    setIdx(i);
    setDraft(draftFor(i));
    enteredAt.current = Date.now();
  };
  useEffect(() => { enteredAt.current = Date.now(); }, [phase]);

  // First visit turns "not visited" into "not answered".
  useEffect(() => {
    if (phase !== 'exam' || !slot) return;
    setResponses(r => {
      const cur = r[slot.id] ?? EMPTY_RESP;
      return { ...r, [slot.id]: { ...cur, s: cur.s === 'nv' ? 'na' : cur.s, v: cur.v + 1 } };
    });
  }, [idx, phase, slot]);

  // Every change is on disk before the next paint.
  useEffect(() => {
    try { localStorage.setItem(runKey(paper.id), JSON.stringify({ responses, idx, startedAt })); } catch { /* storage full or blocked: the minute save still runs */ }
  }, [responses, idx, startedAt, paper.id]);

  /* Time on the current question is taken once, outside any state updater —
     StrictMode runs updaters twice, and a clock read inside one would bank
     the time on the first run and nothing on the second. */
  const takeSpent = (): number => {
    const spent = Date.now() - enteredAt.current;
    enteredAt.current = Date.now();
    return Math.max(0, spent);
  };
  const addTime = (r: Record<string, Resp>, id: string | undefined, ms: number): Record<string, Resp> => {
    if (!id || !ms) return r;
    const cur = r[id] ?? EMPTY_RESP;
    return { ...r, [id]: { ...cur, t: cur.t + ms } };
  };

  const submit = useCallback(() => {
    if (submitted.current || !startedAt) return;
    submitted.current = true;
    const spent = Date.now() - enteredAt.current;
    onSubmit(addTime(responsesRef.current, slot?.id, Math.max(0, spent)), startedAt);
  }, [onSubmit, startedAt, slot]);

  // The clock.
  useEffect(() => {
    if (phase === 'instructions') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);
  useEffect(() => { if (phase !== 'instructions' && deadline !== null && now >= deadline) submit(); }, [now, deadline, phase, submit]);

  // A save a minute, and one whenever the tab hides.
  useEffect(() => {
    if (phase === 'instructions' || !startedAt) return;
    const save = () => onProgress(responsesRef.current, startedAt);
    const id = window.setInterval(save, 60_000);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onHide); };
  }, [phase, startedAt, onProgress]);

  // The body behind does not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Actions ── */
  const go = (to: number) => {
    if (to < 0 || to >= slots.length) return;
    const from = slot?.subject;
    const ms = takeSpent();
    setResponses(r => addTime(r, slot?.id, ms));
    moveTo(to);
    setPaletteOpen(false);
    if (from && slots[to].subject !== from && startedAt) onProgress(responsesRef.current, startedAt);
  };

  const hasDraft = draft !== null && draft !== '' && draft !== '-' && draft !== '.';
  const write = (next: (cur: Resp) => Resp) => {
    const ms = takeSpent();
    setResponses(r => {
      const withTime = addTime(r, slot.id, ms);
      return { ...withTime, [slot.id]: next(withTime[slot.id] ?? EMPTY_RESP) };
    });
  };

  const saveNext = () => {
    if (!slot) return;
    write(cur => (hasDraft ? { ...cur, a: draft, s: 'ans' } : { ...cur, a: null, s: cur.s === 'mr' ? 'mr' : 'na' }));
    if (idx + 1 < slots.length) moveTo(idx + 1);
  };
  const markNext = () => {
    if (!slot) return;
    write(cur => (hasDraft ? { ...cur, a: draft, s: 'amr' } : { ...cur, a: null, s: 'mr' }));
    if (idx + 1 < slots.length) moveTo(idx + 1);
  };
  const clearResponse = () => {
    if (!slot) return;
    setDraft(null);
    write(cur => ({ ...cur, a: null, s: 'na' }));
  };
  const begin = () => {
    const at = startedAt ?? new Date().toISOString();
    setStartedAt(at);
    setNow(Date.now());
    setPhase('exam');
    onProgress(responsesRef.current, at);
  };
  const toConfirm = () => {
    const ms = takeSpent();
    setResponses(r => addTime(r, slot?.id, ms));
    setPhase('confirm');
  };
  const leave = () => {
    if (startedAt) onProgress(addTime(responsesRef.current, slot?.id, takeSpent()), startedAt);
    onLeave();
  };

  // From the latest value, so taps faster than a render are never dropped.
  const key = (k: string) => setDraft(prev => {
    const cur = prev === null ? '' : String(prev);
    const next = k === 'back' ? cur.slice(0, -1)
      : k === 'clear' ? ''
        : k === '-' ? (cur.startsWith('-') ? cur.slice(1) : `-${cur}`)
          : cur + k;
    if (next === '') return null;
    return NUMERIC.test(next) ? next : prev;
  });

  /* ── Pieces ── */
  const timer = (
    <div className={`text-right ${left < 5 * 60_000 ? 'text-rose-500' : t.heading}`}>
      <p className={`text-[9px] font-ui font-bold uppercase tracking-[0.1em] ${t.muted}`}>Time left</p>
      <p className="num-timer text-[20px] md:text-[22px] leading-none tabular-nums">{clock(left)}</p>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <Overlay>
      <div className={`fixed inset-0 z-[140] flex flex-col font-ui mk-fade ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#FAFAF9] text-zinc-900'}`} role="dialog" aria-modal="true" aria-label={paper.name}>
        <div className={`shrink-0 flex items-center gap-3 px-4 md:px-6 h-14 border-b ${t.rule}`}>
          <button onClick={leave} aria-label="Leave the paper" title="Leave — the clock keeps running" className={`w-9 h-9 -ml-2 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-bold uppercase tracking-[0.1em] ${t.muted}`}>CBT · JEE Main pattern</p>
            <p className={`text-[14px] font-bold truncate ${t.heading}`}>{paper.name}</p>
          </div>
          {phase !== 'instructions' && timer}
        </div>
        {children}
      </div>
    </Overlay>
  );

  /* ── Instructions ── */
  if (phase === 'instructions') {
    const mcq = paper.blueprint.sections.filter(s => s.kind === 'mcq').reduce((a, s) => a + s.ids.length, 0);
    const num = slots.length - mcq;
    const { right, wrong } = paper.blueprint.marking;
    return shell(
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12 mk-rise">
          <p className={`font-display text-[32px] md:text-[42px] leading-[1.05] ${t.heading}`}>{slots.length} questions. {paper.blueprint.durationMins} minutes.</p>
          <p className={`font-accent text-[19px] mt-2 ${t.muted}`}>Treat it like the real one.</p>
          <div className={`mt-8 rounded-2xl border p-5 md:p-6 space-y-3 text-[13px] ${t.card}`}>
            <p className={t.body}><b className={t.heading}>Section A</b> · {mcq} single-correct MCQs. <b className={t.heading}>Section B</b> · {num} numerical answers, typed on the keypad.</p>
            <p className={t.body}>Marking: <b className={t.heading}>+{right}</b> right, <b className={t.heading}>{wrong}</b> wrong, 0 left blank. Same for numericals.</p>
            <p className={t.body}>An answer counts only after <b className={t.heading}>Save & Next</b> or <b className={t.heading}>Mark for Review & Next</b>. Moving away without saving drops it — just like NTA.</p>
            <p className={t.body}>The clock does not stop if you leave this screen. At zero, the paper submits itself.</p>
          </div>
          {paper.blueprint.notes.length > 0 && (
            <div className={`mt-4 rounded-2xl border p-5 space-y-1.5 ${dark ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>About this paper</p>
              {paper.blueprint.notes.map((n, i) => <p key={i} className={`text-[12px] ${dark ? 'text-amber-100/80' : 'text-amber-900'}`}>{n}</p>)}
            </div>
          )}
          <div className={`mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] ${t.body}`}>
            {(['nv', 'na', 'ans', 'mr', 'amr'] as RespStatus[]).map(s => (
              <span key={s} className="flex items-center gap-2"><Mark s={s} dark={dark}>{s === 'nv' ? 1 : ''}</Mark>{STATUS_LABEL[s]}</span>
            ))}
          </div>
          <button onClick={begin} className={`${btn} w-full mt-8 py-4 text-[11px] ${t.primary}`}>I’m ready. Start the clock.</button>
          <button onClick={onLeave} className={`${btn} w-full mt-2 py-3 ${t.muted}`}>Not now</button>
        </div>
      </div>,
    );
  }

  /* ── Submit summary ── */
  if (phase === 'confirm') {
    return shell(
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12 mk-rise">
          <p className={`font-display text-[30px] md:text-[38px] leading-[1.05] ${t.heading}`}>Submit the paper?</p>
          <p className={`text-[13px] mt-2 ${t.muted}`}>{clock(left)} still on the clock. You can’t change anything after this.</p>
          <div className={`mt-6 rounded-2xl border overflow-x-auto ${t.card}`}>
            <table className="w-full text-[12px] tabular-nums">
              <thead>
                <tr className={`${t.muted} text-left`}>
                  <th className="px-4 py-3 font-bold">Section</th>
                  {(['ans', 'na', 'mr', 'amr', 'nv'] as RespStatus[]).map(s => <th key={s} className="px-3 py-3 font-bold text-center">{STATUS_LABEL[s].replace(' (counts)', '')}</th>)}
                </tr>
              </thead>
              <tbody>
                {subjects.map(s => {
                  const c = statusCounts(slots.filter(x => x.subject === s).map(x => x.id), responses);
                  return (
                    <tr key={s} className={`border-t ${t.rule}`}>
                      <td className={`px-4 py-3 font-bold ${t.heading}`}><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: subjectDot(s) }} />{s}</td>
                      {(['ans', 'na', 'mr', 'amr', 'nv'] as RespStatus[]).map(k => <td key={k} className={`px-3 py-3 text-center ${t.body}`}>{c[k]}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button onClick={submit} className={`${btn} flex-1 py-4 ${t.primary}`}>Submit paper</button>
            <button onClick={() => setPhase('exam')} className={`${btn} flex-1 py-4 ${t.ghost}`}>Go back</button>
          </div>
        </div>
      </div>,
    );
  }

  /* ── The exam ── */
  const palette = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        {(['ans', 'na', 'nv', 'mr', 'amr'] as RespStatus[]).map(s => {
          const c = statusCounts(slots.filter(x => x.subject === slot?.subject).map(x => x.id), responses)[s];
          return (
            <span key={s} className={`flex items-center gap-2 ${s === 'amr' ? 'col-span-2' : ''} ${t.body}`}>
              <Mark s={s} dark={dark}>{c}</Mark>{STATUS_LABEL[s]}
            </span>
          );
        })}
      </div>
      {(['A', 'B'] as const).map(sec => {
        const here = slots.map((s, i) => ({ s, i })).filter(x => x.s.subject === slot?.subject && x.s.section === sec);
        if (!here.length) return null;
        return (
          <div key={sec}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-2 ${t.muted}`}>{slot?.subject} · Section {sec}</p>
            <div className="flex flex-wrap gap-2">
              {here.map(({ s, i }) => (
                <button key={s.id} onClick={() => go(i)} aria-label={`Question ${s.n}, ${STATUS_LABEL[(responses[s.id] ?? EMPTY_RESP).s]}`}>
                  <Mark s={(responses[s.id] ?? EMPTY_RESP).s} dark={dark} current={i === idx}>{s.n}</Mark>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return shell(
    <>
      {/* Subject tabs */}
      <div className={`shrink-0 flex items-center gap-1 px-3 md:px-6 border-b overflow-x-auto ${t.rule}`}>
        {subjects.map(s => {
          const on = slot?.subject === s;
          const first = slots.findIndex(x => x.subject === s);
          return (
            <button key={s} onClick={() => go(first)} className={`px-4 py-3 text-[12px] font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${on ? (dark ? 'border-white text-white' : 'border-zinc-900 text-zinc-900') : `border-transparent ${t.muted}`}`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: subjectDot(s) }} />{s}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Question */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {slot && (
              <div key={slot.id} className="max-w-3xl px-5 md:px-8 py-6 md:py-8">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className={`text-[15px] font-bold ${t.heading}`}>Question {slot.n}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${dark ? 'border-white/[0.08] text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
                    Section {slot.section} · {q?.kind === 'numerical' ? 'Numerical value' : 'Single correct'}
                  </span>
                  <span className={`text-[11px] ${t.faint}`}>+{paper.blueprint.marking.right} / {paper.blueprint.marking.wrong}</span>
                </div>
                {!q ? (
                  <p className={`text-[14px] ${t.muted}`}>This question was deleted from your bank. Skip it.</p>
                ) : (
                  <>
                    <div className={`text-[16px] md:text-[17px] leading-relaxed ${t.heading}`}>
                      <Tex text={q.body} figures={q.figures} />
                      <LooseFigures body={q.body} options={q.options} figures={q.figures} />
                    </div>
                    {q.kind === 'mcq' && q.options ? (
                      <div className="mt-6 space-y-2.5">
                        {q.options.map((o, i) => {
                          const on = draft === i;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setDraft(i)}
                              aria-pressed={on}
                              className={`w-full flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all ${on
                                ? dark ? 'border-white bg-white/[0.06]' : 'border-zinc-900 bg-zinc-50'
                                : dark ? 'border-white/[0.08] bg-[#111114] hover:border-white/[0.2]' : 'border-zinc-200 bg-white hover:border-zinc-400 shadow-sm'}`}
                            >
                              <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black ${on ? (dark ? 'border-white bg-white text-black' : 'border-zinc-900 bg-zinc-900 text-white') : dark ? 'border-white/[0.18] text-zinc-400' : 'border-zinc-300 text-zinc-500'}`}>
                                {OPTION_LETTERS[i]}
                              </span>
                              <span className={`text-[15px] pt-0.5 ${t.heading}`}><Tex text={o} figures={q.figures} compact /></span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-6 max-w-[280px]">
                        <div className={`px-4 py-3 rounded-xl border text-[22px] num-stat tabular-nums min-h-[54px] ${dark ? 'border-white/[0.12] bg-[#111114]' : 'border-zinc-300 bg-white'}`}>
                          {draft === null || draft === '' ? <span className={t.faint}>Your answer</span> : String(draft)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'].map(k => (
                            <button key={k} type="button" onClick={() => key(k)} className={`py-3 rounded-lg border text-[16px] font-bold active:scale-95 transition-transform ${t.ghost}`}>{k === '-' ? '±' : k}</button>
                          ))}
                          <button type="button" onClick={() => key('back')} className={`col-span-2 py-3 rounded-lg border text-[12px] font-bold ${t.ghost}`}>⌫ Backspace</button>
                          <button type="button" onClick={() => key('clear')} className={`py-3 rounded-lg border text-[12px] font-bold ${t.ghost}`}>Clear</button>
                        </div>
                      </div>
                    )}
                    {resp.a !== null && draft !== resp.a && (
                      <p className={`text-[11px] mt-4 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>Not saved. Your saved answer is still {typeof resp.a === 'number' ? OPTION_LETTERS[resp.a] : resp.a}.</p>
                    )}
                    {resp.a === null && hasDraft && (
                      <p className={`text-[11px] mt-4 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>Not saved yet.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions. Phone: the two saves on top, navigation under them. */}
          <div className={`shrink-0 border-t px-3 md:px-6 py-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center ${t.rule} ${dark ? 'bg-[#0B0B0D]' : 'bg-[#FAFAF9]'}`}>
            <button onClick={saveNext} className={`${btn} px-4 py-3 bg-[#16a34a] text-white hover:bg-[#15803d]`}>Save & Next</button>
            <button onClick={markNext} className={`${btn} px-4 py-3 bg-[#7c3aed] text-white hover:bg-[#6d28d9]`}>
              <span className="md:hidden">Mark & Next</span><span className="hidden md:inline">Mark for Review & Next</span>
            </button>
            <div className="col-span-2 flex items-center gap-2 md:contents">
              <button onClick={clearResponse} className={`${btn} px-3 md:px-4 py-3 ${t.ghost}`}>
                <span className="md:hidden">Clear</span><span className="hidden md:inline">Clear Response</span>
              </button>
              <div className="flex-1" />
              <button onClick={() => setPaletteOpen(true)} className={`md:hidden ${btn} px-3 py-3 ${t.ghost}`}>Palette</button>
              <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Back" className={`${btn} px-3 py-3 ${t.ghost}`}>‹<span className="hidden md:inline"> Back</span></button>
              <button onClick={() => go(idx + 1)} disabled={idx >= slots.length - 1} aria-label="Next" className={`${btn} px-3 py-3 ${t.ghost}`}><span className="hidden md:inline">Next </span>›</button>
              <button onClick={toConfirm} className={`md:hidden ${btn} px-4 py-3 ${t.primary}`}>Submit</button>
            </div>
          </div>
        </div>

        {/* Palette, desktop */}
        <aside className={`hidden md:flex flex-col w-[300px] shrink-0 border-l ${t.rule}`}>
          <div className="flex-1 overflow-y-auto p-5">{palette}</div>
          <div className={`shrink-0 border-t p-4 ${t.rule}`}>
            <button onClick={toConfirm} className={`${btn} w-full py-3.5 ${t.primary}`}>Submit</button>
          </div>
        </aside>
      </div>

      {/* Palette, phone */}
      {paletteOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex items-end" onClick={() => setPaletteOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className={`relative w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border p-5 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-100'}`} onClick={e => e.stopPropagation()}>
            {palette}
          </div>
        </div>
      )}
    </>,
  );
};

export default CbtExam;
