import React, { Suspense, useEffect, useState } from 'react';
import { Card, Eyebrow, btn, tokens } from '../ui/kit';
import {
  FestiveTheme, announceLocalFlip, fetchFestiveTheme, setFestiveTheme,
} from '../festive/useFestiveTheme';

const FestiveLayer = React.lazy(() => import('../festive/FestiveLayer'));

interface Props {
  theme: 'dark' | 'light';
}

const OPTIONS: Array<{ id: FestiveTheme; title: string; line: string }> = [
  { id: 'dussehra', title: 'Dussehra', line: 'A marigold and mango-leaf toran across the top, diyas along the bottom.' },
  { id: 'diwali', title: 'Diwali', line: 'Paper lanterns, an akash kandil, diyas, rising sparks, and a cracker box students can tap to set off fireworks.' },
  { id: 'christmas', title: 'Christmas & New Year', line: 'Fairy lights, falling snow, two baubles and a snow drift.' },
  { id: 'none', title: 'No theme', line: 'Alpha as it is on every other day.' },
];

/* A sketch of the app inside the swatch, so the preview shows the theme the
   way students will meet it: around the cards, not instead of them. */
const MiniApp: React.FC<{ dark: boolean }> = ({ dark }) => {
  const block = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100';
  const line = dark ? 'bg-white/[0.08]' : 'bg-zinc-100';
  return (
    <div className="absolute inset-0 z-[2] pl-[30%] pr-[40%] pt-16">
      <div className={`h-2.5 w-3/4 rounded ${dark ? 'bg-white/20' : 'bg-zinc-300'}`} />
      <div className={`mt-3 rounded-md border p-2.5 ${block}`}>
        <div className={`h-1.5 w-2/3 rounded ${line}`} />
        <div className={`mt-2 h-1.5 w-full rounded ${line}`} />
        <div className="mt-2.5 h-4 w-1/2 rounded bg-[#E10600]" />
      </div>
    </div>
  );
};

/**
 * Console → Theme. One switch, applied to every student at once.
 *
 * The click calls `admin_set_festive_theme`, which re-checks `is_admin()` in
 * the database; Realtime then carries the new value to every open copy of
 * Alpha, and anyone who opens it later reads it on load. This screen decides
 * nothing about who may flip it.
 */
const ThemeAdmin: React.FC<Props> = ({ theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  /* undefined: loading. null: festive.sql has not been run. */
  const [live, setLive] = useState<FestiveTheme | null | undefined>(undefined);
  const [busy, setBusy] = useState<FestiveTheme | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetchFestiveTheme().then(v => { if (on) setLive(v); });
    return () => { on = false; };
  }, []);

  const choose = async (id: FestiveTheme) => {
    if (busy || id === live) return;
    setBusy(id);
    setError(null);
    const err = await setFestiveTheme(id);
    setBusy(null);
    if (err) { setError(err); return; }
    setLive(id);
    announceLocalFlip(id);
  };

  const liveTitle = OPTIONS.find(o => o.id === live)?.title;

  return (
    <div className="space-y-5">
      <Card dark={dark} className="p-6 md:p-8">
        <Eyebrow dark={dark}>Festive theme</Eyebrow>
        <p className={`mt-2 text-sm font-ui ${t.body}`}>
          {live === undefined && 'Checking what is live…'}
          {live === null && 'The theme switch is not set up on this project yet. Run supabase/festive.sql, then come back.'}
          {live && (live === 'none'
            ? 'No theme is live. Pick one and every student sees it within a second, guests included.'
            : <>Live for everyone now: <span className={`font-bold ${t.heading}`}>{liveTitle}</span>.</>)}
        </p>
        {error && <p className="mt-2 text-xs font-ui text-[#E10600]">{error}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((o, i) => {
          const isLive = live === o.id;
          return (
            <Card key={o.id} dark={dark} delay={i * 60} className={`overflow-hidden ${isLive ? (dark ? 'ring-1 ring-white/30' : 'ring-1 ring-zinc-900/30') : ''}`}>
              <div className={`relative h-44 overflow-hidden ${dark ? 'bg-[#0B0B0D]' : 'bg-[#F2F0EC]'}`}>
                <MiniApp dark={dark} />
                {o.id !== 'none' && (
                  <Suspense fallback={null}>
                    <FestiveLayer theme={o.id} dark={dark} preview />
                  </Suspense>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`text-sm font-bold font-ui ${t.heading}`}>{o.title}</h3>
                  {isLive && (
                    <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>
                      ● Live
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-xs font-ui leading-relaxed ${t.muted}`}>{o.line}</p>
                <button
                  onClick={() => choose(o.id)}
                  disabled={!live || isLive || !!busy}
                  className={`${btn} mt-4 w-full py-3 ${isLive ? t.ghost : t.primary}`}
                >
                  {busy === o.id ? 'Switching…' : isLive ? 'Live now' : o.id === 'none' ? 'Turn theme off' : 'Go live for everyone'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeAdmin;
