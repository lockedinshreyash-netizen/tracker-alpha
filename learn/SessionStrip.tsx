/* ── The clock, from inside a lecture ──
   One line under the player. With nothing running it is the Start the clock
   button: the stopwatch on this lecture's subject and chapter, started by the
   student's tap, never by the video. With the stopwatch armed it is that
   clock, ticking in a component of its own (useSecondTick), so the lecture
   page does not redraw every second. A Pomodoro or a Sprint is named, not
   duplicated: pausing and ending a session happens on Today, where it always
   has. Watching never logs time by itself. */

import React from 'react';
import { btn, tokens } from '../ui/kit';
import { useSecondTick } from '../ui/useSecondTick';
import { elapsedMs, isArmed, isPaused } from '../today/stopwatch';
import { formatTime } from '../video/model';
import type { Subject, TimerState } from '../types';

export type OtherSession = 'pomodoro' | 'sprint' | null;

interface Props {
  timer: TimerState;
  otherSession: OtherSession;
  subject: Subject;
  chapter: string | null;
  dark: boolean;
  /* Set the first time play is pressed with nothing running, once per
     lecture opened: the one reminder, said in place, never a pop-up. */
  nudge: boolean;
  /** False when a session was already running (the strip then shows it). */
  onStart: () => boolean;
  onOpenToday: () => void;
}

export default function SessionStrip({ timer, otherSession, subject, chapter, dark, nudge, onStart, onOpenToday }: Props) {
  const t = tokens(dark);
  const frame = `flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${t.card}`;
  const today = (
    <button type="button" onClick={onOpenToday} className={`text-[12px] font-ui font-bold underline underline-offset-2 ${t.body}`}>
      Open Today
    </button>
  );

  if (isArmed(timer)) {
    return (
      <div className={frame} role="status">
        <RunningClock timer={timer} dark={dark} />
        {today}
      </div>
    );
  }
  if (otherSession) {
    return (
      <div className={frame} role="status">
        <span className={`text-[13px] font-ui font-bold ${t.heading}`}>
          {otherSession === 'pomodoro' ? 'A Pomodoro is running.' : 'A Sprint is running.'}
        </span>
        {today}
      </div>
    );
  }
  return (
    <div className={frame}>
      <span className={`text-[13px] font-ui ${nudge ? `font-bold ${t.heading}` : t.muted}`} role={nudge ? 'status' : undefined}>
        {nudge ? "The clock isn't running." : 'Stopwatch on'}{' '}
        <span className={nudge ? `font-normal ${t.muted}` : t.body}>{subject}{chapter ? ` · ${chapter}` : ''}</span>
      </span>
      <button type="button" onClick={() => { onStart(); }} className={`${btn} h-10 px-4 ${t.primary}`}>
        Start the clock
      </button>
    </div>
  );
}

/* ── The same clock, as the theater's top-bar pill ──
   Start the clock while nothing runs (red-edged; filled and pulsing twice
   when nudged), the running stopwatch, or the other session by name. A tap on
   a running one goes to Today, where sessions are paused and ended. */

interface PillProps {
  timer: TimerState;
  otherSession: OtherSession;
  nudge: boolean;
  onStart: () => boolean;
  onOpenToday: () => void;
}

export const ClockPill = ({ timer, otherSession, nudge, onStart, onOpenToday }: PillProps) => {
  if (isArmed(timer)) return <PillRunning timer={timer} onOpenToday={onOpenToday} />;
  if (otherSession) {
    return (
      <button type="button" className="th-clock" data-kind="other" onClick={onOpenToday} title="Open Today">
        <span className="th-dot" data-live="true" aria-hidden="true" />
        {otherSession === 'pomodoro' ? 'Pomodoro running' : 'Sprint running'}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      {nudge && <span className="th-nudge-line" role="status">The clock isn't running.</span>}
      <button type="button" className="th-clock" data-kind="start" data-nudge={nudge} onClick={() => { onStart(); }}>
        Start the clock
      </button>
    </span>
  );
};

const PillRunning = ({ timer, onOpenToday }: { timer: TimerState; onOpenToday: () => void }) => {
  const paused = isPaused(timer);
  const now = useSecondTick(!paused, timer.startTime ?? 0);
  return (
    <button
      type="button"
      className="th-clock"
      data-kind="running"
      onClick={onOpenToday}
      title={`${paused ? 'Paused · ' : ''}${timer.subject}${timer.chapter ? ` · ${timer.chapter}` : ''} · Open Today`}
    >
      <span className="th-dot" data-paused={paused} data-live={!paused} aria-hidden="true" />
      <span className="th-time">{formatTime(elapsedMs(timer, now) / 1000)}</span>
    </button>
  );
};

const RunningClock = ({ timer, dark }: { timer: TimerState; dark: boolean }) => {
  const paused = isPaused(timer);
  const now = useSecondTick(!paused, timer.startTime ?? 0);
  const t = tokens(dark);
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full shrink-0 ${paused ? 'bg-zinc-500' : 'bg-[#E10600] animate-pulse'}`}
      />
      <span className={`num-timer text-[18px] tabular-nums ${t.heading}`}>{formatTime(elapsedMs(timer, now) / 1000)}</span>
      <span className={`text-[12px] font-ui truncate ${t.muted}`}>
        {paused ? 'Paused · ' : ''}{timer.subject}{timer.chapter ? ` · ${timer.chapter}` : ''}
      </span>
    </span>
  );
};
