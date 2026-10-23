/* Plain text out of a page's Yjs body, for search and the snippets on the
   home screen. Walks the XML tree directly, so it needs no editor schema and
   can run on a page that is not open (after a pull from another device). */

import * as Y from 'yjs';

const BLOCKS = new Set([
  'paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'callout',
  'detailsSummary', 'tableCell', 'tableHeader', 'mathBlock', 'horizontalRule',
]);

export const MAX_TEXT = 20000;

export const fragmentText = (frag: Y.XmlFragment | Y.XmlElement): string => {
  let out = '';
  const walk = (node: Y.XmlFragment | Y.XmlElement | Y.XmlText) => {
    if (out.length > MAX_TEXT) return;
    if (node instanceof Y.XmlText) {
      node.toDelta().forEach((d: { insert?: unknown }) => { if (typeof d.insert === 'string') out += d.insert; });
      return;
    }
    if (node instanceof Y.XmlElement) {
      const name = node.nodeName;
      if (name === 'mathInline' || name === 'mathBlock') out += ` ${node.getAttribute('latex') ?? ''} `;
      if (name === 'chapterRef') out += ` ${node.getAttribute('name') ?? ''} `;
      node.toArray().forEach(c => walk(c as Y.XmlElement | Y.XmlText));
      if (BLOCKS.has(name)) out += '\n';
      return;
    }
    node.toArray().forEach(c => walk(c as Y.XmlElement | Y.XmlText));
  };
  walk(frag);
  return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
};

export const docText = (doc: Y.Doc): string => fragmentText(doc.getXmlFragment('default'));

export const textOfState = (state: Uint8Array): string => {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    return docText(doc);
  } finally {
    doc.destroy();
  }
};

/** A line for a card: the first few sentences, collapsed onto one line. */
export const snippet = (text: string, max = 140): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/* Search folds case and the typographer's punctuation, the reader's rule:
   "dont" finds "don’t". */
export const fold = (s: string): string =>
  s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').normalize('NFKD').replace(/[̀-ͯ]/g, '');
