import React from 'react';
import { TabType } from './types';

interface Props {
  activeTab: TabType;
  onTabChange: (t: TabType) => void;
  theme: 'dark' | 'light';
}

const Navbar: React.FC<Props> = ({ activeTab, onTabChange, theme }) => {
  const tabs: TabType[] = ['Today', 'Syllabus', 'Streak', 'Questions', 'Review'];
  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t z-50 transition-colors ${theme === 'dark' ? 'bg-[#0B0B0D]/90 backdrop-blur-xl border-white/[0.04]' : 'bg-white/90 backdrop-blur-md border-[#E3E0D9]'}`}>
      <div className="max-w-5xl mx-auto flex justify-around items-center h-16 safe-area-inset-bottom">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab ? '' : 'opacity-35 hover:opacity-70'}`}
          >
            <span className={`text-[10px] uppercase tracking-wider font-bold font-ui ${theme === 'dark' ? 'text-white' : 'text-[#17150F]'}`}>
              {tab}
            </span>
            {activeTab === tab && <div className="w-4 h-[2px] rounded-full bg-[#E10600]" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Navbar;
