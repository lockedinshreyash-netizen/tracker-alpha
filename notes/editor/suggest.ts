/* ── "/", "@" and "[[" ──
   One suggestion plugin each, all feeding the same SuggestBus, which the one
   menu in NoteEditor draws. Keyboard handling lives here because the plugin
   sees the keys before the editor does. */

import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { SUBJECT_COLORS } from '../../schedule/colors';
import { fold } from '../text';
import type { NotesEnv, SuggestBus, SuggestItem, SuggestKind } from './env';
import { blockItems } from './blocks';

const matches = (q: string, ...hay: string[]) => {
  const f = fold(q.trim());
  return !f || hay.some(h => fold(h).includes(f));
};

const makeRender = (bus: SuggestBus, kind: SuggestKind) => () => {
  let props: SuggestionProps<SuggestItem> | null = null;
  let index = 0;
  const publish = () => {
    if (!props) return;
    const items = props.items;
    if (index >= items.length) index = Math.max(0, items.length - 1);
    const p = props;
    bus.set({
      kind,
      items,
      index,
      rect: p.clientRect?.() ?? null,
      select: item => p.command(item),
    });
  };
  return {
    onStart: (p: SuggestionProps<SuggestItem>) => { props = p; index = 0; publish(); },
    onUpdate: (p: SuggestionProps<SuggestItem>) => { props = p; index = 0; publish(); },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (!props) return false;
      const n = props.items.length;
      if (event.key === 'Escape') { bus.set(null); props = null; return true; }
      if (!n) return false;
      if (event.key === 'ArrowDown') { index = (index + 1) % n; publish(); return true; }
      if (event.key === 'ArrowUp') { index = (index - 1 + n) % n; publish(); return true; }
      if (event.key === 'Enter' || event.key === 'Tab') { props.command(props.items[index]); return true; }
      return false;
    },
    onExit: () => { props = null; bus.set(null); },
  };
};

const suggestion = (
  editor: Editor,
  bus: SuggestBus,
  kind: SuggestKind,
  char: string,
  items: (query: string) => SuggestItem[],
  allowSpaces = false,
) => Suggestion<SuggestItem>({
  editor,
  char,
  pluginKey: new PluginKey(`nt-suggest-${kind}`),
  allowSpaces,
  startOfLine: false,
  items: ({ query }) => items(query),
  command: ({ editor: ed, range, props }) => props.run(ed, range),
  render: makeRender(bus, kind),
});

export const Suggestions = Extension.create<{ env: NotesEnv; bus: SuggestBus }>({
  name: 'ntSuggestions',
  addOptions: () => ({ env: null as unknown as NotesEnv, bus: null as unknown as SuggestBus }),
  addProseMirrorPlugins() {
    const { env, bus } = this.options;
    const ed = this.editor;

    const slash = (q: string) => blockItems(env).filter(i => matches(q, i.label, i.group, i.hint ?? '', i.id));

    const chapterItems = (q: string): SuggestItem[] => env.chapters()
      .filter(c => matches(q, c.name))
      .slice(0, 6)
      .map(c => ({
        id: `ch:${c.key}`,
        group: 'Chapters',
        label: c.name,
        hint: `${c.subject} · ${c.classId}`,
        glyph: '@',
        tint: (SUBJECT_COLORS[c.subject] ?? SUBJECT_COLORS.General).dot,
        run: (editor: Editor, range: Range) => {
          editor.chain().focus().insertContentAt(range, [
            { type: 'chapterRef', attrs: { key: c.key, name: c.name } },
            { type: 'text', text: ' ' },
          ]).run();
        },
      }));

    const pageItems = (q: string, group: string, offerNew: boolean): SuggestItem[] => {
      const found: SuggestItem[] = env.searchPages(q).slice(0, 6).map(p => ({
        id: `pg:${p.id}`,
        group,
        label: p.title || 'Untitled',
        glyph: '↗',
        run: (editor: Editor, range: Range) => {
          editor.chain().focus().insertContentAt(range, [
            { type: 'pageLink', attrs: { id: p.id } },
            { type: 'text', text: ' ' },
          ]).run();
        },
      }));
      const title = q.trim();
      if (title && offerNew) {
        found.push({
          id: 'pg:new',
          group,
          label: `New page “${title.slice(0, 40)}”`,
          hint: 'inside this page',
          glyph: '+',
          run: (editor: Editor, range: Range) => {
            const id = env.createSubpage(title);
            editor.chain().focus().insertContentAt(range, [
              { type: 'pageLink', attrs: { id } },
              { type: 'text', text: ' ' },
            ]).run();
          },
        });
      }
      return found;
    };

    return [
      suggestion(ed, bus, 'slash', '/', slash),
      suggestion(ed, bus, 'mention', '@', q => (q.length > 40 ? [] : [...chapterItems(q), ...pageItems(q, 'Pages', false)]), true),
      suggestion(ed, bus, 'link', '[[', q => pageItems(q, 'Link to a page', true), true),
    ];
  },
});
