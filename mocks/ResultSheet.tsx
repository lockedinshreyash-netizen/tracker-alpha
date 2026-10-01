/* ── Log a result ──
   Scores first — the one thing everybody has — then progressively the things
   that make the analysis sharp: question counts, where the questions went,
   which chapters held and which leaked. Everything after the scores is
   optional, and the sheet says so, because a form that demands a post-mortem
   is a form nobody fills in at 9 pm on a Sunday. */

import React, { useState } from 'react';
import { ExamPreference, MockChapter, MockMistake, MockResult, MockSubjectScore, MockTest, MockVerdict, Subject } from '../types';
import { SingleChapterPicker } from './ChapterPicker';
import { EXAMS, MISTAKES, MISTAKE_COLORS, MISTAKE_ORDER, blankScores, chapterKey, examColor, topicKey, totals } from './model';
import { TakenMock, formatDate } from './insights';
import { ExamBadge, Eyebrow, Field, ScopeBadge, Sheet, btn, deltaTone, signedPct, subjectDot, tokens } from './ui';

interface ScoreDraft {
  subject: Subject;
  marks: string;
  max: string;
  correct: string;
  incorrect: string;
  unattempted: string;
}

const toNum = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const str = (n: number | undefined) => (n === undefined ? '' : String(n));

interface Props {
  test: MockTest;
  previous: TakenMock | null;   // last taken mock of the same exam
  pref: ExamPreference;
  subjects: Subject[];
  today: string;
  dark: boolean;
  errorCount: number;          // errors already logged from this mock
  onSave: (id: string, date: string, result: MockResult) => void;
  onClose: () => void;
  onLogError: (test: MockTest) => void;
}

const VERDICT_STYLE: Record<MockVerdict, { label: string; on: (dark: boolean) => string }> = {
  strong: { label: 'Strong', on: d => (d ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40' : 'bg-emerald-50 text-emerald-700 border-emerald-300') },
  okay: { label: 'Okay', on: d => (d ? 'bg-white/[0.08] text-zinc-200 border-white/20' : 'bg-zinc-100 text-zinc-800 border-zinc-300') },
  weak: { label: 'Weak', on: d => (d ? 'bg-rose-400/15 text-rose-300 border-rose-400/40' : 'bg-rose-50 text-rose-700 border-rose-300') },
};

const VerdictPicker: React.FC<{ value?: MockVerdict; onChange: (v?: MockVerdict) => void; dark: boolean; small?: boolean }> = ({ value, onChange, dark, small }) => (
  <div className="inline-flex gap-1 shrink-0" role="radiogroup">
    {(['strong', 'okay', 'weak'] as MockVerdict[]).map(v => {
      const on = value === v;
      return (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(on ? undefined : v)}
          className={`rounded-md border font-ui font-bold transition-all active:scale-95 ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${on ? VERDICT_STYLE[v].on(dark) : dark ? 'border-white/[0.08] text-zinc-500 hover:text-zinc-300' : 'border-zinc-200 text-zinc-500 hover:text-zinc-800'}`}
        >
          {VERDICT_STYLE[v].label}
        </button>
      );
    })}
  </div>
);

const ResultSheet: React.FC<Props> = ({ test, previous, pref, subjects, today, dark, errorCount, onSave, onClose, onLogError }) => {
  const t = tokens(dark);
  const r = test.result;
  const subjectsHere = r?.scores.map(s => s.subject) ?? subjects;
  const [date, setDate] = useState(r ? test.date : test.date > today ? today : test.date);
  const [scores, setScores] = useState<ScoreDraft[]>(() =>
    (r?.scores ?? blankScores(test.exam, subjectsHere)).map(s => ({
      subject: s.subject,
      marks: r ? str(s.marks) : '',
      max: str(s.max),
      correct: str(s.correct),
      incorrect: str(s.incorrect),
      unattempted: str(s.unattempted),
    })));
  const [breakdown, setBreakdown] = useState(() => !!r?.scores.some(s => s.correct !== undefined));
  const [percentile, setPercentile] = useState(str(r?.percentile));
  const [rank, setRank] = useState(str(r?.rank));
  const [mistakes, setMistakes] = useState<Partial<Record<MockMistake, number>>>(r?.mistakes ?? {});
  const [verdicts, setVerdicts] = useState<Record<string, MockVerdict>>(r?.verdicts ?? {});
  const [note, setNote] = useState(r?.note ?? '');
  // For a full mock, the chapters to review are whichever the student brings up.
  const [extra, setExtra] = useState<MockChapter[]>(() => {
    if (test.scope !== 'full' || !r?.verdicts) return [];
    const seen = new Map<string, MockChapter>();
    Object.keys(r.verdicts).forEach(k => {
      const [cls, subject, chapter] = k.split('|');
      const c = { classId: Number(cls) as 11 | 12, subject: subject as Subject, chapter };
      seen.set(chapterKey(c), c);
    });
    return Array.from(seen.values());
  });

  const scheme = EXAMS[test.exam].scheme;
  const patch = (i: number, p: Partial<ScoreDraft>) => setScores(prev => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));

  /* With a fixed scheme, counts determine marks. Filled in as the counts are
     typed, unless the student has typed marks of their own that disagree —
     a bonus question or a dropped one is theirs to know about, not ours. */
  const fromCounts = (s: ScoreDraft): number | undefined => {
    const c = toNum(s.correct), w = toNum(s.incorrect);
    if (!scheme || c === undefined || w === undefined) return undefined;
    return c * scheme.right + w * scheme.wrong;
  };

  const parsed: MockSubjectScore[] = scores.flatMap(s => {
    const max = toNum(s.max);
    const marks = toNum(s.marks) ?? fromCounts(s);
    if (max === undefined || max <= 0 || marks === undefined) return [];
    const out: MockSubjectScore = { subject: s.subject, marks: Math.max(-max, Math.min(max, marks)), max };
    if (breakdown) {
      const c = toNum(s.correct), w = toNum(s.incorrect), u = toNum(s.unattempted);
      if (c !== undefined) out.correct = Math.max(0, Math.round(c));
      if (w !== undefined) out.incorrect = Math.max(0, Math.round(w));
      if (u !== undefined) out.unattempted = Math.max(0, Math.round(u));
    }
    return [out];
  });
  const total = totals({ scores: parsed });
  const livePct = total.max > 0 ? (total.marks / total.max) * 100 : null;
  const canSave = parsed.length > 0;

  const reviewChapters = test.scope === 'full' ? extra : test.chapters;
  const setVerdict = (key: string, v?: MockVerdict) =>
    setVerdicts(prev => { const next = { ...prev }; if (v) next[key] = v; else delete next[key]; return next; });

  const lostTotal = MISTAKE_ORDER.reduce((a, k) => a + (mistakes[k] ?? 0), 0);
  const marksLost = lostTotal * EXAMS[test.exam].perQuestion;

  const save = () => {
    const result: MockResult = { scores: parsed };
    const p = toNum(percentile); if (p !== undefined) result.percentile = Math.max(0, Math.min(100, p));
    const rk = toNum(rank); if (rk !== undefined && rk >= 1) result.rank = Math.round(rk);
    const m = Object.fromEntries((Object.entries(mistakes) as [MockMistake, number][]).filter(([, v]) => v > 0));
    if (Object.keys(m).length) result.mistakes = m;
    if (Object.keys(verdicts).length) result.verdicts = verdicts;
    if (note.trim()) result.note = note.trim();
    onSave(test.id, date, result);
  };

  const header = (
    <div className="px-5 md:px-7 pt-6 pb-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: examColor(test.exam, dark) }} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>{r ? 'Edit result' : 'Log result'}</p>
          <p className={`font-display text-[22px] leading-tight mt-1.5 truncate ${t.heading}`}>{test.name}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <ExamBadge exam={test.exam} dark={dark} />
            <ScopeBadge scope={test.scope} dark={dark} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`num-hero text-[40px] tabular-nums ${livePct === null ? t.faint : t.heading}`}>{livePct === null ? '—' : `${Math.round(livePct)}%`}</p>
          {livePct !== null && previous && (
            <p className={`text-[11px] font-ui font-bold ${deltaTone(livePct - previous.pct, dark)}`}>{signedPct(livePct - previous.pct)} vs last {EXAMS[test.exam].short}</p>
          )}
          {livePct !== null && <p className={`text-[11px] font-ui ${t.muted}`}>{Math.round(total.marks * 10) / 10} / {total.max}</p>}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-3">
      <button onClick={onClose} className={`${btn} px-4 py-3 ${t.muted}`}>Cancel</button>
      <span className={`flex-1 text-[11px] font-ui ${t.muted} hidden sm:block`}>{canSave ? '' : 'Enter at least one subject’s marks.'}</span>
      <button onClick={save} disabled={!canSave} className={`${btn} px-6 py-3.5 ml-auto ${t.primary}`}>Save result</button>
    </div>
  );

  const numInput = `mk-num ${t.input} !py-2 text-center tabular-nums`;

  return (
    <Sheet dark={dark} onClose={onClose} label="Log result" header={header} footer={footer} width="md:w-[600px]">
      <div className="px-5 md:px-7 py-6 space-y-8">
        <Field label="Taken on" dark={dark}>
          <input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} className={`${t.input} !w-auto`} />
        </Field>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <Eyebrow dark={dark}>Scores</Eyebrow>
            <button type="button" onClick={() => setBreakdown(b => !b)} className={`text-[11px] font-ui font-bold ${breakdown ? 'text-[#E10600]' : t.muted} hover:text-[#E10600]`}>
              {breakdown ? '− Hide question counts' : '+ Add question counts'}
            </button>
          </div>
          <div className="space-y-2.5">
            {scores.map((s, i) => {
              const auto = fromCounts(s);
              const mx = toNum(s.max);
              const mk = toNum(s.marks) ?? auto;
              const p = mx && mk !== undefined ? Math.max(0, Math.min(100, (mk / mx) * 100)) : 0;
              return (
                <div key={s.subject} className={`rounded-xl border p-3.5 ${t.inset}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: subjectDot(s.subject) }} />
                    <span className={`flex-1 text-[13px] font-ui font-bold ${t.heading}`}>{s.subject}</span>
                    <input
                      inputMode="decimal"
                      type="number"
                      aria-label={`${s.subject} marks`}
                      value={s.marks}
                      placeholder={auto !== undefined ? String(auto) : 'Marks'}
                      onChange={e => patch(i, { marks: e.target.value })}
                      className={`${numInput} !w-24 font-bold`}
                    />
                    <span className={`text-[13px] font-ui ${t.faint}`}>/</span>
                    <input inputMode="numeric" type="number" aria-label={`${s.subject} maximum`} value={s.max} onChange={e => patch(i, { max: e.target.value })} className={`${numInput} !w-20`} />
                  </div>
                  <div className={`mt-3 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-zinc-200/70'}`}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${p}%`, background: subjectDot(s.subject) }} />
                  </div>
                  {breakdown && (
                    <div className="grid grid-cols-3 gap-2 mt-3 mk-fade">
                      {([['correct', 'Right'], ['incorrect', 'Wrong'], ['unattempted', 'Skipped']] as const).map(([k, label]) => (
                        <label key={k} className="block">
                          <span className={`block text-[10px] font-ui font-bold uppercase tracking-[0.06em] mb-1 ${t.muted}`}>{label}</span>
                          <input inputMode="numeric" type="number" min={0} aria-label={`${s.subject} ${label.toLowerCase()}`} value={s[k]} onChange={e => patch(i, { [k]: e.target.value } as Partial<ScoreDraft>)} className={numInput} />
                        </label>
                      ))}
                      {auto !== undefined && s.marks === '' && (
                        <p className={`col-span-3 text-[11px] font-ui ${t.muted}`}>Marks worked out as {scheme!.right}×right {scheme!.wrong}×wrong = <b className={t.heading}>{auto}</b>. Type your own if there was a bonus.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="Percentile" dark={dark} hint="Optional">
              <input inputMode="decimal" type="number" value={percentile} onChange={e => setPercentile(e.target.value)} placeholder="e.g. 97.4" className={`mk-num ${t.input}`} />
            </Field>
            <Field label="Rank" dark={dark} hint="Optional">
              <input inputMode="numeric" type="number" value={rank} onChange={e => setRank(e.target.value)} placeholder="e.g. 1240" className={`mk-num ${t.input}`} />
            </Field>
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <Eyebrow dark={dark}>Questions you lost</Eyebrow>
            <span className={`text-[11px] font-ui ${t.muted}`}>{lostTotal ? `${lostTotal} questions · ≈ ${marksLost} marks` : 'Optional — the sharpest data you can give'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {MISTAKE_ORDER.map(k => {
              const v = mistakes[k] ?? 0;
              const c = MISTAKE_COLORS[k][dark ? 'dark' : 'light'];
              return (
                <div key={k} className={`rounded-xl border p-3 flex items-center gap-2 ${t.inset}`} style={v ? { borderColor: `${c}66` } : undefined}>
                  <span className="w-1 self-stretch rounded-full" style={{ background: c, opacity: v ? 1 : 0.35 }} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-ui font-bold ${t.heading}`}>{MISTAKES[k].label}</p>
                    <p className={`text-[10px] font-ui truncate ${t.muted}`}>{MISTAKES[k].hint}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Fewer ${MISTAKES[k].label}`} onClick={() => setMistakes(m => ({ ...m, [k]: Math.max(0, (m[k] ?? 0) - 1) }))} className={`w-7 h-7 rounded-lg text-[15px] font-bold ${dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-white text-zinc-700 border border-zinc-200'} active:scale-90`}>−</button>
                    <span className={`w-6 text-center num-stat text-[16px] ${v ? t.heading : t.faint}`}>{v}</span>
                    <button type="button" aria-label={`More ${MISTAKES[k].label}`} onClick={() => setMistakes(m => ({ ...m, [k]: Math.min(999, (m[k] ?? 0) + 1) }))} className={`w-7 h-7 rounded-lg text-[15px] font-bold ${dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-white text-zinc-700 border border-zinc-200'} active:scale-90`}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onLogError({ ...test, date })}
            className={`mt-3 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-dashed transition-colors ${dark ? 'border-white/[0.12] hover:bg-white/[0.03]' : 'border-zinc-300 hover:bg-zinc-50'}`}
          >
            <span className="text-left">
              <span className={`block text-[13px] font-ui font-bold ${t.heading}`}>Save a question to your Error notebook</span>
              <span className={`block text-[11px] font-ui ${t.muted}`}>{errorCount ? `${errorCount} saved from this mock` : 'Re-attempt it later as a test'}</span>
            </span>
            <span className="text-[#E10600] text-lg font-bold">+</span>
          </button>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <Eyebrow dark={dark}>How each chapter went</Eyebrow>
            <span className={`text-[11px] font-ui ${t.muted}`}>Optional · powers Weak spots</span>
          </div>
          {test.scope === 'full' && (
            <div className="mb-3">
              <p className={`text-[12px] font-ui mb-2 ${t.muted}`}>Add the chapters worth remembering — the ones that cost you, and the ones that held.</p>
              <SingleChapterPicker
                subjects={subjectsHere}
                pref={pref}
                value={null}
                onChange={c => { if (c && !extra.some(x => chapterKey(x) === chapterKey(c))) setExtra(prev => [...prev, c]); }}
                dark={dark}
              />
            </div>
          )}
          {reviewChapters.length === 0 ? (
            test.scope !== 'full' && <p className={`text-[12px] font-ui ${t.muted}`}>This mock has no chapters listed.</p>
          ) : (
            <div className={`rounded-xl border divide-y ${dark ? 'border-white/[0.06] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
              {reviewChapters.map(c => {
                const key = chapterKey(c);
                return (
                  <div key={key} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subjectDot(c.subject) }} />
                      <span className={`flex-1 min-w-0 text-[13px] font-ui font-semibold truncate ${t.heading}`}>{c.chapter}</span>
                      <VerdictPicker value={verdicts[key]} onChange={v => setVerdict(key, v)} dark={dark} />
                      {test.scope === 'full' && (
                        <button type="button" aria-label={`Remove ${c.chapter}`} onClick={() => { setExtra(prev => prev.filter(x => chapterKey(x) !== key)); setVerdict(key); }} className={`text-[13px] ${t.faint} hover:text-[#E10600]`}>✕</button>
                      )}
                    </div>
                    {(c.topics ?? []).length > 0 && (
                      <div className="mt-2 ml-[18px] space-y-1.5">
                        {(c.topics ?? []).map(topic => (
                          <div key={topic} className="flex items-center gap-3">
                            <span className={`flex-1 min-w-0 text-[12px] font-ui truncate ${t.body}`}>{topic}</span>
                            <VerdictPicker small value={verdicts[topicKey(c, topic)]} onChange={v => setVerdict(topicKey(c, topic), v)} dark={dark} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Field label="One thing to fix before the next mock" dark={dark} hint="Optional">
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={280} rows={2} placeholder="e.g. Stop spending 10 minutes on one integration." className={`${t.input} resize-none`} />
        </Field>

        {previous?.test.result?.note && (
          <div className={`rounded-xl border p-4 ${t.inset}`}>
            <Eyebrow dark={dark}>Last time you told yourself</Eyebrow>
            <p className={`font-accent text-[15px] mt-2 ${t.heading}`}>“{previous.test.result.note}”</p>
            <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>{previous.test.name} · {formatDate(previous.test.date, today)}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default ResultSheet;
