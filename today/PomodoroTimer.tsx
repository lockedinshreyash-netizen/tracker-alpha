import React, { useEffect, useRef, useState } from 'react';
import { Chip, btn } from '../ui/kit';
import { SUBJECT_COLORS } from '../schedule/colors';
import { PomodoroRuntime, PomodoroSettings, Subject } from '../types';
import { requestNotificationPermission, notificationPermission } from '../notify/system';
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

const subjectDot = (s: Subject) => (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.General).dot;

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

  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
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
      className={`mk-rise px-6 py-10 md:p-16 text-center rounded-xl border relative transition-all ${dark ? 'bg-[#111114]' : 'bg-white shadow-sm'} ${runtime.isRunning && isWork ? 'border-[#E10600]/30' : (dark ? 'border-white/[0.06]' : 'border-zinc-100')}`}
      style={{ animationDelay: '120ms' }}
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
              className={`w-1.5 h-1.5 rounded-full transition-all ${i < dotsFilled ? 'bg-[#E10600]' : dark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
      </div>

      <p className={`text-[15vw] md:text-[104px] tabular-nums leading-none num-timer transition-opacity ${dark ? 'text-white' : 'text-zinc-900'} ${paused ? 'opacity-40' : ''}`}>
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
                className={`w-9 h-9 rounded-lg text-[12px] font-ui font-bold transition-all active:scale-90 ${dark ? 'bg-white/[0.05] text-zinc-400 hover:bg-[#E10600] hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-[#E10600] hover:text-white'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Only before a block starts — mid-block the choice is already made. */}
      {idle && isWork && (
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {activeSubjects.map(s => (
            <Chip key={s} on={runtime.subject === s} onClick={() => api.setSubject(s)} dark={dark} color={subjectDot(s)} className="!px-4 !py-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(s) }} />
              {s}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center mt-10 gap-6">
        <button
          onClick={() => (runtime.isRunning ? api.pause() : api.start())}
          className={`${btn} w-full max-w-md py-5 md:py-6 !text-[12px] !tracking-[0.3em] !rounded-xl ${runtime.isRunning
            ? dark ? 'border border-white/[0.12] text-white hover:bg-white/[0.04]' : 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50'
            : 'bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_6px_20px_-8px_rgba(225,6,0,0.6)]'}`}
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
        <div className={`mt-10 pt-8 border-t text-left mk-fade ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ['workMinutes', 'Focus', 5, 90],
              ['shortBreakMinutes', 'Short break', 1, 30],
              ['longBreakMinutes', 'Long break', 5, 60],
              ['blocksBeforeLongBreak', 'Blocks / set', 2, 8],
            ] as const).map(([key, label, min, max]) => (
              <div key={key}>
                <p className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui mb-2 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</p>
                <div className={`inline-flex items-center rounded-lg border ${dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}>
                  <button
                    aria-label={`Less ${label}`}
                    onClick={() => onUpdateSettings({ [key]: Math.max(min, settings[key] - 1) } as Partial<PomodoroSettings>)}
                    className={`w-8 h-8 rounded-l-lg text-[15px] font-bold active:scale-90 ${dark ? 'text-zinc-300 hover:bg-white/[0.04]' : 'text-zinc-700 hover:bg-zinc-50'}`}
                  >
                    −
                  </button>
                  <span className={`num-stat text-[16px] w-8 text-center ${dark ? 'text-white' : 'text-zinc-900'}`}>{settings[key]}</span>
                  <button
                    aria-label={`More ${label}`}
                    onClick={() => onUpdateSettings({ [key]: Math.min(max, settings[key] + 1) } as Partial<PomodoroSettings>)}
                    className={`w-8 h-8 rounded-r-lg text-[15px] font-bold active:scale-90 ${dark ? 'text-zinc-300 hover:bg-white/[0.04]' : 'text-zinc-700 hover:bg-zinc-50'}`}
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
                <span className={`text-[13px] font-ui ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{label}</span>
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
