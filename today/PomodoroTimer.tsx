import React, { useEffect, useRef, useState } from 'react';
import { PomodoroRuntime, PomodoroSettings, Subject } from '../types';
import { requestNotificationPermission, notificationPermission } from '../leaderboard/notify';
import {
  MIN_LOGGABLE_MS,
  PHASE_LABEL,
  describeLateness,
  formatCountdown,
  formatDuration,
  isIdle,
  isPaused,
  leftMs,
  servedMs,
} from './pomodoro';
import { PomodoroApi } from './usePomodoro';

interface Props {
  runtime: PomodoroRuntime;
  settings: PomodoroSettings;
  api: PomodoroApi;
  activeSubjects: Subject[];
  theme: 'dark' | 'light';
  onUpdateSettings: (next: Partial<PomodoroSettings>) => void;
}

const PomodoroTimer: React.FC<Props> = ({
  runtime,
  settings,
  api,
  activeSubjects,
  theme,
  onUpdateSettings,
}) => {
  const dark = theme === 'dark';
  const [now, setNow] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);

  const idle = isIdle(runtime);
  const paused = isPaused(runtime);
  const isWork = runtime.phase === 'work';
  const rating = runtime.pendingRating[0] ?? null;

  /* ── Display tick ──
     Only the clock on screen. The phase itself is run by the engine in App, so
     this stopping — another tab, a slept device — can't cost a block. */
  useEffect(() => {
    if (!runtime.isRunning) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [runtime.isRunning]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  /* Space starts and pauses. Ignored while typing, so the task box keeps its
     spaces, and while a button has focus, where it is already that button. */
  const apiRef = useRef(api);
  useEffect(() => { apiRef.current = api; }, [api]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== 'Space' && e.key !== ' ') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || el?.isContentEditable) return;
      e.preventDefault();
      apiRef.current.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const left = leftMs(runtime, settings, now);
  const served = servedMs(runtime, now);
  const perSet = Math.max(1, settings.blocksBeforeLongBreak);
  const dotsFilled = runtime.completedBlocks % perSet;

  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const link = `text-[10px] uppercase font-bold tracking-[0.08em] font-ui ${muted} hover:text-[#E10600] transition-colors`;

  const toggleNotify = async (want: boolean) => {
    setNotifyNote(null);
    if (!want) { onUpdateSettings({ notify: false }); return; }
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      onUpdateSettings({ notify: false });
      setNotifyNote(permission === 'unsupported' ? 'No notifications in this browser.' : 'Blocked by the browser.');
      return;
    }
    onUpdateSettings({ notify: true });
  };

  useEffect(() => {
    // A permission revoked outside the app must not leave the switch lying.
    if (settings.notify && notificationPermission() !== 'granted') onUpdateSettings({ notify: false });
  }, [settings.notify]);

  /* One line, one truth: what phase, what subject, what state. */
  const heading = [
    PHASE_LABEL[runtime.phase],
    isWork ? runtime.subject : null,
    paused ? 'Paused' : null,
  ].filter(Boolean).join(' · ');

  const primaryLabel = runtime.isRunning
    ? 'Pause'
    : paused
      ? 'Resume'
      : idle && runtime.completedBlocks === 0 ? 'Start' : isWork ? 'Start next block' : 'Start break';

  const endLabel = isWork
    ? served >= MIN_LOGGABLE_MS ? `End block · ${formatDuration(served)}` : 'End block'
    : 'Skip break';

  return (
    <section
      data-onboarding-target="session-timer"
      className={`p-10 md:p-20 text-center rounded-xl border relative transition-all ${dark ? 'bg-[#111114]' : 'bg-white'} ${runtime.isRunning && isWork ? 'border-[#E10600]/30' : (dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]')}`}
    >
      {runtime.isRunning && isWork && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}

      <div className="flex items-center justify-center gap-3 mb-10">
        <p className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${isWork && !paused ? 'text-[#E10600]' : muted}`}>
          {heading}
        </p>
        <div className="flex gap-1.5">
          {Array.from({ length: perSet }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i < dotsFilled ? 'bg-[#E10600]' : dark ? 'bg-zinc-800' : 'bg-[#E3E0D9]'}`}
            />
          ))}
        </div>
      </div>

      <p className={`text-[14vw] md:text-8xl tabular-nums leading-none num-timer transition-opacity ${paused ? 'opacity-40' : ''}`}>
        {formatCountdown(left)}
      </p>

      {api.lateBy !== null && (
        <p className={`text-[11px] font-ui mt-6 ${muted}`}>
          That phase ended {describeLateness(api.lateBy)}, out of sight. It was logged.
        </p>
      )}

      {api.staleDrop && (
        <p className={`text-[11px] font-ui mt-6 ${muted}`}>
          {api.staleDrop}{' '}
          <button onClick={api.clearStaleDrop} className="underline hover:text-[#E10600] transition-colors">Dismiss</button>
        </p>
      )}

      {/* The hours are already logged. This only sharpens them. */}
      {rating && (
        <div className="mt-10">
          <p className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${muted}`}>
            {formatDuration(rating.hours * 3_600_000)} of {rating.subject} logged — how focused?
          </p>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                onClick={() => api.rate(rating.logId, q)}
                className={`w-9 h-9 rounded-md text-[10px] font-bold transition-all ${dark ? 'bg-zinc-800 text-zinc-400 hover:bg-[#E10600] hover:text-white' : 'bg-[#E3E0D9] text-[#6B675C] hover:bg-[#E10600] hover:text-white'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Only before a block starts — mid-block the choice is already made. */}
      {idle && isWork && (
        <div className="flex flex-wrap justify-center gap-3 mt-14">
          {activeSubjects.map(s => (
            <button
              key={s}
              onClick={() => api.setSubject(s)}
              className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all ${runtime.subject === s
                ? 'bg-[#E10600] border-[#E10600] text-white'
                : dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]'
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center mt-12 gap-6">
        <button
          onClick={() => (runtime.isRunning ? api.pause() : api.start())}
          className={`w-full max-sm:px-4 py-6 md:py-7 font-black uppercase tracking-[0.3em] md:tracking-[0.5em] transition-all active:scale-[0.98] rounded-xl font-ui ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
        >
          {primaryLabel}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {/* Ending early is not abandoning: the time served is logged. */}
          {!idle && <button onClick={() => api.end()} className={link}>{endLabel}</button>}
          <button onClick={() => setShowSettings(v => !v)} className={link}>
            {showSettings ? 'Hide settings' : 'Settings'}
          </button>
          {(runtime.completedBlocks > 0 || !idle) && (
            <button onClick={() => api.reset()} className={link}>Reset set</button>
          )}
        </div>
      </div>

      {showSettings && (
        <div className={`mt-10 pt-8 border-t text-left ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ['workMinutes', 'Focus', 5, 90],
              ['shortBreakMinutes', 'Short break', 1, 30],
              ['longBreakMinutes', 'Long break', 5, 60],
              ['blocksBeforeLongBreak', 'Blocks / set', 2, 8],
            ] as const).map(([key, label, min, max]) => (
              <div key={key}>
                <p className={`text-[9px] uppercase font-bold tracking-[0.08em] font-ui mb-2 ${muted}`}>{label}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateSettings({ [key]: Math.max(min, settings[key] - 1) } as Partial<PomodoroSettings>)}
                    className={`w-7 h-7 rounded text-xs font-bold ${dark ? 'bg-zinc-800 text-zinc-400' : 'bg-[#E3E0D9] text-[#6B675C]'}`}
                  >
                    −
                  </button>
                  <span className="num-stat text-base w-6 text-center">{settings[key]}</span>
                  <button
                    onClick={() => onUpdateSettings({ [key]: Math.min(max, settings[key] + 1) } as Partial<PomodoroSettings>)}
                    className={`w-7 h-7 rounded text-xs font-bold ${dark ? 'bg-zinc-800 text-zinc-400' : 'bg-[#E3E0D9] text-[#6B675C]'}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {([
              ['autoStartNext', 'Start the next phase automatically', settings.autoStartNext],
              ['keepAwake', 'Keep the screen awake during a block', settings.keepAwake ?? false],
              ['notify', 'Notify me when a phase ends', settings.notify ?? false],
            ] as const).map(([key, label, checked]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => (key === 'notify' ? toggleNotify(e.target.checked) : onUpdateSettings({ [key]: e.target.checked } as Partial<PomodoroSettings>))}
                  className="accent-[#E10600] w-4 h-4"
                />
                <span className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${muted}`}>{label}</span>
                {key === 'notify' && notifyNote && <span className={`text-[10px] font-ui ${muted}`}>— {notifyNote}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default PomodoroTimer;
