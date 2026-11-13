/* ── A highlighted line as a fill-in-the-blank card ──
   Pure and tested. The student taps the words to hide; each run of
   consecutive hidden words (the spaces between them included) becomes one
   blank, `{{c1::…}}`, `{{c2::…}}`, and each blank is its own card when
   studied, as everywhere in Decks (decks/cloze.ts). */

export const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The quote as tokens: words and the whitespace between them, in order. */
export const tokensOf = (quote: string): string[] => quote.split(/(\s+)/).filter(t => t.length);

export const clozeFrom = (tokens: string[], hidden: Set<number>): string => {
  let out = '';
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!hidden.has(i)) { out += escapeHtml(tokens[i]); continue; }
    let j = i;
    while (j + 2 < tokens.length && /^\s+$/.test(tokens[j + 1]) && hidden.has(j + 2)) j += 2;
    out += `{{c${++n}::${escapeHtml(tokens.slice(i, j + 1).join(''))}}}`;
    i = j;
  }
  return out;
};
