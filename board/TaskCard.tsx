import React from 'react';
import { Subject, Task, TaskColumn } from '../types';
import { BlockStyle } from '../schedule/colors';
import { dueLabel, dueState, taskStyle } from './board';

interface Props {
  task: Task;
  theme: 'dark' | 'light';
  today: string;
  /** Has a block on today's plan. */
  scheduled: boolean;
  dragging: boolean;
  /** The one-time "tap to edit" affordance label. */
  showHint: boolean;
  onOpen: (task: Task) => void;
  onDragStart: (e: React.PointerEvent, id: string, column: TaskColumn) => void;
  onKeyMove: (e: React.KeyboardEvent, task: Task) => void;
}

/**
 * One card.
 *
 * Every colour is an inline `style`, never a Tailwind class. Tailwind here is
 * the CDN script with no config, so `bg-[${hex}]` in a template literal
 * compiles to nothing — the same constraint the Plan grid works under.
 *
 * `contain: layout paint` so a card repainting cannot invalidate its column,
 * and `touchAction: none` because without it the browser claims the gesture and
 * dragging on a phone does not work at all.
 */
const TaskCard: React.FC<Props> = ({
  task, theme, today, scheduled, dragging, showHint, onOpen, onDragStart, onKeyMove,
}) => {
  const dark = theme === 'dark';
  const c: BlockStyle = taskStyle(task);
  const due = dueLabel(task, today);
  const state = dueState(task, today);
  const overdue = state === 'overdue';
  const done = task.completed;

  return (
    <div
      data-card-id={task.id}
      role="button"
      tabIndex={0}
      aria-label={`${task.text}${due ? `, ${due.toLowerCase()}` : ''}`}
      onPointerDown={e => onDragStart(e, task.id, task.column ?? 'todo')}
      onClick={() => onOpen(task)}
      onKeyDown={e => onKeyMove(e, task)}
      className={`group relative w-full text-left rounded-lg border overflow-hidden select-none transition-shadow ${dragging ? 'shadow-2xl' : 'card-interactive'}`}
      style={{
        background: dark ? c.bg : c.bgLight,
        borderColor: dark ? c.border : c.borderLight,
        opacity: done ? 0.45 : 1,
        touchAction: 'none',
        contain: 'layout paint',
        cursor: 'grab',
      }}
    >
      {/* The colour, as an edge rather than a fill. A card is mostly text and
          has to stay readable; a 3px rule identifies it without competing. */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: c.dot }}
      />

      {/* Padding and type step down on a phone. Three columns on a 375px screen
          leaves each card around 90px of text, so the desktop spacing would
          spend a third of that on air. */}
      <div className="pl-2.5 pr-2 py-2 md:pl-4 md:pr-3 md:py-3">
        <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
          <span
            className="text-[7px] md:text-[8px] font-medium uppercase tracking-[0.06em] font-ui truncate"
            style={{ color: dark ? c.text : c.textLight }}
          >
            {task.subject ?? 'General'}
          </span>
          {scheduled && (
            /* On today's timeline. A glyph rather than a word: the card is
               already carrying a subject and possibly a due date. */
            <span className="text-[8px] md:text-[9px] leading-none opacity-60 flex-shrink-0" title="On today’s plan" aria-label="On today’s plan">🕑</span>
          )}
        </div>

        {/* Three columns on a phone leaves roughly 70px of text, and a real
            chapter name — THERMODYNAMICS measures 96px here — cannot be made to
            fit by any amount of padding or type tuning. So long words WILL
            break mid-word, and the two rules below decide how badly.

            `break-words` is the guarantee: without it a long unbroken word
            pushes the card past its column and the whole row overflows.
            `hyphens-auto` is best-effort on top — where the browser has a
            hyphenation dictionary it turns "INTEGRATI ON" into "INTEGRA-TION",
            and where it does not (Chromium often declines on uppercased text)
            nothing changes and break-words still holds the layout. It costs one
            class and is never worse. */}
        <p className={`text-[10px] md:text-[11px] leading-snug font-bold uppercase tracking-tight break-words hyphens-auto font-ui ${done ? 'line-through' : ''} ${dark ? 'text-white' : 'text-[#17150F]'}`}>
          {task.text}
        </p>

        {/* The deadline and the edit hint share a footer row: deadline on the
            left, hint pushed to the right by `ml-auto`.

            `flex-wrap` is doing real work here rather than being defensive. On
            a phone the card is about 80px wide and "DUE TOMORROW" plus "TAP TO
            EDIT" needs well over that, so the hint wraps onto its own line —
            and `ml-auto` still holds it to the right edge there, so it reads as
            the same corner label at every width instead of jumping to the left
            the moment the card gets narrow. */}
        {/* Guarded as a pair: once the hint retires, a card with no deadline has
            nothing left for this row, and an empty flex container would still
            leave its top margin behind as a stray gap under the title. */}
        {(due || showHint) && (
        <div className="flex flex-wrap items-baseline gap-x-2 mt-1 md:mt-1.5">
          {due && (
            <p
              className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.06em] font-ui"
              style={{
                /* The only escalation on the card, and only once it is true.
                   Everything else stays a calm label. */
                color: overdue ? '#E10600' : dark ? '#71717a' : '#8A8577',
              }}
            >
              {due}
            </p>
          )}

          {/* Shown until the user opens their first card, then gone for good —
              see HINT_KEY in TaskBoard. Nothing about a card said it opened, so
              people treated the board as drag-only and never found the subject,
              colour and deadline behind it; once they have been in once, a
              standing instruction on every card is just scaffolding nobody took
              down. The quietest thing on the card while it lasts, and it
              brightens on hover where there is a pointer to hover with.

              `aria-hidden` because the row is already `role="button"`: a screen
              reader announces it as activatable, and reading "tap to edit"
              after every task name would be noise. */}
          {showHint && (
            <p
              aria-hidden="true"
              className={`ml-auto text-[7px] md:text-[8px] font-medium uppercase tracking-[0.08em] font-ui transition-opacity opacity-45 md:group-hover:opacity-80 ${dark ? 'text-zinc-400' : 'text-[#8A8577]'}`}
            >
              <span className="md:hidden">Tap to edit</span>
              <span className="hidden md:inline">Click to edit</span>
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

/* Memoised because the Today tab re-renders ten times a second while a
   stopwatch is running (today/TodayTab.tsx runs a 100ms interval), and a board
   full of cards re-rendering at that rate on a mid-range phone is exactly the
   cost this feature must not add. The parent passes stable callbacks so this
   actually holds. */
export default React.memo(TaskCard);
