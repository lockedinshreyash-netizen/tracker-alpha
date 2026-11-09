/* ── The whiteboard beside a book ──
   An endless sheet for a quick calculation or a diagram while the book stays
   open: four pens, shapes, stamps (a few general shapes and chemistry
   structures to draw on top of), an eraser, eight inks and a custom one,
   three sizes per tool, undo and redo, and a ruling (dots, grid, lines or
   blank). One board per book, saved on this device (books/files.ts).

   The model is books/board.ts (pure, tested); the canvas work is
   books/boardDraw.ts. This file is the panel, the gestures and saving.

   Moving around: scroll (or two fingers) pans, ⌘/Ctrl + scroll or a pinch
   zooms, Space + drag or the hand pans with a mouse. Once a stylus has
   touched the board, a finger only pans, so a resting palm draws nothing.

   Nothing is committed per pointer move. Committed strokes are painted to
   a cached layer; the stroke being drawn is painted over it each frame. One
   gesture is one step of undo, and saving is debounced off it.

   The panel's size is the room's (books/BookRoom.tsx owns it, so the book
   can make room). While its edge is dragged, only the panel moves; the book
   relayouts once, on release. */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  INKS, MAX_STROKES, PENS, SHAPES, STAMPS, commit, constrain, emptyBoard, erasedBy, fitView, historyOf, isPen, isShape,
  normalizeBoard, panBy, pushPoint, redo, roundPts, simplify, sizeFor, speedPressure, stampBox, stampById, stampStrokes,
  toScreen, toWorld, undo, zoomAt, boxFrom, inkIn, cornersOf, imageAt, imagesIn, moveBy, placeImage, resizeImage, type Corner, type Background, type Board, type Box, type History, type ShapeKind, type StampDef, type Stroke, type StrokeKind,
  type Tool, type View,
} from './board';
import { SHEETS, drawBackground, drawStroke, drawStrokes, exportRegion, type ImageCache, type SheetColor } from './boardDraw';
import { getBoard, getBoardImage, pruneBoardImages, saveBoard, saveBoardImage } from './files';
import { centreOf, moveEnd, perfect, recognize, scaleShape, shapePoints, type Pt, type Shape } from './quickshape';
import './board.css';

const PREFS_KEY = 'bk_board_prefs_v1';
type SizeIx = 0 | 1 | 2;
interface Prefs { tool: Tool; color: string; custom: string; shape: ShapeKind; stamp: string; size: Partial<Record<StrokeKind | 'eraser' | 'stamp', SizeIx>>; snap: boolean }
const DEFAULT_PREFS: Prefs = { tool: 'pen', color: 'ink', custom: '#0ca678', shape: 'line', stamp: 'benzene', size: {}, snap: true };
/** How long a pen must rest at the end of a stroke before it snaps to a shape (Procreate waits about as long). */
const HOLD_MS = 450;
/** A resting hand still trembles: movement under this many px does not restart the wait. */
const HOLD_SLOP = 4;

const readPrefs = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...raw, size: { ...(raw.size ?? {}) } };
  } catch { return DEFAULT_PREFS; }
};

const TOOL_LABEL: Record<Tool, string> = {
  hand: 'Move (H)', pen: 'Pen (P)', pencil: 'Pencil', marker: 'Highlighter', brush: 'Brush pen',
  line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', eraser: 'Eraser (E)', stamp: 'Stamp',
  snip: 'Snip to a flashcard or notes (S)',
};
const INK_LABEL: Record<string, string> = {
  ink: 'Ink', '#e5484d': 'Red', '#f08c00': 'Orange', '#f2c200': 'Yellow', '#2f9e44': 'Green', '#1c7ed6': 'Blue', '#7048e8': 'Violet', '#d6336c': 'Pink',
};
const BG_LABEL: Record<Background, string> = { dots: 'Dots', grid: 'Grid', lines: 'Lines', blank: 'Blank' };

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Props {
  owner: string;
  bookId: string;
  /** The reading room's page colour: the board's sheet follows it. */
  color: SheetColor;
  dock: 'side' | 'bottom';
  /** Its size along the dock (width at the side, height at the bottom), and the bounds a drag may reach. */
  size: number;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  onResize: (px: number) => void;
  max: boolean;
  onMax: (max: boolean) => void;
  onClose: () => void;
  /** A snip of the board, sent to a flashcard or the chapter's notes (the reader wires it; absent on the design board). */
  onSend?: (to: 'card' | 'notes', image: Blob) => void;
  /** A diagram sent from the page, to be placed on the board; `key` tells one sending from the next. */
  incoming?: { key: number; blob: Blob } | null;
  /** The board has placed the incoming diagram (or could not): the sender can forget it. */
  onIncomingDone?: () => void;
  /** Start snipping the page, straight to this board. */
  onFromPage?: () => void;
}

/* ── Icons ── */

const I = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICON: Record<Tool, React.ReactNode> = {
  hand: <I d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4.5a1.5 1.5 0 0 1 3 0V10m0-.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4 15a1.6 1.6 0 0 1 2.4-2.1L8 14.5V11" />,
  pen: <I d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 7l3 3" />,
  pencil: <I d="M5 19l1.2-3.6L16 5.6a1.6 1.6 0 0 1 2.3 2.3L8.6 17.8 5 19zM14.5 7l2.5 2.5M6.2 15.4l2.4 2.4" />,
  marker: <I d="M9 15l-3 3v2h4l3-3M9 15l6-9 3 3-6 9M9 15l3 3M5 21h14" />,
  brush: <I d="M14 4l6 6-7.5 7.5a3 3 0 0 1-2.1.9H8l-.1 1.2A2.6 2.6 0 0 1 5.3 22H3c1.2-1 1.5-2.5 1.5-4 0-1.6 1.2-3 3-3l.1 0L14 4z" />,
  line: <I d="M5 19L19 5" />,
  arrow: <I d="M5 19L19 5M10 5h9v9" />,
  rect: <I d="M4.5 6.5h15v11h-15z" />,
  ellipse: <I d="M12 18.5c4.4 0 8-2.9 8-6.5s-3.6-6.5-8-6.5-8 2.9-8 6.5 3.6 6.5 8 6.5z" />,
  eraser: <I d="M8.5 20H20M4.6 14.6l8.8-8.8a2 2 0 0 1 2.8 0l3.5 3.5a2 2 0 0 1 0 2.8L13 18.8a4 4 0 0 1-2.8 1.2H8.9a2 2 0 0 1-1.4-.6l-2.9-2.9a2 2 0 0 1 0-2.9zM9 10l5 5" />,
  stamp: <I d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />,
  snip: <I d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M9 12h6M12 9v6" />,
};

/** A stamp drawn as its own small picture, from the same data that places it. */
const StampPic = ({ s }: { s: StampDef }) => {
  const b = stampBox(s);
  const pad = 0.25;
  const vb = `${b.x0 - pad} ${b.y0 - pad} ${b.x1 - b.x0 + pad * 2} ${b.y1 - b.y0 + pad * 2}`;
  const sw = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.035;
  return (
    <svg viewBox={vb} width="40" height="34" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {s.lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
      {(s.arrows ?? []).map((l, i) => {
        const a = Math.atan2(l[3] - l[1], l[2] - l[0]);
        const h = 0.3;
        const barb = (t: number) => `${l[2] - h * Math.cos(a + t)},${l[3] - h * Math.sin(a + t)}`;
        return <polyline key={`a${i}`} points={`${l[0]},${l[1]} ${l[2]},${l[3]} ${barb(0.45)} ${l[2]},${l[3]} ${barb(-0.45)}`} />;
      })}
      {(s.circles ?? []).map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
    </svg>
  );
};

/* ── The panel ── */

export default function Whiteboard({ owner, bookId, color, dock, size, minSize, maxSize, defaultSize, onResize, max, onMax, onClose, onSend, incoming, onIncomingDone, onFromPage }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [bg, setBg] = useState<Background>('dots');
  const [, setVersion] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [menu, setMenuState] = useState<null | 'shapes' | 'more'>(null);
  const [menuAt, setMenuAt] = useState<React.CSSProperties>({});
  /* A menu opens under its button (over it when there is no room below), measured once on open. */
  const setMenu = useCallback((m: null | 'shapes' | 'more' | ((prev: null | 'shapes' | 'more') => null | 'shapes' | 'more'), from?: HTMLElement | null) => {
    setMenuState(prev => {
      const next = typeof m === 'function' ? m(prev) : m;
      if (next && from) {
        const r = from.getBoundingClientRect();
        const W = 296;
        const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
        const below = window.innerHeight - r.bottom - 12;
        const above = r.top - 12;
        setMenuAt(below >= 320 || below >= above
          ? { left, top: r.bottom + 6, maxHeight: Math.min(520, below) }
          : { left, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(520, above) });
      }
      return next;
    });
  }, []);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest('.bkw-menu') && !t.closest('.bkw-pop-anchor > button')) setMenuState(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menu]);
  const [loaded, setLoaded] = useState(false);
  const [panning, setPanning] = useState(false);
  /** The selected diagram's id (React's copy, for the bar; the gestures read S.current.sel). */
  const [selected, setSelectedState] = useState<string | null>(null);
  /** Where the snip's bar sits (sheet px), once a snip is let go; `empty` when there is no ink in it. */
  const [snipAt, setSnipAt] = useState<null | { x: number; y: number; empty: boolean }>(null);
  const [snipBusy, setSnipBusy] = useState<null | 'card' | 'notes' | 'copy' | 'copied'>(null);
  const snipBarRef = useRef<HTMLDivElement>(null);
  /** What a stroke snapped to: shown while it is held, then for a few seconds with a way back to the freehand. */
  const [snapChip, setSnapChip] = useState<null | { label: string; id?: string; orig?: Stroke }>(null);
  useEffect(() => {
    if (!snapChip?.id) return;
    const t = window.setTimeout(() => setSnapChip(null), 4000);
    return () => window.clearTimeout(t);
  }, [snapChip]);
  /* The bar is centred under the snip, then measured and kept wholly on the sheet. */
  useLayoutEffect(() => {
    const bar = snipBarRef.current, sheetEl = bar?.parentElement;
    if (!bar || !sheetEl || !snipAt) return;
    const half = bar.offsetWidth / 2, w = sheetEl.clientWidth;
    bar.style.left = `${w < half * 2 + 16 ? w / 2 : Math.min(w - half - 8, Math.max(half + 8, snipAt.x))}px`;
  }, [snipAt, snipBusy]);
  const panelRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setPref = useCallback((patch: Partial<Prefs>) => {
    setPrefs(p => {
      const next = { ...p, ...patch, size: { ...p.size, ...(patch.size ?? {}) } };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private */ }
      return next;
    });
  }, []);

  /* Everything the gestures and the paint loop read lives in one ref, so a pointer move never re-renders React. */
  const S = useRef({
    hist: historyOf([]) as History,
    view: { x: 0, y: 0, z: 1 } as View,
    bg: 'dots' as Background,
    sheet: SHEETS[color],
    w: 0, h: 0, dpr: 1,
    base: null as HTMLCanvasElement | null,
    baseDirty: true,
    frame: 0,
    live: [] as Stroke[],
    hidden: new Set<string>(),
    cursor: null as null | { x: number; y: number; r: number },
    /** The snip being dragged or waiting for an answer, in world units. */
    snip: null as null | Box,
    /** Decoded pictures by id, and ones being fetched. */
    images: new Map() as ImageCache,
    fetching: new Set<string>(),
    /** The selected diagram, and where a drag is putting it (not committed until release). */
    sel: null as string | null,
    moved: new Map<string, number[]>(),
    space: false,
    penSeen: false,
    dirty: false,
    saveTimer: 0,
  });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /* ── Paint ── */

  const paint = useCallback(() => {
    const s = S.current;
    s.frame = 0;
    const canvas = canvasRef.current;
    if (!canvas || !s.w || !s.h) return;
    if (!s.base) s.base = document.createElement('canvas');
    const pw = Math.round(s.w * s.dpr), ph = Math.round(s.h * s.dpr);
    if (s.base.width !== pw || s.base.height !== ph) { s.base.width = pw; s.base.height = ph; s.baseDirty = true; }
    if (s.baseDirty) {
      const b = s.base.getContext('2d')!;
      drawBackground(b, s.view, s.w, s.h, s.bg, s.sheet, s.dpr);
      drawStrokes(b, s.hist.present, s.view, s.w, s.h, s.sheet, s.dpr, s.hidden, s.images, s.moved);
      s.baseDirty = false;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(s.base, 0, 0);
    if (s.live.length) {
      const v = s.view;
      ctx.setTransform(s.dpr * v.z, 0, 0, s.dpr * v.z, -v.x * v.z * s.dpr, -v.y * v.z * s.dpr);
      for (const st of s.live) drawStroke(ctx, st, s.sheet);
    }
    if (s.snip) {
      // Everything outside the snip dims, so what goes to the card is plain to see.
      const [x0, y0] = toScreen(s.view, s.snip.x0, s.snip.y0);
      const [x1, y1] = toScreen(s.view, s.snip.x1, s.snip.y1);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.fillStyle = s.sheet.dark ? 'rgba(0,0,0,0.45)' : 'rgba(24,24,27,0.12)';
      ctx.beginPath();
      ctx.rect(0, 0, s.w, s.h);
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.fill('evenodd');
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#3d8eeb';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }
    const sel = s.sel ? s.hist.present.find(st => st.id === s.sel) : null;
    if (sel) {
      // The selected diagram: a frame and four corner handles, in screen space so they stay one size.
      const pts = s.moved.get(sel.id) ?? sel.pts;
      const [ax, ay] = toScreen(s.view, pts[0], pts[1]);
      const [bx, by] = toScreen(s.view, pts[2], pts[3]);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.strokeStyle = '#3d8eeb';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ax, ay, bx - ax, by - ay);
      for (const [hx, hy] of [[ax, ay], [bx, ay], [bx, by], [ax, by]]) {
        ctx.beginPath();
        ctx.arc(hx, hy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.stroke();
      }
    }
    if (s.cursor) {
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.beginPath();
      ctx.arc(s.cursor.x, s.cursor.y, s.cursor.r, 0, Math.PI * 2);
      ctx.strokeStyle = s.sheet.dark ? 'rgba(255,255,255,0.7)' : 'rgba(24,24,27,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, []);

  const request = useCallback((base = false) => {
    const s = S.current;
    if (base) s.baseDirty = true;
    if (!s.frame) s.frame = requestAnimationFrame(paint);
  }, [paint]);

  /* ── Saving: debounced off every change, flushed on leaving ── */

  const flush = useCallback(() => {
    const s = S.current;
    window.clearTimeout(s.saveTimer);
    if (!s.dirty) return;
    s.dirty = false;
    const row: Board = { ...emptyBoard(bookId), strokes: s.hist.present, view: s.view, bg: s.bg, updatedAt: Date.now() };
    void saveBoard(owner, row).catch(() => { s.dirty = true; });
  }, [owner, bookId]);

  const scheduleSave = useCallback((ms = 700) => {
    const s = S.current;
    s.dirty = true;
    window.clearTimeout(s.saveTimer);
    s.saveTimer = window.setTimeout(flush, ms);
  }, [flush]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);

  const setStrokes = useCallback((next: Stroke[]) => {
    const s = S.current;
    s.hist = commit(s.hist, next.length > MAX_STROKES ? next.slice(-MAX_STROKES) : next);
    setVersion(v => v + 1);
    request(true);
    scheduleSave();
  }, [request, scheduleSave]);

  const setView = useCallback((v: View) => {
    const s = S.current;
    s.view = v;
    // A snip waiting for an answer is placed on the screen; moving the sheet puts it away.
    if (s.snip && !G.current) { s.snip = null; setSnipAt(null); }
    setZoomPct(Math.round(v.z * 100));
    request(true);
    scheduleSave(1200);
  }, [request, scheduleSave]);

  /* ── Pictures: fetched from the device and decoded once, then drawn from memory ── */

  const decodeImages = useCallback(() => {
    const s = S.current;
    for (const id of imagesIn(s.hist.present)) {
      if (s.images.has(id) || s.fetching.has(id)) continue;
      s.fetching.add(id);
      getBoardImage(owner, id)
        .then(blob => (blob ? createImageBitmap(blob) : null))
        .then(bmp => { if (bmp) { s.images.set(id, bmp); request(true); } })
        .catch(() => undefined)
        .finally(() => s.fetching.delete(id));
    }
  }, [owner, request]);

  const select = useCallback((id: string | null) => {
    S.current.sel = id;
    setSelectedState(id);
    request();
  }, [request]);

  /* ── Load this book's board ── */

  useEffect(() => {
    let live = true;
    setLoaded(false);
    getBoard(owner, bookId).then(raw => {
      if (!live) return;
      const b = normalizeBoard(raw, bookId);
      const s = S.current;
      s.hist = historyOf(b.strokes);
      s.sel = null;
      setSelectedState(null);
      // Pictures this board no longer uses go; undo only reaches back within a visit, so this is the moment.
      void pruneBoardImages(owner, bookId, imagesIn(b.strokes)).catch(() => undefined);
      s.view = b.view;
      s.bg = b.bg;
      setBg(b.bg);
      setZoomPct(Math.round(b.view.z * 100));
      setVersion(v => v + 1);
      setLoaded(true);
      decodeImages();
      request(true);
    }, () => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [owner, bookId, request]);

  useEffect(() => { S.current.sheet = SHEETS[color]; request(true); }, [color, request]);
  useEffect(() => { S.current.bg = bg; request(true); }, [bg, request]);

  /* ── The canvas follows its box ── */

  useLayoutEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      const s = S.current;
      s.w = r.width; s.h = r.height; s.dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      s.baseDirty = true;
      rect.current = null;
      paint(); // at once, so a resize never shows a blank frame
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  /* ── Gestures ── */

  type Gesture =
    | {
      mode: 'draw'; id: number; stroke: Stroke; lx: number; ly: number; lt: number; p: number;
      /** Where the pen came to rest, and the wait before it snaps. */
      hx: number; hy: number; timer: number;
      /** Once snapped: the shape as recognised, as adjusted since, the freehand it replaced, and what the adjusting measures from. */
      snapped?: { base: Shape; shape: Shape; label: string; orig: Stroke; c: Pt; d0: number; p: number };
    }
    | { mode: 'shape'; id: number; kind: ShapeKind; wx: number; wy: number }
    | { mode: 'stamp'; id: number; stamp: StampDef; wx: number; wy: number; sx: number; sy: number; moved: boolean }
    | { mode: 'erase'; id: number; wx: number; wy: number; r: number }
    | { mode: 'pan'; id: number; sx: number; sy: number; view: View }
    | { mode: 'pinch'; ids: [number, number]; d0: number; mx: number; my: number; view: View }
    | { mode: 'snip'; id: number; wx: number; wy: number }
    | { mode: 'imgmove'; id: number; img: string; wx: number; wy: number; pts: number[] }
    | { mode: 'imgsize'; id: number; img: string; corner: Corner; pts: number[] };
  const G = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const rect = useRef<DOMRect | null>(null);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = rect.current ?? wrapRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const strokeWidth = (kind: StrokeKind | 'stamp') => sizeFor(kind, prefsRef.current.size[kind] ?? 1) / S.current.view.z;
  const eraserR = () => sizeFor('eraser', prefsRef.current.size.eraser ?? 1);

  const finishLive = () => { S.current.live = []; };

  /* ── Hold to snap ── */

  const holdFor = (g: Extract<Gesture, { mode: 'draw' }>) => {
    window.clearTimeout(g.timer);
    if (!prefsRef.current.snap || g.snapped) return;
    g.timer = window.setTimeout(() => trySnap(g), HOLD_MS);
  };

  const trySnap = (g: Extract<Gesture, { mode: 'draw' }>) => {
    const s = S.current;
    if (G.current !== g || g.snapped) return;
    const rec = recognize(g.stroke.pts, 16 / s.view.z);
    if (!rec) return;
    // The brush keeps a steady width once snapped; the other pens ignore pressure.
    const p = g.stroke.kind === 'brush' ? 0.7 : 0.5;
    const c = centreOf(rec.shape);
    const [hx, hy] = toWorld(s.view, g.hx, g.hy);
    g.snapped = { base: rec.shape, shape: rec.shape, label: rec.label, orig: { ...g.stroke, pts: g.stroke.pts.slice() }, c, d0: Math.max(1 / s.view.z, Math.hypot(hx - c[0], hy - c[1])), p };
    s.live = [{ ...g.stroke, pts: shapePoints(rec.shape, p) }];
    setSnapChip({ label: rec.label });
    try { navigator.vibrate?.(8); } catch { /* not on this device */ }
    request();
  };

  const startPinch = () => {
    if (G.current?.mode === 'draw') window.clearTimeout(G.current.timer);
    const ids = [...touches.current.keys()].slice(0, 2) as [number, number];
    const [a, b] = ids.map(id => touches.current.get(id)!);
    finishLive(); // a finger that began a line and then became a pinch drew nothing
    S.current.hidden.clear();
    G.current = { mode: 'pinch', ids, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, view: S.current.view };
    request(true);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded) return;
    setMenu(null);
    if (S.current.snip) clearSnip();
    setSnapChip(null);
    wrapRef.current?.focus({ preventScroll: true });
    rect.current = wrapRef.current!.getBoundingClientRect();
    const [x, y] = local(e);
    const s = S.current;
    if (e.pointerType === 'pen') s.penSeen = true;
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x, y });
      if (touches.current.size >= 2) { startPinch(); return; }
    }
    if (G.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks: the gesture still works without capture */ }
    const tool = prefsRef.current.tool;
    const [wx, wy] = toWorld(s.view, x, y);
    const fingerWhilePen = e.pointerType === 'touch' && s.penSeen;
    // A corner of the selected diagram resizes it, whatever the tool.
    const sel = s.sel ? s.hist.present.find(st => st.id === s.sel) : null;
    if (sel && e.button === 0 && !s.space) {
      const c = cornersOf(sel).findIndex(([cx, cy]) => { const [hx, hy] = toScreen(s.view, cx, cy); return Math.hypot(hx - x, hy - y) <= (e.pointerType === 'touch' ? 22 : 12); });
      if (c >= 0) { G.current = { mode: 'imgsize', id: e.pointerId, img: sel.id, corner: c as Corner, pts: sel.pts }; return; }
    }
    // The Move tool picks up a diagram; on empty sheet it moves the view.
    if (tool === 'hand' && e.button === 0 && !s.space && !fingerWhilePen) {
      const hit = imageAt(s.hist.present, wx, wy);
      if (hit) {
        select(hit.id);
        G.current = { mode: 'imgmove', id: e.pointerId, img: hit.id, wx, wy, pts: hit.pts };
        return;
      }
      if (s.sel) select(null);
    } else if (s.sel && !s.space && e.button === 0) {
      select(null); // drawing on it puts the selection away
    }
    if (tool === 'hand' || s.space || e.button === 1 || fingerWhilePen) {
      G.current = { mode: 'pan', id: e.pointerId, sx: x, sy: y, view: s.view };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const color = prefsRef.current.color;
    if (tool === 'snip') {
      s.snip = { x0: wx, y0: wy, x1: wx, y1: wy };
      setSnipAt(null);
      G.current = { mode: 'snip', id: e.pointerId, wx, wy };
      request();
      return;
    }
    if (tool === 'eraser') {
      const r = eraserR() / s.view.z;
      G.current = { mode: 'erase', id: e.pointerId, wx, wy, r };
      for (const id of erasedBy(s.hist.present, wx, wy, wx, wy, r, s.hidden)) s.hidden.add(id);
      request(true);
      return;
    }
    if (tool === 'stamp') {
      const stamp = stampById(prefsRef.current.stamp) ?? STAMPS[0];
      G.current = { mode: 'stamp', id: e.pointerId, stamp, wx, wy, sx: x, sy: y, moved: false };
      return;
    }
    if (isShape(tool)) {
      G.current = { mode: 'shape', id: e.pointerId, kind: tool, wx, wy };
      s.live = [{ id: newId(), kind: tool, color, w: strokeWidth(tool), pts: [wx, wy, wx, wy] }];
      request();
      return;
    }
    const kind = tool as StrokeKind;
    const p = e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.8;
    const stroke: Stroke = { id: newId(), kind, color, w: strokeWidth(kind), pts: [wx, wy, p] };
    const draw: Gesture = { mode: 'draw', id: e.pointerId, stroke, lx: x, ly: y, lt: e.timeStamp, p, hx: x, hy: y, timer: 0 };
    G.current = draw;
    holdFor(draw);
    s.live = [stroke];
    request();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = S.current;
    const [x, y] = local(e);
    const tool = prefsRef.current.tool;
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x, y });
    const g = G.current;

    // The eraser's ring follows a mouse or stylus even between strokes.
    if (tool === 'eraser' && e.pointerType !== 'touch') { s.cursor = { x, y, r: eraserR() }; request(); }
    else if (s.cursor) { s.cursor = null; request(); }

    if (!g) return;
    if (g.mode === 'pinch') {
      const [a, b] = g.ids.map(id => touches.current.get(id));
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const z = Math.hypot(a.x - b.x, a.y - b.y) / g.d0;
      const [wx, wy] = toWorld(g.view, g.mx, g.my);
      const next = zoomAt({ ...g.view }, g.mx, g.my, z);
      setView({ x: wx - mx / next.z, y: wy - my / next.z, z: next.z });
      return;
    }
    if (g.id !== e.pointerId) return;
    if (g.mode === 'pan') { setView(panBy(g.view, x - g.sx, y - g.sy)); return; }
    if (g.mode === 'imgmove' || g.mode === 'imgsize') {
      const [px, py] = toWorld(s.view, x, y);
      s.moved.set(g.img, g.mode === 'imgmove' ? moveBy(g.pts, px - g.wx, py - g.wy) : resizeImage(g.pts, g.corner, px, py, e.shiftKey, 16 / s.view.z));
      request(true);
      return;
    }
    const [wx, wy] = toWorld(s.view, x, y);
    if (g.mode === 'snip') {
      s.snip = boxFrom(g.wx, g.wy, wx, wy);
      request();
      return;
    }
    if (g.mode === 'erase') {
      for (const id of erasedBy(s.hist.present, g.wx, g.wy, wx, wy, g.r, s.hidden)) s.hidden.add(id);
      g.wx = wx; g.wy = wy;
      request(true);
      return;
    }
    if (g.mode === 'shape') {
      const [ex, ey] = e.shiftKey ? constrain(g.kind, g.wx, g.wy, wx, wy) : [wx, wy];
      s.live[0].pts = [g.wx, g.wy, ex, ey];
      request();
      return;
    }
    if (g.mode === 'stamp') {
      if (!g.moved && Math.hypot(x - g.sx, y - g.sy) < 6) return;
      g.moved = true;
      s.live = stampStrokes(g.stamp, g.wx, g.wy, wx, wy, prefsRef.current.color, strokeWidth('stamp'), () => 'live');
      request();
      return;
    }
    // Snapped and still held: the shape follows the hand. A line's end goes where the pen goes;
    // anything else grows or shrinks about its middle. Shift makes it exact.
    if (g.snapped) {
      const sn = g.snapped;
      const [px, py] = toWorld(s.view, x, y);
      let shape: Shape;
      if (sn.base.type === 'line') shape = moveEnd(sn.base, [px, py], e.shiftKey);
      else {
        shape = scaleShape(sn.base, Math.max(0.05, Math.hypot(px - sn.c[0], py - sn.c[1]) / sn.d0));
        if (e.shiftKey) shape = perfect(shape);
      }
      sn.shape = shape;
      s.live = [{ ...g.stroke, pts: shapePoints(shape, sn.p) }];
      request();
      return;
    }
    // A freehand stroke: every sample the browser kept, not only the last.
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []).length ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of events) {
      const [ex, ey] = local(ev);
      const [px, py] = toWorld(s.view, ex, ey);
      let p: number;
      if (ev.pointerType === 'pen') p = Math.max(0.05, ev.pressure || 0.5);
      else {
        const dt = Math.max(1, ev.timeStamp - g.lt);
        p = g.p * 0.6 + speedPressure(Math.hypot(ex - g.lx, ey - g.ly) / dt) * 0.4;
      }
      if (pushPoint(g.stroke.pts, px, py, p, 0.75 / s.view.z)) { g.lx = ex; g.ly = ey; g.lt = ev.timeStamp; g.p = p; }
    }
    // The pen moved on: the wait to snap starts again from here.
    if (Math.hypot(x - g.hx, y - g.hy) > HOLD_SLOP) { g.hx = x; g.hy = y; holdFor(g); }
    request();
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = S.current;
    touches.current.delete(e.pointerId);
    const g = G.current;
    if (!g) return;
    if (g.mode === 'pinch') {
      // Lifting one finger ends the pinch; the other draws nothing until it lifts too.
      if (g.ids.includes(e.pointerId)) G.current = touches.current.size ? { mode: 'pan', id: -1, sx: 0, sy: 0, view: s.view } : null;
      return;
    }
    if (g.id === -1) { if (!touches.current.size) G.current = null; return; }
    if (g.id !== e.pointerId) return;
    G.current = null;
    if (g.mode === 'draw') window.clearTimeout(g.timer);
    setPanning(false);
    if (g.mode === 'pan') return;
    if (g.mode === 'imgmove' || g.mode === 'imgsize') {
      const pts = s.moved.get(g.img);
      s.moved.delete(g.img);
      if (pts && e.type !== 'pointercancel') setStrokes(s.hist.present.map(st => (st.id === g.img ? { ...st, pts: roundPts(pts) } : st)));
      else request(true);
      return;
    }
    if (g.mode === 'snip') {
      const b = s.snip;
      const [x0, y0] = b ? toScreen(s.view, b.x0, b.y0) : [0, 0];
      const [x1, y1] = b ? toScreen(s.view, b.x1, b.y1) : [0, 0];
      if (!b || x1 - x0 < 12 || y1 - y0 < 12) { s.snip = null; setSnipAt(null); request(); return; }
      // The bar under the snip, or over it when the snip reaches the bottom of the sheet.
      const below = y1 + 52 < s.h;
      setSnipAt({ x: Math.max(8, Math.min(s.w - 8, (x0 + x1) / 2)), y: below ? y1 + 8 : Math.max(8, y0 - 48), empty: !inkIn(s.hist.present, b) });
      request();
      return;
    }
    if (g.mode === 'erase') {
      if (s.hidden.size) {
        const gone = new Set(s.hidden);
        s.hidden.clear();
        setStrokes(s.hist.present.filter(st => !gone.has(st.id)));
      }
      return;
    }
    if (e.type === 'pointercancel') { finishLive(); request(); return; }
    if (g.mode === 'stamp') {
      let [x0, y0, x1, y1] = [g.wx, g.wy, ...toWorld(s.view, ...local(e))];
      if (!g.moved) {
        // A click drops it at a comfortable size, centred where you clicked.
        const half = 70 / s.view.z;
        [x0, y0, x1, y1] = [g.wx - half, g.wy - half, g.wx + half, g.wy + half];
      }
      const placed = stampStrokes(g.stamp, x0, y0, x1, y1, prefsRef.current.color, strokeWidth('stamp'), () => newId());
      finishLive();
      setStrokes([...s.hist.present, ...placed]);
      return;
    }
    const st = s.live[0];
    finishLive();
    if (!st) return;
    if (g.mode === 'shape') {
      const [x0, y0, x1, y1] = st.pts;
      if (Math.hypot(x1 - x0, y1 - y0) * s.view.z < 3) { request(); return; }
      setStrokes([...s.hist.present, { ...st, pts: roundPts(st.pts) }]);
      return;
    }
    if (g.mode === 'draw' && g.snapped) {
      // Kept as the pen that drew it, so a snapped highlighter line is still a highlighter.
      const shaped: Stroke = { ...st, pts: roundPts(shapePoints(g.snapped.shape, g.snapped.p)) };
      const orig: Stroke = { ...g.snapped.orig, pts: roundPts(simplify(g.snapped.orig.pts, 0.35 / s.view.z)) };
      setStrokes([...s.hist.present, shaped]);
      setSnapChip({ label: g.snapped.label, id: shaped.id, orig });
      return;
    }
    const pts = roundPts(simplify(st.pts, 0.35 / s.view.z));
    setStrokes([...s.hist.present, { ...st, pts }]);
  };

  const onLeave = () => { if (S.current.cursor) { S.current.cursor = null; request(); } };

  /* Scroll pans; ⌘/Ctrl + scroll (and a trackpad pinch, which arrives as one) zooms. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const s = S.current;
      if (e.ctrlKey || e.metaKey) {
        const unit = e.deltaMode === 1 ? 16 : 1;
        setView(zoomAt(s.view, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * unit * 0.01)));
      } else {
        const k = e.deltaMode === 1 ? 16 : 1;
        setView(panBy(s.view, -e.deltaX * k, -e.deltaY * k));
      }
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [setView]);

  /* ── Actions ── */

  const afterHistory = useCallback(() => {
    const s = S.current;
    if (s.sel && !s.hist.present.some(st => st.id === s.sel)) select(null);
    decodeImages();
    setVersion(v => v + 1);
    request(true);
    scheduleSave();
  }, [request, scheduleSave, select, decodeImages]);
  const doUndo = useCallback(() => { const s = S.current; s.hist = undo(s.hist); afterHistory(); }, [afterHistory]);
  const doRedo = useCallback(() => { const s = S.current; s.hist = redo(s.hist); afterHistory(); }, [afterHistory]);

  /* ── Diagrams ── */

  /** Put a picture on the board, in the middle of the view, selected and ready to move or resize. */
  const addImage = useCallback(async (blob: Blob) => {
    const s = S.current;
    const id = newId().replace(/[^a-z0-9]/g, '').slice(0, 24) || Math.random().toString(36).slice(2, 12);
    const bmp = await createImageBitmap(blob);
    await saveBoardImage(owner, { id, bookId, blob });
    s.images.set(id, bmp);
    const stroke: Stroke = { id: newId(), kind: 'image', color: 'ink', w: 0, pts: roundPts(placeImage(s.view, s.w, s.h, bmp.width, bmp.height)), img: id };
    setStrokes([...s.hist.present, stroke]);
    select(stroke.id);
    setPref({ tool: 'hand' });
    setNotice(null);
  }, [owner, bookId, setStrokes, select, setPref]);

  const [notice, setNotice] = useState<string | null>(null);
  const handled = useRef(0);
  useEffect(() => {
    if (!incoming || !loaded || handled.current === incoming.key) return;
    handled.current = incoming.key;
    addImage(incoming.blob).catch(e => setNotice(e instanceof Error && e.message.includes('space') ? e.message : "Couldn't bring that picture over.")).finally(() => onIncomingDone?.());
  }, [incoming, loaded, addImage, onIncomingDone]);

  const selStroke = selected ? S.current.hist.present.find(st => st.id === selected) ?? null : null;
  const toggleFade = () => {
    if (!selStroke) return;
    setStrokes(S.current.hist.present.map(st => (st.id === selStroke.id ? { ...st, fade: !st.fade || undefined } : st)));
  };
  const deleteSelected = () => {
    if (!selStroke) return;
    setStrokes(S.current.hist.present.filter(st => st.id !== selStroke.id));
    select(null);
  };
  const drawOnIt = () => { select(null); setPref({ tool: prefs.tool === 'hand' ? 'pen' : prefs.tool }); wrapRef.current?.focus(); };

  /* A picture pasted onto the board lands like one sent from the page. */
  const onPaste = (e: React.ClipboardEvent) => {
    const file = [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    void addImage(file).catch(() => setNotice("Couldn't add that picture."));
  };
  const fit = () => {
    const s = S.current;
    setView(fitView(s.hist.present, s.w, s.h) ?? { x: -s.w / 2, y: -s.h / 2, z: 1 });
  };
  const actualSize = () => { const s = S.current; setView(zoomAt(s.view, s.w / 2, s.h / 2, 1 / s.view.z)); };
  const clear = () => { setMenu(null); if (S.current.hist.present.length) setStrokes([]); };
  const pickBg = (b: Background) => { setBg(b); setMenu(null); S.current.bg = b; scheduleSave(); };

  /* ── Snips ── */

  /* The snap was not wanted: the stroke goes back to how it was drawn, as one more step of undo. */
  const keepFreehand = () => {
    const c = snapChip;
    if (!c?.id || !c.orig) return;
    const orig = c.orig;
    setStrokes(S.current.hist.present.map(st => (st.id === c.id ? orig : st)));
    setSnapChip(null);
  };

  const clearSnip = () => { S.current.snip = null; setSnipAt(null); setSnipBusy(null); request(); };
  const snipImage = () => (S.current.snip ? exportRegion(S.current.hist.present, S.current.snip, 1600, S.current.images) : Promise.resolve(null));

  const sendSnip = async (to: 'card' | 'notes') => {
    if (!onSend) return;
    setSnipBusy(to);
    const blob = await snipImage();
    setSnipBusy(null);
    if (!blob) return;
    clearSnip();
    onSend(to, blob);
  };

  /* The clipboard is handed the promise at once: Safari refuses a write that waits on an await first. */
  const canCopyImage = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const copySnip = () => {
    setSnipBusy('copy');
    const png = snipImage().then(b => { if (!b) throw new Error('empty'); return b; });
    navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(
      () => { setSnipBusy('copied'); window.setTimeout(clearSnip, 900); },
      () => setSnipBusy(null),
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    let handled = true;
    if (e.key === ' ') { if (!S.current.space) { S.current.space = true; setPanning(true); } }
    else if (mod && k === 'z' && !e.shiftKey) doUndo();
    else if (mod && ((k === 'z' && e.shiftKey) || k === 'y')) doRedo();
    else if (mod) handled = false;
    else if (k === 'p') setPref({ tool: 'pen' });
    else if (k === 'e') setPref({ tool: 'eraser' });
    else if (k === 'h') setPref({ tool: 'hand' });
    else if (k === 's') setPref({ tool: 'snip' });
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.current.sel) deleteSelected();
    else if (e.key === 'Escape' && S.current.sel) select(null);
    else if (e.key === 'Escape') { if (S.current.snip) clearSnip(); else if (menu) setMenu(null); else if (max) onMax(false); else wrapRef.current?.blur(); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ') { S.current.space = false; if (!G.current) setPanning(false); e.stopPropagation(); }
  };

  /* ── The edge: drag to resize, double-click for the default size ── */

  const onEdgeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    const room = panel?.parentElement;
    if (!panel || !room || max) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = room.getBoundingClientRect();
    const sizeAt = (ev: PointerEvent | React.PointerEvent) => Math.round(Math.min(maxSize, Math.max(minSize, dock === 'side' ? r.right - ev.clientX : r.bottom - ev.clientY)));
    let last = size;
    panel.dataset.dragging = 'true';
    const move = (ev: PointerEvent) => {
      last = sizeAt(ev);
      if (dock === 'side') panel.style.width = `${last}px`; else panel.style.height = `${last}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      delete panel.dataset.dragging;
      panel.style.width = '';
      panel.style.height = '';
      onResize(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /* ── Drawing ── */

  const { tool, color: ink } = prefs;
  const sizeKey: StrokeKind | 'eraser' | 'stamp' | null = tool === 'hand' || tool === 'snip' ? null : tool;
  const hist = S.current.hist;
  const empty = loaded && !hist.present.length;
  const shapeIcon = tool === 'stamp' ? <StampPic s={stampById(prefs.stamp) ?? STAMPS[0]} /> : ICON[prefs.shape];
  const shapeOn = isShape(tool) || tool === 'stamp';
  const sheet = SHEETS[color];

  const toolBtn = (t: Tool) => (
    <button key={t} type="button" className="bkw-tool" aria-pressed={tool === t} aria-label={TOOL_LABEL[t]} title={TOOL_LABEL[t]} onClick={() => setPref({ tool: t })}>
      {ICON[t]}
    </button>
  );

  return (
    <aside ref={panelRef} className="bkw" data-dock={dock} data-max={max ? 'true' : undefined} aria-label="Board">
      {!max && (
        <div className="bkw-edge" onPointerDown={onEdgeDown} onDoubleClick={() => onResize(defaultSize)} role="separator" aria-orientation={dock === 'side' ? 'vertical' : 'horizontal'} aria-label="Drag to resize the board" title="Drag to resize · double-click to reset">
          <i />
        </div>
      )}

      <header className="bkw-head">
        <span className="bkw-title">Board</span>
        <button type="button" className="bkw-ib" onClick={doUndo} disabled={!hist.past.length} aria-label="Undo (⌘Z)" title="Undo (⌘Z)">
          <I d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </button>
        <button type="button" className="bkw-ib" onClick={doRedo} disabled={!hist.future.length} aria-label="Redo (⌘⇧Z)" title="Redo (⌘⇧Z)">
          <I d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </button>
        <span className="bkw-gap" />
        <div className="bkw-pop-anchor">
          <button type="button" className="bkw-ib" onClick={e => setMenu(m => (m === 'more' ? null : 'more'), e.currentTarget)} aria-expanded={menu === 'more'} aria-label="Board options" title="Ruling, fit, clear">
            <I d="M5 12h.01M12 12h.01M19 12h.01" />
          </button>
          {menu === 'more' && (
            <div className="bkw-menu" role="menu" style={menuAt}>
              <p className="bkw-menu-h">Sheet</p>
              <div className="bkw-bgs">
                {(['dots', 'grid', 'lines', 'blank'] as Background[]).map(b => (
                  <button key={b} type="button" role="menuitemradio" aria-checked={bg === b} className="bkw-bg" data-bg={b} onClick={() => pickBg(b)}>
                    <i />{BG_LABEL[b]}
                  </button>
                ))}
              </div>
              <button type="button" role="menuitemcheckbox" aria-checked={prefs.snap} className="bkw-mi bkw-check" onClick={() => setPref({ snap: !prefs.snap })}>
                <span>Snap shapes<small>Hold at the end of a stroke to straighten a line or round a circle.</small></span>
                <i aria-hidden="true" />
              </button>
              <button type="button" role="menuitem" className="bkw-mi" onClick={() => { setMenu(null); fit(); }}>Show all my work</button>
              <button type="button" role="menuitem" className="bkw-mi" data-danger="true" onClick={clear} disabled={!hist.present.length}>Clear the board</button>
              <p className="bkw-menu-note">Clearing can be undone. The board is saved on this device, with this book.</p>
            </div>
          )}
        </div>
        {onFromPage && (
          <button type="button" className="bkw-ib bkw-from" onClick={onFromPage} aria-label="Bring a diagram from the page" title="Bring a diagram from the page">
            <I d="M6.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.6 8.4l4.4 3.6M8.6 15.6l4.4-3.6M14 12h7M18 9l3 3-3 3" />
            {(max || dock === 'bottom' || size >= 400) && <span>From the page</span>}
          </button>
        )}
        <button type="button" className="bkw-ib" onClick={() => onMax(!max)} aria-pressed={max} aria-label={max ? 'Back beside the book' : 'Full screen'} title={max ? 'Back beside the book' : 'Full screen'}>
          {max ? <I d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <I d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
        </button>
        <button type="button" className="bkw-ib" onClick={onClose} aria-label="Close the board (W)" title="Close (W)">
          <I d="M6 6l12 12M18 6L6 18" />
        </button>
      </header>

      <div className="bkw-bar" role="toolbar" aria-label="Tools">
        {toolBtn('hand')}
        <span className="bkw-sep" />
        {PENS.map(toolBtn)}
        <div className="bkw-pop-anchor">
          <button
            type="button"
            className="bkw-tool bkw-shape"
            aria-pressed={shapeOn}
            aria-expanded={menu === 'shapes'}
            aria-label="Shapes and stamps"
            title="Shapes and stamps"
            onClick={e => setMenu(m => (m === 'shapes' ? null : 'shapes'), e.currentTarget)}
          >
            {shapeIcon}
            <svg className="bkw-caret" viewBox="0 0 8 8" width="7" height="7" aria-hidden="true"><path d="M1 3l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
          {menu === 'shapes' && (
            <div className="bkw-menu bkw-shapes" role="menu" style={menuAt}>
              <p className="bkw-menu-h">Draw</p>
              <div className="bkw-grid4">
                {SHAPES.map(k => (
                  <button key={k} type="button" role="menuitemradio" aria-checked={tool === k} className="bkw-cell" onClick={() => { setPref({ tool: k, shape: k }); setMenu(null); }}>
                    {ICON[k]}<span>{TOOL_LABEL[k]}</span>
                  </button>
                ))}
              </div>
              <p className="bkw-menu-h">Shapes</p>
              <div className="bkw-grid4">
                {STAMPS.filter(s => s.group === 'shape').map(s => (
                  <button key={s.id} type="button" role="menuitemradio" aria-checked={tool === 'stamp' && prefs.stamp === s.id} className="bkw-cell" onClick={() => { setPref({ tool: 'stamp', stamp: s.id }); setMenu(null); }}>
                    <StampPic s={s} /><span>{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="bkw-menu-h">Chemistry</p>
              <div className="bkw-grid4">
                {STAMPS.filter(s => s.group === 'chem').map(s => (
                  <button key={s.id} type="button" role="menuitemradio" aria-checked={tool === 'stamp' && prefs.stamp === s.id} className="bkw-cell" onClick={() => { setPref({ tool: 'stamp', stamp: s.id }); setMenu(null); }}>
                    <StampPic s={s} /><span>{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="bkw-menu-note">Click to drop one, or drag to size it. Every bond is its own line: erase one, or draw over it.</p>
            </div>
          )}
        </div>
        <span className="bkw-sep" />
        {toolBtn('eraser')}
        <span className="bkw-sep" />
        {toolBtn('snip')}
      </div>

      <div className="bkw-bar bkw-inks" role="toolbar" aria-label="Ink and size" data-off={tool === 'hand' ? 'true' : undefined}>
        {tool !== 'eraser' && tool !== 'snip' && (
          <>
            {INKS.map(c => (
              <button
                key={c}
                type="button"
                className="bkw-ink"
                aria-pressed={ink === c}
                aria-label={INK_LABEL[c]}
                title={INK_LABEL[c]}
                style={{ ['--ink' as string]: c === 'ink' ? sheet.ink : c }}
                onClick={() => setPref({ color: c, ...(tool === 'hand' ? { tool: 'pen' as Tool } : {}) })}
              ><i /></button>
            ))}
            <label className="bkw-ink bkw-custom" aria-pressed={ink === prefs.custom} title="Any colour" style={{ ['--ink' as string]: prefs.custom }}>
              <i />
              <input type="color" value={prefs.custom} aria-label="Any colour" onChange={e => setPref({ custom: e.target.value, color: e.target.value })} />
            </label>
            <span className="bkw-sep" />
          </>
        )}
        {sizeKey && ([0, 1, 2] as SizeIx[]).map(i => (
          <button
            key={i}
            type="button"
            className="bkw-size"
            aria-pressed={(prefs.size[sizeKey] ?? 1) === i}
            aria-label={['Thin', 'Medium', 'Thick'][i]}
            title={['Thin', 'Medium', 'Thick'][i]}
            onClick={() => setPref({ size: { [sizeKey]: i } })}
          >
            <i style={{ width: [5, 9, 14][i], height: [5, 9, 14][i] }} />
          </button>
        ))}
        {tool === 'eraser' && <span className="bkw-hint">Erases whole strokes</span>}
        {tool === 'snip' && <span className="bkw-hint">Drag a box over your work to make a flashcard or add it to your notes.</span>}
      </div>

      <div
        ref={wrapRef}
        className="bkw-sheet"
        tabIndex={0}
        data-tool={tool}
        data-panning={panning ? 'true' : undefined}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
        style={{ background: sheet.bg }}
      >
        <canvas
          ref={canvasRef}
          className="bkw-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onLeave}
          onContextMenu={e => e.preventDefault()}
        />
        {selStroke && (
          <div className="bkw-selbar" role="toolbar" aria-label="Diagram" onPointerDown={e => e.stopPropagation()}>
            <span className="bkw-selhint">Drag to move · corners resize</span>
            <button type="button" onClick={drawOnIt}>Draw on it</button>
            <button type="button" onClick={toggleFade} aria-pressed={!!selStroke.fade}>{selStroke.fade ? 'Full' : 'Fade'}</button>
            <button type="button" className="bkw-seldel" onClick={deleteSelected}>Delete</button>
          </div>
        )}
        {notice && <p className="bkw-notice" role="alert" onClick={() => setNotice(null)}>{notice}</p>}
        {snapChip && (
          <div className="bkw-snapchip" role="status" onPointerDown={e => e.stopPropagation()}>
            <span>{snapChip.label}</span>
            {snapChip.id && snapChip.orig && <button type="button" onClick={keepFreehand}>Keep freehand</button>}
          </div>
        )}
        {snipAt && (
          <div ref={snipBarRef} className="bkw-snipbar" role="toolbar" aria-label="Send the snip" style={{ left: snipAt.x, top: snipAt.y }} onPointerDown={e => e.stopPropagation()}>
            {snipAt.empty ? (
              <span className="bkw-snipnote">Nothing drawn in there.</span>
            ) : (
              <>
                {onSend && <button type="button" onClick={() => void sendSnip('card')} disabled={!!snipBusy && snipBusy !== 'copied'}>{snipBusy === 'card' ? 'Making…' : 'Flashcard'}</button>}
                {onSend && <button type="button" onClick={() => void sendSnip('notes')} disabled={!!snipBusy && snipBusy !== 'copied'}>{snipBusy === 'notes' ? 'Adding…' : 'To notes'}</button>}
                {canCopyImage && <button type="button" onClick={copySnip} disabled={!!snipBusy && snipBusy !== 'copied'}>{snipBusy === 'copied' ? 'Copied' : 'Copy'}</button>}
              </>
            )}
            <button type="button" className="bkw-snipx" onClick={clearSnip} aria-label="Cancel the snip">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        {empty && (
          <p className="bkw-empty" style={{ color: sheet.dark ? 'rgba(255,255,255,0.4)' : 'rgba(24,24,27,0.4)' }}>
            Scratch space for this book. Work the sum here.
            <span>Scroll or two fingers to move · ⌘ + scroll or pinch to zoom</span>
            {prefs.snap && <span>Hold at the end of a stroke to snap it to a shape</span>}
          </p>
        )}
        <div className="bkw-zoom">
          <button type="button" onClick={actualSize} title="Back to 100%">{zoomPct}%</button>
          <button type="button" onClick={fit} title="Show all my work" aria-label="Show all my work">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><circle cx="12" cy="12" r="2.5" /></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
