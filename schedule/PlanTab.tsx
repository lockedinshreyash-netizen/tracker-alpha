import React, { useMemo, useState } from 'react';
import {
  BlockKind, DailyLog, ExamPreference, ScheduleBlock, ScheduleState, Subject, TemplateRule, TimerState,
} from '../types';
import { getISTDateString } from '../utils';
import AdherenceSection from './AdherenceSection';
import BlockEditor, { EditorDraft } from './BlockEditor';
import DateStrip from './DateStrip';
import DayTimeline from './DayTimeline';
import TemplateSection from './TemplateSection';
import { ACTIVITIES, countsAsStudy } from './colors';
import {
  firstFreeSlot, isInstanceId, isOverridden, materializeDay, nowMinute, parseInstanceId,
} from './schedule';

interface Props {
  schedule: ScheduleState;
  logs: DailyLog[];
  timer: TimerState;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  currentClass: 11 | 12;
  examPreference: ExamPreference;
  onAddBlock: (input: Omit<ScheduleBlock, 'id'>) => void;
  onUpdateBlock: (id: string, patch: Partial<Omit<ScheduleBlock, 'id' | 'date'>>) => void;
  onDeleteBlock: (id: string) => void;
  onResetInstance: (ruleId: string, date: string) => void;
  onAddRule: (rule: Omit<TemplateRule, 'id' | 'from'>) => void;
  onUpdateRule: (id: string, patch: Partial<Omit<TemplateRule, 'id' | 'from' | 'until'>>) => void;
  onDeleteRule: (id: string) => void;
  onStartBlock: (block: ScheduleBlock) => void;
}

/* The day as most people actually build it: the work, then the things that
   decide when the work can happen. Anything else is one tap further in. */
const QUICK_ADD: BlockKind[] = ['study', 'class', 'meal', 'gym', 'sleep'];

/**
 * The Plan tab.
 *
 * Zero logic, like QuestionsTab — the day is derived by `materializeDay`, the
 * verdict by `computeAdherence`, and every mutation is a callback from App.
 * The only state that belongs here is which day you are looking at.
 */
const PlanTab: React.FC<Props> = ({
  schedule, logs, timer, theme, activeSubjects, currentClass, examPreference,
  onAddBlock, onUpdateBlock, onDeleteBlock, onResetInstance,
  onAddRule, onUpdateRule, onDeleteRule, onStartBlock,
}) => {
  const dark = theme === 'dark';
  const today = getISTDateString();
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<EditorDraft | null>(null);

  const blocks = useMemo(() => materializeDay(schedule, date), [schedule, date]);

  /* Only today has a "now". A past day is over and a future one has not
     started, and drawing a line on either would be a lie. */
  const minute = date === today ? nowMinute() : null;
  /* Yesterday's plan is not editable: changing it after the fact would
     rewrite what its adherence was measured against. */
  const readOnly = date < today;

  const studyMins = blocks
    .filter(b => countsAsStudy(b.kind))
    .reduce((a, b) => a + b.durationMins, 0);

  const closeEditor = () => setDraft(null);

  const openNew = (kind: BlockKind, start?: number) => {
    const def = ACTIVITIES[kind];
    setDraft({
      kind,
      subject: def.isStudy ? activeSubjects[0] : undefined,
      start: start ?? firstFreeSlot(blocks, def.defaultStart, def.defaultMins),
      durationMins: def.defaultMins,
    });
  };

  const saveDraft = (d: EditorDraft) => {
    const patch = {
      kind: d.kind, subject: d.subject, chapter: d.chapter,
      start: d.start, durationMins: d.durationMins, label: d.label,
    };
    if (d.id) onUpdateBlock(d.id, patch);
    else onAddBlock({ date, ...patch });
    closeEditor();
  };

  const deleteDraft = () => {
    if (!draft?.id) return;
    const msg = isInstanceId(draft.id)
      ? 'Skip this one today? The weekly slot stays.'
      : 'Delete this block? This cannot be undone.';
    if (window.confirm(msg)) onDeleteBlock(draft.id);
    closeEditor();
  };

  const resetDraft = () => {
    if (!draft?.id) return;
    const parsed = parseInstanceId(draft.id);
    if (parsed) onResetInstance(parsed.ruleId, parsed.date);
    closeEditor();
  };

  /* Promote a one-off into the timetable, on the weekday it already sits on. */
  const makeWeekly = () => {
    if (!draft?.id) return;
    onAddRule({
      days: [new Date(date + 'T12:00:00').getDay()],
      kind: draft.kind, subject: draft.subject, chapter: draft.chapter,
      start: draft.start, durationMins: draft.durationMins, label: draft.label,
      until: null,
    });
    onDeleteBlock(draft.id);
    closeEditor();
  };

  const engageDraft = () => {
    const block = blocks.find(b => b.id === draft?.id);
    if (block) onStartBlock(block);
    closeEditor();
  };

  const card = `p-6 md:p-8 rounded-xl border transition-all ${
    dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'
  }`;

  return (
    <div className="space-y-12 md:space-y-14 pb-16">
      <DateStrip date={date} today={today} studyMins={studyMins} theme={theme} onChange={setDate} />

      <section className={card}>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <span className={`text-[10px] font-bold uppercase tracking-[0.06em] mr-1.5 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Add
            </span>
            {QUICK_ADD.map(k => (
              <button
                key={k}
                onClick={() => openNew(k)}
                className={`px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.06em] border rounded-md transition-all active:scale-95 font-ui ${
                  dark ? 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
                       : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                }`}
              >
                {ACTIVITIES[k].label}
              </button>
            ))}
          </div>
        )}

        {blocks.length === 0 && (
          <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-5 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Nothing scheduled. The competition has a plan.
          </p>
        )}

        <DayTimeline
          blocks={blocks}
          theme={theme}
          minute={minute}
          readOnly={readOnly}
          runningBlockId={timer.isRunning ? timer.blockId : undefined}
          onCommit={(id, patch) => onUpdateBlock(id, patch)}
          onOpen={b => setDraft({
            id: b.id, kind: b.kind, subject: b.subject, chapter: b.chapter,
            start: b.start, durationMins: b.durationMins, label: b.label,
          })}
          onCreateAt={start => openNew('study', start)}
          onDelete={b => { if (window.confirm('Delete this block?')) onDeleteBlock(b.id); }}
          isRecurring={isInstanceId}
          isMoved={id => isOverridden(schedule, id)}
        />
      </section>

      <AdherenceSection blocks={blocks} logs={logs} date={date} minute={minute} theme={theme} />

      <TemplateSection
        schedule={schedule}
        theme={theme}
        activeSubjects={activeSubjects}
        currentClass={currentClass}
        examPreference={examPreference}
        onAddRule={onAddRule}
        onUpdateRule={onUpdateRule}
        onDeleteRule={onDeleteRule}
      />

      {draft && (
        <BlockEditor
          draft={draft}
          dayBlocks={blocks}
          recurring={!!draft.id && isInstanceId(draft.id)}
          moved={!!draft.id && isOverridden(schedule, draft.id)}
          /* Engaging a block on a day you are not living is meaningless, and
             a second timer while one runs is refused upstream anyway. */
          canEngage={date === today && !timer.isRunning}
          theme={theme}
          activeSubjects={activeSubjects}
          currentClass={currentClass}
          examPreference={examPreference}
          onSave={saveDraft}
          onDelete={deleteDraft}
          onReset={resetDraft}
          onEngage={engageDraft}
          onMakeWeekly={makeWeekly}
          onClose={closeEditor}
        />
      )}
    </div>
  );
};

export default PlanTab;
