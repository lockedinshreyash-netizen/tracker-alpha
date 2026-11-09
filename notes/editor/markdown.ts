/* Markdown in: pasted from Obsidian, a ChatGPT answer, a Notion export, or a
   .md file imported whole. TipTap's Markdown extension parses the structure;
   this file adds what it does not know, the $…$ and $$…$$ that every one of
   those sources uses for maths.

   Maths is lifted out before parsing and put back after, because Markdown
   would read the * and _ inside `$a_1 * b_1$` as emphasis. Every delimiter
   a student meets is read: $…$ and $$…$$ (Obsidian, Notion) and \(…\) and
   \[…\] (what ChatGPT copies out), by the same scanner the flashcards use
   (decks/mathScan.ts), so "$5 and $10" stays prose in both. */

import type { JSONContent } from '@tiptap/core';
import { nextMath } from '../../decks/mathScan';

/** Plain text that is obviously Markdown. Prose with one asterisk is not. */
export const looksLikeMarkdown = (text: string): boolean => {
  const lines = text.split('\n');
  let hits = 0;
  for (const l of lines.slice(0, 200)) {
    if (/^\s{0,3}(#{1,6}\s|[-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s|>\s|```|\|.*\|)/.test(l)) hits++;
    if (/\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\$\$|\$[^$\s][^$]*\$/.test(l)) hits++;
  }
  return hits >= 2 || (lines.length > 1 && hits >= 1 && /^#{1,6}\s/m.test(text));
};

export interface MathStash { latex: string; display: boolean }

const TOKEN = /ntmath(\d+)z/g;

/** Plain text as runs of text and maths, in order. */
export type MathRun = { t: 'text'; v: string } | { t: 'math'; latex: string; display: boolean };
export const splitMath = (text: string): MathRun[] => {
  const out: MathRun[] = [];
  let i = 0;
  for (let hit = nextMath(text, 0); hit; hit = nextMath(text, i)) {
    if (hit.at > i) out.push({ t: 'text', v: text.slice(i, hit.at) });
    out.push({ t: 'math', latex: hit.tex.trim(), display: hit.display });
    i = hit.end;
  }
  if (i < text.length) out.push({ t: 'text', v: text.slice(i) });
  return out;
};

/** The whole string is one display equation ($$…$$ or \[…\]): its LaTeX, else null. */
export const displayOnly = (text: string): string | null => {
  const runs = splitMath(text.trim());
  return runs.length === 1 && runs[0].t === 'math' && runs[0].display ? runs[0].latex : null;
};

/** Swap every equation outside code for a token Markdown leaves alone. */
export const protectMath = (md: string): { md: string; stash: MathStash[] } => {
  const stash: MathStash[] = [];
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  const out = parts.map((part, i) => (i % 2 === 1 ? part : splitMath(part).map(r => {
    if (r.t === 'text') return r.v;
    stash.push({ latex: r.latex, display: r.display });
    return `ntmath${stash.length - 1}z`;
  }).join('')));
  return { md: out.join(''), stash };
};

/** Plain text (no Markdown) as paragraphs, equations made real. A line that is one display equation is a display block. */
export const textToBlocks = (text: string): JSONContent[] =>
  text.replace(/\r\n?/g, '\n').split('\n').flatMap((line): JSONContent[] => {
    if (!line.trim()) return [];
    const block = displayOnly(line);
    if (block !== null) return [{ type: 'mathBlock', attrs: { latex: block } }];
    const content = splitMath(line).map((r): JSONContent => (r.t === 'text'
      ? { type: 'text', text: r.v }
      : { type: 'mathInline', attrs: { latex: r.latex } }));
    return [{ type: 'paragraph', content }];
  });

const splitText = (node: JSONContent, stash: MathStash[]): JSONContent[] => {
  const text = node.text ?? '';
  if (!text.includes('ntmath')) return [node];
  const out: JSONContent[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const s = stash[Number(m[1])];
    if (!s) continue;
    if (at > last) out.push({ ...node, text: text.slice(last, at) });
    out.push(s.display ? { type: 'mathBlock', attrs: { latex: s.latex } } : { type: 'mathInline', attrs: { latex: s.latex } });
    last = at + m[0].length;
  }
  if (!out.length) return [node];
  if (last < text.length) out.push({ ...node, text: text.slice(last) });
  return out;
};

const blank = (n: JSONContent) => n.type === 'hardBreak' || (n.type === 'text' && !(n.text ?? '').trim());

/* A paragraph's inline content with display equations in it: the paragraph
   is cut around each one, so "where\n$$x$$\nso" is text, a display
   equation, text. Line breaks at the cuts are dropped. */
const cutParagraph = (node: JSONContent, content: JSONContent[]): JSONContent[] => {
  if (!content.some(c => c.type === 'mathBlock')) return [{ ...node, content }];
  const out: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    while (run.length && blank(run[0])) run.shift();
    while (run.length && blank(run[run.length - 1])) run.pop();
    if (run.length) {
      const first = run[0], lastNode = run[run.length - 1];
      if (first.type === 'text') run[0] = { ...first, text: (first.text ?? '').replace(/^\s+/, '') };
      if (lastNode.type === 'text') run[run.length - 1] = { ...run[run.length - 1], text: (run[run.length - 1].text ?? '').replace(/\s+$/, '') };
      out.push({ ...node, content: run });
    }
    run = [];
  };
  for (const c of content) {
    if (c.type === 'mathBlock') { flush(); out.push(c); } else run.push(c);
  }
  flush();
  return out;
};

/** Put the equations back: inline as inline, a display equation ($$…$$, \[…\]) as a display block. */
export const restoreMath = (doc: JSONContent, stash: MathStash[]): JSONContent => {
  if (!stash.length) return doc;
  const walk = (node: JSONContent): JSONContent[] => {
    if (node.type === 'codeBlock') return [node];
    if (!node.content) return [node];
    const content = node.content.flatMap(c => (c.type === 'text' ? splitText(c, stash) : walk(c)));
    if (node.type === 'paragraph') return cutParagraph(node, content);
    // Inside any other line of text (a heading) a display equation stays inline: it cannot leave the line.
    const inline = node.content.some(c => c.type === 'text' || c.type === 'hardBreak');
    // A list item must open with a paragraph, even when its first line was an equation.
    if ((node.type === 'listItem' || node.type === 'taskItem') && content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
    return [{ ...node, content: inline ? content.map(c => (c.type === 'mathBlock' ? { type: 'mathInline', attrs: c.attrs } : c)) : content }];
  };
  return walk(doc)[0];
};
