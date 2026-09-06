import React, { useEffect, useState } from 'react';
import { BlockKind, ExamPreference, ScheduleBlock, Subject } from '../types';
import { getChaptersFor } from '../constants';
import { ACTIVITIES, BLOCK_KINDS, countsAsStudy } from './colors';
import { DAY_MINUTES, RepeatMode, clampBlock, clashesWith, formatClock, formatRange, formatSpan } from './schedule';

export interface EditorDraft {
  /** Absent for a block being created. */
  id?: string;
  kind: BlockKind;
  subject?: Subject;
  chapter?: string;
  start: number;
  durationMins: number;
  label?: string;
  /** How often it comes back. Applied on save, like every other field. */
  repeat: RepeatMode;
}

interface Props {
  draft: EditorDraft;
  /** Everything else on the day, for the clash warning. */
  dayBlocks: ScheduleBlock[];
  /** Already part of a repeat, so deleting has two meanings. */
  recurring: boolean;
  moved: boolean;
  canEngage: boolean;
  /** "Sunday" — for labelling the weekly option on this date. */
  weekdayName: string;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  currentClass: 11 | 12;
  examPreference: ExamPreference;
  onSave: (draft: EditorDraft) => void;
  /** Just this one day. */
  onDelete: () => void;
  /** Every day it repeats on. */
  onDeleteSeries: () => void;
  onReset: () => void;
  onEngage: () => void;
  onClose: () => void;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

/**
 * Create or edit one block.
 *
 * Ordered by what actually gets decided: what it is, then the detail that only
 * some kinds have, then when. A gym block never sees a subject picker and a
 * study block never sees a free-text name, so the sheet stays about half the
 * length for most of what a day is made of.
 *
 * It is also the fallback for everything the timeline does by gesture — start
 * and length are editable here by number, so nothing in this feature is
 * drag-only.
 */
const BlockEditor: React.FC<Props> = ({
  draft, dayBlocks, recurring, moved, canEngage, weekdayName, theme, activeSubjects,
  currentClass, examPreference, onSave, onDelete, onDeleteSeries, onReset, onEngage, onClose,
}) => {
  const dark = theme === 'dark';
  const [d, setD] = useState<EditorDraft>(draft);
  useEffect(() => setD(draft), [draft]);

  const isStudy = countsAsStudy(d.kind);
  const chapters = isStudy && d.subject ? getChaptersFor(examPreference, currentClass, d.subject) : [];
  const geom = clampBlock(d.start, d.durationMins);
  const clashes = clashesWith(
    { ...(d as ScheduleBlock), id: d.id || '__new__', date: '', ...geom },
    dayBlocks,
  );
  const runsToEndOfDay = geom.start + geom.durationMins >= DAY_MINUTES;

  const set = (patch: Partial<EditorDraft>) => setD(prev => ({ ...prev, ...patch }));

  const pickKind = (kind: BlockKind) => {
    /* Switching families drops the detail that no longer applies, so a block
       cannot quietly keep a subject it stopped having. */
    if (countsAsStudy(kind)) set({ kind, label: undefined, subject: d.subject || activeSubjects[0] });
    else set({ kind, subject: undefined, chapter: undefined });
  };

  const label = `text-[10px] font-bold uppercase tracking-[0.06em] mb-3 font-ui block ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const chip = (on: boolean) =>
    `px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.06em] border rounded-md transition-all font-ui ${
      on
        ? 'bg-[#E10600] text-white border-[#E10600]'
        : dark
          ? 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
    }`;
  const step = `w-9 h-9 rounded-md border text-sm transition-all font-ui ${
    dark ? 'border-white/[0.08] text-zinc-400 hover:text-white' : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'
  }`;
  const field = `w-full px-3.5 py-2.5 rounded-md border text-sm outline-none transition-all font-ui ${
    dark ? 'bg-[#0D0D10] border-white/[0.08] text-white focus:border-white/20'
         : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-300'
  }`;

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full md:w-[470px] md:rounded-xl rounded-t-2xl border p-7 md:p-8 max-h-[88vh] overflow-y-auto ${
          dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-xl'
        }`}
      >
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {d.id ? 'Edit block' : 'New block'}
            </p>
            <p className={`text-lg num-stat mt-1 tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
              {formatRange(geom.start, geom.durationMins)}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
              dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
          >Close</button>
        </div>

        <div className="space-y-7">
          {/* 1 ── What is it. */}
          <div>
            <label className={label}>What</label>
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_KINDS.map(k => (
                <button key={k} onClick={() => pickKind(k)} className={chip(d.kind === k)}>
                  {ACTIVITIES[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* 2 ── Only what this kind actually has. */}
          {isStudy ? (
            <>
              <div>
                <label className={label}>Subject</label>
                <div className="flex flex-wrap gap-1.5">
                  {activeSubjects.map(s => (
                    <button key={s} onClick={() => set({ subject: s, chapter: undefined })} className={chip(d.subject === s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {chapters.length > 0 && (
                <div>
                  <label className={label}>Chapter</label>
                  <select value={d.chapter || ''} onChange={e => set({ chapter: e.target.value || undefined })} className={field}>
                    <option value="">Not decided</option>
                    {chapters.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className={label}>Name <span className="normal-case tracking-normal font-normal">(optional)</span></label>
              <input
                type="text"
                value={d.label || ''}
                onChange={e => set({ label: e.target.value || undefined })}
                placeholder={`e.g. ${d.kind === 'gym' ? 'Leg day' : d.kind === 'class' ? 'School' : d.kind === 'meal' ? 'Dinner' : 'Something else'}`}
                className={field}
                maxLength={60}
              />
            </div>
          )}

          {/* 3 ── When. */}
          <div>
            <label className={label}>Start time</label>
            <div className="flex items-center gap-2">
              <button onClick={() => set(clampBlock(d.start - 15, d.durationMins))} className={step} aria-label="15 minutes earlier">−</button>
              <span className={`flex-1 text-center text-base num-stat tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
                {formatClock(geom.start)}
              </span>
              <button onClick={() => set(clampBlock(d.start + 15, d.durationMins))} className={step} aria-label="15 minutes later">+</button>
            </div>
          </div>

          <div>
            <label className={label}>How long — {formatSpan(geom.durationMins)}</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map(m => (
                <button key={m} onClick={() => set(clampBlock(d.start, m))} className={chip(geom.durationMins === m)}>
                  {formatSpan(m)}
                </button>
              ))}
              <button onClick={() => set(clampBlock(d.start, d.durationMins + 15))} className={chip(false)} aria-label="15 minutes longer">+15m</button>
            </div>
          </div>

          {/* 4 ── How often. Out in the open, because "does this come back
              tomorrow" is a decision, not a setting. */}
          <div>
            <label className={label}>Repeat</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['none', 'Just today'],
                ['daily', 'Every day'],
                ['weekly', `Every ${weekdayName}`],
              ] as [RepeatMode, string][]).map(([mode, text]) => (
                <button key={mode} onClick={() => set({ repeat: mode })} className={chip(d.repeat === mode)}>
                  {text}
                </button>
              ))}
            </div>
          </div>

          {runsToEndOfDay && (
            <p className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
This runs to 4 AM, where the day ends. Add another block tomorrow for the rest.
            </p>
          )}

          {clashes.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#E10600] font-ui">
Overlaps {clashes.length} other block{clashes.length > 1 ? 's' : ''}. You cannot be in two places at once.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-2">
          <button
            onClick={() => onSave({ ...d, ...geom })}
            className="w-full py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 font-ui"
          >
            {d.id ? 'Save' : 'Add'}
          </button>

          {d.id && canEngage && isStudy && (
            <button
              onClick={onEngage}
              className={`w-full py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all active:scale-95 font-ui ${
                dark ? 'border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              Start now
            </button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2">
            {moved && (
              <button onClick={onReset} className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}>
                Undo my change
              </button>
            )}
            {d.id && (
              <button onClick={onDelete} className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#E10600]/70 hover:text-[#E10600] transition-colors font-ui">
                {recurring ? 'Delete from today' : 'Delete'}
              </button>
            )}
            {/* A repeating block needs both meanings spelled out. "Delete"
                alone always removes the wrong one for half the people. */}
            {d.id && recurring && (
              <button onClick={onDeleteSeries} className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#E10600]/70 hover:text-[#E10600] transition-colors font-ui">
                Delete from every day
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockEditor;
