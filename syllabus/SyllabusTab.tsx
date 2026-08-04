import React, { useState, useMemo } from 'react';
import { Subject, ChapterProgress, SyllabusStatus } from '../types';
import { SYLLABUS_DATA, STATUS_COLORS, STATUS_LABELS } from '../constants';

interface Props {
  currentClass: 11 | 12;
  progress: ChapterProgress[];
  onToggle: (classId: 11 | 12, subject: Subject, chapter: string) => void;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
}

const SyllabusTab: React.FC<Props> = ({ currentClass, progress, onToggle, theme, activeSubjects }) => {
  const [activeSubject, setActiveSubject] = useState<Subject>('Physics');
  const chapters = SYLLABUS_DATA[currentClass][activeSubject as 'Physics' | 'Chemistry' | 'Maths' | 'Biology'] || [];

  const subjectStats = useMemo(() => {
    const subjectProgress = progress.filter((p) => p.classId === currentClass && p.subject === activeSubject);
    const completed = subjectProgress.filter((p) => p.status === 'completed').length;
    const revision = subjectProgress.filter((p) => p.status === 'revision_pending').length;
    const active = subjectProgress.filter((p) => p.status === 'in_progress').length;
    return {
      completed,
      revision,
      active,
      total: chapters.length,
      percent: chapters.length > 0 ? Math.round((completed / chapters.length) * 100) : 0
    };
  }, [currentClass, activeSubject, progress, chapters]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-center gap-2 mb-6">
        {activeSubjects.filter((s: Subject) => s !== 'General').map((s: Subject) => (
          <button
            key={s}
            onClick={() => setActiveSubject(s)}
            className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border transition-all rounded-md ${activeSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={`mb-10 p-8 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-zinc-500 tracking-[0.06em] mb-1 font-ui">Subject Mastery</h3>
            <p className="text-2xl font-black italic font-ui">{activeSubject.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl num-stat">{subjectStats.completed}<span className="text-zinc-500 text-sm not-italic ml-1 font-ui">/ {subjectStats.total}</span></p>
            <p className="text-[9px] font-bold uppercase text-zinc-600 font-ui">Chapters Completed</p>
          </div>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
          <div
            className="h-full bg-[#E10600] transition-all duration-700"
            style={{ width: `${subjectStats.percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {chapters.map(chapter => {
          const prog = progress.find((p) => p.classId === currentClass && p.subject === activeSubject && p.chapter === chapter);
          const status = prog?.status || 'not_started';
          const colors = STATUS_COLORS[status as SyllabusStatus];

          return (
            <div
              key={chapter}
              onClick={() => onToggle(currentClass, activeSubject, chapter)}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] flex flex-col justify-between min-h-[120px] card-interactive ${colors.border} ${colors.bg} ${theme === 'dark' ? '' : 'shadow-sm'}`}
            >
              <div>
                <div className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-2 px-2 py-0.5 rounded border w-fit ${colors.label}`}>
                  {STATUS_LABELS[status as SyllabusStatus]}
                </div>
                <h4 className={`text-[11px] md:text-xs font-black uppercase leading-tight tracking-tight ${theme === 'dark' ? 'text-zinc-100' : 'text-black'}`}>
                  {chapter}
                </h4>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">TAP TO CYCLE</p>
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SyllabusTab;
