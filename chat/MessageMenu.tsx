/* ── What a long press (or ⋯, or 😊) opens ──
   Floats in front of the conversation instead of unfolding under the bubble,
   so nothing in the thread moves. Three shapes:

     both  — long press / right click / Enter on a bubble. The page dims, a
             copy of the bubble is lifted out of it, the emoji bar sits above
             and Reply · Copy · Delete below — Instagram and WhatsApp's shape.
             If the bubble is too near an edge for both to fit, the lifted
             copy slides to where they do, as WhatsApp does.
     react — the 😊 in the hover strip: the emoji bar alone, over the button.
     more  — the ⋯ in the hover strip: Copy and Delete, under the button.

   A portal, for the reason ui/kit.tsx's Overlay gives: <main> is a stacking
   context under the rail. Positions are measured once on open; any scroll or
   resize closes it rather than letting it drift off its message. */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Overlay } from '../ui/kit';
import { REACTIONS, ReactionGroup, nameList } from './reactions';
import './chat.css';

export type MenuMode = 'both' | 'react' | 'more';

interface Props {
  anchor: HTMLElement;
  mode: MenuMode;
  mine: boolean;
  dark: boolean;
  /** Opened from the keyboard: focus goes into the menu. */
  keyboard: boolean;
  myEmoji: string | null;
  reactions: ReactionGroup[];
  timeLabel: string;
  canReact: boolean;
  canReply: boolean;
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const GAP = 10;
const EDGE = 10;

interface Layout {
  bar?: { top: number; left: number };
  card?: { top: number; left: number };
  /** Where the lifted copy of the bubble sits (mode both). */
  clone?: { top: number; left: number; width: number; from: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

const MessageMenu = ({
  anchor, mode, mine, dark, keyboard, myEmoji, reactions, timeLabel,
  canReact, canReply, canDelete, onReact, onReply, onCopy, onDelete, onClose,
}: Props) => {
  const barRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [confirming, setConfirming] = useState(false);

  const showBar = canReact && (mode === 'both' || mode === 'react');
  const showCard = mode === 'both' || mode === 'more';

  /* The lifted bubble is a copy of the real one's DOM: the same classes and
     text, so it is exactly what was pressed, with none of its handlers. */
  useLayoutEffect(() => {
    if (mode !== 'both' || !cloneRef.current) return;
    const copy = anchor.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-msg-id');
    copy.removeAttribute('data-pressing');
    copy.removeAttribute('tabindex');
    copy.removeAttribute('role');
    copy.style.transform = '';
    copy.style.visibility = '';
    copy.style.transition = '';
    copy.style.width = '100%';
    cloneRef.current.replaceChildren(copy);
  }, [anchor, mode]);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bar = barRef.current?.getBoundingClientRect();
    const card = cardRef.current?.getBoundingClientRect();
    const barW = bar?.width ?? 0;
    const barH = bar?.height ?? 0;
    const cardW = card?.width ?? 0;
    const cardH = card?.height ?? 0;
    const next: Layout = {};

    if (mode === 'both') {
      const above = showBar ? barH + GAP : 0;
      const below = showCard ? cardH + GAP : 0;
      const top = clamp(r.top, EDGE + above, vh - EDGE - below - r.height);
      next.clone = { top, left: r.left, width: r.width, from: r.top - top };
      const sideLeft = (w: number) => clamp(mine ? r.right - w : r.left, EDGE, vw - EDGE - w);
      if (showBar) next.bar = { top: top - GAP - barH, left: sideLeft(barW) };
      if (showCard) next.card = { top: Math.min(top + r.height + GAP, vh - EDGE - cardH), left: sideLeft(cardW) };
    } else {
      const center = r.left + r.width / 2;
      if (showBar) {
        const fitsAbove = r.top - GAP - barH >= EDGE;
        next.bar = {
          top: fitsAbove ? r.top - GAP - barH : r.bottom + GAP,
          left: clamp(center - barW / 2, EDGE, vw - EDGE - barW),
        };
      }
      if (showCard) {
        const fitsBelow = r.bottom + GAP + cardH <= vh - EDGE;
        next.card = {
          top: fitsBelow ? r.bottom + GAP : r.top - GAP - cardH,
          left: clamp(center - cardW / 2, EDGE, vw - EDGE - cardW),
        };
      }
    }
    setLayout(next);
    // Measured once: the card changing size on "Delete?" keeps its corner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (confirming) setConfirming(false);
      else onClose();
    };
    const close = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose, confirming]);

  /* Focus follows the keyboard in, and goes back to the message on the way out. */
  useEffect(() => {
    if (!layout || !keyboard) return;
    const first = (barRef.current ?? cardRef.current)?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
  }, [layout, keyboard]);
  useEffect(() => () => { if (keyboard) anchor.focus({ preventScroll: true }); }, [anchor, keyboard]);

  const surface = dark
    ? 'bg-[#1A1A1F] border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.55)]'
    : 'bg-white border-zinc-200 shadow-[0_12px_40px_rgba(0,0,0,0.16)]';
  const rowText = dark ? 'text-zinc-100' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const rowHover = dark ? 'hover:bg-white/[0.05] active:bg-white/[0.08]' : 'hover:bg-zinc-50 active:bg-zinc-100';
  const origin = mine ? 'right' : 'left';
  const hidden: React.CSSProperties = { top: 0, left: 0, visibility: 'hidden' };

  const act = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <Overlay>
      <div
        className="fixed inset-0 z-[130] font-ui"
        role="dialog"
        aria-modal="true"
        aria-label="Message actions"
        onWheel={onClose}
      >
        <div
          className={`absolute inset-0 ${mode === 'both' ? `chat-scrim ${dark ? 'bg-black/55' : 'bg-black/25'}` : ''}`}
          onPointerDown={e => { e.preventDefault(); onClose(); }}
          onContextMenu={e => e.preventDefault()}
        />

        {mode === 'both' && (
          <div
            ref={cloneRef}
            aria-hidden="true"
            className="fixed pointer-events-none chat-lift"
            style={layout?.clone
              ? {
                  top: layout.clone.top,
                  left: layout.clone.left,
                  width: layout.clone.width,
                  transformOrigin: `${origin} center`,
                  filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.35))',
                  // Starts where the bubble really is and slides to where the menu fits.
                  ['--chat-from' as string]: `${layout.clone.from}px`,
                }
              : hidden}
          />
        )}

        {showBar && (
          <div
            ref={barRef}
            role="group"
            aria-label="React"
            className={`fixed flex items-center gap-0.5 p-1.5 rounded-full border ${surface} ${layout ? 'chat-pop' : ''}`}
            style={layout?.bar ? { ...layout.bar, transformOrigin: `${origin} bottom` } : hidden}
          >
            {REACTIONS.map((emoji, i) => (
              <button
                key={emoji}
                type="button"
                onClick={act(() => onReact(emoji))}
                aria-label={myEmoji === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                aria-pressed={myEmoji === emoji}
                className={`chat-emoji w-10 h-10 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[24px] md:text-[21px] leading-none transition-transform duration-150 hover:scale-[1.22] active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/50 ${myEmoji === emoji ? (dark ? 'bg-white/[0.12]' : 'bg-zinc-100') : ''}`}
                style={{ animationDelay: `${30 + i * 22}ms` }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {showCard && (
          <div
            ref={cardRef}
            className={`fixed w-[220px] rounded-2xl border overflow-hidden ${surface} ${layout ? 'chat-pop' : ''}`}
            style={layout?.card ? { ...layout.card, transformOrigin: `${origin} top` } : hidden}
          >
            {confirming ? (
              <div className="p-3">
                <p className={`text-[13px] font-bold ${rowText}`}>{mine ? 'Delete your message?' : 'Delete for everyone?'}</p>
                <p className={`text-[11px] mt-0.5 ${muted}`}>This can’t be undone.</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className={`flex-1 h-9 rounded-lg text-[12px] font-bold ${dark ? 'bg-white/[0.06] text-zinc-200' : 'bg-zinc-100 text-zinc-800'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={act(onDelete)}
                    className="flex-1 h-9 rounded-lg text-[12px] font-bold bg-[#E10600] text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`px-3.5 pt-2.5 pb-2 border-b ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  <p className={`text-[11px] ${muted}`}>{timeLabel}</p>
                  {reactions.length > 0 && (
                    <p className={`text-[11px] mt-0.5 leading-snug ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {reactions.map(g => `${g.emoji} ${nameList(g.names)}`).join(' · ')}
                    </p>
                  )}
                </div>
                {canReply && mode === 'both' && (
                  <MenuRow label="Reply" onClick={act(onReply)} className={`${rowText} ${rowHover}`} icon={<ReplyIcon />} />
                )}
                <MenuRow label="Copy" onClick={act(onCopy)} className={`${rowText} ${rowHover}`} icon={<CopyIcon />} />
                {canDelete && (
                  <MenuRow label="Delete" onClick={() => setConfirming(true)} className={`text-[#E10600] ${rowHover}`} icon={<TrashIcon />} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Overlay>
  );
};

const MenuRow = ({ label, icon, onClick, className }: { label: string; icon: React.ReactNode; onClick: () => void; className: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full h-11 px-3.5 flex items-center justify-between text-[14px] font-medium outline-none focus-visible:bg-[#E10600]/10 transition-colors ${className}`}
  >
    {label}
    <span aria-hidden="true" className="opacity-80">{icon}</span>
  </button>
);

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const ReplyIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...svg} width={size} height={size}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);
export const SmileIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...svg} width={size} height={size}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.6} /></svg>
);
export const DotsIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={2.8}><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
);
const CopyIcon = () => (
  <svg {...svg}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
);
const TrashIcon = () => (
  <svg {...svg}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);

export default MessageMenu;
