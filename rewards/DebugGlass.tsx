import React, { useState } from 'react';
import WallpaperLayer from './WallpaperLayer';
import { WALLPAPERS, wallpaperById } from './wallpapers';
import { TUNE } from './glass';

/**
 * DEV only (`?glass=debug`): a wallpaper full screen under a mock Today page,
 * in either theme, plus the picker's swatches. `&wp=<id>` picks the wallpaper
 * (Glass by default), `&mode=light|dark` the theme.
 */
const DebugGlass: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  // Lens knobs from the URL (&reach=1.7&fold=1.75&disperse=0.05).
  for (const k of Object.keys(TUNE) as (keyof typeof TUNE)[]) {
    const v = Number(params.get(k));
    if (params.has(k) && Number.isFinite(v)) TUNE[k] = v;
  }
  const [dark, setDark] = useState(params.get('mode') !== 'light');
  const [id, setId] = useState(params.get('wp') ?? 'glass');
  const wp = wallpaperById(id) ?? WALLPAPERS[0];
  const card = dark ? 'bg-[#111114] border-white/[0.06] text-white' : 'bg-white border-zinc-100 shadow-sm text-zinc-900';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  return (
    <div className={`min-h-screen relative font-ui ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-zinc-900'}`}>
      <WallpaperLayer wallpaper={wp} dark={dark} className="fixed inset-0 z-0 pointer-events-none" />
      <main className="relative z-20 max-w-[960px] mx-auto px-5 md:px-10 pt-10 pb-24" style={{ visibility: params.has('bare') ? 'hidden' : undefined }}>
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-[34px] md:text-[44px] leading-none font-extrabold">Today</h1>
            <p className={`mt-2 text-[14px] ${muted}`}>3.5h of 10h. Day 31 of your streak.</p>
          </div>
          <button onClick={() => setDark(d => !d)} className={`h-9 px-4 rounded-full text-[13px] font-bold border ${card}`}>
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {['Physics', 'Chemistry', 'Maths'].map((s, i) => (
            <div key={s} className={`rounded-xl border p-6 ${card}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${muted}`}>{s}</p>
              <p className="num-stat text-[32px] mt-2">{[1.5, 1.25, 0.75][i]}h</p>
            </div>
          ))}
        </div>
        <div className={`rounded-xl border p-6 mt-4 ${card}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-4 ${muted}`}>The 30 Pack</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {WALLPAPERS.map(w => (
              <button key={w.id} onClick={() => setId(w.id)} className={`rounded-lg border overflow-hidden text-left ${w.id === id ? 'border-[#E10600]' : dark ? 'border-white/[0.08]' : 'border-zinc-200'}`}>
                <WallpaperLayer wallpaper={w} dark={dark} className="h-16 relative" preview />
                <p className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-2 ${muted}`}>{w.name}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="h-[120vh]" />
      </main>
    </div>
  );
};

export default DebugGlass;
