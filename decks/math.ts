/* ── Maths on cards ──
   Every delimiter a student is likely to type or paste: \( … \) and $ … $
   inline, \[ … \] and $$ … $$ on their own line. mhchem is loaded too, so
   \ce{LiAlH4} reads as chemistry.

   "$" is also money, so a single $ follows Pandoc's rule: the opening one
   is followed by a non-space, the closing one follows a non-space and is
   not followed by a digit. "$5 and $10" stays prose; "$v = u + at$" is
   maths. \$ is a literal dollar.

   Runs over the text nodes of an already-sanitised card, so the HTML around
   an expression is never re-parsed. Reached only through a dynamic import:
   KaTeX is heavy and a deck with no maths never downloads it. */

import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

import { hasMath, nextMath } from './mathScan';

export { hasMath, nextMath };

const renderText = (text: string): string | null => {
  let out = '';
  let i = 0;
  let found = false;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (let hit = nextMath(text, 0); hit; hit = nextMath(text, i)) {
    out += esc(text.slice(i, hit.at));
    out += katex.renderToString(hit.tex.trim(), {
      displayMode: hit.display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      maxExpand: 500,
    });
    i = hit.end;
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
