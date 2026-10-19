/* ── The reader ──

   One chapter at a time, scrolled, set like a book. Everything a student
   does here (a highlight, a note, a bookmark, a tick on an Action Step, the
   place they stopped) is one call to `onReading`, which App turns into one
   AppState write. The two things that would otherwise write constantly are
   held back on purpose:

   - the reading position is measured on every scroll but kept in a ref and
     in this device's localStorage, and written to AppState only when it
     matters (changing chapter, closing, the tab hiding, or every 30s);
   - a note is written once, when its editor closes, not per keystroke.

   The text is never re-laid by JavaScript. Highlights are spans inside the
   real paragraphs (reader/Page.tsx), anchored to permanent block ids
   (reader/model.ts), so they survive edits to the manuscript, a change of
   font size, and a phone turning sideways. */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './reader.css';
import { BOOK } from '../content/book';
import { CHAPTERS } from '../content/bookText';
import * as sfx from '../audio';
import {
  MAX_QUOTE, chapterUnits, isActionDone, actionSteps, live, newId, progressAt, rangeInUnit,
  resolveHighlight, snapToWords, textBetween, trimRange, unitIndex,
  type Anchor, type Bookmark, type Highlight, type HighlightColor, type Mark, type ReadingState, type SearchHit,
} from './model';
import { LEADINGS, MEASURES, SIZES, resolveTheme, useBookFont, useReaderSettings, type ReaderSettings } from './settings';
import { selectionAnchors, unitElement } from './anchors';
import Page from './Page';
import Drawer, { type DrawerTab } from './Drawer';
import { HighlightMenu, NoteSheet, SelectionTools, SettingsPanel, Toast, coarse, type ToastState } from './Panels';
import { IconBookmark, IconClose, IconList, IconSearch, TypeIcon } from './icons';

export interface ReaderDebug {
  settings?: Partial<ReaderSettings>;
  chapter?: number;
  /** Open with this panel up. */
  panel?: 'contents' | 'notebook' | 'bookmarks' | 'search' | 'settings' | 'note' | 'menu' | 'select' | 'end';
  query?: string;
  /** Hide the chrome, as if scrolled. */
  chromeHidden?: boolean;
}

export interface ReaderProps {
  theme: 'dark' | 'light';
  reading: ReadingState;
  onReading: (fn: (r: ReadingState) => ReadingState) => void;
  onClose: () => void;
  debug?: ReaderDebug;
}

interface Target { u: string; f: number; align?: number; flash?: boolean }
interface Sel { start: Anchor; end: Anchor; rect: DOMRect; text: string }

const POS_KEY = 'reader_pos_v1';
const COLOR_KEY = 'reader_color_v1';
const READING_LINE = 0.3;

const readLocalPos = (): (ReadingState['position']) => {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null');
    return p && typeof p.chapterId === 'string' ? p : null;
  } catch { return null; }
};

const copyText = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
};

const Reader = ({ theme, reading, onReading, onClose, debug }: ReaderProps) => {
  useBookFont();
  const [settings, setSettings] = useReaderSettings(debug?.settings);
  const pageTheme = resolveTheme(settings.theme, theme === 'dark');

  /* ─── Where to open ───
     The newer of this device's own last position and the account's: on the
     phone you left off at Chapter 3, so the laptop opens at Chapter 3. */
  const opening = useMemo(() => {
    if (typeof debug?.chapter === 'number') return { index: debug.chapter, target: { u: '', f: 0 } as Target };
    const mine = readLocalPos();
    const theirs = reading.position;
    const pos = mine && (!theirs || mine.at >= theirs.at) ? mine : theirs;
    const index = pos ? CHAPTERS.findIndex(c => c.id === pos.chapterId) : -1;
    return index >= 0 ? { index, target: { u: pos!.u, f: pos!.f } as Target } : { index: 0, target: { u: '', f: 0 } as Target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(opening.index);
  const chapter = CHAPTERS[index];
  const [chrome, setChrome] = useState(!debug?.chromeHidden);
  const [drawer, setDrawer] = useState<DrawerTab | null>(
    debug?.panel && ['contents', 'notebook', 'bookmarks', 'search'].includes(debug.panel) ? (debug.panel as DrawerTab) : null);
  const [drawerQuery, setDrawerQuery] = useState<string | undefined>(debug?.query);
  const [settingsAt, setSettingsAt] = useState<DOMRect | null | false>(debug?.panel === 'settings' ? null : false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [searchFlash, setSearchFlash] = useState<{ u: string; from: number; to: number } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [entering, setEntering] = useState(false);
  const [progress, setProgress] = useState(() => progressAt(CHAPTERS, chapter.id, null, 0));
  const [markInView, setMarkInView] = useState<string | null>(null);
  const [lastColor, setLastColor] = useState<HighlightColor>(() => {
    try { const c = localStorage.getItem(COLOR_KEY); return (['yellow', 'green', 'blue', 'pink'].includes(c ?? '') ? c : 'yellow') as HighlightColor; } catch { return 'yellow'; }
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Target | null>(opening.target);
  const posRef = useRef<{ chapterId: string; u: string; f: number } | null>(null);
  const userScrolled = useRef(false);
  const programmatic = useRef(false);
  const lastTop = useRef(0);
  const pointer = useRef<{ down: boolean; x: number; y: number; hadSel: boolean; moved: boolean }>({ down: false, x: 0, y: 0, hadSel: false, moved: false });
  const readingRef = useRef<ReadingState>(reading);
  readingRef.current = reading;

  const panelOpen = drawer !== null || settingsAt !== false || noteFor !== null;

  /* ─── Highlights on this page ─── */
  const chapterHighlights = useMemo(
    () => live<Highlight>(reading.highlights).filter(h => h.chapterId === chapter.id),
    [reading.highlights, chapter.id],
  );
  const marks = useMemo(() => {
    const m = new Map<string, Mark[]>();
    const push = (u: string, mark: Mark) => { const l = m.get(u); if (l) l.push(mark); else m.set(u, [mark]); };
    for (const h of chapterHighlights) {
      const at = resolveHighlight(chapter, h);
      if (!at) continue;
      const units = chapterUnits(chapter);
      const i0 = unitIndex(chapter, at.start.u);
      const i1 = unitIndex(chapter, at.end.u);
      for (let i = i0; i <= i1; i++) {
        const r = rangeInUnit(chapter, units[i].id, at.start, at.end);
        if (r) push(units[i].id, { from: r[0], to: r[1], id: h.id, kind: 'hl', color: h.color, note: !!h.note && i === i1 });
      }
    }
    if (searchFlash) push(searchFlash.u, { from: searchFlash.from, to: searchFlash.to, id: 'search', kind: 'search' });
    return m;
  }, [chapterHighlights, chapter, searchFlash]);

  const bookmarks = useMemo(() => live<Bookmark>(reading.bookmarks), [reading.bookmarks]);
  const bookmarked = useMemo(
    () => new Set(bookmarks.filter(b => b.chapterId === chapter.id).map(b => b.u)),
    [bookmarks, chapter.id],
  );
  const doneActions = useMemo(
    () => new Set(Object.entries(reading.actions).filter(([, v]) => v > 0).map(([k]) => k)),
    [reading.actions],
  );
  const steps = useMemo(() => actionSteps(CHAPTERS), []);
  const finish = useMemo(() => {
    const hs = live<Highlight>(reading.highlights);
    return {
      highlights: hs.length,
      notes: hs.filter(h => h.note).length,
      actionsDone: steps.filter(s => doneActions.has(s.block.id)).length,
      actionsTotal: steps.length,
    };
  }, [reading.highlights, steps, doneActions]);

  /* ─── Geometry ─── */
  const lineY = () => (scrollRef.current?.clientHeight ?? 800) * READING_LINE;

  /** Which unit sits on the reading line, and how far into it. */
  const measure = useCallback(() => {
    const sc = scrollRef.current;
    const root = pageRef.current;
    if (!sc || !root) return null;
    const top = sc.getBoundingClientRect().top;
    const line = top + lineY();
    const units = root.querySelectorAll<HTMLElement>('[data-u]');
    let best: { el: HTMLElement; r: DOMRect } | null = null;
    for (const el of units) {
      const r = el.getBoundingClientRect();
      if (r.top <= line) best = { el, r };
      else break;
    }
    if (!best) return units[0] ? { u: units[0].dataset.u!, f: 0 } : null;
    const f = Math.min(1, Math.max(0, (line - best.r.top) / Math.max(1, best.r.height)));
    // A bookmark counts as "here" while its unit is anywhere on screen.
    let inView: string | null = null;
    const vh = sc.clientHeight;
    for (const el of units) {
      if (!el.classList.contains('rd-bm')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 56 && r.top < top + vh - 44) { inView = el.dataset.u!; break; }
    }
    return { u: best.el.dataset.u!, f, inView };
  }, []);

  const scrollToTarget = useCallback((t: Target) => {
    const sc = scrollRef.current;
    if (!sc) return;
    programmatic.current = true;
    if (!t.u) {
      sc.scrollTop = 0;
    } else {
      const el = unitElement(pageRef.current, t.u);
      if (el) {
        const r = el.getBoundingClientRect();
        const y = r.top - sc.getBoundingClientRect().top + sc.scrollTop;
        const align = t.align ?? READING_LINE;
        sc.scrollTop = Math.max(0, y + t.f * r.height - sc.clientHeight * align);
        if (t.flash) {
          el.classList.remove('rd-flash');
          void el.offsetWidth;
          el.classList.add('rd-flash');
          window.setTimeout(() => el.classList.remove('rd-flash'), 2300);
        }
      }
    }
    lastTop.current = sc.scrollTop;
    requestAnimationFrame(() => { programmatic.current = false; });
  }, []);

  /* ─── Position: measured on scroll, written to AppState rarely ─── */
  const commit = useCallback(() => {
    const pos = posRef.current;
    if (!pos) return;
    const ch = CHAPTERS.find(c => c.id === pos.chapterId);
    if (!ch) return;
    const done = progressAt(CHAPTERS, pos.chapterId, pos.u, pos.f).chapter;
    onReading(r => {
      const was = r.furthest[pos.chapterId] ?? 0;
      const furthestMoved = done > was + 0.01;
      const same = r.position && r.position.chapterId === pos.chapterId && r.position.u === pos.u && Math.abs(r.position.f - pos.f) < 0.05;
      if (same && !furthestMoved) return r;
      return {
        ...r,
        position: { ...pos, at: Date.now() },
        furthest: furthestMoved ? { ...r.furthest, [pos.chapterId]: Math.min(1, done > 0.97 ? 1 : done) } : r.furthest,
      };
    });
  }, [onReading]);

  const saveLocal = useRef(0);
  const onScrollFrame = useCallback(() => {
    const m = measure();
    if (!m) return;
    posRef.current = { chapterId: chapter.id, u: m.u, f: m.f };
    setMarkInView(m.inView ?? null);
    const p = progressAt(CHAPTERS, chapter.id, m.u, m.f);
    setProgress(prev => (
      Math.round(prev.book * 200) === Math.round(p.book * 200) && prev.minutesLeftInChapter === p.minutesLeftInChapter && Math.round(prev.chapter * 100) === Math.round(p.chapter * 100)
        ? prev : p));
    const now = Date.now();
    if (!debug && now - saveLocal.current > 800) {
      saveLocal.current = now;
      try { localStorage.setItem(POS_KEY, JSON.stringify({ ...posRef.current, at: now })); } catch { /* ignore */ }
    }
  }, [measure, chapter.id, debug]);

  const frame = useRef(0);
  const onScroll = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const st = sc.scrollTop;
    const d = st - lastTop.current;
    lastTop.current = st;
    if (!programmatic.current) {
      userScrolled.current = true;
      if (st < 80) setChrome(true);
      else if (d > 6) setChrome(false);
      else if (d < -12) setChrome(true);
      if (st + sc.clientHeight > sc.scrollHeight - 120) setChrome(true);
      setMenu(null);
    }
    if (sel) {
      const s = window.getSelection();
      if (s && s.rangeCount) setSel(v => (v ? { ...v, rect: s.getRangeAt(0).getBoundingClientRect() } : v));
    }
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => { frame.current = 0; onScrollFrame(); });
    }
  }, [onScrollFrame, sel]);

  /* Restore or jump after a chapter renders, before paint. */
  useLayoutEffect(() => {
    const t = pending.current;
    pending.current = null;
    scrollToTarget(t ?? { u: '', f: 0 });
    onScrollFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /* The book face arrives after first paint and re-flows every line. If the
     student has not touched the page yet, put them back where they were. */
  useEffect(() => {
    let live = true;
    const t = { ...opening.target };
    document.fonts?.ready.then(() => {
      if (live && !userScrolled.current && t.u) { scrollToTarget(t); onScrollFrame(); }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Settings change the layout: keep the same words on the reading line. */
  const keepPlace = useRef<{ u: string; f: number } | null>(null);
  const changeSettings = useCallback((patch: Partial<ReaderSettings>) => {
    const p = posRef.current;
    const atTop = (scrollRef.current?.scrollTop ?? 0) < 24;
    keepPlace.current = atTop ? { u: '', f: 0 } : p ? { u: p.u, f: p.f } : null;
    setSettings(patch);
  }, [setSettings]);
  useLayoutEffect(() => {
    if (keepPlace.current) { scrollToTarget(keepPlace.current); keepPlace.current = null; }
  }, [settings, scrollToTarget]);

  /* Write the position when it matters. */
  useEffect(() => {
    if (debug) return;
    const every = window.setInterval(commit, 30_000);
    const onHide = () => { if (document.visibilityState === 'hidden') commit(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', commit);
    return () => {
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', commit);
      commit();
    };
  }, [commit, debug]);

  /* ─── Moving around ─── */
  const goChapter = useCallback((i: number, target?: Target) => {
    if (i < 0 || i >= CHAPTERS.length) return;
    if (!debug) commit();
    window.getSelection()?.removeAllRanges();
    setSel(null);
    setMenu(null);
    setDrawer(null);
    setChrome(true);
    if (i === index) { scrollToTarget(target ?? { u: '', f: 0 }); onScrollFrame(); return; }
    pending.current = target ?? { u: '', f: 0 };
    setEntering(true);
    window.setTimeout(() => setEntering(false), 500);
    setIndex(i);
  }, [commit, debug, index, scrollToTarget, onScrollFrame]);

  const goHighlight = useCallback((h: Highlight) => {
    const i = CHAPTERS.findIndex(c => c.id === h.chapterId);
    if (i < 0) return;
    const at = resolveHighlight(CHAPTERS[i], h);
    goChapter(i, { u: at?.start.u ?? '', f: 0, align: 0.32 });
    setActive(h.id);
    window.setTimeout(() => setActive(v => (v === h.id ? null : v)), 2600);
  }, [goChapter]);

  const goHit = useCallback((hit: SearchHit) => {
    const i = CHAPTERS.findIndex(c => c.id === hit.chapterId);
    if (i < 0) return;
    if (hit.to > hit.from) {
      setSearchFlash({ u: hit.u, from: hit.from, to: hit.to });
      window.setTimeout(() => setSearchFlash(v => (v && v.u === hit.u && v.from === hit.from ? null : v)), 3200);
      goChapter(i, { u: hit.u, f: 0, align: 0.36 });
    } else {
      goChapter(i, { u: hit.u, f: 0, align: 0.3, flash: true });
    }
  }, [goChapter]);

  /* ─── Selection → toolbar ─── */
  useEffect(() => {
    let t = 0;
    const update = () => {
      const root = pageRef.current;
      if (!root || noteFor || drawer) return;
      const s = selectionAnchors(root);
      if (!s) { setSel(null); return; }
      const raw = trimRange(chapter, s.start, s.end);
      if (!raw) { setSel(null); return; }
      const trimmed = snapToWords(chapter, raw.start, raw.end);
      setMenu(null);
      setSel({ ...trimmed, rect: s.range.getBoundingClientRect(), text: textBetween(chapter, trimmed.start, trimmed.end) });
    };
    const onChange = () => {
      window.clearTimeout(t);
      if (pointer.current.down && !coarse()) return;
      t = window.setTimeout(update, coarse() ? 380 : 60);
    };
    const onUp = () => {
      if (!pointer.current.down) return;
      pointer.current.down = false;
      window.clearTimeout(t);
      t = window.setTimeout(update, 10);
    };
    document.addEventListener('selectionchange', onChange);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [chapter, noteFor, drawer]);

  /* ─── Writing ─── */
  const updateHighlight = useCallback((id: string, patch: Partial<Highlight>) => {
    onReading(r => ({
      ...r,
      highlights: r.highlights.map(h => (h.id === id ? { ...h, ...patch, updatedAt: Date.now() } : h)),
    }));
  }, [onReading]);

  const addHighlight = useCallback((color: HighlightColor, withNote = false) => {
    if (!sel) return;
    const now = Date.now();
    const same = chapterHighlights.find(h => h.start.u === sel.start.u && h.start.o === sel.start.o && h.end.u === sel.end.u && h.end.o === sel.end.o);
    let id: string;
    if (same) {
      id = same.id;
      if (same.color !== color) updateHighlight(id, { color });
    } else {
      id = newId('h');
      const h: Highlight = {
        id, chapterId: chapter.id, start: sel.start, end: sel.end,
        quote: sel.text.slice(0, MAX_QUOTE), color, createdAt: now, updatedAt: now,
      };
      onReading(r => ({ ...r, highlights: [...r.highlights, h] }));
      setFresh(id);
      window.setTimeout(() => setFresh(v => (v === id ? null : v)), 700);
    }
    setLastColor(color);
    try { localStorage.setItem(COLOR_KEY, color); } catch { /* ignore */ }
    window.getSelection()?.removeAllRanges();
    setSel(null);
    if (withNote) setNoteFor(id);
  }, [sel, chapterHighlights, chapter.id, onReading, updateHighlight]);

  const removeHighlight = useCallback((id: string) => {
    const now = Date.now();
    updateHighlight(id, { deletedAt: now });
    setMenu(null);
    setToast({ text: 'Highlight removed', undo: () => updateHighlight(id, { deletedAt: undefined }) });
  }, [updateHighlight]);

  const saveNote = useCallback((note: string) => {
    const id = noteFor;
    setNoteFor(null);
    if (!id) return;
    const h = readingRef.current.highlights.find(x => x.id === id);
    if (!h) return;
    const clean = note.trim();
    if ((h.note ?? '') === clean) return;
    updateHighlight(id, { note: clean || undefined });
    if (clean) setToast({ text: h.note ? 'Note updated' : 'Note saved' });
  }, [noteFor, updateHighlight]);

  const toggleAction = useCallback((id: string) => {
    const done = isActionDone(readingRef.current, id);
    if (!done) sfx.play('task-done');
    onReading(r => ({ ...r, actions: { ...r.actions, [id]: done ? -Date.now() : Date.now() } }));
  }, [onReading]);

  const toggleBookmark = useCallback(() => {
    if (markInView) {
      const b = bookmarks.find(x => x.chapterId === chapter.id && x.u === markInView);
      if (b) {
        const now = Date.now();
        onReading(r => ({ ...r, bookmarks: r.bookmarks.map(x => (x.id === b.id ? { ...x, deletedAt: now, updatedAt: now } : x)) }));
        setToast({ text: 'Bookmark removed' });
        return;
      }
    }
    const pos = posRef.current;
    if (!pos) return;
    const unit = chapterUnits(chapter).find(u => u.id === pos.u);
    if (!unit) return;
    const now = Date.now();
    const snippet = unit.plain.length > 150 ? `${unit.plain.slice(0, 150).replace(/\s+\S*$/, '')}…` : unit.plain;
    const b: Bookmark = { id: newId('b'), chapterId: chapter.id, u: unit.id, snippet, createdAt: now, updatedAt: now };
    onReading(r => ({ ...r, bookmarks: [...r.bookmarks, b] }));
    setMarkInView(unit.id);
    setToast({ text: 'Bookmarked' });
  }, [markInView, bookmarks, chapter, onReading]);

  const deleteBookmark = useCallback((b: Bookmark) => {
    const now = Date.now();
    onReading(r => ({ ...r, bookmarks: r.bookmarks.map(x => (x.id === b.id ? { ...x, deletedAt: now, updatedAt: now } : x)) }));
  }, [onReading]);

  const quoteFor = useCallback((text: string, chId = chapter.id) => {
    const ch = CHAPTERS.find(c => c.id === chId) ?? chapter;
    return `“${text}”\n— ${BOOK.title} ${ch.number}: ${ch.title}`;
  }, [chapter]);

  const doCopy = useCallback(async (text: string) => {
    setToast({ text: (await copyText(text)) ? 'Copied' : 'Could not copy' });
  }, []);

  const copyNotebook = useCallback(() => {
    const hs = live<Highlight>(readingRef.current.highlights);
    const lines: string[] = [`${BOOK.title} — my notebook`, ''];
    CHAPTERS.forEach(ch => {
      const mine = hs.filter(h => h.chapterId === ch.id);
      if (!mine.length) return;
      lines.push(`## ${ch.number}: ${ch.title}`, '');
      mine.forEach(h => {
        lines.push(`> ${h.quote}`);
        if (h.note) lines.push('', h.note);
        lines.push('');
      });
    });
    void doCopy(lines.join('\n').trim());
  }, [doCopy]);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /* ─── Pointer on the page: open a highlight, a note, or toggle the chrome ─── */
  const onPointerDown = (e: React.PointerEvent) => {
    pointer.current = { down: true, x: e.clientX, y: e.clientY, hadSel: !!sel || !!menu, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointer.current.down && Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y) > 6) pointer.current.moved = true;
  };
  const onPageClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const pin = t.closest<HTMLElement>('[data-pin]');
    if (pin) { setMenu(null); setNoteFor(pin.dataset.pin!); return; }
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    const mark = t.closest<HTMLElement>('mark.rd-hl');
    if (mark) {
      const id = mark.dataset.h!;
      const all = pageRef.current?.querySelectorAll<HTMLElement>(`mark[data-h="${CSS.escape(id)}"]`);
      const rect = all && all.length ? new DOMRect(
        Math.min(...[...all].map(m => m.getBoundingClientRect().left)),
        all[0].getBoundingClientRect().top,
        Math.max(...[...all].map(m => m.getBoundingClientRect().right)) - Math.min(...[...all].map(m => m.getBoundingClientRect().left)),
        all[all.length - 1].getBoundingClientRect().bottom - all[0].getBoundingClientRect().top,
      ) : mark.getBoundingClientRect();
      setMenu({ id, rect });
      return;
    }
    if (t.closest('button, a, input, textarea, label')) return;
    if (pointer.current.moved || pointer.current.hadSel) { setMenu(null); return; }
    setMenu(null);
    setChrome(c => !c);
  };

  /* ─── Keyboard ─── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if (e.key === 'Escape') {
        if (noteFor) return; // the note sheet handles its own Escape (and saves)
        e.preventDefault();
        if (menu) setMenu(null);
        else if (sel) { window.getSelection()?.removeAllRanges(); setSel(null); }
        else if (settingsAt !== false) setSettingsAt(false);
        else if (drawer) setDrawer(null);
        else onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault(); setDrawerQuery(undefined); setDrawer('search'); return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || panelOpen) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goChapter(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goChapter(index - 1); }
      else if (e.key === '/') { e.preventDefault(); setDrawerQuery(undefined); setDrawer('search'); }
      else if (e.key.toLowerCase() === 'b') toggleBookmark();
      else if (e.key.toLowerCase() === 'c') setDrawer('contents');
      else if (e.key.toLowerCase() === 'n') setDrawer('notebook');
      else if (e.key === '+' || e.key === '=') changeSettings({ size: Math.min(SIZES.length - 1, settings.size + 1) });
      else if (e.key === '-') changeSettings({ size: Math.max(0, settings.size - 1) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [noteFor, menu, sel, settingsAt, drawer, panelOpen, index, goChapter, toggleBookmark, onClose, changeSettings, settings.size]);

  useEffect(() => { scrollRef.current?.focus({ preventScroll: true }); }, []);

  /* ─── Design board: put the requested state on screen ─── */
  useEffect(() => {
    if (!debug?.panel) return;
    const t = window.setTimeout(() => {
      const root = pageRef.current;
      if (!root) return;
      if (debug.panel === 'end') {
        const sc = scrollRef.current;
        if (sc) sc.scrollTop = sc.scrollHeight;
        return;
      }
      if (debug.panel === 'note' || debug.panel === 'menu') {
        const h = chapterHighlights.find(x => x.note) ?? chapterHighlights[0];
        if (!h) return;
        const at = resolveHighlight(chapter, h);
        if (at) scrollToTarget({ u: at.start.u, f: 0, align: 0.38 });
        if (debug.panel === 'note') setNoteFor(h.id);
        else {
          const m = root.querySelector<HTMLElement>(`mark[data-h="${CSS.escape(h.id)}"]`);
          if (m) setMenu({ id: h.id, rect: m.getBoundingClientRect() });
        }
        return;
      }
      if (debug.panel === 'select') {
        const units = chapterUnits(chapter).filter(u => u.kind === 'p' && u.plain.length > 160);
        const u = units[2] ?? units[0];
        const el = unitElement(root, u.id);
        const textNode = el?.firstChild;
        if (!el || !textNode) return;
        scrollToTarget({ u: u.id, f: 0, align: 0.4 });
        const r = document.createRange();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const n = walker.nextNode();
        if (!n) return;
        const words = (n.textContent ?? '').indexOf(' ', 18);
        r.setStart(n, Math.max(0, words + 1));
        r.setEnd(n, Math.min((n.textContent ?? '').length, words + 70));
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        const anchors = selectionAnchors(root);
        if (anchors) {
          const raw = trimRange(chapter, anchors.start, anchors.end);
          const tr = raw && snapToWords(chapter, raw.start, raw.end);
          if (tr) setSel({ ...tr, rect: r.getBoundingClientRect(), text: textBetween(chapter, tr.start, tr.end) });
        }
      }
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuHighlight = menu ? chapterHighlights.find(h => h.id === menu.id) ?? null : null;
  const noteHighlight = noteFor ? live<Highlight>(reading.highlights).find(h => h.id === noteFor) ?? null : null;
  const next = CHAPTERS[index + 1] ?? null;
  const pct = Math.round(progress.book * 100);
  const atEnd = progress.chapter >= 0.99;

  const style = {
    ['--rd-size' as string]: SIZES[settings.size],
    ['--rd-leading' as string]: LEADINGS[settings.leading],
    ['--rd-measure' as string]: MEASURES[settings.width],
  } as React.CSSProperties;

  return (
    <div ref={rootRef} className="rd" data-theme={pageTheme} data-chrome={chrome ? 'shown' : 'hidden'} style={style}>
      <div
        ref={scrollRef}
        className="rd-scroll"
        tabIndex={-1}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onClick={onPageClick}
      >
        <div ref={pageRef}>
          <Page
            chapter={chapter}
            index={index}
            total={CHAPTERS.length}
            next={next}
            marks={marks}
            bookmarked={bookmarked}
            doneActions={doneActions}
            freshId={fresh}
            activeId={active ?? menu?.id ?? null}
            serif={settings.font === 'serif'}
            justify={settings.justify}
            entering={entering}
            chapterHighlights={chapterHighlights.length}
            finish={finish}
            onToggleAction={toggleAction}
            onNext={() => goChapter(index + 1)}
            onOpenNotebook={() => setDrawer('notebook')}
            onRestart={() => goChapter(0)}
          />
        </div>
      </div>

      <header className="rd-bar rd-top">
        <button type="button" className="rd-ib" aria-label="Close the book" onClick={onClose}><IconClose /></button>
        <div className="rd-top-title">
          <b>{chapter.title}</b>
          <span>{BOOK.title} · {chapter.number}</span>
        </div>
        <button type="button" className="rd-ib" aria-label="Search the book" onClick={() => { setDrawerQuery(undefined); setDrawer('search'); }}><IconSearch /></button>
        <button type="button" className="rd-ib" aria-label="Reading settings" onClick={e => setSettingsAt(e.currentTarget.getBoundingClientRect())}><TypeIcon /></button>
        <button type="button" className="rd-ib" aria-label={markInView ? 'Remove bookmark' : 'Bookmark this page'} aria-pressed={!!markInView} onClick={toggleBookmark}><IconBookmark filled={!!markInView} /></button>
        <button type="button" className="rd-ib" aria-label="Contents and notebook" onClick={() => setDrawer('contents')}><IconList /></button>
      </header>

      <footer className="rd-bar rd-bottom">
        <span className="rd-crumb">{chapter.number}</span>
        <span>
          {atEnd ? <b>Chapter done</b> : <><b>{progress.minutesLeftInChapter} min</b> left in chapter</>}
          {' · '}{pct}%
        </span>
      </footer>

      <div className="rd-progress" aria-hidden><i style={{ ['--p' as string]: progress.book }} /></div>

      {sel && !panelOpen && (
        <SelectionTools
          rect={sel.rect}
          lastColor={lastColor}
          short={sel.text.length <= 40}
          canShare={canShare}
          onColor={c => addHighlight(c)}
          onNote={() => addHighlight(lastColor, true)}
          onCopy={() => { void doCopy(quoteFor(sel.text)); window.getSelection()?.removeAllRanges(); setSel(null); }}
          onShare={() => { void navigator.share?.({ text: quoteFor(sel.text) }).catch(() => {}); }}
          onSearch={() => { setDrawerQuery(sel.text); window.getSelection()?.removeAllRanges(); setSel(null); setDrawer('search'); }}
        />
      )}

      {menu && menuHighlight && !panelOpen && (
        <HighlightMenu
          rect={menu.rect}
          highlight={menuHighlight}
          onColor={c => { updateHighlight(menuHighlight.id, { color: c }); setLastColor(c); }}
          onNote={() => { setMenu(null); setNoteFor(menuHighlight.id); }}
          onCopy={() => { setMenu(null); void doCopy(quoteFor(menuHighlight.quote)); }}
          onDelete={() => removeHighlight(menuHighlight.id)}
        />
      )}

      {drawer && (
        <Drawer
          chapters={CHAPTERS}
          current={index}
          reading={reading}
          bookProgress={progress.book}
          minutesLeft={progress.minutesLeftInBook}
          tab={drawer}
          initialQuery={drawerQuery}
          onTab={setDrawer}
          onClose={() => setDrawer(null)}
          onChapter={i => goChapter(i)}
          onHighlight={goHighlight}
          onEditNote={h => setNoteFor(h.id)}
          onDeleteHighlight={h => removeHighlight(h.id)}
          onBookmark={b => {
            const i = CHAPTERS.findIndex(c => c.id === b.chapterId);
            goChapter(i, { u: b.u, f: 0, align: 0.25, flash: true });
          }}
          onDeleteBookmark={deleteBookmark}
          onHit={goHit}
          onToggleAction={toggleAction}
          onCopyAll={copyNotebook}
        />
      )}

      {settingsAt !== false && (
        <SettingsPanel
          settings={settings}
          current={pageTheme}
          anchor={settingsAt}
          onChange={changeSettings}
          onClose={() => setSettingsAt(false)}
        />
      )}

      {noteHighlight && <NoteSheet highlight={noteHighlight} onSave={saveNote} />}

      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default Reader;
