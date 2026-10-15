/* ── Your profile, and saving it ──
   The builder asks for a name, an Alpha Avatar and an optional one-line bio,
   and shows the student
   exactly how they will appear: as a row in the Ranks race and as a message
   in a group chat, drawn live from what they type. Then Save offers one way
   to keep it, Google, or carrying on as a guest.

   Nothing here writes to the server. The choice is held as a draft
   (profile/draft.ts) and written to the student's profile when there is an
   account to write it to. Photos come later, from Edit profile: an upload
   needs an account to own it. */

import React from 'react';
import * as sfx from '../audio';
import { AlphaAvatarGlyph, ALPHA_AVATARS, getAlphaAvatar } from '../profile/alphaAvatars';
import { MAX_BIO, MAX_NAME, validateDisplayName } from '../profile/profileApi';
import { Eyebrow, Glass, haptic, Rise } from './kit';

export interface ProfilePick {
  name: string;
  avatarId: string;
  /** Optional, one line. Empty means none. */
  bio: string;
}

const Badge: React.FC<{ id: string; size: number }> = ({ id, size }) => (
  <AlphaAvatarGlyph avatar={getAlphaAvatar(id)} size={size} />
);

/* ── Previews ── */

const shown = (name: string) => name.trim().replace(/\s+/g, ' ') || 'Your name';

/** Your row in today's race, between two others. Red is yours, as on Ranks. */
const RanksPreview: React.FC<{ p: ProfilePick }> = ({ p }) => (
  <div className="ob-pv">
    <span className="ob-pv-label">In Ranks</span>
    <div className="ob-pv-race">
      <div className="ob-pv-row dim"><b>3</b><span className="ob-pv-ghost" /><span className="ob-pv-name">Aarav</span><span className="ob-pv-h">4h 10m</span></div>
      <div className="ob-pv-row me">
        <b>4</b>
        <Badge id={p.avatarId} size={30} />
        <span className="ob-pv-name">{shown(p.name)}</span>
        <span className="ob-pv-h">3h 45m</span>
      </div>
      <div className="ob-pv-row dim"><b>5</b><span className="ob-pv-ghost" /><span className="ob-pv-name">Meera</span><span className="ob-pv-h">3h 20m</span></div>
    </div>
  </div>
);

/** Your profile card, which is where the bio lives. */
const CardPreview: React.FC<{ p: ProfilePick }> = ({ p }) => (
  <div className="ob-pv">
    <span className="ob-pv-label">On your profile</span>
    <div className="ob-pv-card-row">
      <Badge id={p.avatarId} size={40} />
      <div style={{ minWidth: 0 }}>
        <span className="ob-pv-sender" style={{ fontSize: 14, color: 'var(--ob-ink)', margin: 0 }}>{shown(p.name)}</span>
        <span className={p.bio.trim() ? 'ob-pv-bio' : 'ob-pv-bio empty'}>
          {p.bio.trim() ? `“${p.bio.trim()}”` : 'Your bio shows here.'}
        </span>
      </div>
    </div>
  </div>
);

/** Your message in a group chat. */
const GroupsPreview: React.FC<{ p: ProfilePick }> = ({ p }) => (
  <div className="ob-pv">
    <span className="ob-pv-label">In Groups</span>
    <div className="ob-pv-chat">
      <Badge id={p.avatarId} size={30} />
      <div style={{ minWidth: 0 }}>
        <span className="ob-pv-sender">{shown(p.name)}</span>
        <span className="ob-pv-bubble">Done with Physics for today. Chemistry next.</span>
      </div>
    </div>
  </div>
);

/* ── The builder ── */

export const ProfileBuilder: React.FC<{
  pick: ProfilePick;
  onChange: (p: ProfilePick) => void;
  onNext: () => void;
}> = ({ pick, onChange, onNext }) => {
  const valid = validateDisplayName(pick.name) !== null;
  return (
    <div className="ob-col">
      <Eyebrow>Your profile</Eyebrow>
      <h1 className="ob-h1"><Rise text="How others *see you.*" delay={80} /></h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>
        Your name and badge in Ranks and your study groups. Your bio sits on your profile.
      </p>

      <div className="ob-fade" style={{ animationDelay: '320ms', marginTop: 22 }}>
        <label className="ob-field">
          <span>Name</span>
          <input
            value={pick.name}
            maxLength={MAX_NAME}
            placeholder="What should we call you?"
            autoComplete="nickname"
            enterKeyHint="done"
            onChange={e => onChange({ ...pick, name: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        </label>
      </div>

      <div className="ob-fade" style={{ animationDelay: '350ms', marginTop: 18 }}>
        <label className="ob-field">
          <span className="ob-field-row">
            <span>Bio <i>optional</i></span>
            <span className="ob-field-count" aria-hidden="true">{pick.bio.length}/{MAX_BIO}</span>
          </span>
          <textarea
            value={pick.bio}
            maxLength={MAX_BIO}
            rows={2}
            placeholder="One line about you. Like “JEE 27. Physics first.”"
            enterKeyHint="done"
            onChange={e => onChange({ ...pick, bio: e.target.value.replace(/\s*\n\s*/g, ' ') })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
          />
        </label>
      </div>

      <div className="ob-fade" style={{ animationDelay: '380ms', marginTop: 18 }}>
        <span className="ob-field-label">Badge</span>
        <div className="ob-badges" role="radiogroup" aria-label="Badge">
          {ALPHA_AVATARS.map(a => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={pick.avatarId === a.id}
              aria-label={a.name}
              className="ob-badge"
              onClick={() => { sfx.select(); haptic.select(); onChange({ ...pick, avatarId: a.id }); }}
            >
              <AlphaAvatarGlyph avatar={a} size={44} />
            </button>
          ))}
        </div>
      </div>

      <div className="ob-fade ob-previews" style={{ animationDelay: '440ms' }}>
        <Glass radius={20} className="ob-pv-card ob-pv-wide"><CardPreview p={pick} /></Glass>
        <Glass radius={20} className="ob-pv-card"><RanksPreview p={pick} /></Glass>
        <Glass radius={20} className="ob-pv-card"><GroupsPreview p={pick} /></Glass>
      </div>

      <div className="ob-actions">
        <button className="ob-primary" disabled={!valid} onClick={() => { sfx.select(); haptic.select(); onNext(); }}>
          {valid ? 'Looks good' : 'Add your name'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ob-faint)' }}>Add a photo later from your profile.</p>
      </div>
    </div>
  );
};

/* ── Saving it ── */

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const SaveProfile: React.FC<{
  pick: ProfilePick;
  busy: boolean;
  error: string | null;
  onGoogle: () => void;
  onGuest: () => void;
}> = ({ pick, busy, error, onGoogle, onGuest }) => (
  <div className="ob-col">
    <Eyebrow>Save it</Eyebrow>
    <h1 className="ob-h1"><Rise text="Save your *profile.*" delay={80} /></h1>
    <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>
      Sign in to show up in Ranks and Groups. Your progress stays safe on every device.
    </p>

    <div className="ob-fade" style={{ animationDelay: '340ms', marginTop: 26 }}>
      <Glass radius={22} className="ob-save-card">
        <Badge id={pick.avatarId} size={56} />
        <span style={{ minWidth: 0 }}>
          <b style={{ display: 'block' }}>{shown(pick.name)}</b>
          <span style={{ display: 'block' }}>Ranks · Groups · sync</span>
        </span>
      </Glass>
    </div>

    <div className="ob-actions">
      {error && <p className="ob-warn" role="alert">{error}</p>}
      <button className="ob-light" disabled={busy} onClick={() => { haptic.select(); sfx.select(); onGoogle(); }}>
        <GoogleMark /> {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <button className="ob-ghost" disabled={busy} onClick={() => { sfx.select(); onGuest(); }}>Continue as guest</button>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ob-faint)' }}>As a guest, everything stays on this device. Sign in any time.</p>
    </div>
  </div>
);
