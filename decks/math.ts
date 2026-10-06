/* ── Maths on cards ──
   Anki's delimiters: \( … \) inline and \[ … \] on their own line. Not "$",
   which in a chemistry deck is as likely to be a price or a typo as maths —
   the bank's question text uses "$" because it was written for it, cards
   were written for Anki. mhchem is loaded too, so \ce{LiAlH4} reads as
   chemistry.

   Runs over the text nodes of an already-sanitised card, so the HTML around
   an expression is never re-parsed. Reached only through a dynamic import:
   KaTeX is heavy and a deck with no maths never downloads it. */

import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

const DELIMS: [string, string, boolean][] = [['\\[', '\\]', true], ['\\(', '\\)', false]];

export const hasMath = (html: string): boolean => /\\\(|\\\[/.test(html);

const renderText = (text: string): string | null => {
  let out = '';
  let i = 0;
  let found = false;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  while (i < text.length) {
    let hit: { at: number; open: string; close: string; display: boolean } | null = null;
    for (const [open, close, display] of DELIMS) {
      const at = text.indexOf(open, i);
      if (at >= 0 && (!hit || at < hit.at)) hit = { at, open, close, display };
    }
    if (!hit) break;
    const end = text.indexOf(hit.close, hit.at + hit.open.length);
    if (end < 0) break;
    out += esc(text.slice(i, hit.at));
    out += katex.renderToString(text.slice(hit.at + hit.open.length, end), {
      displayMode: hit.display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      maxExpand: 500,
    });
    i = end + hit.close.length;
    found = true;
  }
  if (!found) return null;
  return out + esc(text.slice(i));
};

/** Replace every expression inside `root` with rendered KaTeX. */
export const renderMath = (root: HTMLElement): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (hasMath((n as Text).data) && !(n.parentElement?.closest('.katex'))) nodes.push(n as Text);
  }
  nodes.forEach(node => {
    const html = renderText(node.data);
    if (html === null) return;
    const span = document.createElement('span');
    span.innerHTML = html;
    node.replaceWith(...Array.from(span.childNodes));
  });
};
