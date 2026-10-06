/* ── CSV, properly ──
   An RFC 4180 reader: quoted fields, "" inside quotes, delimiters and line
   breaks inside quotes, CRLF or LF, a byte-order mark. Never `.split(',')` —
   a card that says "Aldehydes, ketones and acids" is one field, not three.

   It is lenient exactly where Anki's own output needs it to be: a quote in
   the middle of an unquoted field is a literal character (`<img src="a.png">`
   written by a tool that only quotes when it has to), not an error. The one
   unrecoverable shape is a quote that opens and never closes, and that is
   reported with the line it opened on. */

export interface CsvResult {
  rows: string[][];
  /** The 1-based line each row starts on, for "row 12 needs attention". */
  lines: number[];
  error?: { line: number; message: string };
}

export const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

export const parseCsv = (input: string, delimiter = ',', startLine = 1): CsvResult => {
  const text = stripBom(input);
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = '';
  let line = startLine;
  let rowLine = startLine;
  let i = 0;
  let quoted = false;
  let quoteLine = 0;
  let fieldStart = true;

  const endField = () => { row.push(field); field = ''; fieldStart = true; };
  const endRow = () => {
    endField();
    rows.push(row);
    lines.push(rowLine);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false;
        i += 1;
        continue;
      }
      if (ch === '\n') line += 1;
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && fieldStart) {
      quoted = true;
      quoteLine = line;
      fieldStart = false;
      i += 1;
      continue;
    }
    if (ch === delimiter) { endField(); i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      i += 1;
      line += 1;
      rowLine = line;
      continue;
    }
    field += ch;
    fieldStart = false;
    i += 1;
  }

  if (quoted) {
    return { rows, lines, error: { line: quoteLine, message: `A quote opened on line ${quoteLine} never closes.` } };
  }
  // The last row, unless the file ended with a line break.
  if (field !== '' || row.length > 0) endRow();
  return { rows, lines };
};

const CANDIDATES = [',', '\t', ';', '|'];

/**
 * The delimiter a file uses, judged from its first lines: the candidate that
 * appears (outside quotes) on most lines, with a consistent count. Comma when
 * nothing decides it — a one-column file is still a valid file.
 */
export const sniffDelimiter = (text: string): string => {
  const sample = stripBom(text).split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).slice(0, 20);
  let best = ',';
  let bestScore = 0;
  for (const d of CANDIDATES) {
    const counts = sample.map(l => {
      let n = 0;
      let q = false;
      for (const ch of l) {
        if (ch === '"') q = !q;
        else if (ch === d && !q) n += 1;
      }
      return n;
    });
    const withIt = counts.filter(n => n > 0);
    if (!withIt.length) continue;
    const mode = withIt.sort((a, b) => withIt.filter(x => x === b).length - withIt.filter(x => x === a).length)[0];
    const consistent = counts.filter(n => n === mode).length;
    const score = consistent * 10 + withIt.length;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
};

/** Quote a field only when it has to be. */
export const csvField = (v: string, delimiter = ','): string =>
  /["\r\n]/.test(v) || v.includes(delimiter) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export const writeCsv = (rows: string[][], delimiter = ','): string =>
  rows.map(r => r.map(f => csvField(f, delimiter)).join(delimiter)).join('\n');
