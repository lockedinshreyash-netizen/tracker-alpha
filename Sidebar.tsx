import React, { useState } from 'react';
import { TabType } from './types';
import { Avatar } from './profile/Avatar';
import { Profile } from './profile/profileApi';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  theme: 'dark' | 'light';
  /* Collapsing is owned by App: the rail is fixed, so the page beside it has
     to move its own margin in step or the app sits stranded to the right of a
     gap the size of the old sidebar. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /* Whether to draw the staff console in the rail. Server-derived (see
     admin/useAdmin), and NOT a permission — forcing it true here gets you a
     tab whose every query the database refuses. */
  isAdmin: boolean;
  /* Null until signed in and ensure_profile() resolves — the account row
     falls back to the plain "Tracker Alpha" footer until then. */
  ownProfile: Profile | null;
  onOpenAccount: () => void;
}

/* ── Clean SVG icons — 18×18, stroke-based, modern ── */
const TabIcon: React.FC<{ tab: TabType; className?: string }> = ({ tab, className = '' }) => {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className };

  switch (tab) {
    case 'Today':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'Plan':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="13" x2="14" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      );
    case 'Syllabus':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="9" y1="7" x2="16" y2="7" />
          <line x1="9" y1="11" x2="14" y2="11" />
        </svg>
      );
    case 'Streak':
      return (
        <svg {...props}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'Questions':
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'Ranks':
      return (
        <svg {...props}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M6 4h12v5a6 6 0 0 1-12 0V4z" />
          <line x1="12" y1="15" x2="12" y2="18" />
          <path d="M8.5 21h7l-.5-3h-6l-.5 3z" />
        </svg>
      );
    case 'Review':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    /* A subject inscribed in a circle with the construction lines left in —
       the Vitruvian method rather than the picture, and the only icon here
       that is a diagram rather than a pictogram. It should not look like the
       others; the room it opens is not like the others. */
    case 'Observatory':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" strokeWidth={0.9} />
          <line x1="3" y1="12" x2="21" y2="12" strokeWidth={0.9} />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    /* A key. Nothing about the study loop, and it should not pretend to be. */
    case 'Admin':
      return (
        <svg {...props}>
          <circle cx="8" cy="15" r="4" />
          <path d="M10.8 12.2 20 3" />
          <path d="M17 6l2.5 2.5" />
          <path d="M14.5 8.5 17 11" />
        </svg>
      );
  }
};

const Sidebar: React.FC<Props> = ({ activeTab, onTabChange, theme, collapsed, onToggleCollapsed, isAdmin, ownProfile, onOpenAccount }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Appended, never inserted: the eight the student uses keep the positions
     their muscle memory knows, and the console arrives at the bottom. */
  const tabs: TabType[] = [
    'Today', 'Plan', 'Syllabus', 'Streak', 'Questions', 'Ranks', 'Review', 'Observatory',
    ...(isAdmin ? (['Admin'] as TabType[]) : []),
  ];
  const dark = theme === 'dark';

  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className={`md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b backdrop-blur-xl ${dark ? 'bg-[#0B0B0D]/90 border-white/[0.04]' : 'bg-white/90 border-[#E3E0D9]'}`}>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          data-onboarding-mobile-menu="toggle"
          className={`p-2 rounded-md transition-all ${dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-[#6B675C] hover:text-[#17150F] hover:bg-[#F2F0EC]'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] font-ui ${dark ? 'text-zinc-400' : 'text-[#6B675C]'}`}>
          {activeTab}
        </span>
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-out
          ${dark ? 'bg-[#0B0B0D] border-r border-white/[0.04]' : 'bg-white border-r border-[#E3E0D9]'}
          ${collapsed ? 'w-[60px]' : 'w-[200px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo + Collapse Toggle */}
        <div className={`flex items-center h-16 px-4 border-b ${dark ? 'border-white/[0.04]' : 'border-[#E3E0D9]'}`}>
          {!collapsed && (
            <span className={`text-sm logo-text flex-1 ${dark ? 'text-white' : 'text-[#17150F]'}`}>
              LOCK IN
            </span>
          )}
          <button
            onClick={onToggleCollapsed}
            className={`hidden md:flex p-1.5 rounded-md transition-all ${collapsed ? 'mx-auto' : ''} ${dark ? 'text-zinc-500 hover:text-white hover:bg-zinc-800' : 'text-[#8A8577] hover:text-[#17150F] hover:bg-[#F2F0EC]'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              ) : (
                <><polyline points="15 18 9 12 15 6" /></>
              )}
            </svg>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-1 px-2 py-4">
          {tabs.map(tab => {
            const isActive = activeTab === tab;
            return (
              <React.Fragment key={tab}>
              {/* A rule above the Observatory, and above the console for an
                  administrator. The seven at the top are places you go to do
                  something; the Observatory is the room you step into to look
                  at what all of it added up to, and the console is not part of
                  the student's app at all. Both deserve saying before the
                  click. */}
              {(tab === 'Observatory' || tab === 'Admin') && (
                <div
                  className={`my-2 ${collapsed ? 'mx-3' : 'mx-4'}`}
                  style={{ height: 1, background: dark ? 'rgba(255,255,255,.07)' : '#E3E0D9' }}
                  aria-hidden="true"
                />
              )}
              <button
                onClick={() => handleTabClick(tab)}
                data-onboarding-target={tab === 'Syllabus' ? 'syllabus-nav' : tab === 'Streak' ? 'streak-nav' : tab === 'Plan' ? 'plan-nav' : undefined}
                className={`flex items-center gap-3 rounded-lg transition-all duration-200 group relative
                  ${collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}
                  ${isActive
                    ? (dark ? 'bg-white/[0.04] text-white' : 'bg-[#F2F0EC] text-[#17150F]')
                    : (dark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]' : 'text-[#8A8577] hover:text-[#17150F] hover:bg-[#F2F0EC]')
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full ${dark ? 'bg-zinc-400' : 'bg-[#E10600]'}`} />
                )}

                <TabIcon tab={tab} className="flex-shrink-0" />

                {!collapsed && (
                  <span className={`text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap font-ui ${isActive ? (dark ? 'text-white' : 'text-[#17150F]') : ''}`}>
                    {tab}
                  </span>
                )}

                {/* Tooltip on collapsed */}
                {collapsed && (
                  <div className={`absolute left-full ml-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-ui ${dark ? 'bg-zinc-800 text-white' : 'bg-[#17150F] text-[#F2F0EC]'}`}>
                    {tab}
                  </div>
                )}
              </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Account — the one entry point that opens straight into editing
            rather than the public card RanksTab/RaceChat open on someone
            else's identity; see profile/EditProfile.tsx. Falls back to the
            plain footer until there's a profile to show. */}
        <div className={`px-4 py-4 border-t ${dark ? 'border-white/[0.04]' : 'border-[#E3E0D9]'}`}>
          {ownProfile ? (
            <button
              onClick={onOpenAccount}
              data-onboarding-target="account-nav"
              className={`w-full flex items-center gap-2.5 rounded-lg transition-all group relative ${collapsed ? 'justify-center py-1' : 'px-1 py-1'} ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-[#F2F0EC]'}`}
            >
              <Avatar
                profile={ownProfile}
                size={28}
                className="ring-1 ring-inset ring-white/10 rounded-full flex-shrink-0"
              />
              {!collapsed && (
                <span className={`text-[11px] font-bold font-ui truncate ${dark ? 'text-white' : 'text-[#17150F]'}`}>
                  {ownProfile.display_name}
                </span>
              )}
              {collapsed && (
                <div className={`absolute left-full ml-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-ui ${dark ? 'bg-zinc-800 text-white' : 'bg-[#17150F] text-[#F2F0EC]'}`}>
                  {ownProfile.display_name}
                </div>
              )}
            </button>
          ) : !collapsed ? (
            <p className={`text-[8px] font-medium uppercase tracking-[0.06em] ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>
              Tracker Alpha
            </p>
          ) : (
            <div className={`w-2 h-2 rounded-full mx-auto ${dark ? 'bg-zinc-700' : 'bg-[#D6D1C5]'}`} />
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
