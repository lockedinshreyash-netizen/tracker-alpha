import React, { useEffect, useState } from 'react';
import { BlockKind, ExamPreference, ScheduleBlock, Subject } from '../types';
import { getChaptersFor } from '../constants';
import { BLOCK_KIND_LABELS, subjectStyle } from './colors';
import { clampBlock, clashesWith, formatClock, formatSpan } from './schedule';

export interface EditorDraft {
  /** Absent for a block being created. */
  id?: string;
  subject: Subject;
  chapter?: string;
  start: number;
  durationMins: number;
  kind: BlockKind;
  label?: string;
}

interface Props {
  draft: EditorDraft;
  /** Everything else on the day, for the clash warning. */
  dayBlocks: ScheduleBlock[];
  recurring: boolean;
  moved: boolean;
  canEngage: boolean;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  currentClass: 11 | 12;
  examPreference: ExamPreference;
  onSave: (draft: EditorDraft) => void;
  onDelete: () => void;
  onReset: () => void;
  onEngage: () => void;
  onMakeWeekly: () => void;
  onClose: () => void;
}

const KINDS: BlockKind[] = ['study', 'revision', 'test', 'break', 'fixed'];
const DURATIONS = [25, 45, 60, 90, 120, 180];

/**
 * Create or edit one block.
 *
 * Also the fallback for everything the timeline does by gesture — start and
 * duration are editable here by number, so nothing in this feature is
 * drag-only.
 */
const BlockEditor: React.FC<Props> = ({
  draft, dayBlocks, recurring, moved, canEngage, theme, activeSubjects,
  currentClass, examPreference, onSave, onDelete, onReset, onEngage, onMakeWeekly, onClose,
}) => {
  const dark = theme === 'dark';
  const [d, setD] = useState<EditorDraft>(draft);
  useEffect(() => setD(draft), [draft]);

  const chapters = getChaptersFor(examPreference, currentClass, d.subject);
  const geom = clampBlock(d.start, d.durationMins);
  const clashes = clashesWith(
    { ...(d as ScheduleBlock), id: d.id || '__new__', date: '', ...geom },
    dayBlocks,
  );

  const set = (patch: Partial<EditorDraft>) => setD(prev => ({ ...prev, ...patch }));

  const nudge = (field: 'start' | 'durationMins', delta: number) => {
    if (field === 'start') set(clampBlock(d.start + delta, d.durationMins));
    else set(clampBlock(d.start, d.durationMins + delta));
  };

  const panel = dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-[#E3E0D9]';
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-md font-ui text-[11px] font-bold uppercase tracking-wider transition-colors ${
      on ? 'bg-[#E10600] text-white'
        : dark ? 'bg-white/[0.04] text-white/50 hover:text-white/80' : 'bg-black/[0.03] text-black/50 hover:text-black/80'
    }`;

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full md:w-[460px] md:rounded-xl rounded-t-2xl border ${panel} p-6 md:p-8 max-h-[88vh] overflow-y-auto`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className={`font-display text-lg uppercase ${dark ? 'text-white' : 'text-[#17150F]'}`}>
              {d.id ? 'EDIT BLOCK' : 'NEW BLOCK'}
            </h3>
            <p className={`font-ui text-[11px] mt-0.5 ${dark ? 'text-white/40' : 'text-black/45'}`}>
              {formatClock(geom.start)} – {formatClock(geom.start + geom.durationMins)} · {formatSpan(geom.durationMins)}
              {recurring && ' · FROM THE WEEKLY TEMPLATE'}
            </p>
          </div>
          <button onClick={onClose} className={`font-ui text-xs ${dark ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}>CLOSE</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Subject</label>
            <div className="flex flex-wrap gap-2">
              {activeSubjects.map(s => {
                const c = subjectStyle(s);
                const on = d.subject === s;
                return (
                  <button
                    key={s}
                    onClick={() => set({ subject: s, chapter: undefined })}
                    className={`px-3 py-1.5 rounded-md border font-ui text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                      on
                        ? dark ? `${c.bg} ${c.border} ${c.text}` : `${c.bgLight} ${c.borderLight} ${c.textLight}`
                        : dark ? 'border-white/[0.06] text-white/40 hover:text-white/70' : 'border-[#E3E0D9] text-black/40 hover:text-black/70'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {chapters.length > 0 && (
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Chapter</label>
              <select
                value={d.chapter || ''}
                onChange={e => set({ chapter: e.target.value || undefined })}
                className={`w-full px-3 py-2 rounded-md border font-ui text-sm outline-none ${
                  dark ? 'bg-[#0D0D10] border-white/[0.08] text-white' : 'bg-white border-[#E3E0D9] text-[#17150F]'
                }`}
              >
                <option value="">— NOT DECIDED —</option>
                {chapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Starts</label>
              <div className="flex items-center gap-1">
                <button onClick={() => nudge('start', -15)} className={chip(false)}>−</button>
                <span className={`num-timer flex-1 text-center text-lg ${dark ? 'text-white' : 'text-[#17150F]'}`}>{formatClock(geom.start)}</span>
                <button onClick={() => nudge('start', 15)} className={chip(false)}>+</button>
              </div>
            </div>
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Runs</label>
              <div className="flex items-center gap-1">
                <button onClick={() => nudge('durationMins', -15)} className={chip(false)}>−</button>
                <span className={`num-timer flex-1 text-center text-lg ${dark ? 'text-white' : 'text-[#17150F]'}`}>{formatSpan(geom.durationMins)}</span>
                <button onClick={() => nudge('durationMins', 15)} className={chip(false)}>+</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DURATIONS.map(m => (
              <button key={m} onClick={() => set(clampBlock(d.start, m))} className={chip(geom.durationMins === m)}>
                {formatSpan(m)}
              </button>
            ))}
          </div>

          <div>
            <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Kind</label>
            <div className="flex flex-wrap gap-2">
              {KINDS.map(k => (
                <button key={k} onClick={() => set({ kind: k })} className={chip(d.kind === k)}>
                  {BLOCK_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <p className={`font-ui text-[10px] mt-2 ${dark ? 'text-white/30' : 'text-black/35'}`}>
              BREAK AND FIXED ARE COMMITMENTS, NOT STUDY. THEY DON'T COUNT TOWARDS THE PLAN.
            </p>
          </div>

          {clashes.length > 0 && (
            <p className="font-ui text-[11px] font-bold uppercase tracking-wider text-[#E10600]">
              CLASHES WITH {clashes.map(c => `${c.subject} ${formatClock(c.start)}`).join(', ')}. YOU CANNOT BE IN TWO PLACES.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-2">
          <button
            onClick={() => onSave({ ...d, ...geom })}
            className="w-full py-3 rounded-md bg-[#E10600] text-white font-ui text-xs font-bold uppercase tracking-[0.18em]"
          >
            {d.id ? 'SAVE' : 'ADD TO THE DAY'}
          </button>

          {d.id && canEngage && (
            <button
              onClick={onEngage}
              className={`w-full py-3 rounded-md border font-ui text-xs font-bold uppercase tracking-[0.18em] ${
                dark ? 'border-white/[0.12] text-white hover:bg-white/[0.04]' : 'border-[#17150F]/20 text-[#17150F] hover:bg-black/[0.03]'
              }`}
            >
              ENGAGE — START THE CLOCK ON THIS
            </button>
          )}

          {d.id && !recurring && (
            <button onClick={onMakeWeekly} className={`w-full py-2.5 font-ui text-[11px] uppercase tracking-wider ${dark ? 'text-white/45 hover:text-white' : 'text-black/45 hover:text-black'}`}>
              MAKE IT WEEKLY
            </button>
          )}

          {moved && (
            <button onClick={onReset} className={`w-full py-2.5 font-ui text-[11px] uppercase tracking-wider ${dark ? 'text-white/45 hover:text-white' : 'text-black/45 hover:text-black'}`}>
              RESET TO THE TEMPLATE
            </button>
          )}

          {d.id && (
            <button onClick={onDelete} className="w-full py-2.5 font-ui text-[11px] uppercase tracking-wider text-[#E10600]/80 hover:text-[#E10600]">
              {recurring ? 'SKIP IT TODAY' : 'DELETE'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockEditor;
