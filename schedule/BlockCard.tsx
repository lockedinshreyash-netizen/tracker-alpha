import React from 'react';
import { ScheduleBlock } from '../types';
import { BLOCK_KIND_LABELS, subjectStyle } from './colors';
import { formatClock, formatSpan } from './schedule';

interface Props {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
  pxPerHour: number;
  theme: 'dark' | 'light';
  /** Live geometry while this block is under the pointer, else its stored one. */
  preview?: { start: number; durationMins: number } | null;
  dragging: boolean;
  clashing: boolean;
  /** A materialized instance of a weekly rule rather than a one-off. */
  recurring: boolean;
  /** …and moved off what the template says for this date. */
  moved: boolean;
  readOnly: boolean;
  running: boolean;
  onPointerDown: (e: React.PointerEvent, mode: 'move' | 'resize-start' | 'resize-end') => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onOpen: () => void;
}

/**
 * One block on the grid.
 *
 * Purely presentational — every gesture is handed in by DayTimeline, which is
 * the only thing that knows where the grid is on screen.
 *
 * All geometry is inline style, never a Tailwind class. Tailwind here is the
 * CDN script with no config and no JIT over template literals, so `h-[${n}px]`
 * would compile to nothing at all.
 */
const BlockCard: React.FC<Props> = ({
  block, lane, lanes, pxPerHour, theme, preview, dragging, clashing,
  recurring, moved, readOnly, running, onPointerDown, onKeyDown, onOpen,
}) => {
  const dark = theme === 'dark';
  const c = subjectStyle(block.subject);

  const start = preview ? preview.start : block.start;
  const duration = preview ? preview.durationMins : block.durationMins;

  const top = (start / 60) * pxPerHour;
  /* A floor in pixels as well as in minutes: a 10-minute block at 48px/hr is
     8px tall, which is not a target anyone can hit or read. */
  const height = Math.max(24, (duration / 60) * pxPerHour);
  const laneWidth = 100 / lanes;

  /* Two 12px handles inside a 44px block leave 20px of body to grab. Below
     that the whole card is the move target and the top edge is given up. */
  const showHandles = !readOnly && height >= 44;

  const label = block.chapter || block.label || BLOCK_KIND_LABELS[block.kind];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${block.subject}${block.chapter ? `, ${block.chapter}` : ''}, ${formatClock(start)} to ${formatClock(start + duration)}${readOnly ? ', past day, locked' : ''}`}
      onKeyDown={onKeyDown}
      onPointerDown={e => !readOnly && onPointerDown(e, 'move')}
      onClick={onOpen}
      style={{
        position: 'absolute',
        top,
        height,
        left: `calc(${lane * laneWidth}% + 2px)`,
        width: `calc(${laneWidth}% - 4px)`,
        pointerEvents: 'auto',
        touchAction: readOnly ? undefined : 'none',
        cursor: readOnly ? 'pointer' : dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 40 : 10 + lane,
        /* Only when nothing is being dragged — a transition on the element
           under the finger reads as lag, not polish. */
        transition: dragging ? undefined : 'top 120ms ease, height 120ms ease',
      }}
      className={`group rounded-md border px-2 py-1 overflow-hidden select-none text-left
        ${dark ? `${c.bg} ${c.border}` : `${c.bgLight} ${c.borderLight}`}
        ${dragging ? 'shadow-2xl ring-1 ring-white/20' : ''}
        ${clashing ? 'ring-1 ring-[#E10600]' : ''}
        ${running ? 'ring-2 ring-[#E10600]' : ''}`}
    >
      {showHandles && (
        <div
          onPointerDown={e => { e.stopPropagation(); onPointerDown(e, 'resize-start'); }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, cursor: 'ns-resize', touchAction: 'none' }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className={`mx-auto mt-[3px] h-[2px] w-8 rounded-full ${dark ? 'bg-white/30' : 'bg-black/20'}`} />
        </div>
      )}

      <div className="flex items-baseline gap-1.5 pointer-events-none">
        <span className={`font-ui text-[11px] font-bold uppercase tracking-wide truncate ${dark ? c.text : c.textLight}`}>
          {block.subject}
        </span>
        {recurring && (
          <span className={`text-[9px] ${dark ? 'text-white/40' : 'text-black/35'}`} title="From the weekly template">↻</span>
        )}
        {moved && (
          <span className={`text-[8px] font-bold tracking-wider ${dark ? 'text-white/35' : 'text-black/35'}`}>MOVED</span>
        )}
      </div>

      {height >= 34 && (
        <div className={`font-ui text-[10px] truncate pointer-events-none ${dark ? 'text-white/45' : 'text-black/45'}`}>
          {formatClock(start)}–{formatClock(start + duration)} · {formatSpan(duration)}
        </div>
      )}
      {height >= 56 && label && (
        <div className={`font-ui text-[10px] mt-0.5 truncate pointer-events-none ${dark ? 'text-white/35' : 'text-black/40'}`}>
          {label}
        </div>
      )}

      {showHandles && (
        <div
          onPointerDown={e => { e.stopPropagation(); onPointerDown(e, 'resize-end'); }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, cursor: 'ns-resize', touchAction: 'none' }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className={`mx-auto mt-[5px] h-[2px] w-8 rounded-full ${dark ? 'bg-white/30' : 'bg-black/20'}`} />
        </div>
      )}
    </div>
  );
};

export default BlockCard;
