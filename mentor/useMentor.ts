/* ── The Mentor's loop ──
   Mounted at App root beside usePomodoro and useReminders, for the reason
   those give: a conversation should keep going while the student checks the
   Syllabus tab, and an engine inside a tab component stops existing the
   moment another tab is opened.

   One student turn:
     1. rebuild the snapshot from live state (brief.ts)
     2. POST to the edge function (transport.ts)
     3. read tools → run here, over this device's data, and go round again
        propose tools → become a review card; the turn ends there
     4. at most MENTOR_LIMITS.maxCallsPerTurn model calls

   Nothing here writes AppState except `apply` and `undo`, which the student
   triggers with a tap, and which go through the one reducer in ops.ts.

   Every quick action has a deterministic fallback, so the Mentor degrades to
   the planner rather than to an error: if the model is down, rate-limited or
   out of allowance, PLAN MY DAY still produces a plan. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from '../types';
import { addDays, generateId, getISTDateString } from '../utils';
import { nowMinute } from '../schedule/schedule';
import { resolveExamDate } from '../constants';
import { pushToast } from '../notify/toastBus';
import {
  checkToolCall, MENTOR_LIMITS, MENTOR_PROTOCOL_VERSION, MentorErrorCode, MentorIntent, MentorRequest, WireMessage,
} from '../supabase/functions/_shared/mentor-protocol';
import { callMentor, ClientError } from './transport';
import { buildSnapshot } from './brief';
import { runReadTool } from './tools';
import { ApplyResult, MentorOp } from './ops';
import { opsFor, proposalFromDayPlan, proposalFromTool, Proposal, ProposalContext, replanProposal, roadmapProposal } from './proposals';
import { buildDayPlan } from './planDay';
import { dayCapacity } from './capacity';
import { redistribute } from './replan';
import { computePace, Pace } from './pace';
import { buildWeekReview } from './review';
import { Entry, forgetThreadsFor, loadThreads, saveThreads, Thread } from './threads';

export type QuickAction = 'plan_today' | 'plan_tomorrow' | 'on_track' | 'roadmap' | 'review_week' | 'replan';

const ERROR_TEXT: Record<MentorErrorCode | ClientError, string> = {
  not_configured: "The Mentor isn't switched on for this app yet.",
  unauthorized: 'Sign in again to use the Mentor.',
  forbidden: "The Mentor is in a closed beta, and this account isn't in it yet.",
  bad_request: 'That request was malformed. Start a new chat and try again.',
  user_limit: "That's today's Mentor allowance. It resets at 4 AM — the planner, pace check and cards still work without it.",
  global_limit: "The Mentor has hit today's limit for everyone. It resets at 4 AM.",
  busy: 'The Mentor is flat out right now. Try again in a minute.',
  unavailable: "The Mentor can't be reached right now.",
  invalid_output: "The Mentor's answer didn't check out, so it was dropped. Ask again.",
  offline: "You're offline. The Mentor needs a connection; the rest of the app doesn't.",
};

const STEP_LABEL: Record<string, string> = {
  get_syllabus: 'READING YOUR SYLLABUS',
  get_study_stats: 'ADDING UP YOUR HOURS',
  get_study_log: 'READING YOUR SESSIONS',
  get_tasks: 'CHECKING YOUR BOARD',
  get_day: 'LOOKING AT THE DAY',
  get_pace: 'CHECKING YOUR PACE',
  get_roadmap: 'READING YOUR ROADMAP',
  get_questions: 'COUNTING QUESTIONS',
  count_days: 'COUNTING DAYS',
};

const OMITTED = JSON.stringify({ omitted: 'Earlier tool result. Call the tool again for current data.' });
const AUTO_RETRY_MAX_S = 20;
/* Below this, a day has no room worth planning. */
const MIN_PLANNABLE = 30;

/**
 * History as the model is allowed to see it:
 *   - an assistant tool call with no matching results (the page closed
 *     mid-round) is dropped, since providers reject the dangling pair;
 *   - tool results from earlier turns are replaced by a stub — live data is
 *     re-read, never trusted from last week's transcript;
 *   - the window starts on a user message and is bounded.
 */
export const wireForSend = (wire: WireMessage[]): WireMessage[] => {
  const clean: WireMessage[] = [];
  for (let i = 0; i < wire.length; i++) {
    const m = wire[i];
    if (m.role === 'assistant' && m.tool_calls?.length) {
      const ids = new Set(m.tool_calls.map(c => c.id));
      const results: WireMessage[] = [];
      let j = i + 1;
      while (j < wire.length && wire[j].role === 'tool') {
        const t = wire[j] as Extract<WireMessage, { role: 'tool' }>;
        if (ids.has(t.tool_call_id)) results.push(t);
        j++;
      }
      if (results.length !== ids.size) { i = j - 1; continue; }
      clean.push(m, ...results);
      i = j - 1;
      continue;
    }
    if (m.role === 'tool') continue; // orphaned
    clean.push(m);
  }

  const lastUser = clean.map(m => m.role).lastIndexOf('user');
  const stubbed = clean.map((m, i) => (m.role === 'tool' && i < lastUser ? { ...m, content: OMITTED } : m));

  let start = Math.max(0, stubbed.length - MENTOR_LIMITS.maxHistoryMessages);
  while (start < stubbed.length && stubbed[start].role !== 'user') start++;
  if (start >= stubbed.length) start = Math.max(0, lastUser);

  return stubbed.slice(start).map(m => ({
    ...m,
    content: m.content.slice(0, m.role === 'tool' ? MENTOR_LIMITS.maxToolResultChars : MENTOR_LIMITS.maxMessageChars),
  }));
};

const newThread = (): Thread => ({
  id: generateId(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  title: 'New chat',
  entries: [],
  wire: [],
  handles: {},
});

const slimPace = (p: Pace) => ({
  verdict: p.verdict,
  target: p.target,
  percentDone: p.percentDone,
  hoursLeft: [p.remaining.low, p.remaining.mid, p.remaining.high],
  studyDaysLeft: p.studyDaysLeft,
  requiredHoursPerStudyDay: Number.isFinite(p.required.mid) ? [p.required.low, p.required.mid, p.required.high] : null,
  recentHoursPerStudyDay: p.recentPerDay,
  projectedFinish: p.projectedFinish,
  options: p.options,
  assumptions: p.assumptions,
});

interface Options {
  userId: string | null;
  /** Consent given and access granted. False means no request is ever made. */
  active: boolean;
  getState: () => AppState;
  commit: (ops: MentorOp[]) => ApplyResult | null;
}

export interface MentorApi {
  threads: Thread[];
  thread: Thread | null;
  busy: boolean;
  step: string | null;
  remaining: number | null;
  send: (text: string, intent?: MentorIntent) => void;
  runAction: (action: QuickAction) => void;
  retry: () => void;
  cancel: () => void;
  startThread: () => void;
  openThread: (id: string) => void;
  deleteThread: (id: string) => void;
  toggleLine: (entryId: string, lineId: string) => void;
  setLineMins: (entryId: string, lineId: string, mins: number) => void;
  apply: (entryId: string) => void;
  undo: (entryId: string) => void;
  dismiss: (entryId: string) => void;
  /** Every conversation for this account, from this device. */
  forgetAll: () => void;
}

export const useMentor = ({ userId, active, getState, commit }: Options): MentorApi => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  const loadedFor = useRef<string | null>(null);

  /* Load this account's conversations; forget the last account's. */
  useEffect(() => {
    abortRef.current?.abort();
    if (!userId) {
      threadsRef.current = [];
      setThreads([]);
      setActiveId(null);
      loadedFor.current = null;
      return;
    }
    const loaded = loadThreads(userId);
    threadsRef.current = loaded;
    loadedFor.current = userId;
    setThreads(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, [userId]);

  /* Single write path for threads: memory, React, and storage together. */
  const writeThreads = useCallback((next: Thread[]) => {
    threadsRef.current = next;
    setThreads(next);
    if (loadedFor.current) saveThreads(loadedFor.current, next);
  }, []);

  const updateThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    writeThreads(threadsRef.current.map(t => (t.id === id ? { ...fn(t), updatedAt: Date.now() } : t)));
  }, [writeThreads]);

  const ensureThread = useCallback((): string => {
    const current = threadsRef.current.find(t => t.id === activeId);
    if (current) return current.id;
    const t = newThread();
    writeThreads([t, ...threadsRef.current]);
    setActiveId(t.id);
    return t.id;
  }, [activeId, writeThreads]);

  const pushEntries = useCallback((threadId: string, entries: Entry[]) => {
    updateThread(threadId, t => ({ ...t, entries: [...t.entries, ...entries] }));
  }, [updateThread]);

  const contextFor = (state: AppState, handles: Thread['handles']): ProposalContext => {
    const today = getISTDateString();
    return { state, today, now: nowMinute(), handles, recentPerDay: computePace(state, today).recentPerDay };
  };

  /* ── The loop ── */
  const run = useCallback(async (
    threadId: string,
    intent: MentorIntent,
    prepared: unknown,
    fallback?: () => Entry[],
  ) => {
    if (!active) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStep('THINKING');

    const finishWith = (entries: Entry[]) => { if (entries.length) pushEntries(threadId, entries); };
    const fail = (code: MentorErrorCode | ClientError) => {
      const retryable = ['busy', 'unavailable', 'offline', 'invalid_output'].includes(code);
      const t = threadsRef.current.find(x => x.id === threadId);
      const lastUser = [...(t?.entries ?? [])].reverse().find(e => e.kind === 'user');
      const extra = fallback ? fallback() : [];
      finishWith([
        {
          kind: 'notice', id: generateId(), at: Date.now(), tone: extra.length ? 'info' : 'error',
          text: extra.length ? `${ERROR_TEXT[code]} Here is what the planner worked out on its own.` : ERROR_TEXT[code],
          ...(retryable && lastUser?.kind === 'user' ? { retry: { text: lastUser.text, intent } } : {}),
        },
        ...extra,
      ]);
    };

    try {
      let autoRetried = false;
      for (let call = 0; call < MENTOR_LIMITS.maxCallsPerTurn; call++) {
        const thread = threadsRef.current.find(t => t.id === threadId);
        if (!thread) return;
        const state = getState();
        const today = getISTDateString();
        const now = nowMinute();
        const handles = { ...thread.handles };

        const snapshot = buildSnapshot({ state, today, now, handles, prepared });
        const body: MentorRequest = {
          v: MENTOR_PROTOCOL_VERSION,
          intent,
          snapshot,
          messages: wireForSend(thread.wire),
        };
        updateThread(threadId, t => ({ ...t, handles }));

        let res = await callMentor(body, controller.signal);
        if ('error' in res && res.error === 'busy' && !autoRetried) {
          const wait = 'retryAfter' in res && res.retryAfter ? res.retryAfter : 10;
          if (wait <= AUTO_RETRY_MAX_S) {
            autoRetried = true;
            for (let s = Math.ceil(wait); s > 0; s--) {
              setStep(`MENTOR BUSY — RETRYING IN ${s}S`);
              await new Promise(r => setTimeout(r, 1000));
              if (controller.signal.aborted) return;
            }
            setStep('THINKING');
            res = await callMentor(body, controller.signal);
          }
        }
        if ('error' in res) {
          if ('remaining' in res && res.remaining !== undefined) setRemaining(res.remaining ?? null);
          fail(res.error);
          return;
        }
        setRemaining(res.remaining);

        const calls = res.tool_calls ?? [];
        const content = (res.content ?? '').trim();
        const assistant: WireMessage = calls.length
          ? { role: 'assistant', content, tool_calls: calls }
          : { role: 'assistant', content };
        const entries: Entry[] = [];
        if (content) entries.push({ kind: 'assistant', id: generateId(), at: Date.now(), text: content, model: res.model });

        if (!calls.length) {
          updateThread(threadId, t => ({ ...t, wire: [...t.wire, assistant], entries: [...t.entries, ...entries] }));
          return;
        }

        /* Execute this round. */
        const toolMessages: WireMessage[] = [];
        let terminal = false;
        const liveState = getState();
        const ctx = contextFor(liveState, handles);
        for (const c of calls) {
          const checked = checkToolCall(c);
          if ('error' in checked) {
            toolMessages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ error: checked.error }) });
            continue;
          }
          if (checked.def.kind === 'read') {
            if (terminal) {
              toolMessages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ skipped: true }) });
              continue;
            }
            setStep(STEP_LABEL[c.name] ?? 'THINKING');
            const result = runReadTool(c.name, checked.args, { state: liveState, today, now, handles });
            toolMessages.push({
              role: 'tool', tool_call_id: c.id,
              content: JSON.stringify(result).slice(0, MENTOR_LIMITS.maxToolResultChars),
            });
            continue;
          }
          /* A proposal: build the card, and end the turn with it. */
          const built = proposalFromTool(c.name, checked.args, ctx, {
            redistribute: horizon => redistribute(liveState, today, now, horizon),
          });
          if ('error' in built) {
            toolMessages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ error: built.error }) });
            continue;
          }
          terminal = true;
          entries.push({ kind: 'proposal', id: generateId(), at: Date.now(), proposal: built.proposal, toolCallId: c.id });
          toolMessages.push({
            role: 'tool', tool_call_id: c.id,
            content: JSON.stringify({ status: 'shown_to_student', note: 'The student is reviewing this card. Nothing has changed yet.' }),
          });
        }

        updateThread(threadId, t => ({
          ...t,
          handles,
          wire: [...t.wire, assistant, ...toolMessages],
          entries: [...t.entries, ...entries],
        }));
        if (terminal) return;
      }
      finishWith([{
        kind: 'notice', id: generateId(), at: Date.now(), tone: 'info',
        text: 'The Mentor ran out of steps on that one. Ask something narrower.',
      }]);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      fail('unavailable');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
        setStep(null);
      }
    }
  }, [active, getState, pushEntries, updateThread]);

  /* ── Public API ── */

  const userTurn = useCallback((threadId: string, text: string, intent: MentorIntent, extra: Entry[] = []) => {
    updateThread(threadId, t => ({
      ...t,
      title: t.entries.length ? t.title : text.slice(0, 60),
      entries: [...t.entries, { kind: 'user', id: generateId(), at: Date.now(), text }, ...extra],
      wire: [...t.wire, { role: 'user', content: text.slice(0, MENTOR_LIMITS.maxMessageChars) }],
    }));
  }, [updateThread]);

  const send = useCallback((text: string, intent: MentorIntent = 'chat') => {
    const clean = text.trim();
    if (!clean || busy) return;
    const id = ensureThread();
    userTurn(id, clean, intent);
    void run(id, intent, undefined);
  }, [busy, ensureThread, userTurn, run]);

  const runAction = useCallback((action: QuickAction) => {
    if (busy) return;
    const state = getState();
    const today = getISTDateString();
    const now = nowMinute();
    const id = ensureThread();
    const handles = threadsRef.current.find(t => t.id === id)?.handles ?? {};
    const ctx = contextFor(state, handles);
    const at = Date.now();

    switch (action) {
      case 'plan_today':
      case 'plan_tomorrow': {
        /* Late in the evening there is nothing left of today to plan; a planner
           looks at tomorrow instead of offering an empty card. */
        const rollOver = action === 'plan_today' && dayCapacity(state, today, today, now).minutes < MIN_PLANNABLE;
        const date = action === 'plan_today' && !rollOver ? today : addDays(today, 1);
        const draft = buildDayPlan(state, date, today, now);
        userTurn(id, action === 'plan_today' ? 'Plan my day.' : 'Plan tomorrow.', 'plan_day', rollOver
          ? [{ kind: 'notice', id: generateId(), at, tone: 'info', text: 'Not enough of today is left to plan — planning tomorrow instead.' }]
          : []);
        const engineCard = (): Entry[] => {
          const built = proposalFromDayPlan(ctx, draft);
          return 'proposal' in built
            ? [{ kind: 'proposal', id: generateId(), at, proposal: built.proposal }]
            : [{ kind: 'notice', id: generateId(), at, tone: 'info', text: built.error }];
        };
        if (!active) { pushEntries(id, engineCard()); return; }
        void run(id, 'plan_day', {
          task: 'plan_day',
          date,
          capacityMinutes: draft.capacity.minutes,
          alreadyDueMinutes: draft.alreadyDueMins,
          minutesToFill: draft.availableMins,
          capacityNotes: draft.capacity.notes,
          draft: draft.items,
          alternatives: draft.alternatives,
          instruction: 'Review this draft and call propose_tasks for the date. Keep total estMins within minutesToFill. Improve task wording to be specific; swap in an alternative only with a reason.',
        }, engineCard);
        return;
      }
      case 'on_track': {
        const pace = computePace(state, today);
        userTurn(id, 'Am I on track?', 'on_track', [{ kind: 'pace', id: generateId(), at, pace }]);
        if (!active) return;
        void run(id, 'on_track', {
          task: 'on_track',
          pace: slimPace(pace),
          instruction: 'The student can already see these numbers on a card. In 3-5 short sentences, say what they mean and the single most useful next move. Do not repeat every figure.',
        }, () => []);
        return;
      }
      case 'review_week': {
        const review = buildWeekReview(state, today);
        userTurn(id, 'Review my week.', 'review_week', [{ kind: 'week', id: generateId(), at, review }]);
        if (!active) return;
        void run(id, 'review_week', {
          task: 'review_week',
          review,
          instruction: 'The student can see this on a card. Give a 3-5 sentence read: what went well, what slipped, one concrete change for next week.',
        }, () => []);
        return;
      }
      case 'roadmap': {
        const pace = computePace(state, today);
        const exam = resolveExamDate(state.examPreference || 'JEE', state.examDates);
        const target = pace.target.kind === 'exam' ? addDays(pace.target.date, -pace.reserveDays) : pace.target.date;
        userTurn(id, 'Build my syllabus roadmap.', 'roadmap');
        const engineCard = (): Entry[] => {
          const built = roadmapProposal(ctx, { targetDate: target }, 'Built from your current pace and the syllabus still left.', 'engine');
          return 'proposal' in built
            ? [{ kind: 'proposal', id: generateId(), at, proposal: built.proposal }]
            : [{ kind: 'notice', id: generateId(), at, tone: 'info', text: built.error }];
        };
        if (!active) { pushEntries(id, engineCard()); return; }
        void run(id, 'roadmap', {
          task: 'roadmap',
          pace: slimPace(pace),
          suggestedTarget: target,
          examDate: exam.date,
          examDateIsPlaceholder: exam.isDefault,
          instruction: 'Help the student set up a roadmap. If the syllabus warnings say progress is unmarked, ask about that first (offer propose_chapter_status). If you know enough, call propose_roadmap; otherwise ask at most two short questions (target date? hours per day?).',
        }, engineCard);
        return;
      }
      case 'replan': {
        const plan = redistribute(state, today, now);
        userTurn(id, 'Replan what I missed.', 'replan');
        const engineCard = (): Entry[] => {
          const built = replanProposal(plan, 'Moved to the first days with room, without overloading any of them.', 'engine');
          return 'proposal' in built
            ? [{ kind: 'proposal', id: generateId(), at, proposal: built.proposal }]
            : [{ kind: 'notice', id: generateId(), at, tone: 'info', text: built.error }];
        };
        if (!active || (!plan.moves.length && !plan.unplaced.length)) { pushEntries(id, engineCard()); return; }
        void run(id, 'replan', {
          task: 'replan',
          engineReplan: plan,
          instruction: 'The app has already computed these moves from capacity. Call propose_replan with a short summary explaining the reasoning; mention anything that did not fit.',
        }, engineCard);
        return;
      }
    }
  }, [busy, getState, ensureThread, userTurn, run, active, pushEntries]);

  const retry = useCallback(() => {
    if (busy || !activeId) return;
    const t = threadsRef.current.find(x => x.id === activeId);
    const last = [...(t?.entries ?? [])].reverse().find(e => e.kind === 'user' || (e.kind === 'notice' && e.retry));
    const intent = last?.kind === 'notice' && last.retry ? last.retry.intent : 'chat';
    void run(activeId, intent, undefined);
  }, [busy, activeId, run]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStep(null);
  }, []);

  const startThread = useCallback(() => {
    if (busy) return;
    const current = threadsRef.current.find(t => t.id === activeId);
    if (current && !current.entries.length) return;
    const t = newThread();
    writeThreads([t, ...threadsRef.current]);
    setActiveId(t.id);
  }, [busy, activeId, writeThreads]);

  const openThread = useCallback((id: string) => { if (!busy) setActiveId(id); }, [busy]);

  const deleteThread = useCallback((id: string) => {
    if (busy && id === activeId) return;
    const next = threadsRef.current.filter(t => t.id !== id);
    writeThreads(next);
    if (id === activeId) setActiveId(next[0]?.id ?? null);
  }, [busy, activeId, writeThreads]);

  /* ── Cards ── */

  const findProposal = (entryId: string): { threadId: string; entry: Extract<Entry, { kind: 'proposal' }> } | null => {
    for (const t of threadsRef.current) {
      const e = t.entries.find(x => x.id === entryId);
      if (e?.kind === 'proposal') return { threadId: t.id, entry: e };
    }
    return null;
  };

  const editProposal = useCallback((entryId: string, fn: (p: Proposal) => Proposal) => {
    const hit = findProposal(entryId);
    if (!hit) return;
    updateThread(hit.threadId, t => ({
      ...t,
      entries: t.entries.map(e => (e.id === entryId && e.kind === 'proposal' ? { ...e, proposal: fn(e.proposal) } : e)),
    }));
  }, [updateThread]);

  /* The model is told what the student did with its card, so "did that work?"
     has an honest answer next turn. */
  const noteOutcome = useCallback((entryId: string, status: string) => {
    const hit = findProposal(entryId);
    if (!hit?.entry.toolCallId) return;
    const callId = hit.entry.toolCallId;
    updateThread(hit.threadId, t => ({
      ...t,
      wire: t.wire.map(m => (m.role === 'tool' && m.tool_call_id === callId ? { ...m, content: JSON.stringify({ status }) } : m)),
    }));
  }, [updateThread]);

  const toggleLine = useCallback((entryId: string, lineId: string) => {
    editProposal(entryId, p => p.status !== 'pending' ? p : { ...p, lines: p.lines.map(l => (l.id === lineId ? { ...l, checked: !l.checked } : l)) });
  }, [editProposal]);

  const setLineMins = useCallback((entryId: string, lineId: string, mins: number) => {
    const m = Math.max(10, Math.min(240, Math.round(mins / 5) * 5));
    editProposal(entryId, p => p.status !== 'pending' ? p : { ...p, lines: p.lines.map(l => (l.id === lineId && l.mins !== undefined ? { ...l, mins: m } : l)) });
  }, [editProposal]);

  const undo = useCallback((entryId: string) => {
    const hit = findProposal(entryId);
    const p = hit?.entry.proposal;
    if (!p || p.status !== 'applied' || !p.inverse) return;
    const result = commit(p.inverse);
    if (!result) return;
    editProposal(entryId, q => ({ ...q, status: 'pending', inverse: undefined, appliedCount: undefined }));
    noteOutcome(entryId, 'undone_by_student');
    pushToast({ id: `mentor-${entryId}`, title: 'UNDONE', body: 'Everything that card changed is back the way it was.', tone: 'neutral', ttlMs: 4000 });
  }, [commit, editProposal, noteOutcome]);

  const apply = useCallback((entryId: string) => {
    const hit = findProposal(entryId);
    const p = hit?.entry.proposal;
    if (!p || p.status !== 'pending') return;
    const ops = opsFor(p);
    if (!ops.length) return;
    const result = commit(ops);
    if (!result) return;
    editProposal(entryId, q => ({
      ...q,
      status: 'applied',
      inverse: result.inverse,
      appliedCount: result.applied,
      notes: result.skipped.length ? [...q.notes, ...result.skipped.map(s => `Skipped — ${s}`)] : q.notes,
    }));
    noteOutcome(entryId, `applied_by_student (${result.applied} change${result.applied === 1 ? '' : 's'})`);
    const added = ops.filter(o => o.t === 'addTask').length;
    pushToast({
      id: `mentor-${entryId}`,
      title: added ? `${added} CARD${added === 1 ? '' : 'S'} ADDED` : 'APPLIED',
      body: result.skipped.length ? `${result.skipped.length} skipped — see the card.` : undefined,
      tone: 'good',
      action: { label: 'UNDO', run: () => undo(entryId) },
    });
  }, [commit, editProposal, noteOutcome, undo]);

  const dismiss = useCallback((entryId: string) => {
    editProposal(entryId, p => (p.status === 'pending' ? { ...p, status: 'dismissed' } : p));
    noteOutcome(entryId, 'dismissed_by_student');
  }, [editProposal, noteOutcome]);

  const forgetAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStep(null);
    writeThreads([]);
    if (loadedFor.current) forgetThreadsFor(loadedFor.current);
    setActiveId(null);
  }, [writeThreads]);

  /* A request in flight dies with the account that made it. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const thread = threads.find(t => t.id === activeId) ?? null;

  return {
    threads, thread, busy, step, remaining,
    send, runAction, retry, cancel, startThread, openThread, deleteThread,
    toggleLine, setLineMins, apply, undo, dismiss, forgetAll,
  };
};
