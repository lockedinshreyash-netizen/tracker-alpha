import React, { useState } from 'react';
import { BlockKind, ExamPreference, ScheduleState, Subject, TemplateRule } from '../types';
import { getChaptersFor } from '../constants';
import { getISTDateString } from '../utils';
import { subjectStyle } from './colors';
import { clampBlock, formatClock, formatSpan } from './schedule';

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

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Draft {
  id?: string;
  days: number[];
  subject: Subject;
  chapter?: string;
  start: number;
  durationMins: number;
  kind: BlockKind;
}

const BLANK: Draft = { days: [1, 3, 5], subject: 'Physics', start: 120, durationMins: 90, kind: 'study' };

/**
 * The weekly timetable.
 *
 * A rule is never edited in place once a day has been lived against it — the
 * App mutator closes the old one at yesterday and opens a new one from today,
 * so a past day still materializes the plan that actually applied to it.
 * Nothing in this component needs to know that; it just calls onUpdateRule.
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

  const card = `p-8 md:p-10 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`;
  const chip = (on: boolean) =>
    `px-2.5 py-1.5 rounded-md font-ui text-[10px] font-bold uppercase tracking-wider transition-colors ${
      on ? 'bg-[#E10600] text-white'
        : dark ? 'bg-white/[0.04] text-white/50 hover:text-white/80' : 'bg-black/[0.03] text-black/50 hover:text-black/80'
    }`;

  const save = () => {
    if (!draft || draft.days.length === 0) return;
    const geom = clampBlock(draft.start, draft.durationMins);
    const payload = {
      days: draft.days, subject: draft.subject, chapter: draft.chapter,
      kind: draft.kind, ...geom,
    };
    if (draft.id) onUpdateRule(draft.id, payload);
    else onAddRule({ ...payload, until: null });
    setDraft(null);
  };

  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className={`font-display text-lg uppercase ${dark ? 'text-white' : 'text-[#17150F]'}`}>THE WEEKLY TEMPLATE</h3>
          <p className={`font-ui text-[11px] mt-1 ${dark ? 'text-white/40' : 'text-black/45'}`}>
            SET IT ONCE. IT SHOWS UP EVERY WEEK WITHOUT YOU REBUILDING IT.
          </p>
        </div>
        {!draft && (
          <button
            onClick={() => setDraft({ ...BLANK, subject: activeSubjects[0] || 'Physics' })}
            className="shrink-0 px-3 py-2 rounded-md bg-[#E10600] text-white font-ui text-[10px] font-bold uppercase tracking-wider"
          >
            ADD A SLOT
          </button>
        )}
      </div>

      <p className={`font-ui text-[10px] mt-3 ${dark ? 'text-white/25' : 'text-black/30'}`}>
        A DAY HERE RUNS 04:00 TO 03:59 THE NEXT MORNING — MONDAY OWNS MONDAY NIGHT.
      </p>

      {live.length === 0 && !draft && (
        <p className={`font-ui text-sm mt-8 ${dark ? 'text-white/35' : 'text-black/40'}`}>
          NO TIMETABLE. EVERY DAY STARTS FROM NOTHING, AND MOST OF THEM STAY THERE.
        </p>
      )}

      {live.length > 0 && (
        <div className="mt-8 space-y-2">
          {live.map(r => {
            const c = subjectStyle(r.subject);
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${dark ? 'border-white/[0.06] bg-[#0D0D10]' : 'border-[#E3E0D9] bg-[#FAF9F6]'}`}
              >
                <span className={`w-1.5 h-8 rounded-full shrink-0 ${c.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className={`font-ui text-xs font-bold uppercase tracking-wide ${dark ? c.text : c.textLight}`}>
                    {r.subject}{r.chapter ? ` · ${r.chapter}` : ''}
                  </div>
                  <div className={`font-ui text-[11px] ${dark ? 'text-white/40' : 'text-black/45'}`}>
                    {r.days.map(d => DAY_LABELS[d]).join(' ')} · {formatClock(r.start)}–{formatClock(r.start + r.durationMins)} · {formatSpan(r.durationMins)}
                  </div>
                </div>
                <button
                  onClick={() => setDraft({ id: r.id, days: r.days, subject: r.subject, chapter: r.chapter, start: r.start, durationMins: r.durationMins, kind: r.kind })}
                  className={`font-ui text-[10px] uppercase tracking-wider shrink-0 ${dark ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                >EDIT</button>
                <button
                  onClick={() => { if (window.confirm('DROP THIS SLOT FROM THE TIMETABLE? Days already spent keep it.')) onDeleteRule(r.id); }}
                  className="font-ui text-[10px] uppercase tracking-wider text-[#E10600]/70 hover:text-[#E10600] shrink-0"
                >DROP</button>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className={`mt-8 p-5 rounded-lg border space-y-5 ${dark ? 'border-white/[0.08] bg-[#0D0D10]' : 'border-[#E3E0D9] bg-[#FAF9F6]'}`}>
          <div>
            <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Days</label>
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
            <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Subject</label>
            <div className="flex flex-wrap gap-1.5">
              {activeSubjects.map(s => (
                <button key={s} onClick={() => setDraft(d => d && ({ ...d, subject: s, chapter: undefined }))} className={chip(draft.subject === s)}>{s}</button>
              ))}
            </div>
          </div>

          {getChaptersFor(examPreference, currentClass, draft.subject).length > 0 && (
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Chapter</label>
              <select
                value={draft.chapter || ''}
                onChange={e => setDraft(d => d && ({ ...d, chapter: e.target.value || undefined }))}
                className={`w-full px-3 py-2 rounded-md border font-ui text-sm outline-none ${dark ? 'bg-[#111114] border-white/[0.08] text-white' : 'bg-white border-[#E3E0D9] text-[#17150F]'}`}
              >
                <option value="">— NOT DECIDED —</option>
                {getChaptersFor(examPreference, currentClass, draft.subject).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Starts</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start - 15, d.durationMins) }))} className={chip(false)}>−</button>
                <span className={`num-timer flex-1 text-center ${dark ? 'text-white' : 'text-[#17150F]'}`}>{formatClock(draft.start)}</span>
                <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start + 15, d.durationMins) }))} className={chip(false)}>+</button>
              </div>
            </div>
            <div>
              <label className={`font-ui text-[10px] uppercase tracking-[0.18em] block mb-2 ${dark ? 'text-white/35' : 'text-black/40'}`}>Runs</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start, d.durationMins - 15) }))} className={chip(false)}>−</button>
                <span className={`num-timer flex-1 text-center ${dark ? 'text-white' : 'text-[#17150F]'}`}>{formatSpan(draft.durationMins)}</span>
                <button onClick={() => setDraft(d => d && ({ ...d, ...clampBlock(d.start, d.durationMins + 15) }))} className={chip(false)}>+</button>
              </div>
            </div>
          </div>

          {draft.id && (
            <p className={`font-ui text-[10px] ${dark ? 'text-white/30' : 'text-black/35'}`}>
              THIS APPLIES FROM TODAY ON. DAYS ALREADY SPENT KEEP THE OLD SLOT.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={draft.days.length === 0}
              className="flex-1 py-2.5 rounded-md bg-[#E10600] text-white font-ui text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {draft.id ? 'SAVE' : 'ADD'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className={`px-4 py-2.5 rounded-md border font-ui text-[11px] font-bold uppercase tracking-wider ${dark ? 'border-white/[0.1] text-white/50' : 'border-[#E3E0D9] text-black/50'}`}
            >CANCEL</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default TemplateSection;
