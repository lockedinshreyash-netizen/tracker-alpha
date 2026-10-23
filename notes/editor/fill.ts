/* Writing a whole page without opening it: a template the moment it is
   chosen, or each file of a Markdown import. The content goes straight into
   the page's Yjs document, so it is saved and synced like anything typed. */

import { getSchema, resolveExtensions, type JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import type * as Y from 'yjs';
import { contentExtensions } from './extensions';
import type { NotesEnv } from './env';
import { protectMath, restoreMath } from './markdown';

/* Node views and plugins never run here, so the extensions only need an
   env-shaped object to be configured with. */
const inert = {} as NotesEnv;

let cache: { schema: ReturnType<typeof getSchema>; md: MarkdownManager } | null = null;
const tools = () => {
  if (!cache) {
    const exts = contentExtensions(inert);
    cache = { schema: getSchema(exts), md: new MarkdownManager({ extensions: resolveExtensions(exts) }) };
  }
  return cache;
};

export const fillDoc = (doc: Y.Doc, json: JSONContent): void => {
  const frag = doc.getXmlFragment('default');
  if (frag.length) return;
  prosemirrorJSONToYXmlFragment(tools().schema, json, frag);
};

/** Markdown to editor JSON, equations included. The first `# Heading` is lifted out as the title. */
export const markdownToDoc = (text: string): { title: string | null; json: JSONContent } => {
  const { md, stash } = protectMath(text.replace(/\r\n?/g, '\n'));
  const parsed = tools().md.parse(md) as JSONContent;
  const json = restoreMath(parsed.type === 'doc' ? parsed : { type: 'doc', content: [parsed] }, stash);
  const first = json.content?.[0];
  let title: string | null = null;
  if (first?.type === 'heading' && first.attrs?.level === 1) {
    title = (first.content ?? []).map(c => c.text ?? '').join('').trim() || null;
    if (title) json.content = json.content!.slice(1);
  }
  if (!json.content?.length) json.content = [{ type: 'paragraph' }];
  return { title, json };
};
