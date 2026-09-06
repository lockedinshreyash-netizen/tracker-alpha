import React, { useMemo, useState } from 'react';
import {
  DailyLog, ExamPreference, ScheduleBlock, ScheduleState, Subject, TemplateRule, TimerState,
} from '../types';
import { getISTDateString } from '../utils';
import AdherenceSection from './AdherenceSection';
import BlockEditor, { EditorDraft } from './BlockEditor';
import DateStrip from './DateStrip';
import DayTimeline from './DayTimeline';
import TemplateSection from './TemplateSection';
import { isCommitment } from './colors';
import {
  isInstanceId, isOverridden, materializeDay, nowMinute, parseInstanceId,
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

  const plannedMins = blocks.filter(b => !isCommitment(b.kind)).reduce((a, b) => a + b.durationMins, 0);

  const closeEditor = () => setDraft(null);

  const saveDraft = (d: EditorDraft) => {
    if (d.id) {
      onUpdateBlock(d.id, {
        subject: d.subject, chapter: d.chapter, start: d.start,
        durationMins: d.durationMins, kind: d.kind, label: d.label,
      });
    } else {
      onAddBlock({
        date, subject: d.subject, chapter: d.chapter, start: d.start,
        durationMins: d.durationMins, kind: d.kind, label: d.label,
      });
    }
    closeEditor();
  };

  const deleteDraft = () => {
    if (!draft?.id) return;
    const recurring = isInstanceId(draft.id);
    const msg = recurring
      ? 'SKIP THIS ONE TODAY? The weekly slot stays.'
      : 'DELETE THIS BLOCK? This cannot be undone.';
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
      subject: draft.subject,
      chapter: draft.chapter,
      start: draft.start,
      durationMins: draft.durationMins,
      kind: draft.kind,
      label: draft.label,
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

  const timerBusy = timer.isRunning;

  return (
    <div className="space-y-12 md:space-y-14 pb-16">
      <DateStrip date={date} today={today} plannedMins={plannedMins} theme={theme} onChange={setDate} />

      <section>
        {blocks.length === 0 && (
          <p className={`font-ui text-sm mb-4 ${dark ? 'text-white/35' : 'text-black/40'}`}>
            NOTHING SCHEDULED. THE COMPETITION HAS A PLAN. TAP THE GRID.
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
            id: b.id, subject: b.subject, chapter: b.chapter,
            start: b.start, durationMins: b.durationMins, kind: b.kind, label: b.label,
          })}
          onCreateAt={start => setDraft({
            subject: activeSubjects[0] || 'Physics', start, durationMins: 60, kind: 'study',
          })}
          onDelete={b => { if (window.confirm('DELETE THIS BLOCK?')) onDeleteBlock(b.id); }}
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
          canEngage={date === today && !timerBusy}
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
