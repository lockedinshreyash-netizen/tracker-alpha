/* Small pieces the Notes tab shares: an anchored popover (portalled, so the
   rail cannot paint over it), the emoji and chapter pickers, and the page
   menu. Every popover closes on an outside press and on Escape. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SUBJECT_COLORS } from '../schedule/colors';
import { STATUS_HEX } from './status';
import type { ChapterOption } from './editor/env';
import { fold } from './text';
import type { PageFont } from './workspace';
import type { SyllabusStatus } from '../types';

export function Popover({ anchor, onClose, children, width = 280, align = 'left' }: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  const vw = window.innerWidth;
  const left = align === 'right' ? Math.max(8, Math.min(anchor.right - width, vw - width - 8)) : Math.max(8, Math.min(anchor.left, vw - width - 8));
  const below = window.innerHeight - anchor.bottom > 360 || anchor.top < 360;
  const style: React.CSSProperties = below ? { left, top: anchor.bottom + 6 } : { left, bottom: window.innerHeight - anchor.top + 6 };
  return createPortal(
    <>
      <div className="nt-scrim-clear" onMouseDown={onClose} />
      <div className="nt-pop" style={{ ...style, width }}>{children}</div>
    </>,
    document.body,
  );
}

export function ChapterPicker({ anchor, chapters, status, current, onPick, onClose }: {
  anchor: DOMRect;
  chapters: ChapterOption[];
  status: (key: string) => SyllabusStatus | null;
  current: string | null;
  onPick: (c: ChapterOption | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useMemo(() => {
    const f = fold(q.trim());
    return chapters.filter(c => !f || fold(c.name).includes(f) || fold(c.subject).startsWith(f)).slice(0, 60);
  }, [chapters, q]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [i]);
  let group = '';
  return (
    <Popover anchor={anchor} onClose={onClose} width={340}>
      <div className="nt-picker">
        <input
          autoFocus
          value={q}
          placeholder="Find a chapter"
          onChange={e => { setQ(e.target.value); setI(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(n => Math.min(n + 1, list.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI(n => Math.max(n - 1, 0)); }
            if (e.key === 'Enter' && list[i]) { e.preventDefault(); onPick(list[i]); onClose(); }
          }}
        />
        <div className="nt-picker-list" ref={ref}>
          {current && (
            <button type="button" className="nt-suggest-item is-danger" onClick={() => { onPick(null); onClose(); }}>
              <span className="nt-glyph">×</span><span className="nt-suggest-label">Unlink chapter</span>
            </button>
          )}
          {list.map((c, n) => {
            const head = `${c.subject} · Class ${c.classId}`;
            const show = head !== group;
            group = head;
            const st = status(c.key);
            return (
              <React.Fragment key={c.key}>
                {show && <p className="nt-pop-group">{head}</p>}
                <button type="button" className="nt-suggest-item" data-active={n === i} onMouseEnter={() => setI(n)}
                  onClick={() => { onPick(c); onClose(); }}>
                  <span className="nt-glyph" style={{ color: (SUBJECT_COLORS[c.subject] ?? SUBJECT_COLORS.General).dot }}>
                    <i style={{ width: 7, height: 7, borderRadius: 99, background: STATUS_HEX[st ?? 'not_started'] }} />
                  </span>
                  <span className="nt-suggest-label">{c.name}</span>
                  {current === c.key && <span className="nt-suggest-hint">linked</span>}
                </button>
              </React.Fragment>
            );
          })}
          {!list.length && <p className="nt-suggest-empty">No chapter by that name.</p>}
        </div>
      </div>
    </Popover>
  );
}

export function PageMenu({ anchor, onClose, font, wide, linked, onFont, onWide, onLink, onSummary, onCopy, onMove, onTrash, info }: {
  anchor: DOMRect;
  onClose: () => void;
  font: PageFont;
  wide: boolean;
  linked: boolean;
  onFont: (f: PageFont) => void;
  onWide: () => void;
  onLink: () => void;
  /** Present only while the page has no summary line. */
  onSummary?: () => void;
  onCopy: () => void;
  onMove: () => void;
  onTrash: () => void;
  info?: string;
}) {
  const item = (glyph: string, label: string, run: () => void, hint?: string, danger = false, keepOpen = false) => (
    <button type="button" className={`nt-suggest-item${danger ? ' is-danger' : ''}`} onClick={() => { run(); if (!keepOpen) onClose(); }}>
      <span className="nt-glyph">{glyph}</span><span className="nt-suggest-label">{label}</span>{hint && <span className="nt-suggest-hint">{hint}</span>}
    </button>
  );
  return (
    <Popover anchor={anchor} onClose={onClose} width={268} align="right">
      <div className="nt-menu">
        <p className="nt-pop-group">Typeface</p>
        <div className="nt-seg">
          {([['serif', 'Book'], ['sans', 'Sans'], ['mono', 'Mono']] as const).map(([f, label]) => (
            <button key={f} type="button" data-on={font === f} onClick={() => onFont(f)}>
              <span style={{ fontFamily: f === 'serif' ? "'Literata', Georgia, serif" : f === 'mono' ? 'var(--font-mono)' : 'var(--font-ui)', fontWeight: f === 'sans' ? 700 : 500 }}>Ag</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        {item('↔', 'Full width', onWide, wide ? 'on' : 'off', false, true)}
        {item('@', linked ? 'Change chapter' : 'Link a chapter', onLink, undefined, false, true)}
        {onSummary && item('“', 'Add a summary', onSummary, undefined, false, true)}
        <span className="nt-pop-rule" />
        {item('⇥', 'Move inside…', onMove, undefined, false, true)}
        {item('M↓', 'Copy as Markdown', onCopy)}
        <span className="nt-pop-rule" />
        {item('×', 'Move to trash', onTrash, undefined, true)}
        {info && <p className="nt-pop-info">{info}</p>}
      </div>
    </Popover>
  );
}

/** Literata, for serif pages. Shared with the reader's link, so it never loads twice. */
export const useSerifFont = (on: boolean) => {
  useEffect(() => {
    if (!on || document.querySelector('link[data-reader-font]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400;1,7..72,500&display=swap';
    link.dataset.readerFont = '1';
    document.head.appendChild(link);
  }, [on]);
};

export const relTime = (ms: number, now = Date.now()): string => {
  const d = Math.max(0, now - ms);
  if (d < 60_000) return 'Just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
