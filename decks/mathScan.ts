/* ── Where the maths is, in plain text ──
   Pure, React-free and KaTeX-free, so Notes and the card renderer share one
   reading of the delimiters without either loading the other. The rules are
   in decks/math.ts's header. Tested through notes/editor/markdown.ts (npm run test:notes). */

export const hasMath = (html: string): boolean => /\\\(|\\\[|\$/.test(html);

export interface MathHit { at: number; end: number; tex: string; display: boolean }

/** The next expression at or after `from`, or null. Pure, and tested. */
export const nextMath = (text: string, from: number): MathHit | null => {
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      const n = text[i + 1];
      if (n === '(' || n === '[') {
        const close = n === '(' ? '\\)' : '\\]';
        const end = text.indexOf(close, i + 2);
        if (end > i + 2) return { at: i, end: end + 2, tex: text.slice(i + 2, end), display: n === '[' };
      }
      i++; // \$ and every other escape: skip the next character
      continue;
    }
    if (c !== '$') continue;
    if (text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end > i + 2 && text.slice(i + 2, end).trim()) return { at: i, end: end + 2, tex: text.slice(i + 2, end), display: true };
      i++;
      continue;
    }
    if (!text[i + 1] || /\s/.test(text[i + 1])) continue;
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') { j++; continue; }
      if (text[j] === '\n' && text[j + 1] === '\n') break;
      if (text[j] !== '$') continue;
      if (!/\s/.test(text[j - 1]) && !/\d/.test(text[j + 1] ?? '')) return { at: i, end: j + 1, tex: text.slice(i + 1, j), display: false };
      break;
    }
  }
  return null;
};
