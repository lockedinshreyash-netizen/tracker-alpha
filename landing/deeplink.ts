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
}

export const readDeepLink = (): DeepLink | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = TABS[(params.get('open') ?? '').toLowerCase()];
    if (!tab) return null;
    const exam = params.get('exam');
    return { tab, exam: exam === 'JEE' || exam === 'NEET' ? exam : undefined };
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
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch { /* the parameters stay; harmless */ }
};
