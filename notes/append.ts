/* ── Sending something to a chapter's notes page from elsewhere ──
   A quote from a book (books/BookRoom.tsx) goes to the end of that chapter's
   page without leaving the reader: the same page Syllabus's "Notes" opens,
   made the same way when it does not exist yet (a Chapter notes page inside
   a subject folder, NotesWorkspace's request handler). Lazy: this pulls in
   Yjs and the editor schema, so only a send loads it.

   Writes go through the store like typing does: saved on this device at
   once, and pushed to the student's other devices by the outbox the next
   time Notes syncs. */

import type { JSONContent } from '@tiptap/core';
import { acquireStore, releaseStore } from './store';
import { buildTree, createPage } from './workspace';
import { templateById } from './templates';

export interface ChapterRef { key: string; chapter: string; subject: string }

/**
 * Append blocks to the chapter's page. With `image`, the picture (a snip of a
 * page or of the whiteboard) is stored the way a pasted picture is
 * (notes/files.ts: compressed, kept on this device, uploaded by sync) and
 * goes in first, as a full-width image block.
 */
export const appendToChapter = async (owner: string, signedIn: boolean, ref: ChapterRef, blocks: JSONContent[], image?: Blob): Promise<string> => {
  const store = await acquireStore(owner, signedIn);
  try {
    if (image) {
      const { storeImage } = await import('./files');
      const img = await storeImage(store, image);
      blocks = [{ type: 'noteImage', attrs: { id: img.id, w: img.w, h: img.h, size: 'full' } }, ...blocks];
    }
    const { appendToDoc, fillDoc } = await import('./editor/fill');
    const tree = buildTree(store.pages());
    let id = tree.live.find(p => p.chapter === ref.key)?.id;
    if (!id) {
      const folder = (tree.children.get('') ?? []).find(p => p.title === ref.subject && !p.chapter);
      const parent = folder?.id ?? createPage(store.workspace, { title: ref.subject, font: 'sans' });
      id = createPage(store.workspace, { title: ref.chapter, chapter: ref.key, parent });
      const tpl = templateById('chapter');
      if (tpl) {
        const fresh = await store.openDoc(id);
        fillDoc(fresh, tpl.body({ chapter: ref.chapter, subject: ref.subject }));
        store.release(id);
      }
    }
    const doc = await store.openDoc(id);
    appendToDoc(doc, { type: 'doc', content: blocks });
    store.release(id);
    return id;
  } finally {
    releaseStore(owner);
  }
};
