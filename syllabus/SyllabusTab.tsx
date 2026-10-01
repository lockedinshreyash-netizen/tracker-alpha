import React, { useState, useMemo } from 'react';
import { Subject, ChapterProgress, SyllabusStatus, ExamPreference, TopicMastery } from '../types';
import { STATUS_COLORS, STATUS_LABELS, getChaptersFor } from '../constants';
import { getWeight, TIER_LABELS, TIER_STYLES, TIER_ORDER, canShowPercent } from '../content';
import ChapterTest from './ChapterTest';
import { hasCompleteTest } from '../content/questions';
import { SUBJECT_COLORS } from '../schedule/colors';
import { Card, Chip, Eyebrow, Overlay, PageHeader, Segmented, btn, tokens } from '../ui/kit';

interface Props {
  currentClass: 11 | 12;
  progress: ChapterProgress[];
  onToggle: (classId: 11 | 12, subject: Subject, chapter: string) => void;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  examPreference: ExamPreference;
  onTestFinished: (classId: 11 | 12, subject: Subject, chapter: string, results: Record<string, TopicMastery>, allSolid: boolean) => void;
}

type SortMode = 'damage' | 'syllabus';

const SyllabusTab: React.FC<Props> = ({ currentClass, progress, onToggle, theme, activeSubjects, examPreference, onTestFinished }) => {
  const [activeSubject, setActiveSubject] = useState<Subject>('Physics');
  const [sortMode, setSortMode] = useState<SortMode>('damage');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [testFor, setTestFor] = useState<string | null>(null);

  const dark = theme === 'dark';
  const chapters = useMemo(
    () => getChaptersFor(examPreference, currentClass, activeSubject),
    [examPreference, currentClass, activeSubject],
  );

  const statusOf = (chapter: string): SyllabusStatus =>
    progress.find((p) => p.classId === currentClass && p.subject === activeSubject && p.chapter === chapter)?.status
    || 'not_started';

  /** Chapters decorated with their weightage, in the order the user asked for. */
  const rows = useMemo(() => {
    const decorated = chapters.map((chapter) => ({
      chapter,
      weight: getWeight(examPreference, currentClass, activeSubject, chapter),
      status: statusOf(chapter),
      hasTest: hasCompleteTest(currentClass, activeSubject, chapter),
    }));

    if (sortMode === 'damage') {
      decorated.sort((a, b) => {
        const ta = a.weight ? TIER_ORDER[a.weight.tier] : 9;
        const tb = b.weight ? TIER_ORDER[b.weight.tier] : 9;
        if (ta !== tb) return ta - tb;
        return (b.weight?.percent ?? 0) - (a.weight?.percent ?? 0);
      });
    }
    return hideCompleted ? decorated.filter((r) => r.status !== 'completed') : decorated;
  }, [chapters, examPreference, currentClass, activeSubject, progress, sortMode, hideCompleted]);

  /**
   * Percentages are only summed within a single class + subject view. Some
   * chapters share a published figure across Class 11 and 12 (Probability,
   * Relations & Functions), so totalling across classes would overcount —
   * see content/SOURCES.md.
   */
  const stats = useMemo(() => {
    const all = chapters.map((c) => ({ w: getWeight(examPreference, currentClass, activeSubject, c), s: statusOf(c) }));
    const total = all.reduce((a, r) => a + (r.w?.percent ?? 0), 0);
    const secured = all.filter((r) => r.s === 'completed').reduce((a, r) => a + (r.w?.percent ?? 0), 0);
    return {
      completed: all.filter((r) => r.s === 'completed').length,
      total: chapters.length,
      securedPct: total > 0 ? Math.round((secured / total) * 100) : 0,
    };
  }, [chapters, examPreference, currentClass, activeSubject, progress]);

  /**
   * What to open next: the heaviest chapter not yet finished, with foundational
   * chapters winning ties. Never recommends something already completed.
   */
  const nextUp = useMemo(() => {
    const open = chapters
      .map((chapter) => ({ chapter, weight: getWeight(examPreference, currentClass, activeSubject, chapter), status: statusOf(chapter) }))
      .filter((r) => r.status !== 'completed');
    if (!open.length) return null;
    open.sort((a, b) => {
      const ta = a.weight ? TIER_ORDER[a.weight.tier] : 9;
      const tb = b.weight ? TIER_ORDER[b.weight.tier] : 9;
      if (ta !== tb) return ta - tb;
      if (!!b.weight?.foundational !== !!a.weight?.foundational) return a.weight?.foundational ? -1 : 1;
      return (b.weight?.percent ?? 0) - (a.weight?.percent ?? 0);
    });
    return open[0];
  }, [chapters, examPreference, currentClass, activeSubject, progress]);

  const t = tokens(dark);
  /* STATUS_COLORS was tuned for the dark grid; on white its yellow and orange
     text drop below legible contrast, so light mode gets its own ink. */
  const LIGHT_STATUS_TEXT: Record<SyllabusStatus, string> = {
    not_started: 'text-zinc-500', in_progress: 'text-amber-700', practice_pending: 'text-orange-700',
    completed: 'text-emerald-700', revision_pending: 'text-blue-700',
  };
  const statusDot = (st: SyllabusStatus) => (st === 'not_started' ? (dark ? 'bg-zinc-700' : 'bg-zinc-200') : STATUS_COLORS[st].dot);
  const dot = (sub: Subject) => (SUBJECT_COLORS[sub] ?? SUBJECT_COLORS.General).dot;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        dark={dark}
        title="Syllabus"
        subtitle={`Class ${currentClass} ${activeSubject} · ${stats.completed} of ${stats.total} chapters done`}
        right={
          <div className="flex flex-wrap gap-1.5">
            {activeSubjects.filter((sub: Subject) => sub !== 'General').map((sub: Subject) => (
              <Chip key={sub} on={activeSubject === sub} onClick={() => setActiveSubject(sub)} dark={dark} color={dot(sub)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot(sub) }} />
                {sub}
              </Chip>
            ))}
          </div>
        }
      />

      <div className={`grid gap-3 ${nextUp ? 'md:grid-cols-[1.2fr_1fr]' : ''}`}>
        <Card dark={dark} delay={60} className="p-6 md:p-8">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <Eyebrow dark={dark}>Marks locked down</Eyebrow>
              <p className={`num-hero text-[48px] md:text-[56px] mt-3 ${t.heading}`}>
                {stats.securedPct}<span className={`font-ui font-bold text-[22px] ${t.muted}`}>%</span>
              </p>
            </div>
            <div className="text-right shrink-0 pb-1">
              <p className={`num-stat text-[22px] ${t.heading}`}>{stats.completed}<span className={`font-ui text-[13px] ${t.muted}`}> / {stats.total}</span></p>
              <p className={`text-[11px] font-ui ${t.muted}`}>chapters done</p>
            </div>
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden mt-5 ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stats.securedPct}%`, background: dot(activeSubject) }} />
          </div>
          <p className={`text-[12px] font-ui mt-3 leading-relaxed ${t.muted}`}>
            Share of Class {currentClass} {activeSubject} weightage you’ve finished, not the chapter count. Heavy chapters move it faster.
          </p>
        </Card>

        {nextUp && (
          <Card dark={dark} delay={100} className="p-6 md:p-8 relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 90% at 100% 0%, rgba(225,6,0,${dark ? '0.14' : '0.07'}), transparent 60%)` }} />
            <div className="relative flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-[#E10600]">Open this next</p>
              <p className={`font-display text-[22px] md:text-[24px] leading-tight mt-3 ${t.heading}`}>{nextUp.chapter}</p>
              <p className={`text-[12px] font-ui mt-2 ${t.muted}`}>
                {nextUp.weight?.foundational
                  ? 'Everything else in this subject leans on it.'
                  : `The heaviest chapter you haven’t finished${nextUp.weight && canShowPercent(nextUp.weight) ? `, ${nextUp.weight.percent}% of ${activeSubject}` : ''}.`}
              </p>
            </div>
            <button
              onClick={() => onToggle(currentClass, activeSubject, nextUp.chapter)}
              className={`${btn} relative self-start mt-5 px-5 py-3 ${t.primary}`}
            >
              Start it
            </button>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Segmented
          value={sortMode}
          onChange={setSortMode}
          dark={dark}
          label="Order"
          options={[{ value: 'damage', label: 'Heaviest first' }, { value: 'syllabus', label: 'Syllabus order' }]}
        />
        <Chip on={hideCompleted} onClick={() => setHideCompleted((v) => !v)} dark={dark}>Hide finished</Chip>
        <span className={`ml-auto text-[11px] font-ui ${t.faint}`}>Tap a chapter to move it along</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map(({ chapter, weight, status, hasTest }, i) => {
          const colors = STATUS_COLORS[status];
          // Only genuinely low-yield chapters get de-emphasised. A foundational
          // chapter is never dimmed however light its weightage — dropping it
          // is exactly the mistake this grid must not encourage.
          const deEmphasise = weight?.tier === 'low' && !weight.foundational && status !== 'completed';
          const done = status === 'completed';

          return (
            <div
              key={chapter}
              role="button"
              tabIndex={0}
              onClick={() => onToggle(currentClass, activeSubject, chapter)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(currentClass, activeSubject, chapter); } }}
              className={`mk-rise group relative p-5 rounded-xl border cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.99] flex flex-col justify-between min-h-[150px] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40 ${t.card} ${deEmphasise ? 'opacity-55 hover:opacity-100' : ''}`}
              style={{ animationDelay: `${Math.min(i, 14) * 25 + 120}ms` }}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusDot(status)}`} aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-ui font-bold px-2 py-0.5 rounded-full ${dark ? `bg-white/[0.05] ${colors.text}` : `bg-zinc-100 ${LIGHT_STATUS_TEXT[status]}`}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status === 'not_started' ? (dark ? 'bg-zinc-600' : 'bg-zinc-400') : colors.dot}`} />
                    {STATUS_LABELS[status]}
                  </span>
                  {weight && (weight.tier === 'critical' || weight.tier === 'high') && (
                    <span className={`text-[9px] font-ui font-black uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${TIER_STYLES[weight.tier].chip}`}>
                      {TIER_LABELS[weight.tier]}
                    </span>
                  )}
                  {weight?.foundational && (
                    <span className={`text-[9px] font-ui font-black uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${dark ? 'border-sky-400/40 text-sky-300' : 'border-sky-300 text-sky-700'}`}>
                      Core
                    </span>
                  )}
                </div>
                <h4 className={`text-[14px] font-ui font-bold leading-snug ${done ? t.muted : t.heading} ${done ? 'line-through decoration-1' : ''}`}>
                  {chapter}
                </h4>
                {weight && canShowPercent(weight) && (
                  <p className={`text-[11px] font-ui mt-1 tabular-nums ${t.muted}`}>{weight.percent}% of {activeSubject}</p>
                )}
              </div>

              <div className={`flex justify-between items-center mt-4 pt-3 border-t gap-2 ${t.rule}`}>
                {hasTest ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setTestFor(chapter); }}
                    className="text-[11px] font-ui font-bold text-[#E10600] hover:underline"
                  >
                    Test me →
                  </button>
                ) : (
                  <span className={`text-[11px] font-ui ${t.faint}`}>Test coming soon</span>
                )}
                <span className={`text-[10px] font-ui ${t.faint} opacity-0 group-hover:opacity-100 transition-opacity`}>Tap to update</span>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <Card dark={dark} className="py-14 text-center">
          <p className={`text-[15px] font-ui font-bold ${t.heading}`}>Every chapter here is done.</p>
          <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>Switch subjects, or turn off “Hide finished”.</p>
        </Card>
      )}

      {testFor && (
        <Overlay>
          <ChapterTest
            chapter={testFor}
            classId={currentClass}
            subject={activeSubject}
            theme={theme}
            onClose={() => setTestFor(null)}
            onFinish={(results, allSolid) => onTestFinished(currentClass, activeSubject, testFor, results, allSolid)}
          />
        </Overlay>
      )}
    </div>
  );
};

export default SyllabusTab;
