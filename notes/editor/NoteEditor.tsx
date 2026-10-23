/* ── The editor ──
   TipTap over a page's Yjs document. Collaboration binds the two, so every
   edit is a Yjs update the store saves and syncs, and edits from another
   device land in the open page without a reload. Undo is Yjs's own: it undoes
   your edits, never the other device's.

   Re-renders: `shouldRerenderOnTransaction` is off (TipTap 3's default), so a
   keystroke re-renders nothing in React. The menus read editor state when
   they draw, and redraw on their own subscriptions. */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Range } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import DragHandle from '@tiptap/extension-drag-handle-react';
import type * as Y from 'yjs';
import { editorExtensions } from './extensions';
import { blockDefs } from './blocks';
import { SuggestBus, type MathEdit, type NotesEnv, type SuggestItem } from './env';
import { looksLikeMarkdown, protectMath, restoreMath } from './markdown';
import { loadKatex, renderTex } from './katex';
import { storeImage } from '../files';

/* ── Content in from outside ── */

export const insertMarkdown = (editor: Editor, text: string, at?: number): boolean => {
  const { md, stash } = protectMath(text);
  const json = editor.markdown?.parse(md);
  if (!json?.content) return false;
  const doc = restoreMath(json, stash);
  const chain = editor.chain().focus();
  (at === undefined ? chain.insertContent(doc.content ?? []) : chain.insertContentAt(at, doc.content ?? [])).run();
  return true;
};

const insertImages = async (editor: Editor, env: NotesEnv, files: File[], at?: number) => {
  for (const file of files) {
    try {
      const img = await storeImage(env.store, file);
      const node = { type: 'noteImage', attrs: { id: img.id, w: img.w, h: img.h, size: 'full' } };
      if (at === undefined) editor.chain().focus().insertContent(node).run();
      else editor.chain().focus().insertContentAt(at, node).run();
    } catch (e) {
      window.alert((e as Error).message);
    }
  }
  env.afterImage?.();
};

export const pickImages = (editor: Editor, env: NotesEnv, range?: Range) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => {
    const files = [...(input.files ?? [])];
    if (range) editor.chain().focus().deleteRange(range).run();
    void insertImages(editor, env, files);
  };
  input.click();
};

/* ── Props ── */

interface Props {
  doc: Y.Doc;
  env: NotesEnv;
  dark: boolean;
  editable: boolean;
  onReady?: (editor: Editor) => void;
}

export default function NoteEditor({ doc, env, dark, editable, onReady }: Props) {
  const bus = useMemo(() => new SuggestBus(), []);
  const editorRef = useRef<Editor | null>(null);
  const [mathEdit, setMathEdit] = useState<MathEdit | null>(null);
  env.editMath = setMathEdit;
  env.pickImage = (editor, range) => pickImages(editor, env, range);

  const editor = useEditor({
    editable,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: editorExtensions(env, bus, doc),
    editorProps: {
      attributes: { class: 'nt-prose', spellcheck: 'true' },
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        const files = [...(event.clipboardData?.files ?? [])].filter(f => f.type.startsWith('image/'));
        if (files.length) { void insertImages(ed, env, files); return true; }
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (!html && text && !ed.isActive('codeBlock') && looksLikeMarkdown(text)) return insertMarkdown(ed, text);
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        const ed = editorRef.current;
        if (moved || !ed) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(ed, env, files, at);
        return true;
      },
    },
  }, [doc]);

  /* The page is handed the editor from an effect on the instance, not from
     onCreate: under StrictMode the first instance is created, destroyed and
     replaced, and onCreate handed the page the destroyed one. */
  const readyFor = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
    if (editor && !editor.isDestroyed && readyFor.current !== editor) {
      readyFor.current = editor;
      onReady?.(editor);
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  useEffect(() => () => { editorRef.current = null; }, []);

  if (!editor) return null;

  return (
    <div className="nt-editor">
      {editable && <BlockHandle editor={editor} env={env} dark={dark} />}
      <EditorContent editor={editor} />
      {editable && <Bubble editor={editor} env={env} />}
      <SuggestMenu bus={bus} />
      {mathEdit && <MathPopover edit={mathEdit} editor={editor} onClose={() => setMathEdit(null)} />}
      {editable && <PhoneBar editor={editor} env={env} />}
    </div>
  );
}

/* ── The menu under "/", "@" and "[[" ── */

function SuggestMenu({ bus }: { bus: SuggestBus }) {
  const view = useSyncExternalStore(bus.subscribe, bus.get);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [view?.index, view?.items]);

  if (!view || !view.rect) return null;
  const { items, index, rect, select, kind } = view;
  const below = window.innerHeight - rect.bottom > 300 || rect.top < 300;
  const style: React.CSSProperties = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
    ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
  };

  let lastGroup = '';
  return createPortal(
    <div className="nt-pop nt-suggest" style={style} ref={listRef} onMouseDown={e => e.preventDefault()}>
      {!items.length && (
        <p className="nt-suggest-empty">{kind === 'slash' ? 'No block by that name' : 'Nothing found'}</p>
      )}
      {items.map((item: SuggestItem, i) => {
        const head = item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        return (
          <React.Fragment key={item.id}>
            {head && <p className="nt-pop-group">{head}</p>}
            <button
              type="button"
              className="nt-suggest-item"
              data-active={i === index}
              onClick={() => select(item)}
            >
              <span className="nt-glyph">{item.tint ? <i style={{ background: item.tint }} /> : item.glyph}</span>
              <span className="nt-suggest-label">{item.label}</span>
              {item.hint && <span className="nt-suggest-hint">{item.hint}</span>}
            </button>
          </React.Fragment>
        );
      })}
    </div>,
    document.body,
  );
}

/* ── The bar over a selection ── */

const TURN_IDS = ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code'];

/* Module-level, so its identity never changes. BubbleMenu re-dispatches a
   transaction whenever this prop changes, and the bar re-renders on editor
   changes: an inline function made the two feed each other forever. */
const showBubble = ({ editor: ed, state }: { editor: Editor; state: Editor['state'] }): boolean => {
  const sel = state.selection;
  if (!ed.isEditable || sel.empty || sel instanceof NodeSelection) return false;
  if (ed.isActive('codeBlock')) return false;
  return state.doc.textBetween(sel.from, sel.to).trim().length > 0;
};

function Bubble({ editor, env }: { editor: Editor; env: NotesEnv }) {
  const [, force] = useState(0);
  const [mode, setMode] = useState<'main' | 'turn' | 'link'>('main');
  const [href, setHref] = useState('');

  useEffect(() => {
    const redraw = () => force(n => n + 1);
    // Selection and content changes only: plugin-meta transactions are not ours to redraw on.
    editor.on('selectionUpdate', redraw);
    editor.on('update', redraw);
    return () => { editor.off('selectionUpdate', redraw); editor.off('update', redraw); };
  }, [editor]);

  const defs = useMemo(() => blockDefs(env).filter(d => TURN_IDS.includes(d.id)), [env]);
  const current = defs.find(d => d.active?.(editor) && d.id !== 'text') ?? defs[0];

  const mark = (name: string, label: string, run: () => void, glyph: React.ReactNode) => (
    <button type="button" className="nt-bb" data-on={editor.isActive(name)} aria-label={label} title={label} onClick={run}>{glyph}</button>
  );

  const toMath = () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    editor.chain().focus().insertContentAt({ from, to }, { type: 'mathInline', attrs: { latex: text } }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      className="nt-pop nt-bubble"
      updateDelay={60}
      shouldShow={showBubble}
      onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
    >
      {mode === 'main' && (
        <>
          <button type="button" className="nt-bb nt-bb-turn" onClick={() => setMode('turn')}>
            {current.label}
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
          <span className="nt-bb-rule" />
          {mark('bold', 'Bold', () => editor.chain().focus().toggleBold().run(), <b>B</b>)}
          {mark('italic', 'Italic', () => editor.chain().focus().toggleItalic().run(), <i style={{ fontFamily: 'Georgia, serif' }}>i</i>)}
          {mark('underline', 'Underline', () => editor.chain().focus().toggleUnderline().run(), <u>U</u>)}
          {mark('strike', 'Strikethrough', () => editor.chain().focus().toggleStrike().run(), <s>S</s>)}
          {mark('code', 'Code', () => editor.chain().focus().toggleCode().run(), <span className="nt-mono">{'<>'}</span>)}
          {mark('highlight', 'Highlight', () => editor.chain().focus().toggleHighlight().run(), <span className="nt-bb-hl">A</span>)}
          <span className="nt-bb-rule" />
          <button type="button" className="nt-bb" data-on={editor.isActive('link')} title="Link" aria-label="Link"
            onClick={() => { setHref(String(editor.getAttributes('link').href ?? '')); setMode('link'); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
          </button>
          <button type="button" className="nt-bb" title="Equation  ⌘⇧M" aria-label="Turn into equation" onClick={toMath}>∑</button>
        </>
      )}
      {mode === 'turn' && (
        <div className="nt-bb-list">
          {defs.map(d => (
            <button key={d.id} type="button" className="nt-suggest-item" data-active={d === current}
              onClick={() => { d.turn?.(editor); setMode('main'); }}>
              <span className="nt-glyph">{d.glyph}</span>
              <span className="nt-suggest-label">{d.label}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'link' && (
        <form className="nt-bb-link" onSubmit={e => {
          e.preventDefault();
          const url = href.trim();
          if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run();
          else editor.chain().focus().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
          setMode('main');
        }}>
          <input autoFocus value={href} onChange={e => setHref(e.target.value)} placeholder="Paste a link"
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setMode('main'); editor.commands.focus(); } }} />
          <button type="submit" className="nt-bb">Done</button>
        </form>
      )}
    </BubbleMenu>
  );
}

/* ── The handle beside each block ──
   Six dots in the margin and nothing else: drag them to move the block, tap
   them for its menu. New blocks come from "/" or from Insert below. */

function BlockHandle({ editor, env }: { editor: Editor; env: NotesEnv; dark: boolean }) {
  const target = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 });
  const [menu, setMenu] = useState<{ rect: DOMRect; pos: number; node: PMNode } | null>(null);
  const defs = useMemo(() => blockDefs(env).filter(d => TURN_IDS.includes(d.id)), [env]);

  const add = (node: PMNode, pos: number) => {
    if (node.type.name === 'paragraph' && node.content.size === 0) {
      editor.chain().focus().setTextSelection(pos + 1).insertContent('/').run();
      return;
    }
    const after = pos + node.nodeSize;
    editor.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).insertContent('/').run();
  };

  const act = (kind: 'delete' | 'duplicate' | 'insert' | string) => {
    if (!menu) return;
    const { pos, node } = menu;
    setMenu(null);
    if (kind === 'insert') { add(node, pos); return; }
    if (kind === 'delete') { editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run(); return; }
    if (kind === 'duplicate') { editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run(); return; }
    const def = defs.find(d => d.id === kind);
    if (!def?.turn) return;
    const inside = Math.min(pos + 1, editor.state.doc.content.size);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(inside))));
    def.turn(editor);
  };

  return (
    <>
      <DragHandle editor={editor} onNodeChange={({ node, pos }) => { target.current = { node, pos }; }}>
        <div className="nt-handle">
          <button
            type="button"
            className="nt-handle-btn"
            aria-label="Drag to move, or open block menu"
            onClick={e => {
              const { node, pos } = target.current;
              if (node && pos >= 0) setMenu({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), pos, node });
            }}
          >
            <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
              {[2, 7, 12].map(y => (<React.Fragment key={y}><circle cx="2.5" cy={y} r="1.2" fill="currentColor" /><circle cx="7.5" cy={y} r="1.2" fill="currentColor" /></React.Fragment>))}
            </svg>
          </button>
        </div>
      </DragHandle>
      {menu && createPortal(
        <>
          <div className="nt-scrim-clear" onMouseDown={() => setMenu(null)} />
          <div className="nt-pop nt-block-menu" style={{ left: menu.rect.left, top: Math.min(menu.rect.bottom + 6, window.innerHeight - 380) }}>
            <button type="button" className="nt-suggest-item" onClick={() => act('insert')}>
              <span className="nt-glyph">+</span><span className="nt-suggest-label">Insert below</span><span className="nt-suggest-hint">/</span>
            </button>
            <p className="nt-pop-group">Turn into</p>
            {defs.map(d => (
              <button key={d.id} type="button" className="nt-suggest-item" onClick={() => act(d.id)}>
                <span className="nt-glyph">{d.glyph}</span><span className="nt-suggest-label">{d.label}</span>
              </button>
            ))}
            <span className="nt-pop-rule" />
            <button type="button" className="nt-suggest-item" onClick={() => act('duplicate')}>
              <span className="nt-glyph">⧉</span><span className="nt-suggest-label">Duplicate</span>
            </button>
            <button type="button" className="nt-suggest-item is-danger" onClick={() => act('delete')}>
              <span className="nt-glyph">×</span><span className="nt-suggest-label">Delete</span>
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

/* ── Writing an equation ──
   The source on top, the rendered result under it as you type, and a row of
   the pieces a student reaches for most, so nobody has to know that a
   fraction is \frac{}{}. */

const SNIPPETS: [string, string, number][] = [
  ['a/b', '\\frac{}{}', 6], ['x²', '^{}', 2], ['x₁', '_{}', 2], ['√', '\\sqrt{}', 6],
  ['∫', '\\int_{}^{} ', 6], ['Σ', '\\sum_{}^{} ', 6], ['v⃗', '\\vec{}', 5], ['Δ', '\\Delta ', 7],
  ['θ', '\\theta ', 7], ['ω', '\\omega ', 7], ['λ', '\\lambda ', 8], ['μ', '\\mu ', 4],
  ['π', '\\pi ', 4], ['∞', '\\infty ', 7], ['→', '\\rightarrow ', 12], ['⇌', '\\ce{ <=> }', 4],
];

function MathPopover({ edit, editor, onClose }: { edit: MathEdit; editor: Editor; onClose: () => void }) {
  const [latex, setLatex] = useState(edit.latex);
  const [ok, setOk] = useState(true);
  const preview = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void loadKatex(); input.current?.focus(); input.current?.select(); }, []);
  useEffect(() => {
    if (!preview.current) return;
    setOk(renderTex(preview.current, latex, true));
  }, [latex]);

  const commit = () => {
    const node = editor.state.doc.nodeAt(edit.pos);
    onClose();
    if (!node || (node.type.name !== 'mathInline' && node.type.name !== 'mathBlock')) return;
    const src = latex.trim();
    if (!src) { editor.chain().focus().deleteRange({ from: edit.pos, to: edit.pos + node.nodeSize }).run(); return; }
    const tr = editor.state.tr.setNodeMarkup(edit.pos, undefined, { ...node.attrs, latex: src });
    tr.setSelection(TextSelection.near(tr.doc.resolve(edit.pos + node.nodeSize)));
    editor.view.dispatch(tr);
    editor.commands.focus();
  };

  const cancel = () => {
    onClose();
    const node = editor.state.doc.nodeAt(edit.pos);
    // An equation that was never written is not kept.
    if (node && !String(node.attrs.latex ?? '').trim()) editor.chain().focus().deleteRange({ from: edit.pos, to: edit.pos + node.nodeSize }).run();
    else editor.commands.focus();
  };

  const insert = (snippet: string, back: number) => {
    const el = input.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const next = latex.slice(0, s) + snippet + latex.slice(e);
    setLatex(next);
    requestAnimationFrame(() => { el.focus(); const at = s + back; el.setSelectionRange(at, at); });
  };

  const below = window.innerHeight - edit.rect.bottom > 280;
  const left = Math.max(8, Math.min(edit.rect.left, window.innerWidth - 400));
  return createPortal(
    <>
      <div className="nt-scrim-clear" onMouseDown={commit} />
      <div className="nt-pop nt-math-pop" style={below ? { left, top: edit.rect.bottom + 8 } : { left, bottom: window.innerHeight - edit.rect.top + 8 }}>
        <textarea
          ref={input}
          value={latex}
          rows={Math.min(5, latex.split('\n').length + (edit.display ? 1 : 0))}
          spellCheck={false}
          placeholder={edit.display ? 'F = ma   or   \\ce{H2 + O2 -> H2O}' : 'x^2'}
          onChange={e => setLatex(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          }}
        />
        <div className="nt-math-snips">
          {SNIPPETS.map(([label, code, back]) => (
            <button key={label} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insert(code, back)}>{label}</button>
          ))}
        </div>
        <div className="nt-math-preview" ref={preview} />
        <div className="nt-math-foot">
          <span>{ok ? 'Enter to save · Shift+Enter for a new line' : 'That isn’t valid LaTeX yet'}</span>
          <button type="button" onClick={commit}>Done</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── The phone's bar above the keyboard ──
   No hover on a phone, so no drag handle and no bubble on a long selection
   the OS is busy with. This is where the blocks live instead. Placed from
   visualViewport, which is the only number that knows where the keyboard is. */

function PhoneBar({ editor, env }: { editor: Editor; env: NotesEnv }) {
  const [focused, setFocused] = useState(false);
  const [bottom, setBottom] = useState(0);
  const coarse = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, []);

  useEffect(() => {
    if (!coarse) return;
    const on = () => setFocused(true);
    const off = () => setTimeout(() => setFocused(editor.isFocused), 120);
    editor.on('focus', on);
    editor.on('blur', off);
    const vv = window.visualViewport;
    const place = () => { if (vv) setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop)); };
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    place();
    return () => {
      editor.off('focus', on);
      editor.off('blur', off);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [editor, coarse]);

  if (!coarse || !focused) return null;
  const run = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };
  const btn = (label: string, glyph: React.ReactNode, fn: () => void) => (
    <button type="button" aria-label={label} onMouseDown={run(fn)}>{glyph}</button>
  );
  return createPortal(
    <div className="nt-phonebar" style={{ bottom }}>
      {btn('Blocks', '/', () => editor.chain().focus().insertContent('/').run())}
      {btn('To-do', '☐', () => editor.chain().focus().toggleTaskList().run())}
      {btn('List', '•', () => editor.chain().focus().toggleBulletList().run())}
      {btn('Heading', 'H', () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn('Bold', <b>B</b>, () => editor.chain().focus().toggleBold().run())}
      {btn('Equation', '∑', () => { env.mathPending = true; editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: '' } }).run(); })}
      {btn('Image', '▢', () => pickImages(editor, env))}
      {btn('Undo', '↺', () => editor.chain().focus().undo().run())}
      {btn('Done', '⌄', () => editor.commands.blur())}
    </div>,
    document.body,
  );
}
