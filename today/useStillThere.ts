import { useCallback, useEffect, useRef, useState } from 'react';
import { DailyLog, LogSource, PomodoroRuntime, Subject, TimerState } from '../types';
import * as sfx from '../audio';
import { deliver } from '../notify/deliver';
import { CLEARED, resumeRun, sessionSpan } from './stopwatch';
import { clearPhase, servedMs } from './pomodoro';
import { PomodoroApi, PomodoroCommit } from './usePomodoro';
import {
  ANSWER_MS, SITTING_MS, checkStatus, pauseStopwatchForCheck, pomodoroCheckAt, stopwatchCheckAt, stopwatchKeeps,
} from './presence';

/* The "Still studying?" engine. Mounted at App root beside usePomodoro, for
   the same reason: it has to act while the student is on another tab, or
   none. Pure rules in presence.ts; this only notices, rings and writes.

   The Pomodoro's pause for the check lives in usePomodoro (it must come before
   the bell); the stopwatch's lives here. Answering and removing both live here. */

export interface Ask {
  mode: 'stopwatch' | 'pomodoro';
  checkAt: number;
  subject: Subject;
}

export interface RemovedSession {
  at: number;
  subject: Subject;
  removedMs: number;
  keptMs: number;
}

interface Options {
  timer: TimerState;
  pomodoro: PomodoroRuntime;
  logs: DailyLog[];
  read: () => { timer: TimerState; pomodoro: PomodoroRuntime; logs: DailyLog[] };
  ready: boolean;
  userId: string | null;
  updateTimer: (u: Partial<TimerState>) => void;
  logStudy: (
    subject: Subject, hours: number, quality: number, distractions: number, source?: LogSource,
    chapter?: string, blockId?: string, startedAt?: number, endedAt?: number,
  ) => void;
  pomodoroApi: PomodoroApi;
  commitPomodoro: (u: Partial<PomodoroRuntime>, extra?: PomodoroCommit) => void;
}

const removedKey = (uid: string | null) => `alpha_removed_v1:${uid ?? 'local'}`;
const readRemoved = (uid: string | null): RemovedSession[] => {
  try { return JSON.parse(localStorage.getItem(removedKey(uid)) || '[]'); } catch { return []; }
};
const writeRemoved = (uid: string | null, list: RemovedSession[]) => {
  try { localStorage.setItem(removedKey(uid), JSON.stringify(list.slice(-5))); } catch { /* this visit only */ }
};

export const useStillThere = (o: Options) => {
  const [now, setNow] = useState(() => Date.now());
  const [removed, setRemoved] = useState<RemovedSession[]>(() => readRemoved(o.userId));
  useEffect(() => { setRemoved(readRemoved(o.userId)); }, [o.userId]);

  const opts = useRef(o);
  opts.current = o;
  const said = useRef(new Set<number>());
  /* Writes land through setState updaters, so `read()` can lag a re-run of
     this effect (StrictMode runs it twice on mount). Each removal once. */
  const handled = useRef(new Set<string>());

  const swAt = stopwatchCheckAt(o.timer);
  const pomAt = pomodoroCheckAt(o.pomodoro);

  /* Wake at the check, at the end of the answer window, every 5s while one is
     near, and on return to the tab (throttled timers fire late; slept ones not
     at all). Re-rendering with a fresh `now` is all a wake does. */
  useEffect(() => {
    const at = swAt ?? pomAt;
    if (at === null) return;
    const tick = () => setNow(Date.now());
    const ids = [at, at + ANSWER_MS].map(t => window.setTimeout(tick, Math.max(0, t - Date.now()) + 50));
    const interval = window.setInterval(() => { if (Date.now() >= at - 10_000) tick(); }, 5_000);
    const onWake = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    tick();
    return () => {
      ids.forEach(window.clearTimeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [swAt, pomAt]);

  /* The bell on the audio clock, placed when the sitting starts, so a hidden
     tab rings on time. Withdrawn by any tap (the check time moves). */
  useEffect(() => {
    const at = o.timer.isRunning ? swAt : o.pomodoro.isRunning ? pomAt : null;
    if (at === null) return;
    const key = `check@${at}`;
    sfx.scheduleAt('block-done', at, key);
    return () => sfx.cancelScheduled(key);
  }, [swAt, pomAt, o.timer.isRunning, o.pomodoro.isRunning]);

  const remember = useCallback((r: RemovedSession) => {
    const list = [...readRemoved(opts.current.userId), r];
    writeRemoved(opts.current.userId, list);
    setRemoved(list);
  }, []);

  /* Act on what the clock says. Every write here is idempotent: once made,
     the state it reads no longer asks for it. */
  useEffect(() => {
    if (!o.ready) return;
    const { timer: t, pomodoro: p, logs } = opts.current.read();

    const sw = stopwatchCheckAt(t);
    const swStatus = checkStatus(sw, !!t.checkAt, now);
    if (sw !== null && swStatus === 'due') {
      opts.current.updateTimer(pauseStopwatchForCheck(t, sw));
    } else if (sw !== null && swStatus === 'missed' && !handled.current.has(`sw@${sw}`)) {
      handled.current.add(`sw@${sw}`);
      const keep = stopwatchKeeps(t, sw);
      if (keep) {
        opts.current.logStudy(t.subject, keep.hours, 4, 0, 'timer', t.chapter, t.blockId, keep.startedAt, keep.endedAt);
      }
      opts.current.updateTimer(CLEARED);
      remember({ at: sw, subject: t.subject, removedMs: SITTING_MS, keptMs: keep ? keep.hours * 3_600_000 : 0 });
    }

    const pa = p.checkAt ?? null;
    if (pa !== null && checkStatus(pa, true, now) === 'missed' && !handled.current.has(`pom@${pa}`)) {
      handled.current.add(`pom@${pa}`);
      const drop = p.unattended ?? [];
      const droppedMs = logs.filter(l => drop.includes(l.id)).reduce((sum, l) => sum + l.hours * 3_600_000, 0);
      opts.current.commitPomodoro(
        { ...clearPhase(), phase: 'work', completedBlocks: 0, checkAt: undefined, presenceAt: undefined, unattended: [] },
        { drop },
      );
      const served = p.phase === 'work' ? servedMs(p) : 0;
      if (droppedMs + served >= 60_000) remember({ at: pa, subject: p.subject, removedMs: droppedMs + served, keptMs: 0 });
    }
  }, [now, o.ready, swAt, pomAt, remember]);

  const ask: Ask | null =
    o.timer.checkAt && checkStatus(o.timer.checkAt, true, now) === 'asking'
      ? { mode: 'stopwatch', checkAt: o.timer.checkAt, subject: o.timer.subject }
      : o.pomodoro.checkAt && checkStatus(o.pomodoro.checkAt, true, now) === 'asking'
        ? { mode: 'pomodoro', checkAt: o.pomodoro.checkAt, subject: o.pomodoro.subject }
        : null;

  /* Ring and notify once per check. A visible tab has the prompt itself, so
     the router's toast is off; a hidden one gets a system notification. */
  useEffect(() => {
    if (!ask || said.current.has(ask.checkAt)) return;
    said.current.add(ask.checkAt);
    if (!sfx.claimScheduled(`check@${ask.checkAt}`)) sfx.play('block-done');
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* unsupported */ }
    void deliver({
      channel: 'check',
      key: `check@${ask.checkAt}`,
      toast: false,
      copy: {
        title: 'Still studying?',
        body: `Your ${ask.subject} timer is paused. Answer within 10 minutes or this session is removed.`,
      },
    });
  }, [ask?.checkAt]);

  const answer = useCallback((keepGoing: boolean) => {
    const { timer: t, pomodoro: p } = opts.current.read();
    if (t.checkAt) {
      if (keepGoing) {
        const { bank, update } = resumeRun(t);
        if (bank) opts.current.logStudy(t.subject, bank.hours, 4, 0, 'timer', t.chapter, t.blockId, bank.startedAt, bank.endedAt);
        opts.current.updateTimer(update);
      } else {
        const span = sessionSpan(t);
        opts.current.logStudy(t.subject, span.hours, 4, 0, 'timer', t.chapter, t.blockId, span.startedAt, span.endedAt);
        opts.current.updateTimer(CLEARED);
      }
    } else if (p.checkAt) {
      if (keepGoing) opts.current.pomodoroApi.start();
      else opts.current.pomodoroApi.end();
    }
    setNow(Date.now());
  }, []);

  const ackRemoved = useCallback(() => {
    const list = readRemoved(opts.current.userId).slice(1);
    writeRemoved(opts.current.userId, list);
    setRemoved(list);
  }, []);

  return {
    ask,
    /** The sitting a push should fire for, while one is running. */
    pendingCheckAt: o.timer.isRunning ? swAt : o.pomodoro.isRunning ? pomAt : null,
    cont: useCallback(() => answer(true), [answer]),
    done: useCallback(() => answer(false), [answer]),
    removed: removed[0] ?? null,
    ackRemoved,
  };
};
