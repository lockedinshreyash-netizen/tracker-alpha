import React, { Suspense, useState } from 'react';
import AnnouncementsAdmin from './AnnouncementsAdmin';
import FeedbackInbox from './FeedbackInbox';
import FounderNotesAdmin from './FounderNotesAdmin';
import AdminRoster from './AdminRoster';
import ModerationAdmin from './ModerationAdmin';
import ThemeAdmin from './ThemeAdmin';
import { STORE_LAUNCHED } from '../store/launch';

/* Lazy so the Decks data layer stays out of the main bundle. */
const DecksAdmin = React.lazy(() => import('./DecksAdmin'));
/* Lazy, and for the same reason: the store's data layer and editors. */
const StoreAdmin = React.lazy(() => import('./StoreAdmin'));
/* Lazy for the same reason: the charts are the console's alone. */
const AnalyticsAdmin = React.lazy(() => import('../analytics/AnalyticsAdmin'));

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
  /** Open an Alpha deck in the Decks tab (null: just go there). */
  onOpenDeck: (id: string | null) => void;
}

type Section = 'analytics' | 'announce' | 'theme' | 'inbox' | 'notes' | 'moderation' | 'decks' | 'store' | 'people';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'announce', label: 'Announcements' },
  { id: 'theme', label: 'Theme' },
  { id: 'inbox', label: 'Feedback' },
  // Notes to the founder, from the Support Alpha page. Not Feedback: no status, one reply.
  { id: 'notes', label: 'Notes' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'decks', label: 'Decks' },
  // The Alpha Store's console, once it launches (store/launch.ts).
  ...(STORE_LAUNCHED ? [{ id: 'store' as Section, label: 'Store' }] : []),
  { id: 'people', label: 'Administrators' },
];

/**
 * The console.
 *
 * Eight sections (nine once the store launches) behind one switch rather than tabs in the rail: the rail
 * is the student's app and this is not part of it. Anyone who is not an
 * administrator never sees this tab at all — and if they reach it anyway, every
 * query underneath returns a permission error, because none of the enforcement
 * is here.
 */
const AdminTab: React.FC<Props> = ({ adminId, theme, onOpenDeck }) => {
  const dark = theme === 'dark';
  /* Analytics first: how the app is doing is what an administrator opens the console to see. */
  const [section, setSection] = useState<Section>('analytics');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className={`text-2xl font-black uppercase tracking-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>
          Console
        </h2>
        <p className={`text-[11px] font-ui mt-1 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          How the app is doing, what goes out to everyone, and what comes back.
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

      {section === 'analytics' && <Suspense fallback={null}><AnalyticsAdmin theme={theme} /></Suspense>}
      {section === 'announce' && <AnnouncementsAdmin theme={theme} />}
      {section === 'theme' && <ThemeAdmin theme={theme} />}
      {section === 'inbox' && <FeedbackInbox adminId={adminId} theme={theme} />}
      {section === 'notes' && <FounderNotesAdmin theme={theme} />}
      {section === 'moderation' && <ModerationAdmin adminId={adminId} theme={theme} />}
      {section === 'decks' && <Suspense fallback={null}><DecksAdmin theme={theme} onOpenDeck={onOpenDeck} /></Suspense>}
      {STORE_LAUNCHED && section === 'store' && <Suspense fallback={null}><StoreAdmin adminId={adminId} theme={theme} onOpenDeck={onOpenDeck} /></Suspense>}
      {section === 'people' && <AdminRoster adminId={adminId} theme={theme} />}
    </div>
  );
};

export default AdminTab;
