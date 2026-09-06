import React from 'react';
import { ScheduleBlock } from '../types';
import { ACTIVITIES, blockStyle, blockTitle, countsAsStudy } from './colors';
import { formatRange } from './schedule';

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
  const c = blockStyle(block);

  const start = preview ? preview.start : block.start;
  const duration = preview ? preview.durationMins : block.durationMins;

  const top = (start / 60) * pxPerHour;
  /* A floor in pixels as well as in minutes: a 10-minute block at 46px/hr is
     8px tall, which is not a target anyone can hit or read. */
  const height = Math.max(24, (duration / 60) * pxPerHour);
  const laneWidth = 100 / lanes;

  /* Two 10px handles inside a 44px block leave 24px of body to grab. Below
     that the whole card is the move target and the edges are given up. */
  const showHandles = !readOnly && height >= 44;

  const title = blockTitle(block);
  const isStudy = countsAsStudy(block.kind);
  /* The subtitle is whatever the title didn't already say. */
  const sub = isStudy ? block.chapter : (block.label ? ACTIVITIES[block.kind].label : null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title}${sub ? `, ${sub}` : ''}, ${formatRange(start, duration)}${readOnly ? ', past day, locked' : ''}`}
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
      className={`group rounded-md border px-2.5 py-1.5 overflow-hidden select-none text-left transition-colors
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

      <div className="flex items-center gap-1.5 pointer-events-none">
        <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui truncate ${dark ? c.text : c.textLight}`}>
          {title}
        </span>
        {recurring && <span className={`text-[9px] shrink-0 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`} title="Repeats weekly">↻</span>}
        {moved && <span className={`text-[8px] font-bold uppercase tracking-[0.06em] shrink-0 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Moved</span>}
      </div>

      {height >= 36 && (
        <div className={`text-[10px] tabular-nums truncate pointer-events-none font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {formatRange(start, duration)}
        </div>
      )}
      {height >= 58 && sub && (
        <div className={`text-[10px] truncate pointer-events-none font-ui mt-0.5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {sub}
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
