/* ── The reading room ──
   A book takes the whole screen, like a lecture (learn/LectureView.tsx): a
   portal at z 100, the rail folded, the page sized to the window. Pages run
   in one column and are drawn by pdf.js only near the screen (two pages
   ahead and behind, roughly); everything further away is an empty box of
   the right size, so a 600-page book scrolls like a 6-page one.

   Over each drawn page sits pdf.js's text layer (transparent text, so the
   student's selection is real text) and our own marks layer: highlights and
   snips as rectangles in page fractions (books/model.ts), which survive any
   zoom. A selection becomes a highlight through books/dom.ts (DOM → offsets
   → whole words → line strips). Snip is a drag on any page, the one way to
   mark a scanned DPP or a figure.

   What leaves the room, and when: marks at once (the store seals and saves
   them), the reading position on this device every second it moves, and the
   position and pages seen into the sealed library on close, on hide and
   every 30 s. Time is never logged by reading; the clock pill is the
   student's own tap, as in a lecture. */

import React, { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import '../learn/theater.css';
import './room.css';
import { ClockPill, type OtherSession } from '../learn/SessionStrip';
import { place, coarse } from '../reader/Panels';
import type { LearnStore } from '../learn/store';
import type { ExamPreference, Subject, TimerState } from '../types';
import { getChaptersFor } from '../constants';
import { subjectsFor } from '../learn/LectureFields';
import { getFile } from './files';
import { loadPdfjs, openPdf, outlineOf, renderSnip, textOfPage, NotAPdfError } from './pdf';
import { layerText, offsetAt, rangeAt, rectsOf } from './dom';
import type { BookLinks } from './links';
import { fitView, swipeTurns, viewIndexOf, viewsOf, type PageLayout } from './layout';
import { contextOf, quoteOf, searchPage, snapToWords } from './anchors';
import {
  MARK_COLORS, addChapterAt, chapterOfKey, marksOf, removeChapterAt, sectionAt, mergeRuns,
  type Book, type BookMark, type BookSubject, type MarkColor, type OutlineEntry, type PageRect, type PageRun,
} from './model';

/** What a mark can become elsewhere in Alpha (Decks, Notes, the error notebook). Wired by App. */
export interface MarkSource {
  book: Book;
  page: number;
  chapterKey?: string;
  quote?: string;
  /** A snip, rendered sharp. */
  image?: Blob;
  rect?: PageRect;
}

type Send = 'makeCard' | 'toNotes' | 'logMistake';

/* The flashcard sheet loads the Decks API, so it arrives only when asked for. */
const CardSheet = lazy(() => import('./CardSheet'));

interface Props {
  store: LearnStore;
  book: Book;
  startPage?: number;
  dark: boolean;
  onClose: () => void;
  timer: TimerState;
  otherSession: OtherSession;
  onStartClock: (subject: Subject, chapter?: string) => boolean;
  onOpenToday: () => void;
  onWatching: (watching: boolean) => void;
  /** Decks, Notes and the error notebook (App). Absent on the design board. */
  links?: BookLinks;
  /** Which syllabus a chapter added by hand comes from. */
  exam?: ExamPreference;
}

type PageColor = 'paper' | 'sepia' | 'night';
const COLOR_KEY = 'bk_page_v1';
const LAYOUT_KEY = 'bk_layout_v1';
const readLayout = (): PageLayout => {
  try { const v = localStorage.getItem(LAYOUT_KEY); return v === 'flip' || v === 'spread' ? v : 'scroll'; } catch { return 'scroll'; }
};
const posKey = (id: string) => `bk_pos_v1:${id}`;
const SWATCH: Record<MarkColor, string> = { yellow: '#F5C400', green: '#3FB45A', blue: '#3D8EEB', pink: '#E8578A' };
const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5];
const NEAR = 2;

const readColor = (): PageColor => {
  try { const v = localStorage.getItem(COLOR_KEY); return v === 'sepia' || v === 'night' ? v : 'paper'; } catch { return 'paper'; }
};

interface Pos { page: number; offset: number; at: number }
const readPos = (id: string): Pos | null => {
  try {
    const v = JSON.parse(localStorage.getItem(posKey(id)) || 'null');
    return v && Number.isInteger(v.page) && typeof v.offset === 'number' && typeof v.at === 'number' ? v : null;
  } catch { return null; }
};

/* ── One page ── */

interface PageProps {
  doc: PDFDocumentProxy;
  n: number;
  width: number;
  height: number;
  near: boolean;
  marks: BookMark[];
  bookmarked: boolean;
  snipping: boolean;
  onSize: (n: number, w: number, h: number) => void;
  onSnip: (n: number, rect: PageRect) => void;
  onMarkTap: (mark: BookMark, at: DOMRect) => void;
  /** Where the page sits in a paged layout (absolute), or nothing in the scrolled column. */
  place?: { left: number; top: number };
}

const PageView = memo(({ doc, n, width, height, near, marks, bookmarked, snipping, onSize, onSnip, onMarkTap, place }: PageProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const host = canvasHost.current;
    const layer = layerRef.current;
    if (!near || !host || !layer) {
      host?.replaceChildren();
      layer?.replaceChildren();
      setDrawn(false);
      return;
    }
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    let textLayer: { cancel: () => void } | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const page = await doc.getPage(n);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        onSize(n, base.width, base.height);
        const scale = width / base.width;
        let ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        const area = base.width * base.height * (scale * ratio) ** 2;
        const MAX = 6_000_000;
        if (area > MAX) ratio *= Math.sqrt(MAX / area);
        const vp = page.getViewport({ scale: scale * ratio });
        // Draw into a fresh canvas and swap it in, so a zoom never shows a blank page meanwhile.
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.className = 'bk-canvas';
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        const render = page.render({ canvasContext: ctx, viewport: vp });
        task = render;
        await render.promise;
        if (cancelled) return;
        host.replaceChildren(canvas);
        setDrawn(true);

        layer.replaceChildren();
        boxRef.current?.style.setProperty('--scale-factor', String(scale));
        const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport: page.getViewport({ scale }) });
        textLayer = tl;
        await tl.render();
      } catch (e) {
        if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.warn('[books] page', n, e);
      }
    })();
    return () => { cancelled = true; task?.cancel(); textLayer?.cancel(); };
  }, [doc, n, near, width, onSize]);

  /* Snip: a drag on the page draws a rectangle; letting go keeps it. */
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const frac = (e: React.PointerEvent) => {
    const b = boxRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  return (
    <div ref={boxRef} className="bk-page" data-page={n} style={place ? { width, height, position: 'absolute', left: place.left, top: place.top } : { width, height }}>
      <div ref={canvasHost} className="bk-canvas-host" />
      {!drawn && near && <div className="bk-page-wait" aria-hidden="true" />}
      <div ref={layerRef} className="textLayer" data-page={n} />
      <div className="bk-marks">
        {marks.map(m => (m.rects ?? []).map((r, i) => (
          <button
            key={`${m.id}-${i}`}
            type="button"
            className={m.kind === 'snip' ? 'bk-snip' : 'bk-hl'}
            data-color={m.color ?? 'yellow'}
            data-note={m.note && i === 0 ? 'true' : undefined}
            style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }}
            aria-label={m.kind === 'snip' ? 'Snip' : `Highlight: ${m.quote ?? ''}`}
            onClick={e => onMarkTap(m, (e.currentTarget as HTMLElement).getBoundingClientRect())}
          />
        )))}
      </div>
      {bookmarked && <span className="bk-ribbon" aria-label="Bookmarked" />}
      {snipping && (
        <div
          className="bk-snipper"
          onPointerDown={e => { try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not a live pointer */ } const p = frac(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
          onPointerMove={e => { if (drag) { const p = frac(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } }}
          onPointerUp={() => {
            if (!drag) return;
            const x = Math.min(drag.x0, drag.x1);
            const y = Math.min(drag.y0, drag.y1);
            const w = Math.abs(drag.x1 - drag.x0);
            const h = Math.abs(drag.y1 - drag.y0);
            setDrag(null);
            if (w > 0.02 && h > 0.01) onSnip(n, [x, y, w, h]);
          }}
        >
          {drag && (
            <span className="bk-snip-live" style={{
              left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`,
              width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
            }} />
          )}
        </div>
      )}
      <span className="bk-page-no" aria-hidden="true">{n}</span>
    </div>
  );
});

/* ── The room ── */

interface Selected { page: number; start: number; end: number; quote: string; rects: PageRect[]; box: DOMRect }

export default function BookRoom({ store, book, startPage, dark: _dark, onClose, timer, otherSession, onStartClock, onOpenToday, onWatching, links, exam = 'JEE' }: Props) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const lib = store.getLibrary();
  const owner = store.owner;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [base, setBase] = useState<[number, number]>([595, 842]);
  const sizesRef = useRef(new Map<number, [number, number]>());
  const [sizesVersion, setSizesVersion] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [color, setColorState] = useState<PageColor>(readColor);
  const [viewW, setViewW] = useState(() => window.innerWidth);
  const [current, setCurrent] = useState(1);
  const [near, setNear] = useState<Set<number>>(() => new Set([1]));
  const [chrome, setChrome] = useState(true);
  const [snipping, setSnipping] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [menu, setMenu] = useState<{ mark: BookMark; box: DOMRect } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | 'contents' | 'marks' | 'search'>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void; action?: { label: string; run: () => void } } | null>(null);
  const [lastColor, setLastColor] = useState<MarkColor>('yellow');
  const pageFieldRef = useRef<(() => void) | null>(null);
  const [card, setCard] = useState<MarkSource | null>(null);
  const [layoutPref, setLayoutPref] = useState<PageLayout>(readLayout);
  const [stage, setStage] = useState<[number, number]>([window.innerWidth, window.innerHeight]);
  /** The paged track's slide: where it is dragged to, and whether it is animating a turn. */
  const [slide, setSlide] = useState<{ dx: number; anim: boolean }>({ dx: 0, anim: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<PageRun[]>([]);
  const savedRef = useRef<{ page: number; runs: string }>({ page: 0, runs: '' });
  const offsetRef = useRef(0);
  const restoredRef = useRef(false);

  const setColor = (c: PageColor) => { setColorState(c); try { localStorage.setItem(COLOR_KEY, c); } catch { /* private */ } };

  /* Open the file. */
  useEffect(() => {
    let live = true;
    let opened: PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const blob = await getFile(owner, book.fingerprint);
        if (!blob) { if (live) setFailed("This book's file isn't on this device. Add the same PDF from the shelf."); return; }
        const d = await openPdf(await blob.arrayBuffer());
        opened = d;
        if (!live) { void d.destroy(); return; }
        const p1 = await d.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setBase([vp.width, vp.height]);
        setDoc(d);
      } catch (e) {
        if (live) setFailed(e instanceof NotAPdfError ? e.message : 'This book could not be opened.');
      }
    })();
    store.touchBook(book.id);
    onWatching(true);
    return () => { live = false; onWatching(false); if (opened) void opened.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.fingerprint, owner]);

  useEffect(() => {
    const onResize = () => setViewW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const phone = viewW < 768;
  // Two pages side by side need the width of a tablet; a phone flips one at a time instead.
  const layout: PageLayout = layoutPref === 'spread' && viewW < 700 ? 'flip' : layoutPref;
  const paged = layout !== 'scroll';
  const chooseLayout = (l: PageLayout) => {
    setLayoutPref(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* private */ }
    const page = current;
    setZoom(1);
    // The same page stays in front whichever way it is laid out.
    if (l === 'scroll') requestAnimationFrame(() => requestAnimationFrame(() => scrollToPageRef.current(page)));
  };
  const fitW = Math.min(viewW - (phone ? 12 : 96), 920);
  const pageW = Math.round(fitW * zoom);
  const sizeOf = useCallback((n: number): [number, number] => {
    const s = sizesRef.current.get(n) ?? base;
    return [pageW, Math.round(pageW * (s[1] / s[0]))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, pageW, sizesVersion]);

  const onSize = useCallback((n: number, w: number, h: number) => {
    const prev = sizesRef.current.get(n);
    if (prev && prev[0] === w && prev[1] === h) return;
    sizesRef.current.set(n, [w, h]);
    if (Math.abs(h / w - base[1] / base[0]) > 0.001) setSizesVersion(v => v + 1);
  }, [base]);

  /* Pages near the screen are drawn; the rest are boxes. */
  useEffect(() => {
    const root = scrollRef.current;
    const host = pagesRef.current;
    if (!doc || !root || !host || paged) return;
    const io = new IntersectionObserver(entries => {
      setNear(prev => {
        const next = new Set(prev);
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) for (let k = n - NEAR + 1; k <= n + NEAR - 1; k++) { if (k >= 1 && k <= doc.numPages) next.add(k); }
          else next.delete(n);
        }
        // Keep the drawn set small whatever the observer reports.
        if (next.size > 10) {
          const cur = Number(host.dataset.current) || 1;
          [...next].sort((a, b) => Math.abs(b - cur) - Math.abs(a - cur)).slice(0, next.size - 10).forEach(k => next.delete(k));
        }
        return next.size === prev.size && [...next].every(k => prev.has(k)) ? prev : next;
      });
    }, { root, rootMargin: '150% 0px' });
    host.querySelectorAll('.bk-page').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [doc, pageW, paged]);

  /* Where the reading line (30% down) falls: the current page and how far into it. */
  const measure = useCallback(() => {
    const root = scrollRef.current;
    const host = pagesRef.current;
    if (!root || !host || !doc || paged) return;
    const line = root.getBoundingClientRect().top + root.clientHeight * 0.3;
    const pages = host.children;
    let lo = 0;
    let hi = pages.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((pages[mid] as HTMLElement).getBoundingClientRect().top <= line) lo = mid; else hi = mid - 1;
    }
    const el = pages[lo] as HTMLElement;
    const r = el.getBoundingClientRect();
    const page = lo + 1;
    offsetRef.current = Math.min(1, Math.max(0, (line - r.top) / r.height));
    host.dataset.current = String(page);
    setCurrent(page);
    seenRef.current = mergeRuns(seenRef.current, [page, page]);
    try { localStorage.setItem(posKey(book.id), JSON.stringify({ page, offset: offsetRef.current, at: Date.now() })); } catch { /* full */ }
  }, [doc, book.id, paged]);

  /** Set while the room itself scrolls (opening, jumping, zooming), so the chrome is not hidden by it. */
  const jumpingRef = useRef(false);
  const scrollToPage = useCallback((page: number, offset = 0, smooth = false) => {
    const root = scrollRef.current;
    const el = pagesRef.current?.children[page - 1] as HTMLElement | undefined;
    if (!root || !el) return;
    const top = el.offsetTop + el.offsetHeight * offset - (offset ? root.clientHeight * 0.3 : 64);
    jumpingRef.current = true;
    root.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => { jumpingRef.current = false; }, smooth ? 600 : 80);
  }, []);
  const scrollToPageRef = useRef(scrollToPage);

  /* ── Paged layouts: one view (one page, or two) on the stage at a time ── */

  const views = useMemo(() => viewsOf(doc?.numPages ?? book.pages, layout), [doc, book.pages, layout]);
  const viewIndex = viewIndexOf(views, current);

  // The stage's size, for fitting a view whole.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setStage([e.contentRect.width, e.contentRect.height]));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  // In a paged layout the page in front is the place: recorded as it changes.
  useEffect(() => {
    if (!paged || !doc) return;
    offsetRef.current = 0;
    for (const p of views[viewIndex] ?? []) seenRef.current = mergeRuns(seenRef.current, [p, p]);
    try { localStorage.setItem(posKey(book.id), JSON.stringify({ page: current, offset: 0, at: Date.now() })); } catch { /* full */ }
  }, [paged, doc, current, viewIndex, views, book.id]);

  const turning = useRef(false);
  /** Turn one view forward or back, sliding the track a stage's width. */
  const turn = useCallback((dir: 1 | -1) => {
    const next = viewIndex + dir;
    if (next < 0 || next >= views.length || turning.current) { setSlide({ dx: 0, anim: true }); return; }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setCurrent(views[next][0]); setSlide({ dx: 0, anim: false }); return; }
    turning.current = true;
    setSlide({ dx: -dir * stage[0], anim: true });
    window.setTimeout(() => {
      // The new view takes the middle slot in the same frame the track snaps back: nothing moves on screen.
      setCurrent(views[next][0]);
      setSlide({ dx: 0, anim: false });
      turning.current = false;
    }, 280);
  }, [viewIndex, views, stage]);

  /** Go to a page, whatever the layout. */
  const jump = useCallback((page: number, offset = 0, smooth = false) => {
    if (!paged) { scrollToPage(page, offset, smooth); return; }
    const total = doc?.numPages ?? book.pages;
    setCurrent(views[viewIndexOf(views, Math.min(total, Math.max(1, page)))][0]);
    setSlide({ dx: 0, anim: false });
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [paged, scrollToPage, doc, book.pages, views]);

  /* Open where the student was: the newer of this device's place and the account's, unless asked for a page. */
  useLayoutEffect(() => {
    if (!doc || restoredRef.current) return;
    restoredRef.current = true;
    const mine = readPos(book.id);
    const theirs = lib.bookProgress[book.id];
    const pos = startPage
      ? { page: startPage, offset: 0 }
      : mine && (!theirs || mine.at >= theirs.updatedAt) ? mine : theirs ? { page: theirs.page, offset: theirs.offset } : { page: 1, offset: 0 };
    const page = Math.min(doc.numPages, Math.max(1, pos.page));
    setCurrent(page);
    if (!paged) requestAnimationFrame(() => scrollToPage(page, pos.offset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  /* Zooming keeps the same words on the reading line. */
  const zoomTo = (z: number) => {
    const page = current;
    const off = offsetRef.current;
    setZoom(z);
    if (!paged) requestAnimationFrame(() => requestAnimationFrame(() => scrollToPage(page, off)));
  };
  const zoomStep = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex(z => z >= zoom - 0.001);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 3 : i) + dir))];
    if (next !== zoom) zoomTo(next);
  };

  /* Scrolling: measure on a frame, hide the chrome going down, bring it back going up. */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    let lastY = root.scrollTop;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
        const y = root.scrollTop;
        if (jumpingRef.current) { lastY = y; return; }
        if (Math.abs(y - lastY) > 24) { setChrome(y < lastY || y < 40); lastY = y; }
        if (root.scrollHeight - y - root.clientHeight < 40) setChrome(true);
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { root.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [measure]);

  /* The position and pages seen go into the sealed library rarely. */
  const flush = useCallback(() => {
    const runs = JSON.stringify(seenRef.current);
    if (savedRef.current.page === current && savedRef.current.runs === runs) return;
    savedRef.current = { page: current, runs };
    store.recordReading(book.id, { page: current, offset: offsetRef.current, seen: seenRef.current });
  }, [store, book.id, current]);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const id = window.setInterval(() => flushRef.current(), 30_000);
    const onHide = () => { if (document.visibilityState === 'hidden') flushRef.current(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      flushRef.current();
    };
  }, []);

  /* ── Marks ── */

  const marks = marksOf(lib, book.id);
  const byPage = useMemo(() => {
    const m = new Map<number, BookMark[]>();
    for (const x of marks) if (x.kind !== 'bookmark') m.set(x.page, [...(m.get(x.page) ?? []), x]);
    return m;
  }, [marks]);
  const bookmarks = useMemo(() => new Set(marks.filter(m => m.kind === 'bookmark').map(m => m.page)), [marks]);
  /* The record as it is now: chapters added from the drawer land in the store, not in the prop the shelf passed. */
  const bk = lib.books[book.id] ?? book;
  const chapterAt = (page: number) => sectionAt(bk, page)?.chapterKey;

  /* Chapters by hand, from the page being read. The book takes the chapter's
     subject and class when it had none. Undo puts the old map back. */
  const addChapterHere = (key: string) => {
    const before = bk.sections;
    const [cls, subj, name] = key.split('|');
    store.updateBook(book.id, {
      sections: addChapterAt(before, current, key, bk.pages),
      ...(bk.subject ? {} : { subject: subj as BookSubject }),
      ...(bk.classId ? {} : { classId: Number(cls) as 11 | 12 }),
    });
    setToast({ text: `${name} starts on page ${current}.`, undo: () => store.updateBook(book.id, { sections: before }) });
  };
  const removeChapter = (from: number) => {
    const before = bk.sections;
    const gone = before.find(x => x.from === from);
    store.updateBook(book.id, { sections: removeChapterAt(before, from) });
    if (gone) setToast({ text: `${chapterOfKey(gone.chapterKey)} taken off this book.`, undo: () => store.updateBook(book.id, { sections: before }) });
  };

  /* A selection inside one page's text layer, snapped to whole words. */
  useEffect(() => {
    let t = 0;
    const read = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelected(null); return; }
      const r = sel.getRangeAt(0);
      const startEl = (r.startContainer.nodeType === 1 ? r.startContainer as Element : r.startContainer.parentElement)?.closest('.textLayer');
      if (!startEl || !scrollRef.current?.contains(startEl)) { setSelected(null); return; }
      const page = Number((startEl as HTMLElement).dataset.page);
      const endEl = (r.endContainer.nodeType === 1 ? r.endContainer as Element : r.endContainer.parentElement)?.closest('.textLayer');
      const text = layerText(startEl);
      const s0 = offsetAt(startEl, r.startContainer, r.startOffset);
      // A selection running onto the next page stops at the end of this one.
      const e0 = endEl === startEl ? offsetAt(startEl, r.endContainer, r.endOffset) : text.length;
      const [start, end] = snapToWords(text, s0, e0);
      if (end <= start) { setSelected(null); return; }
      const range = rangeAt(startEl, start, end);
      const pageEl = startEl.closest('.bk-page');
      if (!range || !pageEl) { setSelected(null); return; }
      const rects = rectsOf(range, pageEl);
      if (!rects.length) { setSelected(null); return; }
      setSelected({ page, start, end, quote: quoteOf(text, start, end), rects, box: range.getBoundingClientRect() });
    };
    const onChange = () => { window.clearTimeout(t); t = window.setTimeout(read, coarse() ? 350 : 120); };
    document.addEventListener('selectionchange', onChange);
    return () => { document.removeEventListener('selectionchange', onChange); window.clearTimeout(t); };
  }, []);

  const clearSelection = () => { window.getSelection()?.removeAllRanges(); setSelected(null); };

  const highlight = (c: MarkColor, withNote = false) => {
    if (!selected) return;
    setLastColor(c);
    const id = store.addBookMark({
      bookId: book.id, kind: 'highlight', page: selected.page, start: selected.start, end: selected.end,
      quote: selected.quote, rects: selected.rects, color: c,
    });
    clearSelection();
    if (id && withNote) setNoteFor(id);
  };

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).then(() => setToast({ text: 'Copied.' }), () => setToast({ text: "Couldn't copy." })); };

  const remove = (m: BookMark) => {
    store.deleteBookMark(m.id);
    setMenu(null);
    setToast({ text: m.kind === 'snip' ? 'Snip removed.' : 'Highlight removed.', undo: () => store.restoreBookMark(m.id) });
  };

  const sourceOf = async (m: { page: number; quote?: string; rects?: PageRect[]; kind?: BookMark['kind'] }): Promise<MarkSource> => {
    const src: MarkSource = { book, page: m.page, chapterKey: chapterAt(m.page), quote: m.quote };
    if (m.kind === 'snip' && m.rects?.[0] && doc) {
      src.rect = m.rects[0];
      src.image = (await renderSnip(doc, m.page, m.rects[0]).catch(() => null)) ?? undefined;
    }
    return src;
  };

  const send = async (to: Send, m: { page: number; quote?: string; rects?: PageRect[]; kind?: BookMark['kind']; note?: string }) => {
    if (!links) return;
    const src = await sourceOf(m);
    if (to === 'makeCard') { setCard(src); return; }
    if (to === 'logMistake') {
      links.logMistake({ bookId: book.id, bookTitle: book.title, page: src.page, chapterKey: src.chapterKey, quote: src.quote, image: src.image, rect: src.rect });
      return;
    }
    // To the chapter's notes page, staying here.
    const key = src.chapterKey;
    if (!key || !src.quote) { setToast({ text: 'File this page under a chapter first (Edit on the shelf).' }); return; }
    const [, subject, chapter] = key.split('|');
    if (!links.notes.on) links.notes.enable();
    const href = `/?open=learn&book=${encodeURIComponent(book.id)}&page=${src.page}`;
    const blocks = [
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: src.quote }] }] },
      ...(m.note ? [{ type: 'paragraph', content: [{ type: 'text', text: m.note }] }] : []),
      { type: 'paragraph', content: [{ type: 'text', text: `${book.title}, p. ${src.page}`, marks: [{ type: 'italic' }, { type: 'link', attrs: { href } }] }] },
    ];
    try {
      const { appendToChapter } = await import('../notes/append');
      await appendToChapter(links.notes.owner, links.notes.signedIn, { key, chapter, subject }, blocks);
      setToast({ text: `Added to your ${chapter} notes.`, action: { label: 'Open', run: () => links.notes.open(key) } });
    } catch {
      setToast({ text: "Couldn't add it to your notes." });
    }
  };

  const onSnip = useCallback((page: number, rect: PageRect) => {
    setSnipping(false);
    const id = store.addBookMark({ bookId: book.id, kind: 'snip', page, rects: [rect], color: 'blue' });
    if (!id) return;
    // Open its menu right away: a snip is almost always made to be sent somewhere.
    const m = store.getLibrary().bookMarks[id];
    const pageBox = pagesRef.current?.querySelector(`.bk-page[data-page="${page}"]`)?.getBoundingClientRect();
    if (m && pageBox) {
      const [x, y, w, h] = rect;
      setMenu({ mark: m, box: new DOMRect(pageBox.left + x * pageBox.width, pageBox.top + y * pageBox.height, w * pageBox.width, h * pageBox.height) });
    }
  }, [store, book.id]);

  const onMarkTap = useCallback((mark: BookMark, box: DOMRect) => { clearSelection(); setMenu({ mark, box }); }, []);

  const toggleBookmark = () => {
    const existing = marks.find(m => m.kind === 'bookmark' && m.page === current);
    if (existing) { store.deleteBookMark(existing.id); setToast({ text: `Bookmark on page ${current} removed.`, undo: () => store.restoreBookMark(existing.id) }); }
    else { store.addBookMark({ bookId: book.id, kind: 'bookmark', page: current }); setToast({ text: `Page ${current} bookmarked.` }); }
  };

  /* ── Keys ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if (e.key === 'Escape') {
        if (noteFor) return;
        if (menu) { setMenu(null); return; }
        if (selected) { clearSelection(); return; }
        if (snipping) { setSnipping(false); return; }
        if (drawer) { setDrawer(null); return; }
        onClose();
        return;
      }
      if (typing || e.altKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setDrawer('search'); return; }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomStep(1); }
        if (e.key === '-') { e.preventDefault(); zoomStep(-1); }
        if (e.key === '0') { e.preventDefault(); zoomTo(1); }
        return;
      }
      if (e.key === '/') { e.preventDefault(); setDrawer('search'); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (paged && e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        if (paged) turn(1); else scrollToPage(Math.min(doc?.numPages ?? 1, current + 1), 0, true);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (paged && e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        if (paged) turn(-1); else scrollToPage(Math.max(1, current - 1), 0, true);
      }
      else if (e.key === '+' || e.key === '=') zoomStep(1);
      else if (e.key === '-') zoomStep(-1);
      else if (e.key.toLowerCase() === 'g') { e.preventDefault(); pageFieldRef.current?.(); }
      else if (e.key.toLowerCase() === 'b') toggleBookmark();
      else if (e.key.toLowerCase() === 's') setSnipping(s => !s);
      else if (e.key.toLowerCase() === 'n') setDrawer(d => (d === 'marks' ? null : 'marks'));
      else if (e.key.toLowerCase() === 'c') setDrawer(d => (d === 'contents' ? null : 'contents'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* Ctrl/⌘ + wheel or a trackpad pinch zooms the page, not the app. */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let acc = 0;
    let side = 0;
    let lastTurn = 0;
    const onWheel = (e: WheelEvent) => {
      if (paged && !e.ctrlKey && !e.metaKey && zoom <= 1) {
        // A sideways trackpad swipe (or a wheel, when the view fits) turns the page.
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        e.preventDefault();
        side += d;
        if (Math.abs(side) > 60 && Date.now() - lastTurn > 450) { turn(side > 0 ? 1 : -1); side = 0; lastTurn = Date.now(); }
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) > 40) { zoomStep(acc < 0 ? 1 : -1); acc = 0; }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.undo ? 6000 : 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const chapterKey = chapterAt(current);
  const chapter = chapterKey ? chapterOfKey(chapterKey) : null;
  const total = doc?.numPages ?? book.pages;
  const subject = (chapterKey?.split('|')[1] ?? book.subject) as Subject | undefined;
  const noteMark = noteFor ? lib.bookMarks[noteFor] : null;

  /* Paged geometry: the view in front and its neighbours, each fitted whole
     to the stage and placed one stage-width apart on a track that slides. */
  const aspectOf = (n: number) => { const sz = sizesRef.current.get(n) ?? base; return sz[1] / sz[0]; };
  const [stageW, stageH] = stage;
  const pagedViews = paged && doc ? [-1, 0, 1].flatMap(o => {
    const pages = views[viewIndex + o];
    if (!pages) return [];
    return [{ o, pages, fit: fitView(pages.map(aspectOf), stageW, stageH, zoom) }];
  }) : [];
  const front = pagedViews.find(v => v.o === 0);
  const slotW = front ? Math.max(stageW, front.fit.total + 48) : stageW;
  const trackH = front ? Math.max(stageH, front.fit.height + 48) : stageH;

  /* Touch: a sideways swipe turns the page. The mouse selects text, so it turns with keys, the edge arrows or a trackpad swipe. */
  const swipe = useRef<{ x: number; y: number; t: number; on: boolean } | null>(null);
  const onStageDown = (e: React.PointerEvent) => {
    if (menu) setMenu(null);
    if (!paged || e.pointerType !== 'touch' || zoom > 1 || snipping) return;
    swipe.current = { x: e.clientX, y: e.clientY, t: Date.now(), on: false };
  };
  const onStageMove = (e: React.PointerEvent) => {
    const sw = swipe.current;
    if (!sw) return;
    const dx = e.clientX - sw.x;
    const dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { swipe.current = null; return; }
      sw.on = true;
    }
    const edge = (dx > 0 && viewIndex === 0) || (dx < 0 && viewIndex === views.length - 1);
    setSlide({ dx: edge ? dx * 0.3 : dx, anim: false });
  };
  const onStageUp = (e: React.PointerEvent) => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw?.on) return;
    const dir = swipeTurns(e.clientX - sw.x, stageW, Date.now() - sw.t);
    if (dir) turn(dir); else setSlide({ dx: 0, anim: true });
  };

  const room = (
    <div className="bk-room safe-top" data-color={color} data-chrome={chrome || !!drawer ? 'on' : 'off'}>
      <header className="bk-top">
        <button type="button" className="th-ib" onClick={onClose} aria-label="Back to the shelf">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="bk-title">
          <span className="bk-title-main">{book.title}</span>
          <span className="bk-title-sub">{chapter ?? (book.subject ?? 'Book')}</span>
        </div>
        <div className="bk-tools">
          {subject && (
            <ClockPill
              timer={timer}
              otherSession={otherSession}
              nudge={false}
              onStart={() => onStartClock(subject, chapter ?? undefined)}
              onOpenToday={onOpenToday}
            />
          )}
          <button type="button" className="th-ib" onClick={() => setDrawer(d => (d === 'search' ? null : 'search'))} aria-pressed={drawer === 'search'} aria-label="Search (/)" title="Search (/)">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <button type="button" className="th-ib" onClick={() => setSnipping(s => !s)} aria-pressed={snipping} aria-label="Snip a part of the page (S)" title="Snip (S)">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6.5" r="3" />
              <circle cx="6" cy="17.5" r="3" />
              <path d="M8.4 8.3 20 18.5M8.4 15.7 20 5.5" />
            </svg>
          </button>
          <button type="button" className="th-ib" onClick={toggleBookmark} aria-pressed={bookmarks.has(current)} aria-label="Bookmark this page (B)" title="Bookmark (B)">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20z" fill={bookmarks.has(current) ? '#E10600' : 'none'} stroke={bookmarks.has(current) ? '#E10600' : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="th-ib" onClick={() => setDrawer(d => (d && d !== 'search' ? null : 'contents'))} aria-pressed={drawer === 'contents' || drawer === 'marks'} aria-label="Contents and marks" title="Contents (C) · Marks (N)">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="bk-scroll"
        data-layout={paged ? 'paged' : 'scroll'}
        data-zoomed={paged && zoom > 1 ? 'true' : undefined}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={() => { if (swipe.current?.on) setSlide({ dx: 0, anim: true }); swipe.current = null; }}
        onClick={e => {
          // A plain tap on a page brings the bars back (or puts them away); a selection or a mark is not a tap.
          if (snipping || (e.target as Element).closest('.bk-hl, .bk-snip')) return;
          if (!window.getSelection()?.isCollapsed) return;
          if ((e.target as Element).closest('.bk-page')) setChrome(c => !c);
        }}
      >
        {failed ? (
          <div className="bk-failed">
            <p>{failed}</p>
            <button type="button" className="bk-btn" onClick={onClose}>Back to the shelf</button>
          </div>
        ) : !doc ? (
          <div className="bk-failed" aria-busy="true"><p>Opening…</p></div>
        ) : paged ? (
          <div
            ref={pagesRef}
            className="bk-track"
            data-snipping={snipping ? 'true' : undefined}
            data-anim={slide.anim ? 'true' : undefined}
            style={{ width: slotW, height: trackH, transform: `translate3d(${slide.dx}px, 0, 0)` }}
          >
            {pagedViews.flatMap(({ o, pages, fit }) => {
              const x0 = o * slotW + Math.max(24, (slotW - fit.total) / 2);
              const y0 = Math.max(24, (trackH - fit.height) / 2);
              let x = x0;
              return pages.map((n, i) => {
                const left = x;
                x += fit.widths[i] + 16;
                return (
                  <PageView
                    key={n}
                    doc={doc}
                    n={n}
                    width={fit.widths[i]}
                    height={fit.height}
                    near
                    marks={byPage.get(n) ?? EMPTY}
                    bookmarked={bookmarks.has(n)}
                    snipping={snipping && o === 0}
                    onSize={onSize}
                    onSnip={onSnip}
                    onMarkTap={onMarkTap}
                    place={{ left, top: y0 }}
                  />
                );
              });
            })}
          </div>
        ) : (
          <div ref={pagesRef} className="bk-pages" data-snipping={snipping ? 'true' : undefined}>
            {Array.from({ length: doc.numPages }, (_, i) => {
              const n = i + 1;
              const [w, h] = sizeOf(n);
              return (
                <PageView
                  key={n}
                  doc={doc}
                  n={n}
                  width={w}
                  height={h}
                  near={near.has(n)}
                  marks={byPage.get(n) ?? EMPTY}
                  bookmarked={bookmarks.has(n)}
                  snipping={snipping}
                  onSize={onSize}
                  onSnip={onSnip}
                  onMarkTap={onMarkTap}
                />
              );
            })}
          </div>
        )}
      </div>

      {paged && doc && !coarse() && (
        <>
          <button type="button" className="bk-turn" data-side="prev" onClick={() => turn(-1)} disabled={viewIndex === 0} aria-label="Previous page">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="bk-turn" data-side="next" onClick={() => turn(1)} disabled={viewIndex >= views.length - 1} aria-label="Next page">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}

      <footer className="bk-foot">
        <PageField
          label={layout === 'spread' && views[viewIndex]?.length === 2 ? `${views[viewIndex][0]}–${views[viewIndex][1]}` : String(current)}
          current={current}
          total={total}
          onGo={p => jump(p)}
          focusRef={pageFieldRef}
        />
        <span className="bk-foot-group" role="radiogroup" aria-label="Page layout">
          <LayoutButton value="scroll" on={layout === 'scroll'} label="Scroll down" onPick={chooseLayout} />
          <LayoutButton value="flip" on={layout === 'flip'} label="Flip pages" onPick={chooseLayout} />
          {viewW >= 700 && <LayoutButton value="spread" on={layout === 'spread'} label="Two pages" onPick={chooseLayout} />}
        </span>
        <span className="bk-foot-group">
          <button type="button" className="th-ib" onClick={() => zoomStep(-1)} aria-label="Smaller">−</button>
          <button type="button" className="bk-zoom" onClick={() => zoomTo(1)} title="Fit width">{Math.round(zoom * 100)}%</button>
          <button type="button" className="th-ib" onClick={() => zoomStep(1)} aria-label="Bigger">+</button>
        </span>
        <span className="bk-foot-group" role="radiogroup" aria-label="Page colour">
          {(['paper', 'sepia', 'night'] as PageColor[]).map(c => (
            <button key={c} type="button" role="radio" aria-checked={color === c} className="bk-pc" data-pc={c} onClick={() => setColor(c)} aria-label={c === 'paper' ? 'Original' : c === 'sepia' ? 'Sepia' : 'Night'} />
          ))}
        </span>
      </footer>
      <div className="bk-progress" aria-hidden="true"><span style={{ width: `${(current / Math.max(1, total)) * 100}%` }} /></div>

      {snipping && <div className="bk-hint" role="status">Drag over the part of the page you want. Esc to stop.</div>}

      {selected && !menu && (
        <Tools box={selected.box}>
          {MARK_COLORS.map(c => (
            <button key={c} type="button" className="bk-sw" aria-label={`Highlight ${c}`} aria-pressed={c === lastColor} style={{ ['--sw' as string]: SWATCH[c] }} onClick={() => highlight(c)}><i /></button>
          ))}
          <span className="bk-sep" />
          <button type="button" className="bk-tool" onClick={() => highlight(lastColor, true)}>Note</button>
          {links && <button type="button" className="bk-tool" onClick={() => { const s = selected; clearSelection(); void send('makeCard', { page: s.page, quote: s.quote }); }}>Card</button>}
          {links && <button type="button" className="bk-tool" onClick={() => { const s = selected; clearSelection(); void send('toNotes', { page: s.page, quote: s.quote }); }}>To notes</button>}
          {links && <button type="button" className="bk-tool" onClick={() => { const s = selected; clearSelection(); void send('logMistake', { page: s.page, quote: s.quote }); }}>Mistake</button>}
          <button type="button" className="bk-tool" onClick={() => { copy(selected.quote); clearSelection(); }}>Copy</button>
        </Tools>
      )}

      {menu && (
        <Tools box={menu.box} menu>
          {menu.mark.kind === 'highlight' && (
            <div className="bk-menu-row">
              {MARK_COLORS.map(c => (
                <button key={c} type="button" className="bk-sw" aria-label={c} aria-pressed={c === menu.mark.color} style={{ ['--sw' as string]: SWATCH[c] }}
                  onClick={() => { store.updateBookMark(menu.mark.id, { color: c }); setLastColor(c); setMenu(null); }}><i /></button>
              ))}
            </div>
          )}
          {menu.mark.note && <p className="bk-menu-note">{menu.mark.note}</p>}
          <button type="button" className="bk-menu-item" onClick={() => { setNoteFor(menu.mark.id); setMenu(null); }}>{menu.mark.note ? 'Edit note' : 'Add a note'}</button>
          {links && <button type="button" className="bk-menu-item" onClick={() => { const m = menu.mark; setMenu(null); void send('makeCard', m); }}>Make a flashcard</button>}
          {links && menu.mark.kind === 'highlight' && <button type="button" className="bk-menu-item" onClick={() => { const m = menu.mark; setMenu(null); void send('toNotes', m); }}>Add to chapter notes</button>}
          {links && <button type="button" className="bk-menu-item" onClick={() => { const m = menu.mark; setMenu(null); void send('logMistake', m); }}>Log as a mistake</button>}
          {menu.mark.quote && <button type="button" className="bk-menu-item" onClick={() => { copy(menu.mark.quote!); setMenu(null); }}>Copy</button>}
          <button type="button" className="bk-menu-item bk-danger" onClick={() => remove(menu.mark)}>{menu.mark.kind === 'snip' ? 'Remove snip' : 'Remove highlight'}</button>
        </Tools>
      )}

      {noteMark && !noteMark.deletedAt && (
        <NoteEditor mark={noteMark} onDone={text => { store.updateBookMark(noteMark.id, { note: text }); setNoteFor(null); }} />
      )}

      {card && links && (
        <Suspense fallback={null}>
          <CardSheet src={card} userId={links.userId} onClose={() => setCard(null)} onDone={text => { setCard(null); setToast({ text }); }} />
        </Suspense>
      )}


      {drawer && doc && (
        <Drawer
          tab={drawer}
          onTab={setDrawer}
          doc={doc}
          book={bk}
          marks={marks}
          current={current}
          exam={exam}
          onAddChapter={addChapterHere}
          onRemoveChapter={removeChapter}
          onJump={p => { jump(p); if (phone) setDrawer(null); }}
          onClose={() => setDrawer(null)}
        />
      )}

      {toast && (
        <div className="bk-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
          {toast.action && <button type="button" onClick={() => { const a = toast.action!; setToast(null); a.run(); }}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );

  return createPortal(room, document.body);
}

const EMPTY: BookMark[] = [];

/* ── The three ways to lay pages out, as small pictures of themselves ── */

const LayoutButton = ({ value, on, label, onPick }: { value: PageLayout; on: boolean; label: string; onPick: (l: PageLayout) => void }) => (
  <button type="button" role="radio" aria-checked={on} className="bk-lay" onClick={() => onPick(value)} aria-label={label} title={label}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      {value === 'scroll' && (
        <>
          <rect x="7" y="2.5" width="10" height="8.5" rx="1" />
          <rect x="7" y="13" width="10" height="8.5" rx="1" />
        </>
      )}
      {value === 'flip' && (
        <>
          <rect x="6.5" y="3.5" width="11" height="17" rx="1" />
          <path d="M14 20.5v-3.5h3.5" />
          <path d="M3 12h1.5M19.5 12H21" strokeLinecap="round" />
        </>
      )}
      {value === 'spread' && (
        <>
          <path d="M12 6.5c-2.5-1.6-5.5-2-8.5-1.6v13.2c3-.4 6 0 8.5 1.6 2.5-1.6 5.5-2 8.5-1.6V4.9c-3-.4-6 0-8.5 1.6z" />
          <path d="M12 6.5v13.2" />
        </>
      )}
    </svg>
  </button>
);

/* ── A floating toolbar or menu, placed by the reader's own rule ── */

const Tools = ({ box, menu, children }: { box: DOMRect; menu?: boolean; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setPos(place(box, el.offsetWidth, el.offsetHeight, coarse(), 64));
  }, [box.top, box.left, box.width, box.height]);
  return (
    <div
      ref={ref}
      className={menu ? 'bk-menu' : 'bk-tools-pop'}
      role={menu ? 'menu' : 'toolbar'}
      style={pos}
      onPointerDown={e => { if (!menu) e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={e => { if (!menu) e.preventDefault(); }}
    >
      {children}
    </div>
  );
};

/* ── A note: saved however it is closed ── */

const NoteEditor = ({ mark, onDone }: { mark: BookMark; onDone: (text: string) => void }) => {
  const [text, setText] = useState(mark.note ?? '');
  const ref = useRef(text);
  ref.current = text;
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => area.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); e.stopPropagation(); onDone(ref.current); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.clearTimeout(id); window.removeEventListener('keydown', onKey, true); };
  }, [onDone]);
  return (
    <>
      <div className="bk-scrim" onClick={() => onDone(ref.current)} />
      <div className="bk-sheet" role="dialog" aria-label="Note">
        <div className="bk-sheet-head">
          <h3>{mark.note ? 'Your note' : 'Add a note'}</h3>
          <button type="button" className="bk-btn bk-primary" onClick={() => onDone(text)}>Done</button>
        </div>
        {mark.quote && <blockquote className="bk-quote" style={{ ['--sw' as string]: SWATCH[mark.color ?? 'yellow'] }}>{mark.quote}</blockquote>}
        <textarea ref={area} value={text} maxLength={4000} onChange={e => setText(e.target.value)} placeholder="Why does this matter? What will you do about it?" />
        <p className="bk-sheet-foot">Saved when you close it.</p>
      </div>
    </>
  );
};

/* ── Go to a page: the page number in the bottom bar is a field ──
   Tap it (or press G) and type: Enter jumps, Esc or tapping away puts the
   current page back. A number past the end goes to the last page. While
   it is not being typed in it shows where you are, "2–3" in a spread. */

const PageField = ({ label, current, total, onGo, focusRef }: {
  label: string;
  current: number;
  total: number;
  onGo: (p: number) => void;
  focusRef: React.MutableRefObject<(() => void) | null>;
}) => {
  const [typing, setTyping] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  focusRef.current = () => { ref.current?.focus(); ref.current?.select(); };
  const go = () => {
    const n = Math.round(Number(typing));
    if (typing !== null && typing.trim() && Number.isFinite(n)) onGo(Math.min(total, Math.max(1, n)));
    setTyping(null);
    ref.current?.blur();
  };
  const width = `${Math.max(2, String(total).length, (typing ?? label).length) + 0.5}ch`;
  return (
    <label className="bk-pageno" title="Type a page number and press Enter (G)">
      <input
        ref={ref}
        className="bk-pageno-input"
        value={typing ?? label}
        inputMode="numeric"
        enterKeyHint="go"
        aria-label={`Page ${current} of ${total}. Type a page number to go there.`}
        style={{ width }}
        onFocus={e => { setTyping(String(current)); requestAnimationFrame(() => e.target.select()); }}
        onChange={e => setTyping(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); go(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTyping(null); ref.current?.blur(); }
        }}
        onBlur={() => setTyping(null)}
      />
      <span>/ {total}</span>
    </label>
  );
};

/* ── Contents, marks, search ── */

interface DrawerProps {
  tab: 'contents' | 'marks' | 'search';
  onTab: (t: 'contents' | 'marks' | 'search') => void;
  doc: PDFDocumentProxy;
  book: Book;
  marks: BookMark[];
  current: number;
  exam: ExamPreference;
  onAddChapter: (chapterKey: string) => void;
  onRemoveChapter: (from: number) => void;
  onJump: (page: number) => void;
  onClose: () => void;
}

const Drawer = ({ tab, onTab, doc, book, marks, current, exam, onAddChapter, onRemoveChapter, onJump, onClose }: DrawerProps) => {
  const [outline, setOutline] = useState<OutlineEntry[] | null>(null);
  useEffect(() => { void outlineOf(doc).then(setOutline, () => setOutline([])); }, [doc]);

  return (
    <aside className="bk-drawer" aria-label="Contents, marks and search">
      <div className="bk-drawer-tabs" role="tablist">
        {(['contents', 'marks', 'search'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
            {t === 'contents' ? 'Contents' : t === 'marks' ? `Marks${marks.length ? ` · ${marks.length}` : ''}` : 'Search'}
          </button>
        ))}
        <button type="button" className="bk-drawer-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="bk-drawer-body">
        {tab === 'contents' && (
          <>
            <section>
              <h4>Chapters</h4>
              {book.sections.length === 0 && <p className="bk-dim">No chapters yet. Go to the page a chapter starts on and add it here.</p>}
              {[...book.sections].sort((a, b) => a.from - b.from).map(sec => (
                <div key={`${sec.chapterKey}-${sec.from}`} className="bk-chap-row" data-on={current >= sec.from && current <= sec.to ? 'true' : undefined}>
                  <button type="button" className="bk-row-btn" onClick={() => onJump(sec.from)}>
                    <span>{chapterOfKey(sec.chapterKey)}</span><span className="bk-pg">p. {sec.from}–{sec.to}</span>
                  </button>
                  <button type="button" className="bk-chap-x" onClick={() => onRemoveChapter(sec.from)} aria-label={`Take ${chapterOfKey(sec.chapterKey)} off this book`} title="Take off this book">×</button>
                </div>
              ))}
              <ChapterAdder book={book} current={current} exam={exam} onAdd={onAddChapter} />
            </section>
            <section>
              <h4>In the file</h4>
              {outline === null ? <p className="bk-dim">Reading…</p> : outline.length === 0 ? <p className="bk-dim">This PDF has no contents of its own.</p> : outline.map((o, i) => (
                <button key={`${o.page}-${i}`} type="button" className="bk-row-btn" onClick={() => onJump(o.page)}>
                  <span>{o.title}</span><span className="bk-pg">p. {o.page}</span>
                </button>
              ))}
            </section>
          </>
        )}
        {tab === 'marks' && (
          marks.length === 0
            ? <p className="bk-dim">Select words to highlight them, press S to snip a part of a page, B to bookmark one. They all collect here.</p>
            : marks.map(m => (
              <button key={m.id} type="button" className="bk-mark-row" onClick={() => onJump(m.page)}>
                <span className="bk-mark-kind" style={{ ['--sw' as string]: SWATCH[m.color ?? 'yellow'] }} data-kind={m.kind} />
                <span className="bk-mark-text">
                  <span>{m.kind === 'bookmark' ? `Bookmark` : m.kind === 'snip' ? 'Snip' : m.quote}</span>
                  {m.note && <em>{m.note}</em>}
                </span>
                <span className="bk-pg">p. {m.page}</span>
              </button>
            ))
        )}
        {tab === 'search' && <Search doc={doc} onJump={onJump} />}
      </div>
    </aside>
  );
};

/* ── This page starts a chapter ──
   The way to map a book by hand: go to where a chapter begins (the page
   field, or the book's own contents), then name it. Subject first when the
   book has none, then class, then the chapter, from the student's syllabus. */
const ChapterAdder = ({ book, current, exam, onAdd }: { book: Book; current: number; exam: ExamPreference; onAdd: (key: string) => void }) => {
  const subjects = subjectsFor(exam) as BookSubject[];
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<BookSubject>(book.subject && subjects.includes(book.subject) ? book.subject : subjects[0]);
  const [cls, setCls] = useState<11 | 12>(book.classId ?? 11);
  const chapters = getChaptersFor(exam, cls, subject);
  const taken = new Set(book.sections.map(x => x.chapterKey));
  const [chapter, setChapter] = useState('');
  const here = sectionAt(book, current);

  if (!open) {
    return (
      <button type="button" className="bk-add-chap" onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Page {current} starts a chapter
      </button>
    );
  }
  return (
    <form
      className="bk-adder"
      onSubmit={e => { e.preventDefault(); if (!chapter) return; onAdd(`${cls}|${subject}|${chapter}`); setChapter(''); setOpen(false); }}
    >
      <p className="bk-adder-lead">
        Which chapter starts on page {current}?
        {here && <span> It is in {chapterOfKey(here.chapterKey)} now; that chapter will end on page {current - 1}.</span>}
      </p>
      {!book.subject && (
        <div className="bk-adder-chips" role="radiogroup" aria-label="Subject">
          {subjects.map(x => (
            <button key={x} type="button" role="radio" aria-checked={subject === x} onClick={() => { setSubject(x); setChapter(''); }}>{x}</button>
          ))}
        </div>
      )}
      <div className="bk-adder-chips" role="radiogroup" aria-label="Class">
        {([11, 12] as const).map(c => (
          <button key={c} type="button" role="radio" aria-checked={cls === c} onClick={() => { setCls(c); setChapter(''); }}>Class {c}</button>
        ))}
      </div>
      <select className="bk-input" value={chapter} onChange={e => setChapter(e.target.value)} aria-label="Chapter" autoFocus>
        <option value="">Choose the chapter</option>
        {chapters.map(c => (
          <option key={c} value={c}>{c}{taken.has(`${cls}|${subject}|${c}`) ? ' · already in this book' : ''}</option>
        ))}
      </select>
      <div className="bk-adder-actions">
        <button type="button" className="bk-btn" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="bk-btn bk-primary" disabled={!chapter}>Add from page {current}</button>
      </div>
    </form>
  );
};

const Search = ({ doc, onJump }: { doc: PDFDocumentProxy; onJump: (page: number) => void }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ page: number; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState('');
  const run = useRef(0);
  const cache = useRef(new Map<number, string>());

  const go = async (query: string) => {
    const id = ++run.current;
    setHits([]);
    setSearched(query);
    if (query.trim().length < 2) return;
    setBusy(true);
    const found: { page: number; text: string }[] = [];
    for (let p = 1; p <= doc.numPages && found.length < 200; p++) {
      if (run.current !== id) return;
      let text = cache.current.get(p);
      if (text === undefined) {
        text = await textOfPage(doc, p).catch(() => '');
        cache.current.set(p, text);
      }
      for (const [s, e] of searchPage(text, query)) found.push({ page: p, text: contextOf(text, s, e, 40) });
      if (p % 15 === 0) setHits([...found]);
    }
    if (run.current === id) { setHits(found); setBusy(false); }
  };

  return (
    <div className="bk-search">
      <form onSubmit={e => { e.preventDefault(); void go(q); }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search this book" aria-label="Search this book" />
      </form>
      {busy && <p className="bk-dim">Searching…</p>}
      {!busy && searched && hits.length === 0 && <p className="bk-dim">Nothing found for “{searched}”. A scanned PDF has no text to search.</p>}
      {hits.map((h, i) => (
        <button key={i} type="button" className="bk-row-btn bk-hit" onClick={() => onJump(h.page)}>
          <span>{h.text}</span><span className="bk-pg">p. {h.page}</span>
        </button>
      ))}
    </div>
  );
};
