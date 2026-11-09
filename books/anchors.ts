/* ── Finding a highlight again in a PDF page ──
   Pure and tested. A PDF has no authored ids the way the LOCK IN book does
   (reader/model.ts), so a highlight is anchored three ways, strongest first:

   1. offsets into the page's text: pdf.js's text items for the page, joined
      exactly as `pageText` joins them (the reader builds the text layer from
      the same items, so a DOM selection maps to these offsets);
   2. the words themselves (`quote`), searched for on that page when the
      offsets no longer hold them (a different pdf.js build splitting items
      differently, say), nearest to where they were;
   3. the rectangles, as page fractions, which always draw something even on
      a page with no text at all.

   Selections are snapped out to whole words before saving, the rule the
   LOCK IN reader keeps (reader/model.ts snapToWords). */

/** A text item from pdf.js, reduced to what anchoring needs. */
export interface TextPiece { str: string; hasEOL?: boolean }

/** The page's text as one string, and where each item starts in it. */
export const pageText = (items: TextPiece[]): { text: string; starts: number[] } => {
  let text = '';
  const starts: number[] = [];
  for (const it of items) {
    starts.push(text.length);
    text += it.str;
    if (it.hasEOL) text += '\n';
  }
  return { text, starts };
};

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

const WORD = /[\p{L}\p{N}_'’-]/u;

/** Widens [start, end) to whole words and trims edge whitespace. */
export const snapToWords = (text: string, start: number, end: number): [number, number] => {
  let a = Math.max(0, Math.min(start, end));
  let b = Math.min(text.length, Math.max(start, end));
  while (a < b && /\s/.test(text[a])) a++;
  while (b > a && /\s/.test(text[b - 1])) b--;
  if (a === b) return [a, b];
  while (a > 0 && WORD.test(text[a - 1]) && WORD.test(text[a])) a--;
  while (b < text.length && WORD.test(text[b]) && WORD.test(text[b - 1])) b++;
  return [a, b];
};

/** The words between two offsets, as stored in `quote`. */
export const quoteOf = (text: string, start: number, end: number): string => squash(text.slice(start, end));

/* Whitespace in a PDF's text is unreliable (a line break here, a double space
   there), so the quote is searched for with every run of whitespace matching
   every other. Returns offsets in the original text. */
const findAll = (text: string, quote: string): [number, number][] => {
  const q = squash(quote);
  if (!q) return [];
  const pattern = q.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  const re = new RegExp(pattern, 'g');
  const out: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 50) {
    out.push([m.index, m.index + m[0].length]);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
};

export type Resolved = { start: number; end: number; via: 'offsets' | 'quote' } | { via: 'rects' };

export const resolveHighlight = (text: string, h: { start?: number; end?: number; quote?: string }): Resolved => {
  const quote = h.quote ?? '';
  if (h.start !== undefined && h.end !== undefined && h.end <= text.length && squash(text.slice(h.start, h.end)) === squash(quote)) {
    return { start: h.start, end: h.end, via: 'offsets' };
  }
  const hits = findAll(text, quote);
  if (hits.length) {
    const near = h.start ?? 0;
    const [start, end] = hits.reduce((best, x) => (Math.abs(x[0] - near) < Math.abs(best[0] - near) ? x : best));
    return { start, end, via: 'quote' };
  }
  return { via: 'rects' };
};

/** Every match of a search on a page, as offsets (for the drawer's Search). */
export const searchPage = (text: string, query: string): [number, number][] => {
  const q = squash(query);
  if (q.length < 2) return [];
  return findAll(text.toLowerCase(), q.toLowerCase());
};

/** A line of context around a match, for a search result. */
export const contextOf = (text: string, start: number, end: number, around = 50): string => {
  const a = Math.max(0, start - around);
  const b = Math.min(text.length, end + around);
  return `${a > 0 ? '…' : ''}${squash(text.slice(a, b))}${b < text.length ? '…' : ''}`;
};
