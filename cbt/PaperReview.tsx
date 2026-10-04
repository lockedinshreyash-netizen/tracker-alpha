/* ── After the paper ──
   The score, then the part that is worth more than the score: going through
   every question you lost, saying why, and choosing what goes into the error
   notebook. Saving writes one MockTest (with exact per-subject counts, the
   mistakes you tagged and the chapter verdicts) and the notebook entries in a
   single AppState write — one sync, however many questions.

   Opened again later (from Mocks → Review paper) it is the same screen, read
   only: your answer against the right one, and the time each question took. */

import React, { useMemo, useState } from 'react';
import { ErrorEntry, ErrorReason, MockTest, MockVerdict } from '../types';
import { OPTION_LETTERS, REASONS, REASON_ORDER } from '../mocks/model';
import { generateId } from '../utils';
import { Overlay, btn, pct, subjectDot, tokens } from '../mocks/ui';
import { BankQuestion, CbtPaper, CbtSubject, Resp } from './types';
import { ChapterLine, EMPTY_RESP, Outcome, buildErrors, buildMock, chapterLines, clock, outcomeOf, scorePaper } from './score';
import Tex, { LooseFigures } from './Tex';

interface Props {
  paper: CbtPaper;
  questions: Map<string, BankQuestion>;
  dark: boolean;
  tests: MockTest[];
  errors: ErrorEntry[];
  today: string;
  /** Absent when the paper is already in Mocks: the screen is then read-only. */
  onSave?: (mock: MockTest, errors: ErrorEntry[]) => void;
  onClose: () => void;
}

interface Row { id: string; q: BankQuestion | undefined; subject: CbtSubject; n: number; r: Resp; outcome: Outcome }

const VERDICT_NEXT: Record<string, MockVerdict | null> = { strong: 'okay', okay: 'weak', weak: null, none: 'strong' };
const verdictTone = (v: MockVerdict | null, dark: boolean) =>
  v === 'weak' ? (dark ? 'bg-rose-400/10 text-rose-300 border-rose-400/30' : 'bg-rose-50 text-rose-700 border-rose-200')
    : v === 'strong' ? (dark ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
      : v === 'okay' ? (dark ? 'bg-white/[0.05] text-zinc-300 border-white/[0.08]' : 'bg-zinc-100 text-zinc-700 border-zinc-200')
        : dark ? 'border-dashed border-white/[0.12] text-zinc-500' : 'border-dashed border-zinc-300 text-zinc-400';

const answerText = (q: BankQuestion | undefined, a: number | string | null): string =>
  a === null ? '—' : q?.kind === 'mcq' && typeof a === 'number' ? OPTION_LETTERS[a] : String(a);
const correctText = (q: BankQuestion | undefined): string =>
  !q?.answer ? '—' : 'option' in q.answer ? OPTION_LETTERS[q.answer.option] : String(q.answer.value);

const PaperReview: React.FC<Props> = ({ paper, questions, dark, tests, errors, today, onSave, onClose }) => {
  const t = tokens(dark);
  const readOnly = !onSave;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const n = new Map<CbtSubject, number>();
    paper.blueprint.sections.forEach(sec => sec.ids.forEach(id => {
      const k = (n.get(sec.subject) ?? 0) + 1;
      n.set(sec.subject, k);
      const q = questions.get(id);
      const r = paper.responses[id] ?? EMPTY_RESP;
      out.push({ id, q, subject: sec.subject, n: k, r, outcome: q ? outcomeOf(q, r) : 'skipped' });
    }));
    return out;
  }, [paper, questions]);

  const score = useMemo(() => paper.score ?? scorePaper(paper, questions), [paper, questions]);
  const lines = useMemo(() => chapterLines(paper, questions), [paper, questions]);
  const [verdicts, setVerdicts] = useState<Record<string, MockVerdict | null>>(() => Object.fromEntries(lines.map(l => [l.key, l.verdict])));
  const [reasons, setReasons] = useState<Record<string, ErrorReason>>({});
  const [include, setInclude] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.filter(r => r.outcome === 'wrong').map(r => [r.id, true])));
  const [tab, setTab] = useState<Outcome>(rows.some(r => r.outcome === 'wrong') ? 'wrong' : 'skipped');
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const wrong = rows.filter(r => r.outcome === 'wrong');
  const skipped = rows.filter(r => r.outcome === 'skipped');
  const right = rows.filter(r => r.outcome === 'right');
  const shown = tab === 'wrong' ? wrong : tab === 'skipped' ? skipped : right;
  const attempted = wrong.length + right.length;
  const accuracy = attempted ? (right.length / attempted) * 100 : null;
  const timeUsed = rows.reduce((a, r) => a + r.r.t, 0);
  const slowest = [...rows].filter(r => r.r.t > 0).sort((a, b) => b.r.t - a.r.t).slice(0, 3);
  const untagged = rows.filter(r => include[r.id] && !reasons[r.id]).length;
  const negatives = wrong.length * Math.abs(paper.blueprint.marking.wrong);

  const save = (withNotebook: boolean) => {
    if (!onSave || saving) return;
    setSaving(true);
    const picks = withNotebook
      ? rows.filter(r => include[r.id] && reasons[r.id] && r.q).map(r => ({ q: r.q as BankQuestion, reason: reasons[r.id] }))
      : [];
    const tagged: Record<string, ErrorReason> = {};
    rows.forEach(r => { if (r.outcome === 'wrong' && reasons[r.id]) tagged[r.id] = reasons[r.id]; });
    const kept = Object.fromEntries(Object.entries(verdicts).filter((e): e is [string, MockVerdict] => e[1] !== null));
    const mock = buildMock({ paper, score, verdicts: kept, reasons: tagged, lines, tests, date: today, existingId: paper.mockId ?? undefined });
    const entries = buildErrors({ picks, existing: errors, mockId: mock.id, now: Date.now(), newId: generateId });
    onSave(mock, entries);
  };

  const outcomeBadge = (o: Outcome) => (
    <span className={`text-[10px] font-bold uppercase tracking-[0.06em] ${o === 'right' ? (dark ? 'text-emerald-400' : 'text-emerald-600') : o === 'wrong' ? (dark ? 'text-rose-400' : 'text-rose-600') : t.muted}`}>
      {o === 'right' ? 'Right' : o === 'wrong' ? `Wrong · ${paper.blueprint.marking.wrong}` : 'Skipped'}
    </span>
  );

  const card = (row: Row) => {
    const { q, r } = row;
    const isOpen = open === row.id;
    return (
      <div key={row.id} className={`transition-colors ${isOpen ? (dark ? 'bg-white/[0.02]' : 'bg-zinc-50/60') : ''}`}>
        <button type="button" onClick={() => setOpen(o => (o === row.id ? null : row.id))} aria-expanded={isOpen} className={`w-full text-left px-5 py-3.5 flex items-center gap-3 ${t.hover}`}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subjectDot(row.subject) }} />
          <span className={`text-[13px] font-bold w-14 shrink-0 ${t.heading}`}>{row.subject.slice(0, 4)} {row.n}</span>
          <span className={`text-[12px] truncate flex-1 ${t.muted}`}>{q?.chapter ?? 'Deleted question'}</span>
          {!readOnly && include[row.id] && (
            <span className={`text-[10px] font-bold ${reasons[row.id] ? (dark ? 'text-emerald-400' : 'text-emerald-600') : 'text-amber-500'}`}>{reasons[row.id] ? REASONS[reasons[row.id]].label : 'Why?'}</span>
          )}
          <span className={`text-[11px] tabular-nums w-12 text-right ${t.faint}`}>{clock(r.t)}</span>
        </button>
        {isOpen && q && (
          <div className="px-5 pb-5 pl-[38px] mk-fade">
            <div className="flex items-center gap-2 mb-2">{outcomeBadge(row.outcome)}{q.year && <span className={`text-[11px] ${t.faint}`}>{q.year}{q.shift ? ` · ${q.shift}` : ''}</span>}</div>
            <div className={`text-[15px] leading-relaxed ${t.heading}`}>
              <Tex text={q.body} figures={q.figures} />
              <LooseFigures body={q.body} options={q.options} figures={q.figures} />
            </div>
            {q.kind === 'mcq' && q.options ? (
              <div className="grid sm:grid-cols-2 gap-2 mt-4">
                {q.options.map((o, i) => {
                  const isRight = !!q.answer && 'option' in q.answer && q.answer.option === i;
                  const isMine = r.a === i && row.outcome !== 'skipped';
                  return (
                    <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-[13px] ${isRight
                      ? dark ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-emerald-300 bg-emerald-50'
                      : isMine ? dark ? 'border-rose-400/50 bg-rose-400/10' : 'border-rose-300 bg-rose-50'
                        : dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                      <b className="shrink-0">{OPTION_LETTERS[i]}</b>
                      <span className={t.heading}><Tex text={o} figures={q.figures} compact /></span>
                      {isMine && <span className={`ml-auto shrink-0 text-[10px] font-bold ${t.muted}`}>YOURS</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-[13px] mt-4 ${t.body}`}>
                Correct: <b className={dark ? 'text-emerald-300' : 'text-emerald-700'}>{correctText(q)}</b>
                {row.outcome !== 'skipped' && <> · Yours: <b className={row.outcome === 'right' ? '' : dark ? 'text-rose-300' : 'text-rose-700'}>{answerText(q, r.a)}</b></>}
              </p>
            )}

            {!readOnly && row.outcome !== 'right' && (
              <div className={`mt-5 pt-4 border-t ${t.rule}`}>
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className={`text-[12px] font-bold ${t.heading}`}>Add to error notebook</span>
                  <input type="checkbox" checked={!!include[row.id]} onChange={e => setInclude(x => ({ ...x, [row.id]: e.target.checked }))} className="w-4 h-4 accent-[#E10600]" />
                </label>
                {include[row.id] && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {REASON_ORDER.map(k => {
                      const on = reasons[row.id] === k;
                      return (
                        <button key={k} type="button" onClick={() => setReasons(x => ({ ...x, [row.id]: k }))} aria-pressed={on} title={REASONS[k].hint}
                          className={`px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${on ? (dark ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-900') : dark ? 'border-white/[0.08] text-zinc-400 hover:border-white/[0.16]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                          {REASONS[k].label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const verdictChip = (l: ChapterLine) => {
    const v = verdicts[l.key] ?? null;
    return (
      <button
        key={l.key}
        type="button"
        disabled={readOnly}
        onClick={() => setVerdicts(x => ({ ...x, [l.key]: VERDICT_NEXT[v ?? 'none'] }))}
        title={readOnly ? undefined : 'Tap to change'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${verdictTone(v, dark)}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(l.ref.subject) }} />
        {l.ref.chapter}
        <span className="opacity-60 tabular-nums">{l.right}/{l.right + l.wrong + l.skipped}</span>
      </button>
    );
  };

  return (
    <Overlay>
      <div className={`fixed inset-0 z-[140] flex flex-col font-ui mk-fade ${dark ? 'bg-[#0B0B0D]' : 'bg-[#FAFAF9]'}`} role="dialog" aria-modal="true" aria-label={`${paper.name} — review`}>
        <div className={`shrink-0 flex items-center gap-3 px-4 md:px-6 h-14 border-b ${t.rule}`}>
          <button onClick={onClose} aria-label="Close" className={`w-9 h-9 -ml-2 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-bold uppercase tracking-[0.1em] ${t.muted}`}>{readOnly ? 'Paper review' : 'Go through it'}</p>
            <p className={`text-[14px] font-bold truncate ${t.heading}`}>{paper.name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 space-y-6">
            {/* Score */}
            <div className="mk-rise">
              <p className={`num-hero text-[64px] md:text-[84px] leading-none ${t.heading}`}>
                {score.marks}<span className={`text-[28px] md:text-[34px] ${t.faint}`}> / {score.max}</span>
              </p>
              <p className={`text-[13px] mt-2 ${t.body}`}>
                {right.length} right · {wrong.length} wrong (−{negatives}) · {skipped.length} left · accuracy {pct(accuracy)} · {clock(timeUsed)} used
              </p>
              <div className="mt-5 space-y-2">
                {score.subjects.map(s => (
                  <div key={s.subject} className="flex items-center gap-3">
                    <span className={`w-20 text-[12px] ${t.body}`}>{s.subject}</span>
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                      <div className="h-full rounded-full mk-grow-x" style={{ width: `${Math.max(1, Math.min(100, (Math.max(0, s.marks) / s.max) * 100))}%`, background: subjectDot(s.subject) }} />
                    </div>
                    <span className={`w-28 text-right text-[11px] tabular-nums ${t.muted}`}>{s.marks}/{s.max} · {s.correct}✓ {s.incorrect}✕</span>
                  </div>
                ))}
              </div>
            </div>

            {slowest.length > 0 && (
              <div className={`rounded-xl border p-5 ${t.card}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${t.muted}`}>Where the time went</p>
                <div className="mt-3 space-y-1.5">
                  {slowest.map(r => (
                    <button key={r.id} type="button" onClick={() => { setTab(r.outcome); setOpen(r.id); }} className={`w-full flex items-center gap-3 text-left text-[12px] ${t.body}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(r.subject) }} />
                      <span className="flex-1 truncate">{r.subject} Q{r.n} · {r.q?.chapter ?? '—'}</span>
                      {outcomeBadge(r.outcome)}
                      <span className="tabular-nums w-12 text-right">{clock(r.r.t)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Questions */}
            <div className={`rounded-xl border overflow-hidden ${t.card}`}>
              <div className={`flex gap-1 px-3 pt-3 border-b ${t.rule}`}>
                {([['wrong', wrong.length], ['skipped', skipped.length], ['right', right.length]] as [Outcome, number][]).map(([k, n]) => (
                  <button key={k} onClick={() => { setTab(k); setOpen(null); }} className={`px-3 py-2.5 text-[12px] font-bold border-b-2 -mb-px ${tab === k ? (dark ? 'border-white text-white' : 'border-zinc-900 text-zinc-900') : `border-transparent ${t.muted}`}`}>
                    {k === 'wrong' ? 'Wrong' : k === 'skipped' ? 'Skipped' : 'Right'} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
              {!readOnly && tab === 'wrong' && wrong.length > 0 && (
                <p className={`px-5 pt-4 text-[12px] ${t.muted}`}>Open each one. Say why it went wrong — that is what the notebook and your mistake chart are built from.</p>
              )}
              <div className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
                {shown.length ? shown.map(card) : <p className={`p-6 text-[13px] text-center ${t.muted}`}>Nothing here.</p>}
              </div>
            </div>

            {/* Chapters */}
            {lines.length > 0 && (
              <div className={`rounded-xl border p-5 ${t.card}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${t.muted}`}>Chapters</p>
                  {!readOnly && <p className={`text-[11px] ${t.faint}`}>Tap to change. Weak ones feed your weak spots.</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">{lines.map(verdictChip)}</div>
              </div>
            )}
          </div>
        </div>

        <div className={`shrink-0 border-t px-5 md:px-8 py-3.5 ${t.rule} ${dark ? 'bg-[#0B0B0D]' : 'bg-[#FAFAF9]'}`}>
          <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2.5">
            {readOnly ? (
              <>
                <span className={`flex-1 text-[12px] ${t.muted}`}>Saved to Mocks.</span>
                <button onClick={onClose} className={`${btn} px-6 py-3.5 ${t.ghost}`}>Done</button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-[12px] ${untagged ? 'text-amber-500' : t.muted}`}>
                  {untagged ? `${untagged} still need a reason.` : `${Object.values(include).filter(Boolean).length} going to the notebook.`}
                </span>
                <button onClick={() => save(false)} disabled={saving} className={`${btn} px-4 py-3.5 ${t.ghost}`}>Save without notebook</button>
                <button onClick={() => save(true)} disabled={saving || untagged > 0} className={`${btn} px-6 py-3.5 ${t.primary}`}>Save to Mocks</button>
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
};

export default PaperReview;
