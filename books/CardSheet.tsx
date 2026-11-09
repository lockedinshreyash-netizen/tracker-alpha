/* ── A flashcard from a book, without leaving it ──
   A highlighted line becomes a fill-in-the-blank card: tap the words to
   hide, as many runs as you like (each run is its own blank, all hidden at
   once, the Decks rule: one note is one card). A snip becomes a picture
   card: the picture on the front, your answer on the back.

   The card goes into a deck you own (Decks is server state: you must be
   signed in). The deck for this chapter is picked for you when one exists,
   else the last deck you sent to, else a new deck named after the chapter
   is offered. The back says where it came from ("Physics Part 1 · p. 42").
   Links are stripped from card HTML on purpose (decks/html.ts), so the
   source is words, not a link. */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DuplicateNoteError, addNote, createDeck, fetchSummaries, humanError, uploadMedia } from '../decks/api';
import type { DeckSubject, DeckSummary } from '../decks/types';
import { chapterOfKey } from './model';
import type { MarkSource } from './BookRoom';
import { clozeFrom, escapeHtml as escape, tokensOf } from './cards';

const LAST_DECK = 'bk_card_deck_v1';
const NEW = '__new__';

interface Props {
  src: MarkSource;
  userId: string | null;
  onDone: (message: string) => void;
  onClose: () => void;
}

export default function CardSheet({ src, userId, onDone, onClose }: Props) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deckId, setDeckId] = useState<string>('');
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = useMemo(() => (src.image ? URL.createObjectURL(src.image) : null), [src.image]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  const [cls, subject, chapter] = (src.chapterKey ?? '').split('|');
  const chapterName = src.chapterKey ? chapterOfKey(src.chapterKey) : null;
  const tokens = useMemo(() => tokensOf(src.quote ?? ''), [src.quote]);
  const source = `${src.book.title} · p. ${src.page}`;

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
    }, e => { if (live) { setDecks([]); setError(humanError(e)); } });
    return () => { live = false; };
  }, [userId, chapterName, cls]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const toggle = (i: number) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const isText = !src.image;
  const ready = !!userId && !!deckId && (isText ? hidden.size > 0 : true) && !busy;

  const save = async () => {
    if (!userId || !ready) return;
    setBusy(true);
    setError(null);
    try {
      let id = deckId;
      if (id === NEW) {
        const sub = (['Physics', 'Chemistry', 'Maths', 'Biology'].includes(subject) ? subject : src.book.subject ?? null) as DeckSubject | null;
        id = await createDeck(userId, 'personal', {
          title: chapterName ?? src.book.title,
          description: null,
          subject: sub,
          classId: cls === '11' || cls === '12' ? (Number(cls) as 11 | 12) : src.book.classId ?? null,
          chapter: chapterName,
        });
      }
      const from = `<div><i>${escape(source)}</i></div>`;
      if (isText) {
        await addNote(id, { kind: 'cloze', front: clozeFrom(tokens, hidden), back: from, tags: ['alpha-books'] });
      } else {
        const name = `bk-${Date.now().toString(36)}.${src.image!.type === 'image/webp' ? 'webp' : 'jpg'}`;
        await uploadMedia(`${id}/${name}`, src.image!);
        const front = `${prompt.trim() ? `<div>${escape(prompt.trim())}</div>` : ''}<img src="${name}">`;
        await addNote(id, { kind: 'basic', front, back: `${answer.trim() ? `<div>${escape(answer.trim())}</div>` : ''}${from}`, tags: ['alpha-books'] });
      }
      try { localStorage.setItem(LAST_DECK, id); } catch { /* private */ }
      const deckName = id === deckId ? decks?.find(d => d.id === id)?.title : chapterName ?? src.book.title;
      onDone(`Card added to ${deckName ?? 'your deck'}.`);
    } catch (e) {
      setError(e instanceof DuplicateNoteError ? 'That card is already in this deck.' : humanError(e));
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="bk-scrim" onClick={onClose} />
      <div className="bk-sheet bk-card" role="dialog" aria-label="Make a flashcard">
        <div className="bk-sheet-head">
          <h3>Make a flashcard</h3>
          <button type="button" className="bk-btn" onClick={onClose}>Cancel</button>
        </div>

        {!userId ? (
          <p className="bk-dim">Sign in to make flashcards. Decks live on your account so every device can review them.</p>
        ) : (
          <>
            {isText ? (
              <>
                <p className="bk-card-hint">Tap the words to hide.</p>
                <p className="bk-cloze">
                  {tokens.map((t, i) => (/^\s+$/.test(t)
                    ? <span key={i}>{t}</span>
                    : (
                      <button key={i} type="button" className="bk-word" aria-pressed={hidden.has(i)} onClick={() => toggle(i)}>
                        {t}
                      </button>
                    )))}
                </p>
              </>
            ) : (
              <>
                {image && <img className="bk-card-img" src={image} alt="The snip" />}
                <input className="bk-input" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Question (optional): what should you recall?" maxLength={300} />
                <textarea className="bk-input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Answer (optional)" maxLength={1500} rows={3} />
              </>
            )}

            <label className="bk-field">
              <span>Deck</span>
              <select className="bk-input" value={deckId} onChange={e => setDeckId(e.target.value)} disabled={decks === null}>
                {decks === null && <option value="">Loading your decks…</option>}
                {(decks ?? []).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                {decks !== null && <option value={NEW}>New deck: {chapterName ?? src.book.title}</option>}
              </select>
            </label>
            <p className="bk-sheet-foot">The back says where it came from: {source}.</p>
          </>
        )}

        {error && <p className="bk-error" role="alert">{error}</p>}
        {userId && (
          <button type="button" className="bk-btn bk-primary" disabled={!ready} onClick={() => void save()}>
            {busy ? 'Adding…' : 'Add the card'}
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}
