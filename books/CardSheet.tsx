/* ── A flashcard from a book, without leaving it ──
   The full card editor from Decks (decks/CardEditor.tsx), opened over the
   page: fill-the-blank or question, bold/italic/lists, pictures, maths
   ($x^2$, $$…$$, \( \), \[ \]), tags, the live preview, and Save & add
   another for a second card from the same page. Nothing about it is a
   lesser editor because it was opened from a book.

   It starts written for you. A highlighted line is the sentence (select
   words and press Hide); a snip is the picture on the front. The back
   starts with where it came from ("Physics Part 1 · p. 42"), as plain words
   because card HTML strips links (decks/html.ts); delete it if you like.

   The card goes into a deck you own (Decks is server state: you must be
   signed in). The deck for this chapter is picked for you when one exists,
   else the last deck you sent to, else a new deck named after the chapter,
   which is created only when the first card is saved. Pictures are held on
   the device until then (`previewMedia`) and uploaded into whichever deck
   the card lands in. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import CardEditor from '../decks/CardEditor';
import { createDeck, fetchSummaries, humanError, addNote } from '../decks/api';
import { mediaNames } from '../decks/html';
import { prepareEditorImage, previewMedia, uploadPrepared } from '../decks/media';
import { deckAccent } from '../decks/theme';
import { pill } from '../decks/ui';
import type { DeckSubject, DeckSummary, DraftNote, NoteKind } from '../decks/types';
import { Sheet } from '../ui/kit';
import { chapterOfKey } from './model';
import type { MarkSource } from './BookRoom';
import { escapeHtml as escape } from './cards';

const LAST_DECK = 'bk_card_deck_v1';
const NEW = '__new__';
const SUBJECTS: DeckSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];

interface Props {
  src: MarkSource;
  userId: string | null;
  /** The reading room's page colour is dark (Night, OLED). */
  dark: boolean;
  onDone: (message: string) => void;
  onClose: () => void;
}

interface Start { kind: NoteKind; front: string; back: string }

export default function CardSheet({ src, userId, dark, onDone, onClose }: Props) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deckId, setDeckId] = useState<string>('');
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  /* Pictures not yet in any deck, by name, and which deck has each one. */
  const staged = useRef(new Map<string, Blob>());
  const uploaded = useRef(new Set<string>());
  const creating = useRef<Promise<string> | null>(null);

  const [cls, subject] = (src.chapterKey ?? '').split('|');
  const chapterName = src.chapterKey ? chapterOfKey(src.chapterKey) : null;
  const source = `${src.book.title} · p. ${src.page}`;
  const newTitle = chapterName ?? src.book.title;
  const newSubject = (SUBJECTS.includes(subject as DeckSubject) ? subject : src.book.subject ?? null) as DeckSubject | null;

  /* The first draft: the quote as the sentence, or the snip as the front. */
  useEffect(() => {
    let live = true;
    const back = `<i>${escape(source)}</i>`;
    if (!src.image) {
      setStart({ kind: 'cloze', front: escape((src.quote ?? '').trim()), back });
      return;
    }
    prepareEditorImage(src.image).then(({ name, blob }) => {
      if (!live) return;
      staged.current.set(name, blob);
      previewMedia(name, blob);
      setStart({ kind: 'basic', front: `<img src="${name}">`, back });
    }, () => { if (live) setStart({ kind: 'basic', front: '', back }); });
    return () => { live = false; };
  }, [src, source]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetchSummaries().then(all => {
      if (!live) return;
      const mine = all.filter(d => d.scope === 'personal' && d.ownerId === userId);
      setDecks(mine);
      let last = '';
      try { last = localStorage.getItem(LAST_DECK) ?? ''; } catch { /* private */ }
      const forChapter = chapterName ? mine.find(d => d.chapter === chapterName && String(d.classId) === cls) : undefined;
      setDeckId(forChapter?.id ?? (mine.some(d => d.id === last) ? last : chapterName ? NEW : mine[0]?.id ?? NEW));
    }, e => { if (live) { setDecks([]); setDeckId(NEW); setLoadError(humanError(e)); } });
    return () => { live = false; };
  }, [userId, chapterName, cls]);

  const chosen = decks?.find(d => d.id === deckId) ?? null;
  const deckTitle = chosen?.title ?? (created?.id === deckId ? created.title : newTitle);
  const accent = deckAccent(chosen ? chosen.subject : newSubject, dark);

  /* A deck to save into: the chosen one, or the new one, made once. */
  const ensureDeck = async (): Promise<string> => {
    if (deckId !== NEW) return deckId;
    if (!creating.current) {
      creating.current = createDeck(userId!, 'personal', {
        title: newTitle,
        description: null,
        subject: newSubject,
        classId: cls === '11' || cls === '12' ? (Number(cls) as 11 | 12) : src.book.classId ?? null,
        chapter: chapterName,
      });
      creating.current.then(id => { setCreated({ id, title: newTitle }); setDeckId(id); }, () => { creating.current = null; });
    }
    return creating.current;
  };

  const save = async (draft: DraftNote) => {
    const id = await ensureDeck();
    for (const name of new Set(mediaNames(`${draft.front}${draft.back}`))) {
      const blob = staged.current.get(name);
      if (!blob || uploaded.current.has(`${id}/${name}`)) continue;
      await uploadPrepared(id, name, blob);
      uploaded.current.add(`${id}/${name}`);
    }
    const note = await addNote(id, draft);
    try { localStorage.setItem(LAST_DECK, id); } catch { /* private */ }
    return note;
  };

  const stageImage = async (file: File): Promise<string> => {
    const { name, blob } = await prepareEditorImage(file);
    staged.current.set(name, blob);
    previewMedia(name, blob);
    return name;
  };

  /* The editor calls onSaved and then onClose in the same tick, so the count is a ref. */
  const added = useRef<{ count: number; deck: string } | null>(null);
  const close = () => {
    const a = added.current;
    if (a) onDone(a.count === 1 ? `Card added to ${a.deck}.` : `${a.count} cards added to ${a.deck}.`);
    else onClose();
  };

  const picker = useMemo(() => (
    <label className="inline-flex items-center gap-1.5 max-w-full">
      <span>Deck</span>
      <select
        value={deckId}
        onChange={e => setDeckId(e.target.value)}
        disabled={decks === null}
        aria-label="Deck"
        className={`min-w-0 max-w-[260px] truncate bg-transparent font-semibold outline-none cursor-pointer rounded-md px-1 -mx-1 ${dark ? 'text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-800 hover:bg-zinc-100'}`}
      >
        {decks === null && <option value="">Loading your decks…</option>}
        {(decks ?? []).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        {created && !(decks ?? []).some(d => d.id === created.id) && <option value={created.id}>{created.title}</option>}
        {decks !== null && !created && <option value={NEW}>New deck: {newTitle}</option>}
      </select>
    </label>
  ), [deckId, decks, created, newTitle, dark]);

  if (!userId) {
    return (
      <Sheet
        dark={dark}
        onClose={onClose}
        label="Make a flashcard"
        header={<p className={`px-5 md:px-7 py-4 font-display text-[20px] ${dark ? 'text-white' : 'text-zinc-900'}`}>Make a flashcard</p>}
        footer={<div className="flex justify-end"><button type="button" onClick={onClose} className={pill.quiet(dark)}>Close</button></div>}
      >
        <p className={`px-5 md:px-7 py-6 text-[14px] font-ui ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          Sign in to make flashcards. Decks live on your account so every device can review them.
        </p>
      </Sheet>
    );
  }

  if (!start || !deckId) return null;

  return (
    <CardEditor
      deckId={deckId === NEW ? '' : deckId}
      deckTitle={deckTitle}
      isGlobal={false}
      dark={dark}
      accent={accent}
      initial={{ kind: start.kind, front: start.front, back: start.back, tags: [] }}
      title="Make a flashcard"
      deckSlot={picker}
      stageImage={stageImage}
      save={save}
      footnote={loadError ? `Couldn't load your decks (${loadError}). The card will go into a new deck.` : `From ${source}. ${start.kind === 'cloze' ? 'Select the words to hide, then press Hide.' : 'Write the answer on the back.'}`}
      onSaved={() => { added.current = { count: (added.current?.count ?? 0) + 1, deck: deckTitle }; }}
      onClose={close}
    />
  );
}
