/* ── Console → Decks ──
   Every Alpha-wide deck, grouped by the shelf students find it on — Alpha
   Essentials first, then More from Alpha — with how it is being used and its
   lifecycle. Content is edited in the Decks tab (one editor, not two), so each
   row opens there; moving a deck between shelves is one click here.

   Above the shelves, Alpha packs: sets of Alpha decks that hang in the
   store. Made here (New pack), priced here (free / paid / Alpha Pro), and
   published here; publishing a pack publishes its draft decks with it.

   Aggregates only. `admin_deck_stats()` returns counts and an again-rate per
   deck; there is no endpoint that tells anybody which student is studying
   what, or how any one of them is doing, and this screen does not want one.

   Loaded lazily from AdminTab so decks/api stays out of the main bundle. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  createPack, deletePack, fetchAdminPacks, fetchAdminStats, humanError, setDeckCollection, setDeckStatus, setPackDecks, setPackStatus, updatePack,
} from '../decks/api';
import { deckAccent } from '../decks/theme';
import { COLLECTION_COPY } from '../decks/AudiencePicker';
import { PackArt } from '../decks/Packs';
import { PackSheet } from '../decks/PackSheet';
import { packNumber, priceLabel } from '../decks/store/PackCard';
import { rackName } from '../decks/store/racks';
import { Icon, MoreMenu, StackArt, StatusPill, fmtAgo, pill } from '../decks/ui';
import type { AdminDeckStat, DeckCollection, DeckStatus, Pack, PackMeta } from '../decks/types';

/** What the console does to packs. The design board swaps in fakes. */
export interface PackOps {
  load: () => Promise<Pack[]>;
  create: (meta: PackMeta) => Promise<string>;
  update: (id: string, meta: Partial<PackMeta>) => Promise<void>;
  setDecks: (id: string, deckIds: string[]) => Promise<void>;
  setStatus: (id: string, status: DeckStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const REAL_PACKS: PackOps = {
  load: fetchAdminPacks,
  create: createPack,
  update: updatePack,
  setDecks: setPackDecks,
  setStatus: (id, st) => setPackStatus(id, st, true),
  remove: deletePack,
};

const PACK_CONFIRM: Record<DeckStatus, string> = {
  published: 'Publish this pack? It goes on the store racks for every student, and its draft decks are published with it.',
  draft: 'Unpublish this pack? It leaves the store. Students who already have it keep it.',
  archived: 'Archive this pack? It leaves the store. Students who already have it keep studying it.',
};

interface Props {
  theme: 'dark' | 'light';
  /** Null: just go to the Decks tab (to create one). */
  onOpenDeck: (id: string | null) => void;
  /** The design board's fixtures; the real console always asks the database. */
  loadStats?: () => Promise<AdminDeckStat[]>;
  packOps?: PackOps;
}

const CONFIRM: Record<DeckStatus, string> = {
  published: 'Publish this deck? Every student will see it in the Alpha library.',
  draft: 'Unpublish this deck? Students who have it lose it until you publish it again. Their progress is kept.',
  archived: 'Archive this deck? It leaves the library. Students who already have it keep studying it.',
};

/* Fixed columns, the action one included: a grid per row sizes `auto` per row, and the figures stop lining up under their headings. */
const GRID = 'md:grid-cols-[minmax(0,1fr)_104px_repeat(4,72px)_148px]';

const DecksAdmin: React.FC<Props> = ({ theme, onOpenDeck, loadStats = fetchAdminStats, packOps = REAL_PACKS }) => {
  const dark = theme === 'dark';
  const [rows, setRows] = useState<AdminDeckStat[] | null>(null);
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ pack: Pack | null } | null>(null);

  const load = useCallback(() => {
    loadStats().then(r => { setRows(r); setError(null); }).catch(e => setError(humanError(e)));
    // Packs arrive with the rest; a database without them yet just shows none.
    packOps.load().then(setPacks).catch(() => setPacks([]));
  }, [loadStats, packOps]);
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
  const movePack = (p: Pack, status: DeckStatus) => {
    if (!window.confirm(PACK_CONFIRM[status])) return;
    void act(p.id, () => packOps.setStatus(p.id, status));
  };
  const removePack = (p: Pack) => {
    if (!window.confirm(`Delete the pack "${p.title}"? Its decks stay, as Alpha decks on their own. This can't be undone.`)) return;
    void act(p.id, () => packOps.remove(p.id));
  };

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

      <PacksSection
        dark={dark}
        packs={packs}
        busy={busy}
        onNew={() => setSheet({ pack: null })}
        onEdit={p => setSheet({ pack: p })}
        onStatus={movePack}
        onDelete={removePack}
      />

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
                            <span className={`block text-[11px] mt-0.5 ${faint}`}>{d.packTitle ? `in ${d.packTitle} · ` : ''}updated {fmtAgo(d.updatedAt)}</span>
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

      {sheet && (
        <PackSheet
          dark={dark}
          pack={sheet.pack}
          decks={rows ?? []}
          onClose={() => setSheet(null)}
          onSave={async (meta, deckIds) => {
            try {
              const id = sheet.pack ? sheet.pack.id : await packOps.create(meta);
              if (sheet.pack) await packOps.update(id, meta);
              await packOps.setDecks(id, deckIds);
              load();
            } catch (e) {
              throw new Error(humanError(e));
            }
          }}
        />
      )}
    </section>
  );
};

/* ── Alpha packs ── */

const PACK_GRID = 'md:grid-cols-[minmax(0,1fr)_104px_repeat(3,72px)_148px]';

const PacksSection: React.FC<{
  dark: boolean;
  packs: Pack[] | null;
  busy: string | null;
  onNew: () => void;
  onEdit: (p: Pack) => void;
  onStatus: (p: Pack, s: DeckStatus) => void;
  onDelete: (p: Pack) => void;
}> = ({ dark, packs, busy, onNew, onEdit, onStatus, onDelete }) => {
  const card = `rounded-2xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  if (!packs) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className={`font-display text-[20px] ${heading}`}>Alpha packs</h3>
          <span className={`num-stat text-[13px] ${faint}`}>{packs.length}</span>
        </div>
        {packs.length > 0 && <button onClick={onNew} className={`${pill.red} !h-9 !px-4 !text-[13px]`}>{Icon.plus}New pack</button>}
      </div>
      {packs.length === 0 ? (
        <div className={`${card} grid md:grid-cols-[auto_1fr_auto] items-center gap-6 p-6 md:p-7`}>
          <div className="hidden md:block"><PackArt dark={dark} decks={[{ subject: 'Physics' }, { subject: 'Physics' }, { subject: 'Physics' }]} count={3} size={110} /></div>
          <div>
            <p className={`text-[16px] font-bold ${heading}`}>Bundle decks into a pack.</p>
            <p className="text-[13px] mt-1 text-zinc-500 max-w-[480px]">Physics Essentials: Kinematics, Laws of Motion, Work & Energy. Packs hang on their subject's rack in the Alpha Packs store, and students take the whole pack in one tap.</p>
          </div>
          <button onClick={onNew} className={pill.red}>{Icon.plus}New pack</button>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className={`hidden md:grid ${PACK_GRID} gap-4 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.08em] ${faint} ${dark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`}>
            <span>Pack</span><span>Status</span>
            <span className="text-right">Decks</span><span className="text-right">Cards</span><span className="text-right">Students</span>
            <span />
          </div>
          <ul className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
            {packs.map(p => {
              const cards = p.decks.reduce((n, d) => n + d.cards, 0);
              return (
                <li key={p.id} className={`grid ${PACK_GRID} gap-x-4 gap-y-2 items-center px-6 py-4`}>
                  <button onClick={() => onEdit(p)} className="text-left min-w-0 group">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: deckAccent(p.subject, dark) }} />
                      {packNumber(p.packNo)} · {rackName(p.subject)} rack · {p.access === 'pro' ? 'Alpha Pro' : priceLabel(p) === 'FREE' ? 'Free' : priceLabel(p)} · {p.finish === 'paper' ? 'White' : 'Black'}
                    </span>
                    <span className={`block text-[15px] font-bold truncate mt-1 group-hover:underline ${heading}`}>{p.title}</span>
                    <span className={`block text-[11px] mt-0.5 truncate ${faint}`}>{p.decks.map(d => d.title).join(' · ') || 'No decks yet'}</span>
                  </button>
                  <span><StatusPill status={p.status} dark={dark} /></span>
                  {[p.decks.length, cards, p.students].map((n, i) => (
                    <span key={i} className={`num-stat text-[15px] md:text-right tabular-nums ${heading}`}>
                      <span className={`md:hidden text-[11px] font-ui font-semibold mr-1.5 ${faint}`}>{['Decks', 'Cards', 'Students'][i]}</span>
                      {n.toLocaleString()}
                    </span>
                  ))}
                  <span className="flex items-center gap-1 md:justify-end">
                    {p.status === 'draft' && <button disabled={busy === p.id || !p.decks.length} onClick={() => onStatus(p, 'published')} className={`${pill.red} !h-9 !px-4 !text-[13px]`}>Publish</button>}
                    {p.status === 'archived' && <button disabled={busy === p.id} onClick={() => onStatus(p, 'published')} className={pill.quiet(dark)}>Publish again</button>}
                    <MoreMenu
                      dark={dark}
                      quiet
                      label={`Actions for ${p.title}`}
                      items={[
                        { label: 'Edit pack', icon: Icon.pencil, onSelect: () => onEdit(p) },
                        { label: 'Unpublish', icon: Icon.pause, onSelect: () => onStatus(p, 'draft'), hidden: p.status !== 'published' },
                        { label: 'Archive', icon: Icon.trash, onSelect: () => onStatus(p, 'archived'), hidden: p.status !== 'published' },
                        { label: 'Delete pack', icon: Icon.trash, onSelect: () => onDelete(p), danger: true },
                      ]}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DecksAdmin;
