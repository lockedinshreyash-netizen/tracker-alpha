/* ── Reading a formula sheet ──
   Every formula of a sheet on one page, for revising at a glance, which is
   what a sheet is for. Built for a laptop first and a phone second: entries
   flow in columns (three on a wide screen, two on a laptop, one on a phone),
   section by section, and never split across a column.

   Three controls, because each answers a real use:
   - Search, to find one formula fast. `/` focuses it.
   - Cover answers: the formulas (or a sentence's marked answers) are hidden
     until hovered or tapped, so the same page doubles as a quick self-test.
   - Jump links to each section.

   The sheet is read through `sheet_notes` (supabase/decks.sql §11), never
   as deck notes: owning a sheet lets you read its decks as a sheet, not
   study them as cards. On screen only: while it is open the page prints a
   single line instead (index.css, `html.sh-reading`), and there is no
   print button anywhere. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Switch, tokens } from '../ui/kit';
import { deckAccent } from './theme';
import { Icon, MoreMenu } from './ui';
import { sheetNotes, humanError } from '../store/api';
import { groupEntries, searchEntries } from '../store/model';
import { Formula } from '../store/sheets/Formula';
import { sheetNumber } from '../store/sheets/SheetPaper';
import { sheetLine, type Sheet, type SheetEntry } from '../store/types';

const COVER_KEY = 'alpha_sheet_cover_v1';

interface Props {
  sheet: Sheet;
  dark: boolean;
  backLabel?: string;
  onBack: () => void;
  onRemove?: () => void;
  /** The design board passes fixtures; the app asks the database. */
  load?: (id: string) => Promise<SheetEntry[]>;
}

const SheetView = ({ sheet, dark, backLabel = 'Decks', onBack, onRemove, load = sheetNotes }: Props) => {
  const t = tokens(dark);
  const [entries, setEntries] = useState<SheetEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cover, setCoverState] = useState(() => { try { return localStorage.getItem(COVER_KEY) === '1'; } catch { return false; } });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const search = useRef<HTMLInputElement>(null);
  const accent = deckAccent(sheet.subject, dark);

  useEffect(() => {
    let live = true;
    setEntries(null);
    setError(null);
    load(sheet.id).then(e => { if (live) setEntries(e); }, e => { if (live) setError(humanError(e)); });
    return () => { live = false; };
  }, [sheet.id, load]);

  // Never printed: while a sheet is open the page prints one line instead.
  useEffect(() => {
    document.documentElement.classList.add('sh-reading');
    return () => document.documentElement.classList.remove('sh-reading');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest('input, textarea, [contenteditable="true"]'));
      if (e.key === '/' && !typing) { e.preventDefault(); search.current?.focus(); }
      if (e.key === 'Escape' && document.activeElement === search.current) { setQuery(''); search.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setCover = (v: boolean) => {
    setCoverState(v);
    setOpen(new Set());
    try { localStorage.setItem(COVER_KEY, v ? '1' : '0'); } catch { /* private mode */ }
  };

  const shown = useMemo(() => (entries ? searchEntries(entries, query) : null), [entries, query]);
  const sections = useMemo(() => (shown ? groupEntries(shown) : []), [shown]);
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const surface: React.CSSProperties = {
    ['--sh-ink' as string]: dark ? '#fafafa' : '#18181b',
    ['--sh-muted' as string]: dark ? '#a1a1aa' : '#71717a',
    ['--sh-rule' as string]: dark ? 'rgba(255,255,255,0.07)' : 'rgba(24,24,27,0.08)',
    ['--sh-cover' as string]: dark ? 'rgba(255,255,255,0.09)' : 'rgba(24,24,27,0.08)',
  };

  return (
    <div className="font-ui sh-screen">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 ${t.muted}`}>
          {Icon.back} {backLabel}
        </button>
        {onRemove && (
          <MoreMenu dark={dark} quiet label="Sheet actions" items={[{ label: 'Remove from My Alpha', icon: Icon.trash, onSelect: onRemove, danger: true }]} />
        )}
      </div>

      <header className="mk-rise mt-5 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] flex items-center gap-2 ${t.faint}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
            {sheetNumber(sheet.sheetNo)}{sheet.subject ? ` · ${sheet.subject}` : ''}{sheet.examLine ? ` · ${sheet.examLine}` : ''}
          </p>
          <h1 className={`font-display text-[34px] md:text-[44px] leading-[1] mt-3 ${t.heading}`}>{sheet.title}</h1>
          <p className={`text-[13px] mt-2 ${t.muted}`}>{sheetLine(sheet)}</p>
        </div>
      </header>

      {/* The controls stay in reach while you read. */}
      <div className={`sticky top-[calc(var(--safe-top,0px)+64px)] md:top-3 z-10 mt-6 -mx-2 px-2 py-2 rounded-xl ${dark ? 'bg-[#0B0B0D]/85' : 'bg-[#F2F0EC]/85'} backdrop-blur-md`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`flex-1 min-w-[200px] flex items-center gap-2 h-11 px-3.5 rounded-full border ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'} focus-within:border-[#E10600]`}>
            <span className={t.faint}>{Icon.search}</span>
            <input
              ref={search}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search this sheet"
              aria-label="Search this sheet"
              className={`flex-1 min-w-0 bg-transparent outline-none text-[14px] ${t.heading} ${dark ? 'placeholder:text-zinc-600' : 'placeholder:text-zinc-400'}`}
            />
            {query ? (
              <button onClick={() => setQuery('')} className={`text-[12px] font-semibold ${t.muted}`}>Clear</button>
            ) : (
              <kbd className={`dk-key hidden md:inline-flex ${dark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>/</kbd>
            )}
          </label>
          <label className={`inline-flex items-center gap-2.5 h-11 pl-4 pr-2 rounded-full border text-[13px] font-semibold ${dark ? 'bg-[#111114] border-white/[0.08] text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'}`}>
            Cover answers
            <Switch dark={dark} on={cover} onToggle={setCover} label="Cover answers" />
          </label>
        </div>
        {entries && groupEntries(entries).length > 1 && !query && (
          <nav aria-label="Sections" className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5">
            {groupEntries(entries).map(s => (
              <a key={s.deckId} href={`#sh-${s.deckId}`} className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${dark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/[0.05]'}`}>
                {s.title} <span className={t.faint}>{s.entries.length}</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className={`mt-6 ${cover ? 'sh-covered' : ''}`} style={surface}>
        {error ? (
          <div className={`rounded-2xl border p-10 text-center ${t.card}`}>
            <p className={`font-display text-[22px] ${t.heading}`}>Couldn't open this sheet.</p>
            <p className={`text-[14px] mt-2 ${t.muted}`}>{error}</p>
          </div>
        ) : shown === null ? (
          <div className={`rounded-2xl border p-6 md:p-8 ${t.card}`} aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex justify-between gap-6 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--sh-rule)' }}>
                <span className={`h-3 rounded ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`} style={{ width: `${25 + ((i * 13) % 20)}%` }} />
                <span className={`h-3 rounded ${dark ? 'bg-white/[0.09]' : 'bg-zinc-200'}`} style={{ width: `${20 + ((i * 7) % 18)}%` }} />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className={`rounded-2xl border p-10 text-center ${t.card}`}>
            <p className={`font-display text-[22px] ${t.heading}`}>{query ? `Nothing matches "${query}".` : 'This sheet is empty for now.'}</p>
            <p className={`text-[14px] mt-2 ${t.muted}`}>{query ? 'Try fewer words, or part of a formula.' : 'Alpha is still writing it. Check back soon.'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map(s => (
              <section key={s.deckId} id={`sh-${s.deckId}`} className={`scroll-mt-40 rounded-2xl border p-5 md:p-8 ${t.card}`}>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <h2 className={`font-display text-[20px] md:text-[22px] ${t.heading}`}>{s.title}</h2>
                  <span className={`num-stat text-[13px] ${t.faint}`}>{s.entries.length}</span>
                </div>
                <div className="sh-cols">
                  {s.entries.map(e => (
                    <div
                      key={e.noteId}
                      className="sh-entry"
                      data-open={open.has(e.noteId) ? 'true' : undefined}
                      onClick={cover ? () => toggle(e.noteId) : undefined}
                      role={cover ? 'button' : undefined}
                      tabIndex={cover ? 0 : undefined}
                      onKeyDown={cover ? ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(e.noteId); } } : undefined}
                      style={{ ['--sh-accent' as string]: accent }}
                    >
                      <Formula entry={e} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetView;
