/* ── Notes home ──
   A title and your pages. Nothing else on the screen has to be read:
   New page and Search are on the pill, Import is in the Pages panel. Pages
   are grouped by subject (a coloured dot and its name), each row a title, a
   date and one line of what is inside.

   An empty notebook offers the formats a first page can start from; once
   there are pages, formats are offered on each new, empty page instead
   (PageView), which is where the choice is actually made. */

import React, { useMemo, useState } from 'react';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { Subject } from '../types';
import { TEMPLATES } from './templates';
import { pageSubject, type PageMeta, type Tree } from './workspace';
import { relTime } from './ui';
import { snippet } from './text';
import { Sketch } from './Sketch';

interface Props {
  tree: Tree;
  texts: Map<string, string>;
  subjects: Subject[];
  onOpen: (id: string) => void;
  onTemplate: (id: string) => void;
}

const SHOWN = 6;
const SUBJECT_NAMES = ['Physics', 'Chemistry', 'Maths', 'Biology'];

export default function NotesHome({ tree, texts, subjects, onOpen, onTemplate }: Props) {
  const [all, setAll] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byKey = new Map<string, PageMeta[]>();
    tree.live.forEach(p => {
      // A subject folder the Syllabus tab made is a shelf, not a page to list.
      const isFolder = !p.chapter && SUBJECT_NAMES.includes(p.title.trim()) && (tree.children.get(p.id)?.length ?? 0) > 0;
      if (isFolder) return;
      const key = pageSubject(tree, p.id) ?? '';
      byKey.set(key, [...(byKey.get(key) ?? []), p]);
    });
    const order = [...subjects.filter(s => s !== 'General'), ...SUBJECT_NAMES.filter(s => !subjects.includes(s as Subject)), ''];
    return order
      .filter(k => byKey.get(k)?.length)
      .map(k => ({ key: k, label: k || 'Other', pages: byKey.get(k)!.sort((a, b) => b.updatedAt - a.updatedAt) }));
  }, [tree, subjects]);

  const empty = groups.length === 0;

  return (
    <div className="nt-home">
      <h1 className="nt-display mk-rise">Notes<span className="nt-stop">.</span></h1>

      {empty && (
        <div className="nt-empty mk-rise" style={{ animationDelay: '60ms' }}>
          <p className="nt-empty-line">Your notebook for JEE. Pick a way to start.</p>
          <div className="nt-formats">
            {TEMPLATES.map(tpl => (
              <button key={tpl.id} type="button" className="nt-format" onClick={() => onTemplate(tpl.id)}>
                <Sketch rows={tpl.sketch} />
                <span className="nt-format-name">{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.map((g, gi) => {
        const open = all.has(g.key);
        const shown = open ? g.pages : g.pages.slice(0, SHOWN);
        const dot = g.key ? (SUBJECT_COLORS[g.key as Subject] ?? SUBJECT_COLORS.General).dot : 'var(--nt-faint)';
        return (
          <section key={g.key || 'other'} className="nt-group mk-rise" style={{ animationDelay: `${60 + gi * 50}ms` }}>
            <h2 className="nt-group-head"><i style={{ background: dot }} />{g.label}</h2>
            <ul className="nt-list">
              {shown.map(p => {
                const preview = p.dek.trim() || snippet(texts.get(p.id) ?? '', 140);
                return (
                  <li key={p.id}>
                    <button type="button" className="nt-row" onClick={() => onOpen(p.id)}>
                      <span className="nt-row-title">{p.title || 'Untitled'}</span>
                      <span className="nt-row-date">{relTime(p.updatedAt)}</span>
                      {preview && <span className="nt-row-preview">{preview}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {g.pages.length > SHOWN && (
              <button type="button" className="nt-more" onClick={() => setAll(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                {open ? 'Show less' : `Show all ${g.pages.length}`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
