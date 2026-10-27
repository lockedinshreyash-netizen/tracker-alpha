import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ExamPreference, LogSource, PomodoroSettings, ScheduleBlock, Subject, Task, TaskColumn, TimerMode, TimerState } from '../types';
import { getISTDateString, getSubjectDistribution } from '../utils';
import ExamCountdown from './ExamCountdown';
import { normalizeTarget, streamOf } from '../content/exams';
import { isIdle as pomodoroIsIdle, effectiveMode } from './pomodoro';
import { CLEARED, elapsedMs, isArmed, isPaused, pauseRun, resumeRun, sessionSpan } from './stopwatch';
import { useSecondTick } from '../ui/useSecondTick';
import * as sfx from '../audio';
import { PomodoroApi } from './usePomodoro';
import TaskBoard from '../board/TaskBoard';
import PomodoroTimer from './PomodoroTimer';
import SprintTimer from './SprintTimer';
import { SprintApi } from './useSprint';
import { Recommendation } from './recommend';
import NoticeLine from '../notify/NoticeLine';
import { SUPPORT_COPY } from '../support/content';
import NextUpStrip from '../schedule/NextUpStrip';
import { EMPTY_SCHEDULE, materializeDay } from '../schedule/schedule';
import ShareButton from '../share/ShareButton';
import { SUBJECT_COLORS } from '../schedule/colors';
import { Card, Chip, Eyebrow, PageHeader, Segmented, btn, tokens } from '../ui/kit';
import { FESTIVE_GREETING, type FestiveTheme } from '../festive/useFestiveTheme';

const TARGET_OPEN_KEY = 'today_target_open';

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/* The running clock, on its own. It redraws once a second, just after the
   digit flips; the tab around it (the board, the history) does not redraw
   at all. It used to be state on the whole tab, ten times a second. */
function StopwatchClock({ timer, className }: { timer: TimerState; className: string }) {
  const now = useSecondTick(timer.isRunning, timer.startTime ?? 0);
  return <p className={className}>{formatTime(elapsedMs(timer, now))}</p>;
}

interface Props {
  state: AppState;
  onLog: (subject: Subject, hours: number, quality: number, distractions: number, source?: LogSource, chapter?: string, blockId?: string, startedAt?: number, endedAt?: number) => void;
  onDeleteLog: (id: string) => void;
  onTimerUpdate: (timerUpdate: Partial<TimerState>) => void;
  onAddTask: (text: string, subject: Subject, column?: TaskColumn) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  onMoveTask: (id: string, column: TaskColumn, index: number) => void;
  onUpdateDailyGoal: (val: number) => void;
  onSetTimerMode: (mode: TimerMode) => void;
  pomodoro: PomodoroApi;
  sprint: SprintApi;
  onUpdatePomodoroSettings: (next: Partial<PomodoroSettings>) => void;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  examPreference: ExamPreference;
  onEngageRecommendation: (rec: Recommendation) => void;
  onDismissRecommendation: (rec: Recommendation) => void;
  onSetCoachMuted: (muted: boolean) => void;
  onStartBlock: (block: ScheduleBlock) => void;
  onOpenPlan: () => void;
  /** Opens the share sheet on today's card. */
  onShare: () => void;
  /* Set only when an app-wide announcement is live, unread, and the user has
     closed its modal without acknowledging it. The modal is the notice; this
     line is the way back to one that was waved off, so nothing published is
     ever lost to a stray tap on the scrim. */
  unreadAnnouncements: number;
  onOpenAnnouncement: () => void;
  /** Replies from the founder to the student's notes that they have not seen yet. */
  founderReplies?: number;
  onOpenFounderReply?: () => void;
  /** The festive theme everyone is seeing; adds one greeting to the date line. */
  festive?: FestiveTheme;
}

const TodayTab: React.FC<Props> = ({
  state,
  onLog,
  onDeleteLog,
  onTimerUpdate,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onUpdateDailyGoal,
  onSetTimerMode,
  pomodoro: pomodoroApi,
  sprint: sprintApi,
  onUpdatePomodoroSettings,
  theme,
  activeSubjects,
  examPreference,
  onEngageRecommendation,
  onDismissRecommendation,
  onSetCoachMuted,
  onStartBlock,
  onOpenPlan,
  onShare,
  unreadAnnouncements,
  onOpenAnnouncement,
  founderReplies = 0,
  onOpenFounderReply,
  festive = 'none',
}) => {
  const { timer, tasks, logs, dailyGoalHours, pomodoro, pomodoroSettings } = state;
  const pomodoroBusy = !pomodoroIsIdle(pomodoro);
  /* Running or paused: either way there is a session on the card, and
     everything that hides mid-session stays hidden through a pause. */
  const stopwatchBusy = isArmed(timer);
  const stopwatchPaused = isPaused(timer);
  /* A sprint, running or paused, owns the card the way a stopwatch session
     does: the switch and everything above the clock step aside. */
  const sprintBusy = !!state.sprint;
  /* Keeps the card from jumping when the last task is ticked: the result
     replaces the running sprint in the same place. */
  const sprintFocus = sprintBusy || !!sprintApi.result;
  const [manualSubject, setManualSubject] = useState<Subject>('Physics');
  const [quality, setQuality] = useState(4);

  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  /* Starting a session swaps in a much taller timer panel and removes the
     goal card above it, so whatever the user was scrolled to is no longer
     where they left it. Snap back to the top so the running timer is what
     they actually see. */
  useEffect(() => {
    if (!timer.isRunning) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [timer.isRunning]);

  const handleStartTimer = () => {
    /* Started by hand, so it belongs to no planned block — clear any stamp a
       previous engaged session left behind. */
    onTimerUpdate({ isRunning: true, startTime: Date.now(), subject: manualSubject, chapter: undefined, blockId: undefined });
  };

  const handleStopTimer = () => {
    const currentTimer = timerRef.current;
    if (!isArmed(currentTimer)) return;
    /* Measured by the stopwatch, so it counts towards the leaderboard. The
       chapter and block ride along when the session was started from a plan —
       that stamp is the only thing that lets adherence say a block was
       honoured rather than infer it from subject and hours.

       `sessionSpan` places it on the clock: ending where the clock last ran
       (the pause, for a paused session) and spanning exactly the time served,
       so a pause in the middle is never counted as study. */
    const { hours, startedAt, endedAt } = sessionSpan(currentTimer);
    onLog(
      currentTimer.subject, hours, quality, 0, 'timer',
      currentTimer.chapter, currentTimer.blockId,
      startedAt, endedAt,
    );
    onTimerUpdate(CLEARED);
  };

  /* Nothing is logged on a pause — the session is still open, and End logs it
     once with everything served. */
  const handlePauseTimer = () => {
    const currentTimer = timerRef.current;
    if (!currentTimer.isRunning) return;
    sfx.select();
    onTimerUpdate(pauseRun(currentTimer));
  };

  const handleResumeTimer = () => {
    const currentTimer = timerRef.current;
    if (!isPaused(currentTimer)) return;
    const { bank, update } = resumeRun(currentTimer);
    if (bank) {
      onLog(
        currentTimer.subject, bank.hours, quality, 0, 'timer',
        currentTimer.chapter, currentTimer.blockId,
        bank.startedAt, bank.endedAt,
      );
    }
    onTimerUpdate(update);
  };

  const [historyOpen, setHistoryOpen] = useState(false);

  /* Today's target folds down to one line: the hours done today, and Share.
     Remembered per device, not in AppState: a disclosure is a preference, and
     in AppState it would fire a sync every time somebody tapped it. */
  const [targetOpen, setTargetOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(TARGET_OPEN_KEY) !== 'false'; } catch { return true; }
  });
  const toggleTarget = () => setTargetOpen(open => {
    const next = !open;
    try { localStorage.setItem(TARGET_OPEN_KEY, String(next)); } catch { /* this session only */ }
    return next;
  });

  const todayLogs = useMemo(() =>
    logs.filter((l) => l.date === getISTDateString()).reverse(),
    [logs]);

  /* Only so a card can show whether it is on today's timeline. Derived rather
     than stored: a block can be moved, deleted, or exist only as a materialized
     rule instance, and a flag on the task would go stale on all three. */
  const todayHours = useMemo(
    () => Math.round(todayLogs.reduce((n, l) => n + l.hours, 0) * 10) / 10,
    [todayLogs],
  );

  const todayBlocks = useMemo(
    () => materializeDay(state.schedule ?? EMPTY_SCHEDULE, getISTDateString()),
    [state.schedule],
  );

  const totalToday = todayLogs.reduce((a, b) => a + b.hours, 0);
  const progressPercent = Math.min((totalToday / dailyGoalHours) * 100, 100);
  const subjectDist = useMemo(() => getSubjectDistribution(logs, activeSubjects), [logs, activeSubjects]);

  const dark = theme === 'dark';
  const t = tokens(dark);
  /* Not `timerMode`: a session running here decides what is shown, whatever
     mode another device last synced (see `heldMode`). */
  const shownMode = effectiveMode(state);
  const isPomodoro = shownMode === 'pomodoro';
  const isSprint = shownMode === 'sprint';
  const boardRef = useRef<HTMLDivElement>(null);
  const backToTasks = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    boardRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  const dot = (s: Subject) => (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.General).dot;
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
  const remaining = Math.max(0, dailyGoalHours - totalToday);
  const busy = stopwatchBusy || pomodoroBusy || sprintFocus;

  const greeting = festive !== 'none' ? FESTIVE_GREETING[festive] : null;
  const dateLine = greeting ? (
    <>
      {todayLabel}
      <span aria-hidden> · </span>
      <span className="font-accent italic" style={{ color: dark ? greeting.dark : greeting.light }}>{greeting.text}</span>
    </>
  ) : todayLabel;

  return (
    <div className="space-y-6">
      {/* Mid-session the clock is the page; the header would only push it down. */}
      {!busy && (
        <PageHeader
          dark={dark}
          title="Today"
          /* The date alone until something is logged. After that the status
             gets its own line on a phone, strictly under the date; on a wider
             screen it follows the date on one line. */
          subtitle={
            totalToday === 0
              ? dateLine
              : (
                <>
                  {dateLine}
                  <span className="hidden md:inline">. </span>
                  <br className="md:hidden" />
                  {remaining > 0
                    ? `${totalToday.toFixed(1)}h done, ${remaining.toFixed(1)}h to go.`
                    : 'Target hit. Everything now is extra.'}
                </>
              )
          }
          /* The exam countdown: it lived in the old web header above every
             tab, and belongs here at the top of the day it is counting. */
          aside={<ExamCountdown target={normalizeTarget(state.exams, streamOf(state.examPreference), state.currentClass)} dark={dark} />}
        />
      )}
      {/* Only while idle — mid-session the last thing anyone needs is a second
          opinion about what they should be doing. */}
      {!stopwatchBusy && !pomodoroBusy && !sprintFocus && state.schedule && (
        <NextUpStrip
          schedule={state.schedule}
          timer={timer}
          theme={theme}
          onStartBlock={onStartBlock}
          onOpenPlan={onOpenPlan}
        />
      )}
      {/* A line, not a card: something to read that is not a task for today. No cross on this one — an announcement is dismissed by
          reading it, and a line that could be flicked away without opening it
          would be a notice that never arrived.

          Hidden mid-session with everything else here. */}
      {!stopwatchBusy && !pomodoroBusy && !sprintFocus && unreadAnnouncements > 0 && (
        <NoticeLine
          theme={theme}
          label="A message from LOCK IN"
          detail={unreadAnnouncements > 1 ? `${unreadAnnouncements} unread` : 'Tap to read'}
          onOpen={onOpenAnnouncement}
        />
      )}
      {/* A reply to a note the student wrote on the Support page. Same shape
          and the same rule as the announcement line: no cross, it goes once
          the reply has been read. */}
      {!stopwatchBusy && !pomodoroBusy && !sprintFocus && founderReplies > 0 && onOpenFounderReply && (
        <NoticeLine
          theme={theme}
          label={`${SUPPORT_COPY.signature} replied to your note`}
          detail="Tap to read"
          onOpen={onOpenFounderReply}
        />
      )}
      {!stopwatchBusy && !sprintFocus && !targetOpen && (
        /* Folded: the hours done today, Share, and the way back open. */
        <Card dark={dark} delay={60} className="px-5 py-4 md:px-6">
          <div className="flex items-center gap-3 w-full" data-onboarding-target="daily-target">
            <button
              type="button"
              onClick={toggleTarget}
              aria-expanded={false}
              aria-label="Show today's target"
              className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
              <span className="min-w-0">
                <Eyebrow dark={dark}>Today</Eyebrow>
                <span className={`block num-stat text-[28px] leading-none mt-1.5 ${t.heading}`}>
                  {totalToday.toFixed(1)}<span className={`font-ui font-bold text-[14px] ml-1 ${t.muted}`}>h done</span>
                </span>
              </span>
            </button>
            <ShareButton onClick={onShare} theme={theme} label="Share" small />
            <button type="button" onClick={toggleTarget} aria-label="Show today's target" className={`w-8 h-8 flex items-center justify-center rounded-lg ${t.muted} ${t.hover}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>
        </Card>
      )}
      {!stopwatchBusy && !sprintFocus && targetOpen && (
        <Card dark={dark} delay={60} className="relative p-6 md:p-8">
          <button type="button" onClick={toggleTarget} aria-expanded aria-label="Collapse today's target" className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg ${t.muted} ${t.hover}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
          <div className="flex flex-row gap-6 md:gap-10 items-center w-full" data-onboarding-target="daily-target">
            <div className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="43" stroke={dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'} strokeWidth="7" fill="transparent" />
                <circle cx="50" cy="50" r="43" stroke="#E10600" strokeWidth="7" fill="transparent" strokeDasharray="270" strokeDashoffset={270 - (270 * progressPercent) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`num-hero text-[22px] md:text-[28px] ${t.heading}`}>{Math.round(progressPercent)}%</span>
                <span className={`text-[9px] font-ui font-bold uppercase tracking-[0.1em] mt-1 ${t.faint}`}>of goal</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1 min-w-0">
              <Eyebrow dark={dark}>Today’s target</Eyebrow>
              <p className={`num-hero text-[44px] md:text-[56px] mt-2 ${t.heading}`}>
                {totalToday.toFixed(1)}
                <span className={`font-ui font-bold text-[16px] md:text-[20px] ml-2 ${t.muted}`}>/ {dailyGoalHours}h</span>
              </p>
              <div className="flex gap-2 mt-3 items-center">
                <div className={`inline-flex items-center rounded-lg border ${dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}>
                  <button aria-label="Lower daily target" onClick={() => onUpdateDailyGoal(Math.max(1, dailyGoalHours - 1))} className={`w-8 h-8 text-[15px] font-bold ${t.body} ${t.hover} rounded-l-lg active:scale-90 transition-all`}>−</button>
                  <span className={`px-2 text-[11px] font-ui font-bold tabular-nums ${t.heading}`}>{dailyGoalHours}h</span>
                  <button aria-label="Raise daily target" onClick={() => onUpdateDailyGoal(dailyGoalHours + 1)} className={`w-8 h-8 text-[15px] font-bold ${t.body} ${t.hover} rounded-r-lg active:scale-90 transition-all`}>+</button>
                </div>
                {/* Beside the hours it would show. Hidden mid-session with the
                    rest of this card — a day is shared once it is done. */}
                <span className="ml-auto">
                  <ShareButton onClick={onShare} theme={theme} label="Share" small />
                </span>
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-7">
            {activeSubjects.map((s: Subject, i) => {
              const h = subjectDist[s] || 0;
              return (
                <div key={s} className={`mk-rise p-4 rounded-xl border ${t.inset}`} style={{ animationDelay: `${120 + i * 40}ms` }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot(s) }} />
                    <span className={`text-[11px] font-ui font-semibold ${t.muted}`}>{s}</span>
                  </div>
                  <p className={`num-stat text-[22px] mt-2 ${h ? t.heading : t.faint}`}>{h.toFixed(1)}<span className={`text-[12px] font-ui ml-0.5 ${t.muted}`}>h</span></p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mode switch — hidden mid-stopwatch, paused included, so a session can't
          be orphaned. A part-served Pomodoro block isn't orphaned by it:
          switching away banks the time first (see setTimerMode). */}
      {!stopwatchBusy && !sprintBusy && (
        <div className={`flex justify-center ${pomodoro.isRunning ? 'opacity-40 pointer-events-none' : ''}`}>
          <Segmented
            value={shownMode}
            onChange={mode => onSetTimerMode(mode)}
            dark={dark}
            label="Timer mode"
            options={[
              { value: 'stopwatch', label: 'Stopwatch' },
              { value: 'pomodoro', label: 'Pomodoro' },
              { value: 'sprint', label: 'Sprint' },
            ]}
          />
        </div>
      )}

      {isPomodoro ? (
        <PomodoroTimer
          runtime={pomodoro}
          settings={pomodoroSettings}
          api={pomodoroApi}
          activeSubjects={activeSubjects}
          theme={theme}
          onUpdateSettings={onUpdatePomodoroSettings}
        />
      ) : isSprint ? (
        <SprintTimer
          runtime={state.sprint ?? null}
          records={state.sprints ?? []}
          tasks={tasks}
          api={sprintApi}
          activeSubjects={activeSubjects}
          defaultSubject={timer.subject}
          theme={theme}
          onBackToTasks={backToTasks}
        />
      ) : (
        <section
          data-onboarding-target="session-timer"
          className={`mk-rise px-6 py-10 md:p-16 text-center rounded-xl border relative overflow-hidden transition-all duration-500 ${t.card}`}
          style={{ animationDelay: '120ms', ...(stopwatchBusy ? { borderColor: `${dot(timer.subject)}66` } : {}) }}
        >
          {/* The subject's colour, always. Before a session it previews the
              subject picked; once running it is the session's own subject,
              deeper and wider, so a live clock reads as live. */}
          <div
            className="absolute inset-0 pointer-events-none transition-[background] duration-700"
            style={{
              background: stopwatchBusy
                ? `radial-gradient(95% 75% at 50% 0%, ${dot(timer.subject)}${dark ? '3d' : '29'}, transparent 72%)`
                : `radial-gradient(80% 60% at 50% 0%, ${dot(manualSubject)}${dark ? '1f' : '14'}, transparent 70%)`,
            }}
          />
          {timer.isRunning && <div className="absolute top-5 right-5 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}
          <div className="relative z-10">
            <Eyebrow dark={dark}>
              {timer.isRunning ? `Focused on ${timer.subject}` : stopwatchPaused ? `Paused · ${timer.subject}` : 'Pick a subject, then start'}
            </Eyebrow>
            <StopwatchClock timer={timer} className={`text-[15vw] md:text-[104px] tabular-nums leading-none num-timer mt-8 transition-opacity ${t.heading} ${stopwatchPaused ? 'opacity-40' : ''}`} />

            {!stopwatchBusy ? (
              <>
                <div className="flex flex-wrap justify-center gap-2 mt-10">
                  {activeSubjects.map((s: Subject) => (
                    <Chip key={s} on={manualSubject === s} onClick={() => setManualSubject(s)} dark={dark} color={dot(s)} className="!px-4 !py-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot(s) }} />
                      {s}
                    </Chip>
                  ))}
                </div>
                <button
                  onClick={handleStartTimer}
                  className={`${btn} w-full max-w-md mx-auto mt-10 py-5 md:py-6 !text-[12px] !tracking-[0.3em] !rounded-xl ${t.primary}`}
                >
                  Start session
                </button>
              </>
            ) : (
              <div className="mt-10 flex flex-col items-center gap-6">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <Eyebrow dark={dark}>Focus quality</Eyebrow>
                  <div className="flex gap-1.5" role="radiogroup" aria-label="Focus quality">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={quality === v}
                        onClick={() => setQuality(v)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-ui font-bold transition-all active:scale-90 ${quality >= v ? 'bg-[#E10600] text-white' : dark ? 'bg-white/[0.05] text-zinc-500' : 'bg-zinc-100 text-zinc-500'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Running, End stays the red button it always was and Pause sits
                    beside it in outline. Paused, the colour moves to Resume:
                    getting back to work is the thing the card is asking for. */}
                <div className="flex w-full max-w-md gap-3">
                  <button
                    onClick={timer.isRunning ? handlePauseTimer : handleResumeTimer}
                    className={`${btn} flex-1 py-5 !text-[12px] !tracking-[0.3em] !rounded-xl ${timer.isRunning ? t.ghost : t.primary}`}
                  >
                    {timer.isRunning ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={handleStopTimer}
                    className={`${btn} flex-1 py-5 !text-[12px] !tracking-[0.3em] !rounded-xl ${timer.isRunning ? t.primary : t.ghost}`}
                  >
                    End session
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div ref={boardRef} className="scroll-mt-6">
      <TaskBoard
        tasks={tasks}
        todayBlocks={todayBlocks}
        theme={theme}
        activeSubjects={activeSubjects}
        onAddTask={onAddTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onMoveTask={onMoveTask}
      />
      </div>

      {/* Collapsed by default. The header keeps the information the list was
          carrying — how many sessions and how many hours — so folding it away
          costs nothing at a glance, and the detail is one tap down.

          Local state on purpose: this is a disclosure preference, not data. Put
          in AppState it would write localStorage and fire a Supabase upsert
          every time someone opened it, the same reason `lastUsedTab` and
          `theme` are held out of the sync merges. */}
      <Card dark={dark} delay={200} className="overflow-hidden">
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className={`w-full flex justify-between items-center px-5 md:px-6 py-4 ${t.hover} transition-colors`}
          aria-expanded={historyOpen}
        >
          <span className="flex items-baseline gap-3">
            <Eyebrow dark={dark}>Today’s sessions</Eyebrow>
            <span className={`text-[11px] font-ui tabular-nums ${t.faint}`}>
              {todayLogs.length ? `${todayLogs.length} ${todayLogs.length === 1 ? 'session' : 'sessions'} · ${todayHours}h` : 'None yet'}
            </span>
          </span>
          <svg className={`transition-transform ${historyOpen ? 'rotate-180' : ''} ${t.faint}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {/* Conditionally rendered rather than hidden with the `hidden`
            attribute: Tailwind's `.grid { display: grid }` overrides the
            browser's `[hidden] { display: none }`, so the attribute is set and
            the list stays on screen. */}
        {historyOpen && <div className={`border-t divide-y ${dark ? 'border-white/[0.05] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
          {todayLogs.length === 0 ? (
            <p className={`text-[13px] font-ui py-8 text-center ${t.muted}`}>No sessions yet. Start the clock.</p>
          ) : (
            todayLogs.map((l) => (
              <div key={l.id} className="flex justify-between items-center gap-4 px-5 md:px-6 py-3.5 group mk-fade">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot(l.subject) }} />
                  <div className="min-w-0">
                    <p className={`text-[13px] font-ui font-bold ${t.heading}`}>{l.subject}{l.chapter ? <span className={`font-normal ${t.muted}`}> · {l.chapter}</span> : null}</p>
                    <p className={`text-[11px] font-ui ${t.muted}`}>Focus {l.quality}/5{l.source === 'manual' ? ' · added by hand' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`num-stat text-[18px] ${t.heading}`}>{l.hours.toFixed(1)}<span className={`text-[11px] font-ui ml-0.5 ${t.muted}`}>h</span></span>
                  <button
                    onClick={() => onDeleteLog(l.id)}
                    className={`${btn} px-2.5 py-1.5 opacity-40 group-hover:opacity-100 focus:opacity-100 ${t.muted} hover:text-[#E10600]`}
                  >
                    Wipe
                  </button>
                </div>
              </div>
            ))
          )}
        </div>}
      </Card>
    </div>
  );
};

export default TodayTab;
