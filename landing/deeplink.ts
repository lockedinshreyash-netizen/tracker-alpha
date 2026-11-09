/* ── Links into the app from the guide pages ──
   `/?open=syllabus&exam=NEET` is where a guide page's "Track this syllabus"
   button goes. Someone who just read the NEET Biology syllabus wants the
   tracker, not the pitch, so the landing page is skipped (landing/gate.ts and
   index.html's inline script both treat `open` as "not this visit"), the app
   opens on that tab, and a NEW student starts with that exam selected — which
   onboarding then shows pre-filled. An existing student's own exam choice is
   never overwritten by a link.

   Read once at App start; `settleDeepLink` then marks the visit (the same
   thing the landing CTA does) and strips the parameters, so a reload or a
   shared address bar does not re-apply them. */

import type { ExamPreference, TabType } from '../types';
import { STORE_LAUNCHED } from '../store/launch';

const TABS: Record<string, TabType> = {
  today: 'Today',
  plan: 'Plan',
  syllabus: 'Syllabus',
  mocks: 'Mocks',
  decks: 'Decks',
  notes: 'Notes',
  learn: 'Learn',
  groups: 'Groups',
  streak: 'Streak',
  // The footers' "Support Alpha" (site/support.tsx's "Write a note" link).
  support: 'Support',
  // The "delete your account" page (site/legal.tsx) links to /?open=review#account.
  // Once the Alpha Store launches, Review's contents live on the profile page.
  review: STORE_LAUNCHED ? 'Profile' : 'Review',
  ...(STORE_LAUNCHED ? { store: 'Store' as TabType, profile: 'Profile' as TabType } : {}),
};

export interface DeepLink {
  tab: TabType;
  exam?: ExamPreference;
  /** `/?open=learn&book=<id>&page=<n>`: a book on the student's own Learn shelf, from a note or a card. */
  book?: { id: string; page?: number };
}

export const readDeepLink = (): DeepLink | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = TABS[(params.get('open') ?? '').toLowerCase()];
    if (!tab) return null;
    const exam = params.get('exam');
    const bookId = params.get('book');
    const page = Number(params.get('page'));
    const book = tab === 'Learn' && bookId && /^[A-Za-z0-9_-]{6,40}$/.test(bookId)
      ? { id: bookId, ...(Number.isInteger(page) && page > 0 ? { page } : {}) }
      : undefined;
    return { tab, exam: exam === 'JEE' || exam === 'NEET' ? exam : undefined, ...(book ? { book } : {}) };
  } catch {
    return null;
  }
};

export const settleDeepLink = (): void => {
  try { localStorage.setItem('hasVisited', 'true'); } catch { /* private mode */ }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('open');
    url.searchParams.delete('exam');
    url.searchParams.delete('book');
    url.searchParams.delete('page');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch { /* the parameters stay; harmless */ }
};
