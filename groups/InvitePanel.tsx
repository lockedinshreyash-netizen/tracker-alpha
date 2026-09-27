/* ── "You're invited" ──
   One component for both ways an invite arrives — a link that opened the app,
   or a code typed into the Join sheet — so the one decision it asks for is
   asked the same way both times: do you show your hours to these people?

   That switch is on by default and it is on screen, not buried: a study group
   whose board is empty is not a study group, and the person joining can see
   exactly what they are agreeing to before they tap Join. Tasks sit right
   under it, starting private: offered, visible, never assumed. */

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { INVITE_STATUS_COPY, InvitePreview, formatInviteCode, humanError, previewInvite, redeemInvite, TaskShareLevel, setSharing } from './api';
import { Eyebrow, GroupIcon, btn, tokens } from './ui';
import SharingFields from './SharingFields';

interface Props {
  code: string;
  user: User | null;
  onJoined: (groupId: string) => void;
  onDismiss: () => void;
  onOpenAuth: () => void;
  theme: 'dark' | 'light';
  /** Rendered inside a sheet that has its own frame. */
  bare?: boolean;
}

const InvitePanel: React.FC<Props> = ({ code, user, onJoined, onDismiss, onOpenAuth, theme, bare }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareHours, setShareHours] = useState(true);
  const [shareTasks, setShareTasks] = useState<TaskShareLevel>('private');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    previewInvite(code)
      .then(p => { if (!cancelled) setPreview(p); })
      .catch(e => { if (!cancelled) setError(humanError(e)); });
    return () => { cancelled = true; };
  }, [code, user]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await redeemInvite(code, shareHours);
      /* Only on a fresh join: someone re-opening a link to a group they are
         already in must not have their existing choice overwritten from here.
         Same second-call reasoning as CreateGroupSheet. */
      if (result.status === 'joined' && result.group_id && shareTasks !== 'private') {
        await setSharing(result.group_id, shareHours, shareTasks).catch(() => {});
      }
      if ((result.status === 'joined' || result.status === 'member') && result.group_id) {
        onJoined(result.group_id);
        return;
      }
      setPreview(result);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setJoining(false);
    }
  };

  const frame = bare ? '' : `p-6 md:p-8 rounded-xl border ${t.card} border-l-2 border-l-[#E10600]`;
  const dismiss = (
    <button onClick={onDismiss} className={`text-[10px] font-black uppercase tracking-[0.12em] font-ui ${t.muted} hover:text-[#E10600]`}>
      Dismiss
    </button>
  );

  /* Signed out: the preview RPC is for signed-in callers only, so there is
     nothing to show yet but the fact of the invite. The code waits in storage
     through sign-up and onboarding (groups/invite.ts). */
  if (!user) {
    return (
      <section className={frame}>
        <Eyebrow dark={dark}>You’ve been invited</Eyebrow>
        <p className={`text-sm font-ui mt-3 leading-relaxed ${t.body}`}>
          Someone wants you in their study group. Sign in or create an account and it’ll be waiting for you.
        </p>
        <p className={`text-[11px] font-data mt-3 tracking-[0.2em] ${t.muted}`}>{formatInviteCode(code)}</p>
        <div className="flex items-center gap-5 mt-6">
          <button onClick={onOpenAuth} className={`px-8 py-3.5 ${btn} ${t.primary}`}>Sign in to join</button>
          {dismiss}
        </div>
      </section>
    );
  }

  if (!preview && !error) {
    return (
      <section className={frame} aria-busy="true">
        <Eyebrow dark={dark}>Checking invite…</Eyebrow>
        <div className={`h-14 mt-4 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} />
      </section>
    );
  }

  if (error || !preview || (preview.status !== 'ok' && preview.status !== 'member')) {
    return (
      <section className={frame}>
        <Eyebrow dark={dark}>Invite</Eyebrow>
        <p className={`text-sm font-ui mt-3 leading-relaxed ${t.body}`}>
          {error ?? (preview && INVITE_STATUS_COPY[preview.status]) ?? 'This invite doesn’t work.'}
        </p>
        <div className="mt-5">{dismiss}</div>
      </section>
    );
  }

  if (preview.status === 'member' && preview.group_id) {
    const gid = preview.group_id;
    return (
      <section className={frame}>
        <Eyebrow dark={dark}>Invite</Eyebrow>
        <p className={`text-sm font-ui mt-3 ${t.body}`}>You’re already in this group.</p>
        <div className="flex items-center gap-5 mt-5">
          <button onClick={() => onJoined(gid)} className={`px-8 py-3.5 ${btn} ${t.secondary}`}>Open it</button>
          {dismiss}
        </div>
      </section>
    );
  }

  const g = preview.group!;
  return (
    <section className={frame}>
      <Eyebrow dark={dark}>You’ve been invited to</Eyebrow>
      <div className="flex items-center gap-4 mt-4">
        <GroupIcon icon={g.icon} name={g.name} size={52} dark={dark} />
        <div className="min-w-0">
          <p className={`text-lg font-black uppercase tracking-tight font-ui truncate ${t.heading}`}>{g.name}</p>
          <p className={`text-[11px] font-ui ${t.muted}`}>
            {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>
      {g.description && <p className={`text-[12px] font-ui mt-4 leading-relaxed ${t.muted}`}>{g.description}</p>}

      <div className={`mt-6 pt-5 border-t ${t.rule}`}>
        <Eyebrow dark={dark} className="mb-4">What other members will see · you can change this later</Eyebrow>
        <SharingFields
          shareHours={shareHours}
          shareTasks={shareTasks}
          onChange={(h, tk) => { setShareHours(h); setShareTasks(tk); }}
          dark={dark}
          disabled={joining}
        />
      </div>

      <div className="flex items-center gap-5 mt-6">
        <button onClick={() => void join()} disabled={joining} className={`flex-1 md:flex-none px-10 py-4 ${btn} ${joining ? t.disabled : t.primary}`}>
          {joining ? 'Joining…' : 'Join group'}
        </button>
        {dismiss}
      </div>
    </section>
  );
};

export default InvitePanel;
