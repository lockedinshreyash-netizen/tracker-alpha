import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayMinute, ScheduleBlock } from '../types';
import BlockCard from './BlockCard';
import {
  DAY_MINUTES, MIDNIGHT_MINUTE, SNAP_MINS, clampBlock, clashesWith,
  formatClock, layoutDay, snap,
} from './schedule';

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  pointerId: number;
  mode: DragMode;
  id: string;
  /** Read once at pointerdown — getBoundingClientRect per frame forces layout. */
  gridTop: number;
  baseScrollTop: number;
  originY: number;
  baseStart: DayMinute;
  baseDuration: number;
  moved: boolean;
}

interface Props {
  blocks: ScheduleBlock[];
  theme: 'dark' | 'light';
  /** Where "now" sits, or null when the viewed day is not today. */
  minute: DayMinute | null;
  /** Past days are locked: editing yesterday would falsify its adherence. */
  readOnly: boolean;
  runningBlockId?: string;
  onCommit: (id: string, patch: { start: DayMinute; durationMins: number }) => void;
  onOpen: (block: ScheduleBlock) => void;
  onCreateAt: (start: DayMinute) => void;
  onDelete: (block: ScheduleBlock) => void;
  isRecurring: (id: string) => boolean;
  isMoved: (id: string) => boolean;
}

const DRAG_THRESHOLD_PX = 4;
const AUTOSCROLL_EDGE_PX = 44;
const AUTOSCROLL_STEP_PX = 9;

/**
 * The day grid.
 *
 * Two rules shape everything here.
 *
 * The axis runs 04:00 → 03:59, not midnight to midnight, because that is what
 * a study day is (DAY_START_HOUR, utils.ts). A block at 01:00 belongs to the
 * day you started, so it lives at the bottom of this grid rather than the top
 * of tomorrow's.
 *
 * And a gesture never touches AppState. Every state change in this app writes
 * localStorage and fires a Supabase upsert (App.tsx), so committing per frame
 * would mean sixty network writes per drag. The live geometry lives in
 * `preview`, and the mutator is called exactly once, on release.
 */
const DayTimeline: React.FC<Props> = ({
  blocks, theme, minute, readOnly, runningBlockId,
  onCommit, onOpen, onCreateAt, onDelete, isRecurring, isMoved,
}) => {
  const dark = theme === 'dark';
  const [pxPerHour, setPxPerHour] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 52 : 66);
  const [preview, setPreview] = useState<{ id: string; start: number; durationMins: number } | null>(null);
  /* A gesture begins in a ref, which cannot wake an effect — this is the bit
     of state whose only job is to get the window listeners attached. */
  const [gesture, setGesture] = useState<number | null>(null);

  const dragRef = useRef<DragState | null>(null);
  /* The commit reads this rather than the state value, so the listener does
     not have to be torn down and rebound on every frame of a drag. */
  const previewRef = useRef<{ id: string; start: number; durationMins: number } | null>(null);
  /* A pointerup that ends a drag is still followed by a click, and that click
     would open the editor on top of the block you just moved. */
  const suppressClickRef = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const pointerYRef = useRef(0);

  useEffect(() => { previewRef.current = preview; }, [preview]);

  const laid = useMemo(() => layoutDay(blocks), [blocks]);
  const clashing = useMemo(() => {
    const ids = new Set<string>();
    for (const b of blocks) if (clashesWith(b, blocks).length > 0) ids.add(b.id);
    return ids;
  }, [blocks]);

  const gridHeight = (DAY_MINUTES / 60) * pxPerHour;

  /* Land on the part of the day the user is actually in. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = minute === null ? 4 * 60 : Math.max(0, minute - 60);
    el.scrollTop = (target / 60) * pxPerHour;
    // Only on mount and when the day changes — not on every zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute === null]);

  const stopAutoScroll = () => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  /**
   * Dragging to 22:00 on a phone means dragging past the bottom of a 600px
   * viewport holding a 1500px grid. Without this the gesture simply cannot
   * reach.
   */
  const runAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    const d = dragRef.current;
    if (!el || !d) { stopAutoScroll(); return; }
    const rect = el.getBoundingClientRect();
    const y = pointerYRef.current;
    let dy = 0;
    if (y < rect.top + AUTOSCROLL_EDGE_PX) dy = -AUTOSCROLL_STEP_PX;
    else if (y > rect.bottom - AUTOSCROLL_EDGE_PX) dy = AUTOSCROLL_STEP_PX;
    if (dy !== 0) {
      const before = el.scrollTop;
      el.scrollTop = Math.max(0, Math.min(gridHeight, el.scrollTop + dy));
      if (el.scrollTop !== before) applyDrag();
    }
    autoScrollRef.current = requestAnimationFrame(runAutoScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridHeight]);

  /** Recompute the preview from the last known pointer position. */
  const applyDrag = useCallback(() => {
    const d = dragRef.current;
    const scroller = scrollRef.current;
    if (!d || !scroller) return;

    const y = pointerYRef.current - d.gridTop + (scroller.scrollTop - d.baseScrollTop);
    const deltaMins = snap(((y - d.originY) / pxPerHour) * 60);

    let start = d.baseStart;
    let durationMins = d.baseDuration;

    if (d.mode === 'move') {
      start = d.baseStart + deltaMins;
    } else if (d.mode === 'resize-end') {
      durationMins = d.baseDuration + deltaMins;
    } else {
      /* Only the grabbed edge moves; the far edge stays exactly where it is. */
      const end = d.baseStart + d.baseDuration;
      start = Math.min(end - 10, d.baseStart + deltaMins);
      durationMins = end - start;
    }

    setPreview({ id: d.id, ...clampBlock(start, durationMins) });
  }, [pxPerHour]);

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode, block: ScheduleBlock) => {
    if (readOnly) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const grid = gridRef.current;
    const scroller = scrollRef.current;
    if (!grid || !scroller) return;

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const gridTop = grid.getBoundingClientRect().top;
    pointerYRef.current = e.clientY;
    dragRef.current = {
      pointerId: e.pointerId,
      mode,
      id: block.id,
      gridTop,
      baseScrollTop: scroller.scrollTop,
      originY: e.clientY - gridTop,
      baseStart: block.start,
      baseDuration: block.durationMins,
      moved: false,
    };
    setGesture(e.pointerId);
    /* Kills the text-selection drag and, on touch, the browser's own
       interpretation of the gesture. */
    e.preventDefault();
  };

  /**
   * Move and release are bound to the window, not to the card.
   *
   * setPointerCapture routes captured events back to the element that claimed
   * them, so a handler on any other element — an overlay, the grid — would
   * simply never fire. The window sees them either way, and it also catches a
   * pointerup that lands outside the document body.
   */
  useEffect(() => {
    if (gesture === null) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      pointerYRef.current = e.clientY;
      if (!d.moved) {
        const scroller = scrollRef.current;
        const y = e.clientY - d.gridTop + ((scroller?.scrollTop ?? 0) - d.baseScrollTop);
        if (Math.abs(y - d.originY) < DRAG_THRESHOLD_PX) return;
        d.moved = true;
        if (autoScrollRef.current === null) autoScrollRef.current = requestAnimationFrame(runAutoScroll);
      }
      applyDrag();
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      stopAutoScroll();
      /* One write per gesture, and only if it actually was one — a tap never
         reaches here with `moved` set, and falls through to onClick. */
      const p = previewRef.current;
      if (d.moved) {
        suppressClickRef.current = true;
        if (p && p.id === d.id) onCommit(d.id, { start: p.start, durationMins: p.durationMins });
      }
      dragRef.current = null;
      setPreview(null);
      setGesture(null);
    };

    /* A cancelled gesture — the tab backgrounded, the OS taking over — must
       leave the block exactly where it started, not half-moved. */
    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      stopAutoScroll();
      dragRef.current = null;
      setPreview(null);
      setGesture(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [gesture, applyDrag, runAutoScroll, onCommit]);

  useEffect(() => stopAutoScroll, []);

  /**
   * Everything the pointer can do, without one.
   *
   * This is the accessibility path and the precision path at once — a keypress
   * is already a discrete intent, so it commits directly with no preview.
   */
  const handleKeyDown = (e: React.KeyboardEvent, block: ScheduleBlock) => {
    if (readOnly) return;
    const step = e.shiftKey ? 60 : SNAP_MINS;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = e.altKey
        ? clampBlock(block.start, block.durationMins + dir * step)
        : clampBlock(block.start + dir * step, block.durationMins);
      onCommit(block.id, next);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(block);
    }
  };

  const hourRows = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={`font-ui text-[10px] uppercase tracking-[0.18em] ${dark ? 'text-white/35' : 'text-black/40'}`}>
          {readOnly ? 'LOCKED — THE DAY IS SPENT' : 'DRAG TO MOVE · EDGES TO RESIZE'}
        </p>
        <div className={`inline-flex rounded-md border overflow-hidden ${dark ? 'border-white/[0.08]' : 'border-[#E3E0D9]'}`}>
          {[46, 66, 96].map(z => (
            <button
              key={z}
              onClick={() => setPxPerHour(z)}
              className={`px-2.5 py-1 font-ui text-[10px] font-bold tracking-wider transition-colors ${
                pxPerHour === z
                  ? 'bg-[#E10600] text-white'
                  : dark ? 'text-white/45 hover:text-white/80' : 'text-black/45 hover:text-black/80'
              }`}
            >
              {z === 46 ? 'S' : z === 66 ? 'M' : 'L'}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`relative rounded-lg border overflow-y-auto overflow-x-hidden ${dark ? 'border-white/[0.06] bg-[#0D0D10]' : 'border-[#E3E0D9] bg-[#FAF9F6]'}`}
        style={{ maxHeight: 'min(66vh, 760px)' }}
      >
        <div ref={gridRef} className="relative" style={{ height: gridHeight }}>
          {/* Hour rules and the gutter. The gutter keeps its own touch-action
              so the grid can still be scrolled by dragging the labels. */}
          {hourRows.map(i => {
            const m = i * 60;
            const isMidnight = m === MIDNIGHT_MINUTE;
            return (
              <div
                key={i}
                style={{ position: 'absolute', top: (m / 60) * pxPerHour, left: 0, right: 0, height: pxPerHour }}
                className="pointer-events-none"
              >
                <div className={`absolute inset-x-0 top-0 border-t ${
                  isMidnight
                    ? dark ? 'border-white/20' : 'border-black/20'
                    : dark ? 'border-white/[0.05]' : 'border-black/[0.05]'
                }`} />
                <span className={`absolute left-2 top-0.5 font-ui text-[9px] tabular-nums ${
                  isMidnight
                    ? dark ? 'text-white/60 font-bold' : 'text-black/60 font-bold'
                    : dark ? 'text-white/25' : 'text-black/30'
                }`}>
                  {isMidnight ? 'MIDNIGHT' : formatClock(m)}
                </span>
              </div>
            );
          })}

          {/* Tap an empty stretch to plan something there. */}
          <div
            className="absolute inset-y-0"
            style={{ left: 56, right: 0 }}
            onClick={e => {
              if (readOnly || dragRef.current) return;
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              const grid = gridRef.current;
              if (!grid) return;
              const y = e.clientY - grid.getBoundingClientRect().top;
              onCreateAt(clampBlock(snap((y / pxPerHour) * 60, 30), 60).start);
            }}
          />

          {/* Transparent to the pointer so a tap on empty space falls through
              to the create surface below; each card turns it back on. */}
          <div className="absolute inset-y-0 pointer-events-none" style={{ left: 56, right: 6 }}>
            {laid.map(({ block, lane, lanes }) => (
              <BlockCard
                key={block.id}
                block={block}
                lane={lane}
                lanes={lanes}
                pxPerHour={pxPerHour}
                theme={theme}
                preview={preview && preview.id === block.id ? preview : null}
                dragging={preview?.id === block.id}
                clashing={clashing.has(block.id)}
                recurring={isRecurring(block.id)}
                moved={isMoved(block.id)}
                readOnly={readOnly}
                running={runningBlockId === block.id}
                onPointerDown={(e, mode) => handlePointerDown(e, mode, block)}
                onKeyDown={e => handleKeyDown(e, block)}
                onOpen={() => {
                  if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                  if (!dragRef.current) onOpen(block);
                }}
              />
            ))}
          </div>

          {/* Now. Accent red is reserved for this and for actions — no subject
              is allowed to wear it. */}
          {minute !== null && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-30"
              style={{ top: (minute / 60) * pxPerHour }}
            >
              <div className="h-[1.5px] bg-[#E10600]" />
              <div className="absolute -top-[3px] left-0 w-2 h-2 rounded-full bg-[#E10600] plan-now-dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTimeline;
