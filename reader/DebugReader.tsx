/* ── `?book=debug`: the reader's design board ──
   DEV only, tree-shaken from production (index.tsx). Every state of the
   reader on a phone and a laptop, at real device widths, on three reading
   histories (fresh, mid-book, finished) and any page colour, plus one live
   frame to play in. Nothing is written: each frame keeps its own reading
   state in memory, and settings are pinned per frame so they never leak
   between frames through shared localStorage.

   Frames are iframes of a stage (`&stage=1&fx=…&page=…&panel=…&ch=…`)
   because the reader is a fixed, full-window surface that lays itself out
   from the window: a phone has to be a 390px window, not a 390px div. */

import React, { useEffect, useMemo, useState } from 'react';
import { CHAPTERS } from '../content/bookText';
import Reader, { type ReaderDebug } from './Reader';
import {
  EMPTY_READING, actionSteps, chapterUnits, newId, textBetween,
  type Highlight, type HighlightColor, type ReadingState,
} from './model';
import type { PageTheme } from './settings';

/* ─── Fixtures, built from the real text so every anchor is real ─── */

const find = (chapterId: string, words: string) => {
  const ch = CHAPTERS.find(c => c.id === chapterId)!;
  for (const u of chapterUnits(ch)) {
    const at = u.plain.indexOf(words);
    if (at >= 0) return { u: u.id, o: at, end: at + words.length };
  }
  throw new Error(`fixture text not found in ${chapterId}: ${words}`);
};

const DAY = 86_400_000;
const T0 = Date.now() - 9 * DAY;

const hl = (chapterId: string, words: string, color: HighlightColor, note?: string, day = 0): Highlight => {
  const a = find(chapterId, words);
  return {
    id: newId('h'), chapterId, color, quote: words,
    start: { u: a.u, o: a.o }, end: { u: a.u, o: a.end },
    ...(note ? { note } : {}),
    createdAt: T0 + day * DAY, updatedAt: T0 + day * DAY,
  };
};

/** A highlight from one phrase to another, across paragraphs if need be. */
const span = (chapterId: string, from: string, to: string, color: HighlightColor): Highlight => {
  const a = find(chapterId, from);
  const b = find(chapterId, to);
  const ch = CHAPTERS.find(c => c.id === chapterId)!;
  const start = { u: a.u, o: a.o };
  const end = { u: b.u, o: b.end };
  return {
    id: newId('h'), chapterId, color, quote: textBetween(ch, start, end), start, end,
    createdAt: T0 + DAY, updatedAt: T0 + DAY,
  };
};

const unitAt = (chapterId: string, words: string) => find(chapterId, words).u;

const MID: ReadingState = {
  highlights: [
    hl('ch1', 'He WANTS to change but does not know HOW to.', 'yellow', 'This is literally me. I know what to do, I just never start.'),
    hl('ch1', 'Dopamine isn’t the problem here. It’s Instant Gratification.', 'pink'),
    span('ch1', 'This is exactly what happens to your brain', 'When you choose to Delay Gratification, the tasks you do feel hard in the moment.', 'green'),
    hl('ch1', 'Stack wins as soon as you wake up no matter how small.', 'blue', 'Tomorrow: bed, 10 push-ups, 5 breaths. Then phone.'),
    hl('ch1', 'Consistency and discipline are like skills in a game.', 'yellow'),
    hl('intro', 'This book is what I wish I had when I started.', 'green'),
  ],
  bookmarks: [
    { id: newId('b'), chapterId: 'ch1', u: unitAt('ch1', 'Out of Rahul’s entire day'), snippet: 'Out of Rahul’s entire day, 90% of the activities which can be regarded as a self improvement sin have just been talked about…', createdAt: T0 + 2 * DAY, updatedAt: T0 + 2 * DAY },
    { id: newId('b'), chapterId: 'ch0', u: unitAt('ch0', 'I’ll give a final heads up'), snippet: 'I’ll give a final heads up before we begin.', createdAt: T0, updatedAt: T0 },
  ],
  position: { chapterId: 'ch1', u: unitAt('ch1', 'Rahul’s low levels of motivation'), f: 0.2, at: Date.now() },
  furthest: { intro: 1, ch0: 1, ch1: 0.55 },
  actions: { [actionSteps(CHAPTERS)[0].block.id]: T0 + DAY },
};

const FINISHED: ReadingState = {
  ...MID,
  highlights: [
    ...MID.highlights,
    hl('ch2', 'STOP WITH THE DAMN EXCUSES.', 'pink', 'Gym membership excuse: dead. Home workout from Monday.', 3),
    hl('ch2', 'Learn about things that genuinely interest you OR topics that can spark intrigue in a conversation.', 'blue', undefined, 3),
    hl('ch3', 'Purpose isn’t something you FIND—it’s something you BUILD.', 'yellow', 'Write my 10-year goal this weekend.', 5),
    hl('ch5', 'You actions follow your identity—not the other way around.', 'green', undefined, 6),
    hl('ch8', 'Rahul never told you he was changing. But he was.', 'pink', undefined, 8),
  ],
  position: { chapterId: 'next', u: chapterUnits(CHAPTERS[CHAPTERS.length - 1]).slice(-1)[0].id, f: 1, at: Date.now() },
  furthest: Object.fromEntries(CHAPTERS.map(c => [c.id, 1])),
  actions: Object.fromEntries(actionSteps(CHAPTERS).map((s, i) => [s.block.id, T0 + i * DAY])),
};

const FIXTURES: Record<string, ReadingState> = { fresh: EMPTY_READING, mid: MID, finished: FINISHED };

/* ─── The stage: one reader, one state ─── */

const Stage: React.FC = () => {
  const q = new URLSearchParams(location.search);
  const page = (q.get('page') ?? 'paper') as PageTheme;
  const [reading, setReading] = useState<ReadingState>(() => FIXTURES[q.get('fx') ?? 'mid'] ?? MID);
  const [closed, setClosed] = useState(false);
  const debug: ReaderDebug = {
    settings: { theme: page, ...(q.get('font') === 'sans' ? { font: 'sans' as const } : {}), ...(q.get('size') ? { size: Number(q.get('size')) } : {}) },
    ...(q.get('ch') ? { chapter: Number(q.get('ch')) } : {}),
    ...(q.get('panel') ? { panel: q.get('panel') as ReaderDebug['panel'] } : {}),
    ...(q.get('q') ? { query: q.get('q')! } : {}),
    ...(q.get('hidden') ? { chromeHidden: true } : {}),
  };
  useEffect(() => { document.body.style.background = '#000'; }, []);
  if (closed) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: '#888', font: '500 14px system-ui', background: '#111' }}>
        <button type="button" onClick={() => setClosed(false)} style={{ padding: '12px 18px', borderRadius: 999, border: '1px solid #444', background: 'none', color: '#ddd', cursor: 'pointer' }}>Reader closed · Open again</button>
      </div>
    );
  }
  return (
    <Reader
      theme={page === 'dusk' || page === 'night' ? 'dark' : 'light'}
      reading={reading}
      onReading={fn => setReading(r => fn(r))}
      onClose={() => setClosed(true)}
      debug={debug}
    />
  );
};

/* ─── The board ─── */

interface Shot { label: string; look: string; params: Record<string, string> }

const PHONE: Shot[] = [
  { label: 'Reading', look: 'Literata at 18px, ~38 characters a line, chrome over the page, the red hairline of book progress.', params: { ch: '2' } },
  { label: 'Reading, chrome away', look: 'Scrolling down hides both bars; tap the page to bring them back.', params: { ch: '2', hidden: '1' } },
  { label: 'Chapter opener', look: 'Kicker, title, reading time; the drop cap on the first paragraph.', params: { ch: '1' } },
  { label: 'Level 2 opens', look: 'A part gets its own page before Chapter 3.', params: { ch: '4' } },
  { label: 'Selecting text', look: 'The toolbar sits BELOW the selection on a phone, so iOS’s own Copy menu above it never collides.', params: { ch: '2', panel: 'select' } },
  { label: 'Tapping a highlight', look: 'Colour, the note itself, edit, copy, remove.', params: { ch: '2', panel: 'menu' } },
  { label: 'Writing a note', look: 'Full screen on a phone. Closing in any way saves.', params: { ch: '2', panel: 'note' } },
  { label: 'Reading settings', look: 'Page colour, typeface, size, spacing, justify.', params: { ch: '2', panel: 'settings' } },
  { label: 'Contents', look: 'Progress, minutes left, action steps; rings per chapter.', params: { ch: '2', panel: 'contents' } },
  { label: 'Notebook', look: 'Action steps to tick, then every highlight and note in book order.', params: { ch: '2', panel: 'notebook' } },
  { label: 'Bookmarks', look: 'Snippet, chapter, date. The ribbon shows in the margin.', params: { ch: '2', panel: 'bookmarks' } },
  { label: 'Search', look: '“don’t” finds “don’t”; hits grouped by chapter.', params: { ch: '2', panel: 'search', q: 'dopamine' } },
  { label: 'End of a chapter', look: 'What comes next and how long it takes.', params: { ch: '2', panel: 'end' } },
  { label: 'End of the book', look: 'Stats from the student’s own reading.', params: { ch: String(CHAPTERS.length - 1), panel: 'end', fx: 'finished' } },
  { label: 'First open, empty notebook', look: 'The empty state teaches the gesture.', params: { ch: '0', panel: 'notebook', fx: 'fresh' } },
];

const LAPTOP: Shot[] = [
  { label: 'Reading', look: 'The measure holds at ~68 characters however wide the window.', params: { ch: '2' } },
  { label: 'Selecting text', look: 'On a laptop the toolbar sits above the selection.', params: { ch: '2', panel: 'select' } },
  { label: 'Notebook', look: 'A side panel; the page stays visible behind it.', params: { ch: '3', panel: 'notebook', fx: 'finished' } },
  { label: 'Settings', look: 'A popover under the Aa button; line length appears here.', params: { ch: '2', panel: 'settings' } },
  { label: 'Note editor', look: 'A centred sheet; ⌘↵ saves.', params: { ch: '2', panel: 'note' } },
  { label: 'Search', look: 'Search across all 13 chapters.', params: { ch: '2', panel: 'search', q: 'Rahul' } },
];

const PAGES: Array<{ id: PageTheme; name: string }> = [
  { id: 'paper', name: 'Paper' }, { id: 'sepia', name: 'Sepia' }, { id: 'dusk', name: 'Dusk' }, { id: 'night', name: 'Night' },
];

const Frame: React.FC<{ src: string; w: number; h: number; display: number; label: string; look: string }> = ({ src, w, h, display, label, look }) => {
  const s = display / w;
  return (
    <figure style={{ margin: 0, width: display }}>
      <div style={{ width: display, height: Math.round(h * s), overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(255,255,255,.1)', background: '#000', boxShadow: '0 24px 60px -24px rgba(0,0,0,.8)' }}>
        <iframe src={src} title={label} loading="lazy" style={{ width: w, height: h, border: 0, transform: `scale(${s})`, transformOrigin: '0 0', display: 'block' }} />
      </div>
      <figcaption style={{ marginTop: 10, font: '600 12.5px/1.3 system-ui', color: '#e5e5e5' }}>{label}</figcaption>
      <p style={{ margin: '4px 0 0', font: '400 11.5px/1.45 system-ui', color: '#8a8a8a' }}>{look}</p>
    </figure>
  );
};

const Seg = <T extends string,>({ value, options, onChange }: { value: T; options: Array<{ id: T; name: string }>; onChange: (v: T) => void }) => (
  <div style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: 'rgba(255,255,255,.06)', gap: 2 }}>
    {options.map(o => (
      <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{ padding: '7px 12px', borderRadius: 8, border: 0, cursor: 'pointer', font: '600 12px system-ui', background: value === o.id ? '#fff' : 'transparent', color: value === o.id ? '#111' : '#aaa' }}>
        {o.name}
      </button>
    ))}
  </div>
);

const Board: React.FC = () => {
  const [page, setPage] = useState<PageTheme>('paper');
  const [fx, setFx] = useState('mid');
  const [n, setN] = useState(0);
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    document.body.style.background = '#0a0a0b';
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const src = useMemo(() => (params: Record<string, string>) => {
    const p = new URLSearchParams({ book: 'debug', stage: '1', page, fx, n: String(n), ...params });
    return `/?${p}`;
  }, [page, fx, n]);
  const col = Math.min(1440, width - 48);
  const phoneW = Math.max(200, Math.min(250, (col - 4 * 24) / 5));
  const lapW = Math.max(320, Math.min(680, (col - 24) / 2));

  return (
    <div style={{ minHeight: '100vh', color: '#eee', fontFamily: 'system-ui' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,11,.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ marginRight: 12 }}>
            <div style={{ font: '700 10px system-ui', letterSpacing: '.14em', textTransform: 'uppercase', color: '#777' }}>Design board</div>
            <div style={{ font: '700 19px system-ui' }}>The reader</div>
          </div>
          <Seg value={page} options={PAGES} onChange={setPage} />
          <Seg value={fx} options={[{ id: 'fresh', name: 'First open' }, { id: 'mid', name: 'Mid-book' }, { id: 'finished', name: 'Finished' }]} onChange={setFx} />
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setN(v => v + 1)} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid #333', background: 'none', color: '#ddd', cursor: 'pointer', font: '600 12px system-ui' }}>Replay</button>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 24px 80px' }}>
        <section>
          <h2 style={{ font: '700 11px system-ui', letterSpacing: '.14em', textTransform: 'uppercase', color: '#777', margin: 0 }}>Play with it</h2>
          <p style={{ color: '#999', fontSize: 13, margin: '6px 0 18px', maxWidth: 680 }}>
            A live reader on the chosen history. Select text, highlight, write a note, tick an action step, search, bookmark, change the page.
            Nothing leaves the frame. Keys: ←/→ chapters, / search, B bookmark, C contents, N notebook, +/− size, Esc back.
          </p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Frame key={`live-p-${page}-${fx}-${n}`} src={src({ ch: '2' })} w={390} h={844} display={Math.min(360, col)} label="Phone · live" look="Long-press to select on a real phone." />
            <Frame key={`live-l-${page}-${fx}-${n}`} src={src({ ch: '2' })} w={1440} h={900} display={Math.min(col - 384, 900)} label="Laptop · live" look="Drag to select." />
          </div>
        </section>

        <section style={{ marginTop: 56 }}>
          <h2 style={{ font: '700 11px system-ui', letterSpacing: '.14em', textTransform: 'uppercase', color: '#777', margin: 0 }}>Phone · 390 × 844</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${phoneW}px)`, gap: 28, marginTop: 18 }}>
            {PHONE.map(s => <Frame key={`${s.label}-${page}-${fx}-${n}`} src={src({ ...s.params, ...(s.params.fx ? {} : {}) })} w={390} h={844} display={phoneW} label={s.label} look={s.look} />)}
          </div>
        </section>

        <section style={{ marginTop: 56 }}>
          <h2 style={{ font: '700 11px system-ui', letterSpacing: '.14em', textTransform: 'uppercase', color: '#777', margin: 0 }}>Laptop · 1440 × 900</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${lapW}px)`, gap: 28, marginTop: 18 }}>
            {LAPTOP.map(s => <Frame key={`${s.label}-${page}-${fx}-${n}`} src={src(s.params)} w={1440} h={900} display={lapW} label={s.label} look={s.look} />)}
          </div>
        </section>

        <section style={{ marginTop: 56 }}>
          <h2 style={{ font: '700 11px system-ui', letterSpacing: '.14em', textTransform: 'uppercase', color: '#777', margin: 0 }}>Every page colour, side by side</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${phoneW}px)`, gap: 28, marginTop: 18 }}>
            {PAGES.map(p => (
              <Frame key={`pg-${p.id}-${fx}-${n}`} src={`/?${new URLSearchParams({ book: 'debug', stage: '1', page: p.id, fx, ch: '2', n: String(n) })}`} w={390} h={844} display={phoneW} label={p.name} look="Highlights keep their meaning on every page." />
            ))}
            <Frame key={`sans-${page}-${fx}-${n}`} src={src({ ch: '2', font: 'sans' })} w={390} h={844} display={phoneW} label="Satoshi" look="The sans option, for readers who prefer it." />
            <Frame key={`big-${page}-${fx}-${n}`} src={src({ ch: '2', size: '7' })} w={390} h={844} display={phoneW} label="Largest text" look="24px still holds a comfortable line." />
          </div>
        </section>
      </main>
    </div>
  );
};

const DebugReader: React.FC = () => (new URLSearchParams(location.search).get('stage') === '1' ? <Stage /> : <Board />);

export default DebugReader;
