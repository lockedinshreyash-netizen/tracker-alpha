/* ── Dragging a card between columns ──
   The discipline here is copied wholesale from schedule/DayTimeline.tsx,
   because every rule in it was earned on this codebase:

     · A gesture NEVER touches AppState. Every state write hits localStorage and
       fires a Supabase upsert, so committing per frame would be ~60 upserts per
       drag. Live position lives here; the mutator is called exactly once, on
       release.
     · Pointer Events, with the move/up/cancel listeners bound to WINDOW.
       setPointerCapture routes captured events back to the element that claimed
       them, so a handler anywhere else would never fire.
     · A `gesture` state whose only job is to wake the effect that attaches
       those listeners — a ref cannot.
     · A movement threshold before a drag counts, and a suppressed trailing
       click so releasing does not open the editor on the card just dropped.
     · pointercancel puts everything back.

   What is different is the arithmetic. DayTimeline converts pixels to minutes;
   a board asks a different question — which column, and where in it — so this
   is written against that shape rather than extracted from a working gesture
   that has no columns in it. The two share a discipline, not a coordinate
   system, and refactoring one to serve both is how both break.

   Two rules exist purely for a cheap phone:

   1. Pointer moves are coalesced into one requestAnimationFrame. `pointermove`
      fires faster than the display refreshes on plenty of devices, and doing
      the work per event rather than per frame is throwing away half of it.
   2. Every rect is measured ONCE, at pointerdown. getBoundingClientRect in a
      move handler forces synchronous layout on every frame, which is the
      classic way a drag that works on a laptop stutters on a phone. */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskColumn } from '../types';

const DRAG_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 56;
const AUTOSCROLL_STEP_PX = 12;

/** Where the card would land if released now. */
export interface DropTarget {
  column: TaskColumn;
  index: number;
}

export interface DragState {
  id: string;
  /* The card's own viewport position when the gesture began, plus how far the
     pointer has travelled since. The overlay is drawn at `left + dx`, not at
     `dx` — a pure delta would put the card at the top-left corner of the screen
     the moment it was picked up. */
  left: number;
  top: number;
  dx: number;
  dy: number;
  width: number;
  height: number;
  target: DropTarget;
}

interface ColumnGeometry {
  column: TaskColumn;
  rect: DOMRect;
  /** Vertical midpoint of each card, in viewport coordinates, in render order. */
  midpoints: number[];
  /** Card ids in render order, so the dragged card can be excluded. */
  ids: string[];
}

interface Internal {
  pointerId: number;
  id: string;
  from: TaskColumn;
  originX: number;
  originY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  columns: ColumnGeometry[];
  moved: boolean;
}

interface Options {
  /** Called once, on release, only if the card actually moved somewhere new. */
  onCommit: (id: string, column: TaskColumn, index: number) => void;
  /** The scroll container on mobile, where columns run off-screen sideways. */
  scrollerRef: React.RefObject<HTMLElement | null>;
}

export interface CardDragApi {
  drag: DragState | null;
  /** Put on each card's drag surface. */
  begin: (e: React.PointerEvent, id: string, column: TaskColumn) => void;
  /** Read-and-clear. A click straight after a real drag must not open anything. */
  consumeClick: () => boolean;
  /** Register a column's element so its geometry can be measured at gesture start. */
  registerColumn: (column: TaskColumn, el: HTMLElement | null) => void;
}

export const useCardDrag = ({ onCommit, scrollerRef }: Options): CardDragApi => {
  const [drag, setDrag] = useState<DragState | null>(null);

  /* The gesture lives in refs so a move does not re-render anything that is not
     the dragged card, and so the window listeners never need rebinding
     mid-drag. `gesture` exists only to wake the effect that binds them. */
  const [gesture, setGesture] = useState<number | null>(null);
  const dragRef = useRef<Internal | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const columnEls = useRef(new Map<TaskColumn, HTMLElement>());

  const pointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const autoScrollRef = useRef<number | null>(null);

  useEffect(() => { stateRef.current = drag; }, [drag]);

  const registerColumn = useCallback((column: TaskColumn, el: HTMLElement | null) => {
    if (el) columnEls.current.set(column, el);
    else columnEls.current.delete(column);
  }, []);

  /* Runs at most once per animation frame, never once per pointer event. Reads
     only the cached geometry and the last pointer position, so autoscroll can
     re-run it with no new pointer event at all. */
  const apply = useCallback(() => {
    frameRef.current = null;
    const d = dragRef.current;
    if (!d) return;

    const { x, y } = pointerRef.current;

    /* Hit-test the column under the pointer, falling back to the nearest one
       horizontally — a pointer dragged past the last column should still drop
       into it rather than nowhere. */
    let hit = d.columns.find(c => x >= c.rect.left && x <= c.rect.right);
    if (!hit) {
      hit = d.columns.reduce((best, c) => {
        const dist = x < c.rect.left ? c.rect.left - x : x - c.rect.right;
        const bestDist = x < best.rect.left ? best.rect.left - x : x - best.rect.right;
        return dist < bestDist ? c : best;
      }, d.columns[0]);
    }
    if (!hit) return;

    /* Index by midpoint: the card lands above every card whose middle is below
       the pointer. The dragged card is excluded from its own column's list so
       it cannot displace itself. */
    let index = 0;
    for (let i = 0; i < hit.midpoints.length; i++) {
      if (hit.ids[i] === d.id) continue;
      if (y > hit.midpoints[i]) index++;
    }

    setDrag({
      id: d.id,
      left: d.left,
      top: d.top,
      dx: x - d.originX,
      dy: y - d.originY,
      width: d.width,
      height: d.height,
      target: { column: hit.column, index },
    });
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(apply);
  }, [apply]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) cancelAnimationFrame(autoScrollRef.current);
    autoScrollRef.current = null;
  }, []);

  /* Horizontal, not vertical: the columns are what run off a phone screen. */
  const runAutoScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    const d = dragRef.current;
    if (!scroller || !d) { autoScrollRef.current = null; return; }

    const rect = scroller.getBoundingClientRect();
    const x = pointerRef.current.x;
    let delta = 0;
    if (x < rect.left + AUTOSCROLL_EDGE_PX) delta = -AUTOSCROLL_STEP_PX;
    else if (x > rect.right - AUTOSCROLL_EDGE_PX) delta = AUTOSCROLL_STEP_PX;

    if (delta) {
      const before = scroller.scrollLeft;
      scroller.scrollLeft += delta;
      const shift = scroller.scrollLeft - before;
      /* The cached rects were measured before this scroll, so they have to move
         with it — otherwise the hit test drifts by exactly the distance
         scrolled, which is the bug that makes autoscroll drop cards in the
         wrong column. */
      if (shift) {
        for (const c of d.columns) {
          c.rect = new DOMRect(c.rect.x - shift, c.rect.y, c.rect.width, c.rect.height);
        }
        d.originX -= shift;
        d.left -= shift;
        schedule();
      }
    }

    autoScrollRef.current = requestAnimationFrame(runAutoScroll);
  }, [schedule, scrollerRef]);

  const begin = useCallback((e: React.PointerEvent, id: string, column: TaskColumn) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const card = (e.currentTarget as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
    if (!card) return;

    /* Clear any suppression left over from the previous gesture, so the flag can
       only ever swallow the click belonging to the drag that set it.

       It leaks otherwise: a drag sets it on pointerup expecting a trailing
       click to consume it, and after a touch drag the browser frequently never
       sends one — the pointer travelled too far, or it ended over a different
       element. The flag then sat true until the *next* tap ate it, so the first
       tap after any drag silently failed to open the editor. Intermittent, and
       exactly the kind of thing that reads as "this app is flaky". */
    suppressClickRef.current = false;

    /* Guarded: setPointerCapture throws NotFoundError if the pointer has
       already been released or is not one the browser is tracking, and an
       exception here would abort the handler before `dragRef` is set — killing
       the gesture entirely rather than degrading it. Capture is an
       optimisation; the window listeners below are what actually make the drag
       work, so losing it costs nothing. */
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* Drag proceeds without capture. */
    }

    /* Every measurement the gesture will need, taken now, in one pass. Nothing
       below this line calls getBoundingClientRect again. */
    const columns: ColumnGeometry[] = [];
    for (const col of ['todo', 'doing', 'done'] as TaskColumn[]) {
      const el = columnEls.current.get(col);
      if (!el) continue;
      const cards = Array.from(el.querySelectorAll('[data-card-id]')) as HTMLElement[];
      const rects = cards.map(c => c.getBoundingClientRect());
      columns.push({
        column: col,
        rect: el.getBoundingClientRect(),
        midpoints: rects.map(r => r.top + r.height / 2),
        ids: cards.map(c => c.dataset.cardId || ''),
      });
    }

    const rect = card.getBoundingClientRect();
    pointerRef.current = { x: e.clientX, y: e.clientY };
    dragRef.current = {
      pointerId: e.pointerId,
      id,
      from: column,
      originX: e.clientX,
      originY: e.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      columns,
      moved: false,
    };
    setGesture(e.pointerId);
    /* Kills the text-selection drag and, on touch, the browser's own reading of
       the gesture. */
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (gesture === null) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      pointerRef.current = { x: e.clientX, y: e.clientY };

      if (!d.moved) {
        const dist = Math.hypot(e.clientX - d.originX, e.clientY - d.originY);
        if (dist < DRAG_THRESHOLD_PX) return;
        d.moved = true;
        if (autoScrollRef.current === null) autoScrollRef.current = requestAnimationFrame(runAutoScroll);
      }
      schedule();
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      stopAutoScroll();
      if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }

      /* One write per gesture, and only if it actually was one. A tap never
         reaches here with `moved` set and falls through to the card's onClick. */
      const live = stateRef.current;
      if (d.moved) {
        suppressClickRef.current = true;
        if (live && live.id === d.id) onCommit(d.id, live.target.column, live.target.index);
      }
      dragRef.current = null;
      setDrag(null);
      setGesture(null);
    };

    /* A cancelled gesture — the tab backgrounded, the OS taking over — must
       leave the card exactly where it started, not half-moved. Nothing has been
       written, so dropping the preview is the whole revert. */
    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      stopAutoScroll();
      if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
      dragRef.current = null;
      setDrag(null);
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
  }, [gesture, schedule, runAutoScroll, stopAutoScroll, onCommit]);

  const consumeClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return { drag, begin, consumeClick, registerColumn };
};
