import React from 'react';
import { AlphaAvatarGlyph, TONES, getAlphaAvatar } from './alphaAvatars';
import { ProfileSummary } from './profileApi';

/* ── The one place avatar rendering happens ──
   Every surface that shows a user — leaderboard row, chat bubble, the profile
   card itself — renders through this, so "does this user have an uploaded
   photo, an Alpha Avatar, or nothing loaded yet" is decided once, not
   reimplemented per feature. */

/** Stable hash so the same name always lands on the same tone — a deterministic pick, not a random one that would flicker between renders. */
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * The default identity when nobody has picked an Alpha Avatar or a photo yet
 * — which, before every viewer's profile row has loaded, is most of a
 * leaderboard. A name-derived initial is legible immediately (it needs no
 * network round trip: the caller already knows the name from the leaderboard
 * row or chat message itself) and, critically, differs per person — the thing
 * a single shared placeholder glyph cannot do.
 */
export const InitialsAvatar: React.FC<{ name: string; size: number; className?: string }> = ({ name, size, className = '' }) => {
  const trimmed = name.trim();
  const letter = trimmed ? trimmed[0].toUpperCase() : '?';
  const tone = TONES[hashString(trimmed || '?') % TONES.length];
  return (
    <div
      className={`flex items-center justify-center rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: tone, color: '#F2F0EC' }}
    >
      <span className="font-ui font-black leading-none" style={{ fontSize: size * 0.42 }}>{letter}</span>
    </div>
  );
};

interface AvatarProps {
  profile: ProfileSummary | null | undefined;
  /**
   * Source of the fallback initial when there's no chosen avatar to show yet
   * — a leaderboard row or chat bubble already has this string on hand and
   * should pass it; without it, profile.display_name is used once the
   * profile itself has loaded.
   */
  name?: string;
  size: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ profile, name, size, className = '' }) => {
  if (profile?.avatar_type === 'upload' && profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (profile?.avatar_type === 'alpha' && profile.avatar_id) {
    return (
      <div className={`flex-shrink-0 ${className}`}>
        <AlphaAvatarGlyph avatar={getAlphaAvatar(profile.avatar_id)} size={size} />
      </div>
    );
  }

  // No avatar chosen, or the profile hasn't loaded yet — an initial derived
  // from whatever name is already on hand, never a generic glyph every
  // unresolved user would otherwise share.
  return <InitialsAvatar name={name ?? profile?.display_name ?? ''} size={size} className={className} />;
};

interface UserChipProps {
  userId: string;
  /** The name to print — callers keep printing whatever they already do (a Race display name, say); this only adds the avatar and the click target. */
  name: string;
  profile: ProfileSummary | null | undefined;
  onOpen: (userId: string) => void;
  size?: number;
  theme: 'dark' | 'light';
  /**
   * Full class list for the name text, colour included — a caller that needs
   * an unconditional accent (e.g. "this row is me") passes it directly rather
   * than layering it on top of a hardcoded default, since two same-specificity
   * Tailwind utilities don't reliably resolve by className order.
   */
  nameClassName?: string;
  className?: string;
}

/**
 * The clickable identity itself — never the row or message it sits in. A
 * plain button so it's reachable by keyboard and doesn't fight whatever else
 * a leaderboard row or chat bubble already does with clicks.
 */
export const UserChip: React.FC<UserChipProps> = ({
  userId, name, profile, onOpen, size = 28, theme, nameClassName, className = '',
}) => {
  const dark = theme === 'dark';
  const defaultNameClass = `truncate group-hover:text-[#E10600] transition-colors ${dark ? 'text-white' : 'text-[#17150F]'}`;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onOpen(userId); }}
      className={`inline-flex items-center gap-2 min-w-0 text-left group active:scale-[0.98] transition-transform ${className}`}
    >
      <Avatar profile={profile} name={name} size={size} className="ring-1 ring-inset ring-white/10 group-hover:ring-[#E10600]/40 transition-all rounded-full" />
      <span className={nameClassName ?? defaultNameClass}>
        {name}
      </span>
    </button>
  );
};
