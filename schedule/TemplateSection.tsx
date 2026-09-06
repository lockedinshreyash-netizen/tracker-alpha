import React, { useState } from 'react';
import { BlockKind, ExamPreference, ScheduleState, Subject, TemplateRule } from '../types';
import { getChaptersFor } from '../constants';
import { getISTDateString } from '../utils';
import { ACTIVITIES, BLOCK_KINDS, blockStyle, blockTitle, countsAsStudy } from './colors';
import { clampBlock, formatClock, formatRange, formatSpan } from './schedule';

interface Props {
  schedule: ScheduleState;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  currentClass: 11 | 12;
  examPreference: ExamPreference;
  onAddRule: (rule: Omit<TemplateRule, 'id' | 'from'>) => void;
  onUpdateRule: (id: string, patch: Partial<Omit<TemplateRule, 'id' | 'from' | 'until'>>) => void;
  onDeleteRule: (id: string) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Draft {
  id?: string;
  days: number[];
  kind: BlockKind;
  subject?: Subject;
  chapter?: string;
  label?: string;
  start: number;
  durationMins: number;
}

const DURATIONS = [30, 45, 60, 90, 120, 180];

/**
 * The weekly timetable — the things that happen every week whether you plan
 * them or not: school, coaching, the gym, when you sleep.
 *
 * A rule is never edited in place once a day has been lived against it; the
 * App mutator closes the old one at yesterday and opens a new one from today,
 * so a past day still materializes the plan that actually applied to it.
 * Nothing here needs to know that — it just calls onUpdateRule.
 */
const TemplateSection: React.FC<Props> = ({
  schedule, theme, activeSubjects, currentClass, examPreference,
  onAddRule, onUpdateRule, onDeleteRule,
}) => {
  const dark = theme === 'dark';
  const [draft, setDraft] = useState<Draft | null>(null);

  const today = getISTDateString();
  /* Closed rules still govern the past, but they are not the timetable any
     more and listing them would make this read like a changelog. */
  const live = schedule.rules
    .filter(r => !r.until || r.until >= today)
    .sort((a, b) => a.start - b.start || Math.min(...a.days) - Math.min(...b.days));

  const label = `text-[10px] font-bold uppercase tracking-[0.06em] mb-3 font-ui block ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const chip = (on: boolean) =>
    `px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.06em] border rounded-md transition-all font-ui ${
      on
        ? 'bg-[#E10600] text-white border-[#E10600]'
        : dark ? 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
               : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
    }`;
  const step = `w-9 h-9 rounded-md border text-sm transition-all font-ui ${
    dark ? 'border-white/[0.08] text-zinc-400 hover:text-white' : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'
  }`;
  const field = `w-full px-3.5 py-2.5 rounded-md border text-sm outline-none font-ui ${
    dark ? 'bg-[#111114] border-white/[0.08] text-white' : 'bg-white border-zinc-200 text-zinc-900'
  }`;

  const pickKind = (kind: BlockKind) => setDraft(d => d && (
    countsAsStudy(kind)
      ? { ...d, kind, label: undefined, subject: d.subject || activeSubjects[0] }
      : { ...d, kind, subject: undefined, chapter: undefined }
  ));

  const save = () => {
    if (!draft || draft.days.length === 0) return;
    const geom = clampBlock(draft.start, draft.durationMins);
    const payload = {
      days: draft.days, kind: draft.kind, subject: draft.subject,
      chapter: draft.chapter, label: draft.label, ...geom,
    };
    if (draft.id) onUpdateRule(draft.id, payload);
    else onAddRule({ ...payload, until: null });
    setDraft(null);
  };

  const isStudy = draft ? countsAsStudy(draft.kind) : false;
  const chapters = draft && isStudy && draft.subject
    ? getChaptersFor(examPreference, currentClass, draft.subject) : [];

  return (
    <section className={`p-8 md:p-10 rounded-xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Every week
        </h3>
        {!draft && (
          <button
            onClick={() => setDraft({ days: [1, 2, 3, 4, 5], kind: 'class', start: 300, durationMins: 360 })}
            className="shrink-0 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 font-ui"
          >
            Add a slot
          </button>
        )}
      </div>

      <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-8 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        School, coaching, sleep, the gym — set once, shows up every week. A day here runs 4 AM to 4 AM.
      </p>

      {live.length === 0 && !draft && (
        <p className={`text-xs font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          No timetable yet. Every day starts from nothing, and most of them stay there.
        </p>
      )}

      {live.length > 0 && (
        <div className="space-y-1.5">
          {live.map(r => {
            const c = blockStyle(r);
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-3.5 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}
              >
                <span className={`w-1 h-9 rounded-full shrink-0 ${c.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui truncate ${dark ? c.text : c.textLight}`}>
                    {blockTitle(r)}{r.chapter ? ` · ${r.chapter}` : ''}
                  </div>
                  <div className={`text-[10px] tabular-nums font-ui mt-0.5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {r.days.map(d => DAY_LABELS[d]).join(' · ')} — {formatRange(r.start, r.durationMins)}
                  </div>
                </div>
                <button
                  onClick={() => setDraft({ id: r.id, days: r.days, kind: r.kind, subject: r.subject, chapter: r.chapter, label: r.label, start: r.start, durationMins: r.durationMins })}
                  className={`text-[10px] font-medium uppercase tracking-[0.06em] shrink-0 font-ui transition-colors ${dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}
                >Edit</button>
                <button
                  onClick={() => { if (window.confirm('Drop this slot from the timetable? Days already spent keep it.')) onDeleteRule(r.id); }}
                  className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#E10600]/70 hover:text-[#E10600] shrink-0 font-ui transition-colors"
                >Drop</button>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className={`mt-6 p-5 md:p-6 rounded-lg border space-y-6 ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-100'}`}>
          <div>
            <label className={label}>Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  onClick={() => setDraft(d => d && ({ ...d, days: d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i].sort() }))}
                  className={chip(draft.days.includes(i))}
                >{lbl}</button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>What</label>
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_KINDS.map(k => (
                <button key={k} onClick={() => pickKind(k)} className={chip(draft.kind === k)}>
                  {ACTIVITIES[k].label}
                </button>
              ))}
            </div>
          </div>

          {isStudy ? (
            <>
              <div>
                <label className={label}>Subject</label>
                <div className="flex flex-wrap gap-1.5">
                  {activeSubjects.map(s => (
                    <button key={s} onClick={() => setDraft(d => d && ({ ...d, subject: s, chapter: undefined }))} className={chip(draft.subject === s)}>{s}</button>
                  ))}
                </div>
              </div>
              {chapters.length > 0 && (
                <div>
                  <label className={label}>Chapter</label>
                  <select value={draft.chapter || ''} onChange={e => setDraft(d => d && ({ ...d, chapter: e.target.value || undefined }))} className={field}>
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
                value={draft.label || ''}
                onChange={e => setDraft(d => d && ({ ...d, label: e.target.value || undefined }))}
                placeholder="e.g. Coaching"
                className={field}
                maxLength={60}
              />
            </div>
          )}

          <div>
            <label className={label}>Starts — {formatRange(draft.start, draft.durationMins)}</label>
            <div className="flex items-center gap-2 max-w-[220px]">
              <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start - 15, d.durationMins) }))} className={step} aria-label="15 minutes earlier">−</button>
              <span className={`flex-1 text-center text-sm num-stat tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
                {formatClock(draft.start)}
              </span>
              <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start + 15, d.durationMins) }))} className={step} aria-label="15 minutes later">+</button>
            </div>
          </div>

          <div>
            <label className={label}>Runs for — {formatSpan(draft.durationMins)}</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map(m => (
                <button key={m} onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start, m) }))} className={chip(draft.durationMins === m)}>
                  {formatSpan(m)}
                </button>
              ))}
              <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start, d.durationMins + 30) }))} className={chip(false)}>+30m</button>
            </div>
          </div>

          {draft.id && (
            <p className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
              This applies from today on. Days already spent keep the old slot.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={draft.days.length === 0}
              className="flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-[#E10600] font-ui"
            >
              {draft.id ? 'Save' : 'Add'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className={`px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all active:scale-95 font-ui ${
                dark ? 'border-zinc-700 text-zinc-400 hover:text-white' : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'
              }`}
            >Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default TemplateSection;
