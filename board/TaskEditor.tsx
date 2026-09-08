import React, { useState } from 'react';
import { Subject, Task } from '../types';
import { PRESET_COLORS, derive, subjectStyle } from '../schedule/colors';
import { fromClockValue, toClockValue } from '../schedule/schedule';
import { addDays } from '../utils';
import { dueChoices, taskStyle } from './board';

interface Props {
  task: Task;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  today: string;
  onSave: (patch: Partial<Omit<Task, 'id'>>) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Edit one card.
 *
 * Follows schedule/BlockEditor.tsx rather than inventing a second sheet
 * language: colour carries the selection where colour means something (a
 * subject chip and a swatch wear their own colour when chosen, so the row
 * doubles as the legend), plain values wear the accent, time is typed rather
 * than stepped, and the footer is sticky so the button that commits the card is
 * never something you scroll to find.
 */
const TaskEditor: React.FC<Props> = ({ task, theme, activeSubjects, today, onSave, onDelete, onClose }) => {
  const dark = theme === 'dark';
  const [text, setText] = useState(task.text);
  const [subject, setSubject] = useState<Subject>(task.subject ?? 'General');
  const [color, setColor] = useState<string | undefined>(task.color);
  const [dueAt, setDueAt] = useState<string | undefined>(task.dueAt);
  const [dueMinute, setDueMinute] = useState<number | undefined>(task.dueMinute);

  const preview = taskStyle({ color, subject });
  const chips = dueChoices(today);

  const save = () => {
    const value = text.trim();
    if (!value) return;
    onSave({
      text: value,
      subject,
      color,
      dueAt,
      /* A time with no date is meaningless, and would sit in the blob forever
         waiting for a date that may never come. */
      dueMinute: dueAt ? dueMinute : undefined,
    });
  };

  const panel = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]';
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const field = `w-full text-[12px] font-bold uppercase tracking-tight p-3 rounded-lg border focus:outline-none focus:ring-1 focus:ring-white/20 font-ui ${dark ? 'bg-black/30 border-white/[0.06] text-white' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F]'}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit task"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full md:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border ${panel}`}
      >
        {/* The header previews the card you are about to save — the same trick
            BlockEditor uses, so the colour choices below have somewhere to
            land rather than being abstract swatches. */}
        <div
          className="px-6 py-5 border-b"
          style={{
            background: dark ? preview.bg : preview.bgLight,
            borderColor: dark ? preview.border : preview.borderLight,
          }}
        >
          <p className="text-[9px] font-medium uppercase tracking-[0.06em] font-ui" style={{ color: dark ? preview.text : preview.textLight }}>
            {subject}
          </p>
          <p className={`text-[13px] font-bold uppercase tracking-tight mt-1 font-ui ${dark ? 'text-white' : 'text-[#17150F]'}`}>
            {text.trim() || 'Untitled task'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className={`${eyebrow} block mb-2`}>Task</label>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className={field}
              autoFocus
            />
          </div>

          <div>
            <label className={`${eyebrow} block mb-2`}>Subject</label>
            <div className="flex flex-wrap gap-2">
              {activeSubjects.map(s => {
                const on = subject === s;
                const c = s === 'General' ? null : subjectStyle(s);
                return (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className="text-[9px] px-4 py-2 font-bold uppercase tracking-[0.06em] border rounded-md transition-all font-ui"
                    style={on && c
                      ? { background: dark ? c.bg : c.bgLight, borderColor: c.dot, color: dark ? c.text : c.textLight }
                      : on
                        ? { background: '#E10600', borderColor: '#E10600', color: '#fff' }
                        : { borderColor: dark ? 'rgba(255,255,255,0.06)' : '#E3E0D9', color: dark ? '#71717a' : '#8A8577' }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`${eyebrow} block mb-2`}>Colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {/* Clearing falls back to the subject's colour, which is what
                  almost every card should wear — the override is the exception,
                  so it has to be easy to undo. */}
              <button
                onClick={() => setColor(undefined)}
                className={`text-[9px] px-3 py-2 font-bold uppercase tracking-[0.06em] border rounded-md font-ui ${!color ? 'border-[#E10600] text-[#E10600]' : dark ? 'border-white/[0.06] text-zinc-600' : 'border-[#E3E0D9] text-[#8A8577]'}`}
              >
                Subject
              </button>
              {PRESET_COLORS.map(hex => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  aria-label={`Colour ${hex}`}
                  className="w-7 h-7 rounded-md border-2 transition-transform active:scale-95"
                  style={{
                    background: derive(hex).dot,
                    borderColor: color?.toLowerCase() === hex.toLowerCase()
                      ? (dark ? '#fff' : '#17150F')
                      : 'transparent',
                  }}
                />
              ))}
              <input
                type="color"
                value={color ?? '#868E96'}
                onChange={e => setColor(e.target.value)}
                aria-label="Custom colour"
                className="w-7 h-7 rounded-md bg-transparent border-0 p-0 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className={`${eyebrow} block mb-2`}>Deadline</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => { setDueAt(undefined); setDueMinute(undefined); }}
                className={`text-[9px] px-4 py-2 font-bold uppercase tracking-[0.06em] border rounded-md font-ui ${!dueAt ? 'bg-[#E10600] border-[#E10600] text-white' : dark ? 'border-white/[0.06] text-zinc-600' : 'border-[#E3E0D9] text-[#8A8577]'}`}
              >
                None
              </button>
              {chips.map(c => (
                <button
                  key={c.date}
                  onClick={() => setDueAt(c.date)}
                  className={`text-[9px] px-4 py-2 font-bold uppercase tracking-[0.06em] border rounded-md font-ui ${dueAt === c.date ? 'bg-[#E10600] border-[#E10600] text-white' : dark ? 'border-white/[0.06] text-zinc-600' : 'border-[#E3E0D9] text-[#8A8577]'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={dueAt ?? ''}
                min={today}
                onChange={e => setDueAt(e.target.value || undefined)}
                className={`${field} flex-1`}
              />
              {/* Only once there is a date to attach it to. Optional by design:
                  most deadlines are a day, not a moment, and the reminder falls
                  back to the hour set once in settings. */}
              {dueAt && (
                <input
                  type="time"
                  value={dueMinute === undefined ? '' : toClockValue(dueMinute)}
                  onChange={e => {
                    const m = fromClockValue(e.target.value);
                    setDueMinute(m === null ? undefined : m);
                  }}
                  className={`${field} w-32`}
                  aria-label="Due time"
                />
              )}
            </div>
          </div>
        </div>

        {/* Sticky, so the button that commits the card is never somewhere you
            have to scroll to find. */}
        <div className={`sticky bottom-0 flex gap-2 p-4 border-t ${panel}`}>
          <button
            onClick={() => window.confirm('Discard task?') && onDelete()}
            className={`text-[10px] font-bold uppercase tracking-[0.06em] px-4 py-3 rounded-md border font-ui ${dark ? 'border-white/[0.06] text-zinc-500 hover:text-[#E10600]' : 'border-[#E3E0D9] text-[#8A8577] hover:text-[#E10600]'}`}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className={`flex-1 text-[10px] font-bold uppercase tracking-[0.06em] px-4 py-3 rounded-md border font-ui ${dark ? 'border-white/[0.06] text-zinc-400' : 'border-[#E3E0D9] text-[#6B675C]'}`}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!text.trim()}
            className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-3 rounded-md bg-[#E10600] text-white disabled:opacity-40 active:scale-97 transition-transform font-ui"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskEditor;
