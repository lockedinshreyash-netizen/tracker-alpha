/* ── Question bank ──
   The third view of the Mocks tab, drawn only for accounts holding the `cbt`
   feature (and refused by the database for everyone else regardless). Lazily
   loaded, with KaTeX behind it, so nobody else downloads any of this.

   It owns the CBT's server state — the bank, the sources, the papers — and
   opens the exam and the review over the page. What a finished paper becomes
   in Mocks and the notebook is handed up through `onCbtSaved`, one write. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChapterProgress, ErrorEntry, MockTest } from '../types';
import { getChaptersFor } from '../constants';
import { pushToast } from '../notify/toastBus';
import { isCleared, OPTION_LETTERS } from '../mocks/model';
import { leaks, takenMocks, topLeaks } from '../mocks/insights';
import { Card, Eyebrow, Segmented, btn, subjectDot, tokens } from '../mocks/ui';
import { BankQuestion, BankSource, CbtPaper, CbtSubject, PaperSpec, QAnswer, Resp } from './types';
import {
  createPaper, deletePaper, deleteSource, fetchPapers, fetchQuestions, fetchSources, lastSeenFrom,
  savePaperProgress, updateQuestion,
} from './api';
import { generatePaper, JEE_MAIN, paperTitle } from './generate';
import { scorePaper } from './score';
import { importBundle, parseBundle, ParsedBundle } from './bundle';
import GenerateSheet from './GenerateSheet';
import CbtExam, { clearRun } from './CbtExam';
import PaperReview from './PaperReview';
import Tex, { LooseFigures } from './Tex';

interface Props {
  userId: string;
  tests: MockTest[];
  errors: ErrorEntry[];
  progress: ChapterProgress[];
  today: string;
  dark: boolean;
  /** Open the paper builder as soon as the bank has loaded. */
  startGenerating?: boolean;
  onGeneratingHandled?: () => void;
  onCbtSaved: (mock: MockTest, errors: ErrorEntry[]) => void;
}

type Active = { paper: CbtPaper; mode: 'exam' | 'review' };

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/* ── One question in the review queue ── */

const QueueItem: React.FC<{ q: BankQuestion; dark: boolean; left: number; onSaved: (q: BankQuestion) => void }> = ({ q, dark, left, onSaved }) => {
  const t = tokens(dark);
  const [answer, setAnswer] = useState<QAnswer | null>(q.answer);
  const [numeric, setNumeric] = useState(q.answer && 'value' in q.answer ? String(q.answer.value) : '');
  const [place, setPlace] = useState(q.classId && q.chapter ? `${q.classId}|${q.chapter}` : '');
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(q.body);
  const [busy, setBusy] = useState(false);

  const value = q.kind === 'numerical' ? (numeric.trim() && Number.isFinite(Number(numeric)) ? { value: Number(numeric) } : null) : answer;
  const [cls, chapter] = place ? [Number(place.split('|')[0]) as 11 | 12, place.slice(3)] : [null, null];
  const complete = !!value && !!cls && !!chapter && body.trim().length > 0;

  const save = async (status: 'ready' | 'rejected') => {
    setBusy(true);
    try {
      const next = await updateQuestion(q.id, status === 'rejected'
        ? { status }
        : { status, answer: value, classId: cls as 11 | 12, chapter: chapter as string, body: body.trim() });
      onSaved(next);
    } catch (e) {
      pushToast({ id: 'cbt-queue', title: 'Not saved.', body: errMessage(e), tone: 'neutral' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(q.subject) }} />
        <span className={`text-[12px] font-bold ${t.heading}`}>{q.subject}{q.number ? ` · Q${q.number}` : ''}</span>
        {q.year && <span className={`text-[11px] ${t.faint}`}>{q.year}{q.shift ? ` · ${q.shift}` : ''}</span>}
        {q.confidence !== null && <span className={`text-[11px] ${t.faint}`}>· read with {Math.round(q.confidence * 100)}% confidence</span>}
        <span className={`ml-auto text-[11px] ${t.faint}`}>{left} left</span>
      </div>
      {editing ? (
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className={`${t.input} font-mono text-[12px] leading-relaxed`} />
      ) : (
        <div className={`text-[15px] leading-relaxed ${t.heading}`}>
          <Tex text={body} figures={q.figures} />
          <LooseFigures body={body} options={q.options} figures={q.figures} />
        </div>
      )}
      <button onClick={() => setEditing(e => !e)} className={`mt-2 text-[11px] font-bold underline underline-offset-2 ${t.muted}`}>{editing ? 'Preview' : 'Fix the text'}</button>

      {q.kind === 'mcq' && q.options ? (
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {q.options.map((o, i) => {
            const on = !!answer && 'option' in answer && answer.option === i;
            return (
              <button key={i} type="button" onClick={() => setAnswer({ option: i as 0 | 1 | 2 | 3 })} aria-pressed={on}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left text-[13px] ${on ? (dark ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-emerald-400 bg-emerald-50') : dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}>
                <b className="shrink-0">{OPTION_LETTERS[i]}</b><span className={t.heading}><Tex text={o} figures={q.figures} compact /></span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 max-w-[220px]">
          <input value={numeric} onChange={e => setNumeric(e.target.value)} inputMode="decimal" placeholder="Correct value" className={t.input} />
        </div>
      )}

      <select value={place} onChange={e => setPlace(e.target.value)} className={`${t.input} mt-3`}>
        <option value="">Chapter…</option>
        {([11, 12] as const).map(c => (
          <optgroup key={c} label={`Class ${c}`}>
            {getChaptersFor('JEE', c, q.subject).map(ch => <option key={ch} value={`${c}|${ch}`}>{ch}</option>)}
          </optgroup>
        ))}
      </select>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={() => save('ready')} disabled={!complete || busy} className={`${btn} px-5 py-3 ${t.primary}`}>Looks right</button>
        <button onClick={() => save('rejected')} disabled={busy} className={`${btn} px-4 py-3 ${t.ghost}`}>Reject</button>
        {!complete && <span className={`text-[11px] ${t.muted}`}>{!value ? 'Mark the answer.' : 'Pick the chapter.'}</span>}
      </div>
    </div>
  );
};

/* ── The view ── */

const BankView: React.FC<Props> = ({ userId, tests, errors, progress, today, dark, startGenerating, onGeneratingHandled, onCbtSaved }) => {
  const t = tokens(dark);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [sources, setSources] = useState<BankSource[]>([]);
  const [papers, setPapers] = useState<CbtPaper[]>([]);
  const [generating, setGenerating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [queueTab, setQueueTab] = useState<'needs_review' | 'ungraded'>('needs_review');
  const [pending, setPending] = useState<{ name: string; bundle: ParsedBundle } | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [qs, ss, ps] = await Promise.all([fetchQuestions(), fetchSources(), fetchPapers()]);
      setQuestions(qs);
      setSources(ss);
      setPapers(ps);
    } catch (e) {
      setLoadError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (startGenerating && !loading) { setGenerating(true); onGeneratingHandled?.(); }
  }, [startGenerating, loading, onGeneratingHandled]);

  /* ── Derived ── */
  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const ready = questions.filter(q => q.status === 'ready');
  const review = questions.filter(q => q.status === 'needs_review');
  const ungraded = questions.filter(q => q.status === 'ungraded');
  const lastSeen = useMemo(() => lastSeenFrom(papers), [papers]);
  const openErrors = useMemo(() => new Set(errors.filter(e => e.qbankId && !isCleared(e)).map(e => e.qbankId as string)), [errors]);
  const weakChapters = useMemo(() => new Set(
    topLeaks(leaks(takenMocks(tests), 'JEE'), 20).filter(l => !l.topic).map(l => `${l.classId}|${l.subject}|${l.chapter}`),
  ), [tests]);
  const mockIds = useMemo(() => new Set(tests.map(x => x.id)), [tests]);

  const inProgress = papers.filter(p => !p.submittedAt);
  const unsaved = papers.filter(p => p.submittedAt && (!p.mockId || !mockIds.has(p.mockId)));
  const done = papers.filter(p => p.submittedAt && p.mockId && mockIds.has(p.mockId));

  const coverage = useMemo(() => JEE_MAIN.subjects.map(s => {
    const here = ready.filter(q => q.subject === s);
    const chapters = new Map<string, number>();
    here.forEach(q => chapters.set(q.chapter as string, (chapters.get(q.chapter as string) ?? 0) + 1));
    return {
      subject: s,
      mcq: here.filter(q => q.kind === 'mcq').length,
      numerical: here.filter(q => q.kind === 'numerical').length,
      chapters: Array.from(chapters.entries()).sort((a, b) => b[1] - a[1]),
    };
  }), [ready]);

  /* ── Papers ── */
  const startPaper = async (spec: PaperSpec, seed: number, generated: ReturnType<typeof generatePaper>) => {
    setBuilding(true);
    try {
      const paper = await createPaper({ name: paperTitle(spec), kind: spec.kind, blueprint: generated.blueprint, seed, questionIds: generated.questionIds });
      setPapers(ps => [paper, ...ps]);
      setGenerating(false);
      setActive({ paper, mode: 'exam' });
    } catch (e) {
      pushToast({ id: 'cbt-build', title: 'Could not build the paper.', body: errMessage(e), tone: 'neutral' });
    } finally {
      setBuilding(false);
    }
  };

  const patchPaper = (id: string, p: Partial<CbtPaper>) => {
    setPapers(ps => ps.map(x => (x.id === id ? { ...x, ...p } : x)));
    setActive(a => (a && a.paper.id === id ? { ...a, paper: { ...a.paper, ...p } } : a));
  };

  // Stable per paper, so the exam's save timer is not re-armed on every render here.
  const activeId = active?.paper.id;
  const onProgress = useMemo(() => (responses: Record<string, Resp>, startedAt: string) => {
    if (!activeId) return;
    savePaperProgress(activeId, { responses, startedAt }).catch(() => { /* the local copy holds it; the next save retries */ });
  }, [activeId]);

  const onSubmit = async (paper: CbtPaper, responses: Record<string, Resp>, startedAt: string) => {
    const submittedAt = new Date().toISOString();
    const score = scorePaper({ blueprint: paper.blueprint, responses }, byId);
    const next = { responses, startedAt, submittedAt, score };
    patchPaper(paper.id, next);
    setActive({ paper: { ...paper, ...next }, mode: 'review' });
    try {
      await savePaperProgress(paper.id, next);
      clearRun(paper.id);
    } catch (e) {
      pushToast({ id: 'cbt-submit', title: 'Saved on this device only.', body: `${errMessage(e)} Reopen the paper when you are back online.`, tone: 'neutral' });
    }
  };

  const onSaved = (paper: CbtPaper) => (mock: MockTest, entries: ErrorEntry[]) => {
    onCbtSaved(mock, entries);
    patchPaper(paper.id, { mockId: mock.id });
    setActive(null);
    savePaperProgress(paper.id, { mockId: mock.id }).catch(() => { /* the mock is saved; the link is a convenience */ });
    pushToast({
      id: 'cbt-saved',
      title: 'Saved to Mocks.',
      body: entries.length ? `${entries.length} ${entries.length === 1 ? 'question' : 'questions'} in your error notebook.` : undefined,
      tone: 'neutral',
    });
  };

  const discard = async (paper: CbtPaper) => {
    if (!window.confirm('Delete this paper? Its answers go with it.')) return;
    try {
      await deletePaper(paper.id);
      clearRun(paper.id);
      setPapers(ps => ps.filter(x => x.id !== paper.id));
    } catch (e) {
      pushToast({ id: 'cbt-discard', title: 'Not deleted.', body: errMessage(e), tone: 'neutral' });
    }
  };

  /* ── Import ── */
  const pickFile = async (file: File) => {
    try {
      const bundle = parseBundle(JSON.parse(await file.text()));
      setPending({ name: file.name, bundle });
    } catch (e) {
      pushToast({ id: 'cbt-import', title: 'Not a bundle we can read.', body: errMessage(e), tone: 'neutral' });
    }
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting({ done: 0, total: pending.bundle.questions.length });
    try {
      const report = await importBundle(userId, pending.bundle, (d, n) => setImporting({ done: d, total: n }));
      pushToast({
        id: 'cbt-import',
        title: `${report.added} questions added.`,
        body: [report.duplicates ? `${report.duplicates} already in your bank` : '', report.review ? `${report.review} to check` : '', report.ungraded ? `${report.ungraded} with no answer` : ''].filter(Boolean).join(' · ') || undefined,
        tone: 'neutral',
      });
      setPending(null);
      await load();
    } catch (e) {
      pushToast({ id: 'cbt-import', title: 'Import stopped.', body: errMessage(e), tone: 'neutral' });
    } finally {
      setImporting(null);
    }
  };

  const removeSource = async (s: BankSource) => {
    if (!window.confirm(`Delete “${s.name}” and every question from it?`)) return;
    try {
      await deleteSource(userId, s.id);
      await load();
    } catch (e) {
      pushToast({ id: 'cbt-source', title: 'Not deleted.', body: errMessage(e), tone: 'neutral' });
    }
  };

  /* ── Render ── */
  if (loading) {
    return <Card dark={dark} className="p-10 text-center"><p className={`text-[13px] font-ui ${t.muted}`}>Opening your question bank…</p></Card>;
  }
  if (loadError) {
    return (
      <Card dark={dark} className="p-8">
        <p className={`text-[15px] font-ui font-bold ${t.heading}`}>The bank didn’t load.</p>
        <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>{loadError}</p>
        <button onClick={load} className={`${btn} px-4 py-2.5 mt-4 ${t.ghost}`}>Try again</button>
      </Card>
    );
  }

  const queue = queueTab === 'needs_review' ? review : ungraded;
  const paperRow = (p: CbtPaper, action: React.ReactNode) => (
    <div key={p.id} className="px-5 md:px-6 py-3.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-ui font-bold truncate ${t.heading}`}>{p.name}</p>
        <p className={`text-[11px] font-ui ${t.muted}`}>
          {p.questionIds.length} questions · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {p.score ? ` · ${p.score.marks}/${p.score.max}` : ''}
        </p>
      </div>
      {action}
    </div>
  );

  return (
    <div className="space-y-6 font-ui">
      <div className="flex flex-wrap gap-2.5">
        <button onClick={() => setGenerating(true)} disabled={!ready.length} className={`${btn} px-5 py-3 ${t.primary}`}>+ Build a paper</button>
        <button onClick={() => fileRef.current?.click()} disabled={!!importing} className={`${btn} px-4 py-3 ${t.ghost}`}>Import bundle</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickFile(f); }} />
      </div>

      {/* Pending import */}
      {pending && (
        <Card dark={dark} className="p-5 md:p-6">
          <Eyebrow dark={dark}>Import</Eyebrow>
          <p className={`text-[15px] font-bold mt-2 ${t.heading}`}>{pending.bundle.source.name}</p>
          <p className={`text-[12px] mt-1 ${t.muted}`}>
            {pending.bundle.questions.length} questions
            {' · '}{pending.bundle.questions.filter(q => q.status === 'ready').length} ready
            {' · '}{pending.bundle.questions.filter(q => q.status === 'needs_review').length} to check
            {' · '}{pending.bundle.questions.filter(q => q.status === 'ungraded').length} with no answer
            {pending.bundle.dropped.length ? ` · ${pending.bundle.dropped.length} unusable, skipped` : ''}
          </p>
          {importing ? (
            <div className="mt-4">
              <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <div className="h-full bg-[#E10600] transition-all" style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }} />
              </div>
              <p className={`text-[11px] mt-2 tabular-nums ${t.muted}`}>{importing.done} / {importing.total}</p>
            </div>
          ) : (
            <div className="flex gap-2 mt-4">
              <button onClick={runImport} className={`${btn} px-5 py-3 ${t.primary}`}>Import</button>
              <button onClick={() => setPending(null)} className={`${btn} px-4 py-3 ${t.ghost}`}>Cancel</button>
            </div>
          )}
        </Card>
      )}

      {/* The bank in numbers */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ready', n: ready.length, sub: 'can go in a paper' },
          { label: 'To check', n: review.length, sub: 'read with doubt' },
          { label: 'No answer', n: ungraded.length, sub: 'answer key missing' },
        ].map((x, i) => (
          <Card key={x.label} dark={dark} delay={i * 40} as="div" className="p-4 md:p-5">
            <Eyebrow dark={dark}>{x.label}</Eyebrow>
            <p className={`num-hero text-[28px] md:text-[34px] mt-2 ${t.heading}`}>{x.n}</p>
            <p className={`text-[11px] mt-1 ${t.muted}`}>{x.sub}</p>
          </Card>
        ))}
      </div>

      {!questions.length && (
        <Card dark={dark} className="p-8 md:p-10">
          <p className={`font-display text-[26px] md:text-[32px] leading-tight ${t.heading}`}>Your bank is empty.</p>
          <p className={`text-[13px] mt-2 max-w-md ${t.body}`}>Run the extractor on a PYQ PDF on your laptop (scripts/qbank). It makes a .json bundle. Import it here.</p>
        </Card>
      )}

      {/* Papers */}
      {(inProgress.length > 0 || unsaved.length > 0) && (
        <Card dark={dark} className="overflow-hidden">
          <div className="px-5 md:px-6 pt-5 pb-2"><Eyebrow dark={dark}>Unfinished</Eyebrow></div>
          <div className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
            {inProgress.map(p => paperRow(p, (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => discard(p)} className={`${btn} px-3 py-2.5 ${t.muted} hover:text-[#E10600]`}>Delete</button>
                <button onClick={() => setActive({ paper: p, mode: 'exam' })} className={`${btn} px-4 py-2.5 ${t.primary}`}>{p.startedAt ? 'Resume' : 'Start'}</button>
              </div>
            )))}
            {unsaved.map(p => paperRow(p, (
              <button onClick={() => setActive({ paper: p, mode: 'review' })} className={`${btn} px-4 py-2.5 shrink-0 ${t.primary}`}>Finish review</button>
            )))}
          </div>
        </Card>
      )}

      {/* Review queue */}
      {(review.length > 0 || ungraded.length > 0) && (
        <Card dark={dark} className="overflow-hidden">
          <div className="px-5 md:px-6 pt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Eyebrow dark={dark}>Check these</Eyebrow>
              <p className={`text-[12px] mt-1 ${t.muted}`}>Only checked questions go into papers. A wrong answer key teaches wrong physics.</p>
            </div>
            <Segmented
              value={queueTab}
              onChange={setQueueTab}
              dark={dark}
              label="Queue"
              options={[{ value: 'needs_review', label: `Doubtful ${review.length}` }, { value: 'ungraded', label: `No answer ${ungraded.length}` }]}
            />
          </div>
          {queue[0] ? (
            <QueueItem
              key={queue[0].id}
              q={queue[0]}
              dark={dark}
              left={queue.length}
              onSaved={next => setQuestions(qs => qs.map(x => (x.id === next.id ? next : x)))}
            />
          ) : (
            <p className={`p-6 text-[13px] ${t.muted}`}>Nothing left here.</p>
          )}
        </Card>
      )}

      {/* Coverage */}
      {ready.length > 0 && (
        <Card dark={dark} className="overflow-hidden">
          <button onClick={() => setShowCoverage(s => !s)} className={`w-full px-5 md:px-6 py-4 flex items-center gap-3 text-left ${t.hover}`}>
            <Eyebrow dark={dark} className="flex-1">What’s in the bank</Eyebrow>
            <span className={`text-[11px] ${t.muted}`}>A full paper needs 20 MCQs + 5 numericals per subject</span>
            <svg className={`shrink-0 transition-transform ${showCoverage ? 'rotate-180' : ''} ${t.faint}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div className="px-5 md:px-6 pb-5 grid md:grid-cols-3 gap-5">
            {coverage.map(c => (
              <div key={c.subject}>
                <p className={`text-[13px] font-bold ${t.heading}`}><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: subjectDot(c.subject as CbtSubject) }} />{c.subject}</p>
                <p className={`text-[11px] mt-0.5 ${c.mcq < 20 || c.numerical < 5 ? 'text-amber-500' : t.muted}`}>{c.mcq} MCQ · {c.numerical} numerical</p>
                {showCoverage && (
                  <div className="mt-2 space-y-1">
                    {c.chapters.map(([ch, n]) => (
                      <div key={ch} className={`flex items-center justify-between gap-2 text-[11px] ${t.body}`}><span className="truncate">{ch}</span><span className={`tabular-nums ${t.faint}`}>{n}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Done papers */}
      {done.length > 0 && (
        <Card dark={dark} className="overflow-hidden">
          <div className="px-5 md:px-6 pt-5 pb-2"><Eyebrow dark={dark}>Papers taken</Eyebrow></div>
          <div className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
            {done.slice(0, 10).map(p => paperRow(p, (
              <button onClick={() => setActive({ paper: p, mode: 'review' })} className={`${btn} px-4 py-2.5 shrink-0 ${t.ghost}`}>Review</button>
            )))}
          </div>
        </Card>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <Card dark={dark} className="overflow-hidden">
          <div className="px-5 md:px-6 pt-5 pb-2"><Eyebrow dark={dark}>Imported PDFs</Eyebrow></div>
          <div className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
            {sources.map(s => (
              <div key={s.id} className="px-5 md:px-6 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-bold truncate ${t.heading}`}>{s.name}</p>
                  <p className={`text-[11px] ${t.muted}`}>{questions.filter(q => q.sourceId === s.id).length} questions{s.pages ? ` · ${s.pages} pages` : ''}{s.extractor ? ` · ${s.extractor}` : ''}</p>
                </div>
                <button onClick={() => removeSource(s)} className={`${btn} px-3 py-2 ${t.muted} hover:text-[#E10600]`}>Delete</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {generating && (
        <GenerateSheet
          questions={questions}
          progress={progress}
          lastSeen={lastSeen}
          openErrors={openErrors}
          weakChapters={weakChapters}
          dark={dark}
          busy={building}
          onStart={startPaper}
          onClose={() => setGenerating(false)}
        />
      )}

      {active?.mode === 'exam' && (
        <CbtExam
          key={active.paper.id}
          paper={active.paper}
          questions={byId}
          dark={dark}
          onProgress={onProgress}
          onSubmit={(responses, startedAt) => onSubmit(active.paper, responses, startedAt)}
          onLeave={() => { setActive(null); fetchPapers().then(setPapers).catch(() => { /* the list refreshes next visit */ }); }}
        />
      )}
      {active?.mode === 'review' && (
        <PaperReview
          key={active.paper.id}
          paper={active.paper}
          questions={byId}
          dark={dark}
          tests={tests}
          errors={errors}
          today={today}
          onSave={active.paper.mockId && mockIds.has(active.paper.mockId) ? undefined : onSaved(active.paper)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
};

export default BankView;
