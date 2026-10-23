/* ── The Notes workspace ──
   What the Notes tab is once the student has turned it on (NotesTab.tsx
   draws the cover until then, and loads this lazily). Opens this owner's
   notes store (IndexedDB), and for an account, adopts any guest notes and
   starts sync. Draws the home or one page, the workspace pill at the bottom,
   and ⌘K search over everything.

   Nothing here reads or writes AppState except through the two callbacks
   App hands in (a to-do sent to Today, opening the Syllabus tab), so typing
   in a note never fires App's sync.

   The chunk is lazy (NotesTab), and the editor inside it is lazy again
   (PageView), so the home screen arrives without TipTap. */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '../supabaseClient';
import { getChaptersFor } from '../constants';
import type { ChapterProgress, ExamPreference, Subject, SyllabusStatus } from '../types';
import { GUEST } from './forget';
import { NotesStore, acquireStore, adoptGuestNotes, releaseStore } from './store';
import { NotesSync, fetchRemoteFile, type SyncStatus } from './sync';
import {
  buildTree, createPage, movePage, purgePage, restorePage, trashPage, updatePage,
  descendants, type NewPage, type PagePatch, type Tree,
} from './workspace';
import { templateById } from './templates';
import type { ChapterOption, NotesEnv } from './editor/env';
import { fold } from './text';
import NotesHome from './NotesHome';
import PageView from './PageView';
import WorkspaceBar from './WorkspaceBar';
import SearchPalette from './SearchPalette';
import { useSerifFont } from './ui';

export interface NotesRequest {
  key: string;
  chapter: string;
  subject: Subject;
  nonce: number;
}

interface Props {
  user: { id: string } | null;
  onDisable: () => void;
  theme: 'dark' | 'light';
  examPreference: ExamPreference;
  progress: ChapterProgress[];
  activeSubjects: Subject[];
  railPx: number;
  onAddTask: (text: string, subject: Subject) => void;
  onOpenSyllabus: () => void;
  request: NotesRequest | null;
  onRequestHandled: () => void;
}


const EMPTY_TREE: Tree = { byId: new Map(), children: new Map(), trash: [], live: [] };
const noSub = () => () => {};
const zero = () => 0;

const lastKey = (owner: string) => `alpha_notes_last_v1:${owner}`;
const openKey = (owner: string) => `alpha_notes_open_v1:${owner}`;
const readJSON = <T,>(key: string, d: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : d; } catch { return d; } };

const SYNC_LABEL: Record<SyncStatus, [string, string]> = {
  idle: ['synced', 'Synced'],
  synced: ['synced', 'Synced'],
  syncing: ['syncing', 'Syncing…'],
  offline: ['offline', 'Offline · saved here'],
  error: ['error', 'Saved here · will sync'],
  unavailable: ['local', 'Saved on this device'],
};

export default function NotesWorkspace({ user, onDisable, theme, examPreference, progress, activeSubjects, railPx, onAddTask, onOpenSyllabus, request, onRequestHandled }: Props) {
  const dark = theme === 'dark';
  const owner = user?.id ?? GUEST;
  // Literata: the body face of every page, and of the snippets on the contents page.
  useSerifFont(true);
  const [store, setStore] = useState<NotesStore | null>(null);
  const [sync, setSync] = useState<NotesSync | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(readJSON<string[]>(openKey(owner), [])));
  const [panel, setPanel] = useState(false);
  const [search, setSearch] = useState(false);
  const [away, setAway] = useState(false);
  const [texts, setTexts] = useState<Map<string, string>>(new Map());

  /* ── The store and sync ── */

  useEffect(() => {
    let alive = true;
    let opened: NotesStore | null = null;
    let syncer: NotesSync | null = null;
    setFailed(false);
    // Shared and counted (store.ts): leaving the tab writes to disk, it does not close.
    acquireStore(owner, !!user)
      .then(async s => {
        opened = s;
        if (!alive) return;
        if (user) {
          await adoptGuestNotes(s).catch(() => false);
          if (!alive) return;
          syncer = new NotesSync(s, user.id);
          syncer.start();
          setSync(syncer);
        }
        setStore(s);
        // A laptop reopens the page you were on; a phone opens on the list.
        const last = readJSON<string | null>(lastKey(owner), null);
        const page = last ? s.pages().find(p => p.id === last) : undefined;
        if (page && !page.deleted && page.trashedAt === null && window.matchMedia('(min-width: 768px)').matches) setOpenId(page.id);
      })
      .catch(() => { if (alive) setFailed(true); });
    const hide = () => { void opened?.flush(); };
    window.addEventListener('pagehide', hide);
    return () => {
      alive = false;
      window.removeEventListener('pagehide', hide);
      syncer?.stop();
      releaseStore(owner);
      setStore(null);
      setSync(null);
    };
  }, [owner]); // eslint-disable-line react-hooks/exhaustive-deps

  const version = useSyncExternalStore(store?.subscribe ?? noSub, store?.getVersion ?? zero);
  const tree = useMemo(() => (store ? buildTree(store.pages()) : EMPTY_TREE), [store, version]);
  const syncStatus = useSyncExternalStore(sync?.subscribe ?? noSub, () => sync?.status ?? 'idle');
  const [syncState, syncLabel] = user ? SYNC_LABEL[syncStatus] : ['local', 'On this device'];

  const page = openId ? tree.byId.get(openId) ?? null : null;

  useEffect(() => {
    if (!store || openId) return;
    void store.allTexts().then(t => setTexts(new Map(t)));
  }, [store, openId, version]);

  /* ── Live values for the editor, read through a ref so the env never changes under it ── */

  const chapters = useMemo<ChapterOption[]>(() => {
    const out: ChapterOption[] = [];
    ([11, 12] as const).forEach(classId => activeSubjects.filter(s => s !== 'General').forEach(subject => {
      getChaptersFor(examPreference, classId, subject).forEach(name => out.push({ key: `${classId}|${subject}|${name}`, name, subject, classId }));
    }));
    return out;
  }, [examPreference, activeSubjects]);

  const statusMap = useMemo(() => {
    const m = new Map<string, SyllabusStatus>();
    progress.forEach(p => m.set(`${p.classId}|${p.subject}|${p.chapter}`, p.status));
    return m;
  }, [progress]);
  const chapterStatus = useCallback((key: string) => statusMap.get(key) ?? null, [statusMap]);

  const live = useRef({ tree, chapters, chapterStatus, onAddTask, onOpenSyllabus, page });
  live.current = { tree, chapters, chapterStatus, onAddTask, onOpenSyllabus, page };

  /* ── Actions ── */

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    setPanel(false);
    setAway(false);
    try { if (id) localStorage.setItem(lastKey(owner), JSON.stringify(id)); else localStorage.removeItem(lastKey(owner)); } catch { /* full */ }
    window.scrollTo({ top: 0 });
  }, [owner]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(openKey(owner), JSON.stringify([...next])); } catch { /* full */ }
      return next;
    });
  }, [owner]);

  const create = useCallback(async (init: NewPage, template?: string, ctx: { chapter?: string; subject?: string } = {}): Promise<string | null> => {
    if (!store) return null;
    const tpl = template ? templateById(template) : undefined;
    const id = createPage(store.workspace, init);
    if (tpl) {
      const [{ fillDoc }, doc] = await Promise.all([import('./editor/fill'), store.openDoc(id)]);
      fillDoc(doc, tpl.body(ctx));
      store.release(id);
    }
    if (init.parent) setExpanded(prev => (prev.has(init.parent!) ? prev : new Set(prev).add(init.parent!)));
    open(id);
    return id;
  }, [store, open]);

  const createSync = useCallback((init: NewPage): string => {
    // For the editor's "page inside this page": the link needs the id now.
    if (!store) return '';
    return createPage(store.workspace, init);
  }, [store]);

  const patch = useCallback((id: string, p: PagePatch) => { if (store) updatePage(store.workspace, id, p); }, [store]);

  const trash = useCallback((id: string) => {
    if (!store) return;
    trashPage(store.workspace, id);
    if (openId && (openId === id || descendants(store.pages(), id).includes(openId))) open(null);
  }, [store, openId, open]);

  const purge = useCallback((id: string) => {
    if (!store) return;
    const ids = purgePage(store.workspace, id);
    void store.dropDocs(ids);
    if (user) void supabase.from('note_updates').delete().eq('user_id', user.id).in('doc_id', ids);
    if (openId && ids.includes(openId)) open(null);
  }, [store, user, openId, open]);

  const importFiles = useCallback(async (files: File[]) => {
    if (!store) return;
    const { fillDoc, markdownToDoc } = await import('./editor/fill');
    let last: string | null = null;
    for (const file of files.slice(0, 200)) {
      const text = await file.text();
      const { title, json } = markdownToDoc(text);
      const id = createPage(store.workspace, { title: title ?? file.name.replace(/\.(md|markdown|txt)$/i, '') });
      const doc = await store.openDoc(id);
      fillDoc(doc, json);
      store.release(id);
      last = id;
    }
    if (last) open(last);
  }, [store, open]);

  /* ── From the Syllabus tab: this chapter's page, made if it does not exist ── */

  useEffect(() => {
    if (!store || !request) return;
    onRequestHandled();
    const pages = buildTree(store.pages());
    const existing = pages.live.find(p => p.chapter === request.key);
    if (existing) { open(existing.id); return; }
    const folder = (pages.children.get('') ?? []).find(p => p.title === request.subject && !p.chapter);
    const folderId = folder?.id ?? createPage(store.workspace, { title: request.subject, font: 'sans' });
    void create({ title: request.chapter, chapter: request.key, parent: folderId }, 'chapter', { chapter: request.chapter, subject: request.subject });
  }, [store, request]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── ⌘K, and the pill coming back when the writer looks up ── */

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // A ⌘K the editor already took (a link on the selection) is not a search.
      if (e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'p') && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSearch(s => !s);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const awayRef = useRef(false);
  const onTyping = useCallback((typing: boolean) => {
    if (awayRef.current === typing) return;
    awayRef.current = typing;
    setAway(typing);
  }, []);
  useEffect(() => {
    if (!away || window.matchMedia('(pointer: coarse)').matches) return;
    let start: { x: number; y: number } | null = null;
    const move = (e: MouseEvent) => {
      if (!start) { start = { x: e.clientX, y: e.clientY }; return; }
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 24) onTyping(false);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [away, onTyping]);

  /* ── The editor's window onto the tab ── */

  const env = useMemo<NotesEnv | null>(() => {
    if (!store || !openId) return null;
    const pageId = openId;
    const e: NotesEnv = {
      store,
      userId: user?.id ?? null,
      pageId,
      mathPending: false,
      pageInfo: id => {
        const p = live.current.tree.byId.get(id) ?? store.pages().find(x => x.id === id);
        if (!p || p.deleted) return null;
        return { title: p.title, icon: p.icon, live: live.current.tree.live.some(x => x.id === id) };
      },
      openPage: id => open(id),
      createSubpage: title => createSync({ parent: pageId, title: title ?? '' }),
      searchPages: q => {
        const f = fold(q.trim());
        return live.current.tree.live
          .filter(p => p.id !== pageId && (!f || fold(p.title).includes(f)))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(p => ({ id: p.id, title: p.title, icon: p.icon }));
      },
      chapters: () => live.current.chapters,
      chapterStatus: key => live.current.chapterStatus(key),
      openChapter: () => live.current.onOpenSyllabus(),
      sendToToday: text => {
        if (!text) return;
        const subject = (live.current.page?.chapter?.split('|')[1] ?? 'General') as Subject;
        live.current.onAddTask(text.slice(0, 200), subject);
      },
      editMath: () => undefined,
      pickImage: () => undefined,
      imageUrl: async id => {
        const local = await store.fileUrl(id);
        if (local || !user) return local;
        return (await fetchRemoteFile(store, user.id, id)) ? store.fileUrl(id) : null;
      },
      afterImage: () => { void sync?.uploadFiles(); },
    };
    return e;
  }, [store, openId, user?.id, sync]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Drawing ── */

  if (failed) {
    return (
      <div className="nt"><div className="nt-home">
        <header className="nt-mast">
          <p className="nt-kicker">Notebook · unavailable</p>
          <h1 className="nt-display">Notes<span className="nt-stop">.</span></h1>
          <p className="nt-home-dek">This browser blocks on-device storage, which private mode often does. Open Alpha in a normal window.</p>
        </header>
      </div></div>
    );
  }

  return (
    <div className={`nt${away ? ' nt-typing' : ''}`}>
      {!store ? (
        <div className="nt-home" aria-busy="true" />
      ) : page && env ? (
        <PageView
          key={page.id}
          store={store}
          page={page}
          tree={tree}
          env={env}
          dark={dark}
          chapters={chapters}
          chapterStatus={chapterStatus}
          onOpen={open}
          onHome={() => open(null)}
          onPatch={p => patch(page.id, p)}
          onMove={parent => { movePage(store.workspace, page.id, parent, (tree.children.get(parent ?? '') ?? []).length); if (parent) setExpanded(prev => new Set(prev).add(parent)); }}
          onTrash={() => trash(page.id)}
          onRestore={() => restorePage(store.workspace, page.id)}
          onTyping={onTyping}
        />
      ) : (
          <NotesHome
            tree={tree}
            texts={texts}
            subjects={activeSubjects}
            onOpen={open}
            onTemplate={id => { const tpl = templateById(id); void create({ title: tpl?.name ?? '' }, id); }}
          />
      )}

      {store && (
        <WorkspaceBar
          dark={dark}
          railPx={railPx}
          tree={tree}
          openId={openId}
          isHome={!page}
          away={away}
          panelOpen={panel}
          onPanel={setPanel}
          onSearch={() => setSearch(true)}
          onHome={() => open(null)}
          onNew={parent => { void create({ parent }); }}
          expanded={expanded}
          onToggle={toggle}
          onOpen={open}
          onMove={(id, parent, index) => movePage(store.workspace, id, parent, index)}
          onRestore={id => restorePage(store.workspace, id)}
          onPurge={purge}
          onImport={files => { void importFiles(files); }}
          sync={{ state: syncState, label: syncLabel }}
          onDisable={onDisable}
        />
      )}

      {search && store && (
        <SearchPalette
          store={store}
          tree={tree}
          onOpen={open}
          onCreate={title => { void create({ title }); }}
          onClose={() => setSearch(false)}
        />
      )}
    </div>
  );
}
