/* ── The page list ──
   What the Pages button on the workspace pill raises: favourites, every page
   as a tree you can fold, the trash, and where sync stands. Search, Home and
   New page live on the pill itself. On a laptop pages are dragged to move
   them: onto a row makes it a page inside that one, onto an edge puts it
   beside. A phone has no drag here; "Move to…" in the page menu does the
   same. */

import React, { useRef, useState } from 'react';
import { pageSubject, type PageMeta, type Tree } from './workspace';
import { relTime } from './ui';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { Subject } from '../types';

interface Props {
  tree: Tree;
  openId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onNew: (parent: string | null) => void;
  onMove: (id: string, parent: string | null, index: number) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onImport: (files: File[]) => void;
  sync: { state: string; label: string };
}

type Drop = { id: string; where: 'in' | 'above' | 'below' } | null;

const Chevron = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M2.5 1.2 5.5 4l-3 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Plus = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

/* A page is marked by its subject's colour; a loose page by a hollow dot. */
const Dot = ({ tree, id }: { tree: Tree; id: string }) => {
  const s = pageSubject(tree, id) as Subject | null;
  return s
    ? <span className="nt-dot" style={{ background: (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.General).dot }} />
    : <span className="nt-dot is-hollow" />;
};

export default function NotesNav(props: Props) {
  const { tree, openId, expanded, onToggle, onOpen, onNew, onMove, onRestore, onPurge, onImport, sync } = props;
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const roots = tree.children.get('') ?? [];
  const favs = tree.live.filter(p => p.favorite).sort((a, b) => a.title.localeCompare(b.title));

  const commitDrop = () => {
    if (!drag || !drop || drag === drop.id) return;
    const target = tree.byId.get(drop.id);
    if (!target) return;
    if (drop.where === 'in') {
      onMove(drag, target.id, (tree.children.get(target.id) ?? []).length);
      if (!expanded.has(target.id)) onToggle(target.id);
      return;
    }
    const parent = target.parent && tree.byId.has(target.parent) ? target.parent : null;
    const siblings = (tree.children.get(parent ?? '') ?? []).filter(p => p.id !== drag);
    const at = siblings.findIndex(p => p.id === target.id);
    onMove(drag, parent, drop.where === 'above' ? at : at + 1);
  };

  const row = (p: PageMeta, depth: number): React.ReactNode => {
    const kids = tree.children.get(p.id) ?? [];
    const open = expanded.has(p.id);
    const dropCls = drop?.id === p.id ? ` is-drop-${drop.where}` : '';
    return (
      <React.Fragment key={p.id}>
        <div
          role="button"
          tabIndex={0}
          className={`nt-nav-row${dropCls}`}
          data-active={openId === p.id}
          style={{ paddingLeft: 6 + depth * 14 }}
          draggable
          onDragStart={e => { setDrag(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.title); }}
          onDragEnd={() => { setDrag(null); setDrop(null); }}
          onDragOver={e => {
            if (!drag || drag === p.id) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height;
            const where = y < 0.28 ? 'above' : y > 0.72 ? 'below' : 'in';
            if (drop?.id !== p.id || drop.where !== where) setDrop({ id: p.id, where });
          }}
          onDragLeave={() => { if (drop?.id === p.id) setDrop(null); }}
          onDrop={e => { e.preventDefault(); commitDrop(); setDrag(null); setDrop(null); }}
          onClick={() => onOpen(p.id)}
          onKeyDown={e => {
            if (e.key === 'Enter') onOpen(p.id);
            if (e.key === 'ArrowRight' && kids.length && !open) onToggle(p.id);
            if (e.key === 'ArrowLeft' && open) onToggle(p.id);
          }}
        >
          <span
            className={`nt-twisty${kids.length ? '' : ' is-leaf'}`}
            data-open={open}
            onClick={e => { e.stopPropagation(); onToggle(p.id); }}
            aria-label={open ? 'Fold' : 'Unfold'}
          >
            <Chevron />
          </span>
          <Dot tree={tree} id={p.id} />
          <span className="nt-row-title">{p.title || 'Untitled'}</span>
          <span
            className="nt-row-add"
            role="button"
            aria-label="New page inside"
            onClick={e => { e.stopPropagation(); onNew(p.id); if (!open) onToggle(p.id); }}
          >
            <Plus />
          </span>
        </div>
        {open && kids.map(k => row(k, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <nav className="nt-nav" aria-label="Notes">
      {favs.length > 0 && (
        <>
          <p className="nt-nav-label" style={{ paddingTop: 6 }}>Favourites</p>
          {favs.map(p => (
            <button key={p.id} type="button" className="nt-nav-row" data-active={openId === p.id} onClick={() => onOpen(p.id)}>
              <Dot tree={tree} id={p.id} />
              <span className="nt-row-title">{p.title || 'Untitled'}</span>
            </button>
          ))}
        </>
      )}

      <p className="nt-nav-label" style={favs.length ? undefined : { paddingTop: 6 }}>
        Pages
        <button type="button" className="nt-link-btn" onClick={() => fileRef.current?.click()} title="Import Markdown files from Obsidian or Notion">Import</button>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onImport(f); }}
      />
      <div
        onDragOver={e => { if (drag) e.preventDefault(); }}
        onDrop={e => {
          // Dropped below the last row: to the end of the top level.
          if (!drag || drop) return;
          e.preventDefault();
          onMove(drag, null, roots.length);
          setDrag(null);
        }}
      >
        {roots.map(p => row(p, 0))}
        {!roots.length && (
          <p className="nt-meta-quiet" style={{ padding: '6px 8px' }}>No pages yet.</p>
        )}
      </div>

      <button type="button" className="nt-nav-row" style={{ marginTop: 14 }} onClick={() => setTrashOpen(o => !o)}>
        <span className="nt-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        </span>
        Trash
        {tree.trash.length > 0 && <span className="nt-kbd">{tree.trash.length}</span>}
      </button>
      {trashOpen && (
        <div style={{ paddingLeft: 6 }}>
          {!tree.trash.length && <p className="nt-meta-quiet" style={{ padding: '4px 8px' }}>Nothing in the trash.</p>}
          {tree.trash.map(p => (
            <div key={p.id} className="nt-trash-row">
              <Dot tree={tree} id={p.id} />
              <span className="nt-row-title" title={p.trashedAt ? `Trashed ${relTime(p.trashedAt)}` : undefined}>{p.title || 'Untitled'}</span>
              <button type="button" className="nt-link-btn" onClick={() => onRestore(p.id)}>Restore</button>
              <button
                type="button"
                className="nt-link-btn is-danger"
                onClick={() => { if (window.confirm(`Delete “${p.title || 'Untitled'}” forever? Pages inside it go too. This can’t be undone.`)) onPurge(p.id); }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="nt-sync" data-state={sync.state}><i />{sync.label}</p>
    </nav>
  );
}
