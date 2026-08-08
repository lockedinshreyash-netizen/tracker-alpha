import React, { useState, useMemo } from 'react';
import { Subject, ChapterProgress, SyllabusStatus, ExamPreference } from '../types';
import { STATUS_COLORS, STATUS_LABELS, getChaptersFor } from '../constants';
import { getWeight, revisionNoteFor, TIER_LABELS, TIER_STYLES, TIER_ORDER, canShowPercent } from '../content';
import RevisionSheet from './RevisionSheet';

interface Props {
  currentClass: 11 | 12;
  progress: ChapterProgress[];
  onToggle: (classId: 11 | 12, subject: Subject, chapter: string) => void;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  examPreference: ExamPreference;
}

type SortMode = 'damage' | 'syllabus';

const SyllabusTab: React.FC<Props> = ({ currentClass, progress, onToggle, theme, activeSubjects, examPreference }) => {
  const [activeSubject, setActiveSubject] = useState<Subject>('Physics');
  const [sortMode, setSortMode] = useState<SortMode>('damage');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);

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
      hasSheet: !!revisionNoteFor(currentClass, activeSubject, chapter),
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

  const sheetChapter = sheetFor;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-center gap-2 mb-6">
        {activeSubjects.filter((s: Subject) => s !== 'General').map((s: Subject) => (
          <button
            key={s}
            onClick={() => setActiveSubject(s)}
            className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border transition-all rounded-md active:scale-97 ${activeSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={`mb-6 p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-end mb-4 gap-4">
          <div className="min-w-0">
            <h3 className="text-[10px] font-semibold uppercase text-zinc-500 tracking-[0.06em] mb-1 font-ui">Marks Locked Down</h3>
            <p className="text-2xl font-black italic font-ui truncate">{activeSubject.toUpperCase()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl num-stat">{stats.securedPct}<span className="text-zinc-500 text-lg not-italic font-ui">%</span></p>
            <p className="text-[9px] font-bold uppercase text-zinc-600 font-ui">{stats.completed} / {stats.total} chapters</p>
          </div>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
          <div className="h-full bg-[#E10600] transition-all duration-700" style={{ width: `${stats.securedPct}%` }} />
        </div>
        <p className="text-[9px] text-zinc-600 mt-3 font-ui leading-relaxed">
          Share of Class {currentClass} {activeSubject} weightage you have finished — not the chapter count.
          Finishing the heavy chapters moves this bar faster.
        </p>
      </div>

      {nextUp && (
        <div className={`mb-6 p-5 rounded-xl border flex items-center justify-between gap-4 ${dark ? 'bg-[#E10600]/[0.06] border-[#E10600]/25' : 'bg-red-50 border-red-200'}`}>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#E10600] mb-1.5 font-ui">Open this next</p>
            <p className={`text-sm font-black uppercase leading-tight tracking-tight truncate ${dark ? 'text-white' : 'text-black'}`}>
              {nextUp.chapter}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1 font-ui">
              {nextUp.weight?.foundational
                ? 'Everything else in this subject leans on it.'
                : `Heaviest chapter you have not finished${nextUp.weight && canShowPercent(nextUp.weight) ? ` — ${nextUp.weight.percent}% of ${activeSubject}` : ''}.`}
            </p>
          </div>
          <button
            onClick={() => onToggle(currentClass, activeSubject, nextUp.chapter)}
            className="shrink-0 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97"
          >
            Start
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['damage', 'syllabus'] as SortMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setSortMode(m)}
            className={`px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-all active:scale-97 ${sortMode === m ? (dark ? 'border-white/25 text-white bg-white/[0.06]' : 'border-zinc-400 text-black bg-zinc-100') : (dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400')}`}
          >
            {m === 'damage' ? 'Max damage first' : 'Syllabus order'}
          </button>
        ))}
        <button
          onClick={() => setHideCompleted((v) => !v)}
          className={`px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-all active:scale-97 ${hideCompleted ? (dark ? 'border-white/25 text-white bg-white/[0.06]' : 'border-zinc-400 text-black bg-zinc-100') : (dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400')}`}
        >
          Hide finished
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map(({ chapter, weight, status, hasSheet }) => {
          const colors = STATUS_COLORS[status];
          // Only genuinely low-yield chapters get de-emphasised. A foundational
          // chapter is never dimmed however light its weightage — dropping it
          // is exactly the mistake this grid must not encourage.
          const deEmphasise = weight?.tier === 'low' && !weight.foundational && status !== 'completed';

          return (
            <div
              key={chapter}
              onClick={() => onToggle(currentClass, activeSubject, chapter)}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] flex flex-col justify-between min-h-[142px] card-interactive ${colors.border} ${colors.bg} ${dark ? '' : 'shadow-sm'} ${deEmphasise ? 'opacity-55 hover:opacity-100' : ''}`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className={`text-[8px] font-medium uppercase tracking-[0.06em] px-2 py-0.5 rounded border ${colors.label}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {weight && (
                    <span className={`text-[8px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded border ${TIER_STYLES[weight.tier].chip}`}>
                      {TIER_LABELS[weight.tier]}
                    </span>
                  )}
                  {weight?.foundational && (
                    <span className="text-[8px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded border border-blue-500/40 text-blue-400">
                      Core
                    </span>
                  )}
                </div>
                <h4 className={`text-[11px] md:text-xs font-black uppercase leading-tight tracking-tight ${dark ? 'text-zinc-100' : 'text-black'}`}>
                  {chapter}
                </h4>
                {weight && canShowPercent(weight) && (
                  <p className="text-[9px] text-zinc-500 mt-1.5 font-ui tabular-nums">
                    {weight.percent}% of {activeSubject}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setSheetFor(chapter); }}
                  className={`text-[8px] font-bold uppercase tracking-[0.06em] px-2 py-1 rounded border transition-colors ${hasSheet ? (dark ? 'border-white/15 text-zinc-300 hover:border-white/35 hover:text-white' : 'border-zinc-300 text-zinc-600 hover:border-zinc-500') : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
                >
                  {hasSheet ? 'Revision sheet' : 'Sheet pending'}
                </button>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="text-center text-[11px] text-zinc-500 font-ui py-12 uppercase tracking-[0.08em]">
          Every chapter here is done. Switch subjects.
        </p>
      )}

      {sheetChapter && (
        <RevisionSheet
          chapter={sheetChapter}
          classId={currentClass}
          subject={activeSubject}
          weight={getWeight(examPreference, currentClass, activeSubject, sheetChapter)}
          note={revisionNoteFor(currentClass, activeSubject, sheetChapter)}
          theme={theme}
          onClose={() => setSheetFor(null)}
        />
      )}
    </div>
  );
};

export default SyllabusTab;
