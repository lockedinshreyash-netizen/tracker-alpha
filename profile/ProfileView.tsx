import React, { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { Profile, fetchProfileByHandle, fetchProfileByUserId, fetchTotalHours, humanError } from './profileApi';
import { formatGap } from '../leaderboard/engine';

/* ── Profile views ──
   One presentational card (ProfileCard), two shells around it: a compact
   ProfileModal for the click-from-a-leaderboard-row/chat-bubble case, and a
   full ProfilePage for the canonical /u/:handle URL. Neither shell computes
   anything the other doesn't — they only differ in chrome, exactly the
   architecture the brief suggests. */

const DOCUMENT_TITLE = 'Tracker Alpha — Free JEE 2027 Study Tracker';

const formatMemberSince = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

interface LookupState {
  profile: Profile | null;
  totalHours: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Shared by the modal (looks up by user id) and the page (looks up by
 * handle) — fetches the profile, then the one stat it shows, in that order.
 *
 * The RPC-fetched total is skipped entirely when the profile turns out to be
 * the viewer's own — see ProfileModal/ProfilePage, which use `ownTotalHours`
 * (every logged hour on this device, not just the app-timed subset the RPC
 * can see for anyone else) instead. Fetching a number nobody will render
 * would be the exact "unnecessary duplicate request" this app avoids
 * elsewhere.
 */
const useProfileLookup = (
  lookup: () => Promise<Profile | null>,
  dep: string | null,
  currentUserId: string | null
): LookupState => {
  const [state, setState] = useState<LookupState>({ profile: null, totalHours: null, loading: true, error: null });

  useEffect(() => {
    if (!dep) { setState({ profile: null, totalHours: null, loading: false, error: null }); return; }
    let cancelled = false;
    setState({ profile: null, totalHours: null, loading: true, error: null });

    (async () => {
      try {
        const profile = await lookup();
        if (cancelled) return;
        if (!profile) { setState({ profile: null, totalHours: null, loading: false, error: null }); return; }
        const totalHours = profile.user_id === currentUserId
          ? null
          : await fetchTotalHours(profile.user_id).catch(() => 0);
        if (cancelled) return;
        setState({ profile, totalHours, loading: false, error: null });
      } catch (e) {
        if (!cancelled) setState({ profile: null, totalHours: null, loading: false, error: humanError(e) });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep, currentUserId]);

  return state;
};

interface CardProps {
  profile: Profile;
  totalHours: number | null;
  isOwn: boolean;
  onEdit?: () => void;
  theme: 'dark' | 'light';
  compact?: boolean;
}

export const ProfileCard: React.FC<CardProps> = ({ profile, totalHours, isOwn, onEdit, theme, compact }) => {
  const dark = theme === 'dark';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const heading = dark ? 'text-white' : 'text-[#17150F]';
  const inset = dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-[#F2F0EC] border-[#E3E0D9]';

  return (
    <div className="flex flex-col items-center text-center">
      <Avatar profile={profile} size={compact ? 84 : 108} className="ring-2 ring-inset ring-white/10 rounded-full" />
      <h2 className={`mt-4 text-xl md:text-2xl font-black font-ui ${heading}`}>{profile.display_name}</h2>

      {profile.bio && (
        <p className={`mt-2 text-[12px] font-ui italic leading-relaxed max-w-xs ${dark ? 'text-zinc-400' : 'text-[#6B675C]'}`}>
          &ldquo;{profile.bio}&rdquo;
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 w-full mt-6">
        <div className={`px-3 py-3 rounded-lg border ${inset}`}>
          <p className={`text-[8px] font-bold uppercase tracking-[0.12em] font-ui ${muted}`}>Total studied</p>
          <p className={`num-stat text-base mt-1 ${heading}`}>
            {totalHours === null ? '—' : formatGap(Math.round(totalHours * 60))}
          </p>
        </div>
        <div className={`px-3 py-3 rounded-lg border ${inset}`}>
          <p className={`text-[8px] font-bold uppercase tracking-[0.12em] font-ui ${muted}`}>Member since</p>
          <p className={`text-[11px] font-bold font-ui mt-1.5 ${heading}`}>{formatMemberSince(profile.created_at)}</p>
        </div>
      </div>

      {isOwn && onEdit && (
        <button
          onClick={onEdit}
          className={`mt-6 w-full py-3 rounded-lg font-black uppercase tracking-[0.14em] text-[10px] font-ui transition-all active:scale-[0.98] ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
        >
          Edit profile
        </button>
      )}
    </div>
  );
};

const LookupStatus: React.FC<{ loading: boolean; error: string | null; found: boolean; theme: 'dark' | 'light'; padY: string }> = ({
  loading, error, found, theme, padY,
}) => {
  if (loading || error || !found) {
    const dark = theme === 'dark';
    return (
      <p className={`text-[11px] font-ui text-center ${padY} ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
        {loading ? 'Loading…' : error ?? 'This profile isn’t available.'}
      </p>
    );
  }
  return null;
};

interface ModalProps {
  /** The user whose profile to show, or null to render nothing (kept mounted so the close transition — none, today — has somewhere to hook in later). */
  userId: string | null;
  onClose: () => void;
  onViewFull: (handle: string) => void;
  onEdit: () => void;
  currentUserId: string | null;
  /** This device's true cumulative hours — every logged session, any source. Shown only when the profile being viewed turns out to be the viewer's own. */
  ownTotalHours: number;
  theme: 'dark' | 'light';
}

export const ProfileModal: React.FC<ModalProps> = ({ userId, onClose, onViewFull, onEdit, currentUserId, ownTotalHours, theme }) => {
  const dark = theme === 'dark';
  const { profile, totalHours, loading, error } = useProfileLookup(
    () => (userId ? fetchProfileByUserId(userId) : Promise.resolve(null)),
    userId,
    currentUserId
  );
  const isOwn = Boolean(profile && profile.user_id === currentUserId);
  const displayHours = isOwn ? ownTotalHours : totalHours;

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl border p-6 max-h-full overflow-y-auto ${dark ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-[#E3E0D9]'}`}
      >
        <div className="flex items-center justify-between mb-5">
          <span className={`text-[10px] font-black uppercase tracking-[0.18em] font-ui ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
            Profile
          </span>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-[0.06em] ${dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-[#8A8577] hover:text-[#17150F]'}`}
          >
            Close
          </button>
        </div>

        <LookupStatus loading={loading} error={error} found={Boolean(profile)} theme={theme} padY="py-10" />

        {!loading && profile && (
          <>
            <ProfileCard
              profile={profile}
              totalHours={displayHours}
              isOwn={isOwn}
              onEdit={() => { onClose(); onEdit(); }}
              theme={theme}
              compact
            />
            <button
              onClick={() => onViewFull(profile.handle)}
              className={`w-full mt-4 text-[10px] font-bold uppercase tracking-[0.1em] font-ui ${dark ? 'text-zinc-500 hover:text-white' : 'text-[#8A8577] hover:text-[#17150F]'}`}
            >
              View full profile →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface PageProps {
  handle: string;
  currentUserId: string | null;
  /** This device's true cumulative hours — every logged session, any source. Shown only when the profile being viewed turns out to be the viewer's own. */
  ownTotalHours: number;
  onBack: () => void;
  onEdit: () => void;
  theme: 'dark' | 'light';
}

export const ProfilePage: React.FC<PageProps> = ({ handle, currentUserId, ownTotalHours, onBack, onEdit, theme }) => {
  const dark = theme === 'dark';
  const { profile, totalHours, loading, error } = useProfileLookup(() => fetchProfileByHandle(handle), handle, currentUserId);
  const isOwn = Boolean(profile && profile.user_id === currentUserId);
  const displayHours = isOwn ? ownTotalHours : totalHours;

  useEffect(() => {
    if (profile) document.title = `${profile.display_name} · Tracker Alpha`;
    return () => { document.title = DOCUMENT_TITLE; };
  }, [profile]);

  return (
    <div className="max-w-sm mx-auto px-4 py-10 md:py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className={`text-[10px] font-black uppercase tracking-[0.14em] font-ui mb-6 ${dark ? 'text-zinc-500 hover:text-white' : 'text-[#8A8577] hover:text-[#17150F]'}`}
      >
        ← Back
      </button>

      <div className={`rounded-xl border p-8 ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
        <LookupStatus loading={loading} error={error} found={Boolean(profile)} theme={theme} padY="py-16" />
        {!loading && profile && (
          <ProfileCard
            profile={profile}
            totalHours={displayHours}
            isOwn={isOwn}
            onEdit={onEdit}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
};
