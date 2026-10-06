/* ── Export, back to Anki ──
   Nobody should feel trapped. The file this writes is what Anki's own "Notes
   in Plain Text" export looks like: directives on top saying which column is
   which, so Anki's importer — and ours — maps it with no questions asked.
   Cloze syntax, tags and HTML go out exactly as stored.

   The guid column carries Anki's original id when the note came from Anki,
   so re-importing into the same Anki collection updates the notes instead of
   duplicating them; otherwise the note's own id stands in. The notetype
   column names Anki's built-in "Cloze" and "Basic". */

import { writeCsv } from './csv';
import type { Note } from './types';

export const exportNotes = (notes: Pick<Note, 'id' | 'kind' | 'front' | 'back' | 'tags' | 'guid'>[]): string => {
  const head = ['#separator:Comma', '#html:true', '#tags column:3', '#guid column:4', '#notetype column:5'].join('\n');
  const rows = notes.map(n => [n.front, n.back, n.tags.join(' '), n.guid ?? n.id, n.kind === 'cloze' ? 'Cloze' : 'Basic']);
  return `${head}\n${writeCsv(rows)}\n`;
};

/** A file name a phone and a laptop will both accept. */
export const exportFileName = (title: string): string =>
  `${title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, ' ') || 'deck'}.csv`;
