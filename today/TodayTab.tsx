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
import NoticeLine from '../notify/NoticeLine';
import { ExperimentState } from '../insight/observe';
import NextUpStrip from '../schedule/NextUpStrip';
import { EMPTY_SCHEDULE, materializeDay } from '../schedule/schedule';
import ShareButton from '../share/ShareButton';
import { SUBJECT_COLORS } from '../schedule/colors';
import { Card, Chip, Eyebrow, PageHeader, Segmented, btn, tokens } from '../ui/kit';

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
  /* Set only when an app-wide announcement is live, unread, and the user has
     closed its modal without acknowledging it. The modal is the notice; this
     line is the way back to one that was waved off, so nothing published is
     ever lost to a stray tap on the scrim. */
  unreadAnnouncements: number;
  onOpenAnnouncement: () => void;
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
  unreadAnnouncements,
  onOpenAnnouncement,
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
  const t = tokens(dark);
  const isPomodoro = timerMode === 'pomodoro';
  const dot = (s: Subject) => (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.General).dot;
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
  const remaining = Math.max(0, dailyGoalHours - totalToday);
  const busy = timer.isRunning || pomodoroBusy;

  return (
    <div className="space-y-6">
      {/* Mid-session the clock is the page; the header would only push it down. */}
      {!busy && (
        <PageHeader
          dark={dark}
          title="Today"
          subtitle={
            totalToday === 0
              ? `${todayLabel}. Nothing logged yet. The clock is waiting.`
              : remaining > 0
                ? `${todayLabel}. ${totalToday.toFixed(1)}h done, ${remaining.toFixed(1)}h to go.`
                : `${todayLabel}. Target hit. Everything now is extra.`
          }
        />
      )}
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

      {/* The same line, for the same reason: something to read that is not a
          task for today. No cross on this one — an announcement is dismissed by
          reading it, and a line that could be flicked away without opening it
          would be a notice that never arrived.

          Hidden mid-session with everything else here. */}
      {!timer.isRunning && !pomodoroBusy && unreadAnnouncements > 0 && (
        <NoticeLine
          theme={theme}
          label="A message from LOCK IN"
          detail={unreadAnnouncements > 1 ? `${unreadAnnouncements} unread` : 'Tap to read'}
          onOpen={onOpenAnnouncement}
        />
      )}
      {!timer.isRunning && (
        <Card dark={dark} delay={60} className="p-6 md:p-8">
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

      {/* Mode switch — hidden mid-stopwatch so a running session can't be orphaned.
          A part-served Pomodoro block isn't orphaned by it: switching away banks
          the time first (see setTimerMode). */}
      {!timer.isRunning && (
        <div className={`flex justify-center ${pomodoro.isRunning ? 'opacity-40 pointer-events-none' : ''}`}>
          <Segmented
            value={timerMode}
            onChange={mode => onSetTimerMode(mode)}
            dark={dark}
            label="Timer mode"
            options={[{ value: 'stopwatch', label: 'Stopwatch' }, { value: 'pomodoro', label: 'Pomodoro' }]}
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
      ) : (
        <section
          data-onboarding-target="session-timer"
          className={`mk-rise px-6 py-10 md:p-16 text-center rounded-xl border relative overflow-hidden transition-all duration-500 ${t.card}`}
          style={{ animationDelay: '120ms', ...(timer.isRunning ? { borderColor: `${dot(timer.subject)}66` } : {}) }}
        >
          {/* The subject's colour, always. Before a session it previews the
              subject picked; once running it is the session's own subject,
              deeper and wider, so a live clock reads as live. */}
          <div
            className="absolute inset-0 pointer-events-none transition-[background] duration-700"
            style={{
              background: timer.isRunning
                ? `radial-gradient(95% 75% at 50% 0%, ${dot(timer.subject)}${dark ? '3d' : '29'}, transparent 72%)`
                : `radial-gradient(80% 60% at 50% 0%, ${dot(manualSubject)}${dark ? '1f' : '14'}, transparent 70%)`,
            }}
          />
          {timer.isRunning && <div className="absolute top-5 right-5 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}
          <div className="relative z-10">
            <Eyebrow dark={dark}>{timer.isRunning ? `Focused on ${timer.subject}` : 'Pick a subject, then start'}</Eyebrow>
            <p className={`text-[15vw] md:text-[104px] tabular-nums leading-none num-timer mt-8 ${t.heading}`}>{formatTime(currentDisplayMs)}</p>

            {!timer.isRunning ? (
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
                <button onClick={handleStopTimer} className={`${btn} w-full max-w-xs py-5 !text-[12px] !tracking-[0.3em] !rounded-xl ${t.primary}`}>
                  End session
                </button>
              </div>
            )}
          </div>
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
