/* ── Reading a formulas file ──
   What an administrator drops into Console → Store → Import formulas: a CSV
   (or tab-separated) file, one formula per line, as Name, Formula, Tags.

     Kinetic energy, $K = \tfrac12 mv^2$, mechanics
     Ideal gas law,  $PV = nRT$,           gases

   It is the deck importer's reader (decks/anki.ts) with three differences,
   because a formulas file is written by hand in a spreadsheet, not exported
   from a flashcard app:
   - A first row of column names ("Name, Formula, Tags") is recognised.
   - Maths written as $…$ (and $$…$$ for a line of its own) becomes \(…\)
     and \[…\], the delimiters every card in Alpha uses (decks/math.ts). It is
     on by default when the file has any, and the screen can turn it off for
     a file where $ means rupees. \$ stays a dollar sign.
   - A field is plain text unless it carries real HTML tags, so "a < b" in a
     formula is never read as the start of a tag.

   Where the formulas go (a sheet, or a flashcard deck) is the screen's
   choice, not the file's. React-free and tested (decks/tests/storeModel.test.ts). */

import { readAnkiFile, toNotes, type AnkiFile, type ImportRow } from '../decks/anki';

const HEADER_WORDS = new Set([
  'name', 'names', 'formula', 'formulas', 'formulae', 'equation', 'expression', 'label', 'quantity', 'law', 'title',
  'front', 'back', 'tags', 'tag', 'topic', 'term', 'definition', 'meaning', 'note', 'notes', 'question', 'answer',
]);

const HTML_TAG = /<\/?(b|i|u|em|strong|br|sub|sup|div|span|p|img|ul|ol|li|table|tr|td|th|code|pre)\b[^>]*>/i;

/** Does this text hold $…$ maths? A lone price ("₹50 or $3") does not count. */
export const hasDollarMath = (text: string): boolean =>
  /\$\$[^$]+\$\$/.test(text) || /(^|[^\\$])\$(?=\S)[^$\n]*?[\\^_=+\-/{}()][^$\n]*?(?<=\S)\$(?!\d)/.test(text);

/** $$…$$ → \[…\], $…$ → \(…\). An escaped \$ is a dollar sign. */
export const dollarsToTex = (s: string): string =>
  s
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `\\[${m.trim()}\\]`)
    .replace(/(^|[^\\])\$([^$\n]+?)(?<!\\)\$/g, (_, pre: string, m: string) => `${pre}\\(${m.trim()}\\)`)
    .replace(/\\\$/g, '$');

export interface FormulaFile extends AnkiFile {
  /** The file uses $…$ for maths. */
  dollars: boolean;
}

export const readFormulaFile = (text: string): FormulaFile => {
  const f = readAnkiFile(text);
  const firstCells = (f.rows[0] ?? []).map(c => c.trim().toLowerCase()).filter(Boolean);
  const headerGuess = !f.anki && f.rows.length > 1 && firstCells.length > 0 && firstCells.every(c => HEADER_WORDS.has(c));
  return {
    ...f,
    // Without Anki's own #html directive, a field is plain unless it carries real tags.
    html: f.anki ? f.html : HTML_TAG.test(text),
    headerGuess,
    dollars: hasDollarMath(text),
  };
};

/** The file's rows as notes, with $…$ maths converted when asked. */
export const toFormulaNotes = (file: FormulaFile, firstRowIsHeader: boolean, dollars: boolean): ImportRow[] =>
  toNotes(file, firstRowIsHeader).map(r =>
    r.status === 'ok' && dollars
      ? { ...r, note: { ...r.note, front: dollarsToTex(r.note.front), back: dollarsToTex(r.note.back) } }
      : r);

export const sectionFromFile = (name: string) =>
  name.replace(/\.(csv|txt|tsv)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Formulas';
