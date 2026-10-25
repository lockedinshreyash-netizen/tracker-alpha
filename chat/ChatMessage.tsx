/* ── One chat message, with the gestures people already know ──
   Shared by group chat and race chat. The caller draws what is inside the
   bubble (a quote, the text) and above it (a name); this owns everything a
   finger or a mouse does to it:

     · swipe right (touch)      → reply. The bubble follows the finger 1:1 up
                                  to the trigger, then resists; a tick of
                                  haptics says "let go now".
     · long press (touch)       → the menu: emoji bar above, Reply · Copy ·
                                  Delete below (MessageMenu, mode both).
     · double tap / double click → ❤️, with a heart blooming over the bubble.
     · hover (mouse)            → ↩ 😊 ⋯ beside the bubble, in front of it
                                  rather than under it, as on Instagram web.
     · right click / Enter      → the same menu as a long press.

   A gesture never re-renders React: the swipe writes `transform` straight to
   the bubble and its arrow, and the press state is a data attribute. Only
   opening the menu and the heart are state. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import MessageMenu, { DotsIcon, MenuMode, ReplyIcon, SmileIcon } from './MessageMenu';
import { QUICK_REACTION, ReactionGroup, nameList } from './reactions';
import { pushToast } from '../notify/toastBus';
import './chat.css';

interface Props {
  id: string | number;
  mine: boolean;
  dark: boolean;
  /** Reactions and replies are possible on this message (schema has them, it is live and sent). */
  interactive: boolean;
  canDelete: boolean;
  /** Colours of the bubble itself. */
  bubbleClass: string;
  /** Row spacing. */
  className?: string;
  flash?: boolean;
  /** Arrived after the thread opened: rises in. */
  animateIn?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  reactions: ReactionGroup[];
  reactionBusy: boolean;
  timeLabel: string;
  copyText: string;
  ariaLabel?: string;
  children: React.ReactNode;
  /** Toggle: the same emoji again takes it back, another switches. */
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
}

const SWIPE_START_PX = 10;
const SWIPE_TRIGGER_PX = 64;
const SWIPE_MAX_PX = 96;
const LONG_PRESS_MS = 420;
const PRESS_FEEDBACK_MS = 110;
const MOVE_CANCEL_PX = 8;
const DOUBLE_TAP_MS = 300;
const SPRING = 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.25)';

const buzz = (ms: number) => {
  try { navigator.vibrate?.(ms); } catch { /* not a phone, or not allowed */ }
};

interface Gesture {
  x: number;
  y: number;
  id: number;
  mode: 'idle' | 'swipe' | 'done';
  armed: boolean;
}

const ChatMessage = ({
  id, mine, dark, interactive, canDelete, bubbleClass, className = '', flash, animateIn,
  header, footer, reactions, reactionBusy, timeLabel, copyText, ariaLabel, children,
  onReact, onReply, onDelete,
}: Props) => {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const lastTapRef = useRef(0);
  const [menu, setMenu] = useState<{ mode: MenuMode; anchor: HTMLElement; keyboard: boolean } | null>(null);
  const [burst, setBurst] = useState(0);
  const myEmoji = reactions.find(g => g.mine)?.emoji ?? null;

  const clearPress = () => {
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(feedbackTimer.current);
    if (bubbleRef.current) delete bubbleRef.current.dataset.pressing;
  };
  useEffect(() => clearPress, []);

  const openMenu = useCallback((mode: MenuMode, anchor: HTMLElement | null, keyboard = false) => {
    if (anchor) setMenu({ mode, anchor, keyboard });
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  /* Writes the swipe straight to the DOM. `dx` 0 springs home. */
  const paint = (dx: number, armed: boolean) => {
    const el = bubbleRef.current;
    const arrow = arrowRef.current;
    if (el) {
      el.style.transition = dx ? 'none' : SPRING;
      el.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : '';
    }
    if (arrow) {
      const p = Math.min(1, dx / SWIPE_TRIGGER_PX);
      arrow.style.transition = dx ? 'none' : 'opacity 200ms, transform 200ms';
      arrow.style.opacity = String(p);
      arrow.style.transform = `translateY(-50%) translateX(${dx * 0.35}px) scale(${armed ? 1.15 : 0.6 + p * 0.4})`;
      arrow.style.color = armed ? '#E10600' : '';
    }
  };

  const quickReact = () => {
    setBurst(b => b + 1);
    buzz(8);
    if (myEmoji !== QUICK_REACTION) onReact(QUICK_REACTION);
  };

  /* ── Touch ── */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    if (!interactive || e.pointerType === 'mouse' || e.button !== 0) return;
    gestureRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'idle', armed: false };
    const el = e.currentTarget;
    feedbackTimer.current = window.setTimeout(() => { el.dataset.pressing = 'true'; }, PRESS_FEEDBACK_MS);
    pressTimer.current = window.setTimeout(() => {
      const g = gestureRef.current;
      if (!g || g.mode !== 'idle') return;
      g.mode = 'done';
      clearPress();
      suppressClickRef.current = true;
      buzz(12);
      openMenu('both', el);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id || g.mode === 'done') return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (g.mode === 'idle') {
      if (Math.abs(my) > MOVE_CANCEL_PX || mx < -MOVE_CANCEL_PX) {
        clearPress();
        gestureRef.current = null;
        return;
      }
      if (mx < SWIPE_START_PX || Math.abs(mx) < Math.abs(my)) return;
      clearPress();
      g.mode = 'swipe';
    }
    const d = mx - SWIPE_START_PX;
    // 1:1 to the trigger, then a third as far: the bubble resists, it doesn't stop dead.
    const dx = Math.max(0, Math.min(d <= SWIPE_TRIGGER_PX ? d : SWIPE_TRIGGER_PX + (d - SWIPE_TRIGGER_PX) * 0.3, SWIPE_MAX_PX));
    const armed = d >= SWIPE_TRIGGER_PX;
    if (armed && !g.armed) buzz(8);
    g.armed = armed;
    paint(dx, armed);
  };

  const endGesture = (commit: boolean) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    clearPress();
    if (g?.mode === 'swipe') {
      suppressClickRef.current = true;
      if (commit && g.armed) onReply();
      paint(0, false);
    }
  };

  /* ── Taps and clicks ── one tap does nothing (as in WhatsApp); two are ❤️. */
  const onClick = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (!interactive) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      quickReact();
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <div
      data-msg-id={id}
      className={`chat-row flex ${mine ? 'justify-end' : 'justify-start'} ${reactions.length ? 'mb-2' : ''} ${className}`}
    >
      <div className={`max-w-[85%] md:max-w-[70%] min-w-0 flex flex-col ${mine ? 'items-end' : 'items-start'} ${animateIn ? 'chat-in' : ''}`}>
        {header}

        <div className="relative max-w-full">
          {interactive && (
            <span
              ref={arrowRef}
              aria-hidden="true"
              className={`absolute top-1/2 w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}
              style={{ left: -34, opacity: 0, transform: 'translateY(-50%) scale(0.6)' }}
            >
              <ReplyIcon size={15} />
            </span>
          )}

          <div
            ref={bubbleRef}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-haspopup={interactive ? 'dialog' : undefined}
            aria-label={ariaLabel}
            title={timeLabel}
            onClick={onClick}
            onMouseDown={e => { if (interactive && e.detail > 1) e.preventDefault(); }}
            onKeyDown={e => {
              if (!interactive || e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ContextMenu') {
                e.preventDefault();
                openMenu('both', e.currentTarget, true);
              }
            }}
            onContextMenu={e => {
              if (!interactive) return;
              e.preventDefault();
              // On Android a long press also fires this; the timer has usually got there first.
              if (menu) return;
              clearPress();
              if (gestureRef.current) {
                gestureRef.current.mode = 'done';
                suppressClickRef.current = true;
                buzz(12);
              }
              openMenu('both', e.currentTarget);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => endGesture(true)}
            onPointerCancel={() => endGesture(false)}
            className={`chat-bubble relative text-left px-3.5 py-2 rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40 ${mine ? 'rounded-br-md' : 'rounded-bl-md'} ${bubbleClass} ${interactive ? 'cursor-default' : ''} ${flash ? 'ring-2 ring-[#E10600]/50' : ''}`}
            style={{
              touchAction: interactive ? 'pan-y' : undefined,
              transition: 'box-shadow 300ms',
              visibility: menu?.mode === 'both' ? 'hidden' : undefined,
            }}
          >
            {children}
          </div>

          {burst > 0 && (
            <span
              key={burst}
              aria-hidden="true"
              className="chat-burst absolute left-1/2 top-1/2 pointer-events-none text-[40px] leading-none"
              style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }}
              onAnimationEnd={() => setBurst(0)}
            >
              {QUICK_REACTION}
            </span>
          )}

          {interactive && (
            <div
              className={`chat-strip absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 ${mine ? 'right-full mr-1.5 flex-row-reverse' : 'left-full ml-1.5'}`}
              data-open={menu && menu.mode !== 'both' ? 'true' : undefined}
            >
              <StripButton dark={dark} label="React" onClick={e => openMenu('react', e.currentTarget)}><SmileIcon /></StripButton>
              <StripButton dark={dark} label="Reply" onClick={() => onReply()}><ReplyIcon /></StripButton>
              <StripButton dark={dark} label="More" onClick={e => openMenu('more', e.currentTarget)}><DotsIcon /></StripButton>
            </div>
          )}
        </div>

        <ReactionChips groups={reactions} mine={mine} busy={reactionBusy} dark={dark} onReact={onReact} />
        {footer}
      </div>

      {menu && (
        <MessageMenu
          anchor={menu.anchor}
          mode={menu.mode}
          mine={mine}
          dark={dark}
          keyboard={menu.keyboard}
          myEmoji={myEmoji}
          reactions={reactions}
          timeLabel={timeLabel}
          canReact={interactive}
          canReply={interactive}
          canDelete={canDelete}
          onReact={onReact}
          onReply={onReply}
          onCopy={() => {
            navigator.clipboard?.writeText(copyText)
              .then(() => pushToast({ id: 'chat-copied', title: 'Copied', tone: 'neutral', ttlMs: 1600 }))
              .catch(() => {});
          }}
          onDelete={onDelete}
          onClose={closeMenu}
        />
      )}
    </div>
  );
};

const StripButton = ({ dark, label, onClick, children }: {
  dark: boolean;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40 ${dark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100'}`}
  >
    {children}
  </button>
);

/** The chips that hang off a bubble's bottom edge. Tap one to add or take back yours. */
export const ReactionChips = ({ groups, mine, busy, dark, onReact }: {
  groups: ReactionGroup[];
  mine: boolean;
  busy: boolean;
  dark: boolean;
  onReact: (emoji: string) => void;
}) => {
  if (!groups.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 -mt-2 px-2 relative ${mine ? 'justify-end' : 'justify-start'}`}>
      {groups.map(g => (
        <button
          key={g.emoji}
          type="button"
          disabled={busy}
          onClick={() => onReact(g.emoji)}
          title={nameList(g.names)}
          aria-label={`${g.emoji} ${g.count}: ${nameList(g.names)}. ${g.mine ? 'Tap to remove yours.' : 'Tap to react with this.'}`}
          aria-pressed={g.mine}
          className={`chat-pop h-6 px-1.5 rounded-full border flex items-center gap-1 text-[12px] leading-none shadow-sm transition-transform active:scale-[0.9] ${
            g.mine
              ? 'border-[#E10600]/50 bg-[#E10600]/15'
              : dark ? 'border-white/[0.08] bg-[#17171B]' : 'border-zinc-200 bg-white'
          } ${busy ? 'opacity-70' : ''}`}
        >
          <span aria-hidden="true">{g.emoji}</span>
          {g.count > 1 && <span className={`text-[10px] font-bold font-ui ${g.mine ? 'text-[#E10600]' : dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{g.count}</span>}
        </button>
      ))}
    </div>
  );
};

export default ChatMessage;
