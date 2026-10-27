import { useCallback, useEffect, useRef, useState } from 'react';
import { SprintRecord, SprintRuntime, Task, TaskColumn } from '../types';
import { generateId } from '../utils';
import * as sfx from '../audio';
import { deliver } from '../notify/deliver';
import { holdTitle } from '../ui/tabTitle';
import { formatCountdown } from './pomodoro';
import {
  Draft, SprintSpan, allDone, deadlineAt, endSprint, extendSprint, finalMs, leftMs, pauseSprint,
  restartDraft, resumeSprint, staleAt, startSprint, statusOf, toggleItem,
} from './sprint';

/**
 * The Sprint engine. Mounted at App root beside `usePomodoro`, for the reason
 * that hook gives: the deadline has to ring, and an unanswered overtime has to
 * end, while the student is on another tab of the app or none at all. The
 * card on Today is a view over this.
 *
 * Every change goes through one atomic `commit`, which refuses to apply
 * unless the sprint it was computed from is still the one armed. That is the
 * whole defence against double taps, a second sprint and an ending recorded
 * twice: the timeout, the safety interval and the visibility handler can all
 * reach for the same expiry, and only the first lands.
 */

export interface SprintCommit {
  /** The record of a sprint that just ended. */
  record?: SprintRecord;
  /** Working time to log, as `source: 'timer'` against the sprint's subject. */
  spans?: SprintSpan[];
  /** A board card to move: ticking an item from a card, or unticking it. */
  move?: { id: string; to: TaskColumn };
  /** A sound already played; nothing else should ring on top of the log. */
  rang?: boolean;
}

interface Options {
  sprint: SprintRuntime | null;
  /** Live state, so a handler never acts on a stale render. */
  read: () => { sprint: SprintRuntime | null; tasks: Task[] };
  /**
   * Apply `next` only if the armed sprint's id is still `expect` (null = none
   * armed). Returns nothing: the guard lives in the state updater.
   */
  commit: (expect: string | null, next: SprintRuntime | null, extra?: SprintCommit) => void;
  /** Gate on the initial cloud pull, like the other engines. */
  ready: boolean;
  /** The sprint card is on screen: a toast on top of it would say the same thing twice. */
  onScreen: boolean;
}

export interface SprintApi {
  start: (d: Draft) => boolean;
  toggle: (itemId: string) => void;
  completeAll: () => void;
  pause: () => void;
  resume: () => void;
  extend: (minutes: number) => void;
  /** Give up: logs the time served, ticks nothing. */
  abandon: () => void;
  /** End an expired sprint as expired. */
  end: () => void;
  /** End an expired sprint and start the unfinished part again with the first allowance. */
  restart: () => void;
  /** The sprint that just ended, for the result screen. Device-local and per visit. */
  result: SprintRecord | null;
  clearResult: () => void;
  /** Put a card the sprint moved to Done back where it was. */
  undoMove: (itemId: string) => void;
}

const bellKey = (r: SprintRuntime) => `sprint@${r.id}:${finalMs(r)}`;

export const useSprint = ({ sprint, read, commit, ready, onScreen }: Options): SprintApi => {
  const [result, setResult] = useState<SprintRecord | null>(null);
  const readRef = useRef(read);
  const commitRef = useRef(commit);
  const onScreenRef = useRef(onScreen);
  useEffect(() => { readRef.current = read; commitRef.current = commit; onScreenRef.current = onScreen; });
  /* Ids this hook has ended, so a second press before the state lands cannot
     ring, log or celebrate twice. The commit guard catches the write. */
  const ended = useRef(new Set<string>());

  const live = () => {
    const r = readRef.current().sprint;
    return r && !ended.current.has(r.id) ? r : null;
  };

  const finish = (r: SprintRuntime, kind: 'complete' | 'expire' | 'abandon', extra: SprintCommit = {}) => {
    ended.current.add(r.id);
    const now = Date.now();
    const { record, span } = endSprint(r, kind, now);
    sfx.cancelScheduled(bellKey(r));
    commitRef.current(r.id, null, { ...extra, record, spans: span ? [span] : [] });
    setResult(record);
    return record;
  };

  const start = useCallback((d: Draft): boolean => {
    const current = readRef.current().sprint;
    if (current) return false;
    const r = startSprint(d, generateId());
    if (!r) return false;
    sfx.play('session-start');
    setResult(null);
    commitRef.current(null, r);
    return true;
  }, []);

  /** Where a card stands, and whether the sprint should move it. */
  const cardMove = (taskId: string | undefined, ticking: boolean, movedFrom?: TaskColumn) => {
    if (!taskId) return null;
    const task = readRef.current().tasks.find(t => t.id === taskId);
    if (!task) return null; // deleted from the board since: the sprint keeps its words
    if (ticking) return task.completed ? null : { id: taskId, to: 'done' as TaskColumn, from: (task.column ?? 'todo') as TaskColumn };
    return movedFrom && task.completed ? { id: taskId, to: movedFrom, from: movedFrom } : null;
  };

  const toggle = useCallback((itemId: string) => {
    const r = live();
    if (!r) return;
    const item = r.items.find(i => i.id === itemId);
    if (!item) return;
    const ticking = !item.doneAt;
    const move = cardMove(item.taskId, ticking, item.movedFrom);
    const next = toggleItem(r, itemId, Date.now(), ticking && move ? move.from : undefined);
    // A card's move makes its own sound (soundForTaskMove); a typed item gets the same one here.
    if (!move && ticking) sfx.play('task-done');
    const extra: SprintCommit = move ? { move: { id: move.id, to: move.to } } : {};
    if (ticking && allDone(next)) { finish(next, 'complete', { ...extra, rang: true }); return; }
    commitRef.current(r.id, next, extra);
  }, []);

  /* Ticks everything still open in one write. Only the first card moved can
     travel with it; a second one moves straight after. Two cards at most. */
  const completeAll = useCallback(() => {
    const r = live();
    if (!r) return;
    const now = Date.now();
    let next = r;
    const moves: { id: string; to: TaskColumn }[] = [];
    for (const i of r.items) {
      if (i.doneAt) continue;
      const move = cardMove(i.taskId, true);
      next = toggleItem(next, i.id, now, move?.from);
      if (move) moves.push({ id: move.id, to: move.to });
    }
    if (!moves.length) sfx.play('task-done');
    finish(next, 'complete', { move: moves[0], rang: true });
    if (moves[1]) commitRef.current(null, null, { move: moves[1] });
  }, []);

  const pause = useCallback(() => {
    const r = live();
    if (!r || r.runStartedAt === null) return;
    sfx.select();
    commitRef.current(r.id, pauseSprint(r));
  }, []);

  const resume = useCallback(() => {
    const r = live();
    if (!r || r.runStartedAt !== null) return;
    const { runtime, bank } = resumeSprint(r);
    sfx.select();
    commitRef.current(r.id, runtime, bank ? { spans: [bank] } : {});
  }, []);

  const extend = useCallback((minutes: number) => {
    const r = live();
    if (!r) return;
    const next = extendSprint(r, minutes);
    if (next === r) return;
    sfx.play('tap');
    commitRef.current(r.id, next);
  }, []);

  const abandon = useCallback(() => { const r = live(); if (r) finish(r, 'abandon'); }, []);
  const end = useCallback(() => { const r = live(); if (r) finish(r, 'expire'); }, []);

  const restart = useCallback(() => {
    const r = live();
    if (!r) return;
    const draft = restartDraft(r);
    finish(r, 'expire');
    const next = startSprint(draft, generateId());
    if (!next) return;
    sfx.play('session-start');
    setResult(null);
    commitRef.current(null, next);
  }, []);

  const clearResult = useCallback(() => setResult(null), []);

  const resultRef = useRef(result);
  resultRef.current = result;
  const undoMove = useCallback((itemId: string) => {
    const prev = resultRef.current;
    const item = prev?.items.find(i => i.id === itemId);
    if (!prev || !item?.taskId || !item.movedFrom) return;
    const task = readRef.current().tasks.find(t => t.id === item.taskId);
    const armed = readRef.current().sprint;
    if (task?.completed) commitRef.current(armed?.id ?? null, armed, { move: { id: item.taskId, to: item.movedFrom } });
    setResult({ ...prev, items: prev.items.map(i => (i.id === itemId ? { ...i, movedFrom: undefined } : i)) });
  }, []);

  /* ── The deadline and the overtime limit ──
     Noticed by a timeout at the exact moment, an interval because background
     tabs hold timeouts, and visibility because a slept device fires neither.
     All of them land in `check`, which acts once per deadline. */
  const check = useCallback(() => {
    const r = live();
    if (!r || r.runStartedAt === null) return;
    const status = statusOf(r);
    if (status === 'stale') { finish(r, 'expire'); return; }
    if (status !== 'over' || r.rangFor === finalMs(r)) return;
    const late = -leftMs(r) > 5_000;
    if (!sfx.claimScheduled(bellKey(r)) && !late) sfx.phaseComplete();
    void deliver({
      channel: 'sprint',
      key: bellKey(r),
      icon: '⏱️',
      toast: onScreenRef.current ? false : undefined,
      copy: {
        title: "Time's up",
        body: `${r.items.map(i => i.text).join(' · ')}. Finish it, add time, or call it.`,
      },
    });
    commitRef.current(r.id, { ...r, rangFor: finalMs(r) });
  }, []);

  const deadline = sprint ? deadlineAt(sprint) : null;
  const stale = sprint ? staleAt(sprint) : null;

  useEffect(() => {
    if (!ready || deadline === null || stale === null) return;
    const fire = () => check();
    const now = Date.now();
    const t1 = window.setTimeout(fire, Math.max(0, deadline - now) + 50);
    const t2 = window.setTimeout(fire, Math.max(0, stale - now) + 50);
    const interval = window.setInterval(fire, 5_000);
    const onWake = () => { if (!document.hidden) fire(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    fire(); // a deadline already past when the app opens
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [ready, deadline, stale, check]);

  /* The bell on the audio clock, which nothing throttles (see usePomodoro). */
  useEffect(() => {
    if (!sprint || deadline === null || sprint.rangFor === finalMs(sprint)) return;
    const key = bellKey(sprint);
    sfx.scheduleAt('block-done', deadline, key);
    return () => sfx.cancelScheduled(key);
  }, [sprint?.id, deadline, sprint?.rangFor]);

  /* The countdown in the tab strip while the clock runs. */
  useEffect(() => {
    if (deadline === null) return;
    const paint = () => {
      const r = readRef.current().sprint;
      if (!r || r.runStartedAt === null) return;
      const left = leftMs(r);
      document.title = left > 0 ? `${formatCountdown(left)} · Sprint` : `+${formatCountdown(-left)} · Time's up`;
    };
    const release = holdTitle();
    paint();
    const id = window.setInterval(paint, 1000);
    return () => { window.clearInterval(id); release(); };
  }, [deadline]);

  return { start, toggle, completeAll, pause, resume, extend, abandon, end, restart, result, clearResult, undoMove };
};
