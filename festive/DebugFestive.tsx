/* ── `?festive=debug`: every festive theme, in action, on one board ──
   DEV only, tree-shaken from production (index.tsx). Nothing is read from or
   written to the database.

   The frames are real iframes of a stage (`?festive=debug&stage=1&…`) at real
   device widths, scaled down to fit. That is deliberate: the layer decides
   where its pieces go from the window it lives in (the gutter beside <main>,
   the phone breakpoint, where the cracker box stands), so a phone frame has to
   be a 390px window, not a 390px div. Fireworks fly inside each frame; tap a
   cracker box in any of them, or press Salvo to set off every Diwali frame. */

import React, { useEffect, useMemo, useState } from 'react';
import FestiveLayer from './FestiveLayer';
import { launch } from './fireworks';
import { FESTIVE_GREETING, type FestiveTheme } from './useFestiveTheme';
import { Card, Eyebrow, PageHeader, btn, tokens } from '../ui/kit';
import ExamCountdown from '../today/ExamCountdown';

const THEMES: Array<{ id: FestiveTheme; label: string }> = [
  { id: 'dussehra', label: 'Dussehra' },
  { id: 'diwali', label: 'Diwali' },
  { id: 'christmas', label: 'Christmas & New Year' },
  { id: 'none', label: 'No theme' },
];

const DEVICES = [
  { id: 'phone', label: 'Phone', w: 390, h: 844 },
  { id: 'laptop', label: 'Laptop', w: 1440, h: 900 },
  { id: 'wide', label: 'Wide desktop', w: 1728, h: 1080 },
] as const;

type Mode = 'dark' | 'light' | 'both';

const isTheme = (v: string | null): v is FestiveTheme => THEMES.some(t => t.id === v);

/* ═══ The stage: a stand-in for the app, wearing the real layer ═══ */

const NAV = ['Today', 'Plan', 'Syllabus', 'Streak', 'Mocks', 'Ranks', 'Review', 'Groups', 'Decks'];

const Dock: React.FC<{ className: string; dark: boolean; children: React.ReactNode }> = ({ className, dark, children }) => (
  <div className={className}>
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center border backdrop-blur-md ${dark
        ? 'bg-white/[0.06] border-white/[0.12] text-zinc-200'
        : 'bg-white/70 border-zinc-200 text-zinc-700'}`}
    >
      {children}
    </div>
  </div>
);

const Stage: React.FC<{ theme: FestiveTheme; dark: boolean; rail: number }> = ({ theme, dark, rail }) => {
  const t = tokens(dark);
  const greeting = theme !== 'none' ? FESTIVE_GREETING[theme] : null;
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  useEffect(() => {
    document.body.style.background = dark ? '#0B0B0D' : '#F2F0EC';
    /* Salvo from the board: five rockets from wherever the box stands. */
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'festive-salvo') return;
      const box = document.querySelector('.fx-cracker')?.getBoundingClientRect();
      if (!box) return;
      for (let i = 0; i < 5; i++) {
        window.setTimeout(() => launch(box.left + box.width * 0.46, box.top + box.height * 0.18, dark), i * 280);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dark]);

  return (
    <div className={`min-h-screen relative ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-[#17150F]'}`}>
      {theme !== 'none' && <FestiveLayer theme={theme} dark={dark} railPx={rail} />}

      {/* Phone capsule */}
      <div
        className={`md:hidden flex items-center px-5 rounded-full border backdrop-blur-xl ${dark
          ? 'bg-white/[0.07] border-white/[0.12]'
          : 'bg-white/60 border-white/80 shadow-sm'}`}
        style={{ position: 'fixed', zIndex: 50, top: 8, left: 10, right: 10, height: 52 }}
      >
        <span className={`w-5 h-[2px] rounded ${dark ? 'bg-zinc-300' : 'bg-zinc-700'} shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]`} />
        <span className="flex-1 text-center text-[11px] font-bold tracking-[0.2em] font-ui">TODAY</span>
        <span className="w-5" />
      </div>

      {/* Laptop rail */}
      <div
        className={`hidden md:flex flex-col rounded-2xl border backdrop-blur-xl py-4 ${dark
          ? 'bg-white/[0.05] border-white/[0.1]'
          : 'bg-white/60 border-white/80 shadow-sm'}`}
        style={{ position: 'fixed', zIndex: 50, left: 8, top: 8, bottom: 8, width: rail - 16 }}
      >
        <div className="px-4 pb-4 text-[11px] font-black tracking-[0.12em] font-ui">{rail > 100 ? 'LOCK IN' : 'α'}</div>
        {NAV.map((n, i) => (
          <div
            key={n}
            className={`mx-2 my-0.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.08em] font-ui truncate ${i === 0
              ? dark ? 'bg-white/[0.08] text-white' : 'bg-zinc-900/[0.06] text-zinc-900'
              : 'text-zinc-500'}`}
          >
            {rail > 100 ? n : n[0]}
          </div>
        ))}
      </div>

      <style>{`@media (min-width: 768px) { .stage-shift { margin-left: ${rail}px; } }`}</style>
      <div className={`shell-offset stage-shift ${theme !== 'none' ? 'festive-pad' : ''}`}>
        <main className="max-w-5xl mx-auto w-full relative z-20 px-4 md:px-6 py-8 pb-16 space-y-6">
          <PageHeader
            dark={dark}
            title="Today"
            subtitle={greeting ? (
              <>
                {date}
                <span aria-hidden> · </span>
                <span className="font-accent italic" style={{ color: dark ? greeting.dark : greeting.light }}>{greeting.text}</span>
              </>
            ) : date}
            aside={<ExamCountdown exam="JEE" dark={dark} />}
          />

          <Card dark={dark} className="p-6 md:p-8">
            <div className="flex items-center gap-6">
              <div className={`w-24 h-24 rounded-full border-[6px] flex flex-col items-center justify-center ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                <span className="num-stat text-xl">38%</span>
                <span className="text-[8px] font-bold tracking-[0.1em] text-zinc-500 font-ui">OF GOAL</span>
              </div>
              <div>
                <Eyebrow dark={dark}>Today's target</Eyebrow>
                <div className="num-hero text-5xl mt-1">3.0 <span className="text-lg text-zinc-500">/ 8h</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {[['Physics', '#4DABF7', '1.5'], ['Chemistry', '#69DB7C', '1.0'], ['Maths', '#B197FC', '0.5'], ['General', '#868E96', '0.0']].map(([s, c, h]) => (
                <div key={s} className={`rounded-xl border p-4 ${t.inset}`}>
                  <div className="flex items-center gap-2 text-xs font-ui text-zinc-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{s}</div>
                  <div className="num-stat text-2xl mt-2">{h}<span className="text-sm">h</span></div>
                </div>
              ))}
            </div>
          </Card>

          <Card dark={dark} className="p-8 md:p-10 text-center">
            <Eyebrow dark={dark}>Pick a subject, then start</Eyebrow>
            <div className="num-timer text-6xl md:text-8xl mt-4">00:00:00</div>
            <button className={`${btn} ${t.primary} mt-8 px-16 py-4`}>Start session</button>
          </Card>

          <Card dark={dark} className="p-6 md:p-8">
            <Eyebrow dark={dark}>Focus tasks</Eyebrow>
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              {['Todo', 'Doing', 'Done'].map(col => (
                <div key={col} className={`rounded-xl border p-3 ${t.inset}`}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500 font-ui">{col}</div>
                  <div className={`mt-3 h-12 rounded-lg border ${t.card}`} />
                  <div className={`mt-2 h-12 rounded-lg border ${t.card}`} />
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>

      <div style={{ ['--rail' as string]: `${rail}px` }}>
        <Dock className="fb-dock" dark={dark}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z" /></svg>
        </Dock>
      </div>
      <Dock className="qs-dock" dark={dark}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
      </Dock>
    </div>
  );
};

/* ═══ The board ═══ */

const Frame: React.FC<{ src: string; w: number; h: number; displayW: number; label: string; sub: string }> =
  ({ src, w, h, displayW, label, sub }) => {
    const scale = displayW / w;
    return (
      <figure className="m-0">
        <div
          className="overflow-hidden rounded-[18px] border border-white/10 bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          style={{ width: displayW, height: Math.round(h * scale) }}
        >
          <iframe
            src={src}
            title={label}
            style={{ width: w, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', display: 'block' }}
          />
        </div>
        <figcaption className="mt-2 flex items-baseline gap-2 font-ui">
          <span className="text-[12px] font-bold text-zinc-200">{label}</span>
          <span className="text-[11px] text-zinc-500">{sub}</span>
        </figcaption>
      </figure>
    );
  };

const MiniApp: React.FC<{ dark: boolean }> = ({ dark }) => {
  const block = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100';
  const line = dark ? 'bg-white/[0.08]' : 'bg-zinc-100';
  return (
    <div className="absolute inset-0 z-[2] pl-[30%] pr-[40%] pt-16 pointer-events-none">
      <div className={`h-2.5 w-3/4 rounded ${dark ? 'bg-white/20' : 'bg-zinc-300'}`} />
      <div className={`mt-3 rounded-md border p-2.5 ${block}`}>
        <div className={`h-1.5 w-2/3 rounded ${line}`} />
        <div className={`mt-2 h-1.5 w-full rounded ${line}`} />
        <div className="mt-2.5 h-4 w-1/2 rounded bg-[#E10600]" />
      </div>
    </div>
  );
};

const Swatch: React.FC<{ theme: FestiveTheme; dark: boolean; w: number; h: number; zoom?: number }> = ({ theme, dark, w, h, zoom = 1 }) => (
  <div className="overflow-hidden rounded-xl border border-white/10" style={{ width: w * zoom, height: h * zoom }}>
    <div
      className={`relative overflow-hidden ${dark ? 'bg-[#0B0B0D]' : 'bg-[#F2F0EC]'}`}
      style={{ width: w, height: h, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
    >
      <MiniApp dark={dark} />
      {theme !== 'none' && <FestiveLayer theme={theme} dark={dark} preview />}
    </div>
  </div>
);

const Seg = <T extends string,>({ value, options, onChange }: {
  value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void;
}) => (
  <div className="inline-flex p-1 rounded-lg border border-white/10 bg-white/[0.03]">
    {options.map(o => (
      <button
        key={o.id}
        onClick={() => onChange(o.id)}
        className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-ui transition-colors ${value === o.id ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Board: React.FC = () => {
  const initial = new URLSearchParams(location.search).get('theme');
  const [theme, setTheme] = useState<FestiveTheme>(isTheme(initial) ? initial : 'diwali');
  const [mode, setMode] = useState<Mode>('dark');
  const [rail, setRail] = useState<'212' | '72'>('212');
  const [nonce, setNonce] = useState(0);
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    document.body.style.background = '#08080A';
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const modes = mode === 'both' ? (['dark', 'light'] as const) : ([mode] as const);
  const src = (m: 'dark' | 'light') =>
    `/?festive=debug&stage=1&theme=${theme}&mode=${m}&rail=${rail}&n=${nonce}`;

  /* Phone beside the two desktops, filling the column. */
  const col = Math.min(1400, width - 48);
  const stacked = width < 900;
  const phoneW = stacked ? 300 : Math.min(280, col * 0.22);
  const deskW = stacked ? col : col - phoneW - 32;

  const salvo = () => {
    document.querySelectorAll('iframe').forEach(f => f.contentWindow?.postMessage({ type: 'festive-salvo' }, location.origin));
  };

  const label = useMemo(() => THEMES.find(t => t.id === theme)?.label, [theme]);

  return (
    <div className="min-h-screen text-white font-ui" style={{ background: '#08080A' }}>
      <header className="sticky top-0 z-[100] border-b border-white/[0.06] bg-[#08080A]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="mr-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Design board</div>
            <div className="font-display text-xl leading-tight">Festive themes</div>
          </div>
          <Seg value={theme} options={THEMES} onChange={setTheme} />
          <Seg value={mode} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'both', label: 'Both' }]} onChange={setMode} />
          <Seg value={rail} options={[{ id: '212', label: 'Rail open' }, { id: '72', label: 'Rail collapsed' }]} onChange={setRail} />
          <div className="flex-1" />
          {theme === 'diwali' && (
            <button onClick={salvo} className={`${btn} bg-[#F59F00] text-black px-4 py-2.5`}>🎆 Salvo</button>
          )}
          <button onClick={() => setNonce(n => n + 1)} className={`${btn} border border-white/15 text-zinc-200 px-4 py-2.5`}>Replay</button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-14">
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">In the app · {label}</h2>
          <p className="text-[13px] text-zinc-400 mt-1 max-w-2xl">
            Real device widths, scaled to fit. The ornament and greeting appear only where the gutter beside the page can hold them, so
            they show on the wide desktop and (with the rail collapsed) on the laptop.
            {theme === 'diwali' && ' Tap any cracker box to set one off.'}
          </p>
          <div className="mt-6 space-y-10">
            {modes.map(m => (
              <div key={m} className={`flex gap-8 ${stacked ? 'flex-col' : 'items-start'}`}>
                <Frame key={`p-${m}-${theme}-${nonce}`} src={src(m)} w={390} h={844} displayW={phoneW} label={`${DEVICES[0].label} · ${m}`} sub="390 × 844" />
                <div className="flex flex-col gap-8">
                  <Frame key={`l-${m}-${theme}-${rail}-${nonce}`} src={src(m)} w={1440} h={900} displayW={deskW} label={`${DEVICES[1].label} · ${m}`} sub="1440 × 900" />
                  <Frame key={`w-${m}-${theme}-${rail}-${nonce}`} src={src(m)} w={1728} h={1080} displayW={deskW} label={`${DEVICES[2].label} · ${m}`} sub="1728 × 1080" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Close up · {label}</h2>
          <p className="text-[13px] text-zinc-400 mt-1">The console preview at 2×, so the lamps, strings and greeting can be judged up close.</p>
          <div className={`mt-6 flex flex-wrap gap-6`}>
            {(['dark', 'light'] as const).map(m => (
              <Swatch key={`${m}-${theme}-${nonce}`} theme={theme} dark={m === 'dark'} w={Math.min(330, (col - 24) / 4)} h={200} zoom={2} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Console swatches · every theme</h2>
          <p className="text-[13px] text-zinc-400 mt-1">What an administrator sees in Console → Theme before going live.</p>
          {(['dark', 'light'] as const).map(m => (
            <div key={m} className="mt-6 grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(260px, 1fr))` }}>
              {THEMES.map(o => (
                <div key={o.id}>
                  <Swatch theme={o.id} dark={m === 'dark'} w={300} h={176} />
                  <div className="mt-2 text-[12px] font-bold text-zinc-200">{o.label} <span className="font-normal text-zinc-500">· {m}</span></div>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

const DebugFestive: React.FC = () => {
  const p = new URLSearchParams(location.search);
  if (p.get('stage') === '1') {
    const theme = p.get('theme');
    return (
      <Stage
        theme={isTheme(theme) ? theme : 'diwali'}
        dark={p.get('mode') !== 'light'}
        rail={p.get('rail') === '72' ? 72 : 212}
      />
    );
  }
  return <Board />;
};

export default DebugFestive;
