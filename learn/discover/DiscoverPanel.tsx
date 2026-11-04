/* ── Discover: one floating glass panel ──
   The whole of Discover is this panel over the shelf (a sheet from the bottom
   on a phone), opened by the Discover button, ⌘K, the empty shelf's "Find a
   lecture", or a chapter shelf's "Find on YouTube". It is liquid glass
   (ui/LiquidGlass.tsx) over a light, unblurred scrim that is its sibling,
   entering with `lg-pop`, and its list scrolls on an inner wrapper: the
   design system's glass rules.

   Type, Enter searches; ↑↓ pick; Enter files the picked result; ⌘Enter files
   it and starts watching; Esc closes. Nothing searches as you type: each
   search is one of today's 30. Before a search, the chapters you're on are
   one tap away. Opened from a chapter shelf, that chapter's search runs at
   once and results are filed under it.

   Where a result is filed: the chapter it was opened for, else the chapter
   the search names in the student's own syllabus (match.ts, on the device).
   With no chapter, subject chips appear so it is at least filed under the
   right subject; the toast then offers to set the chapter. */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Overlay } from '../../ui/kit';
import LiquidGlass from '../../ui/LiquidGlass';
import { getChaptersFor } from '../../constants';
import { SUBJECT_COLORS } from '../../schedule/colors';
import { chapterKeyOf, codeOf, live, type LearnSubject } from '../model';
import { subjectsFor } from '../LectureFields';
import type { LearnStore } from '../store';
import { searchYouTube, searchesLeft, type DiscoverFailure, type FoundVideo, type Length } from './api';
import { chapterQuery, guessChapter, type ChapterRef } from './match';
import { FromYouTube, RESULT_COPY, ResultRow, ResultsSkeleton, type ResultState } from './Results';
import type { ChapterProgress, ExamPreference } from '../../types';

interface Props {
  store: LearnStore;
  dark: boolean;
  examPreference: ExamPreference;
  progress: ChapterProgress[];
  /** Opened for one chapter (`11|Physics|Rotational Motion`): searched at once, filed there. */
  chapterKey: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onFiled: (id: string) => void;
}

type Search =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; results: FoundVideo[]; query: string }
  | { kind: 'failed'; reason: DiscoverFailure };

const refOf = (key: string | null, subjects: LearnSubject[]): ChapterRef | null => {
  const [c, s, chapter] = (key ?? '').split('|');
  const subject = subjects.find(x => x === s);
  return subject && (c === '11' || c === '12') && chapter ? { classId: Number(c) as 11 | 12, subject, chapter } : null;
};

export default function DiscoverPanel({ store, dark, examPreference, progress, chapterKey, onClose, onOpen, onFiled }: Props) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const lib = store.getLibrary();
  const subjects = useMemo(() => subjectsFor(examPreference), [examPreference]);
  const [pinned, setPinned] = useState<ChapterRef | null>(() => refOf(chapterKey, subjects));
  const [query, setQuery] = useState(() => (pinned ? chapterQuery(pinned.chapter, examPreference) : ''));
  const [length, setLength] = useState<Length>('long');
  const [search, setSearch] = useState<Search>({ kind: 'idle' });
  const [selected, setSelected] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [subjectPick, setSubjectPick] = useState<LearnSubject | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  // Every chapter of the student's syllabus, both classes, their own subjects first.
  const allChapters = useMemo<ChapterRef[]>(() => {
    const out: ChapterRef[] = [];
    for (const subject of subjects) for (const classId of [11, 12] as const) {
      for (const chapter of getChaptersFor(examPreference, classId, subject)) out.push({ classId, subject, chapter });
    }
    return out;
  }, [subjects, examPreference]);

  const searched = search.kind === 'done' ? search.query : query;
  const guess = useMemo(() => guessChapter(searched, allChapters), [searched, allChapters]);
  const chapter = pinned ?? guess;
  const subject: LearnSubject = chapter?.subject ?? subjectPick ?? subjects[0] ?? 'Physics';

  const doing = useMemo(
    () => [...progress].reverse().filter(p => p.status === 'in_progress' && subjects.includes(p.subject as LearnSubject)).slice(0, 5),
    [progress, subjects],
  );

  const run = async (q: string, len: Length) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    const me = ++runRef.current;
    setSearch({ kind: 'loading' });
    setSelected(0);
    const res = await searchYouTube(clean, len);
    if (me !== runRef.current) return;
    if (res.ok) {
      setSearch({ kind: 'done', results: res.results, query: clean });
      if (res.remaining !== null) setRemaining(res.remaining);
    } else {
      setSearch({ kind: 'failed', reason: res.reason });
      if (res.reason === 'limit') setRemaining(0);
    }
  };

  // Focus the box; a chapter's search runs at once (that tap meant "find lectures for this").
  useEffect(() => {
    inputRef.current?.focus();
    if (pinned) void run(query, length);
    else void searchesLeft().then(setRemaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateOf = (v: FoundVideo): ResultState => {
    const have = live(lib.lectures).find(l => l.videoId === v.id);
    return have ? { kind: 'have', code: codeOf(have), id: have.id } : { kind: 'new' };
  };

  const file = (v: FoundVideo, watch: boolean) => {
    if (!v.embeddable) return;
    const st = stateOf(v);
    if (st.kind === 'have') { onOpen(st.id); return; }
    const res = store.addLecture({
      videoId: v.id,
      title: v.title,
      titleSource: 'youtube',
      subject,
      chapterKey: chapter ? chapterKeyOf(chapter.classId, chapter.subject, chapter.chapter) : undefined,
    });
    if (watch || res.duplicate) onOpen(res.lecture.id);
    else onFiled(res.lecture.id);
  };

  const results = search.kind === 'done' ? search.results : [];
  const stale = search.kind !== 'done' || search.query !== query.trim();

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setSelected(i => Math.min(results.length - 1, i + 1)); return; }
    if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setSelected(i => Math.max(0, i - 1)); return; }
    if (e.key === 'Enter' && e.target === inputRef.current) {
      e.preventDefault();
      // Changed words search; unchanged words file the picked result.
      if (stale) void run(query, length);
      else if (results[selected]) file(results[selected], e.metaKey || e.ctrlKey);
    }
  };

  useEffect(() => {
    document.querySelector(`[data-sl-row="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const ink = dark ? 'text-white' : 'text-zinc-900';
  const chip = (on: boolean) => `px-2.5 py-1 rounded-full text-[11px] font-ui font-bold transition-colors ${
    on ? (dark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white') : dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
  }`;

  return (
    <Overlay>
      <div className="sl" data-theme={dark ? 'dark' : 'light'} role="dialog" aria-modal="true" aria-label="Discover lectures on YouTube" onKeyDown={onKey}>
        <div className="sl-scrim" onClick={onClose} />
        <LiquidGlass dark={dark} radius={24} variant="panel" bezel={18} strength={20} className="sl-panel lg-pop">
          <div className="sl-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={`shrink-0 ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value.slice(0, 120)); setSubjectPick(null); }}
              placeholder="Find a lecture on YouTube"
              aria-label="Search YouTube"
              className={`flex-1 min-w-0 bg-transparent outline-none font-ui text-[18px] sm:text-[20px] placeholder:text-zinc-500 ${ink}`}
            />
            <kbd className="sl-kbd">{stale && query.trim().length >= 2 ? '↵' : 'esc'}</kbd>
          </div>

          <div className="sl-meta">
            <span className="flex flex-wrap items-center gap-1.5 min-w-0 text-[11px] font-ui">
              {chapter ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1 font-bold ${dark ? 'bg-white/[0.08] text-zinc-200' : 'bg-black/[0.05] text-zinc-700'}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: SUBJECT_COLORS[chapter.subject].dot }} aria-hidden="true" />
                  <span className="truncate max-w-[220px]">{chapter.chapter}</span>
                  {pinned && (
                    <button type="button" onClick={() => setPinned(null)} aria-label="Don't file under this chapter" className="w-5 h-5 rounded-full hover:bg-white/[0.12] leading-none">×</button>
                  )}
                </span>
              ) : (
                <>
                  <span className="text-zinc-500 mr-0.5">Files under</span>
                  {subjects.map(s => (
                    <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubjectPick(s)} className={chip(subject === s)}>{s}</button>
                  ))}
                </>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {(['medium', 'long'] as Length[]).map(l => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={length === l}
                  onClick={() => { setLength(l); if (search.kind === 'done') void run(search.query, l); }}
                  className={chip(length === l)}
                >
                  {l === 'medium' ? '4–20 min' : 'Over 20 min'}
                </button>
              ))}
            </span>
          </div>

          <div className="sl-body">
            {search.kind === 'idle' && (
              <div className="space-y-4 p-3">
                {doing.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Chapters you're on</p>
                    <div className="flex flex-wrap gap-2">
                      {doing.map(p => (
                        <button
                          key={`${p.classId}|${p.subject}|${p.chapter}`}
                          type="button"
                          onClick={() => {
                            const ref = refOf(`${p.classId}|${p.subject}|${p.chapter}`, subjects);
                            setPinned(ref);
                            const q = chapterQuery(p.chapter, examPreference);
                            setQuery(q);
                            void run(q, length);
                          }}
                          className="px-3 py-1.5 rounded-full text-[12px] font-ui font-bold"
                          style={{ background: `${SUBJECT_COLORS[p.subject].dot}22`, color: dark ? SUBJECT_COLORS[p.subject].text : SUBJECT_COLORS[p.subject].textLight }}
                        >
                          {p.chapter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[12px] font-ui text-zinc-500 leading-relaxed">
                  Type, then press Enter. Each search is one of today's {remaining === null ? 30 : remaining}. Searches go to YouTube through Alpha; Alpha doesn't keep them.
                </p>
              </div>
            )}
            {search.kind === 'loading' && <div className="p-1"><ResultsSkeleton dark={dark} rows /></div>}
            {search.kind === 'failed' && (
              <div className="p-4 space-y-1.5" role="status">
                <p className={`text-[15px] font-ui font-bold ${ink}`}>{RESULT_COPY[search.reason]?.title}</p>
                <p className="text-[13px] font-ui text-zinc-500">{RESULT_COPY[search.reason]?.body}</p>
                {(search.reason === 'error' || search.reason === 'unreachable' || search.reason === 'offline') && (
                  <button type="button" onClick={() => void run(query, length)} className={`mt-2 text-[13px] font-ui font-bold underline underline-offset-2 ${ink}`}>Try again</button>
                )}
              </div>
            )}
            {search.kind === 'done' && results.length === 0 && (
              <div className="p-4 space-y-1.5" role="status">
                <p className={`text-[15px] font-ui font-bold ${ink}`}>Nothing for “{search.query}”.</p>
                <p className="text-[13px] font-ui text-zinc-500">Fewer words work better. Or try the other length.</p>
              </div>
            )}
            {results.length > 0 && (
              <ul role="listbox" aria-label="Results" className="space-y-1">
                {results.map((v, i) => (
                  <ResultRow
                    key={v.id}
                    index={i}
                    v={v}
                    dark={dark}
                    state={stateOf(v)}
                    selected={i === selected}
                    onSelect={() => setSelected(i)}
                    onAdd={() => file(v, false)}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="sl-foot">
            <span className="hidden sm:inline text-[11px] font-ui text-zinc-500">↑↓ pick · ↵ add · ⌘↵ add and watch · esc close</span>
            <FromYouTube dark={dark} remaining={search.kind === 'done' || search.kind === 'failed' ? remaining : null} />
          </div>
        </LiquidGlass>
      </div>
    </Overlay>
  );
}
