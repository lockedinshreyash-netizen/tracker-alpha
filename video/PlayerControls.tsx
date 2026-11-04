/* ── Alpha Video: the strip under the player ──
   Back ten, play or pause, forward ten, the time, and the speed. It sits
   outside the frame, because nothing may be drawn over YouTube's player, and
   it drives the player only through the documented API. `children` is where a
   caller adds its own actions (Bookmark, Note, Start the clock).

   The time is the only part that changes while a video plays, so it is its
   own component, polled twice a second while playing and not at all
   otherwise: the strip and whatever holds it do not re-render with the clock. */

import React, { useEffect, useState } from 'react';
import { formatTime, rateLabel, seekTarget, spokenTime, stepRate, actionForKey } from './model';
import type { PlayerController } from './controller';
import type { PlayerState } from './youtube';

interface Props {
  controller: PlayerController | null;
  state: PlayerState;
  rate: number;
  dark: boolean;
  /** Listen for the keyboard shortcuts while this strip is on screen. */
  keys?: boolean;
  children?: React.ReactNode;
}

const PlayerControls = ({ controller, state, rate, dark, keys = true, children }: Props) => {
  const playing = state === 'playing' || state === 'buffering';
  const off = !controller;
  // Re-asked on every state change: YouTube often reports only [1] until the video starts.
  const rates = controller ? controller.rates() : [1];

  useVideoKeys(keys ? controller : null);

  const icon = dark ? 'text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-zinc-100';
  const iconBtn = `w-11 h-11 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none ${icon}`;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border px-2 py-1.5 ${
        dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'
      }`}
    >
      <div className="flex items-center">
        <button
          type="button"
          className={iconBtn}
          disabled={off}
          aria-label="Back 10 seconds"
          onClick={() => controller?.seek(seekTarget(controller.time(), -1, controller.duration()))}
        >
          <IconBack />
        </button>
        <button
          type="button"
          className={iconBtn}
          disabled={off}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => controller?.toggle()}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className={iconBtn}
          disabled={off}
          aria-label="Forward 10 seconds"
          onClick={() => controller?.seek(seekTarget(controller.time(), 1, controller.duration()))}
        >
          <IconForward />
        </button>
      </div>

      <TimeReadout controller={controller} playing={playing} state={state} dark={dark} />

      <label className="ml-auto flex items-center gap-2 font-ui text-xs font-bold text-zinc-500">
        Speed
        <select
          value={String(rate)}
          disabled={off || rates.length < 2}
          onChange={e => controller?.setRate(Number(e.target.value))}
          className={`h-9 rounded-lg border px-2 font-ui text-sm font-bold outline-none focus:border-[#E10600] disabled:opacity-40 ${
            dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}
        >
          {(rates.includes(rate) ? rates : [...rates, rate].sort((a, b) => a - b)).map(r => (
            <option key={r} value={String(r)}>{rateLabel(r)}</option>
          ))}
        </select>
      </label>

      {children}
    </div>
  );
};

const TimeReadout = ({ controller, playing, state, dark }: { controller: PlayerController | null; playing: boolean; state: PlayerState; dark: boolean }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!controller || !playing) return;
    const id = window.setInterval(() => setTick(t => t + 1), 500);
    return () => window.clearInterval(id);
  }, [controller, playing]);

  // `state` is read so a pause or a seek redraws the time once even when not polling.
  void state;
  const now = controller ? controller.time() : 0;
  const total = controller ? controller.duration() : null;
  return (
    <span
      className={`px-2 font-ui text-sm font-bold tabular-nums ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}
      aria-label={total ? `${spokenTime(now)} of ${spokenTime(total)}` : spokenTime(now)}
    >
      {formatTime(now)}
      <span className={dark ? 'text-zinc-600' : 'text-zinc-400'}> / {total ? formatTime(total) : '–:––'}</span>
    </span>
  );
};

/* Space, K, ←/→, < and >, on Alpha's page. A key typed into a field, or Space
   on a focused button (which presses that button), is left alone. */
const isField = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};
const isControl = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName);

export const useVideoKeys = (controller: PlayerController | null): void => {
  useEffect(() => {
    if (!controller) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const typing = isField(e.target) || ((e.key === ' ' || e.key === 'Enter') && isControl(e.target));
      const action = actionForKey({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, typing });
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle') controller.toggle();
      else if (action === 'back' || action === 'forward') {
        controller.seek(seekTarget(controller.time(), action === 'back' ? -1 : 1, controller.duration()));
      } else {
        controller.setRate(stepRate(controller.rate(), controller.rates(), action === 'slower' ? -1 : 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller]);
};

const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
);
const IconPause = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
);
const IconBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" />
    <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">10</text>
  </svg>
);
const IconForward = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" />
    <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">10</text>
  </svg>
);

export default PlayerControls;
