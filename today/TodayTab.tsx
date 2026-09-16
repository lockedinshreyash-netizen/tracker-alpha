import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ExamPreference, LogSource, PomodoroSettings, ScheduleBlock, SleepState, Subject, Task, TaskColumn, TimerMode, TimerState } from '../types';
import { getISTDateString, getSubjectDistribution } from '../utils';
import { isIdle as pomodoroIsIdle } from './pomodoro';
import { PomodoroApi } from './usePomodoro';
import TaskBoard from '../board/TaskBoard';
import PomodoroTimer from './PomodoroTimer';
import { Recommendation } from './recommend';
import ObservatoryStrip from '../analysis/ObservatoryStrip';
import SleepReminder from '../analysis/SleepReminder';
import { ExperimentState } from '../insight/observe';
import NextUpStrip from '../schedule/NextUpStrip';
import { EMPTY_SCHEDULE, materializeDay } from '../schedule/schedule';
import ShareButton from '../share/ShareButton';

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
  experiment: ExperimentState;
  sleep: SleepState;
  /** The door into the Observatory. Today never shows the room itself. */
  onEnterObservatory: () => void;
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
  experiment,
  sleep,
  onEnterObservatory,
}) => {
  const { timer, tasks, logs, dailyGoalHours, timerMode, pomodoro, pomodoroSettings } = state;
  const pomodoroBusy = !pomodoroIsIdle(pomodoro);
  const [manualSubject, setManualSubject] = useState<Subject>('Physics');
  const [quality, setQuality] = useState(4);

  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  const [currentDisplayMs, setCurrentDisplayMs] = useState(0);

  useEffect(() => {
    let interval: number;
    if (timer.isRunning && timer.startTime) {
      interval = window.setInterval(() => {
        setCurrentDisplayMs(Date.now() - timer.startTime! + timer.accumulatedMs);
      }, 100);
    } else {
      setCurrentDisplayMs(timer.accumulatedMs);
    }
    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startTime, timer.accumulatedMs]);

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
    if (!currentTimer.startTime && !currentTimer.accumulatedMs) return;
    const endedAt = Date.now();
    const finalMs = (currentTimer.isRunning ? endedAt - (currentTimer.startTime || endedAt) : 0) + currentTimer.accumulatedMs;
    /* Measured by the stopwatch, so it counts towards the leaderboard. The
       chapter and block ride along when the session was started from a plan —
       that stamp is the only thing that lets adherence say a block was
       honoured rather than infer it from subject and hours.

       The two instants were already in hand here and were being thrown away:
       `finalMs` is computed from `startTime` and then only its magnitude
       survived. Passing them is what makes every time-of-day question
       answerable — and the stopwatch has no pause (`accumulatedMs` is never
       written non-zero anywhere), so the pair really is one contiguous
       interval rather than a summary of several. */
    onLog(
      currentTimer.subject, finalMs / (1000 * 60 * 60), quality, 0, 'timer',
      currentTimer.chapter, currentTimer.blockId,
      currentTimer.startTime ?? undefined, endedAt,
    );
    onTimerUpdate({ isRunning: false, startTime: null, accumulatedMs: 0, chapter: undefined, blockId: undefined });
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const [historyOpen, setHistoryOpen] = useState(false);

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
  const subjectDist = getSubjectDistribution(logs, activeSubjects);

  const dark = theme === 'dark';
  const isPomodoro = timerMode === 'pomodoro';

  return (
    <div className="space-y-10 md:space-y-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Only while idle — mid-session the last thing anyone needs is a second
          opinion about what they should be doing. */}
      {!timer.isRunning && !pomodoroBusy && state.schedule && (
        <NextUpStrip
          schedule={state.schedule}
          timer={timer}
          theme={theme}
          onStartBlock={onStartBlock}
          onOpenPlan={onOpenPlan}
        />
      )}
      {/* The door into the Observatory, where the coach card used to sit — one
          line of invitation and, once the study is running, the day count.
          Nothing else: Today answers "what do I need to do today", and a
          longitudinal chart here answers a question nobody asked while a timer
          is waiting to be started.

          Hidden mid-session for the same reason everything else here is — the
          last thing anyone needs while a clock is running is somewhere else to
          go. */}
      {!timer.isRunning && !pomodoroBusy && (
        <ObservatoryStrip
          experiment={experiment}
          theme={theme}
          onEnter={onEnterObservatory}
        />
      )}

      {/* The only thing sleep leaves on Today: a single dismissable line, and
          only on a morning it has not been logged. The entry itself lives in
          the Observatory, beside the one thing that reads it — Today is for
          what you need to do today, and sleep is an input to a study rather
          than a task. */}
      {!timer.isRunning && !pomodoroBusy && (
        <SleepReminder sleep={sleep} theme={theme} onOpen={onEnterObservatory} />
      )}
      {!timer.isRunning && (
        <section className={`p-6 md:p-10 rounded-xl border flex flex-col gap-8 md:gap-10 transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
          <div className="flex flex-row gap-6 md:gap-10 items-center w-full" data-onboarding-target="daily-target">
            <div className="relative w-20 h-20 md:w-32 md:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={dark ? 'text-zinc-900' : 'text-[#F2F0EC]'} />
                <circle cx="50" cy="50" r="42" stroke="#E10600" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * progressPercent) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base md:text-xl leading-none num-stat">{Math.round(progressPercent)}%</span>
                <span className={`text-[8px] md:text-[10px] font-bold uppercase mt-1 font-ui ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Goal</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-2xl md:text-4xl tracking-tighter leading-none num-stat">{totalToday.toFixed(1)}<span className={`text-sm md:text-lg ml-2 font-ui font-bold ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>/ {dailyGoalHours}H</span></p>
              <div className="flex gap-2 mt-4 items-center">
                <div className="flex gap-1">
                  <button onClick={() => onUpdateDailyGoal(Math.max(1, dailyGoalHours - 1))} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">-</button>
                  <button onClick={() => onUpdateDailyGoal(dailyGoalHours + 1)} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">+</button>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-ui ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Daily Target</span>
                {/* Beside the hours it would show. Hidden mid-session with the
                    rest of this card — a day is shared once it is done. */}
                <span className="ml-auto">
                  <ShareButton onClick={onShare} theme={theme} label="Share" small />
                </span>
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {activeSubjects.map((s: Subject) => (
              <div key={s} className={`p-3 md:p-4 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-[#F2F0EC] border-[#E3E0D9]'}`}>
                <p className={`text-[8px] md:text-[10px] font-bold uppercase mb-1 font-ui ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>{s.substring(0, 3)}</p>
                <p className="text-sm md:text-base num-stat">{(subjectDist[s] || 0).toFixed(1)}h</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mode switch — hidden mid-stopwatch so a running session can't be orphaned.
          A part-served Pomodoro block isn't orphaned by it: switching away banks
          the time first (see setTimerMode). */}
      {!timer.isRunning && (
        <div className="flex justify-center">
          <div className={`inline-flex p-1 rounded-lg border ${dark ? 'border-white/[0.06] bg-[#111114]' : 'border-[#E3E0D9] bg-white'}`}>
            {([['stopwatch', 'Stopwatch'], ['pomodoro', 'Pomodoro']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => onSetTimerMode(mode)}
                disabled={pomodoro.isRunning}
                className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-all font-ui disabled:opacity-40 ${timerMode === mode
                  ? 'bg-[#E10600] text-white'
                  : dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-[#8A8577] hover:text-[#17150F]'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
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
      ) : (
        <section
          data-onboarding-target="session-timer"
          className={`p-10 md:p-20 text-center rounded-xl border relative overflow-hidden transition-all ${dark ? 'bg-[#111114]' : 'bg-white'} ${timer.isRunning ? 'border-[#E10600]/30' : (dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]')}`}
        >
          {timer.isRunning && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}
          <p className={`text-[10px] uppercase font-bold tracking-[0.06em] mb-10 font-ui relative z-10 ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>{timer.isRunning ? `FOCUSED ON: ${timer.subject}` : 'CHOOSE SUBJECT TO BEGIN'}</p>
          <p className="text-[14vw] md:text-8xl tabular-nums leading-none num-timer relative z-10">{formatTime(currentDisplayMs)}</p>

          {!timer.isRunning ? (
            <>
              <div className="flex flex-wrap justify-center gap-3 mt-14">
                {activeSubjects.map((s: Subject) => (
                  <button
                    key={s}
                    onClick={() => setManualSubject(s)}
                    className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all ${manualSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]')}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-center mt-12 gap-6">
                <button
                  onClick={handleStartTimer}
                  className={`w-full max-sm:px-4 py-6 md:py-7 font-black uppercase tracking-[0.3em] md:tracking-[0.5em] transition-all active:scale-[0.98] rounded-xl font-ui ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
                >
                  START SESSION
                </button>
              </div>
            </>
          ) : (
            <div className="mt-12 flex flex-col items-center gap-6 relative z-10">
              <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
                <span className={`text-[10px] font-black uppercase ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Focus Quality:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setQuality(v)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${quality >= v ? 'bg-[#E10600] text-white' : (dark ? 'bg-zinc-800 text-zinc-500' : 'bg-[#E3E0D9] text-[#8A8577]')}`}>{v}</button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleStopTimer}
                className="w-full max-w-xs py-6 font-black uppercase tracking-[0.4em] transition-all active:scale-[0.98] rounded-xl font-ui bg-[#E10600] text-white hover:bg-red-700"
              >
                END SESSION
              </button>
            </div>
          )}
        </section>
      )}

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

      {/* Collapsed by default. The header keeps the information the list was
          carrying — how many sessions and how many hours — so folding it away
          costs nothing at a glance, and the detail is one tap down.

          Local state on purpose: this is a disclosure preference, not data. Put
          in AppState it would write localStorage and fire a Supabase upsert
          every time someone opened it, the same reason `lastUsedTab` and
          `theme` are held out of the sync merges. */}
      <section className="space-y-4">
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="w-full flex justify-between items-center pb-2 group"
          aria-expanded={historyOpen}
        >
          <span className="flex items-baseline gap-3">
            <h3 className={`text-xs font-bold tracking-tight font-ui ${dark ? 'text-zinc-500' : 'text-[#6B675C]'}`}>Session History (Today)</h3>
            {todayLogs.length > 0 && (
              <span className={`text-[10px] font-bold font-ui tabular-nums ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>
                {todayLogs.length} {todayLogs.length === 1 ? 'session' : 'sessions'} · {todayHours}h
              </span>
            )}
          </span>
          <span
            className={`text-[10px] font-bold font-ui transition-transform ${historyOpen ? 'rotate-180' : ''} ${dark ? 'text-zinc-600' : 'text-[#8A8577]'}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        {/* Conditionally rendered rather than hidden with the `hidden`
            attribute: Tailwind's `.grid { display: grid }` overrides the
            browser's `[hidden] { display: none }`, so the attribute is set and
            the list stays on screen. */}
        {historyOpen && <div className="grid gap-3">
          {todayLogs.length === 0 ? (
            <p className={`text-[10px] font-black uppercase py-4 text-center italic ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>No sessions recorded today.</p>
          ) : (
            todayLogs.map((l) => (
              <div key={l.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all group card-interactive ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
                <div>
                  <p className="text-[8px] font-black text-[#E10600] uppercase mb-0.5">{l.subject}</p>
                  <p className={`text-base font-black italic ${dark ? '' : 'text-[#17150F]'}`}>{l.hours}h <span className={`text-[10px] not-italic font-bold ml-2 ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Q: {l.quality}/5</span></p>
                </div>
                <button
                  onClick={() => onDeleteLog(l.id)}
                  className={`text-[10px] font-black uppercase px-3 py-1 border rounded opacity-40 group-hover:opacity-100 transition-all ${dark ? 'text-zinc-600 hover:text-red-500 border-zinc-800' : 'text-[#8A8577] hover:text-red-500 border-[#E3E0D9]'}`}
                >
                  WIPE
                </button>
              </div>
            ))
          )}
        </div>}
      </section>
    </div>
  );
};

export default TodayTab;
