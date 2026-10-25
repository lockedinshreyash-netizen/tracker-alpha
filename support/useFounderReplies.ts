/* ── Has the founder replied? ──
   Mounted at App root, like the feedback launcher's reply check: the answer is
   shown on Today ("Shreyash replied to your note"), and Today is not where the
   notes live. Asked on sign-in and when the app comes back to the
   foreground, at most every two minutes. No polling and no Realtime: a reply
   to a letter is not urgent. Never throws; before support.sql is re-run the
   count is simply 0. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { countUnseenReplies } from './api';

export const useFounderReplies = (uid: string | null) => {
  const [unseen, setUnseen] = useState(0);
  const lastRef = useRef(0);
  /* Bumped when replies are marked seen, so a check already in flight cannot
     put back a line the student has just cleared. */
  const genRef = useRef(0);

  useEffect(() => {
    setUnseen(0);
    if (!uid) return;
    let alive = true;
    const check = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastRef.current < 120_000) return;
      lastRef.current = now;
      const gen = genRef.current;
      void countUnseenReplies().then(n => { if (alive && gen === genRef.current) setUnseen(n); });
    };
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

  const markSeen = useCallback(() => {
    genRef.current += 1;
    setUnseen(0);
  }, []);

  return { unseen, markSeen };
};
