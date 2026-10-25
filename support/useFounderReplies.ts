/* ── Has the founder replied? ──
   Mounted at App root. A reply the student has not read opens the reply card
   (support/ReplyCard.tsx) on their next visit, on whatever tab they are on,
   and keeps the line on Today until it is read. Asked on sign-in, on return to
   the foreground (at most every two minutes), and at once when a "Shreyash
   replied" push is tapped (`refresh`). No polling and no Realtime: a reply to
   a letter is not urgent, and the push already covers a closed app.

   Never throws: before support.sql is run there is simply nothing pending. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ackReplies, isUnseen, listMyNotes, type MyNote } from './api';

export const useFounderReplies = (uid: string | null) => {
  /* Unread replies, oldest reply first: the card walks them in the order they were written. */
  const [pending, setPending] = useState<MyNote[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef(0);
  /* Bumped whenever replies are marked read, so a check already in flight
     cannot put back a card or a line the student has just cleared. */
  const genRef = useRef(0);
  const checkRef = useRef<(force: boolean) => void>(() => {});

  useEffect(() => {
    setPending([]);
    if (!uid) { checkRef.current = () => {}; return; }
    let alive = true;
    const check = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastRef.current < 120_000) return;
      lastRef.current = now;
      const gen = genRef.current;
      void listMyNotes().then(rows => {
        if (!alive || gen !== genRef.current) return;
        setPending(rows.filter(isUnseen).sort((a, b) => Date.parse(a.replied_at ?? '') - Date.parse(b.replied_at ?? '')));
      });
    };
    checkRef.current = check;
    check(true);
    const onBack = () => { if (document.visibilityState === 'visible') check(false); };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [uid]);

  const refresh = useCallback(() => checkRef.current(true), []);

  /* Read elsewhere (the Support page's list): drop them here without a write. */
  const markSeen = useCallback((ids?: string[]) => {
    genRef.current += 1;
    setPending(prev => (ids ? prev.filter(n => !ids.includes(n.id)) : []));
  }, []);

  /* "Got it" on the card. The card stays until the write lands, so a reply is
     never marked read on screen while the server still thinks it is new. */
  const acknowledge = useCallback(async (ids: string[]) => {
    setSaving(true);
    setError(null);
    try {
      await ackReplies(ids);
      genRef.current += 1;
      setPending(prev => prev.filter(n => !ids.includes(n.id)));
    } catch {
      setError('Couldn’t save that. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, []);

  return { pending, unseen: pending.length, saving, error, refresh, markSeen, acknowledge };
};
