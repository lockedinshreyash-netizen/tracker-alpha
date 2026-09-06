import { useCallback, useEffect, useRef, useState } from 'react';
import { DailyLog, PomodoroRuntime, PomodoroSettings, Subject } from '../types';
import { generateId, getISTDateString } from '../utils';
import * as sfx from '../audio';
import {
  MIN_LOGGABLE_MS,
  PHASE_LABEL,
  STALE_PHASE_MS,
  advancePhase,
  beginPhase,
  clearPhase,
  creditFor,
  formatCountdown,
  formatDuration,
  hasElapsed,
  isIdle,
  isPaused,
  leftMs,
  pausePhase,
  phaseDurationMs,
  servedMs,
} from './pomodoro';

/**
 * The Pomodoro engine.
 *
 * Mounted once, at the top of the app — deliberately not inside the timer
 * component. A block used to stop existing the moment the user opened another
 * tab of the app: the component unmounted, nothing was watching the clock, and
 * the bell never rang. The countdown on screen is a *view* of this; this is
 * what actually runs.
 *
 * Two rules the whole thing is built around:
 *
 *  1. **Time served is never lost.** A block's log is written the instant the
 *     block ends — bell, early stop, reset, mode switch, whichever — at a
 *     neutral quality, and rating it afterwards only amends that log. Nothing
 *     study-shaped waits on a user action that may never come.
 *  2. **Everything is derived from the wall clock.** No decrementing counters.
 *     A throttled tab, a slept laptop or a reload changes how often the screen
 *     redraws and nothing else.
 */

/** Quality a block is logged at before the user rates it. */
export const DEFAULT_QUALITY = 4;

/** A bell this overdue means the tab was in the background, not on screen. */
const LATE_THRESHOLD_MS = 5_000;

/** Ratings are consumed one at a time; a backlog past this is just clutter. */
const MAX_PENDING_RATINGS = 4;

export interface PomodoroCommit {
  log?: DailyLog;
  rate?: { logId: string; quality: number };
}

export interface EndResult {
  /** Hours written to the log. Zero when nothing met the minimum. */
  hours: number;
  /** Whether the block was long enough to fill a dot in the set. */
  counted: boolean;
}

interface Options {
  runtime: PomodoroRuntime;
  settings: PomodoroSettings;
  /** Live state, so a handler never acts on a stale render. */
  read: () => { pomodoro: PomodoroRuntime; settings: PomodoroSettings };
  /** One atomic write: runtime change, plus any log it earned. */
  commit: (update: Partial<PomodoroRuntime>, extra?: PomodoroCommit) => void;
  /**
   * True while Pomodoro is the mode on screen. The engine keeps running either
   * way — a block already in flight is still a block — but the tab title is
   * shared with the rest of the app and must not nag about a phase the user
   * has switched away from.
   */
  active: boolean;
  /**
   * False until the initial cloud pull has landed. A pull that wins the merge
   * replaces `logs` wholesale, so a block settled before then would be written
   * and then thrown away. Overdue blocks wait; they are not going anywhere.
   */
  ready: boolean;
}

export interface PomodoroApi {
  /** Start an idle phase, or resume a paused one. */
  start: (subject?: Subject) => boolean;
  pause: () => boolean;
  toggle: () => void;
  /** End the current phase now: banks the focus served, moves the cycle on. */
  end: () => EndResult;
  /** Bank whatever is served, then start the set over. */
  reset: () => EndResult;
  setSubject: (subject: Subject) => void;
  rate: (logId: string, quality: number) => void;
  dismissRating: (logId: string) => void;
  /** How overdue the last bell was, when it rang out of sight. */
  lateBy: number | null;
  clearLate: () => void;
  /** Set when a phase was too old to settle and was dropped instead. */
  staleDrop: string | null;
  clearStaleDrop: () => void;
}

const round2 = (n: number) => parseFloat(n.toFixed(2));

/* ── System notification ──
   Its own tag, so a bell replaces the previous unread bell instead of stacking
   a queue of them. Failure is silent and never blocks the phase change. */
const notify = (title: string, body: string) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      tag: 'tracker-alpha-pomodoro',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    /* notification skipped */
  }
};

export const usePomodoro = ({ runtime, settings, read, commit, active, ready }: Options): PomodoroApi => {
  const [lateBy, setLateBy] = useState<number | null>(null);
  const [staleDrop, setStaleDrop] = useState<string | null>(null);

  const readRef = useRef(read);
  const commitRef = useRef(commit);
  const readyRef = useRef(ready);
  useEffect(() => { readRef.current = read; }, [read]);
  useEffect(() => { commitRef.current = commit; }, [commit]);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  /* Bells are settled once each, no matter how many watchers notice. The
     timeout, the safety interval and the visibility handler all race to call
     the same function the moment a phase is due. */
  const settledEndsAt = useRef<number | null>(null);

  /* A second settle this soon after the last one is always a double-fire — a
     double-tap, or a click racing a voice command against a state update that
     has not been applied yet. Nothing legitimate can end twice inside half a
     second: the shortest phase the settings allow is a minute. */
  const lastSettleAt = useRef(0);

  /**
   * End the current phase and move the cycle on.
   *
   * `at` is the instant the phase ended — the bell time for a phase that
   * finished while the tab was hidden, so its hours land on the study day it
   * was actually served, not the day the user happened to come back.
   */
  const settle = useCallback((opts: { at: number; autoStart: boolean }): EndResult => {
    const { pomodoro: p, settings: s } = readRef.current();
    if (isIdle(p)) return { hours: 0, counted: false };

    const since = Date.now() - lastSettleAt.current;
    if (since < 500) return { hours: 0, counted: false };
    lastSettleAt.current = Date.now();

    const credit = creditFor(p, opts.at);
    const pendingRating = [...p.pendingRating];
    let log: DailyLog | undefined;

    if (credit.loggable) {
      const hours = round2(credit.hours);
      log = {
        id: generateId(),
        date: getISTDateString(new Date(opts.at)),
        subject: p.subject,
        hours,
        quality: DEFAULT_QUALITY,
        distractions: 0,
        source: 'pomodoro',
      };
      pendingRating.push({ logId: log.id, subject: p.subject, hours, partial: credit.partial });
      while (pendingRating.length > MAX_PENDING_RATINGS) pendingRating.shift();
    }

    commitRef.current(
      {
        ...advancePhase(p, s, { counted: credit.counted, autoStart: opts.autoStart, now: opts.at }),
        pendingRating,
        // The legacy field is dead the moment this engine writes anything.
        pendingBlock: null,
      },
      log ? { log } : undefined,
    );

    return { hours: log?.hours ?? 0, counted: credit.counted };
  }, []);

  /* ── The bell ──
     Called by everything that might have noticed the phase is due. Idempotent
     per phase. */
  const bell = useCallback(() => {
    const { pomodoro: p, settings: s } = readRef.current();
    const now = Date.now();
    if (!hasElapsed(p, now) || p.phaseEndsAt === null) return;
    if (settledEndsAt.current === p.phaseEndsAt) return;
    // Logs written before the cloud pull lands can be overwritten by it.
    if (!readyRef.current) return;
    settledEndsAt.current = p.phaseEndsAt;

    const overdue = now - p.phaseEndsAt;

    /* Too old to be believable. The browser was closed for half a day; the
       user was not sitting through a 25 minute block that whole time. Drop the
       phase rather than mint hours against a day that has already been
       counted. */
    if (overdue > STALE_PHASE_MS) {
      const wasWork = p.phase === 'work';
      commitRef.current({ ...clearPhase(), pendingBlock: null });
      setStaleDrop(
        wasWork
          ? 'A block was still running when this device last closed, more than 12 hours ago. It was dropped rather than logged as focus you may not have done.'
          : 'A break left running more than 12 hours ago was dropped.',
      );
      return;
    }

    const late = overdue > LATE_THRESHOLD_MS;
    const wasWork = p.phase === 'work';

    if (wasWork) sfx.phaseComplete(); else sfx.breakOver();

    if (s.notify && typeof document !== 'undefined' && document.hidden) {
      const upcomingIsBreak = wasWork;
      notify(
        wasWork ? 'Block done' : 'Break over',
        upcomingIsBreak
          ? `${formatDuration(p.phaseTotalMs ?? 0)} of ${p.subject} logged. Take the break.`
          : 'Back to it. Start the next block.',
      );
    }

    /* A phase that ended out of sight is reported, not silently rolled
       forward — chaining on from a bell nobody heard would fabricate a run of
       phases the user never sat through. */
    setLateBy(late ? overdue : null);
    settle({ at: p.phaseEndsAt, autoStart: s.autoStartNext && !late });
  }, [settle]);

  const bellRef = useRef(bell);
  useEffect(() => { bellRef.current = bell; }, [bell]);

  /* ── Watchers ──
     A timeout for the exact moment, an interval because background tabs hold
     timeouts well past their due time, and visibility/focus because a slept
     device fires neither until it wakes. */
  useEffect(() => {
    if (!runtime.isRunning || runtime.phaseEndsAt === null) return;

    const fire = () => bellRef.current();
    const timeout = window.setTimeout(fire, Math.max(0, runtime.phaseEndsAt - Date.now()) + 50);
    const interval = window.setInterval(fire, 5_000);
    const onWake = () => { if (!document.hidden) fire(); };

    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);

    // Covers the mount case: a phase already past its bell when the app opens.
    fire();

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [runtime.isRunning, runtime.phaseEndsAt, ready]);

  /* ── Screen wake lock ──
     Opt-in. Released whenever the phase stops, and re-taken on return to the
     foreground because the browser drops the lock whenever the page hides. */
  useEffect(() => {
    if (!settings.keepAwake || !runtime.isRunning) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<any> } };
    if (!nav.wakeLock) return;

    let sentinel: any = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.hidden || sentinel) return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
        sentinel.addEventListener?.('release', () => { sentinel = null; });
      } catch {
        /* denied, unsupported, or the page is not visible — never fatal */
      }
    };

    const onVisible = () => { if (!document.hidden) void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      try { sentinel?.release?.(); } catch { /* already gone */ }
      sentinel = null;
    };
  }, [settings.keepAwake, runtime.isRunning]);

  /* ── Tab title ──
     The countdown belongs in the tab strip, where a backgrounded block is
     still visible. Written imperatively so a per-second redraw of the whole
     app is not the price of a ticking title. */
  const baseTitle = useRef<string>(typeof document !== 'undefined' ? document.title : '');
  useEffect(() => {
    const base = baseTitle.current;
    const waiting = active && (isPaused(runtime) || (isIdle(runtime) && runtime.completedBlocks > 0));

    if (runtime.isRunning) {
      const paint = () => {
        const { pomodoro: p, settings: s } = readRef.current();
        if (!p.isRunning) return;
        document.title = `${formatCountdown(leftMs(p, s))} · ${PHASE_LABEL[p.phase]}`;
      };
      paint();
      const id = window.setInterval(paint, 1000);
      return () => { window.clearInterval(id); document.title = base; };
    }

    if (waiting) {
      const message = runtime.phase === 'work' ? '⏰ Back to work' : '⏰ Break time';
      let on = true;
      document.title = message;
      const id = window.setInterval(() => {
        on = !on;
        document.title = on ? message : base;
      }, 1200);
      return () => { window.clearInterval(id); document.title = base; };
    }

    document.title = base;
  }, [runtime.isRunning, runtime.phase, runtime.phaseTotalMs, runtime.completedBlocks, active]);

  useEffect(() => {
    const base = baseTitle.current;
    return () => { document.title = base; };
  }, []);

  /* ── Legacy flush ──
     A block measured by the previous build was parked, unlogged, waiting for a
     rating. Write it once — at a neutral quality, since nobody is going to
     rate it now — and be rid of the field. */
  const legacyFlushed = useRef(false);
  useEffect(() => {
    if (!ready || legacyFlushed.current) return;
    legacyFlushed.current = true;
    const pending = readRef.current().pomodoro.pendingBlock;
    if (!pending || !(pending.hours > 0)) return;
    commitRef.current(
      { pendingBlock: null },
      {
        log: {
          id: generateId(),
          date: getISTDateString(),
          subject: pending.subject,
          hours: round2(pending.hours),
          quality: DEFAULT_QUALITY,
          distractions: 0,
          source: 'pomodoro',
        },
      },
    );
  }, [ready]);

  /* ── Controls ──
     Every one of them reads live state, so the voice command fired a moment
     after a tap still sees what the tap did. */

  const start = useCallback((subject?: Subject): boolean => {
    const { pomodoro: p, settings: s } = readRef.current();
    if (p.isRunning) return false;
    setLateBy(null);
    setStaleDrop(null);
    sfx.select();
    const subjectUpdate = subject && p.phase === 'work' ? { subject } : {};
    commitRef.current({ ...beginPhase(p, s), ...subjectUpdate });
    return true;
  }, []);

  const pause = useCallback((): boolean => {
    const { pomodoro: p } = readRef.current();
    if (!p.isRunning) return false;
    sfx.select();
    // Nothing is logged here: the block is still armed and can be resumed.
    commitRef.current(pausePhase(p));
    return true;
  }, []);

  const toggle = useCallback(() => {
    const { pomodoro: p } = readRef.current();
    if (p.isRunning) pause(); else start();
  }, [pause, start]);

  const end = useCallback((): EndResult => {
    const { pomodoro: p } = readRef.current();
    if (isIdle(p)) return { hours: 0, counted: false };
    sfx.select();
    setLateBy(null);
    // Never auto-chain off a deliberate stop — the user just asked to stop.
    return settle({ at: Date.now(), autoStart: false });
  }, [settle]);

  const reset = useCallback((): EndResult => {
    const { pomodoro: p } = readRef.current();
    sfx.select();
    setLateBy(null);
    setStaleDrop(null);
    // Bank first: resetting the set is not a reason to lose focus already done.
    const result = isIdle(p) ? { hours: 0, counted: false } : settle({ at: Date.now(), autoStart: false });
    commitRef.current({ ...clearPhase(), phase: 'work', completedBlocks: 0 });
    return result;
  }, [settle]);

  const setSubject = useCallback((subject: Subject) => {
    const { pomodoro: p } = readRef.current();
    if (p.subject === subject) return;
    sfx.select();
    /* Retagging mid-block is allowed: what a block earns is read off the
       runtime when it ends, so the subject showing is the subject logged. */
    commitRef.current({ subject });
  }, []);

  const rate = useCallback((logId: string, quality: number) => {
    const { pomodoro: p } = readRef.current();
    sfx.select();
    commitRef.current(
      { pendingRating: p.pendingRating.filter(r => r.logId !== logId) },
      { rate: { logId, quality } },
    );
  }, []);

  const dismissRating = useCallback((logId: string) => {
    const { pomodoro: p } = readRef.current();
    // The log stays exactly as written, at the neutral quality.
    commitRef.current({ pendingRating: p.pendingRating.filter(r => r.logId !== logId) });
  }, []);

  return {
    start,
    pause,
    toggle,
    end,
    reset,
    setSubject,
    rate,
    dismissRating,
    lateBy,
    clearLate: useCallback(() => setLateBy(null), []),
    staleDrop,
    clearStaleDrop: useCallback(() => setStaleDrop(null), []),
  };
};

/* Re-exported so callers need only one import for "the Pomodoro". */
export { MIN_LOGGABLE_MS, servedMs, phaseDurationMs, isIdle, isPaused };
