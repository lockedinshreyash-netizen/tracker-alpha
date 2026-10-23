/* ── The blocks Notion does not have, and the ones it does that need to know
   about Alpha ──
   Equations (inline and display, with \ce chemistry), callouts, a chapter
   mention that carries its syllabus status, a link to another page, and an
   image stored by id. Node views are plain DOM: every chip on a page of
   formulas would otherwise be its own React root. */

import { InputRule, Node, mergeAttributes, type Editor } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TaskItem } from '@tiptap/extension-list';
import { SUBJECT_COLORS } from '../../schedule/colors';
import { STATUS_LABELS } from '../../constants';
import type { Subject } from '../../types';
import type { NotesEnv } from './env';
import { renderTex } from './katex';
import { STATUS_HEX } from '../status';

interface EnvOptions { env: NotesEnv }

export { STATUS_HEX };

const posOf = (getPos: unknown): number | null => {
  const p = typeof getPos === 'function' ? (getPos as () => number | undefined)() : undefined;
  return typeof p === 'number' ? p : null;
};

/* ── Equations ── */

const mathView = (display: boolean) => ({ node, getPos, editor, extension }: {
  node: { attrs: Record<string, unknown> }; getPos: unknown; editor: Editor; extension: { options: EnvOptions };
}) => {
  const env = extension.options.env;
  const dom = document.createElement(display ? 'div' : 'span');
  dom.className = display ? 'nt-math-block' : 'nt-math';
  dom.contentEditable = 'false';
  const out = document.createElement(display ? 'div' : 'span');
  out.className = 'nt-math-out';
  dom.appendChild(out);
  let latex = String(node.attrs.latex ?? '');
  // An unwritten equation takes no number: (1), (2) count real ones (notes.css).
  const paint = () => { renderTex(out, latex, display); dom.classList.toggle('is-blank', !latex.trim()); };
  paint();

  const open = () => {
    const pos = posOf(getPos);
    if (pos === null || !editor.isEditable) return;
    env.editMath({ pos, latex, display, rect: dom.getBoundingClientRect() });
  };
  dom.addEventListener('mousedown', e => {
    if (!editor.isEditable) return;
    e.preventDefault();
    const pos = posOf(getPos);
    if (pos !== null) editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
    open();
  });
  if (env.mathPending && !latex) {
    env.mathPending = false;
    requestAnimationFrame(open);
  }
  return {
    dom,
    update: (next: { type: unknown; attrs: Record<string, unknown> }) => {
      if (next.type !== (node as unknown as { type: unknown }).type) return false;
      const l = String(next.attrs.latex ?? '');
      if (l !== latex) { latex = l; paint(); }
      return true;
    },
    selectNode: () => dom.classList.add('is-selected'),
    deselectNode: () => dom.classList.remove('is-selected'),
    ignoreMutation: () => true,
    stopEvent: (e: Event) => e.type === 'mousedown',
  };
};

const latexAttr = {
  latex: {
    default: '',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') ?? el.textContent ?? '',
    renderHTML: (a: Record<string, unknown>) => ({ 'data-latex': a.latex }),
  },
};

const openSelectedMath = (editor: Editor, env: NotesEnv): boolean => {
  const sel = editor.state.selection;
  if (!(sel instanceof NodeSelection)) return false;
  const name = sel.node.type.name;
  if (name !== 'mathInline' && name !== 'mathBlock') return false;
  const dom = editor.view.nodeDOM(sel.from) as HTMLElement | null;
  if (!dom) return false;
  env.editMath({ pos: sel.from, latex: String(sel.node.attrs.latex ?? ''), display: name === 'mathBlock', rect: dom.getBoundingClientRect() });
  return true;
};

export const MathInline = Node.create<EnvOptions>({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ env: null as unknown as NotesEnv }),
  addAttributes: () => latexAttr,
  parseHTML: () => [{ tag: 'span[data-math-inline]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), String(HTMLAttributes['data-latex'] ?? '')],
  renderText: ({ node }) => `$${node.attrs.latex}$`,
  renderMarkdown: node => `$${node.attrs?.latex ?? ''}$`,
  addNodeView() { return mathView(false) as never; },
  addKeyboardShortcuts() {
    return {
      Enter: () => openSelectedMath(this.editor, this.options.env),
      'Mod-Shift-m': () => {
        const { from, to, empty } = this.editor.state.selection;
        const text = empty ? '' : this.editor.state.doc.textBetween(from, to, ' ');
        if (empty) this.options.env.mathPending = true;
        return this.editor.chain().focus().insertContentAt({ from, to }, { type: 'mathInline', attrs: { latex: text } }).run();
      },
    };
  },
  addInputRules() {
    // $E = mc^2$ → an equation. The inside may not start or end with a space,
    // so "$5 and $6" stays prose.
    return [
      new InputRule({
        find: /(?:^|[^$\\])\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const start = range.from + (match[0].startsWith('$') ? 0 : 1);
          state.tr.replaceWith(start, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

export const MathBlock = Node.create<EnvOptions>({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions: () => ({ env: null as unknown as NotesEnv }),
  addAttributes: () => latexAttr,
  parseHTML: () => [{ tag: 'div[data-math-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), String(HTMLAttributes['data-latex'] ?? '')],
  renderText: ({ node }) => `$$${node.attrs.latex}$$`,
  renderMarkdown: node => `$$\n${node.attrs?.latex ?? ''}\n$$`,
  addNodeView() { return mathView(true) as never; },
  addKeyboardShortcuts() {
    return { Enter: () => openSelectedMath(this.editor, this.options.env) };
  },
  addInputRules() {
    // "$$" then a space on an empty line opens a display equation.
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== 'paragraph' || $from.parent.textContent.trim() !== '$$') return null;
          this.options.env.mathPending = true;
          state.tr.replaceWith($from.before(), $from.after(), this.type.create({ latex: '' }));
        },
      }),
    ];
  },
});

/* ── Callout ──
   A tinted box with a mark at its left. The mark cycles through four on a
   click: a tip, a warning, a definition, a doubt. Words, not emoji, set the
   tone: the student's own emoji go in the text. */

export const CALLOUT_TONES = ['note', 'warn', 'key', 'doubt'] as const;
export type CalloutTone = typeof CALLOUT_TONES[number];
export const CALLOUT_MARK: Record<CalloutTone, string> = { note: 'Note', warn: 'Watch out', key: 'Key idea', doubt: 'Doubt' };

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  addAttributes: () => ({
    tone: {
      default: 'note',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-tone') ?? 'note',
      renderHTML: (a: Record<string, unknown>) => ({ 'data-tone': a.tone }),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0],
  renderMarkdown: (node, h) => {
    const tone = (CALLOUT_TONES as readonly string[]).includes(node.attrs?.tone) ? node.attrs!.tone as CalloutTone : 'note';
    return h.wrapInBlock('> ', `**${CALLOUT_MARK[tone]}.** ${h.renderChildren(node.content ?? [], '\n\n')}`);
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('div');
      dom.className = 'nt-callout';
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'nt-callout-mark';
      mark.contentEditable = 'false';
      const body = document.createElement('div');
      body.className = 'nt-callout-body';
      dom.append(mark, body);
      const paint = () => {
        const tone = (CALLOUT_TONES as readonly string[]).includes(current.attrs.tone) ? current.attrs.tone as CalloutTone : 'note';
        dom.dataset.tone = tone;
        mark.textContent = CALLOUT_MARK[tone];
      };
      paint();
      mark.addEventListener('mousedown', e => {
        e.preventDefault();
        if (!editor.isEditable) return;
        const pos = posOf(getPos);
        if (pos === null) return;
        const i = CALLOUT_TONES.indexOf(current.attrs.tone as CalloutTone);
        const tone = CALLOUT_TONES[(i + 1) % CALLOUT_TONES.length];
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, tone }));
      });
      return {
        dom,
        contentDOM: body,
        update: next => {
          if (next.type !== current.type) return false;
          current = next;
          paint();
          return true;
        },
        stopEvent: e => e.target === mark,
        ignoreMutation: m => m.target === mark || mark.contains(m.target as globalThis.Node),
      };
    };
  },
});

/* ── Chapter mention ──
   @Rotational Motion: a chip in the subject's colour with the chapter's live
   syllabus status as its dot. Tapping it opens the Syllabus tab. */

export const ChapterRef = Node.create<EnvOptions>({
  name: 'chapterRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ env: null as unknown as NotesEnv }),
  addAttributes: () => ({
    key: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-key') ?? '', renderHTML: (a: Record<string, unknown>) => ({ 'data-key': a.key }) },
    name: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-name') ?? el.textContent ?? '', renderHTML: (a: Record<string, unknown>) => ({ 'data-name': a.name }) },
  }),
  parseHTML: () => [{ tag: 'span[data-chapter]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-chapter': '' }), `@${HTMLAttributes['data-name'] ?? ''}`],
  renderText: ({ node }) => `@${node.attrs.name}`,
  renderMarkdown: node => `@${node.attrs?.name ?? ''}`,
  addNodeView() {
    const env = this.options.env;
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'nt-chip';
      dom.contentEditable = 'false';
      const dot = document.createElement('i');
      const label = document.createElement('span');
      dom.append(dot, label);
      let key = '';
      const paint = (attrs: Record<string, unknown>) => {
        key = String(attrs.key ?? '');
        const subject = (key.split('|')[1] || 'General') as Subject;
        const c = SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.General;
        dom.style.setProperty('--c', c.dot);
        const status = env.chapterStatus(key);
        dot.style.background = STATUS_HEX[status ?? 'not_started'];
        label.textContent = String(attrs.name ?? '');
        dom.title = `${subject} · Class ${key.split('|')[0]} · ${STATUS_LABELS[status ?? 'not_started']}`;
      };
      paint(node.attrs);
      dom.addEventListener('click', e => { e.preventDefault(); if (key) env.openChapter(key); });
      return {
        dom,
        update: next => { if (next.type !== node.type) return false; paint(next.attrs); return true; },
        ignoreMutation: () => true,
      };
    };
  },
});

/* ── Link to another page ── */

export const PageLink = Node.create<EnvOptions>({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ env: null as unknown as NotesEnv }),
  addAttributes: () => ({
    id: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-page') ?? '', renderHTML: (a: Record<string, unknown>) => ({ 'data-page': a.id }) },
  }),
  parseHTML: () => [{ tag: 'span[data-page]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes), 'page'],
  renderText({ node }) { return `[[${this.options.env?.pageInfo?.(node.attrs.id)?.title || 'Untitled'}]]`; },
  renderMarkdown(node) { return `[[${this.options.env?.pageInfo?.(node.attrs?.id)?.title || 'Untitled'}]]`; },
  addNodeView() {
    const env = this.options.env;
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'nt-plink';
      dom.contentEditable = 'false';
      const icon = document.createElement('span');
      icon.className = 'nt-plink-icon';
      icon.textContent = '↗';
      const title = document.createElement('span');
      title.className = 'nt-plink-title';
      dom.append(title, icon);
      let id = String(node.attrs.id ?? '');
      const paint = () => {
        const info = env.pageInfo(id);
        title.textContent = info ? (info.title || 'Untitled') : 'Page not found';
        dom.classList.toggle('is-gone', !info || !info.live);
      };
      paint();
      const off = env.store.subscribe(paint);
      dom.addEventListener('click', e => { e.preventDefault(); if (id && env.pageInfo(id)?.live) env.openPage(id); });
      return {
        dom,
        update: next => { if (next.type !== node.type) return false; id = String(next.attrs.id ?? ''); paint(); return true; },
        destroy: off,
        ignoreMutation: () => true,
      };
    };
  },
});

/* ── Image ──
   The document holds an id and the picture's size, never the pixels, so the
   frame keeps its shape while the file loads (from this device, or for the
   first time from storage). */

export const NoteImage = Node.create<EnvOptions>({
  name: 'noteImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addOptions: () => ({ env: null as unknown as NotesEnv }),
  addAttributes: () => ({
    id: { default: '' },
    w: { default: 0 },
    h: { default: 0 },
    size: { default: 'full' },
  }),
  parseHTML: () => [{ tag: 'figure[data-image]', getAttrs: el => ({ id: (el as HTMLElement).getAttribute('data-image') }) }],
  renderHTML: ({ HTMLAttributes }) => ['figure', { 'data-image': HTMLAttributes.id }],
  renderMarkdown: () => '*(image)*',
  addNodeView() {
    const env = this.options.env;
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('figure');
      dom.className = 'nt-img';
      dom.contentEditable = 'false';
      const frame = document.createElement('div');
      frame.className = 'nt-img-frame';
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      frame.appendChild(img);
      const bar = document.createElement('div');
      bar.className = 'nt-img-bar';
      (['small', 'medium', 'full'] as const).forEach(size => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.size = size;
        b.textContent = size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L';
        b.setAttribute('aria-label', `${size} width`);
        b.addEventListener('mousedown', e => {
          e.preventDefault();
          const pos = posOf(getPos);
          if (pos !== null) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, size }));
        });
        bar.appendChild(b);
      });
      dom.append(frame, bar);
      let loadedId = '';
      const paint = () => {
        const { id, w, h, size } = current.attrs as { id: string; w: number; h: number; size: string };
        dom.dataset.size = size;
        if (w && h) frame.style.aspectRatio = `${w} / ${h}`;
        bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.size === size));
        if (id && id !== loadedId) {
          loadedId = id;
          frame.classList.add('is-loading');
          void env.imageUrl(id).then(url => {
            if (loadedId !== id) return;
            if (url) { img.src = url; frame.classList.remove('is-loading'); }
            else { frame.classList.remove('is-loading'); frame.classList.add('is-missing'); }
          });
        }
      };
      paint();
      dom.addEventListener('mousedown', e => {
        if ((e.target as HTMLElement).closest('.nt-img-bar')) return;
        const pos = posOf(getPos);
        if (pos !== null && editor.isEditable) editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
      });
      return {
        dom,
        update: next => { if (next.type !== current.type) return false; current = next; paint(); return true; },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        stopEvent: e => !!(e.target as HTMLElement).closest?.('.nt-img-bar'),
        ignoreMutation: () => true,
      };
    };
  },
});

/* ── To-do → Today ──
   A to-do in a note can be sent to the Today board. The button appears only
   on the line the cursor is in; a sent to-do keeps a small "On Today" mark.
   Decorations, not a node view: the list stays ProseMirror's own. */

export const NoteTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      today: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-today') ? Number(el.getAttribute('data-today')) : null),
        renderHTML: (a: Record<string, unknown>) => (a.today ? { 'data-today': String(a.today) } : {}),
      },
    };
  },
}).configure({ nested: true });

const todayKey = new PluginKey('nt-today');

export const TodayTasks = (env: NotesEnv) => new Plugin({
  key: todayKey,
  props: {
    decorations(state) {
      const decos: Decoration[] = [];
      const { $from } = state.selection;
      let active = -1;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'taskItem') { active = $from.before(d); break; }
      }
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'taskItem') return true;
        const para = node.firstChild;
        if (!para) return true;
        const end = pos + 1 + para.nodeSize - 1;
        if (node.attrs.today) {
          decos.push(Decoration.widget(end, () => {
            const s = document.createElement('span');
            s.className = 'nt-today on';
            s.textContent = 'On Today';
            s.contentEditable = 'false';
            return s;
          }, { side: 1, key: `on-${pos}`, ignoreSelection: true }));
        } else if (pos === active && para.textContent.trim() && !node.attrs.checked) {
          decos.push(Decoration.widget(end, view => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'nt-today';
            b.textContent = 'Add to Today';
            b.contentEditable = 'false';
            b.addEventListener('mousedown', e => {
              e.preventDefault();
              const item = view.state.doc.nodeAt(pos);
              if (!item || item.type.name !== 'taskItem') return;
              env.sendToToday(item.firstChild?.textContent.trim() ?? '');
              view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...item.attrs, today: Date.now() }));
            });
            return b;
          }, { side: 1, key: `add-${pos}`, ignoreSelection: true }));
        }
        return true;
      });
      return DecorationSet.create(state.doc, decos);
    },
  },
});
