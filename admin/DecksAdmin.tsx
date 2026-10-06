/* ── Console → Decks ──
   Every Alpha-wide deck, grouped by the shelf students find it on — Alpha
   Essentials first, then More from Alpha — with how it is being used and its
   lifecycle. Content is edited in the Decks tab (one editor, not two), so each
   row opens there; moving a deck between shelves is one click here.

   Aggregates only. `admin_deck_stats()` returns counts and an again-rate per
   deck; there is no endpoint that tells anybody which student is studying
   what, or how any one of them is doing, and this screen does not want one.

   Loaded lazily from AdminTab so decks/api stays out of the main bundle. */

import React, { useCallback, useEffect, useState } from 'react';
import { fetchAdminStats, humanError, setDeckCollection, setDeckStatus } from '../decks/api';
import { deckAccent } from '../decks/theme';
import { COLLECTION_COPY } from '../decks/AudiencePicker';
import { Icon, MoreMenu, StackArt, StatusPill, fmtAgo, pill } from '../decks/ui';
import type { AdminDeckStat, DeckCollection, DeckStatus } from '../decks/types';

interface Props {
  theme: 'dark' | 'light';
  /** Null: just go to the Decks tab (to create one). */
  onOpenDeck: (id: string | null) => void;
  /** The design board's fixtures; the real console always asks the database. */
  loadStats?: () => Promise<AdminDeckStat[]>;
}

const CONFIRM: Record<DeckStatus, string> = {
  published: 'Publish this deck? Every student will see it in the Alpha library.',
  draft: 'Unpublish this deck? Students who have it lose it until you publish it again. Their progress is kept.',
  archived: 'Archive this deck? It leaves the library. Students who already have it keep studying it.',
};

/* Fixed columns, the action one included: a grid per row sizes `auto` per row, and the figures stop lining up under their headings. */
const GRID = 'md:grid-cols-[minmax(0,1fr)_104px_repeat(4,72px)_148px]';

const DecksAdmin: React.FC<Props> = ({ theme, onOpenDeck, loadStats = fetchAdminStats }) => {
  const dark = theme === 'dark';
  const [rows, setRows] = useState<AdminDeckStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    loadStats().then(r => { setRows(r); setError(null); }).catch(e => setError(humanError(e)));
  }, [loadStats]);
  useEffect(load, [load]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); load(); } catch (e) { setError(humanError(e)); } finally { setBusy(null); }
  };
  const move = (d: AdminDeckStat, status: DeckStatus) => {
    if (!window.confirm(CONFIRM[status])) return;
    void act(d.id, () => setDeckStatus(d.id, status));
  };
  const shelve = (d: AdminDeckStat, c: DeckCollection) => void act(d.id, () => setDeckCollection(d.id, c));

  const card = `rounded-2xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const live = rows?.filter(r => r.status === 'published').length ?? 0;
  const students = rows?.reduce((n, r) => n + (r.status === 'published' ? r.students : 0), 0) ?? 0;

  /* Nothing yet: a start screen, not a grey line. */
  if (rows && rows.length === 0) {
    return (
      <section className={`${card} relative overflow-hidden font-ui`}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 90% at 90% 20%, rgba(225,6,0,${dark ? '0.10' : '0.06'}), transparent 70%)` }} />
        <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-8 p-8 md:p-12">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>Alpha decks</p>
            <h3 className={`font-display text-[32px] md:text-[38px] leading-[1.05] mt-3 ${heading}`}>Make the first deck every student gets.</h3>
            <p className="text-[14px] leading-relaxed mt-3 max-w-[460px] text-zinc-500">
              Create or import a deck in Decks and choose <b>Everyone on Alpha</b>. Put the must-haves in <b>Alpha Essentials</b> — they're shown first, big and up front. It stays a draft until you publish.
            </p>
            <button onClick={() => onOpenDeck(null)} className={`mt-7 ${pill.redLg}`}>Go to Decks</button>
          </div>
          <div className="hidden md:block"><StackArt dark={dark} accent="#E10600" check={false} size={150} /></div>
        </div>
      </section>
    );
  }

  const shelf = (c: DeckCollection) => (rows ?? []).filter(r => r.collection === c);

  return (
    <section className="space-y-6 font-ui">
      <div className={`${card} p-6 md:p-7 flex flex-wrap items-end justify-between gap-5`}>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>Alpha decks</p>
          <p className={`font-display text-[26px] leading-tight mt-2 ${heading}`}>
            {rows ? `${live} live · ${students.toLocaleString()} ${students === 1 ? 'student' : 'students'}` : '…'}
          </p>
          <p className="text-[13px] mt-1.5 text-zinc-500">To make one, create a deck in Decks and choose <b>Everyone on Alpha</b>. It starts as a draft.</p>
        </div>
        <button onClick={() => onOpenDeck(null)} className={pill.red}>Go to Decks</button>
      </div>

      {error && <p className="text-[13px] text-rose-500">{error}</p>}

      {!rows ? (
        <div className={`${card} h-40`} aria-busy="true" />
      ) : (
        (['essentials', 'more'] as const).map(c => {
          const list = shelf(c);
          const other: DeckCollection = c === 'essentials' ? 'more' : 'essentials';
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <div className="flex items-baseline gap-2.5">
                  <h3 className={`font-display text-[20px] ${heading}`}>{COLLECTION_COPY[c].title}</h3>
                  <span className={`num-stat text-[13px] ${faint}`}>{list.length}</span>
                </div>
                <p className="text-[12px] text-zinc-500 hidden sm:block">{COLLECTION_COPY[c].line}</p>
              </div>
              <div className={`${card} overflow-hidden`}>
                {list.length === 0 ? (
                  <p className="px-6 py-8 text-center text-[13px] text-zinc-500">
                    {c === 'essentials'
                      ? 'No Essentials yet. Move a deck here, or pick Alpha Essentials when you create one.'
                      : 'Nothing here yet. New Alpha decks land here unless you pick Essentials.'}
                  </p>
                ) : (
                  <>
                    <div className={`hidden md:grid ${GRID} gap-4 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.08em] ${faint} ${dark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`}>
                      <span>Deck</span><span>Status</span>
                      <span className="text-right">Cards</span><span className="text-right">Students</span>
                      <span className="text-right">Active 7d</span><span className="text-right">Again</span>
                      <span />
                    </div>
                    <ul className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
                      {list.map(d => (
                        <li key={d.id} className={`grid ${GRID} gap-x-4 gap-y-2 items-center px-6 py-4`}>
                          <button onClick={() => onOpenDeck(d.id)} className="text-left min-w-0 group">
                            <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: deckAccent(d.subject, dark) }} />
                              {d.subject ?? 'No subject'}{d.chapter ? ` · ${d.chapter}` : ''}
                            </span>
                            <span className={`block text-[15px] font-bold truncate mt-1 group-hover:underline ${heading}`}>{d.title}</span>
                            <span className={`block text-[11px] mt-0.5 ${faint}`}>updated {fmtAgo(d.updatedAt)}</span>
                          </button>
                          <span><StatusPill status={d.status} dark={dark} /></span>
                          {[d.cards, d.students, d.active7d].map((n, i) => (
                            <span key={i} className={`num-stat text-[15px] md:text-right tabular-nums ${heading}`}>
                              <span className={`md:hidden text-[11px] font-ui font-semibold mr-1.5 ${faint}`}>{['Cards', 'Students', 'Active 7d'][i]}</span>
                              {n.toLocaleString()}
                            </span>
                          ))}
                          <span className={`num-stat text-[15px] md:text-right tabular-nums ${heading}`}>
                            <span className={`md:hidden text-[11px] font-ui font-semibold mr-1.5 ${faint}`}>Again</span>
                            {d.againRate === null ? <span className={faint}>—</span> : `${Math.round(d.againRate * 100)}%`}
                          </span>
                          {/* One visible action per row — the next step in its life — and the rest one tap away. */}
                          <span className="flex items-center gap-1 md:justify-end">
                            {d.status === 'draft' && <button disabled={busy === d.id} onClick={() => move(d, 'published')} className={`${pill.red} !h-9 !px-4 !text-[13px]`}>Publish</button>}
                            {d.status === 'archived' && <button disabled={busy === d.id} onClick={() => move(d, 'published')} className={pill.quiet(dark)}>Publish again</button>}
                            <MoreMenu
                              dark={dark}
                              quiet
                              label={`Actions for ${d.title}`}
                              items={[
                                { label: `Move to ${COLLECTION_COPY[other].title}`, icon: Icon.arrow, onSelect: () => shelve(d, other) },
                                { label: 'Open in Decks', icon: Icon.pencil, onSelect: () => onOpenDeck(d.id) },
                                { label: 'Unpublish', icon: Icon.pause, onSelect: () => move(d, 'draft'), hidden: d.status !== 'published' },
                                { label: 'Archive', icon: Icon.trash, onSelect: () => move(d, 'archived'), hidden: d.status !== 'published', danger: true },
                              ]}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
      <p className={`text-[12px] ${faint}`}>"Again" is how often students pressed Again on cards they had already learned, over the last 30 days. A high number means the cards may need fixing.</p>
    </section>
  );
};

export default DecksAdmin;
