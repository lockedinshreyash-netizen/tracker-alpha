/* ── ⌘K ──
   Titles first, then words inside pages, from the plain-text index the store
   keeps on this device, so search is instant and works offline. Empty, it
   lists what you edited last. Enter opens; the last row makes a new page
   with what you typed. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NotesStore } from './store';
import { ancestors, pageSubject, type Tree } from './workspace';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { Subject } from '../types';
import { fold } from './text';
import { relTime } from './ui';

interface Hit { id: string; title: string; icon: string; where: string; before?: string; match?: string; after?: string }

export default function SearchPalette({ store, tree, onOpen, onCreate, onClose }: {
  store: NotesStore;
  tree: Tree;
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [texts, setTexts] = useState<Map<string, string> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void store.allTexts().then(t => setTexts(new Map(t))); }, [store]);

  const hits = useMemo<Hit[]>(() => {
    const where = (id: string) => ancestors(tree, id).map(a => a.title || 'Untitled').join(' / ');
    const f = fold(q.trim());
    if (!f) {
      return [...tree.live].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
        .map(p => ({ id: p.id, title: p.title, icon: p.icon, where: relTime(p.updatedAt) }));
    }
    const scored: (Hit & { score: number })[] = [];
    tree.live.forEach(p => {
      const t = fold(p.title);
      let score = t.startsWith(f) ? 3 : t.includes(f) ? 2 : 0;
      let before: string | undefined, match: string | undefined, after: string | undefined;
      const body = texts?.get(p.id) ?? '';
      if (body) {
        const fb = fold(body);
        const at = fb.indexOf(f);
        // fold() keeps length for everything but rare combining marks, so the
        // index lines up with the original text closely enough for a snippet.
        if (at >= 0) {
          if (!score) score = 1;
          const s = Math.max(0, at - 40);
          before = (s ? '…' : '') + body.slice(s, at).replace(/\s+/g, ' ');
          match = body.slice(at, at + f.length);
          after = body.slice(at + f.length, at + f.length + 80).replace(/\s+/g, ' ');
        }
      }
      if (score) scored.push({ id: p.id, title: p.title, icon: p.icon, where: where(p.id), before, match, after, score: score * 1e13 + p.updatedAt });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 30);
  }, [q, tree, texts]);

  const total = hits.length + (q.trim() ? 1 : 0);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [i]);

  const choose = (n: number) => {
    if (n < hits.length) onOpen(hits[n].id);
    else if (q.trim()) onCreate(q.trim());
    onClose();
  };

  return createPortal(
    <>
      <div className="nt-search-scrim" onMouseDown={onClose} />
      <div className="nt-pop nt-search" role="dialog" aria-label="Search notes">
        <input
          autoFocus
          className="nt-search-input"
          value={q}
          placeholder="Search"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(n => Math.min(n + 1, total - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI(n => Math.max(n - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); choose(i); }
          }}
        />
        <div className="nt-search-list" ref={listRef}>
          {!q.trim() && hits.length > 0 && <p className="nt-pop-group">Recent</p>}
          {hits.map((h, n) => (
            <button key={h.id} type="button" className="nt-suggest-item nt-search-hit" data-active={n === i} onMouseEnter={() => setI(n)} onClick={() => choose(n)}>
              <span className="nt-glyph">{(() => { const sub = pageSubject(tree, h.id) as Subject | null; return <i style={sub ? { background: (SUBJECT_COLORS[sub] ?? SUBJECT_COLORS.General).dot } : { boxShadow: 'inset 0 0 0 1.3px var(--nt-faint)' }} />; })()}</span>
              <span className="nt-suggest-label" style={{ whiteSpace: 'normal' }}>
                {h.title || 'Untitled'}
                {h.match && <small>{h.before}<mark>{h.match}</mark>{h.after}</small>}
              </span>
              {h.where && <span className="nt-search-path">{h.where}</span>}
            </button>
          ))}
          {!hits.length && q.trim() && <p className="nt-suggest-empty">Nothing matches “{q.trim()}”.</p>}
          {!hits.length && !q.trim() && <p className="nt-suggest-empty">No pages yet.</p>}
          {q.trim() && (
            <button type="button" className="nt-suggest-item" data-active={i === hits.length} onMouseEnter={() => setI(hits.length)} onClick={() => choose(hits.length)}>
              <span className="nt-glyph">+</span>
              <span className="nt-suggest-label">New page “{q.trim().slice(0, 60)}”</span>
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
