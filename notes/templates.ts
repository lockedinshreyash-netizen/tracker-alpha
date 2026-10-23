/* ── JEE templates ──
   One tap to a page that already knows what a good chapter page looks like.
   Each is TipTap JSON, written into a page the first time it opens (an empty
   page only, so it cannot duplicate on a second device). The prompts are
   short and plain: they are read by someone about to study, not by a
   designer. */

import type { JSONContent } from '@tiptap/core';

/** What the home screen draws for a format: its shape, in hairlines. */
export type SketchRow = 'h' | 'p' | 'eq' | 'list' | 'todo' | 'table' | 'box' | 'toggle';

export interface Template {
  id: string;
  name: string;
  line: string;
  sketch: SketchRow[];
  /** Chapter notes are opened from the Syllabus tab with a chapter in hand. */
  chapter?: boolean;
  body: (ctx: { chapter?: string; subject?: string }) => JSONContent;
}

const p = (text?: string): JSONContent => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const todo = (...items: string[]): JSONContent => ({
  type: 'taskList',
  content: items.map(t => ({ type: 'taskItem', attrs: { checked: false }, content: [p(t || undefined)] })),
});
const bullets = (...items: string[]): JSONContent => ({
  type: 'bulletList',
  content: items.map(t => ({ type: 'listItem', content: [p(t || undefined)] })),
});
const callout = (tone: string, text: string): JSONContent => ({ type: 'callout', attrs: { tone }, content: [p(text)] });
const math = (latex: string): JSONContent => ({ type: 'mathBlock', attrs: { latex } });
const toggle = (summary: string, ...body: JSONContent[]): JSONContent => ({
  type: 'details',
  content: [
    { type: 'detailsSummary', content: [{ type: 'text', text: summary }] },
    { type: 'detailsContent', content: body.length ? body : [p()] },
  ],
});
const table = (head: string[], rows: number): JSONContent => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: head.map(t => ({ type: 'tableHeader', content: [p(t)] })) },
    ...Array.from({ length: rows }, () => ({ type: 'tableRow', content: head.map(() => ({ type: 'tableCell', content: [p()] })) })),
  ],
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

export const TEMPLATES: Template[] = [
  {
    id: 'chapter',
    name: 'Chapter notes',
    line: 'Ideas, formulas, traps, PYQs',
    sketch: ['h', 'list', 'h', 'eq', 'box', 'h', 'todo'],
    chapter: true,
    body: () => doc(
      h(2, 'Big ideas'),
      bullets('', ''),
      h(2, 'Formulas'),
      math(''),
      p(),
      toggle('Derivations', p('Hide the long ones here. Open them when you revise.')),
      h(2, 'Traps'),
      callout('warn', 'Where you lose marks in this chapter.'),
      h(2, 'PYQs to redo'),
      todo(''),
      h(2, 'Doubts'),
      todo(''),
    ),
  },
  {
    id: 'formulas',
    name: 'Formula sheet',
    line: 'Every formula, when to use it',
    sketch: ['p', 'table', 'h', 'list'],
    body: () => doc(
      p('Wrap a formula in $ to make it an equation.'),
      table(['Quantity', 'Formula', 'When to use'], 4),
      h(2, 'Constants'),
      bullets('', ''),
    ),
  },
  {
    id: 'mistakes',
    name: 'Mistake log',
    line: 'Same mistake twice? Not again',
    sketch: ['box', 'table'],
    body: () => doc(
      callout('warn', 'Write the mistake, not the question. "Forgot the sign of g", not "Q14".'),
      table(['Date', 'Chapter', 'What went wrong', 'Fix'], 5),
    ),
  },
  {
    id: 'lecture',
    name: 'Lecture notes',
    line: 'Class or video, captured fast',
    sketch: ['p', 'h', 'list', 'h', 'p', 'h', 'todo'],
    body: () => doc(
      p('Teacher · Topic · Date'),
      h(2, 'Key points'),
      bullets(''),
      h(2, 'Examples'),
      p(),
      h(2, 'Doubts to ask'),
      todo(''),
    ),
  },
  {
    id: 'weekly',
    name: 'Weekly review',
    line: 'What worked. What did not.',
    sketch: ['h', 'list', 'h', 'list', 'h', 'todo'],
    body: () => doc(
      h(2, 'What worked'),
      bullets(''),
      h(2, 'What did not'),
      bullets(''),
      h(2, 'Three things next week'),
      todo('', '', ''),
    ),
  },
  {
    id: 'revision',
    name: 'Revision plan',
    line: 'Chapters to finish, by subject',
    sketch: ['box', 'toggle', 'toggle', 'toggle'],
    body: ({ subject }) => doc(
      callout('note', 'Tick a chapter when it is revised. Add it to Today when you start it.'),
      ...(subject ? [subject] : ['Physics', 'Chemistry', 'Maths']).map(s => toggle(s, todo('', ''))),
    ),
  },
];

export const templateById = (id: string): Template | undefined => TEMPLATES.find(t => t.id === id);
