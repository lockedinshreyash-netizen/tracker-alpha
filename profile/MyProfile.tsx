/* ── Your own page ──
   Opened from the account button at the bottom of the rail. The profile on
   top (what other students see of you), then everything that used to be the
   Review tab: the Lock-In score, the log you fix by hand, and the settings.
   Review gave up its slot in the rail to the Alpha Store; its contents live
   here unchanged (review/ReviewTab.tsx, drawn `bare`).

   There is one page for yourself: your own /u/<handle> lands here too (App).

   Signed out, the header is the offline card instead. Offline is a real way
   to use Alpha, so Reset device, Exam, Sound and Reminders stay reachable
   without an account. */

import React from 'react';
import type { User } from '@supabase/supabase-js';
import { Card, Eyebrow, PageHeader, btn, tokens } from '../ui/kit';
import { Avatar } from './Avatar';
import type { Profile } from './profileApi';
import type { ExamId } from '../content/exams';
import { formatGap } from '../leaderboard/engine';
import ReviewTab from '../review/ReviewTab';
import { ExamChip } from '../exams/ExamChip';

type ReviewProps = React.ComponentProps<typeof ReviewTab>;

interface Props {
  theme: 'dark' | 'light';
  user: User | null;
  profile: Profile | null;
  /** Every logged hour on this device, any source. */
  totalHours: number;
  onEditProfile: () => void;
  onSignIn: () => void;
  /** Everything the old Review tab took, passed straight through. */
  review: Omit<ReviewProps, 'bare' | 'theme'>;
}

const memberSince = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

const MyProfile = ({ theme, user, profile, totalHours, onEditProfile, onSignIn, review }: Props) => {
  const dark = theme === 'dark';
  const t = tokens(dark);

  return (
    <div className="space-y-6">
      <PageHeader dark={dark} title="You" subtitle={user ? 'Your profile, your numbers and your settings.' : 'Your numbers and your settings, on this device.'} />

      {user && profile ? (
        <Card dark={dark} delay={30} className="p-6 md:p-8 relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 120% at 0% 0%, ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(24,24,27,0.03)'}, transparent 60%)` }} />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-5 min-w-0 flex-1">
              <Avatar profile={profile} size={84} className="ring-2 ring-inset ring-white/10 rounded-full shrink-0" />
              <div className="min-w-0">
                <h2 className={`font-display text-[26px] md:text-[30px] leading-tight truncate ${t.heading}`}>{profile.display_name}</h2>
                <p className={`text-[13px] font-ui mt-1 ${t.faint}`}>@{profile.handle}</p>
                {/* What others see beside your name, while you show it (the Exam row below switches it). */}
                {review.showExam && review.exams && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ExamChip exam={review.exams.primary} year={review.exams.year} dark={dark} size="sm" />
                    {review.exams.also.map((id: ExamId) => <ExamChip key={id} exam={id} dark={dark} size="sm" />)}
                  </div>
                )}
                {profile.bio && <p className={`text-[14px] font-accent mt-2 line-clamp-2 ${t.body}`}>{profile.bio}</p>}
              </div>
            </div>
            <div className="flex items-stretch gap-3 md:gap-4">
              <div className={`px-4 py-3 rounded-lg border min-w-[120px] ${t.inset}`}>
                <Eyebrow dark={dark}>Total studied</Eyebrow>
                <p className={`num-stat text-[18px] mt-1 ${t.heading}`}>{formatGap(Math.round(totalHours * 60))}</p>
              </div>
              <div className={`px-4 py-3 rounded-lg border min-w-[120px] ${t.inset}`}>
                <Eyebrow dark={dark}>Member since</Eyebrow>
                <p className={`text-[13px] font-ui font-bold mt-1.5 ${t.heading}`}>{memberSince(profile.created_at)}</p>
              </div>
            </div>
            <button onClick={onEditProfile} className={`${btn} px-5 py-3 ${t.ghost} shrink-0`}>Edit profile</button>
          </div>
        </Card>
      ) : user ? (
        /* Signed in, profile still on its way: hold the space so nothing jumps. */
        <Card dark={dark} delay={30} className="p-6 md:p-8 h-[132px]"><span className="sr-only">Loading your profile</span></Card>
      ) : (
        <Card dark={dark} delay={30} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <span className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.06] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.5 20c.9-3.6 3.9-5.8 7.5-5.8s6.6 2.2 7.5 5.8" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className={`text-[16px] font-ui font-bold ${t.heading}`}>Offline mode.</p>
              <p className={`text-[13px] font-ui mt-1 ${t.muted}`}>Sign in to sync your progress and get a profile.</p>
            </div>
          </div>
          <button onClick={onSignIn} className={`${btn} px-6 py-3.5 ${t.primary} shrink-0`}>Sign in</button>
        </Card>
      )}

      <ReviewTab {...review} theme={theme} bare />
    </div>
  );
};

export default MyProfile;
