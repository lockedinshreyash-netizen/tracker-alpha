/* ── Next up, and everything before it ──
   The next mock is the hero of the tab, because it is the only one the
   student can still change: what's in it, what isn't done, what leaked last
   time. Below it, the history — planned and taken in one list, newest first,
   each row opening into its own post-mortem. */

import React, { useEffect, useRef } from 'react';
import { MockTest, MockVerdict, Subject } from '../types';
import { MISTAKES, MISTAKE_COLORS, MISTAKE_ORDER, examColor, paperKey, parseKey, scorePct, subjectPct, totals } from './model';
import { Readiness, daysBetween, formatDate, leakName, relativeDay } from './insights';
import { Card, ExamBadge, Eyebrow, ScopeBadge, btn, deltaTone, pct, signedPct, subjectDot, tokens } from './ui';

/* ── Readiness ring ── */

const Ring: React.FC<{ r: Readiness; dark: boolean; size?: number }> = ({ r, dark, size = 112 }) => {
  const stroke = 9, rad = (size - stroke) / 2, c = 2 * Math.PI * rad;
  const done = r.total ? r.done / r.total : 0;
  const started = r.total ? r.started / r.total : 0;
  const gap = r.total > 1 ? 0.012 : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'} strokeWidth={stroke} />
        {started > 0 && (
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={dark ? '#c98500' : '#eda100'} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${Math.max(0, started - gap) * c} ${c}`} strokeDashoffset={-done * c} className="mk-ring" style={{ ['--mk-len' as string]: c } as React.CSSProperties} />
        )}
        {done > 0 && (
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={dark ? '#34d399' : '#10b981'} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${Math.max(0, done - gap) * c} ${c}`} className="mk-ring" style={{ ['--mk-len' as string]: c } as React.CSSProperties} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`num-hero text-[26px] ${dark ? 'text-white' : 'text-zinc-900'}`}>{Math.round(done * 100)}%</span>
        <span className={`text-[9px] font-ui font-bold uppercase tracking-[0.1em] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>ready</span>
      </div>
    </div>
  );
};

/* ── Next up ── */

export const NextUp: React.FC<{
  test: MockTest;
  readiness: Readiness;
  today: string;
  dark: boolean;
  onEdit: () => void;
  onLog: () => void;
}> = ({ test, readiness: r, today, dark, onEdit, onLog }) => {
  const t = tokens(dark);
  const d = daysBetween(today, test.date);
  const due = d <= 0;
  const color = examColor(test.exam, dark);
  return (
    <Card dark={dark} className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 90% at 0% 0%, ${color}${dark ? '22' : '14'}, transparent 55%)` }} />
      <div className="relative p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <Eyebrow dark={dark}>Next mock</Eyebrow>
            <div className="flex items-baseline gap-3 mt-3">
              {d > 1 ? (
                <>
                  <span className={`num-hero text-[56px] md:text-[64px] ${t.heading}`}>{d}</span>
                  <span className={`font-display text-[18px] uppercase ${t.muted}`}>days</span>
                </>
              ) : (
                <span className={`num-hero text-[44px] md:text-[56px] uppercase ${due ? 'text-[#E10600]' : t.heading}`}>{d === 1 ? 'Tomorrow' : 'Today'}</span>
              )}
            </div>
            <p className={`font-display text-[20px] md:text-[24px] leading-tight mt-2 ${t.heading}`}>{test.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <ExamBadge exam={test.exam} paperName={test.paperName} dark={dark} size="md" />
              <ScopeBadge scope={test.scope} dark={dark} size="md" />
              <span className={`text-[12px] font-ui ${t.muted}`}>{formatDate(test.date, today)}{test.series ? ` · ${test.series}` : ''}</span>
            </div>
          </div>
          <div className="hidden sm:block"><Ring r={r} dark={dark} /></div>
        </div>

        {test.scope !== 'full' && test.chapters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5">
            {test.chapters.slice(0, 10).map(c => (
              <span key={`${c.classId}${c.subject}${c.chapter}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold border ${dark ? 'border-white/[0.08] text-zinc-300 bg-white/[0.02]' : 'border-zinc-200 text-zinc-700 bg-white/70'}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(c.subject) }} />
                {c.chapter}
                {c.topics?.length ? <span className={t.faint}>· {c.topics.length}</span> : null}
              </span>
            ))}
            {test.chapters.length > 10 && <span className={`px-2 py-1 text-[11px] font-ui ${t.muted}`}>+{test.chapters.length - 10} more</span>}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <div className={`rounded-xl border p-4 ${t.inset}`}>
            <div className="flex items-center gap-3 sm:block">
              <div className="sm:hidden"><Ring r={r} dark={dark} size={64} /></div>
              <div>
                <p className={`text-[12px] font-ui font-bold ${t.heading}`}>{r.done} of {r.total} chapters done{r.started ? `, ${r.started} started` : ''}</p>
                <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>
                  {r.notStarted.length
                    ? `Not started: ${r.notStarted.slice(0, 3).map(c => c.chapter).join(', ')}${r.notStarted.length > 3 ? ` +${r.notStarted.length - 3}` : ''}`
                    : 'Every chapter in this paper is at least started.'}
                </p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl border p-4 ${t.inset}`}>
            <p className={`text-[12px] font-ui font-bold ${t.heading}`}>{r.risky.length ? 'Weak last time — revise these' : 'No weak spots on record here'}</p>
            {r.risky.length ? (
              <ul className="mt-1.5 space-y-1">
                {r.risky.map(l => (
                  <li key={l.key} className={`text-[11px] font-ui flex items-center gap-1.5 ${t.body}`}>
                    <span className={`w-1 h-1 rounded-full ${dark ? 'bg-rose-400' : 'bg-rose-500'}`} />
                    <span className="truncate">{leakName(l)}</span>
                    <span className={t.faint}>· weak ×{l.weak}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>Mark chapters after each mock and this tells you what to revise before the next.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          {due && <button onClick={onLog} className={`${btn} px-5 py-3 ${t.primary}`}>Log result</button>}
          <button onClick={onEdit} className={`${btn} px-4 py-3 ${t.ghost}`}>Edit plan</button>
        </div>
      </div>
    </Card>
  );
};

/* ── History ── */

const verdictChip = (v: MockVerdict, dark: boolean) =>
  v === 'weak' ? (dark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-700')
    : v === 'strong' ? (dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
    : dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-zinc-100 text-zinc-700';

interface RowProps {
  test: MockTest;
  prevPct: number | null;
  open: boolean;
  today: string;
  dark: boolean;
  errorCount: number;
  onToggle: () => void;
  onLog: () => void;
  onEdit: () => void;
  onLogError: () => void;
}

const HistoryRow: React.FC<RowProps> = ({ test, prevPct, open, today, dark, errorCount, onToggle, onLog, onEdit, onLogError }) => {
  const t = tokens(dark);
  const ref = useRef<HTMLDivElement>(null);
  const p = scorePct(test.result);
  const planned = !test.result;
  const overdue = planned && test.date < today;
  const tt = totals(test.result);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);
  const [y, m, d] = test.date.split('-');
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(+y, +m - 1, +d)));
  const verdicts = Object.entries(test.result?.verdicts ?? {}) as [string, MockVerdict][];

  return (
    <div ref={ref} className={`transition-colors ${open ? (dark ? 'bg-white/[0.02]' : 'bg-zinc-50/60') : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={`w-full flex items-center gap-4 px-5 md:px-6 py-4 text-left ${t.hover} transition-colors`}>
        <div className={`w-11 shrink-0 text-center rounded-lg py-1.5 border ${planned ? (dark ? 'border-dashed border-white/[0.12]' : 'border-dashed border-zinc-300') : t.inset}`}>
          <p className={`num-stat text-[17px] ${t.heading}`}>{+d}</p>
          <p className={`text-[9px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>{month}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-ui font-bold truncate ${t.heading}`}>{test.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <ExamBadge exam={test.exam} paperName={test.paperName} dark={dark} />
            <ScopeBadge scope={test.scope} dark={dark} />
            {test.series && <span className={`text-[11px] font-ui truncate ${t.muted}`}>{test.series}</span>}
            {planned && (
              <span className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${overdue ? 'text-[#E10600]' : t.muted}`}>
                {overdue ? 'Needs a score' : relativeDay(test.date, today)}
              </span>
            )}
          </div>
        </div>
        {p !== null ? (
          <div className="text-right shrink-0">
            <p className={`num-stat text-[22px] ${t.heading}`}>{pct(p)}</p>
            {prevPct !== null && <p className={`text-[10px] font-ui font-bold ${deltaTone(p - prevPct, dark)}`}>{signedPct(p - prevPct)}</p>}
          </div>
        ) : overdue ? (
          // A label, not a second button inside this one; the row opens onto "Log result".
          <span className="shrink-0 w-2 h-2 rounded-full bg-[#E10600]" aria-hidden="true" />
        ) : null}
        <svg className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${t.faint}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="px-5 md:px-6 pb-5 mk-fade">
          {test.result ? (
            <div className="grid md:grid-cols-2 gap-5 md:pl-[60px]">
              <div className="space-y-2">
                {test.result.scores.map(s => {
                  const sp = subjectPct(s) ?? 0;
                  return (
                    <div key={s.subject} className="flex items-center gap-3">
                      <span className={`w-20 text-[12px] font-ui ${t.body}`}>{s.subject}</span>
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                        <div className="h-full rounded-full mk-grow-x" style={{ width: `${Math.max(1, Math.min(100, sp))}%`, background: subjectDot(s.subject as Subject) }} />
                      </div>
                      <span className={`w-16 text-right text-[11px] font-ui tabular-nums ${t.muted}`}>{s.marks}/{s.max}</span>
                    </div>
                  );
                })}
                <p className={`text-[11px] font-ui pt-1 ${t.muted}`}>
                  {Math.round(tt.marks * 10) / 10} / {tt.max}
                  {test.result.percentile !== undefined ? ` · ${test.result.percentile} percentile` : ''}
                  {test.result.rank !== undefined ? ` · rank ${test.result.rank.toLocaleString('en-IN')}` : ''}
                </p>
              </div>
              <div className="space-y-3">
                {test.result.mistakes && (
                  <div className="flex flex-wrap gap-1.5">
                    {MISTAKE_ORDER.filter(k => test.result!.mistakes![k]).map(k => (
                      <span key={k} className={`inline-flex items-center gap-1.5 text-[11px] font-ui ${t.body}`}>
                        <span className="w-2 h-2 rounded-sm" style={{ background: MISTAKE_COLORS[k][dark ? 'dark' : 'light'] }} />
                        {test.result!.mistakes![k]} {MISTAKES[k].label.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}
                {verdicts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {verdicts.sort((a, b) => (a[1] === 'weak' ? -1 : 1) - (b[1] === 'weak' ? -1 : 1)).slice(0, 10).map(([k, v]) => {
                      const pk = parseKey(k);
                      return pk ? <span key={k} className={`px-2 py-0.5 rounded-full text-[11px] font-ui font-semibold ${verdictChip(v, dark)}`}>{pk.topic ?? pk.chapter}</span> : null;
                    })}
                  </div>
                )}
                {test.result.note && <p className={`font-accent text-[14px] ${t.heading}`}>“{test.result.note}”</p>}
              </div>
            </div>
          ) : (
            <div className="md:pl-[60px]">
              {test.chapters.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {test.chapters.map(c => (
                    <span key={`${c.subject}${c.chapter}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-ui border ${dark ? 'border-white/[0.08] text-zinc-300' : 'border-zinc-200 text-zinc-700'}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(c.subject) }} />
                      {c.chapter}{c.topics?.length ? ` · ${c.topics.join(', ')}` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={`text-[12px] font-ui ${t.muted}`}>Full syllabus.</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-4 md:pl-[60px]">
            <button onClick={onLog} className={`${btn} px-4 py-2.5 ${planned ? t.primary : t.ghost}`}>{planned ? 'Log result' : 'Edit result'}</button>
            <button onClick={onEdit} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Edit plan</button>
            {!planned && (
              <button onClick={onLogError} className={`${btn} px-4 py-2.5 ${t.ghost}`}>+ Error{errorCount ? ` · ${errorCount} saved` : ''}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const History: React.FC<{
  tests: MockTest[];
  openId: string | null;
  today: string;
  dark: boolean;
  errorCounts: Record<string, number>;
  onToggle: (id: string) => void;
  onLog: (t: MockTest) => void;
  onEdit: (t: MockTest) => void;
  onLogError: (t: MockTest) => void;
  delay?: number;
}> = ({ tests, openId, today, dark, errorCounts, onToggle, onLog, onEdit, onLogError, delay = 0 }) => {
  const t = tokens(dark);
  const newestFirst = [...tests].reverse();
  // Delta against the previous taken mock of the same exam and scope.
  const prev = new Map<string, number | null>();
  const lastBy = new Map<string, number>();
  tests.forEach(x => {
    const p = scorePct(x.result);
    if (p === null) return;
    const k = `${paperKey(x)}|${x.scope}`;
    prev.set(x.id, lastBy.has(k) ? (lastBy.get(k) as number) : null);
    lastBy.set(k, p);
  });
  return (
    <Card dark={dark} delay={delay} className="overflow-hidden">
      <div className="px-5 md:px-6 pt-6 pb-3 flex items-baseline justify-between">
        <Eyebrow dark={dark}>Every mock</Eyebrow>
        <span className={`text-[11px] font-ui ${t.faint}`}>{tests.length} total · Δ vs last of the same kind</span>
      </div>
      <div className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
        {newestFirst.map(x => (
          <HistoryRow
            key={x.id}
            test={x}
            prevPct={prev.get(x.id) ?? null}
            open={openId === x.id}
            today={today}
            dark={dark}
            errorCount={errorCounts[x.id] ?? 0}
            onToggle={() => onToggle(x.id)}
            onLog={() => onLog(x)}
            onEdit={() => onEdit(x)}
            onLogError={() => onLogError(x)}
          />
        ))}
      </div>
    </Card>
  );
};

