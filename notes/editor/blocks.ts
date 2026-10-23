/* Every block the student can make, in the order the slash menu lists them.
   The same list drives "Turn into" and the phone's block button, so a block
   cannot exist in one menu and be missing from another. */

import type { Editor, Range } from '@tiptap/core';
import type { NotesEnv, SuggestItem } from './env';

type Run = (editor: Editor, range: Range) => void;

/* Delete what was typed to open the menu. Block commands then clearNodes()
   first: a boxout or heading cannot be made inside a list item (its first
   child must be a paragraph), and without lifting the line out of the list
   the command fails silently and the student sees nothing happen.  */
const clear = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export interface BlockDef {
  id: string;
  group: 'Basic' | 'Study' | 'Media' | 'Links';
  label: string;
  hint?: string;
  glyph: string;
  /** Present for blocks a selection can be turned into. */
  turn?: (editor: Editor) => void;
  run: Run;
  active?: (editor: Editor) => boolean;
}

export const blockDefs = (env: NotesEnv): BlockDef[] => [
  {
    id: 'text', group: 'Basic', label: 'Text', glyph: 'Aa',
    turn: e => { e.chain().focus().clearNodes().setParagraph().run(); },
    run: (e, r) => { clear(e, r).clearNodes().setParagraph().run(); },
    active: e => e.isActive('paragraph'),
  },
  ...[1, 2, 3].map(level => ({
    id: `h${level}`, group: 'Basic' as const, label: `Heading ${level}`, hint: '#'.repeat(level), glyph: `H${level}`,
    turn: (e: Editor) => { e.chain().focus().clearNodes().setHeading({ level: level as 1 | 2 | 3 }).run(); },
    run: (e: Editor, r: Range) => { clear(e, r).clearNodes().setHeading({ level: level as 1 | 2 | 3 }).run(); },
    active: (e: Editor) => e.isActive('heading', { level }),
  })),
  {
    id: 'bullet', group: 'Basic', label: 'Bulleted list', hint: '-', glyph: '•',
    turn: e => { e.chain().focus().clearNodes().toggleBulletList().run(); },
    run: (e, r) => { clear(e, r).toggleBulletList().run(); },
    active: e => e.isActive('bulletList'),
  },
  {
    id: 'number', group: 'Basic', label: 'Numbered list', hint: '1.', glyph: '1.',
    turn: e => { e.chain().focus().clearNodes().toggleOrderedList().run(); },
    run: (e, r) => { clear(e, r).toggleOrderedList().run(); },
    active: e => e.isActive('orderedList'),
  },
  {
    id: 'todo', group: 'Basic', label: 'To-do list', hint: '[]', glyph: '○',
    turn: e => { e.chain().focus().clearNodes().toggleTaskList().run(); },
    run: (e, r) => { clear(e, r).toggleTaskList().run(); },
    active: e => e.isActive('taskList'),
  },
  {
    id: 'toggle', group: 'Basic', label: 'Toggle', glyph: '▸',
    run: (e, r) => { clear(e, r).clearNodes().setDetails().run(); },
  },
  {
    id: 'quote', group: 'Basic', label: 'Pull quote', hint: '>', glyph: '“',
    turn: e => { e.chain().focus().clearNodes().toggleBlockquote().run(); },
    run: (e, r) => { clear(e, r).clearNodes().toggleBlockquote().run(); },
    active: e => e.isActive('blockquote'),
  },
  {
    id: 'callout', group: 'Basic', label: 'Boxout', glyph: '▭',
    turn: e => { e.chain().focus().clearNodes().wrapIn('callout').run(); },
    run: (e, r) => { clear(e, r).clearNodes().wrapIn('callout').run(); },
    active: e => e.isActive('callout'),
  },
  {
    id: 'divider', group: 'Basic', label: 'Divider', hint: '---', glyph: '—',
    run: (e, r) => { clear(e, r).setHorizontalRule().run(); },
  },
  {
    id: 'equation', group: 'Study', label: 'Equation', hint: '$$', glyph: '∑',
    run: (e, r) => { env.mathPending = true; clear(e, r).insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run(); },
  },
  {
    id: 'inline-math', group: 'Study', label: 'Inline equation', hint: '$', glyph: 'x²',
    run: (e, r) => { env.mathPending = true; clear(e, r).insertContent({ type: 'mathInline', attrs: { latex: '' } }).run(); },
  },
  {
    id: 'chemistry', group: 'Study', label: 'Reaction', glyph: '⇌',
    run: (e, r) => {
      clear(e, r).insertContent({ type: 'mathBlock', attrs: { latex: '\\ce{A + B -> C}' } }).run();
    },
  },
  {
    id: 'table', group: 'Study', label: 'Table', glyph: '▦',
    run: (e, r) => { clear(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); },
  },
  {
    id: 'code', group: 'Media', label: 'Code', hint: '```', glyph: '{ }',
    turn: e => { e.chain().focus().clearNodes().toggleCodeBlock().run(); },
    run: (e, r) => { clear(e, r).clearNodes().toggleCodeBlock().run(); },
    active: e => e.isActive('codeBlock'),
  },
  {
    id: 'image', group: 'Media', label: 'Image', glyph: '▢',
    run: (e, r) => { env.pickImage(e, r); },
  },
  {
    id: 'mention', group: 'Links', label: 'Mention a chapter', hint: '@', glyph: '@',
    run: (e, r) => { e.chain().focus().insertContentAt(r, '@').run(); },
  },
  {
    id: 'link', group: 'Links', label: 'Link to a page', hint: '[[', glyph: '↗',
    run: (e, r) => { e.chain().focus().insertContentAt(r, '[[').run(); },
  },
  {
    id: 'subpage', group: 'Links', label: 'Page inside this page', glyph: '↳',
    run: (e, r) => {
      const id = env.createSubpage();
      e.chain().focus().insertContentAt(r, [{ type: 'paragraph', content: [{ type: 'pageLink', attrs: { id } }] }]).run();
      env.openPage(id);
    },
  },
];

export const blockItems = (env: NotesEnv): SuggestItem[] =>
  blockDefs(env).map(({ id, group, label, hint, glyph, run }) => ({ id, group, label, hint, glyph, run }));
