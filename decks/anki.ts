/* ── Reading an Anki export ──
   The goal is "Export from Anki → drop it here → done", so this reads what
   Anki actually writes rather than a format of our own:

   - Anki's header directives, when present: #separator, #html, #tags column,
     #guid column, #notetype column, #deck column, #columns. Anki 2.1.55+ puts
     these at the top of every "Notes in Plain Text" export, and they say
     exactly which column is which — so with them, nothing is guessed.
   - Without them: the delimiter is sniffed, and columns are Front, Back, Tags.

   The first row is NOT assumed to be a header. Most Anki exports have none,
   and throwing away the first card of every import is the classic bug. A row
   is called a header only when every cell is a header word and nothing in it
   is a cloze; the preview shows the decision as a toggle either way. */

import { parseCsv, sniffDelimiter, stripBom } from './csv';
import { isCloze, parseCloze } from './cloze';
import { escapeHtml } from './html';
import type { DraftNote } from './types';

export interface AnkiFile {
  delimiter: string;
  /** "tab-separated", "comma-separated"… for the "Detected format" line. */
  delimiterName: string;
  html: boolean;
  /** True when the file carried Anki's own #directives. */
  anki: boolean;
  /** 0-based field columns, front then back, after meta columns are removed. */
  fieldColumns: number[];
  tagsColumn: number | null;
  guidColumn: number | null;
  rows: string[][];
  lines: number[];
  /** The heuristic's answer to "is row 1 a header". */
  headerGuess: boolean;
  /** Present when the file cannot be read at all. */
  fatal?: string;
}

export type ImportRow =
  | { line: number; status: 'ok'; note: DraftNote }
  | { line: number; status: 'problem'; reason: string; preview: string }
  | { line: number; status: 'skipped' };

const SEPARATORS: Record<string, string> = {
  comma: ',', semicolon: ';', tab: '\t', space: ' ', pipe: '|', colon: ':',
};
const NAMES: Record<string, string> = {
  ',': 'comma-separated', ';': 'semicolon-separated', '\t': 'tab-separated', '|': 'pipe-separated', ' ': 'space-separated', ':': 'colon-separated',
};
const HEADER_WORDS = new Set(['front', 'back', 'text', 'extra', 'back extra', 'tags', 'tag', 'question', 'answer', 'term', 'definition', 'notes', 'guid', 'deck', 'notetype', 'note type']);

export const MAX_FIELD = 20000;
export const MAX_TAGS = 40;

/** Anki writes tags space-separated; hierarchical tags (a::b) stay whole. */
export const parseTags = (raw: string): string[] =>
  Array.from(new Set(raw.split(/[\s,]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean).map(t => t.slice(0, 60)))).slice(0, MAX_TAGS);

const looksLikeHeader = (row: string[], fieldCols: number[], tagsCol: number | null): boolean => {
  const cells = [...fieldCols, ...(tagsCol !== null ? [tagsCol] : [])].map(c => (row[c] ?? '').trim().toLowerCase()).filter(Boolean);
  if (!cells.length) return false;
  if (row.some(c => /\{\{c\d+::/.test(c))) return false;
  return cells.every(c => HEADER_WORDS.has(c));
};

export const readAnkiFile = (input: string): AnkiFile => {
  const text = stripBom(input);
  // Directives are the leading lines that start with "#" and carry a ":".
  const all = text.split(/\r?\n/);
  let skip = 0;
  const dir: Record<string, string> = {};
  while (skip < all.length && /^#[a-z ]+:/i.test(all[skip])) {
    const [k, ...v] = all[skip].slice(1).split(':');
    dir[k.trim().toLowerCase()] = v.join(':').trim();
    skip += 1;
  }
  const body = all.slice(skip).join('\n');
  const anki = skip > 0;

  let delimiter = sniffDelimiter(body);
  if (dir.separator) {
    const s = dir.separator.toLowerCase();
    delimiter = SEPARATORS[s] ?? (dir.separator.length === 1 ? dir.separator : delimiter);
  }
  const html = dir.html ? dir.html.toLowerCase() === 'true' : true;

  const col = (k: string): number | null => {
    const n = Number(dir[`${k} column`]);
    return Number.isInteger(n) && n >= 1 ? n - 1 : null;
  };
  let tagsColumn = col('tags');
  const guidColumn = col('guid');
  const meta = new Set([guidColumn, col('notetype'), col('deck')].filter((c): c is number => c !== null));

  const parsed = parseCsv(body, delimiter, skip + 1);
  const width = parsed.rows.reduce((w, r) => Math.max(w, r.length), 0);

  // #columns:Text<TAB>Back Extra<TAB>Tags names the tags column when nothing else does.
  if (tagsColumn === null && dir.columns) {
    const names = parseCsv(dir.columns, delimiter).rows[0] ?? [];
    const i = names.findIndex(n => n.trim().toLowerCase() === 'tags');
    if (i >= 0) tagsColumn = i;
  }
  if (tagsColumn !== null) meta.add(tagsColumn);
  const fieldColumns = Array.from({ length: Math.max(width, 2) }, (_, i) => i).filter(i => !meta.has(i));
  // Without directives: Front, Back, Tags.
  if (!anki && tagsColumn === null && width >= 3) {
    tagsColumn = 2;
    fieldColumns.splice(fieldColumns.indexOf(2), 1);
  }

  const headerGuess = !anki && parsed.rows.length > 1 && looksLikeHeader(parsed.rows[0], fieldColumns.slice(0, 2), tagsColumn);

  return {
    delimiter,
    delimiterName: NAMES[delimiter] ?? `"${delimiter}"-separated`,
    html,
    anki,
    fieldColumns,
    tagsColumn,
    guidColumn,
    rows: parsed.rows,
    lines: parsed.lines,
    headerGuess,
    fatal: parsed.error?.message,
  };
};

/** Plain text from a file that said #html:false — escaped, line breaks kept. */
const fromPlain = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');
/** HTML from Anki: a raw line break in a field with no markup is still meant as one. */
const fromHtml = (s: string): string => (/<[a-z/][^>]*>/i.test(s) ? s : s.replace(/\r?\n/g, '<br>'));

const snippet = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}…` : s);

/** Turn the file's rows into notes, one verdict per row. */
export const toNotes = (file: AnkiFile, firstRowIsHeader: boolean): ImportRow[] => {
  const [fc, bc] = file.fieldColumns;
  const conv = file.html ? fromHtml : fromPlain;
  return file.rows.flatMap((row, i): ImportRow[] => {
    if (i === 0 && firstRowIsHeader) return [];
    const line = file.lines[i];
    if (row.every(c => !c.trim())) return [{ line, status: 'skipped' }];
    const front = conv((row[fc] ?? '').trim());
    const back = conv((row[bc] ?? '').trim());
    const tags = file.tagsColumn !== null ? parseTags(row[file.tagsColumn] ?? '') : [];
    const guid = file.guidColumn !== null ? (row[file.guidColumn] ?? '').trim().slice(0, 64) : '';

    if (!front.trim()) return [{ line, status: 'problem', reason: 'The front is empty.', preview: snippet(back || row.join(' ')) }];
    if (front.length > MAX_FIELD || back.length > MAX_FIELD) return [{ line, status: 'problem', reason: 'This card is too long (20,000 characters max).', preview: snippet(front) }];

    const looksCloze = /\{\{\s*c\s*\d*\s*:/.test(front);
    if (looksCloze) {
      const { errors } = parseCloze(front);
      if (errors.length || !isCloze(front)) {
        return [{ line, status: 'problem', reason: errors[0] ?? 'The cloze isn\'t written as {{c1::answer}}.', preview: snippet(front) }];
      }
    }
    return [{
      line,
      status: 'ok',
      note: { kind: looksCloze ? 'cloze' : 'basic', front, back, tags, ...(guid ? { guid } : {}) },
    }];
  });
};
