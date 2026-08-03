import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Subject, TimerState } from '../types';
import { LOCK_IN_QUOTES } from '../constants';
import { getISTDateString, getSubjectDistribution } from '../utils';
import TaskSection from './TaskSection';

interface Props {
  state: AppState;
  onLog: (subject: Subject, hours: number, quality: number, distractions: number) => void;
  onDeleteLog: (id: string) => void;
  onTimerUpdate: (timerUpdate: Partial<TimerState>) => void;
  onToggleLockInMode: (val: boolean) => void;
  onAddTask: (text: string, subject: Subject) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateDailyGoal: (val: number) => void;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
}

const TodayTab: React.FC<Props> = ({
  state,
  onLog,
  onDeleteLog,
  onTimerUpdate,
  onToggleLockInMode,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateDailyGoal,
  theme,
  activeSubjects
}) => {
  const { timer, tasks, isLockInModeEnabled, logs, dailyGoalHours } = state;
  const [manualSubject, setManualSubject] = useState<Subject>('Physics');
  const [quality, setQuality] = useState(4);
  const [showWarning, setShowWarning] = useState(false);
  const [showBreach, setShowBreach] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [wipeHoldStart, setWipeHoldStart] = useState<number | null>(null);
  const [wipeProgress, setWipeProgress] = useState(0);

  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  const REQUIRED_FOCUS_MS = 15 * 60 * 1000;
  const WIPE_HOLD_MS = 15000;

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

  useEffect(() => {
    if (timer.isLockInActive) {
      const handleFsChange = () => {
        if (!document.fullscreenElement) {
          onTimerUpdate({
            isRunning: false,
            accumulatedMs: Date.now() - (timerRef.current.startTime || Date.now()) + timerRef.current.accumulatedMs,
            startTime: null,
            distractions: (timerRef.current.distractions || 0) + 1
          });
          setShowBreach(true);
        }
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }
  }, [timer.isLockInActive, onTimerUpdate]);

  useEffect(() => {
    if (timer.isLockInActive) {
      const qInterval = setInterval(() => setQuoteIdx(p => (p + 1) % LOCK_IN_QUOTES.length), 10000);
      return () => clearInterval(qInterval);
    }
  }, [timer.isLockInActive]);

  useEffect(() => {
    let interval: number;
    if (wipeHoldStart !== null) {
      interval = window.setInterval(() => {
        const elapsed = Date.now() - wipeHoldStart;
        const progress = Math.min((elapsed / WIPE_HOLD_MS) * 100, 100);
        setWipeProgress(progress);
        if (elapsed >= WIPE_HOLD_MS) {
          handleWipeSession();
        }
      }, 100);
    } else {
      setWipeProgress(0);
    }
    return () => clearInterval(interval);
  }, [wipeHoldStart]);

  const handleStartTimer = async () => {
    if (isLockInModeEnabled) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        alert("LOCK-IN REQUIREMENT: Fullscreen access is mandatory.");
        return;
      }
    }
    onTimerUpdate({ isRunning: true, startTime: Date.now(), subject: manualSubject, isLockInActive: isLockInModeEnabled });
  };

  const handleStopTimer = () => {
    const currentTimer = timerRef.current;
    if (!currentTimer.startTime && !currentTimer.accumulatedMs) return;
    const finalMs = (currentTimer.isRunning ? Date.now() - (currentTimer.startTime || Date.now()) : 0) + currentTimer.accumulatedMs;
    onLog(currentTimer.subject, finalMs / (1000 * 60 * 60), quality, currentTimer.distractions || 0);
    onTimerUpdate({ isRunning: false, startTime: null, accumulatedMs: 0, isLockInActive: false, distractions: 0 });
    if (document.fullscreenElement) document.exitFullscreen();
    setShowBreach(false);
  };

  const handleWipeSession = () => {
    onTimerUpdate({ isRunning: false, startTime: null, accumulatedMs: 0, isLockInActive: false, distractions: 0 });
    if (document.fullscreenElement) document.exitFullscreen();
    setWipeHoldStart(null);
    setShowBreach(false);
  };

  const handleResumeBreach = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowBreach(false);
      onTimerUpdate({ isRunning: true, startTime: Date.now() });
    } catch (err) {
      alert("CRITICAL: Fullscreen required to resume focus.");
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayLogs = useMemo(() =>
    logs.filter((l) => l.date === getISTDateString()).reverse(),
    [logs]);

  const totalToday = todayLogs.reduce((a, b) => a + b.hours, 0);
  const progressPercent = Math.min((totalToday / dailyGoalHours) * 100, 100);
  const subjectDist = getSubjectDistribution(logs, activeSubjects);

  const canEndSession = currentDisplayMs >= REQUIRED_FOCUS_MS;
  const timeRemainingToEnd = Math.max(0, REQUIRED_FOCUS_MS - currentDisplayMs);

  if (timer.isLockInActive) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-4 md:p-8 select-none overflow-hidden font-mono">
        {showBreach && (
          <div className="absolute inset-0 z-[10000] bg-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
            <h2 className="text-3xl md:text-5xl tracking-tighter mb-4 text-[#E10600] font-display">SESSION BREACHED</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.06em] text-[10px] md:text-xs mb-8 text-center font-ui">Focus interrupted. Session paused. 1 Distraction recorded.</p>
            <button
              onClick={handleResumeBreach}
              className="px-12 py-6 bg-white text-black font-black uppercase tracking-[0.4em] rounded-lg hover:bg-zinc-200 transition-all"
            >
              RESUME FOCUS
            </button>
            <div className="mt-12 relative flex flex-col items-center">
              <button
                onMouseDown={() => setWipeHoldStart(Date.now())}
                onMouseUp={() => setWipeHoldStart(null)}
                onMouseLeave={() => setWipeHoldStart(null)}
                onTouchStart={() => setWipeHoldStart(Date.now())}
                onTouchEnd={() => setWipeHoldStart(null)}
                className="text-[10px] font-black uppercase text-zinc-700 hover:text-red-500 transition-colors py-2"
              >
                {wipeHoldStart ? `WIPING IN ${(15 - (wipeProgress * 15 / 100)).toFixed(1)}s` : 'HOLD FOR 15s TO DISCARD SESSION'}
              </button>
              {wipeProgress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 transition-all" style={{ width: `${wipeProgress}%` }} />
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900 via-transparent to-transparent" />
        <div className="absolute top-12 left-0 right-0 text-center px-4">
          <p className="text-[10px] text-[#E10600] uppercase tracking-[0.5em] md:tracking-[0.8em] mb-2 font-ui font-bold">ACTIVE FOCUS SESSION</p>
          <p className="text-[12px] md:text-[14px] text-zinc-600 uppercase font-bold font-ui">{LOCK_IN_QUOTES[quoteIdx]}</p>
        </div>

        <p className="text-[18vw] md:text-[10vw] text-white tabular-nums tracking-tight leading-none num-timer">{formatTime(currentDisplayMs)}</p>
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-[10px] md:text-[12px] text-zinc-600 uppercase tracking-[0.3em] font-bold font-ui">{timer.subject} — DEEP FOCUS</p>
          {(timer.distractions || 0) > 0 && <p className="text-[8px] text-[#E10600] font-bold uppercase tracking-[0.06em] font-ui">{timer.distractions} BREACH(ES) RECORDED</p>}
        </div>

        <div className="mt-8 md:mt-12 w-full max-w-xs flex flex-col items-center gap-4">
          <button
            disabled={!canEndSession}
            onClick={handleStopTimer}
            className={`w-full py-6 md:py-8 font-black uppercase tracking-[0.4em] md:tracking-[0.6em] border-2 transition-all rounded-lg active:scale-95 ${canEndSession ? 'bg-white text-black border-white hover:bg-transparent hover:text-white shadow-[0_0_50px_rgba(255,255,255,0.05)]' : 'bg-zinc-900 text-zinc-700 border-zinc-800 opacity-50 cursor-not-allowed'}`}
          >
            {canEndSession ? 'SESSION FINISHED' : `LOCK-OUT: ${formatTime(timeRemainingToEnd)}`}
          </button>

          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min((currentDisplayMs / REQUIRED_FOCUS_MS) * 100, 100)}%` }} />
          </div>

          <div className="relative w-full mt-8 flex flex-col items-center">
            <button
              onMouseDown={() => setWipeHoldStart(Date.now())}
              onMouseUp={() => setWipeHoldStart(null)}
              onMouseLeave={() => setWipeHoldStart(null)}
              onTouchStart={() => setWipeHoldStart(Date.now())}
              onTouchEnd={() => setWipeHoldStart(null)}
              className="text-[9px] font-medium uppercase text-zinc-800 hover:text-zinc-400 transition-colors py-2"
            >
              {wipeHoldStart ? `WIPING IN ${(15 - (wipeProgress * 15 / 100)).toFixed(1)}s` : 'HOLD FOR 15s TO WIPE SESSION'}
            </button>
            {wipeProgress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 transition-all" style={{ width: `${wipeProgress}%` }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 md:space-y-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!timer.isRunning && (
        <section className={`p-6 md:p-10 rounded-xl border flex flex-col gap-8 md:gap-10 transition-all ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
          <div className="flex flex-row gap-6 md:gap-10 items-center w-full">
            <div className="relative w-20 h-20 md:w-32 md:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={theme === 'dark' ? 'text-zinc-900' : 'text-[#F2F0EC]'} />
                <circle cx="50" cy="50" r="42" stroke="#E10600" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * progressPercent) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base md:text-xl leading-none num-stat">{Math.round(progressPercent)}%</span>
                <span className={`text-[8px] md:text-[10px] font-bold uppercase mt-1 font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Goal</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-2xl md:text-4xl tracking-tighter leading-none num-stat">{totalToday.toFixed(1)}<span className={`text-sm md:text-lg ml-2 font-ui font-bold ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>/ {dailyGoalHours}H</span></p>
              <div className="flex gap-2 mt-4 items-center">
                <div className="flex gap-1">
                  <button onClick={() => onUpdateDailyGoal(Math.max(1, dailyGoalHours - 1))} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">-</button>
                  <button onClick={() => onUpdateDailyGoal(dailyGoalHours + 1)} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">+</button>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Daily Target</span>
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {activeSubjects.map((s: Subject) => (
              <div key={s} className={`p-3 md:p-4 rounded-lg border ${theme === 'dark' ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-[#F2F0EC] border-[#E3E0D9]'}`}>
                <p className={`text-[8px] md:text-[10px] font-bold uppercase mb-1 font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>{s.substring(0, 3)}</p>
                <p className="text-sm md:text-base num-stat">{(subjectDist[s] || 0).toFixed(1)}h</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`p-10 md:p-20 text-center rounded-xl border relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#111114]' : 'bg-white'} ${timer.isRunning ? 'border-[#E10600]/30' : (theme === 'dark' ? 'border-white/[0.06]' : 'border-[#E3E0D9]')}`}>
        {timer.isRunning && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}
        <p className={`text-[10px] uppercase font-bold tracking-[0.06em] mb-10 font-ui relative z-10 ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>{timer.isRunning ? `FOCUSED ON: ${timer.subject}` : 'CHOOSE SUBJECT TO BEGIN'}</p>
        <p className="text-[14vw] md:text-8xl tabular-nums leading-none num-timer relative z-10">{formatTime(currentDisplayMs)}</p>

        {!timer.isRunning ? (
          <>
            <div className="flex flex-wrap justify-center gap-3 mt-14">
              {activeSubjects.map((s: Subject) => (
                <button
                  key={s}
                  onClick={() => setManualSubject(s)}
                  className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all ${manualSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]')}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center mt-12 gap-6">
              <button
                onClick={handleStartTimer}
                className={`w-full max-sm:px-4 py-6 md:py-7 font-black uppercase tracking-[0.3em] md:tracking-[0.5em] transition-all active:scale-[0.98] rounded-lg font-ui ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
              >
                START SESSION
              </button>
              <button
                onClick={() => isLockInModeEnabled ? onToggleLockInMode(false) : setShowWarning(true)}
                className={`text-[9px] font-bold uppercase tracking-[0.1em] px-8 py-2.5 rounded-full border transition-all ${isLockInModeEnabled ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.14]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]')}`}
              >
                {isLockInModeEnabled ? '🔒 LOCK-IN ACTIVE' : '🔓 LOCK-IN DISABLED'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center gap-6 relative z-10">
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
              <span className={`text-[10px] font-black uppercase ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Focus Quality:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setQuality(v)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${quality >= v ? 'bg-[#E10600] text-white' : (theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-[#E3E0D9] text-[#8A8577]')}`}>{v}</button>
                ))}
              </div>
            </div>
            <button
              onClick={handleStopTimer}
              className="w-full max-w-xs py-6 bg-[#E10600] text-white font-black uppercase tracking-[0.4em] hover:bg-red-700 transition-all active:scale-[0.98] rounded-lg font-ui"
            >
              END SESSION
            </button>
          </div>
        )}
      </section>

      <TaskSection tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} theme={theme} activeSubjectFilter={timer.isRunning ? timer.subject : null} activeSubjects={activeSubjects} />

      <section className="space-y-4">
        <div className="flex justify-between items-end pb-2">
          <h3 className={`text-xs font-bold tracking-tight font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-[#6B675C]'}`}>Session History (Today)</h3>
        </div>
        <div className="grid gap-3">
          {todayLogs.length === 0 ? (
            <p className={`text-[10px] font-black uppercase py-4 text-center italic ${theme === 'dark' ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>No sessions recorded today.</p>
          ) : (
            todayLogs.map((l) => (
              <div key={l.id} className={`flex justify-between items-center p-4 rounded-lg border transition-all group card-interactive ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
                <div>
                  <p className="text-[8px] font-black text-[#E10600] uppercase mb-0.5">{l.subject}</p>
                  <p className={`text-base font-black italic ${theme === 'dark' ? '' : 'text-[#17150F]'}`}>{l.hours}h <span className={`text-[10px] not-italic font-bold ml-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Q: {l.quality}/5</span></p>
                </div>
                <button
                  onClick={() => onDeleteLog(l.id)}
                  className={`text-[10px] font-black uppercase px-3 py-1 border rounded opacity-40 group-hover:opacity-100 transition-all ${theme === 'dark' ? 'text-zinc-600 hover:text-red-500 border-zinc-800' : 'text-[#8A8577] hover:text-red-500 border-[#E3E0D9]'}`}
                >
                  WIPE
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`max-w-md w-full p-6 md:p-10 border-2 rounded-xl ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#E10600]' : 'bg-white border-[#E10600]'}`}>
            <h2 className="text-2xl font-black italic tracking-tighter mb-4 text-[#E10600]">ACTIVATE LOCK-IN?</h2>
            <div className={`space-y-4 text-xs font-bold uppercase tracking-tight leading-relaxed ${theme === 'dark' ? 'text-zinc-500' : 'text-[#6B675C]'}`}>
              <p>1. FULLSCREEN IS MANDATORY.</p>
              <p>2. EXITING FULLSCREEN PAUSES THE TIMER AND RECORDS A BREACH.</p>
              <p>3. YOU MUST FOCUS FOR AT LEAST 15 MINUTES TO LOG THE SESSION.</p>
              <p>4. TAB SWITCHING IS DETECTED.</p>
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={() => { onToggleLockInMode(true); setShowWarning(false); }} className={`flex-1 py-4 font-black uppercase tracking-[0.06em] rounded-md transition-all ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}>ENGAGE</button>
              <button onClick={() => setShowWarning(false)} className={`flex-1 py-4 font-black uppercase tracking-[0.06em] rounded-md transition-all ${theme === 'dark' ? 'bg-zinc-900 text-zinc-500' : 'bg-[#F2F0EC] text-[#6B675C]'}`}>ABORT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayTab;
