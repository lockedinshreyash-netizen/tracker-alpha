import React, { useEffect, useState } from 'react';
import { BlockKind, ExamPreference, ScheduleBlock, Subject } from '../types';
import { getChaptersFor } from '../constants';
import {
  ACTIVITIES, BLOCK_KINDS, BlockColors, blockStyle, blockTitle, countsAsStudy,
} from './colors';
import {
  DAY_MINUTES, RepeatMode, blockEnd, clampBlock, clashesWith, formatRange, formatSpan,
  fromClockValue, repeatSummary, toClockValue,
} from './schedule';

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
  /** The rule's own days, when they are not "every day" or a single weekday. */
  customDays?: number[];
  moved: boolean;
  canEngage: boolean;
  /** "Sunday" — for labelling the weekly option on this date. */
  weekdayName: string;
  theme: 'dark' | 'light';
  colors?: BlockColors;
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

/* Study first, then the day around it. The gap in the middle is the only
   grouping this row needs — three kinds that are work, seven that are life. */
const STUDY_KINDS = BLOCK_KINDS.filter(countsAsStudy);
const LIFE_KINDS = BLOCK_KINDS.filter(k => !countsAsStudy(k));

/**
 * Create or edit one block.
 *
 * The sheet is one sentence read downward: what it is, the detail only that
 * kind has, when, and how often. A gym block never sees a subject picker and a
 * study block never sees a free-text name, so most of what a day is made of
 * fits without scrolling.
 *
 * Two rules keep it from turning back into a wall of chips.
 *
 * **Colour carries the selection where colour means something.** A chip that
 * names a coloured thing — a kind, a subject — wears that colour when it is
 * chosen, so the row doubles as the legend and the header previews what you
 * are about to put on the grid. A chip that names a plain value — a duration,
 * a repeat — wears the accent, like every other control in the app. Ten
 * identical red chips told you what was selected and nothing else.
 *
 * **Time is typed, not stepped.** Start and end are real time inputs, so 6:45
 * is one entry rather than five taps on a ±15 stepper, the phone keyboard is
 * the one the OS already has for this, and the duration row becomes a
 * shortcut rather than the only way through. Typing an end of 1:30 on an
 * 11 PM block gives two and a half hours, because `fromClockValue` puts 1:30
 * later on the study-day axis — the wrap costs nothing here.
 */
const BlockEditor: React.FC<Props> = ({
  draft, dayBlocks, recurring, customDays, moved, canEngage, weekdayName, theme, colors,
  activeSubjects, currentClass, examPreference,
  onSave, onDelete, onDeleteSeries, onReset, onEngage, onClose,
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
  const c = blockStyle(d, colors);

  const set = (patch: Partial<EditorDraft>) => setD(prev => ({ ...prev, ...patch }));

  const pickKind = (kind: BlockKind) => {
    /* Switching families drops the detail that no longer applies, so a block
       cannot quietly keep a subject it stopped having. */
    if (countsAsStudy(kind)) set({ kind, label: undefined, subject: d.subject || activeSubjects[0] });
    else set({ kind, subject: undefined, chapter: undefined });
  };

  const setStart = (value: string) => {
    const m = fromClockValue(value);
    if (m !== null) set(clampBlock(m, d.durationMins));
  };

  const setEnd = (value: string) => {
    const m = fromClockValue(value);
    if (m !== null) set(clampBlock(geom.start, m - geom.start));
  };

  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] mb-3 font-ui block ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const muted = `text-[10px] font-medium uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`;
  const quiet = `text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
    dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
  }`;

  /* A value chip: durations, repeat. Accent when on, like the rest of the app. */
  const chip = (on: boolean) =>
    `px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.06em] border rounded-md transition-all active:scale-95 font-ui ${
      on
        ? 'bg-[#E10600] text-white border-[#E10600]'
        : dark
          ? 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
    }`;

  /* A colour chip: kinds and subjects, which have a colour of their own. */
  const swatchChip = (on: boolean, style: ReturnType<typeof blockStyle>) => ({
    className: `flex items-center gap-2 pl-2.5 pr-3.5 py-2 border rounded-md transition-all active:scale-95 text-[10px] font-medium uppercase tracking-[0.06em] font-ui ${
      on ? '' : dark ? 'border-white/[0.08] text-zinc-400 hover:border-white/20' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
    }`,
    style: on
      ? {
          background: dark ? style.bg : style.bgLight,
          borderColor: style.dot,
          color: dark ? style.text : style.textLight,
        }
      : undefined,
  });

  const field = `px-3.5 py-2.5 rounded-md border text-sm outline-none transition-all font-ui ${
    dark ? 'bg-[#0D0D10] border-white/[0.08] text-white focus:border-white/20'
         : 'bg-white border-zinc-200 text-zinc-900 focus:border-zinc-300'
  }`;

  const kindChip = (k: BlockKind) => {
    const style = blockStyle({ kind: k, subject: countsAsStudy(k) ? d.subject : undefined }, colors);
    const on = d.kind === k;
    const { className, style: onStyle } = swatchChip(on, style);
    return (
      <button key={k} onClick={() => pickKind(k)} className={className} style={onStyle}>
        <span style={{ background: style.dot }} className="w-2 h-2 rounded-full shrink-0" />
        {ACTIVITIES[k].label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full md:w-[470px] md:rounded-xl rounded-t-2xl border max-h-[88vh] overflow-y-auto ${
          dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-xl'
        }`}
      >
        {/* The block itself, in the colour it will actually be. Editing a thing
            should look like the thing. */}
        <div
          style={{ background: dark ? c.bg : c.bgLight, borderColor: dark ? c.border : c.borderLight }}
          className="border-b px-7 md:px-8 pt-7 pb-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex items-start gap-3">
              <span style={{ background: c.dot }} className="w-1 h-10 rounded-full shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p
                  style={{ color: dark ? c.text : c.textLight }}
                  className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui truncate"
                >
                  {blockTitle(d)}
                </p>
                <p className={`text-xl num-stat mt-1 tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
                  {formatRange(geom.start, geom.durationMins)}
                </p>
                <p className={`${muted} mt-1`}>
                  {formatSpan(geom.durationMins)}
                  {d.chapter ? ` · ${d.chapter}` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`${quiet} shrink-0`}>Close</button>
          </div>
        </div>

        <div className="px-7 md:px-8 py-7 space-y-7">
          {/* 1 ── What is it. Work on the left of the gap, life on the right. */}
          <div>
            <label className={eyebrow}>What</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {STUDY_KINDS.map(kindChip)}
              <span className={`w-px h-5 mx-1 shrink-0 ${dark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
              {LIFE_KINDS.map(kindChip)}
            </div>
          </div>

          {/* 2 ── Only what this kind actually has. */}
          {isStudy ? (
            <>
              <div>
                <label className={eyebrow}>Subject</label>
                <div className="flex flex-wrap gap-1.5">
                  {activeSubjects.map(s => {
                    const style = blockStyle({ kind: 'study', subject: s }, colors);
                    const { className, style: onStyle } = swatchChip(d.subject === s, style);
                    return (
                      <button
                        key={s}
                        onClick={() => set({ subject: s, chapter: undefined })}
                        className={className}
                        style={onStyle}
                      >
                        <span style={{ background: style.dot }} className="w-2 h-2 rounded-full shrink-0" />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              {chapters.length > 0 && (
                <div>
                  <label className={eyebrow}>Chapter</label>
                  <select
                    value={d.chapter || ''}
                    onChange={e => set({ chapter: e.target.value || undefined })}
                    className={`${field} w-full`}
                  >
                    <option value="">Not decided</option>
                    {chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className={eyebrow}>Name <span className="normal-case tracking-normal font-normal">(optional)</span></label>
              <input
                type="text"
                value={d.label || ''}
                onChange={e => set({ label: e.target.value || undefined })}
                placeholder={`e.g. ${d.kind === 'gym' ? 'Leg day' : d.kind === 'class' ? 'School' : d.kind === 'meal' ? 'Dinner' : 'Something else'}`}
                className={`${field} w-full`}
                maxLength={60}
              />
            </div>
          )}

          {/* 3 ── When. Typed, with the common lengths one tap away. */}
          <div>
            <label className={eyebrow}>When</label>
            <div className="flex items-center gap-2.5">
              <input
                type="time"
                value={toClockValue(geom.start)}
                onChange={e => setStart(e.target.value)}
                aria-label="Starts at"
                style={{ colorScheme: dark ? 'dark' : 'light' }}
                className={`${field} flex-1 tabular-nums`}
              />
              <span className={`${muted} shrink-0`}>to</span>
              <input
                type="time"
                value={toClockValue(blockEnd(geom))}
                onChange={e => setEnd(e.target.value)}
                aria-label="Ends at"
                style={{ colorScheme: dark ? 'dark' : 'light' }}
                className={`${field} flex-1 tabular-nums`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {DURATIONS.map(m => (
                <button key={m} onClick={() => set(clampBlock(d.start, m))} className={chip(geom.durationMins === m)}>
                  {formatSpan(m)}
                </button>
              ))}
            </div>
          </div>

          {/* 4 ── How often. Out in the open, because "does this come back
              tomorrow" is a decision, not a setting. */}
          <div>
            <label className={eyebrow}>Repeat</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['none', 'Just today'],
                ['daily', 'Every day'],
                ['weekly', `Every ${weekdayName}`],
                /* A Mon–Fri slot is a real thing the weekly template can hold
                   and these three buttons cannot name. Showing it keeps Save
                   from quietly reducing it to whichever day you opened it on. */
                ...(customDays && customDays.length > 0
                  ? [['custom', repeatSummary(customDays)] as [RepeatMode, string]]
                  : []),
              ] as [RepeatMode, string][]).map(([mode, text]) => (
                <button key={mode} onClick={() => set({ repeat: mode })} className={chip(d.repeat === mode)}>
                  {text}
                </button>
              ))}
            </div>
            {recurring && (
              <p className={`${muted} mt-3`}>
Saving here changes every day it repeats on. To move one day only, drag it on the grid.
              </p>
            )}
          </div>

          {(runsToEndOfDay || clashes.length > 0) && (
            <div className="space-y-2">
              {runsToEndOfDay && (
                <p className={muted}>
This runs to 4 AM, where the day ends. Add another block tomorrow for the rest.
                </p>
              )}
              {clashes.length > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#E10600] font-ui">
                  {/* Naming it beats counting it — "overlaps 1 other block" made
                      you close the sheet to find out which. */}
                  Overlaps {clashes.slice(0, 2).map(b => blockTitle(b)).join(' and ')}
                  {clashes.length > 2 ? ` +${clashes.length - 2} more` : ''}. You cannot be in two places at once.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky, because on a phone this sheet scrolls: the one button that
            commits the block should never be somewhere you have to go and find. */}
        <div
          className={`sticky bottom-0 px-7 md:px-8 pb-7 pt-4 border-t ${
            dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'
          }`}
        >
          {/* Side by side rather than stacked: this bar is pinned, so every row
              it grows by is a row taken off the sheet above it. */}
          <div className="flex gap-2">
            <button
              onClick={() => onSave({ ...d, ...geom })}
              className="flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 font-ui"
            >
              {d.id ? 'Save' : 'Add'}
            </button>

            {d.id && canEngage && isStudy && (
              <button
                onClick={onEngage}
                className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all active:scale-95 font-ui ${
                  dark ? 'border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                Start now
              </button>
            )}
          </div>

          {d.id && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4">
              {moved && <button onClick={onReset} className={quiet}>Undo my change</button>}
              <button onClick={onDelete} className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#E10600]/70 hover:text-[#E10600] transition-colors font-ui">
                {recurring ? 'Delete from today' : 'Delete'}
              </button>
              {/* A repeating block needs both meanings spelled out. "Delete"
                  alone always removes the wrong one for half the people. */}
              {recurring && (
                <button onClick={onDeleteSeries} className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#E10600]/70 hover:text-[#E10600] transition-colors font-ui">
                  Delete from every day
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockEditor;
