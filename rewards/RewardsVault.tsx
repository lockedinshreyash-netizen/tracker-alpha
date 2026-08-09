import React, { useState } from 'react';
import { RewardsState } from '../types';
import { RewardDef } from './catalog';
import { rewardProgress, nextReward } from './engine';
import { WALLPAPERS, wallpaperById } from './wallpapers';
import WallpaperLayer from './WallpaperLayer';
import { BOOK } from '../content/book';

interface Props {
  rewards: RewardsState;
  /** Live streaks, for the "keep going" line — not for unlocking. */
  streak: number;
  verifiedStreak: number;
  theme: 'dark' | 'light';
  onSelectWallpaper: (id: string | null) => void;
  onOpenBook: () => void;
  onClaimHamper: () => void;
}

const CLAIM_EMAIL = 'lockinhq@gmail.com';

const LockIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * The vault: what the streak has already paid out, and what it owes next.
 *
 * Locked rewards are shown, never hidden. A prize you cannot see is not a
 * reason to log tomorrow.
 */
const RewardsVault: React.FC<Props> = ({
  rewards, streak, verifiedStreak, theme, onSelectWallpaper, onOpenBook, onClaimHamper,
}) => {
  const dark = theme === 'dark';
  const [expanded, setExpanded] = useState<string | null>(null);
  const progress = rewardProgress(rewards);
  const next = nextReward(rewards);

  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm';
  const heading = dark ? 'text-white' : 'text-black';

  const toggle = (def: RewardDef) => setExpanded(e => (e === def.id ? null : def.id));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 font-ui">
          The Vault
        </h3>
        {next && (
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-600 tabular-nums font-ui">
            {next.daysLeft} days to {next.def.title}
          </span>
        )}
      </div>

      {progress.map(p => {
        const { def } = p;
        const open = expanded === def.id;

        return (
          <div key={def.id} className={`rounded-xl border overflow-hidden transition-colors ${card} ${p.unlocked ? '' : 'opacity-90'}`}>
            <button
              onClick={() => p.unlocked && toggle(def)}
              disabled={!p.unlocked}
              className={`w-full text-left px-6 py-5 ${p.unlocked ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[9px] font-bold uppercase tracking-[0.14em] font-ui ${p.unlocked ? 'text-[#E10600]' : 'text-zinc-600'}`}>
                      Day {def.day}
                    </span>
                    {!p.unlocked && <LockIcon className="text-zinc-600" />}
                    {def.requiresVerified && (
                      <span
                        title="Only days the app timed itself count towards this one."
                        className={`text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border font-ui ${dark ? 'border-white/[0.1] text-zinc-600' : 'border-zinc-200 text-zinc-400'}`}
                      >
                        Timed days only
                      </span>
                    )}
                  </div>
                  <h4 className={`text-lg font-black uppercase tracking-tight leading-tight ${p.unlocked ? heading : 'text-zinc-500'}`}>
                    {def.title}
                  </h4>
                  <p className={`text-[11px] leading-relaxed font-ui mt-1 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    {p.unlocked ? def.tagline : def.lockedHint}
                  </p>
                </div>

                {p.unlocked ? (
                  <span className={`shrink-0 text-[8px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded border font-ui border-[#E10600]/50 text-[#E10600] bg-[#E10600]/10`}>
                    Yours
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-zinc-600 font-ui">
                    {p.current}/{def.day}
                  </span>
                )}
              </div>

              {!p.unlocked && (
                <div className={`h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                  <div
                    className="h-full bg-[#E10600] transition-all duration-700"
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
              )}

              {p.unlocked && (
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600 font-ui">
                  {open ? 'Close' : def.kind === 'wallpaper' ? 'Pick one' : def.kind === 'book' ? 'Open it' : 'Claim it'}
                </p>
              )}
            </button>

            {open && def.kind === 'wallpaper' && (
              <div className={`px-6 pb-6 pt-2 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <button
                    onClick={() => onSelectWallpaper(null)}
                    className={`rounded-lg border overflow-hidden text-left transition-all active:scale-97 ${!rewards.wallpaper ? 'border-[#E10600]' : dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}
                  >
                    <div className={`h-16 ${dark ? 'bg-[#0B0B0D]' : 'bg-[#F2F0EC]'}`} />
                    <p className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-2 font-ui ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      None
                    </p>
                  </button>

                  {WALLPAPERS.map(w => (
                    <button
                      key={w.id}
                      onClick={() => onSelectWallpaper(w.id)}
                      title={w.note}
                      className={`rounded-lg border overflow-hidden text-left transition-all active:scale-97 ${rewards.wallpaper === w.id ? 'border-[#E10600]' : dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}
                    >
                      <WallpaperLayer wallpaper={w} dark={dark} className="h-16 relative" preview />
                      <p className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-2 font-ui ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {w.name}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 font-ui mt-3">
                  {wallpaperById(rewards.wallpaper)?.note ?? 'Applies everywhere in the app, on this account.'}
                </p>
              </div>
            )}

            {open && def.kind === 'book' && (
              <div className={`px-6 pb-6 pt-4 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                <p className={`text-[13px] font-accent mb-1 ${heading}`}>{BOOK.title}</p>
                <p className="text-[11px] text-zinc-500 font-ui mb-4">
                  {BOOK.chapters.length} chapter{BOOK.chapters.length === 1 ? '' : 's'}
                  {BOOK.complete ? '' : ' · still being written'} · yours permanently
                </p>
                <button
                  onClick={onOpenBook}
                  className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
                >
                  Read
                </button>
              </div>
            )}

            {open && def.kind === 'hamper' && (
              <div className={`px-6 pb-6 pt-4 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                <ul className={`text-[12px] leading-relaxed font-ui space-y-1.5 mb-4 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <li>· A book worth owning on paper.</li>
                  <li>· A metal card, cut with your name on it.</li>
                  <li>· A note, handwritten, not printed.</li>
                </ul>
                {rewards.hamperClaimedOn ? (
                  <p className="text-[11px] text-zinc-500 font-ui">
                    Claim opened {rewards.hamperClaimedOn}. Reply to the email when it lands —
                    nothing gets shipped, and no address is asked for, until you answer.
                  </p>
                ) : (
                  <>
                    <p className={`text-[11px] leading-relaxed font-ui mb-4 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      This one is a conversation, not a form. Claiming emails us to start it.
                      Never type your address into this app — if you are under 18, the shipping
                      details come from a parent, by email, or not at all.
                    </p>
                    <a
                      href={`mailto:${CLAIM_EMAIL}?subject=${encodeURIComponent('Year One claim — 365 day streak')}&body=${encodeURIComponent(
                        'I hit a 365 day streak on Tracker Alpha.\n\n(Do not send your address yet — we will reply first.)\n',
                      )}`}
                      onClick={onClaimHamper}
                      className="inline-block px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
                    >
                      Claim
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* The honest footnote, only where it can still bite. */}
      {progress.some(p => !p.unlocked && p.def.requiresVerified) && verifiedStreak < streak && (
        <p className="text-[10px] leading-relaxed text-zinc-600 font-ui px-1">
          Streak: {streak} days. Unbroken run the app timed itself: {verifiedStreak}.
          Manual entries keep your streak alive — the book and the hamper count the timed run only.
        </p>
      )}
    </div>
  );
};

export default RewardsVault;
