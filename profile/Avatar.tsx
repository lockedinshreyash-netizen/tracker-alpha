import React from 'react';
import { AlphaAvatarGlyph, getAlphaAvatar } from './alphaAvatars';
import { ProfileSummary } from './profileApi';

/* ── The one place avatar rendering happens ──
   Every surface that shows a user — leaderboard row, chat bubble, the profile
   card itself — renders through this, so "does this user have an uploaded
   photo, an Alpha Avatar, or nothing loaded yet" is decided once, not
   reimplemented per feature. */

interface AvatarProps {
  profile: ProfileSummary | null | undefined;
  size: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ profile, size, className = '' }) => {
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

  // Covers both a resolved Alpha Avatar and "not fetched yet" — getAlphaAvatar
  // falls back to the default glyph for a null/unknown id, so a profile still
  // loading never renders as a broken image or an empty ring.
  return (
    <div className={`flex-shrink-0 ${className}`}>
      <AlphaAvatarGlyph avatar={getAlphaAvatar(profile?.avatar_id)} size={size} />
    </div>
  );
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
      <Avatar profile={profile} size={size} className="ring-1 ring-inset ring-white/10 group-hover:ring-[#E10600]/40 transition-all rounded-full" />
      <span className={nameClassName ?? defaultNameClass}>
        {name}
      </span>
    </button>
  );
};
