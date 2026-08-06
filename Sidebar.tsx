import React, { useState } from 'react';
import { TabType } from './types';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  theme: 'dark' | 'light';
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
  }
};

const Sidebar: React.FC<Props> = ({ activeTab, onTabChange, theme }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs: TabType[] = ['Today', 'Syllabus', 'Streak', 'Questions', 'Ranks', 'Review'];
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
            onClick={() => setCollapsed(!collapsed)}
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
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                data-onboarding-target={tab === 'Syllabus' ? 'syllabus-nav' : tab === 'Streak' ? 'streak-nav' : undefined}
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
            );
          })}
        </nav>

        {/* Bottom accent */}
        <div className={`px-4 py-4 border-t ${dark ? 'border-white/[0.04]' : 'border-[#E3E0D9]'}`}>
          {!collapsed ? (
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
