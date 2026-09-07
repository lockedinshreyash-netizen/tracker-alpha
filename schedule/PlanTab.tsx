import React, { useMemo, useState } from 'react';
import {
  BlockKind, DailyLog, ExamPreference, ScheduleBlock, ScheduleState, Subject, TemplateRule, TimerState,
} from '../types';
import { addDays, getISTDateString } from '../utils';
import AdherenceSection from './AdherenceSection';
import BlockEditor, { EditorDraft } from './BlockEditor';
import DateStrip from './DateStrip';
import DayTimeline from './DayTimeline';
import PaletteSection from './PaletteSection';
import ScopePrompt from './ScopePrompt';
import TemplateSection from './TemplateSection';
import { ACTIVITIES, blockTitle, countsAsStudy } from './colors';
import {
  RepeatMode, daysForRepeat, firstFreeSlot, isInstanceId, isOverridden,
  materializeDay, nowMinute, parseInstanceId, repeatOf, repeatSummary,
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
  /** Recolour one activity, or `null` to go back to the shipped colour. */
  onSetColor: (kind: BlockKind, hex: string | null) => void;
  onAddRule: (rule: Omit<TemplateRule, 'id' | 'from'> & { from?: string }) => void;
  onUpdateRule: (
    id: string,
    patch: Partial<Omit<TemplateRule, 'id' | 'from' | 'until'>>,
    opts?: { clearOverrideOn?: string },
  ) => void;
  onDeleteRule: (id: string) => void;
  onStartBlock: (block: ScheduleBlock) => void;
}

/* The day as most people actually build it: the work, then the things that
   decide when the work can happen. Anything else is one tap further in. */
const QUICK_ADD: BlockKind[] = ['study', 'class', 'meal', 'gym', 'sleep'];

/** A dropped repeating block, waiting on "this day or every day?". */
interface PendingMove {
  id: string;
  start: number;
  durationMins: number;
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
  onAddBlock, onUpdateBlock, onDeleteBlock, onResetInstance, onSetColor,
  onAddRule, onUpdateRule, onDeleteRule, onStartBlock,
}) => {
  const dark = theme === 'dark';
  const today = getISTDateString();
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  /* A drag of a repeating block, held un-written until the user says which one
     they meant. Nothing has touched state yet at this point. */
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const blocks = useMemo(() => {
    const day = materializeDay(schedule, date);
    /* Draw where they dropped it while the question is on screen — snapping the
       block back under the prompt asking about it reads as a rejected drag. */
    if (!pendingMove) return day;
    return day.map(b => (b.id === pendingMove.id
      ? { ...b, start: pendingMove.start, durationMins: pendingMove.durationMins }
      : b));
  }, [schedule, date, pendingMove]);

  /* Only today has a "now". A past day is over and a future one has not
     started, and drawing a line on either would be a lie. */
  const minute = date === today ? nowMinute() : null;
  /* Yesterday's plan is not editable: changing it after the fact would
     rewrite what its adherence was measured against. */
  const readOnly = date < today;

  const studyMins = blocks
    .filter(b => countsAsStudy(b.kind))
    .reduce((a, b) => a + b.durationMins, 0);

  /** The rule an on-screen block came from, if it came from one. */
  const ruleFor = (blockId: string): TemplateRule | undefined => {
    const parsed = isInstanceId(blockId) ? parseInstanceId(blockId) : null;
    return parsed ? schedule.rules.find(r => r.id === parsed.ruleId) : undefined;
  };

  const weekdayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
    .format(new Date(date + 'T12:00:00'));
  /* "Monday 7 September" — a scope prompt has to name the one day it would
     otherwise be changing, or "just this day" is a bet on which day is on
     screen. Noon anchor, same dodge DateStrip uses. */
  const dayLabel = date === today
    ? 'today'
    : new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(new Date(date + 'T12:00:00'));

  const closeEditor = () => setDraft(null);

  const openNew = (kind: BlockKind, start?: number) => {
    const def = ACTIVITIES[kind];
    setDraft({
      kind,
      subject: def.isStudy ? activeSubjects[0] : undefined,
      start: start ?? firstFreeSlot(blocks, def.defaultStart, def.defaultMins),
      durationMins: def.defaultMins,
      repeat: 'none',
    });
  };

  /**
   * One Save button, six outcomes.
   *
   * Repeat is applied here rather than by its own hidden action, because
   * "make this repeat" and "change its time" are the same edit as far as the
   * user is concerned, and splitting them is how the old buried link ended up
   * silently creating a rule for one weekday and nothing else.
   */
  const saveDraft = (d: EditorDraft) => {
    const patch = {
      kind: d.kind, subject: d.subject, chapter: d.chapter,
      start: d.start, durationMins: d.durationMins, label: d.label,
    };
    const rule = d.id ? ruleFor(d.id) : undefined;
    const wasRepeating = !!rule;
    const wantsRepeat = d.repeat !== 'none';

    if (wantsRepeat) {
      /* `rule.days` is handed in so a Mon–Fri slot opened on a Tuesday keeps
         all five days. Reading the mode back off the rule used to answer
         "weekly", and saving anything at all then threw the other four away. */
      const days = daysForRepeat(d.repeat, date, rule?.days);
      if (wasRepeating) {
        onUpdateRule(rule!.id, { ...patch, days });
      } else {
        /* A one-off becoming a repeat: the rule takes over from the day being
           planned, and the single block it grew from goes, or the day would
           show it twice. */
        onAddRule({ ...patch, days, until: null, from: date });
        if (d.id) onDeleteBlock(d.id);
      }
    } else if (wasRepeating) {
      /* Dropping the repeat must not also drop today — the user asked for one
         block, not for none. */
      onDeleteRule(rule!.id);
      onAddBlock({ date, ...patch });
    } else if (d.id) {
      onUpdateBlock(d.id, patch);
    } else {
      onAddBlock({ date, ...patch });
    }
    closeEditor();
  };

  /** Just this day. A repeating block keeps coming back tomorrow. */
  const deleteDraft = () => {
    if (!draft?.id) return;
    const msg = isInstanceId(draft.id)
      ? 'Remove it from today only? It still comes back tomorrow.'
      : 'Delete this block?';
    if (window.confirm(msg)) onDeleteBlock(draft.id);
    closeEditor();
  };

  /** The whole repeat. Days already spent keep it — see deleteRule in App. */
  const deleteSeries = () => {
    const rule = draft?.id ? ruleFor(draft.id) : undefined;
    if (!rule) return;
    if (window.confirm('Delete this from every day it repeats on?')) onDeleteRule(rule.id);
    closeEditor();
  };

  const resetDraft = () => {
    if (!draft?.id) return;
    const parsed = parseInstanceId(draft.id);
    if (parsed) onResetInstance(parsed.ruleId, parsed.date);
    closeEditor();
  };

  const engageDraft = () => {
    const block = blocks.find(b => b.id === draft?.id);
    if (block) onStartBlock(block);
    closeEditor();
  };

  /**
   * A finished drag, resize or keyboard nudge.
   *
   * A one-off block is written straight away — there is only one thing it could
   * mean. A repeating one is held: the same gesture can mean "this Tuesday" or
   * "every Tuesday", and answering silently is what made a plan look right today
   * and land in pieces tomorrow.
   */
  const commitGeometry = (id: string, patch: { start: number; durationMins: number }) => {
    if (isInstanceId(id) && ruleFor(id)) {
      setPendingMove({ id, ...patch });
      return;
    }
    onUpdateBlock(id, patch);
  };

  const resolveMove = (everyDay: boolean) => {
    const move = pendingMove;
    setPendingMove(null);
    if (!move) return;
    const patch = { start: move.start, durationMins: move.durationMins };
    if (!everyDay) {
      onUpdateBlock(move.id, patch);
      return;
    }
    const parsed = parseInstanceId(move.id);
    if (!parsed) return;
    /* This date's own override is dropped along the way: the user just asked
       every day to move, and the one they dragged must not be the exception. */
    onUpdateRule(parsed.ruleId, patch, { clearOverrideOn: parsed.date });
  };

  const card = `p-6 md:p-8 rounded-xl border transition-all ${
    dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'
  }`;

  /* Built once and placed twice — the fullscreen shell and the page need the
     same controls, and two copies would drift. */
  const quickAdd = !readOnly && (
    <div className="flex flex-wrap items-center gap-1.5">
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
  );

  const timeline = (
    <DayTimeline
      blocks={blocks}
      theme={theme}
      colors={schedule.colors}
      minute={minute}
      readOnly={readOnly}
      runningBlockId={timer.isRunning ? timer.blockId : undefined}
      onCommit={commitGeometry}
      onOpen={b => {
        const rule = ruleFor(b.id);
        setDraft({
          id: b.id, kind: b.kind, subject: b.subject, chapter: b.chapter,
          start: b.start, durationMins: b.durationMins, label: b.label,
          repeat: rule ? repeatOf(rule) : 'none',
        });
      }}
      onCreateAt={start => openNew('study', start)}
      onDelete={b => { if (window.confirm('Delete this block?')) onDeleteBlock(b.id); }}
      isRecurring={isInstanceId}
      isMoved={id => isOverridden(schedule, id)}
    />
  );

  const editor = draft && (
    <BlockEditor
      draft={draft}
      dayBlocks={blocks}
      recurring={!!draft.id && isInstanceId(draft.id)}
      customDays={draft.repeat === 'custom' ? ruleFor(draft.id || '')?.days : undefined}
      moved={!!draft.id && isOverridden(schedule, draft.id)}
      colors={schedule.colors}
      /* Engaging a block on a day you are not living is meaningless, and
         a second timer while one runs is refused upstream anyway. */
      canEngage={date === today && !timer.isRunning}
      theme={theme}
      activeSubjects={activeSubjects}
      currentClass={currentClass}
      examPreference={examPreference}
      weekdayName={weekdayName}
      onSave={saveDraft}
      onDelete={deleteDraft}
      onDeleteSeries={deleteSeries}
      onReset={resetDraft}
      onEngage={engageDraft}
      onClose={closeEditor}
    />
  );

  return (
    <div className="space-y-12 md:space-y-14 pb-16">
      <DateStrip
        date={date}
        today={today}
        studyMins={studyMins}
        theme={theme}
        onChange={setDate}
        onStep={delta => setDate(d => addDays(d, delta))}
      />

      <section className={card}>
        {quickAdd && <div className="mb-6">{quickAdd}</div>}

        {blocks.length === 0 && (
          <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-5 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Nothing scheduled. The competition has a plan.
          </p>
        )}

        {timeline}
      </section>

      <AdherenceSection blocks={blocks} logs={logs} date={date} minute={minute} theme={theme} colors={schedule.colors} />

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

      <PaletteSection
        colors={schedule.colors || {}}
        theme={theme}
        activeSubjects={activeSubjects}
        onSetColor={onSetColor}
      />

      {editor}

      {pendingMove && (() => {
        const block = blocks.find(b => b.id === pendingMove.id);
        const rule = ruleFor(pendingMove.id);
        if (!block || !rule) return null;
        return (
          <ScopePrompt
            title={blockTitle(block)}
            seriesLabel={repeatSummary(rule.days).toLowerCase()}
            dayLabel={dayLabel}
            start={pendingMove.start}
            durationMins={pendingMove.durationMins}
            theme={theme}
            onConfirm={resolveMove}
            onCancel={() => setPendingMove(null)}
          />
        );
      })()}
    </div>
  );
};

export default PlanTab;
