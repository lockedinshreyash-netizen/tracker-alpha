/* The editor's whole vocabulary, in one list. NoteEditor mounts it on a page;
   fill.ts reads its schema to write a template or an imported Markdown file
   straight into a page's Yjs document, with no editor open. */

import { Extension, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import Highlight from '@tiptap/extension-highlight';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TableKit } from '@tiptap/extension-table';
import Collaboration from '@tiptap/extension-collaboration';
import { Markdown } from '@tiptap/markdown';
import type * as Y from 'yjs';
import { Callout, ChapterRef, MathBlock, MathInline, NoteImage, NoteTaskItem, PageLink, TodayTasks } from './nodes';
import { Suggestions } from './suggest';
import { Indent, NotionKeys } from './keys';
import type { NotesEnv, SuggestBus } from './env';

/** Nodes and marks only: what a document may contain. */
export const contentExtensions = (env: NotesEnv): AnyExtension[] => [
  StarterKit.configure({
    undoRedo: false,
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
    dropcursor: { color: 'rgba(225, 6, 0, 0.55)', width: 2 },
    codeBlock: { HTMLAttributes: { spellcheck: 'false' }, enableTabIndentation: true, tabSize: 2 },
  }),
  TaskList,
  NoteTaskItem,
  Highlight,
  Details.configure({ persist: true }),
  DetailsSummary,
  DetailsContent,
  TableKit.configure({ table: { resizable: false } }),
  Markdown,
  MathInline.configure({ env }),
  MathBlock.configure({ env }),
  Callout,
  ChapterRef.configure({ env }),
  PageLink.configure({ env }),
  NoteImage.configure({ env }),
  Indent,
];

export const editorExtensions = (env: NotesEnv, bus: SuggestBus, doc: Y.Doc): AnyExtension[] => [
  ...contentExtensions(env),
  Placeholder.configure({
    showOnlyCurrent: true,
    includeChildren: false,
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') return `Heading ${node.attrs.level}`;
      if (node.type.name === 'detailsSummary') return 'Toggle';
      return 'Write something, or press /';
    },
  }),
  Collaboration.configure({ document: doc }),
  Suggestions.configure({ env, bus }),
  NotionKeys,
  Extension.create({ name: 'ntToday', addProseMirrorPlugins: () => [TodayTasks(env)] }),
];
