/* What the editor's nodes need from the tab around them, handed to every
   extension as one object. Node views are plain DOM (a React node view per
   chip would mount a React root per chapter mention), so they read live values
   through these functions rather than through props. */

import type { Editor, Range } from '@tiptap/core';
import type { SyllabusStatus, Subject } from '../../types';
import type { NotesStore } from '../store';

export interface ChapterOption {
  key: string;
  name: string;
  subject: Subject;
  classId: 11 | 12;
}

export interface MathEdit {
  pos: number;
  latex: string;
  display: boolean;
  rect: DOMRect;
}

export interface NotesEnv {
  store: NotesStore;
  userId: string | null;
  pageId: string;
  pageInfo: (id: string) => { title: string; icon: string; live: boolean } | null;
  openPage: (id: string) => void;
  createSubpage: (title?: string) => string;
  searchPages: (query: string) => { id: string; title: string; icon: string }[];
  chapters: () => ChapterOption[];
  chapterStatus: (key: string) => SyllabusStatus | null;
  openChapter: (key: string) => void;
  sendToToday: (text: string) => void;
  editMath: (edit: MathEdit) => void;
  pickImage: (editor: Editor, range?: Range) => void;
  imageUrl: (id: string) => Promise<string | null>;
  /** An image was stored on this device: sync uploads it. */
  afterImage?: () => void;
  /** Set by a command that inserts an empty equation, so its node view opens the editor once. */
  mathPending: boolean;
}

/* ── Suggestion menus (/, @ and [[) ──
   The suggestion plugin owns the matching; this bus carries what it found to
   the one React menu NoteEditor draws. */

export type SuggestKind = 'slash' | 'mention' | 'link';

export interface SuggestItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  glyph: string;
  /** A subject colour for chapter mentions. */
  tint?: string;
  run: (editor: Editor, range: Range) => void;
}

export interface SuggestView {
  kind: SuggestKind;
  items: SuggestItem[];
  index: number;
  rect: DOMRect | null;
  select: (item: SuggestItem) => void;
}

export class SuggestBus {
  view: SuggestView | null = null;
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  get = () => this.view;
  set(view: SuggestView | null) {
    this.view = view;
    this.listeners.forEach(fn => fn());
  }
}
