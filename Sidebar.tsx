import React, { useState } from 'react';
import { TabType } from '../types';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isLockInActive: boolean;
  theme: 'dark' | 'light';
}

const TAB_ICONS: Record<TabType, string> = {
  Today: '⚡',
  Syllabus: '📚',
  Streak: '🔥',
  Questions: '✏️',
  Review: '📊',
};

const Sidebar: React.FC<Props> = ({ activeTab, onTabChange, isLockInActive, theme }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLockInActive) return null;

  const tabs: TabType[] = ['Today', 'Syllabus', 'Streak', 'Questions', 'Review'];
  const dark = theme === 'dark';

  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className={`md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b backdrop-blur-xl ${dark ? 'bg-[#0B0B0D]/90 border-white/[0.04]' : 'bg-white/90 border-zinc-200'}`}>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`p-2 rounded-lg transition-all ${dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-black hover:bg-zinc-100'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] font-ui ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>
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
          ${dark ? 'bg-[#0B0B0D] border-r border-white/[0.04]' : 'bg-white border-r border-zinc-200 shadow-lg'}
          ${collapsed ? 'w-[60px]' : 'w-[200px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo + Collapse Toggle */}
        <div className={`flex items-center h-16 px-4 border-b ${dark ? 'border-white/[0.04]' : 'border-zinc-200'}`}>
          {!collapsed && (
            <span className={`text-sm logo-text flex-1 ${dark ? 'text-white' : 'text-black'}`}>
              LOCK IN
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden md:flex p-1.5 rounded-md transition-all ${collapsed ? 'mx-auto' : ''} ${dark ? 'text-zinc-500 hover:text-white hover:bg-zinc-800' : 'text-zinc-400 hover:text-black hover:bg-zinc-100'}`}
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
                className={`flex items-center gap-3 rounded-xl transition-all duration-200 group relative
                  ${collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}
                  ${isActive
                    ? (dark ? 'bg-white/[0.04] text-white' : 'bg-zinc-100 text-black')
                    : (dark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]' : 'text-zinc-400 hover:text-black hover:bg-zinc-100')
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-zinc-400 rounded-r-full" />
                )}

                <span className="text-base flex-shrink-0">{TAB_ICONS[tab]}</span>

                {!collapsed && (
                  <span className={`text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap font-ui ${isActive ? 'text-white' : ''}`}>
                    {tab}
                  </span>
                )}

                {/* Tooltip on collapsed */}
                {collapsed && (
                  <div className={`absolute left-full ml-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-ui ${dark ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-white'}`}>
                    {tab}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom accent */}
        <div className={`px-4 py-4 border-t ${dark ? 'border-white/[0.04]' : 'border-zinc-200'}`}>
          {!collapsed ? (
            <p className={`text-[8px] font-medium uppercase tracking-[0.06em] ${dark ? 'text-zinc-700' : 'text-zinc-300'}`}>
              Tracker Alpha
            </p>
          ) : (
            <div className="w-2 h-2 rounded-full bg-zinc-700 mx-auto" />
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
