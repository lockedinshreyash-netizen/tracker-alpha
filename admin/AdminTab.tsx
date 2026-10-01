import React, { useState } from 'react';
import AnnouncementsAdmin from './AnnouncementsAdmin';
import FeedbackInbox from './FeedbackInbox';
import AdminRoster from './AdminRoster';
import ModerationAdmin from './ModerationAdmin';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
}

type Section = 'announce' | 'inbox' | 'moderation' | 'people';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'announce', label: 'Announcements' },
  { id: 'inbox', label: 'Feedback' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'people', label: 'Administrators' },
];

/**
 * The console.
 *
 * Four sections behind one switch rather than three tabs in the rail: the rail
 * is the student's app and this is not part of it. Anyone who is not an
 * administrator never sees this tab at all — and if they reach it anyway, every
 * query underneath returns a permission error, because none of the enforcement
 * is here.
 */
const AdminTab: React.FC<Props> = ({ adminId, theme }) => {
  const dark = theme === 'dark';
  const [section, setSection] = useState<Section>('announce');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className={`text-2xl font-black uppercase tracking-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>
          Console
        </h2>
        <p className={`text-[11px] font-ui mt-1 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          What goes out to everyone, and what comes back.
        </p>
      </div>

      <div className={`inline-flex max-w-full overflow-x-auto p-1 rounded-lg border ${dark ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-200 bg-white'}`}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`shrink-0 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-all font-ui ${section === s.id
              ? 'bg-[#E10600] text-white'
              : dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'announce' && <AnnouncementsAdmin theme={theme} />}
      {section === 'inbox' && <FeedbackInbox adminId={adminId} theme={theme} />}
      {section === 'moderation' && <ModerationAdmin adminId={adminId} theme={theme} />}
      {section === 'people' && <AdminRoster adminId={adminId} theme={theme} />}
    </div>
  );
};

export default AdminTab;
