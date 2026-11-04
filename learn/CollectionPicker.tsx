/* ── Which shelves a lecture is on ──
   On the lecture's own page, one chip per collection: on a shelf, the chip is
   filled; a tap puts the lecture on or takes it off. "New" names a shelf and
   puts this lecture on it in one go. */

import React, { useState } from 'react';
import { Chip, btn, tokens } from '../ui/kit';
import { collectionsInOrder } from './model';
import type { LearnStore } from './store';

interface Props {
  store: LearnStore;
  lectureId: string;
  dark: boolean;
}

export default function CollectionPicker({ store, lectureId, dark }: Props) {
  const t = tokens(dark);
  const shelves = collectionsInOrder(store.getLibrary());
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    const clean = name.trim();
    if (!clean) return;
    const id = store.createCollection(clean);
    store.setInCollection(id, lectureId, true);
    setName('');
    setNaming(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Collections">
      <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui mr-1 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>On</span>
      {shelves.map(c => {
        const on = c.lectureIds.includes(lectureId);
        return (
          <Chip key={c.id} on={on} dark={dark} onClick={() => store.setInCollection(c.id, lectureId, !on)}>
            {on ? '✓ ' : '+ '}{c.name}
          </Chip>
        );
      })}
      {naming ? (
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); create(); }}>
          <input
            className={`${t.input} !py-1.5 w-44`}
            value={name}
            onChange={e => setName(e.target.value.slice(0, 80))}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(false); setName(''); } }}
            placeholder="New collection"
            aria-label="New collection name"
            autoFocus
          />
          <button type="submit" disabled={!name.trim()} className={`${btn} h-8 px-3 ${t.primary}`}>Add</button>
        </form>
      ) : (
        <Chip on={false} dark={dark} onClick={() => setNaming(true)}>New collection</Chip>
      )}
    </div>
  );
}
