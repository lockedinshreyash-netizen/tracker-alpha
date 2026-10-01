/* ── Mocks ──
   The mock test planner and tracker, and the error notebook beside it.

   A container in the shape schedule/PlanTab.tsx keeps (and the old Questions
   tab established): it takes a narrow slice and two narrow upsert
   callbacks, never AppState or setState. Every number on screen comes from
   mocks/insights.ts; this file only decides what is open.

   The exam/scope filter applies to everything analytical on the page — the
   tiles, the trend, the subjects, the mistakes, the weak spots, the read —
   so "how am I doing in Main full tests" is one tap and every panel agrees on
   it. It is remembered per device in localStorage: a view preference, not
   data, and in AppState it would sync on every tap. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChapterProgress, ErrorEntry, ExamPreference, MockChapter, MockExam, MockResult, MockTest, MocksState, Subject } from '../types';
import { generateId } from '../utils';
import ErrorForm, { ErrorDraft, draftFrom, emptyDraft } from './ErrorForm';
import ErrorNotebook from './ErrorNotebook';
import ErrorQuiz from './ErrorQuiz';
import PlanSheet, { PlanDraft } from './PlanSheet';
import ResultSheet from './ResultSheet';
import TrendChart, { METRIC_LABEL, Metric } from './TrendChart';
import { History, NextUp } from './Timeline';
import { InsightList, LeakBoard, MistakeAnatomy, StatRow, SubjectTrends } from './Panels';
import {
  ExamFilter, ScopeFilter, applyFilter, buildInsights, fixedLeaks, leaks as leaksOf, mistakeMix,
  readiness as readinessOf, subjectTrends, summarize, takenMocks, topLeaks,
} from './insights';
import { EXAMS, SCOPES, SCOPE_ORDER, chapterKey, examColor, isCleared } from './model';
import { Card, Chip, Eyebrow, ScopeGlyph, Segmented, btn, tokens } from './ui';

interface Props {
  mocks: MocksState;
  progress: ChapterProgress[];
  examPreference: ExamPreference;
  subjects: Subject[];
  today: string;
  theme: 'dark' | 'light';
  onUpsertMock: (test: MockTest) => void;
  onDeleteMock: (id: string) => void;
  onUpsertError: (e: ErrorEntry) => void;
  onDeleteError: (id: string) => void;
  onRecordAttempts: (answers: Record<string, boolean>) => void;
  onAddTopic: (key: string, name: string) => void;
  onForgetTopic: (key: string, name: string) => void;
}

type View = 'mocks' | 'errors';
/* `scope` absent means "the sensible default": full-syllabus mocks when there
   are any, because a full paper is the benchmark and a chapter test averaged
   into it inflates every number on the page. */
interface Prefs { view: View; exam: ExamFilter; scope?: ScopeFilter; metric: Metric }
const PREFS_KEY = 'mocks_view_v1';
const loadPrefs = (): Prefs => {
  const fallback: Prefs = { view: 'mocks', exam: 'all', metric: 'score' };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
};

type ErrorCtx = { draft: ErrorDraft; mock?: MockTest };

const MocksTab: React.FC<Props> = ({
  mocks, progress, examPreference: pref, subjects, today, theme,
  onUpsertMock, onDeleteMock, onUpsertError, onDeleteError, onRecordAttempts, onAddTopic, onForgetTopic,
}) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const setPref = (p: Partial<Prefs>) => setPrefs(prev => {
    const next = { ...prev, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* per-device nicety only */ }
    return next;
  });

  const [plan, setPlan] = useState<{ test: MockTest | null; past: boolean } | null>(null);
  const [resultFor, setResultFor] = useState<MockTest | null>(null);
  const [errorCtx, setErrorCtx] = useState<ErrorCtx | null>(null);
  const [quiz, setQuiz] = useState<{ title: string; ids: string[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { tests, errors } = mocks;

  /* ── Derived ── */
  const everything = useMemo(() => takenMocks(tests), [tests]);
  const examsPresent = useMemo(() => Array.from(new Set(everything.map(x => x.test.exam))) as MockExam[], [everything]);
  const scopesPresent = useMemo(() => SCOPE_ORDER.filter(s => everything.some(x => x.test.scope === s)), [everything]);
  // A remembered filter for a classification with no mocks left falls back to everything.
  const exam: ExamFilter = prefs.exam !== 'all' && !examsPresent.includes(prefs.exam) ? 'all' : prefs.exam;
  const wanted: ScopeFilter = prefs.scope ?? (scopesPresent.includes('full') && scopesPresent.length > 1 ? 'full' : 'all');
  const scope: ScopeFilter = wanted !== 'all' && !scopesPresent.includes(wanted) ? 'all' : wanted;
  const series = useMemo(() => applyFilter(everything, exam, scope), [everything, exam, scope]);
  const summary = useMemo(() => summarize(series), [series]);
  const allLeaks = useMemo(() => leaksOf(everything, pref), [everything, pref]);
  const viewLeaks = useMemo(() => leaksOf(series, pref), [series, pref]);
  const upcoming = useMemo(() => tests.filter(x => !x.result && x.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)), [tests, today]);
  const next = upcoming[0] ?? null;
  const nextReadiness = useMemo(() => (next ? readinessOf(next, progress, allLeaks, subjects, pref) : null), [next, progress, allLeaks, subjects, pref]);
  const insights = useMemo(
    () => buildInsights({ series, everything, tests, subjects, allLeaks, progress, pref, today, errors }),
    [series, everything, tests, subjects, allLeaks, progress, pref, today, errors],
  );
  const errorCounts = useMemo(() => {
    const m: Record<string, number> = {};
    errors.forEach(e => { if (e.mockId) m[e.mockId] = (m[e.mockId] ?? 0) + 1; });
    return m;
  }, [errors]);
  const openErrors = errors.filter(e => !isCleared(e)).length;
  const hasPercentile = series.some(x => x.percentile !== null);
  const hasAccuracy = series.some(x => x.accuracy !== null);
  const metric: Metric = (prefs.metric === 'percentile' && !hasPercentile) || (prefs.metric === 'accuracy' && !hasAccuracy) ? 'score' : prefs.metric;

  const previousOf = useCallback((test: MockTest) => {
    const before = everything.filter(x => x.test.exam === test.exam && x.test.id !== test.id && x.test.date <= test.date);
    return before[before.length - 1] ?? null;
  }, [everything]);

  /* ── Writes ── */
  const savePlan = (d: PlanDraft) => {
    const existing = d.id ? tests.find(x => x.id === d.id) : undefined;
    const test: MockTest = {
      ...(existing ?? {}),
      id: d.id ?? generateId(),
      name: d.name.trim().slice(0, 60),
      date: d.date,
      exam: d.exam,
      scope: d.scope,
      chapters: d.scope === 'full' ? [] : d.chapters,
      updatedAt: Date.now(),
    };
    if (d.series.trim()) test.series = d.series.trim().slice(0, 40); else delete test.series;
    onUpsertMock(test);
    const past = plan?.past;
    setPlan(null);
    if (past) setResultFor(test);
  };

  const saveResult = (id: string, date: string, result: MockResult) => {
    const base = tests.find(x => x.id === id) ?? resultFor;
    if (!base) return;
    onUpsertMock({ ...base, date, result, updatedAt: Date.now() });
    setResultFor(null);
    setOpenId(id);
  };

  const openErrorForm = (mock?: MockTest, entry?: ErrorEntry) => {
    setErrorCtx({ draft: entry ? draftFrom(entry) : emptyDraft({ mockId: mock?.id }), mock });
  };

  const saveError = (d: ErrorDraft, again: boolean) => {
    if (d.correct === null || !d.reason || !d.chapter) return;
    const now = Date.now();
    const existing = d.id ? errors.find(e => e.id === d.id) : undefined;
    const entry: ErrorEntry = {
      id: d.id ?? generateId(),
      question: d.question.trim(),
      options: d.options.map(o => o.trim()) as ErrorEntry['options'],
      correct: d.correct,
      reason: d.reason,
      classId: d.chapter.classId,
      subject: d.chapter.subject,
      chapter: d.chapter.chapter,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      attempts: existing?.attempts ?? 0,
      streak: existing?.streak ?? 0,
    };
    if (d.why.trim()) entry.why = d.why.trim();
    if (d.topic) entry.topic = d.topic;
    if (d.mockId) entry.mockId = d.mockId;
    if (existing?.lastResult) entry.lastResult = existing.lastResult;
    if (existing?.lastAttemptAt) entry.lastAttemptAt = existing.lastAttemptAt;
    onUpsertError(entry);
    if (again && errorCtx) {
      // Keep where it lives; clear what it is. The next question is usually from the same chapter.
      setErrorCtx({ ...errorCtx, draft: emptyDraft({ chapter: d.chapter, topic: d.topic, mockId: d.mockId }) });
    } else {
      setErrorCtx(null);
    }
  };

  const errorSuggestions = useMemo((): Pick<MockChapter, 'classId' | 'subject' | 'chapter'>[] => {
    const m = errorCtx?.mock;
    if (m) {
      const weak = Object.entries(m.result?.verdicts ?? {}).filter(([, v]) => v === 'weak').map(([k]) => k);
      const fromWeak = m.chapters.filter(c => weak.includes(chapterKey(c)));
      return [...fromWeak, ...m.chapters.filter(c => !weak.includes(chapterKey(c)))];
    }
    const seen = new Set<string>();
    return [...errors].reverse().flatMap(e => {
      const k = chapterKey(e);
      if (seen.has(k)) return [];
      seen.add(k);
      return [{ classId: e.classId, subject: e.subject, chapter: e.chapter }];
    }).slice(0, 6);
  }, [errorCtx, errors]);

  const quizErrors = useMemo(() => (quiz ? errors.filter(e => quiz.ids.includes(e.id)) : []), [quiz, errors]);

  // Opening a mock from the chart switches to its row.
  const openFromChart = (id: string) => { setOpenId(id); };
  useEffect(() => { if (prefs.view === 'errors') setOpenId(null); }, [prefs.view]);

  /* ── Render ── */
  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Chip on={exam === 'all'} onClick={() => setPref({ exam: 'all' })} dark={dark}>All papers</Chip>
      {examsPresent.map(e => (
        <Chip key={e} on={exam === e} onClick={() => setPref({ exam: e })} dark={dark} color={examColor(e, dark)}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: examColor(e, dark) }} />
          {EXAMS[e].label}
        </Chip>
      ))}
      {scopesPresent.length > 1 && (
        <>
          <span className={`w-px h-5 mx-1 ${dark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
          <Chip on={scope === 'all'} onClick={() => setPref({ scope: 'all' })} dark={dark}>Any syllabus</Chip>
          {scopesPresent.map(s => (
            <Chip key={s} on={scope === s} onClick={() => setPref({ scope: s })} dark={dark}>
              <ScopeGlyph scope={s} color={scope === s ? (dark ? '#000' : '#fff') : dark ? '#a1a1aa' : '#71717a'} size={9} surface={scope === s ? (dark ? '#fff' : '#18181b') : dark ? '#111114' : '#fff'} />
              {SCOPES[s].short}
            </Chip>
          ))}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={`font-display text-[32px] md:text-[40px] leading-none ${t.heading}`}>Mock tests</h1>
          <p className={`text-[13px] font-ui mt-2 ${t.muted}`}>
            {prefs.view === 'mocks'
              ? everything.length ? `${everything.length} taken${upcoming.length ? ` · ${upcoming.length} planned` : ''}. Every one makes the next one count.` : 'Plan them. Take them. Learn from every one.'
              : `${errors.length} saved · ${openErrors} still to beat.`}
          </p>
        </div>
        <Segmented
          value={prefs.view}
          onChange={view => setPref({ view })}
          dark={dark}
          label="View"
          options={[
            { value: 'mocks', label: 'Mocks' },
            { value: 'errors', label: <>Error notebook{openErrors ? <span className="ml-1 px-1.5 rounded-full bg-[#E10600] text-white text-[10px] leading-[16px]">{openErrors}</span> : null}</> },
          ]}
        />
      </div>

      {prefs.view === 'errors' ? (
        <ErrorNotebook
          errors={errors}
          subjects={subjects}
          dark={dark}
          onAdd={() => openErrorForm()}
          onEdit={e => openErrorForm(tests.find(x => x.id === e.mockId), e)}
          onTest={(title, ids) => setQuiz({ title, ids })}
        />
      ) : !tests.length ? (
        <Card dark={dark} className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 80% at 100% 0%, ${dark ? 'rgba(57,135,229,0.16)' : 'rgba(42,120,214,0.08)'}, transparent 60%)` }} />
          <svg className="absolute right-0 bottom-0 w-[60%] max-w-[420px] opacity-[0.5] pointer-events-none" viewBox="0 0 400 160" aria-hidden="true">
            <path d="M0 140 C60 130 80 110 130 112 S210 70 260 76 S340 30 400 22" fill="none" stroke={examColor('mains', dark)} strokeWidth={2.5} className="mk-draw" pathLength={1} style={{ ['--mk-len' as string]: 1 } as React.CSSProperties} />
            {[[130, 112], [260, 76], [400, 22]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={5} fill={examColor('mains', dark)} stroke={t.surface} strokeWidth={2} />)}
          </svg>
          <div className="relative p-8 md:p-12 max-w-xl">
            <Eyebrow dark={dark}>Start here</Eyebrow>
            <p className={`font-display text-[34px] md:text-[44px] leading-[1.02] mt-3 ${t.heading}`}>Mocks are where ranks are made.</p>
            <p className={`font-accent text-[19px] mt-2 ${t.muted}`}>Not in the mock. In what you do after it.</p>
            <ul className={`mt-6 space-y-2 text-[14px] font-ui ${t.body}`}>
              <li>→ Plan your next mock and the chapters in it.</li>
              <li>→ Log the score. See the trend — Main and Advanced kept apart.</li>
              <li>→ Mark weak chapters. We tell you what to fix first.</li>
            </ul>
            <div className="flex flex-wrap gap-2.5 mt-8">
              <button onClick={() => setPlan({ test: null, past: false })} className={`${btn} px-6 py-4 ${t.primary}`}>Plan a mock</button>
              <button onClick={() => setPlan({ test: null, past: true })} className={`${btn} px-5 py-4 ${t.ghost}`}>Log one you took</button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setPlan({ test: null, past: false })} className={`${btn} px-5 py-3 ${t.primary}`}>+ Plan a mock</button>
            <button onClick={() => setPlan({ test: null, past: true })} className={`${btn} px-4 py-3 ${t.ghost}`}>Log one you took</button>
          </div>

          {next && nextReadiness ? (
            <NextUp test={next} readiness={nextReadiness} today={today} dark={dark} onEdit={() => setPlan({ test: next, past: false })} onLog={() => setResultFor(next)} />
          ) : (
            <Card dark={dark} className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className={`text-[15px] font-ui font-bold ${t.heading}`}>Nothing planned.</p>
                <p className={`text-[12px] font-ui mt-0.5 ${t.muted}`}>The students ahead of you already know their next mock date.</p>
              </div>
              <button onClick={() => setPlan({ test: null, past: false })} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Plan the next one</button>
            </Card>
          )}

          {everything.length > 0 && (
            <>
              <div className="pt-2">{filterBar}</div>
              <StatRow s={summary} dark={dark} today={today} />

              <Card dark={dark} delay={160} className="p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <Eyebrow dark={dark}>Trend</Eyebrow>
                    <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>
                      {exam === 'all' ? 'Each paper on its own line' : EXAMS[exam].label}{scope !== 'all' ? ` · ${SCOPES[scope].label.toLowerCase()}` : ''} · {series.length} {series.length === 1 ? 'mock' : 'mocks'}
                    </p>
                  </div>
                  {(hasAccuracy || hasPercentile) && (
                    <Segmented
                      value={metric}
                      onChange={m => setPref({ metric: m })}
                      dark={dark}
                      label="Metric"
                      options={(['score', ...(hasAccuracy ? ['accuracy'] : []), ...(hasPercentile ? ['percentile'] : [])] as Metric[]).map(m => ({ value: m, label: METRIC_LABEL[m] }))}
                    />
                  )}
                </div>
                {series.length ? (
                  <TrendChart key={`${exam}|${scope}|${metric}`} series={series} metric={metric} dark={dark} today={today} onOpen={openFromChart} />
                ) : (
                  <p className={`text-sm font-ui py-10 text-center ${t.muted}`}>No mocks of this kind yet.</p>
                )}
              </Card>

              <InsightList insights={insights} dark={dark} delay={200} />

              <div className="grid lg:grid-cols-2 gap-6">
                <SubjectTrends trends={subjectTrends(series, subjects)} dark={dark} delay={240} />
                <MistakeAnatomy mix={mistakeMix(series)} dark={dark} today={today} delay={280} />
              </div>

              <LeakBoard leaks={viewLeaks.length ? topLeaks(viewLeaks) : []} fixed={fixedLeaks(viewLeaks)} dark={dark} today={today} delay={320} />
            </>
          )}

          {everything.length === 0 && insights.length > 0 && <InsightList insights={insights} dark={dark} />}

          <History
            tests={tests}
            openId={openId}
            today={today}
            dark={dark}
            errorCounts={errorCounts}
            onToggle={id => setOpenId(o => (o === id ? null : id))}
            onLog={x => setResultFor(x)}
            onEdit={x => setPlan({ test: x, past: false })}
            onLogError={x => openErrorForm(x)}
            delay={360}
          />
        </>
      )}

      {plan && (
        <PlanSheet
          initial={plan.test}
          tests={tests}
          pref={pref}
          subjects={subjects}
          progress={progress}
          library={mocks.topics}
          today={today}
          dark={dark}
          onSave={savePlan}
          onDelete={id => { onDeleteMock(id); setPlan(null); setOpenId(null); }}
          onClose={() => setPlan(null)}
          onAddTopic={onAddTopic}
          onForgetTopic={onForgetTopic}
        />
      )}
      {resultFor && (
        <ResultSheet
          test={resultFor}
          previous={previousOf(resultFor)}
          pref={pref}
          subjects={subjects}
          today={today}
          dark={dark}
          errorCount={errorCounts[resultFor.id] ?? 0}
          onSave={saveResult}
          onClose={() => setResultFor(null)}
          onLogError={m => openErrorForm(m)}
        />
      )}
      {errorCtx && (
        <ErrorForm
          initial={errorCtx.draft}
          pref={pref}
          subjects={subjects}
          suggestedChapters={errorSuggestions}
          library={mocks.topics}
          mockName={errorCtx.mock?.name}
          dark={dark}
          onSave={saveError}
          onDelete={id => { onDeleteError(id); setErrorCtx(null); }}
          onClose={() => setErrorCtx(null)}
          onAddTopic={onAddTopic}
          onForgetTopic={onForgetTopic}
        />
      )}
      {quiz && (
        <ErrorQuiz
          title={quiz.title}
          errors={quizErrors}
          dark={dark}
          onFinish={onRecordAttempts}
          onClose={() => setQuiz(null)}
        />
      )}
    </div>
  );
};

export default MocksTab;
