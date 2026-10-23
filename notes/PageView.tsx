/* ── One page ──
   A quiet toolbar (back, pin, more), then the page: a small subject tag when
   it belongs to a chapter, the title, a one-line summary only once one has
   been written, and the body. Everything else (typeface, width, word count,
   move, export) is one tap away in the ••• menu, not on the page.

   A new, empty page offers the formats it could start as, under the title,
   until the first word is written.

   The title is contentEditable (plain text only) rather than a textarea, so
   it wraps and sizes like the heading it is. The body's Yjs document is
   opened from the store when the page is shown and released when it is
   left. */

import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type * as Y from 'yjs';
import type { NotesStore } from './store';
import { descendants, pageSubject, type PageMeta, type PagePatch, type Tree } from './workspace';
import type { ChapterOption, NotesEnv } from './editor/env';
import { ChapterPicker, PageMenu, Popover, ShortcutsList, relTime } from './ui';
import { SUBJECT_COLORS } from '../schedule/colors';
import { STATUS_LABELS } from '../constants';
import { fold } from './text';
import { TEMPLATES, templateById } from './templates';
import { Sketch } from './Sketch';
import type { Subject, SyllabusStatus } from '../types';

const NoteEditor = lazy(() => import('./editor/NoteEditor'));

interface Props {
  store: NotesStore;
  page: PageMeta;
  tree: Tree;
  env: NotesEnv;
  dark: boolean;
  chapters: ChapterOption[];
  chapterStatus: (key: string) => SyllabusStatus | null;
  onOpen: (id: string) => void;
  onHome: () => void;
  onPatch: (patch: PagePatch) => void;
  onMove: (parent: string | null) => void;
  onTrash: () => void;
  onRestore: () => void;
  onTyping: (typing: boolean) => void;
}

type Pop = { kind: 'chapter' | 'menu' | 'move' | 'keys'; rect: DOMRect } | null;

const clean = (s: string) => s.replace(/\s*\n\s*/g, ' ').slice(0, 300);

const PinIcon = ({ on }: { on: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3.5h12v17l-6-4-6 4z" />
  </svg>
);
const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
);

export default function PageView({ store, page, tree, env, dark, chapters, chapterStatus, onOpen, onHome, onPatch, onMove, onTrash, onRestore, onTyping }: Props) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [title, setTitle] = useState(page.title);
  const [dek, setDek] = useState(page.dek);
  const [words, setWords] = useState(0);
  const [bodyEmpty, setBodyEmpty] = useState(false);
  const [pop, setPop] = useState<Pop>(null);
  const editorRef = useRef<Editor | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dekRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<Record<'title' | 'dek', ReturnType<typeof setTimeout> | null>>({ title: null, dek: null });
  const trashed = page.trashedAt !== null || page.deleted;

  useEffect(() => {
    let alive = true;
    setDoc(null);
    void store.openDoc(page.id).then(d => { if (alive) setDoc(d); else store.release(page.id); });
    return () => { alive = false; store.release(page.id); };
  }, [store, page.id]);

  /* Another device renamed it, or this is a different page: follow, unless
     the student is typing in that field right here. */
  useEffect(() => {
    const el = titleRef.current;
    if (el && document.activeElement !== el) {
      if (el.textContent !== page.title) el.textContent = page.title;
      setTitle(page.title);
    }
  }, [page.title, page.id]);
  useEffect(() => {
    if (document.activeElement !== dekRef.current) setDek(page.dek);
  }, [page.dek, page.id]);

  useEffect(() => {
    const el = dekRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [dek]);

  // A new, untitled page starts in its title.
  useEffect(() => {
    if (!page.title && Date.now() - page.createdAt < 4000) titleRef.current?.focus();
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (field: 'title' | 'dek', value: string, now = false) => {
    const t = timers.current[field];
    if (t) clearTimeout(t);
    timers.current[field] = null;
    const write = () => onPatch(field === 'title' ? { title: clean(value) } : { dek: clean(value).slice(0, 280) });
    if (now) write(); else timers.current[field] = setTimeout(write, 250);
  };
  useEffect(() => () => { Object.values(timers.current).forEach(t => t && clearTimeout(t)); }, []);

  const onReady = (ed: Editor) => {
    editorRef.current = ed;
    const count = () => setWords((ed.state.doc.textContent.match(/\S+/g) ?? []).length);
    count();
    setBodyEmpty(ed.isEmpty);
    let t: ReturnType<typeof setTimeout> | null = null;
    ed.on('update', () => {
      setBodyEmpty(ed.isEmpty);
      if (t) clearTimeout(t);
      t = setTimeout(count, 600);
    });
    if (window.matchMedia('(pointer: coarse)').matches) {
      ed.on('focus', () => onTyping(true));
      ed.on('blur', () => onTyping(false));
    } else {
      ed.on('update', ({ transaction }) => { if (transaction.docChanged) onTyping(true); });
    }
  };

  const parent = page.parent ? tree.byId.get(page.parent) : undefined;
  const linked = page.chapter ? chapters.find(c => c.key === page.chapter) ?? null : null;
  const subject = (linked?.subject ?? pageSubject(tree, page.id)) as Subject | null;
  const tint = subject ? (SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.General).dot : undefined;
  const status = page.chapter ? chapterStatus(page.chapter) : null;

  const startWith = (id: string) => {
    const tpl = templateById(id);
    const ed = editorRef.current;
    if (!tpl || !ed || ed.isDestroyed) return;
    ed.commands.setContent(tpl.body({ chapter: linked?.name, subject: linked?.subject }));
    if (!title.trim() && !tpl.chapter) {
      if (titleRef.current) titleRef.current.textContent = tpl.name;
      setTitle(tpl.name);
      onPatch({ title: tpl.name });
    }
    ed.commands.focus('start');
  };

  const copyMarkdown = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    const head = `# ${page.title || 'Untitled'}\n\n${page.dek ? `*${page.dek}*\n\n` : ''}`;
    try { await navigator.clipboard.writeText(head + ed.getMarkdown()); } catch { /* the browser refused */ }
  };

  // ⌘/ from the editor (keys.ts) or anywhere on the page.
  useEffect(() => {
    const show = () => { const r = moreRef.current?.getBoundingClientRect(); if (r) setPop(p => (p?.kind === 'keys' ? null : { kind: 'keys', rect: r })); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '/' && !e.defaultPrevented) { e.preventDefault(); show(); } };
    window.addEventListener('nt-shortcuts', show);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('nt-shortcuts', show); window.removeEventListener('keydown', key); };
  }, []);

  const open = (kind: NonNullable<Pop>['kind']) => (e: React.MouseEvent) => setPop({ kind, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() });

  return (
    <div className="nt-room">
      <header className="nt-bar">
        <button type="button" className="nt-back" onClick={() => (parent ? onOpen(parent.id) : onHome())}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>{parent ? parent.title || 'Untitled' : 'Notes'}</span>
        </button>
        <span className="nt-bar-gap" />
        <button type="button" className="nt-icon-btn" data-on={page.favorite} aria-label={page.favorite ? 'Unpin' : 'Pin'} title={page.favorite ? 'Pinned' : 'Pin'}
          onClick={() => onPatch({ favorite: !page.favorite })}>
          <PinIcon on={page.favorite} />
        </button>
        <button ref={moreRef} type="button" className="nt-icon-btn" aria-label="More" onClick={open('menu')}><MoreIcon /></button>
      </header>

      <article className="nt-page" data-font={page.font} data-wide={page.wide}>
        {trashed && (
          <div className="nt-trashed">
            <span>This page is in the trash.</span>
            <button type="button" className="nt-link-btn" onClick={onRestore}>Restore</button>
          </div>
        )}

        {linked && (
          <button type="button" className="nt-tag" onClick={open('chapter')} title={status ? `${STATUS_LABELS[status]} on Syllabus` : 'Change chapter'}>
            <i style={{ background: tint }} />
            {linked.subject}<span className="sep">·</span>{linked.name}
          </button>
        )}

        <h1
          ref={titleRef}
          className="nt-title"
          contentEditable={!trashed}
          suppressContentEditableWarning
          role="textbox"
          aria-label="Title"
          data-placeholder="Untitled"
          data-empty={!title.trim()}
          onInput={e => {
            const t = (e.currentTarget.textContent ?? '').replace(/\n/g, ' ');
            setTitle(t);
            commit('title', t);
          }}
          onBlur={e => { if (timers.current.title) commit('title', e.currentTarget.textContent ?? '', true); }}
          onPaste={e => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Into the summary line, which shows itself while it has focus.
              if (dekRef.current && !trashed) dekRef.current.focus(); else editorRef.current?.commands.focus('start');
            }
          }}
        />

        <textarea
          ref={dekRef}
          className="nt-dek"
          rows={1}
          value={dek}
          readOnly={trashed}
          data-empty={!dek.trim()}
          placeholder="Add a one-line summary, or press Enter"
          onChange={e => { const v = e.target.value.replace(/\n/g, ' '); setDek(v); commit('dek', v); }}
          onBlur={() => { if (timers.current.dek) commit('dek', dek, true); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && dekRef.current?.selectionStart === dek.length)) {
              e.preventDefault();
              editorRef.current?.commands.focus('start');
            }
            if (e.key === 'ArrowUp' && dekRef.current?.selectionStart === 0) { e.preventDefault(); titleRef.current?.focus(); }
          }}
        />

        <div className="nt-head-gap" />

        {doc ? (
          <Suspense fallback={<div style={{ minHeight: 200 }} />}>
            <NoteEditor key={page.id} doc={doc} env={env} dark={dark} editable={!trashed} onReady={onReady} />
          </Suspense>
        ) : (
          <div style={{ minHeight: 200 }} aria-busy="true" />
        )}

        {bodyEmpty && !trashed && (
          <div className="nt-chooser mk-rise" style={{ marginTop: 40 }}>
            <p className="nt-chooser-label">Or start with</p>
            <div className="nt-formats">
              {TEMPLATES.map(tpl => (
                <button key={tpl.id} type="button" className="nt-format" onClick={() => startWith(tpl.id)}>
                  <Sketch rows={tpl.sketch} />
                  <span className="nt-format-name">{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      {pop?.kind === 'chapter' && (
        <ChapterPicker
          anchor={pop.rect}
          chapters={chapters}
          status={chapterStatus}
          current={page.chapter}
          onPick={c => onPatch({ chapter: c?.key ?? null })}
          onClose={() => setPop(null)}
        />
      )}
      {pop?.kind === 'menu' && (
        <PageMenu
          anchor={pop.rect}
          onClose={() => setPop(null)}
          font={page.font}
          wide={page.wide}
          onFont={font => onPatch({ font })}
          onWide={() => onPatch({ wide: !page.wide })}
          onLink={() => setPop({ kind: 'chapter', rect: pop.rect })}
          linked={!!page.chapter}
          onSummary={dek.trim() ? undefined : () => { setPop(null); requestAnimationFrame(() => dekRef.current?.focus()); }}
          onCopy={() => { void copyMarkdown(); }}
          onMove={() => setPop({ kind: 'move', rect: pop.rect })}
          onTrash={onTrash}
          onKeys={() => setPop({ kind: 'keys', rect: pop.rect })}
          info={`${words} ${words === 1 ? 'word' : 'words'} · Edited ${relTime(page.updatedAt).toLowerCase()}`}
        />
      )}
      {pop?.kind === 'keys' && <ShortcutsList anchor={pop.rect} onClose={() => setPop(null)} />}
      {pop?.kind === 'move' && (
        <MovePicker anchor={pop.rect} tree={tree} page={page} onPick={p => { onMove(p); setPop(null); }} onClose={() => setPop(null)} />
      )}
    </div>
  );
}

function MovePicker({ anchor, tree, page, onPick, onClose }: {
  anchor: DOMRect; tree: Tree; page: PageMeta; onPick: (parent: string | null) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const blocked = useMemo(() => new Set([page.id, ...descendants(tree.live, page.id)]), [tree, page.id]);
  const list = useMemo(() => {
    const f = fold(q.trim());
    return tree.live
      .filter(p => !blocked.has(p.id) && (!f || fold(p.title).includes(f)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 40);
  }, [tree, blocked, q]);
  return (
    <Popover anchor={anchor} onClose={onClose} width={320} align="right">
      <div className="nt-picker">
        <input autoFocus value={q} placeholder="Move inside…" onChange={e => setQ(e.target.value)} />
        <div className="nt-picker-list">
          {page.parent && (
            <button type="button" className="nt-suggest-item" onClick={() => onPick(null)}>
              <span className="nt-glyph">↥</span><span className="nt-suggest-label">Top level</span>
            </button>
          )}
          {list.map(p => {
            const s = pageSubject(tree, p.id) as Subject | null;
            return (
              <button key={p.id} type="button" className="nt-suggest-item" data-active={p.id === page.parent} onClick={() => onPick(p.id)}>
                <span className="nt-glyph"><i style={{ background: s ? (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.General).dot : 'var(--nt-faint)' }} /></span>
                <span className="nt-suggest-label">{p.title || 'Untitled'}</span>
              </button>
            );
          })}
          {!list.length && <p className="nt-suggest-empty">No other pages yet.</p>}
        </div>
      </div>
    </Popover>
  );
}
