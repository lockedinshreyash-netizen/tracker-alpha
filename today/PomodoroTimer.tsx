import React, { useEffect, useRef, useState } from 'react';
import { PomodoroRuntime, PomodoroSettings, Subject } from '../types';
import * as sfx from '../audio';
import {
  PHASE_LABEL,
  blocksAfterPhase,
  describeLateness,
  formatCountdown,
  nextPhase,
  phaseDurationMs,
  remainingMs,
} from './pomodoro';

interface Props {
  pomodoro: PomodoroRuntime;
  settings: PomodoroSettings;
  activeSubjects: Subject[];
  theme: 'dark' | 'light';
  onUpdate: (next: Partial<PomodoroRuntime>) => void;
  onUpdateSettings: (next: Partial<PomodoroSettings>) => void;
  onLogBlock: (subject: Subject, hours: number, quality: number) => void;
}

const DEFAULT_QUALITY = 4;

const PomodoroTimer: React.FC<Props> = ({
  pomodoro,
  settings,
  activeSubjects,
  theme,
  onUpdate,
  onUpdateSettings,
  onLogBlock,
}) => {
  const dark = theme === 'dark';
  const [now, setNow] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [lateBy, setLateBy] = useState<number | null>(null);

  /* Refs so the completion handler never reads stale props. */
  const pomodoroRef = useRef(pomodoro);
  const settingsRef = useRef(settings);
  useEffect(() => { pomodoroRef.current = pomodoro; }, [pomodoro]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const originalTitle = useRef<string>(typeof document !== 'undefined' ? document.title : '');

  /* ── Tick. Derives everything from the clock, so background throttling
     only reduces update frequency — it can never make the timer drift. ── */
  useEffect(() => {
    if (!pomodoro.isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [pomodoro.isRunning]);

  /* Re-check the moment the tab becomes visible, since intervals may have been
     throttled to near-nothing while hidden. */
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const left = remainingMs(pomodoro.phaseEndsAt, now);
  const isWork = pomodoro.phase === 'work';

  /* ── Phase completion ── */
  useEffect(() => {
    const p = pomodoroRef.current;
    if (!p.isRunning || p.phaseEndsAt === null) return;
    if (now < p.phaseEndsAt) return;

    const s = settingsRef.current;
    const overdue = now - p.phaseEndsAt;
    const finished = p.phase;
    const blocks = blocksAfterPhase(finished, p.completedBlocks);
    const upcoming = nextPhase(finished, blocks, s);

    if (finished === 'work') {
      sfx.phaseComplete();
    } else {
      sfx.breakOver();
    }

    /* A phase that ended while the tab was hidden is reported, not silently
       rolled forward — otherwise a long absence would fabricate a chain of
       phases the user never actually sat through. */
    const wasLate = overdue > 5000;
    setLateBy(wasLate ? overdue : null);

    const autoStart = s.autoStartNext && !wasLate;

    onUpdate({
      phase: upcoming,
      completedBlocks: blocks,
      isRunning: autoStart,
      phaseEndsAt: autoStart ? Date.now() + phaseDurationMs(upcoming, s) : null,
      // A finished work block waits here for its quality rating.
      pendingBlock:
        finished === 'work'
          ? { subject: p.subject, hours: s.workMinutes / 60 }
          : p.pendingBlock,
    });
  }, [now, onUpdate]);

  /* ── Tab title. Makes a backgrounded tab visible in the tab strip. ── */
  useEffect(() => {
    const base = originalTitle.current;
    const waiting = !pomodoro.isRunning && pomodoro.phaseEndsAt === null && pomodoro.completedBlocks > 0;

    if (!waiting) {
      if (pomodoro.isRunning) {
        document.title = `${formatCountdown(left)} · ${PHASE_LABEL[pomodoro.phase]}`;
      } else {
        document.title = base;
      }
      return;
    }

    const message = isWork ? '⏰ Back to work' : '⏰ Break time';
    let on = true;
    document.title = message;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? message : base;
    }, 1200);

    return () => {
      window.clearInterval(id);
      document.title = base;
    };
  }, [pomodoro.isRunning, pomodoro.phaseEndsAt, pomodoro.completedBlocks, pomodoro.phase, left, isWork]);

  /* Always hand the title back on unmount. */
  useEffect(() => {
    const base = originalTitle.current;
    return () => { document.title = base; };
  }, []);

  const start = () => {
    sfx.select();
    setLateBy(null);
    onUpdate({
      isRunning: true,
      phaseEndsAt: Date.now() + phaseDurationMs(pomodoro.phase, settings),
    });
  };

  const stop = () => {
    sfx.select();
    setLateBy(null);
    // Abandoning a block logs nothing — completing it is the commitment.
    onUpdate({ isRunning: false, phaseEndsAt: null });
  };

  const reset = () => {
    sfx.select();
    setLateBy(null);
    onUpdate({ phase: 'work', isRunning: false, phaseEndsAt: null, completedBlocks: 0 });
  };

  const rate = (q: number) => {
    const block = pomodoro.pendingBlock;
    if (!block) return;
    sfx.select();
    onLogBlock(block.subject, block.hours, q);
    onUpdate({ pendingBlock: null });
  };

  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const perSet = Math.max(1, settings.blocksBeforeLongBreak);
  const dotsFilled = pomodoro.completedBlocks % perSet;
  const idle = !pomodoro.isRunning && pomodoro.phaseEndsAt === null;

  return (
    <section
      data-onboarding-target="session-timer"
      className={`p-8 md:p-14 rounded-xl border relative transition-all ${card} ${pomodoro.isRunning && isWork ? 'border-[#E10600]/30' : ''}`}
    >
      {/* Phase + block progress */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-[10px] uppercase font-bold tracking-[0.14em] font-ui ${isWork ? 'text-[#E10600]' : muted}`}>
          {PHASE_LABEL[pomodoro.phase]}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: perSet }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i < dotsFilled ? 'bg-[#E10600]' : dark ? 'bg-zinc-800' : 'bg-[#E3E0D9]'}`}
            />
          ))}
        </div>
      </div>

      {/* Countdown */}
      <p className="text-[16vw] md:text-8xl tabular-nums leading-none num-timer text-center">
        {formatCountdown(idle ? phaseDurationMs(pomodoro.phase, settings) : left)}
      </p>

      {lateBy !== null && (
        <p className={`text-center text-[11px] font-ui mt-4 ${muted}`}>
          That block finished {describeLateness(lateBy)}, while the tab was in the background.
        </p>
      )}

      {/* Quality tap for the block just completed */}
      {pomodoro.pendingBlock && (
        <div className={`mt-8 p-5 rounded-lg border ${dark ? 'border-white/[0.08] bg-[#0D0D10]' : 'border-[#E3E0D9] bg-[#F2F0EC]'}`}>
          <p className={`text-[10px] uppercase font-bold tracking-[0.1em] text-center font-ui ${muted}`}>
            How focused was that block?
          </p>
          <div className="flex justify-center gap-2 mt-3">
            {[1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                onClick={() => rate(q)}
                className={`w-10 h-10 rounded-md text-xs font-bold transition-all ${dark ? 'bg-zinc-800 text-zinc-400 hover:bg-[#E10600] hover:text-white' : 'bg-[#E3E0D9] text-[#6B675C] hover:bg-[#E10600] hover:text-white'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subject picker — only meaningful before a work block starts */}
      {idle && isWork && (
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {activeSubjects.map(s => (
            <button
              key={s}
              onClick={() => { sfx.select(); onUpdate({ subject: s }); }}
              className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-md transition-all ${pomodoro.subject === s
                ? 'bg-[#E10600] border-[#E10600] text-white'
                : dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]'
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 mt-10">
        {pomodoro.isRunning ? (
          <button
            onClick={stop}
            className="w-full max-w-xs py-5 bg-[#E10600] text-white font-black uppercase tracking-[0.3em] hover:bg-red-700 transition-all active:scale-[0.98] rounded-lg font-ui"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={start}
            className={`w-full max-w-xs py-5 font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98] rounded-lg font-ui ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
          >
            {idle && pomodoro.completedBlocks === 0 ? 'Start' : isWork ? 'Start next block' : 'Start break'}
          </button>
        )}

        <div className="flex items-center gap-5">
          <button onClick={() => setShowSettings(v => !v)} className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui ${muted} hover:text-[#E10600] transition-colors`}>
            {showSettings ? 'Hide settings' : 'Settings'}
          </button>
          {pomodoro.completedBlocks > 0 && (
            <button onClick={reset} className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui ${muted} hover:text-[#E10600] transition-colors`}>
              Reset set
            </button>
          )}
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className={`mt-8 pt-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4 ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
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

          <label className="col-span-2 md:col-span-4 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoStartNext}
              onChange={e => onUpdateSettings({ autoStartNext: e.target.checked })}
              className="accent-[#E10600] w-4 h-4"
            />
            <span className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${muted}`}>
              Start the next phase automatically
            </span>
          </label>
        </div>
      )}
    </section>
  );
};

export default PomodoroTimer;
