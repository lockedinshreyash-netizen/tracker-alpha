/* ── The Learn tab ──
   Learn is opt-in (learn/pref.ts). Until the student turns it on, the tab is
   its cover page and nothing else: no library is opened, no key fetched,
   nothing loaded from YouTube. The library arrives in its own lazy chunk (the
   store, the crypto and the player) the moment it is switched on.

   Hooks stay above the branch: a hook below an early return is how this app
   once rendered a blank page. */

import React, { lazy, Suspense } from 'react';
import './learn.css';
import LearnCover from './LearnCover';
import type { ExamPreference, Subject, TimerState } from '../types';
import type { OtherSession } from './SessionStrip';
import type { LearnRequest } from './LearnHome';

const LearnHome = lazy(() => import('./LearnHome'));

interface Props {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  user: { id: string } | null;
  theme: 'dark' | 'light';
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  onOpenAuth: () => void;
  timer: TimerState;
  otherSession: OtherSession;
  onStartClock: (subject: Subject, chapter?: string) => boolean;
  onOpenToday: () => void;
  onWatching: (watching: boolean) => void;
  /** Syllabus asked for one chapter's lectures. */
  request: LearnRequest | null;
  onRequestHandled: () => void;
}

export default function LearnTab({ enabled, onEnable, onDisable, user, theme, examPreference, currentClass, onOpenAuth, ...session }: Props) {
  const dark = theme === 'dark';
  return (
    <div className="ln" data-theme={theme}>
      {enabled ? (
        <Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
          <LearnHome
            user={user}
            dark={dark}
            examPreference={examPreference}
            currentClass={currentClass}
            onOpenAuth={onOpenAuth}
            onDisable={onDisable}
            {...session}
          />
        </Suspense>
      ) : (
        <LearnCover dark={dark} signedIn={!!user} onEnable={onEnable} />
      )}
    </div>
  );
}
