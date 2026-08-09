import React from 'react';
import { RewardDef } from './catalog';

interface Props {
  def: RewardDef;
  theme: 'dark' | 'light';
  /** Marks it acknowledged so it never fires twice. */
  onDismiss: () => void;
  /** Dismiss and take the user to the vault. */
  onOpen: () => void;
}

const KIND_ACTION: Record<RewardDef['kind'], string> = {
  wallpaper: 'Pick your wallpaper',
  book: 'Start reading',
  hamper: 'See what it is',
};

/**
 * The one moment the app is allowed to be warm about.
 *
 * It interrupts on purpose — this is the payoff for a month, a hundred days or
 * a year, and burying it in a toast would waste it. Dismissing marks it
 * acknowledged, so it is shown exactly once per reward, ever.
 */
const UnlockModal: React.FC<Props> = ({ def, theme, onDismiss, onOpen }) => {
  const dark = theme === 'dark';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onDismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      >
        <div
          className="px-8 pt-10 pb-8 text-center"
          style={{
            background: dark
              ? 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.22) 0%, transparent 65%)'
              : 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.10) 0%, transparent 65%)',
          }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#E10600] mb-6 font-ui">
            Day {def.day} cleared
          </p>

          <p className={`text-[64px] leading-none num-hero tracking-tighter ${dark ? 'text-white' : 'text-black'}`}>
            {def.day}
          </p>

          <div className="accent-line mt-5 mb-6" />

          <h2 className={`text-2xl font-black uppercase tracking-tight leading-tight mb-3 ${dark ? 'text-white' : 'text-black'}`}>
            {def.title}
          </h2>
          <p className={`text-[13px] leading-relaxed font-ui ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {def.tagline}
          </p>
          <p className={`text-[11px] leading-relaxed font-ui mt-4 ${dark ? 'text-zinc-600' : 'text-zinc-500'}`}>
            It is yours from here. Breaking the streak does not take it back.
          </p>
        </div>

        <div className={`px-8 py-5 border-t flex flex-col sm:flex-row gap-2.5 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button
            onClick={onOpen}
            className="flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
          >
            {KIND_ACTION[def.kind]}
          </button>
          <button
            onClick={onDismiss}
            className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 font-ui ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'}`}
          >
            Back to work
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnlockModal;
