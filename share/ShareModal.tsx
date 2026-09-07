/**
 * The share sheet.
 *
 * The card is the product; this is the frame around it. It follows the app's
 * existing modal language (`rewards/UnlockModal.tsx` — dark scrim, click
 * outside to dismiss, uppercase actions) and adds the keyboard and
 * screen-reader handling the older modals never had: a sheet that traps focus
 * and answers Escape is the minimum for something with a live preview and five
 * controls in it.
 *
 * The `@lockedinshreyash` invitation lives here and never on the card. A card
 * that advertises is not an artifact.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardFormat, CardPeriod } from './types';
import { ALL_FORMATS } from './render/format';
import { buildCard, describeCard, StatsInput, stampFor } from './stats';
import { useCardImage } from './useCardImage';
import {
  CAPTION, copyCaption, fileNameFor, saveCard, shareAbility, shareCard,
} from './sharing';

interface Props {
  onClose: () => void;
  /** The narrow slice the cards are derived from. Never `AppState`. */
  input: StatsInput;
  theme: 'dark' | 'light';
  initialPeriod?: CardPeriod;
}

const PERIODS: { id: CardPeriod; label: string; hint: string }[] = [
  { id: 'daily', label: 'Daily', hint: "Today's work" },
  { id: 'weekly', label: 'Weekly', hint: 'This week' },
  { id: 'monthly', label: 'Monthly', hint: 'This month' },
];

const FORMAT_HINT: Record<CardFormat, string> = {
  '4:5': 'Post',
  '9:16': 'Story',
  '1:1': 'Square',
};

const FOCUSABLE = 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])';

const ShareModal: React.FC<Props> = ({ onClose, input, theme, initialPeriod = 'daily' }) => {
  const dark = theme === 'dark';
  const [period, setPeriod] = useState<CardPeriod>(initialPeriod);
  const [format, setFormat] = useState<CardFormat>('4:5');
  const [status, setStatus] = useState<string | null>(null);

  const dialog = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const restoreTo = useRef<HTMLElement | null>(null);

  const data = useMemo(() => buildCard(period, input), [period, input]);
  const image = useCardImage(data, format);
  const ability = shareAbility();

  /* Focus moves in on open and back on close: a sheet you have to hunt for with
     the keyboard is a sheet you cannot leave. */
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    tabs.current[PERIODS.findIndex(p => p.id === initialPeriod)]?.focus();
    return () => restoreTo.current?.focus?.();
  }, [initialPeriod]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /* The preview is the very canvas that gets shared — there is no second HTML
     rendering of a card to drift out of sync, so what is approved here is
     byte-for-byte what leaves the device. */
  useEffect(() => {
    if (!preview.current) return;
    if (!image.canvas) {
      preview.current.replaceChildren();
      return;
    }
    const canvas = image.canvas;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '48vh';
    canvas.style.width = 'auto';
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', describeCard(data));
    preview.current.replaceChildren(canvas);
  }, [image.canvas, data]);

  useEffect(() => setStatus(null), [period, format]);

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : PERIODS.length - 1)) % PERIODS.length;
    setPeriod(PERIODS[next].id);
    tabs.current[next]?.focus();
  };

  const name = fileNameFor(period, stampFor(data));

  /* Deliberately not `async` up front. `navigator.share` needs the click's
     transient activation, and awaiting anything before calling it spends that
     activation — which is why the blob was encoded with the preview. */
  const onPrimary = useCallback(() => {
    if (!image.blob) return;
    if (ability === 'download') {
      setStatus(saveCard(image.blob, name) === 'opened'
        ? 'Opened in a new tab — long-press the image to save it.'
        : 'Saved.');
      return;
    }
    shareCard(image.blob, name, CAPTION).then(outcome => {
      if (outcome === 'shared') setStatus('Shared. Nice work.');
      else if (outcome === 'failed') setStatus("Couldn't open the share sheet. Save it instead.");
      else setStatus(null); // cancelled — not a failure, and not worth a line
    });
  }, [image.blob, ability, name]);

  const onSave = useCallback(() => {
    if (!image.blob) return;
    setStatus(saveCard(image.blob, name) === 'opened'
      ? 'Opened in a new tab — long-press the image to save it.'
      : 'Saved.');
  }, [image.blob, name]);

  const onCopy = useCallback(() => {
    copyCaption(CAPTION).then(ok => setStatus(ok ? 'Caption copied.' : "Couldn't copy the caption."));
  }, []);

  const ready = image.state === 'ready' && !!image.blob;

  const chip = (active: boolean) =>
    `px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 font-ui focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${
      active
        ? 'bg-[#E10600] border-[#E10600] text-white'
        : dark
          ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300'
          : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'
    }`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md my-auto rounded-2xl border overflow-hidden ${
          dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'
        }`}
      >
        <div className={`px-6 pt-6 pb-4 flex items-start justify-between gap-4`}>
          <div>
            <h2
              id="share-title"
              className={`text-[13px] font-bold uppercase tracking-[0.1em] font-ui ${dark ? 'text-white' : 'text-[#17150F]'}`}
            >
              Share your win
            </h2>
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 mt-1.5 font-ui">
              {PERIODS.find(p => p.id === period)?.hint}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`shrink-0 w-8 h-8 rounded-md border flex items-center justify-center transition-colors active:scale-97 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${
              dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-200 text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        <div
          className={`mx-6 relative flex items-center justify-center rounded-lg overflow-hidden min-h-[220px] ${
            dark ? 'bg-[#0D0D10]' : 'bg-zinc-50'
          }`}
        >
          {/* The canvas is placed here imperatively, so this node must have no
              React children of its own — React and `replaceChildren` cannot both
              own the same parent, and when they try React throws on the child it
              no longer finds. The states below are siblings for that reason. */}
          <div ref={preview} />

          {image.state === 'rendering' && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 font-ui">
              Drawing…
            </span>
          )}
          {image.state === 'error' && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#E10600] font-ui px-6 text-center">
              {image.error}
            </span>
          )}
        </div>

        <div className="px-6 pt-5 space-y-3">
          <div role="tablist" aria-label="Period" className="flex gap-2">
            {PERIODS.map((p, i) => (
              <button
                key={p.id}
                ref={el => { tabs.current[i] = el; }}
                role="tab"
                aria-selected={period === p.id}
                tabIndex={period === p.id ? 0 : -1}
                onKeyDown={e => onTabKey(e, i)}
                onClick={() => setPeriod(p.id)}
                className={`flex-1 ${chip(period === p.id)}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2" role="group" aria-label="Size">
            {ALL_FORMATS.map(f => (
              <button
                key={f}
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
                className={`flex-1 ${chip(format === f)}`}
              >
                {FORMAT_HINT[f]}
                <span className="opacity-60 ml-1.5 tracking-normal">{f}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`px-6 py-5 mt-5 border-t space-y-2.5 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button
            onClick={onPrimary}
            disabled={!ready}
            className="w-full px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#E10600] focus-visible:ring-offset-transparent"
          >
            {ability === 'files' ? 'Share' : 'Save image'}
          </button>

          <div className="flex gap-2.5">
            {/* Where the share sheet exists, saving is still offered — a Story is
                not the only place a card goes. */}
            {ability === 'files' && (
              <button
                onClick={onSave}
                disabled={!ready}
                className={`flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${
                  dark ? 'border-white/[0.12] text-zinc-400 hover:text-zinc-200' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Save image
              </button>
            )}
            <button
              onClick={onCopy}
              className={`flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 font-ui focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${
                dark ? 'border-white/[0.12] text-zinc-400 hover:text-zinc-200' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Copy caption
            </button>
          </div>

          <p aria-live="polite" className="min-h-[14px] text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 font-ui">
            {status}
            {!status && !image.fontsLoaded && 'Drawn with fallback fonts — the card is still fine to share.'}
          </p>
        </div>

        <div className={`px-6 py-4 border-t ${dark ? 'border-white/[0.06] bg-[#0D0D10]' : 'border-zinc-100 bg-zinc-50'}`}>
          <p className="text-[10px] leading-relaxed font-medium tracking-[0.02em] text-zinc-500 font-ui">
            Tag <span className={dark ? 'text-zinc-300' : 'text-zinc-700'}>@lockedinshreyash</span>.
            {' '}I&rsquo;ll repost your win.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
