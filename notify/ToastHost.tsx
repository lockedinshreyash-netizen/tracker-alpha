import React, { useEffect, useRef, useState } from 'react';
import { Toast, dismissToast, readToasts, subscribeToasts } from './toastBus';

interface Props {
  theme: 'dark' | 'light';
}

/**
 * The only subscriber to the toast bus.
 *
 * Sits where the race toast has always sat, so migrating that onto the bus is
 * visually a no-op: clear of the mobile header above and of the voice control
 * in the bottom-right.
 *
 * Renders `null` when the queue is empty, which is its state essentially all
 * of the time — no DOM, no timers, no cost. Nothing here runs unless something
 * is actually being said.
 */
const ToastHost: React.FC<Props> = ({ theme }) => {
  const [toasts, setToasts] = useState<Toast[]>(readToasts);

  useEffect(() => subscribeToasts(setToasts), []);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-[45] w-[min(92vw,26rem)] flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} theme={theme} />
      ))}
    </div>
  );
};

interface CardProps {
  toast: Toast;
  theme: 'dark' | 'light';
}

const ToastCard: React.FC<CardProps> = ({ toast, theme }) => {
  const dark = theme === 'dark';
  const alert = toast.tone === 'alert';

  /* ── Why this is not a plain setTimeout ──
     A toast pushed a moment before the user switched tabs would otherwise burn
     its nine seconds unseen and be gone when they look back. That is precisely
     the case `deliver()` exists to cover — it chose a toast because the tab was
     visible — so losing it to a background timer would silently drop the
     message the whole layer was built to carry.

     The remaining time is therefore banked on hide and re-armed on show. */
  const remainingRef = useRef(toast.ttlMs);
  const startedRef = useRef(Date.now());

  useEffect(() => {
    if (!toast.ttlMs) return;   // sticky

    remainingRef.current = toast.ttlMs;
    startedRef.current = Date.now();
    let timer: number | undefined;

    const arm = () => {
      startedRef.current = Date.now();
      timer = window.setTimeout(() => dismissToast(toast.id), remainingRef.current);
    };

    const bank = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm();
      else bank();
    };

    if (document.visibilityState === 'visible') arm();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    /* `pushedAt` is in the deps so re-pushing the same id restarts the clock,
       which is the documented behaviour of pushing a duplicate id. */
  }, [toast.id, toast.ttlMs, toast.pushedAt]);

  const shell = alert
    ? dark ? 'bg-[#1A0605]/95 border-[#E10600]/40' : 'bg-white/95 border-[#E10600]/40'
    : dark ? 'bg-[#111114]/95 border-white/[0.10]' : 'bg-white/95 border-[#E3E0D9]';

  return (
    <div className={`toast-in pointer-events-auto w-full rounded-xl border shadow-2xl backdrop-blur-xl ${shell}`}>
      <button
        onClick={() => dismissToast(toast.id)}
        className="w-full text-left flex items-start gap-3 p-4 transition-all"
      >
        {toast.icon && (
          <span className="text-lg leading-none mt-0.5 select-none" aria-hidden="true">{toast.icon}</span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-bold font-ui leading-snug ${dark ? 'text-white' : 'text-[#17150F]'}`}>
            {toast.title}
          </span>
          {toast.body && (
            <span className={`block text-[11px] font-ui mt-1 ${dark ? 'text-zinc-400' : 'text-[#6B675C]'}`}>
              {toast.body}
            </span>
          )}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui flex-shrink-0 ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
          Dismiss
        </span>
      </button>

      {toast.action && (
        <div className={`px-4 pb-3 -mt-1`}>
          <button
            onClick={() => { toast.action!.run(); dismissToast(toast.id); }}
            className="text-[10px] font-bold uppercase tracking-[0.08em] font-ui text-[#E10600] active:scale-97 transition-transform"
          >
            {toast.action.label}
          </button>
        </div>
      )}
    </div>
  );
};

export default ToastHost;
