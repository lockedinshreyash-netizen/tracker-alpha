import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { ALPHA_AVATARS, AlphaAvatarGlyph } from './alphaAvatars';
import { setCachedProfile } from './profileCache';
import {
  AvatarType,
  MAX_BIO,
  MAX_NAME,
  Profile,
  humanError,
  updateProfile,
  uploadAvatar,
  validateAvatarFile,
  validateBio,
  validateDisplayName,
} from './profileApi';

/* ── Edit Profile ──
   Same modal shell AuthModal uses. Picking a new photo previews instantly
   from a local object URL and uploads nothing yet — the actual Storage write
   (and the profiles row update) happens once, on Save, so cancelling this
   sheet never leaves an orphaned file behind. */

interface Props {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
  theme: 'dark' | 'light';
}

const EditProfile: React.FC<Props> = ({ profile, onClose, onSaved, theme }) => {
  const dark = theme === 'dark';
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarType, setAvatarType] = useState<AvatarType>(profile.avatar_type);
  const [avatarId, setAvatarId] = useState<string | null>(profile.avatar_id);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const heading = dark ? 'text-white' : 'text-[#17150F]';
  const inputClass = `w-full rounded-md px-3 py-2.5 text-sm font-ui border outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#18181b] border-[#27272a] text-white placeholder:text-zinc-700' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0]'}`;

  const draftPreview: Profile = {
    ...profile,
    avatar_type: avatarType,
    avatar_id: avatarType === 'alpha' ? avatarId : null,
    avatar_url: avatarType === 'upload' ? (previewUrl ?? profile.avatar_url) : null,
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    const issue = validateAvatarFile(file);
    if (issue) { setError(issue); return; }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setAvatarType('upload');
  };

  const chooseAlpha = (id: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setAvatarType('alpha');
    setAvatarId(id);
  };

  const handleSave = async () => {
    const name = validateDisplayName(displayName);
    const cleanBio = validateBio(bio);
    if (!name) { setError(`Display name must be 2–${MAX_NAME} characters.`); return; }
    if (cleanBio === null) { setError(`Bio must be ${MAX_BIO} characters or fewer.`); return; }

    setSaving(true);
    setError(null);
    try {
      let finalUrl = avatarType === 'upload' ? profile.avatar_url : null;
      if (avatarType === 'upload' && pendingFile) {
        finalUrl = await uploadAvatar(profile.user_id, pendingFile);
      }
      const saved = await updateProfile(profile.user_id, {
        display_name: name,
        bio: cleanBio,
        avatar_type: avatarType,
        avatar_id: avatarType === 'alpha' ? avatarId : null,
        avatar_url: finalUrl,
      });
      setCachedProfile(saved);
      onSaved(saved);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6">
      <div className={`w-full max-w-sm rounded-xl border p-6 space-y-5 max-h-full overflow-y-auto ${dark ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-[#E3E0D9]'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-ui">Account</h2>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-[0.06em] ${dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-[#8A8577] hover:text-[#17150F]'}`}
          >
            Close
          </button>
        </div>

        {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}

        <div className="flex justify-center">
          <Avatar profile={draftPreview} size={84} className="ring-2 ring-inset ring-white/10 rounded-full" />
        </div>

        {/* Static for now — there's no billing system yet, so this is a
            placeholder every account reads as "Free member" until a real
            premium tier exists to check. */}
        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-md border ${dark ? 'bg-[#18181b] border-[#27272a]' : 'bg-[#F2F0EC] border-[#E3E0D9]'}`}>
          <span className={`text-[9px] font-black uppercase tracking-[0.14em] font-ui ${muted}`}>Membership</span>
          <span className={`text-[9px] font-black uppercase tracking-[0.12em] font-ui px-2.5 py-1 rounded ${dark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-[#6B675C]'}`}>
            Free member
          </span>
        </div>

        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${muted}`}>Profile picture</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-2.5 rounded-md border text-[10px] font-bold uppercase tracking-[0.1em] font-ui transition-all ${avatarType === 'upload'
              ? 'border-[#E10600] text-[#E10600]'
              : dark ? 'border-[#27272a] text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-[#6B675C] hover:text-[#17150F]'}`}
          >
            {avatarType === 'upload' ? 'Photo selected · Change' : 'Upload a photo'}
          </button>

          <p className={`text-[9px] font-bold uppercase tracking-[0.14em] mt-4 mb-2 font-ui ${muted}`}>Or choose an Alpha Avatar</p>
          <div className="grid grid-cols-4 gap-2.5">
            {ALPHA_AVATARS.map(a => {
              const selected = avatarType === 'alpha' && avatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => chooseAlpha(a.id)}
                  title={a.name}
                  className={`rounded-full transition-all active:scale-[0.94] ring-2 ring-inset ${selected ? 'ring-[#E10600]' : 'ring-transparent hover:ring-white/20'}`}
                >
                  <AlphaAvatarGlyph avatar={a} size={52} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={`block text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${muted}`}>Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="What should we call you?"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`text-[9px] font-black uppercase tracking-[0.14em] font-ui ${muted}`}>Bio</label>
            <span className={`text-[9px] font-ui ${muted}`}>{bio.length}/{MAX_BIO}</span>
          </div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
            rows={3}
            placeholder="Building. Studying. Shipping."
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full py-3 rounded-md bg-[#E10600] text-white text-[10px] font-bold uppercase tracking-[0.15em] font-ui hover:bg-red-700 disabled:opacity-60 transition-all active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default EditProfile;
