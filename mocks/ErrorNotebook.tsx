/* ── The error notebook ──
   Every question the student got wrong, organised the way they will want to
   attack it: by chapter, unresolved first, each chapter one tap from becoming
   a test. The list below is for finding and fixing a single entry. */

import React, { useMemo, useState } from 'react';
import { ErrorEntry, ErrorReason, Subject } from '../types';
import { CLEAR_STREAK, OPTION_LETTERS, REASONS, REASON_ORDER, isCleared } from './model';
import { ErrorPile, errorPiles } from './insights';
import { Card, Chip, Eyebrow, btn, subjectDot, tokens } from './ui';

interface Props {
  errors: ErrorEntry[];
  subjects: Subject[];
  dark: boolean;
  onAdd: () => void;
  onEdit: (e: ErrorEntry) => void;
  onTest: (title: string, ids: string[]) => void;
}

type Status = 'all' | 'open' | 'cleared';

const StreakDots: React.FC<{ e: ErrorEntry; dark: boolean }> = ({ e, dark }) => (
  <span className="inline-flex gap-0.5" aria-label={isCleared(e) ? 'Cleared' : `${Math.min(e.streak, CLEAR_STREAK)} of ${CLEAR_STREAK} right in a row`}>
    {Array.from({ length: CLEAR_STREAK }).map((_, i) => (
      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < e.streak ? 'bg-emerald-500' : dark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
    ))}
  </span>
);

const PileCard: React.FC<{ p: ErrorPile; dark: boolean; onTest: () => void; i: number }> = ({ p, dark, onTest, i }) => {
  const t = tokens(dark);
  const cleared = p.total - p.open;
  return (
    <div className={`mk-rise group rounded-xl border p-4 flex flex-col transition-all hover:-translate-y-0.5 ${t.card}`} style={{ animationDelay: `${80 + i * 40}ms` }}>
      <div className="flex items-start gap-2">
        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: subjectDot(p.subject) }} />
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-ui font-bold leading-snug line-clamp-2 ${t.heading}`}>{p.chapter}</p>
          <p className={`text-[11px] font-ui mt-0.5 ${t.muted}`}>{p.subject}</p>
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mt-4">
        <span className={`num-hero text-[30px] ${p.open ? t.heading : dark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.open || '✓'}</span>
        <span className={`text-[11px] font-ui ${t.muted}`}>{p.open ? `open of ${p.total}` : `all ${p.total} cleared`}</span>
      </div>
      <div className={`h-1 rounded-full overflow-hidden mt-2 ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
        <div className="h-full rounded-full bg-emerald-500 mk-grow-x" style={{ width: `${(cleared / p.total) * 100}%` }} />
      </div>
      <button onClick={onTest} className={`${btn} mt-4 py-2.5 ${p.open ? tokens(dark).primary : tokens(dark).ghost}`}>
        {p.open ? 'Test me' : 'Test again'}
      </button>
    </div>
  );
};

const ErrorCard: React.FC<{ e: ErrorEntry; dark: boolean; onEdit: () => void }> = ({ e, dark, onEdit }) => {
  const t = tokens(dark);
  const [open, setOpen] = useState(false);
  return (
    <div className={`transition-colors ${open ? (dark ? 'bg-white/[0.02]' : 'bg-zinc-50/60') : ''}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={`w-full text-left px-5 md:px-6 py-4 flex items-start gap-3 ${t.hover}`}>
        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: subjectDot(e.subject) }} />
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-ui leading-relaxed whitespace-pre-wrap ${open ? '' : 'line-clamp-2'} ${t.heading}`}>{e.question}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[11px] font-ui ${t.muted}`}>{e.chapter}{e.topic ? ` · ${e.topic}` : ''}</span>
            <span className={`text-[10px] font-ui font-bold px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.05] text-zinc-400' : 'bg-zinc-100 text-zinc-600'}`}>{REASONS[e.reason].label}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-1">
          {isCleared(e)
            ? <span className={`text-[10px] font-ui font-black uppercase tracking-[0.08em] ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>Cleared</span>
            : <StreakDots e={e} dark={dark} />}
          {e.attempts > 0 && <span className={`text-[10px] font-ui ${t.faint}`}>{e.attempts}× tried</span>}
        </div>
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-5 pl-[38px] md:pl-[42px] mk-fade">
          <div className="grid sm:grid-cols-2 gap-2">
            {e.options.map((o, i) => (
              <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-[13px] font-ui ${i === e.correct ? (dark ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-900') : dark ? 'border-white/[0.06] text-zinc-400' : 'border-zinc-100 text-zinc-600'}`}>
                <b className="shrink-0">{OPTION_LETTERS[i]}</b><span className="whitespace-pre-wrap">{o}</span>
              </div>
            ))}
          </div>
          {e.why && <p className={`font-accent text-[15px] mt-3 ${t.heading}`}>“{e.why}”</p>}
          <button onClick={onEdit} className={`${btn} mt-4 px-4 py-2.5 ${t.ghost}`}>Edit</button>
        </div>
      )}
    </div>
  );
};

const ErrorNotebook: React.FC<Props> = ({ errors, subjects, dark, onAdd, onEdit, onTest }) => {
  const t = tokens(dark);
  const [subject, setSubject] = useState<Subject | 'all'>('all');
  const [status, setStatus] = useState<Status>('open');
  const [reason, setReason] = useState<ErrorReason | 'all'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(20);

  const piles = useMemo(() => errorPiles(errors), [errors]);
  const open = errors.filter(e => !isCleared(e));
  const tried = errors.filter(e => e.attempts > 0);
  const subjectsHere = subjects.filter(s => errors.some(e => e.subject === s));
  const reasonMix = REASON_ORDER.map(r => ({ r, n: errors.filter(e => e.reason === r).length })).filter(x => x.n).sort((a, b) => b.n - a.n);

  const q = query.trim().toLowerCase();
  const filtered = [...errors].reverse().filter(e =>
    (subject === 'all' || e.subject === subject)
    && (status === 'all' || (status === 'open' ? !isCleared(e) : isCleared(e)))
    && (reason === 'all' || e.reason === reason)
    && (!q || e.question.toLowerCase().includes(q) || e.chapter.toLowerCase().includes(q) || (e.topic ?? '').toLowerCase().includes(q)));

  if (!errors.length) {
    return (
      <Card dark={dark} className="p-8 md:p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-60" style={{ background: `radial-gradient(60% 60% at 50% 0%, ${dark ? 'rgba(225,6,0,0.12)' : 'rgba(225,6,0,0.06)'}, transparent)` }} />
        <div className="relative">
          <p className={`font-display text-[30px] md:text-[38px] leading-tight ${t.heading}`}>Every wrong answer is a free lesson.</p>
          <p className={`font-accent text-[18px] mt-2 ${t.muted}`}>Only if you write it down.</p>
          <p className={`text-[14px] font-ui mt-5 max-w-md mx-auto ${t.body}`}>Save the questions you got wrong. Later, take them as a test — one chapter at a time — until you get every one right.</p>
          <button onClick={onAdd} className={`${btn} mt-7 px-7 py-4 ${t.primary}`}>Add your first error</button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* The numbers, and the one-tap way into a test. */}
      <Card dark={dark} className="p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex gap-8 md:gap-12">
            <div>
              <Eyebrow dark={dark}>Unresolved</Eyebrow>
              <p className={`num-hero text-[48px] mt-2 ${t.heading}`}>{open.length}</p>
            </div>
            <div>
              <Eyebrow dark={dark}>Cleared</Eyebrow>
              <p className={`num-hero text-[48px] mt-2 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>{errors.length - open.length}</p>
            </div>
            <div className="hidden sm:block">
              <Eyebrow dark={dark}>Re-attempted</Eyebrow>
              <p className={`num-hero text-[48px] mt-2 ${t.heading}`}>{tried.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onAdd} className={`${btn} px-4 py-3 ${t.ghost}`}>+ Add error</button>
            {open.length > 0 && (
              <button onClick={() => onTest('Every unresolved error', open.map(e => e.id))} className={`${btn} px-5 py-3 ${t.primary}`}>Test all {open.length}</button>
            )}
          </div>
        </div>
        {reasonMix.length > 0 && (
          <div className="mt-6">
            <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
              {reasonMix.map((x, i) => (
                <div key={x.r} style={{ flex: x.n, background: dark ? `rgba(255,255,255,${0.75 - i * 0.12})` : `rgba(24,24,27,${0.8 - i * 0.12})` }} />
              ))}
            </div>
            <p className={`text-[12px] font-ui mt-2.5 ${t.muted}`}>
              Mostly <b className={t.heading}>{REASONS[reasonMix[0].r].label.toLowerCase()}</b> ({Math.round((reasonMix[0].n / errors.length) * 100)}%)
              {reasonMix[1] ? <>, then {REASONS[reasonMix[1].r].label.toLowerCase()} ({Math.round((reasonMix[1].n / errors.length) * 100)}%)</> : null}.
            </p>
          </div>
        )}
      </Card>

      <div>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <Eyebrow dark={dark}>Test yourself by chapter</Eyebrow>
          <span className={`text-[11px] font-ui ${t.faint}`}>{piles.length} chapters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {piles.slice(0, 12).map((p, i) => (
            <PileCard
              key={p.key}
              p={p}
              i={i}
              dark={dark}
              onTest={() => onTest(p.chapter, errors.filter(e => e.classId === p.classId && e.subject === p.subject && e.chapter === p.chapter).map(e => e.id))}
            />
          ))}
        </div>
        {subjectsHere.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {subjectsHere.map(s => {
              const ids = errors.filter(e => e.subject === s).map(e => e.id);
              return (
                <button key={s} onClick={() => onTest(`All ${s} errors`, ids)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-ui font-semibold ${dark ? 'border-white/[0.08] text-zinc-300 hover:bg-white/[0.04]' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(s) }} />
                  Test all {s} · {ids.length}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Card dark={dark} delay={120} className="overflow-hidden">
        <div className="px-5 md:px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow dark={dark}>All errors</Eyebrow>
            <span className={`text-[11px] font-ui ${t.faint}`}>{filtered.length} shown</span>
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions, chapters, topics…" className={t.input} />
          <div className="flex items-center gap-1.5 overflow-x-auto mk-scroll-x pb-1">
            {(['open', 'cleared', 'all'] as Status[]).map(s => (
              <Chip key={s} on={status === s} onClick={() => setStatus(s)} dark={dark}>{s === 'open' ? 'Unresolved' : s === 'cleared' ? 'Cleared' : 'All'}</Chip>
            ))}
            <span className={`w-px h-5 mx-1 ${dark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
            <Chip on={subject === 'all'} onClick={() => setSubject('all')} dark={dark}>Every subject</Chip>
            {subjectsHere.map(s => (
              <Chip key={s} on={subject === s} onClick={() => setSubject(s)} dark={dark} color={subjectDot(s)}>{s}</Chip>
            ))}
            <span className={`w-px h-5 mx-1 ${dark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
            <select value={reason} onChange={e => setReason(e.target.value as ErrorReason | 'all')} aria-label="Reason" className={`px-3 py-1.5 rounded-full border text-[12px] font-ui font-semibold outline-none ${dark ? 'bg-transparent border-white/[0.08] text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'}`}>
              <option value="all">Any reason</option>
              {REASON_ORDER.map(r => <option key={r} value={r}>{REASONS[r].label}</option>)}
            </select>
          </div>
        </div>
        <div className={`divide-y border-t ${dark ? 'divide-white/[0.05] border-white/[0.05]' : 'divide-zinc-100 border-zinc-100'}`}>
          {filtered.slice(0, limit).map(e => <ErrorCard key={e.id} e={e} dark={dark} onEdit={() => onEdit(e)} />)}
          {!filtered.length && <p className={`px-6 py-8 text-center text-[13px] font-ui ${t.muted}`}>{status === 'open' && !q ? 'Nothing unresolved here. Clean.' : 'No errors match.'}</p>}
        </div>
        {filtered.length > limit && (
          <button onClick={() => setLimit(l => l + 30)} className={`w-full py-4 text-[11px] font-ui font-bold uppercase tracking-[0.1em] border-t ${t.rule} ${t.muted} hover:text-[#E10600]`}>
            Show {Math.min(30, filtered.length - limit)} more
          </button>
        )}
      </Card>
    </div>
  );
};

export default ErrorNotebook;
