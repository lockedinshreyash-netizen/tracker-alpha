/* Markdown in: pasted from Obsidian, a ChatGPT answer, a Notion export, or a
   .md file imported whole. TipTap's Markdown extension parses the structure;
   this file adds what it does not know, the $…$ and $$…$$ that every one of
   those sources uses for maths.

   Maths is lifted out before parsing and put back after, because Markdown
   would read the * and _ inside `$a_1 * b_1$` as emphasis. */

import type { JSONContent } from '@tiptap/core';

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

const MATH = /\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*[^\s$])?)\$/g;
const TOKEN = /ntmath(\d+)z/g;

/** Swap every equation outside code for a token Markdown leaves alone. */
export const protectMath = (md: string): { md: string; stash: MathStash[] } => {
  const stash: MathStash[] = [];
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  const out = parts.map((part, i) => (i % 2 === 1 ? part : part.replace(MATH, (_, d?: string, inl?: string) => {
    stash.push({ latex: (d ?? inl ?? '').trim(), display: d != null });
    return `ntmath${stash.length - 1}z`;
  })));
  return { md: out.join(''), stash };
};

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
    out.push({ type: 'mathInline', attrs: { latex: s.latex } });
    last = at + m[0].length;
  }
  if (!out.length) return [node];
  if (last < text.length) out.push({ ...node, text: text.slice(last) });
  return out;
};

/** Put the equations back: inline as inline, a paragraph that is one $$…$$ as a display equation. */
export const restoreMath = (doc: JSONContent, stash: MathStash[]): JSONContent => {
  if (!stash.length) return doc;
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === 'codeBlock') return node;
    if (node.type === 'paragraph' && node.content?.length === 1 && node.content[0].type === 'text') {
      const only = (node.content[0].text ?? '').trim().match(/^ntmath(\d+)z$/);
      const s = only ? stash[Number(only[1])] : undefined;
      if (s?.display) return { type: 'mathBlock', attrs: { latex: s.latex } };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.flatMap(c => (c.type === 'text' ? splitText(c, stash) : [walk(c)])) };
  };
  return walk(doc);
};
