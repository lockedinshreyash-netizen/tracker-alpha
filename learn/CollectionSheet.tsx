/* ── Arranging a collection ──
   Rename it, put its lectures in the order they should be watched, take one
   off, or delete the whole shelf. Order is set with buttons, one place at a
   time: they work the same with a finger, a mouse and a keyboard, and a list
   of ten does not need a drag gesture to be quick. Each change is written as
   it is made; deleting the shelf asks first and never touches its lectures. */

import React, { useState, useSyncExternalStore } from 'react';
import { Field, Sheet, btn, tokens } from '../ui/kit';
import CdCase from './CdCase';
import { LIMITS, chapterName, codeOf, coverArt, displayTitle, type Collection, type Lecture } from './model';
import type { LearnStore } from './store';

interface Props {
  store: LearnStore;
  collection: Collection;
  dark: boolean;
  onClose: () => void;
}

export default function CollectionSheet({ store, collection, dark, onClose }: Props) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const t = tokens(dark);
  const lib = store.getLibrary();
  const current = lib.collections[collection.id] ?? collection;
  const [name, setName] = useState(current.name);
  const [confirming, setConfirming] = useState(false);
  const now = Date.now();
  const lectures = current.lectureIds.map(id => lib.lectures[id]).filter((l): l is Lecture => !!l && !l.deletedAt);

  const saveName = () => {
    if (name.trim() && name.trim() !== current.name) store.renameCollection(current.id, name);
  };
  const close = () => { saveName(); onClose(); };

  const iconBtn = `w-10 h-10 rounded-lg border flex items-center justify-center text-[15px] font-bold disabled:opacity-30 ${
    dark ? 'border-white/[0.1] text-zinc-200 hover:bg-white/[0.06]' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
  }`;

  return (
    <Sheet
      dark={dark}
      onClose={close}
      label={`Edit ${current.name}`}
      header={
        <div className="px-5 md:px-7 py-5">
          <h2 className={`font-display text-2xl ${t.heading}`}>Edit collection</h2>
          <p className={`text-[13px] font-ui mt-1 ${t.muted}`}>The order here is the order on the shelf.</p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          {confirming ? (
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => { store.deleteCollection(current.id); onClose(); }} className={`${btn} h-11 px-4 ${t.primary}`}>Delete it</button>
              <button type="button" onClick={() => setConfirming(false)} className={`${btn} h-11 px-4 ${t.ghost}`}>Keep it</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={`${btn} h-11 px-4 ${t.ghost}`}>Delete collection</button>
          )}
          <button type="button" onClick={close} className={`${btn} h-11 px-5 ${t.primary}`}>Done</button>
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6 space-y-6">
        {confirming && (
          <p className={`text-[13px] font-ui ${t.body}`} role="status">
            Delete “{current.name}”? Its {lectures.length === 1 ? 'lecture stays' : 'lectures stay'} on your shelf.
          </p>
        )}

        <Field label="Name" dark={dark} hint={`${name.length}/${LIMITS.collectionName}`}>
          <input
            className={t.input}
            value={name}
            onChange={e => setName(e.target.value.slice(0, LIMITS.collectionName))}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } }}
            aria-label="Collection name"
          />
        </Field>

        <Field label={`Lectures · ${lectures.length}`} dark={dark}>
          {lectures.length ? (
            <ol className="space-y-2">
              {lectures.map((l, i) => (
                <li key={l.id} className={`flex items-center gap-3 rounded-lg border p-2 ${t.inset}`}>
                  <span className={`w-5 text-center text-[12px] font-bold tabular-nums font-ui ${t.faint}`}>{i + 1}</span>
                  <CdCase code={codeOf(l)} title={displayTitle(l, now)} subject={l.subject} art={coverArt(l.id)} size={48} finish={dark ? 'ink' : 'paper'} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-ui font-bold truncate ${t.heading}`}>{displayTitle(l, now)}</span>
                    <span className={`block text-[11px] font-ui truncate ${t.muted}`}>{codeOf(l)}{chapterName(l.chapterKey) ? ` · ${chapterName(l.chapterKey)}` : ''}</span>
                  </span>
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => store.moveInCollection(current.id, l.id, -1)} aria-label={`Move ${codeOf(l)} earlier`}>↑</button>
                  <button type="button" className={iconBtn} disabled={i === lectures.length - 1} onClick={() => store.moveInCollection(current.id, l.id, 1)} aria-label={`Move ${codeOf(l)} later`}>↓</button>
                  <button type="button" className={iconBtn} onClick={() => store.setInCollection(current.id, l.id, false)} aria-label={`Take ${codeOf(l)} off this collection`}>×</button>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`text-[13px] font-ui ${t.muted}`}>Nothing on it yet. Open a lecture and put it on this shelf.</p>
          )}
        </Field>
      </div>
    </Sheet>
  );
}
