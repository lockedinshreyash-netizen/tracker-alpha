/* ── Keyboard, the Notion way ──
   Students arrive with Notion's hands, so the same keys do the same things:

   Tab / Shift+Tab    indent / outdent: a list item nests (TipTap's own),
                      a table moves cell (TableKit's), a code block indents
                      (enableTabIndentation), and any other line gets an
                      indent level (Indent below). Tab never leaves the page.
   Backspace          at the start of an indented line, outdents it first.
   ⌘⌥0–3              text, headings (TipTap's own)
   ⌘⌥4–8              to-do, bullets, numbers, toggle, code
   ⌘⇧↑ / ⌘⇧↓          move the block
   ⌘D                 duplicate the block
   ⌘↵                 tick a to-do, open or close a toggle
   ⌘K                 link the selection (with nothing selected, search)
   ⌘/                 the list of shortcuts

   "The block" is the list item the cursor is in, else the top-level block,
   so moving a bullet moves it within its list and never out of it. */

import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ntIndent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const MAX_INDENT = 8;
const INDENTABLE = new Set(['paragraph', 'heading']);
const ITEMS = new Set(['listItem', 'taskItem']);
const NO_INDENT_INSIDE = new Set(['listItem', 'taskItem', 'tableCell', 'tableHeader']);

/* ── Indent ── */

const shiftIndent = (state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, delta: number): boolean => {
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!INDENTABLE.has(node.type.name)) return true;
    const $pos = state.doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) if (NO_INDENT_INSIDE.has($pos.node(d).type.name)) return false;
    const cur = Number(node.attrs.indent) || 0;
    const next = Math.max(0, Math.min(MAX_INDENT, cur + delta));
    if (next !== cur) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next }); changed = true; }
    return false;
  });
  if (changed && dispatch) dispatch(tr);
  return changed;
};

const itemType = (editor: Editor): string | null =>
  editor.isActive('taskItem') ? 'taskItem' : editor.isActive('listItem') ? 'listItem' : null;

export const Indent = Extension.create({
  name: 'ntIndent',
  // After lists, tables and code blocks, which own Tab where they apply.
  priority: 20,

  addGlobalAttributes() {
    return [{
      types: [...INDENTABLE],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el: HTMLElement) => Math.min(MAX_INDENT, Number(el.getAttribute('data-indent')) || 0),
          renderHTML: (a: Record<string, unknown>) => {
            const n = Number(a.indent) || 0;
            return n ? { 'data-indent': n, style: `margin-left: ${n * 1.5}em` } : {};
          },
        },
      },
    }];
  },

  addCommands() {
    return {
      indent: () => ({ state, dispatch, editor, commands }) => {
        const item = itemType(editor);
        if (item) return commands.sinkListItem(item);
        return shiftIndent(state, dispatch, 1);
      },
      outdent: () => ({ state, dispatch, editor, commands }) => {
        const item = itemType(editor);
        if (item) return commands.liftListItem(item);
        return shiftIndent(state, dispatch, -1);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Swallowed even when nothing moves: Tab must not walk focus out of the page.
      Tab: () => { this.editor.commands.indent(); return true; },
      'Shift-Tab': () => { this.editor.commands.outdent(); return true; },
    };
  },
});

/* ── Blocks: move, duplicate ── */

interface Block { node: PMNode; start: number; end: number; parent: PMNode; index: number }

const blockAt = (state: EditorState): Block | null => {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.$from.depth === 0) {
    return { node: sel.node, start: sel.from, end: sel.to, parent: state.doc, index: sel.$from.index(0) };
  }
  const { $from } = sel;
  if ($from.depth < 1) return null;
  let depth = 1;
  for (let d = $from.depth; d > 0; d--) if (ITEMS.has($from.node(d).type.name)) { depth = d; break; }
  return { node: $from.node(depth), start: $from.before(depth), end: $from.after(depth), parent: $from.node(depth - 1), index: $from.index(depth - 1) };
};

const reselect = (tr: Transaction, state: EditorState, oldStart: number, newStart: number) => {
  const sel = state.selection;
  if (sel instanceof NodeSelection) tr.setSelection(NodeSelection.create(tr.doc, newStart));
  else tr.setSelection(TextSelection.create(tr.doc, newStart + (sel.from - oldStart), newStart + (sel.to - oldStart)));
};

const moveBlock = (dir: -1 | 1) => (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
  const b = blockAt(state);
  if (!b) return false;
  const target = b.index + dir;
  if (target < 0 || target >= b.parent.childCount) return true;
  const sibling = b.parent.child(target);
  const tr = state.tr;
  let newStart: number;
  if (dir < 0) {
    newStart = b.start - sibling.nodeSize;
    tr.delete(b.start, b.end).insert(newStart, b.node);
  } else {
    const after = b.end + sibling.nodeSize;
    tr.insert(after, b.node).delete(b.start, b.end);
    newStart = after - b.node.nodeSize;
  }
  reselect(tr, state, b.start, newStart);
  dispatch?.(tr.scrollIntoView());
  return true;
};

const duplicateBlock = (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
  const b = blockAt(state);
  if (!b) return false;
  const tr = state.tr.insert(b.end, b.node.copy(b.node.content));
  reselect(tr, state, b.start, b.end);
  dispatch?.(tr.scrollIntoView());
  return true;
};

/* ── ⌘↵: tick or open what the cursor is in ── */

const toggleHere = (editor: Editor): boolean => {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'taskItem') {
      editor.view.dispatch(editor.state.tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, checked: !node.attrs.checked }));
      return true;
    }
    if (node.type.name === 'details') {
      // The toggle's own button knows how to open it; a click keeps one code path.
      const dom = editor.view.nodeDOM($from.before(d)) as HTMLElement | null;
      const button = dom?.querySelector(':scope > button') as HTMLButtonElement | null;
      if (button) { button.click(); return true; }
      return false;
    }
  }
  return false;
};

export const NotionKeys = Extension.create({
  name: 'ntNotionKeys',
  // Above HardBreak, so ⌘↵ ticks a to-do before it would break the line.
  priority: 150,

  addKeyboardShortcuts() {
    const ed = () => this.editor;
    return {
      /* Here, not in Indent: Backspace at the start of an indented line must
         outdent before the default Backspace joins it onto the line above. */
      Backspace: () => {
        const { $from, empty } = ed().state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        const parent = $from.parent;
        if (!INDENTABLE.has(parent.type.name) || !(Number(parent.attrs.indent) > 0)) return false;
        return shiftIndent(ed().state, ed().view.dispatch, -1);
      },
      'Mod-Alt-4': () => ed().chain().focus().clearNodes().toggleTaskList().run(),
      'Mod-Alt-5': () => ed().chain().focus().clearNodes().toggleBulletList().run(),
      'Mod-Alt-6': () => ed().chain().focus().clearNodes().toggleOrderedList().run(),
      'Mod-Alt-7': () => (ed().isActive('details') ? ed().chain().focus().unsetDetails().run() : ed().chain().focus().clearNodes().setDetails().run()),
      'Mod-Alt-8': () => ed().chain().focus().clearNodes().toggleCodeBlock().run(),
      'Mod-Shift-ArrowUp': () => moveBlock(-1)(ed().state, ed().view.dispatch),
      'Mod-Shift-ArrowDown': () => moveBlock(1)(ed().state, ed().view.dispatch),
      'Mod-d': () => duplicateBlock(ed().state, ed().view.dispatch),
      'Mod-Enter': () => toggleHere(ed()),
      'Mod-k': () => {
        if (ed().state.selection.empty) return false;
        window.dispatchEvent(new CustomEvent('nt-link', { detail: ed() }));
        return true;
      },
      'Mod-/': () => { window.dispatchEvent(new CustomEvent('nt-shortcuts')); return true; },
    };
  },
});
