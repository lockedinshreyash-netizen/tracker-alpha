/* ── Cloze ──
   Anki's syntax, read the way Anki reads it: {{c1::answer}} and
   {{c1::answer::hint}}. One note with c1 and c2 is two cards; on card N, cloze
   N is hidden and every other cloze shows its answer as plain text.

   One deliberate improvement: matching is brace-aware. Anki ends a cloze at
   the first "}}", so {{c1::\frac{a}{b}}} closes one brace early and leaves a
   stray "}" behind — the reason Anki users learn to type a space before the
   closing braces. Here braces inside the answer are counted, so LaTeX closes
   where it looks like it should. When the braces inside do not balance, the
   reader falls back to Anki's rule, so anything Anki accepts reads the same.

   The database decides which cards a note makes from a plain regex on
   `{{cN::` (supabase/decks.sql, deck_note_ordinals). Any note this file calls
   valid makes the same set there. */

export type ClozeSeg =
  | { t: 'text'; v: string }
  | { t: 'cloze'; n: number; answer: string; hint?: string; raw: string };

export interface ClozeParse {
  segs: ClozeSeg[];
  /** Human-readable problems. Empty means the text is a well-formed cloze note. */
  errors: string[];
}

const OPEN = /\{\{c(\d{1,2})::/g;

/** Index just past the closing "}}" of a cloze whose content starts at `from`, or -1. */
const findClose = (src: string, from: number): number => {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      if (depth === 0 && src[i + 1] === '}') return i;
      if (depth > 0) depth -= 1;
    }
  }
  // Braces never balanced: Anki's rule, the first "}}".
  return src.indexOf('}}', from);
};

/** Split "answer::hint" at the first "::" outside braces. */
const splitHint = (content: string): { answer: string; hint?: string } => {
  let depth = 0;
  for (let i = 0; i < content.length - 1; i += 1) {
    const ch = content[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ':' && content[i + 1] === ':' && depth === 0) {
      return { answer: content.slice(0, i), hint: content.slice(i + 2) };
    }
  }
  return { answer: content };
};

export const parseCloze = (src: string): ClozeParse => {
  const segs: ClozeSeg[] = [];
  const errors: string[] = [];
  let last = 0;
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(src))) {
    const n = Number(m[1]);
    const contentStart = m.index + m[0].length;
    const close = findClose(src, contentStart);
    if (close < 0) {
      errors.push(`c${n} is never closed — it needs "}}" at the end.`);
      break;
    }
    if (m.index > last) segs.push({ t: 'text', v: src.slice(last, m.index) });
    const content = src.slice(contentStart, close);
    const { answer, hint } = splitHint(content);
    if (n < 1) errors.push('Cloze numbers start at c1.');
    if (!answer.trim()) errors.push(`c${n} is empty.`);
    if (/\{\{c\d{1,2}::/.test(content)) errors.push('A cloze inside another cloze isn\'t supported yet.');
    segs.push({ t: 'cloze', n, answer, hint: hint?.trim() ? hint : undefined, raw: src.slice(m.index, close + 2) });
    last = close + 2;
    OPEN.lastIndex = last;
  }
  if (last < src.length) segs.push({ t: 'text', v: src.slice(last) });
  // "{{c1:x}}", "{{c:: x}}", "{{ c1::x}}" — typed close enough to mean a cloze.
  const leftover = segs.filter(s => s.t === 'text').map(s => (s as { v: string }).v).join(' ');
  if (/\{\{\s*c\s*\d*\s*:/.test(leftover)) errors.push('Something looks like a cloze but isn\'t written as {{c1::answer}}.');
  return { segs, errors };
};

/** True when the text contains at least one well-formed cloze and no problems. */
export const isCloze = (src: string): boolean => {
  const p = parseCloze(src);
  return p.errors.length === 0 && p.segs.some(s => s.t === 'cloze');
};

/** The cloze numbers in a note, ascending and distinct — one card each. */
export const ordinals = (src: string): number[] =>
  Array.from(new Set(parseCloze(src).segs.flatMap(s => (s.t === 'cloze' && s.n >= 1 ? [s.n] : [])))).sort((a, b) => a - b);

/** The number the next new cloze should take: one past the highest. */
export const nextOrdinal = (src: string): number => {
  const ns = ordinals(src);
  return ns.length ? ns[ns.length - 1] + 1 : 1;
};

/**
 * Renumber clozes 1..k in order of first appearance. Only ever offered for a
 * note that has not been saved: on a saved note the numbers ARE the cards,
 * and renumbering would hand c3's review history to whatever became c3.
 * Gaps (c1, c3) are valid Anki and harmless.
 */
export const normalizeOrdinals = (src: string): string => {
  const order: number[] = [];
  for (const s of parseCloze(src).segs) if (s.t === 'cloze' && !order.includes(s.n)) order.push(s.n);
  const map = new Map(order.map((n, i) => [n, i + 1]));
  return parseCloze(src).segs.map(s => {
    if (s.t === 'text') return s.v;
    const n = map.get(s.n) ?? s.n;
    return `{{c${n}::${s.answer}${s.hint !== undefined ? `::${s.hint}` : ''}}}`;
  }).join('');
};

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The HTML for one card of a cloze note. The target cloze becomes a marker the
 * renderer styles (`data-cloze="hidden"` shows the hint or a blank,
 * `"shown"` the answer); every other cloze is just its answer. The result
 * still goes through the sanitiser — answers are HTML from the note.
 */
export const renderCloze = (src: string, ord: number, revealed: boolean): string =>
  parseCloze(src).segs.map(s => {
    if (s.t === 'text') return s.v;
    if (s.n !== ord) return s.answer;
    if (revealed) return `<span data-cloze="shown">${s.answer}</span>`;
    if (s.hint) return `<span data-cloze="hidden" data-hint="${escapeAttr(s.hint)}">${escapeAttr(s.hint)}</span>`;
    return `<span data-cloze="hidden" data-size="${blankSize(s.answer)}"><span data-sr>blank</span></span>`;
  }).join('');

/* A blank as long as a short word, a phrase or a sentence — the way a printed
   fill-in-the-blank is — without giving away the letter count. */
const blankSize = (answer: string): 's' | 'm' | 'l' => {
  const n = answer.replace(/<[^>]*>/g, '').trim().length;
  return n <= 5 ? 's' : n <= 14 ? 'm' : 'l';
};

/** Every cloze shown and marked, for browsing a note rather than studying one card of it. */
export const renderAllAnswers = (src: string): string =>
  parseCloze(src).segs.map(s => (s.t === 'text' ? s.v : `<span data-cloze="mark">${s.answer}</span>`)).join('');

/** The answers a card asks for, as text — for the screen reader's announcement. */
export const answersFor = (src: string, ord: number): string[] =>
  parseCloze(src).segs.flatMap(s => (s.t === 'cloze' && s.n === ord ? [s.answer] : []));

