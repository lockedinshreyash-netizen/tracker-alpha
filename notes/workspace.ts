/* ── The workspace: every page's name and place ──
   One Yjs document per owner ('workspace') holds a map of pages, each page a
   map of fields. Every field merges on its own, last writer wins: renaming a
   page on the phone while moving it on the laptop keeps both. Page bodies are
   separate documents, so the tree and search never load a body.

   Pages are never removed from the map. Purging sets `deleted`, a tombstone,
   so a device that was offline when the page went cannot bring it back by
   editing it. Tombstones are a few dozen bytes. */

import * as Y from 'yjs';
import { newId } from './bytes';

export const WORKSPACE = 'workspace';

export type PageFont = 'sans' | 'serif' | 'mono';

export interface PageMeta {
  id: string;
  title: string;
  /** The one line under the title, set in Playfair: what this page is about. */
  dek: string;
  /** Kept for pages written before the redesign; nothing draws it any more. */
  icon: string;
  parent: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
  deleted: boolean;
  /** A syllabus chapter, keyed like mocks: `11|Physics|Rotational Motion`. */
  chapter: string | null;
  font: PageFont;
  wide: boolean;
  favorite: boolean;
}

const FONTS: PageFont[] = ['sans', 'serif', 'mono'];

export const pagesMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap('pages');

const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export const readPage = (id: string, m: Y.Map<unknown>): PageMeta => ({
  id,
  title: str(m.get('title')),
  dek: str(m.get('dek'), 280),
  icon: str(m.get('icon'), 16),
  parent: typeof m.get('parent') === 'string' ? (m.get('parent') as string) : null,
  order: num(m.get('order')),
  createdAt: num(m.get('createdAt')),
  updatedAt: num(m.get('updatedAt')),
  trashedAt: typeof m.get('trashedAt') === 'number' ? (m.get('trashedAt') as number) : null,
  deleted: m.get('deleted') === true,
  chapter: typeof m.get('chapter') === 'string' ? (m.get('chapter') as string) : null,
  font: FONTS.includes(m.get('font') as PageFont) ? (m.get('font') as PageFont) : 'serif',
  wide: m.get('wide') === true,
  favorite: m.get('favorite') === true,
});

export const readPages = (doc: Y.Doc): PageMeta[] => {
  const out: PageMeta[] = [];
  pagesMap(doc).forEach((m, id) => { if (m instanceof Y.Map) out.push(readPage(id, m)); });
  return out;
};

const byOrder = (a: PageMeta, b: PageMeta) => a.order - b.order || (a.id < b.id ? -1 : 1);

export interface Tree {
  byId: Map<string, PageMeta>;
  /** Live (not trashed, not deleted) children per parent; '' is the root. */
  children: Map<string, PageMeta[]>;
  /** Trashed pages whose parent is not itself in the trash: what the Trash lists. */
  trash: PageMeta[];
  /** Live pages, ancestors included: a page under a trashed parent is not live. */
  live: PageMeta[];
}

export const buildTree = (pages: PageMeta[]): Tree => {
  const byId = new Map(pages.map(p => [p.id, p]));
  const isLive = (p: PageMeta): boolean => {
    for (let cur: PageMeta | undefined = p, n = 0; cur && n < 64; cur = cur.parent ? byId.get(cur.parent) : undefined, n++) {
      if (cur.deleted || cur.trashedAt !== null) return false;
    }
    return true;
  };
  const live = pages.filter(isLive);
  const liveIds = new Set(live.map(p => p.id));
  const children = new Map<string, PageMeta[]>();
  live.forEach(p => {
    // A parent that is gone (purged elsewhere) leaves its child at the root rather than lost.
    const key = p.parent && liveIds.has(p.parent) ? p.parent : '';
    const list = children.get(key) ?? [];
    list.push(p);
    children.set(key, list);
  });
  children.forEach(list => list.sort(byOrder));
  const trash = pages
    .filter(p => !p.deleted && p.trashedAt !== null && !(p.parent && byId.get(p.parent)?.trashedAt != null))
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  return { byId, children, trash, live };
};

export const ancestors = (tree: Tree, id: string): PageMeta[] => {
  const out: PageMeta[] = [];
  let cur = tree.byId.get(id);
  for (let n = 0; cur?.parent && n < 64; n++) {
    const p = tree.byId.get(cur.parent);
    if (!p) break;
    out.unshift(p);
    cur = p;
  }
  return out;
};

export const descendants = (pages: PageMeta[], id: string): string[] => {
  const kids = new Map<string, string[]>();
  pages.forEach(p => { if (p.parent) kids.set(p.parent, [...(kids.get(p.parent) ?? []), p.id]); });
  const out: string[] = [];
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length && out.length < 5000) {
    const next = stack.pop()!;
    if (out.includes(next)) continue;
    out.push(next);
    stack.push(...(kids.get(next) ?? []));
  }
  return out;
};

/** Order between two neighbours. Ties (two devices inserting at once) fall through to the id. */
export const orderBetween = (before: number | null, after: number | null): number => {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
};

export interface NewPage {
  title?: string;
  dek?: string;
  icon?: string;
  parent?: string | null;
  chapter?: string | null;
  font?: PageFont;
  /** Place it first among its siblings rather than last. */
  first?: boolean;
}

export const createPage = (doc: Y.Doc, init: NewPage = {}, now = Date.now()): string => {
  const id = newId();
  const siblings = buildTree(readPages(doc)).children.get(init.parent ?? '') ?? [];
  const order = init.first
    ? orderBetween(null, siblings[0]?.order ?? null)
    : orderBetween(siblings[siblings.length - 1]?.order ?? null, null);
  doc.transact(() => {
    const m = new Y.Map<unknown>();
    pagesMap(doc).set(id, m);
    m.set('title', init.title ?? '');
    m.set('dek', init.dek ?? '');
    m.set('icon', init.icon ?? '');
    m.set('parent', init.parent ?? null);
    m.set('order', order);
    m.set('createdAt', now);
    m.set('updatedAt', now);
    m.set('trashedAt', null);
    m.set('chapter', init.chapter ?? null);
    // Book (Literata) is the default face: a notebook, not a form.
    m.set('font', init.font ?? 'serif');
  });
  return id;
};

export type PagePatch = Partial<Pick<PageMeta, 'title' | 'dek' | 'icon' | 'chapter' | 'font' | 'wide' | 'favorite' | 'updatedAt'>>;

export const updatePage = (doc: Y.Doc, id: string, patch: PagePatch): void => {
  const m = pagesMap(doc).get(id);
  if (!m) return;
  doc.transact(() => {
    (Object.keys(patch) as (keyof PagePatch)[]).forEach(k => {
      const v = patch[k];
      if (m.get(k) !== v) m.set(k, v ?? null);
    });
  });
};

/** Move `id` under `parent` at `index` among its new siblings. Refuses to make a page its own ancestor. */
export const movePage = (doc: Y.Doc, id: string, parent: string | null, index: number): boolean => {
  const pages = readPages(doc);
  if (parent === id || (parent && descendants(pages, id).includes(parent))) return false;
  const siblings = (buildTree(pages).children.get(parent ?? '') ?? []).filter(p => p.id !== id);
  const i = Math.max(0, Math.min(index, siblings.length));
  const order = orderBetween(siblings[i - 1]?.order ?? null, siblings[i]?.order ?? null);
  const m = pagesMap(doc).get(id);
  if (!m) return false;
  doc.transact(() => { m.set('parent', parent); m.set('order', order); });
  return true;
};

export const trashPage = (doc: Y.Doc, id: string, now = Date.now()): void => {
  pagesMap(doc).get(id)?.set('trashedAt', now);
};

export const restorePage = (doc: Y.Doc, id: string): void => {
  const pages = readPages(doc);
  const byId = new Map(pages.map(p => [p.id, p]));
  const page = byId.get(id);
  const m = pagesMap(doc).get(id);
  if (!page || !m) return;
  doc.transact(() => {
    m.set('trashedAt', null);
    // Restored under a parent that is still in the trash would stay invisible.
    const parent = page.parent ? byId.get(page.parent) : undefined;
    if (page.parent && (!parent || parent.deleted || parent.trashedAt !== null)) m.set('parent', null);
  });
};

/** Delete for good. Returns every page id whose body should be dropped. */
export const purgePage = (doc: Y.Doc, id: string): string[] => {
  const ids = [id, ...descendants(readPages(doc), id)];
  doc.transact(() => {
    ids.forEach(pid => {
      const m = pagesMap(doc).get(pid);
      if (!m) return;
      m.set('deleted', true);
      m.set('title', '');
      m.set('dek', '');
      m.set('icon', '');
      m.set('chapter', null);
    });
  });
  return ids;
};

/** chapterKey → the first live page linked to it, for the Syllabus tab. */
export const chapterIndex = (tree: Tree): Record<string, string> => {
  const out: Record<string, string> = {};
  [...tree.live].sort((a, b) => a.createdAt - b.createdAt).forEach(p => {
    if (p.chapter && !out[p.chapter]) out[p.chapter] = p.id;
  });
  return out;
};

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology'];

/** The subject a page belongs to: its chapter's, else the nearest ancestor's
 *  chapter, else an ancestor (or itself) named after a subject, the folders
 *  the Syllabus tab makes. Null for a loose page. */
export const pageSubject = (tree: Tree, id: string): string | null => {
  let cur = tree.byId.get(id);
  for (let n = 0; cur && n < 64; n++) {
    const fromChapter = cur.chapter?.split('|')[1];
    if (fromChapter) return fromChapter;
    if (SUBJECTS.includes(cur.title.trim())) return cur.title.trim();
    cur = cur.parent ? tree.byId.get(cur.parent) : undefined;
  }
  return null;
};
