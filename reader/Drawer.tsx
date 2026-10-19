import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BookChapter } from '../content/book';
import { BOOK } from '../content/book';
import {
  HIGHLIGHT_COLORS, actionSteps, isActionDone, live, minutesFor, searchBook,
  type Bookmark, type Highlight, type HighlightColor, type ReadingState, type SearchHit,
} from './model';
import { SWATCH } from './Page';
import { IconBookmark, IconCheck, IconChevron, IconClose, IconCopy, IconNote, IconSearch, IconTrash, Ring } from './icons';

export type DrawerTab = 'contents' | 'notebook' | 'bookmarks' | 'search';

interface Props {
  chapters: BookChapter[];
  current: number;
  reading: ReadingState;
  bookProgress: number;
  minutesLeft: number;
  tab: DrawerTab;
  initialQuery?: string;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
  onChapter: (i: number) => void;
  onHighlight: (h: Highlight) => void;
  onEditNote: (h: Highlight) => void;
  onDeleteHighlight: (h: Highlight) => void;
  onBookmark: (b: Bookmark) => void;
  onDeleteBookmark: (b: Bookmark) => void;
  onHit: (hit: SearchHit, query: string) => void;
  onToggleAction: (id: string) => void;
  onCopyAll: () => void;
}

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

type Filter = 'all' | 'notes' | HighlightColor;

const Drawer = (p: Props) => {
  const { chapters, reading, tab } = p;
  const highlights: Highlight[] = useMemo(() => live<Highlight>(reading.highlights), [reading.highlights]);
  const bookmarks: Bookmark[] = useMemo(() => live<Bookmark>(reading.bookmarks), [reading.bookmarks]);
  const byChapter = useMemo(() => new Map(chapters.map((c, i) => [c.id, i])), [chapters]);
  const [filter, setFilter] = useState<Filter>('all');
  /* The steps are a checklist, not the notebook's point: folded to one row
     of progress unless the student opens them. */
  const [stepsOpen, setStepsOpen] = useState(false);
  const [query, setQuery] = useState(p.initialQuery ?? '');
  const [debounced, setDebounced] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 160);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (tab === 'search') window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [tab]);
  useEffect(() => { if (p.initialQuery) setQuery(p.initialQuery); }, [p.initialQuery]);

  const hits: SearchHit[] = useMemo(() => searchBook(chapters, debounced), [chapters, debounced]);
  const steps = useMemo(() => actionSteps(chapters), [chapters]);
  const stepsDone = steps.filter(s => isActionDone(reading, s.block.id)).length;

  /* Notebook entries in book order: by chapter, then where they start. */
  const entries: Highlight[] = useMemo(() => {
    const keep = highlights.filter(h =>
      filter === 'all' ? true : filter === 'notes' ? !!h.note : h.color === filter);
    return keep.sort((a, b) => (byChapter.get(a.chapterId) ?? 99) - (byChapter.get(b.chapterId) ?? 99) || a.createdAt - b.createdAt);
  }, [highlights, filter, byChapter]);

  const grouped = <T extends { chapterId: string }>(xs: T[]) => {
    const out: Array<{ ch: BookChapter; items: T[] }> = [];
    xs.forEach(x => {
      const ch = chapters[byChapter.get(x.chapterId) ?? -1];
      if (!ch) return;
      const last = out[out.length - 1];
      if (last && last.ch.id === ch.id) last.items.push(x); else out.push({ ch, items: [x] });
    });
    return out;
  };

  const counts = {
    notebook: highlights.length,
    bookmarks: bookmarks.length,
  };

  return (
    <>
      <div className="rd-scrim" onClick={p.onClose} />
      <aside className="rd-drawer" role="dialog" aria-label="Book">
        <div className="rd-drawer-head">
          <div className="rd-drawer-top">
            <h2>{BOOK.title}</h2>
            <button type="button" className="rd-ib" aria-label="Close" onClick={p.onClose}><IconClose /></button>
          </div>
          <div className="rd-tabs" role="tablist">
            {([['contents', 'Contents'], ['notebook', 'Notebook'], ['bookmarks', 'Marks'], ['search', 'Search']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => p.onTab(id)}>
                {label}
                {id === 'notebook' && counts.notebook > 0 && <sup>{counts.notebook}</sup>}
                {id === 'bookmarks' && counts.bookmarks > 0 && <sup>{counts.bookmarks}</sup>}
              </button>
            ))}
          </div>
        </div>

        <div className="rd-drawer-body">
          {/* ─── Contents ─── */}
          {tab === 'contents' && (
            <>
              <div className="rd-cover">
                <div className="rd-cover-art" aria-hidden><span>LOCK</span><span>IN.</span><i /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{BOOK.title}</h3>
                  <p>{BOOK.subtitle}</p>
                  <div className="rd-bar-meter"><i style={{ width: `${Math.round(p.bookProgress * 100)}%` }} /></div>
                  <small>{Math.round(p.bookProgress * 100)}% read · {p.minutesLeft} min left · {stepsDone}/{steps.length} action steps</small>
                </div>
              </div>
              {chapters.map((c, i) => (
                <React.Fragment key={c.id}>
                  {c.part && <div className="rd-toc-part">{c.part.title}</div>}
                  <button type="button" className="rd-row" aria-current={i === p.current} onClick={() => p.onChapter(i)}>
                    <span className="rd-row-main">
                      <small>{c.number}</small>
                      <b>{c.title}</b>
                    </span>
                    <span className="rd-row-side">
                      {highlights.some(h => h.chapterId === c.id) && (
                        <span aria-label="Highlights in this chapter" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 9, background: 'var(--sw-yellow)', display: 'inline-block' }} />
                          {highlights.filter(h => h.chapterId === c.id).length}
                        </span>
                      )}
                      <span>{minutesFor(c)}m</span>
                      <Ring value={reading.furthest[c.id] ?? 0} />
                    </span>
                  </button>
                </React.Fragment>
              ))}
            </>
          )}

          {/* ─── Notebook ─── */}
          {tab === 'notebook' && (
            <>
              <button type="button" className="rd-steps-sum" aria-expanded={stepsOpen} onClick={() => setStepsOpen(v => !v)}>
                <span className="rd-steps-title">Action steps</span>
                <span className="rd-steps-dots" aria-label={`${stepsDone} of ${steps.length} done`}>
                  {steps.map(st => <i key={st.block.id} data-on={isActionDone(reading, st.block.id)} />)}
                </span>
                <span className="rd-steps-count">{stepsDone}/{steps.length}</span>
                <span className="rd-steps-chev" data-open={stepsOpen}><IconChevron /></span>
              </button>
              {stepsOpen && <div className="rd-steps">
                {steps.map(s => {
                  const done = isActionDone(reading, s.block.id);
                  return (
                    <div key={s.block.id} className="rd-step" data-done={done}>
                      <button type="button" className="rd-step-check" aria-pressed={done} aria-label={done ? 'Mark not done' : 'Mark done'} onClick={() => p.onToggleAction(s.block.id)}>
                        {done && <IconCheck />}
                      </button>
                      <button
                        type="button"
                        className="rd-step-text"
                        onClick={() => {
                          const ch = chapters[byChapter.get(s.chapterId) ?? 0];
                          p.onHit({ chapterId: ch.id, u: s.block.id, from: 0, to: 0, before: '', match: '', after: '' }, '');
                        }}
                      >
                        <small>{s.block.label}</small>
                        <span>{s.block.text.replace(/\*/g, '')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>}

              <div className="rd-section">
                <span>Highlights & notes</span>
                {highlights.length > 0 && <button type="button" onClick={p.onCopyAll}><IconCopy /> Copy all</button>}
              </div>
              {highlights.length > 0 && (
                <div className="rd-filters">
                  <button type="button" className="rd-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All {highlights.length}</button>
                  <button type="button" className="rd-chip" aria-pressed={filter === 'notes'} onClick={() => setFilter('notes')}>
                    <IconNote /> Notes {highlights.filter(h => h.note).length}
                  </button>
                  {HIGHLIGHT_COLORS.filter(c => highlights.some(h => h.color === c)).map(c => (
                    <button key={c} type="button" className="rd-chip" aria-pressed={filter === c} aria-label={`${c} highlights`} style={{ ['--sw' as string]: SWATCH[c] }} onClick={() => setFilter(c)}>
                      <i />{highlights.filter(h => h.color === c).length}
                    </button>
                  ))}
                </div>
              )}

              {highlights.length === 0 ? (
                <div className="rd-empty">
                  <span className="rd-empty-demo">You will <mark>remember the lines you mark.</mark></span>
                  <h3>Your notebook is empty</h3>
                  <p>Select any line in the book to highlight it or add a note. Everything you mark collects here.</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="rd-empty"><p>Nothing matches this filter.</p></div>
              ) : grouped<Highlight>(entries).map(g => (
                <div key={g.ch.id}>
                  <div className="rd-section"><span>{g.ch.number} · {g.ch.title.replace(/\.$/, '')}</span></div>
                  {g.items.map(h => (
                    <div key={h.id} style={{ position: 'relative' }}>
                      <button type="button" className="rd-entry" style={{ ['--sw' as string]: SWATCH[h.color] }} onClick={() => p.onHighlight(h)}>
                        <i />
                        <span className="rd-entry-body">
                          <q>{h.quote}</q>
                          {h.note && <span className="rd-entry-note"><IconNote /><span>{h.note}</span></span>}
                          <span className="rd-entry-meta" style={{ display: 'block' }}>{fmtDate(h.updatedAt)}</span>
                        </span>
                      </button>
                      <span style={{ position: 'absolute', right: 10, bottom: 6, display: 'flex' }}>
                        <button type="button" className="rd-ib" style={{ width: 34, height: 34 }} aria-label={h.note ? 'Edit note' : 'Add a note'} onClick={() => p.onEditNote(h)}><IconNote /></button>
                        <button type="button" className="rd-ib" style={{ width: 34, height: 34 }} aria-label="Remove highlight" onClick={() => p.onDeleteHighlight(h)}><IconTrash /></button>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* ─── Bookmarks ─── */}
          {tab === 'bookmarks' && (
            bookmarks.length === 0 ? (
              <div className="rd-empty">
                <span style={{ color: 'var(--rd-accent)', display: 'inline-block', width: 34, height: 34 }}><IconBookmark filled /></span>
                <h3>No bookmarks yet</h3>
                <p>Tap the ribbon at the top while you read to mark a page you want to come back to.</p>
              </div>
            ) : grouped<Bookmark>([...bookmarks].sort((a, b) => (byChapter.get(a.chapterId) ?? 0) - (byChapter.get(b.chapterId) ?? 0) || a.createdAt - b.createdAt)).map(g => (
              <div key={g.ch.id}>
                <div className="rd-section"><span>{g.ch.number} · {g.ch.title.replace(/\.$/, '')}</span></div>
                {g.items.map(b => (
                  <div key={b.id} style={{ position: 'relative' }}>
                    <button type="button" className="rd-entry" style={{ ['--sw' as string]: 'var(--rd-accent)', paddingRight: 56 }} onClick={() => p.onBookmark(b)}>
                      <i />
                      <span className="rd-entry-body">
                        <q>{b.snippet}</q>
                        <span className="rd-entry-meta" style={{ display: 'block' }}>{fmtDate(b.createdAt)}</span>
                      </span>
                    </button>
                    <button type="button" className="rd-ib" style={{ position: 'absolute', right: 10, top: 10, width: 34, height: 34 }} aria-label="Remove bookmark" onClick={() => p.onDeleteBookmark(b)}><IconTrash /></button>
                  </div>
                ))}
              </div>
            ))
          )}

          {/* ─── Search ─── */}
          {tab === 'search' && (
            <>
              <label className="rd-searchbox">
                <IconSearch />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  placeholder="Search the book"
                  aria-label="Search the book"
                  enterKeyHint="search"
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && hits[0]) p.onHit(hits[0], debounced); }}
                />
                {query && <button type="button" className="rd-ib" style={{ width: 30, height: 30 }} aria-label="Clear" onClick={() => setQuery('')}><IconClose /></button>}
              </label>
              {debounced.trim().length >= 2 && (
                <p className="rd-count">{hits.length === 0 ? 'No matches' : `${hits.length}${hits.length >= 300 ? '+' : ''} match${hits.length === 1 ? '' : 'es'}`}</p>
              )}
              {debounced.trim().length < 2 ? (
                <div className="rd-empty">
                  <h3>Find any line</h3>
                  <p>Try “dopamine”, “Rahul” or “purpose”.</p>
                </div>
              ) : grouped<SearchHit>(hits).map(g => (
                <div key={g.ch.id}>
                  <div className="rd-section"><span>{g.ch.number} · {g.ch.title.replace(/\.$/, '')}</span><span>{g.items.length}</span></div>
                  {g.items.map((h, i) => (
                    <button key={`${h.u}-${h.from}-${i}`} type="button" className="rd-hit" onClick={() => p.onHit(h, debounced)}>
                      {h.before}<mark>{h.match}</mark>{h.after}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default Drawer;
