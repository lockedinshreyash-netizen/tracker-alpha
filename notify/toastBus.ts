/* ── The in-app toast queue ──
   One place for anything the app says on screen, so a feature that needs to
   speak does not arrive with its fourth private implementation of a pill in a
   corner.

   Deliberately a module-level bus rather than a React context provider, for
   two reasons that both matter:

   1. Half the callers are not components. The Pomodoro bell fires from inside
      `usePomodoro`'s settle, the reminder engine fires from a window event
      handler, and `deliver()` is a plain async function. None of them can
      reach a provider without being handed one through every layer in
      between. `audio.ts`'s `playCue` is already callable from anywhere and
      this is the same shape, for the same reason.

   2. A context whose value changes on every toast re-renders every consumer
      beneath it. The entire app already sits under App's single `state`
      object; adding a second high-churn provider around it would mean a
      nine-second toast countdown is paid for by the timeline, the heatmap and
      the leaderboard on every tick. The bus costs those components nothing —
      `ToastHost` is the only subscriber that exists. */

export type ToastTone = 'neutral' | 'good' | 'alert';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastSpec {
  /* Caller-supplied identity. Pushing the same id twice REPLACES the live
     toast and restarts its clock rather than stacking a second card — the same
     reasoning as the `tag` on a system notification, and for the same reason:
     the app has a current state to report, not a backlog. Omitted means every
     push is its own toast. */
  id?: string;
  title: string;
  body?: string;
  /** Rendered as-is, `aria-hidden`. An emoji, not an icon component. */
  icon?: string;
  tone?: ToastTone;
  /** 0 means sticky — the user has to dismiss it. */
  ttlMs?: number;
  action?: ToastAction;
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  icon?: string;
  tone: ToastTone;
  ttlMs: number;
  action?: ToastAction;
  pushedAt: number;
}

/** Matches the 9s the race toast has always used. */
export const DEFAULT_TTL_MS = 9_000;

/* Three stacked cards on a 375px phone cover the timer, which is the one thing
   on that screen nobody wants hidden. Anything past the cap drops the OLDEST —
   a burst is the app being noisy, and the newest line is the one that still
   describes now. */
export const MAX_QUEUE = 3;

let queue: Toast[] = [];
let listeners: Array<(q: Toast[]) => void> = [];
let seq = 0;

const emit = () => {
  /* A fresh array every time: `ToastHost` holds this in state, and mutating in
     place would leave React comparing an object with itself and skipping the
     render. */
  const snapshot = queue.slice();
  listeners.forEach(fn => fn(snapshot));
};

export const pushToast = (spec: ToastSpec): string => {
  const id = spec.id ?? `toast-${++seq}`;
  const toast: Toast = {
    id,
    title: spec.title,
    body: spec.body,
    icon: spec.icon,
    tone: spec.tone ?? 'neutral',
    ttlMs: spec.ttlMs ?? DEFAULT_TTL_MS,
    action: spec.action,
    pushedAt: Date.now(),
  };

  const existing = queue.findIndex(t => t.id === id);
  if (existing >= 0) {
    /* Replace in place rather than moving to the end. A toast that keeps
       updating — a countdown, a sync status — would otherwise jump around the
       stack while the user is reading it. */
    queue = queue.slice();
    queue[existing] = toast;
  } else {
    queue = [...queue, toast].slice(-MAX_QUEUE);
  }

  emit();
  return id;
};

export const dismissToast = (id: string): void => {
  const next = queue.filter(t => t.id !== id);
  if (next.length === queue.length) return;
  queue = next;
  emit();
};

export const clearToasts = (): void => {
  if (!queue.length) return;
  queue = [];
  emit();
};

/** Current queue without subscribing. For the host's initial state only. */
export const readToasts = (): Toast[] => queue;

export const subscribeToasts = (fn: (q: Toast[]) => void): (() => void) => {
  listeners = [...listeners, fn];
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
};
