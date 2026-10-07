/* ── A pack's page ──
   What a pack is, what is in it, and one button. On your shelf, that button
   studies every deck in the pack as one session (the review room mixes them,
   decks/session.ts); not yet added, it adds the pack.

   The decks inside are drawn as decks — the same DeckTile the library uses —
   once they are on your shelf, so opening one goes to its own page with Back
   returning here. Before that they are a plain list: there is nothing to open
   yet that is not on this page already.

   Administrators also get the pack's lifecycle here (publish, unpublish,
   archive) and Edit, which opens the pack sheet. Presentational only. */

import React, { useState } from 'react';
import { tokens } from '../ui/kit';
import { COLLECTION_COPY } from './AudiencePicker';
import { DeckTile } from './Library';
import { PackArt, PackBadge, packAccent, packLine, packTotals } from './Packs';
import { STATE_COLOR, deckAccent, fmtUntil } from './theme';
import { Icon, MasteryBar, MoreMenu, StatusPill, masteryPct, pill } from './ui';
import type { DeckStatus, DeckSummary, Pack } from './types';

interface Props {
  pack: Pack;
  /** The decks of this pack on your shelf. */
  decks: DeckSummary[];
  dark: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onStudy: () => void;
  onAdd: () => Promise<void>;
  onRemove: () => void;
  onOpenDeck: (id: string) => void;
  onReviewDeck: (id: string) => void;
  /** Administrators. */
  onEdit?: () => void;
  onSetStatus?: (s: DeckStatus) => void;
  onDelete?: () => void;
}

const STATUS_LINE = (pack: Pack): Record<DeckStatus, string> => ({
  draft: `Only admins can see this pack. Publishing it publishes its draft decks too, into ${COLLECTION_COPY[pack.collection].title}.`,
  published: `Live in ${COLLECTION_COPY[pack.collection].title} for every student.`,
  archived: 'Hidden from the library. Students who already added it keep studying it.',
});

const PackView: React.FC<Props> = ({ pack, decks, dark, isAdmin, onBack, onStudy, onAdd, onRemove, onOpenDeck, onReviewDeck, onEdit, onSetStatus, onDelete }) => {
  const t = tokens(dark);
  const accent = packAccent(pack, dark);
  const sum = packTotals(decks);
  const [adding, setAdding] = useState(false);
  const added = pack.inLibrary || decks.length > 0;
  const onShelf = new Set(decks.map(d => d.id));
  const missing = pack.decks.filter(d => !onShelf.has(d.id));
  const when = fmtUntil(sum.nextDue);
  const c = STATE_COLOR(dark);

  const add = async () => { setAdding(true); try { await onAdd(); } finally { setAdding(false); } };

  return (
    <div className="space-y-8 font-ui">
      <button onClick={onBack} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 ${t.muted}`}>
        {Icon.back} Decks
      </button>

      {/* The pack */}
      <section className={`mk-rise relative overflow-hidden rounded-2xl border ${t.card}`}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 110% at 100% 0%, ${accent}${dark ? '24' : '17'}, transparent 62%)` }} />
        <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center p-7 md:p-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <PackBadge dark={dark} label="Alpha pack" />
              <span className={`text-[12px] font-semibold ${t.faint}`}>{packLine(pack)}</span>
            </div>
            <h1 className={`font-display text-[36px] md:text-[48px] leading-[1.02] mt-4 ${t.heading}`}>{pack.title}</h1>
            {pack.description && <p className={`text-[15px] leading-relaxed mt-3 max-w-[560px] ${t.body}`}>{pack.description}</p>}

            {added ? (
              <>
                <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-7">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Today</p>
                    <p className={`num-hero text-[48px] leading-none mt-2 ${t.heading}`}>{sum.today}</p>
                  </div>
                  {sum.today > 0 && (
                    <div className="flex items-center gap-4 pb-1.5 text-[13px]">
                      <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.new }} /><b className={`num-stat ${t.heading}`}>{sum.newAvailable}</b> new</span>
                      <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.due }} /><b className={`num-stat ${t.heading}`}>{sum.due}</b> to review</span>
                    </div>
                  )}
                  <div className="min-w-[180px] flex-1 max-w-[280px] pb-2">
                    <MasteryBar m={sum} dark={dark} />
                    <p className={`text-[11px] mt-2 ${t.faint}`}>{sum.total ? `${masteryPct(sum)}% mastered` : 'No cards yet'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-7">
                  {sum.today > 0 ? (
                    <button onClick={onStudy} className={pill.redLg}>Study the pack {Icon.arrow}</button>
                  ) : (
                    <span className={`inline-flex items-center gap-2 h-14 px-6 rounded-full text-[15px] font-bold ${dark ? 'bg-white/[0.04] text-zinc-200' : 'bg-zinc-100 text-zinc-800'}`}>
                      <span style={{ color: c.due }}>{Icon.check}</span>
                      {sum.total ? `Done for today${when && when !== 'now' ? ` · next ${when}` : ''}` : 'No cards yet'}
                    </span>
                  )}
                  {missing.filter(d => d.status !== 'draft').length > 0 && (
                    <button disabled={adding} onClick={() => void add()} className={pill.quiet(dark)}>{adding ? 'Adding…' : <>{Icon.plus}Add the other {missing.length === 1 ? 'deck' : `${missing.length} decks`}</>}</button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-8">
                <button disabled={adding} onClick={() => void add()} className={pill.redLg}>{adding ? 'Adding…' : <>{Icon.plus}Add pack</>}</button>
                <button disabled={adding} onClick={onStudy} className={`${pill.ghost(dark)} !h-14 !px-7 !text-[15px]`}>Start studying</button>
              </div>
            )}
          </div>

          <div className="hidden md:block"><PackArt dark={dark} decks={pack.decks} size={230} /></div>
        </div>
      </section>

      {isAdmin && onSetStatus && (
        <section className={`mk-rise rounded-2xl border px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3 ${dark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-white/60 border-zinc-200/80'}`}>
          <StatusPill status={pack.status} dark={dark} />
          <p className={`text-[13px] flex-1 min-w-[220px] ${t.body}`}>{STATUS_LINE(pack)[pack.status]}</p>
          <div className="flex items-center gap-2">
            {onEdit && <button onClick={onEdit} className={pill.quiet(dark)}>{Icon.pencil}Edit pack</button>}
            {pack.status === 'draft' && <button onClick={() => onSetStatus('published')} className={`${pill.red} !h-10`}>Publish pack</button>}
            {pack.status === 'archived' && <button onClick={() => onSetStatus('published')} className={`${pill.ghost(dark)} !h-10`}>Publish again</button>}
            <MoreMenu
              dark={dark}
              quiet
              label="Pack actions"
              items={[
                { label: 'Unpublish', icon: Icon.pause, onSelect: () => onSetStatus('draft'), hidden: pack.status !== 'published' },
                { label: 'Archive', icon: Icon.trash, onSelect: () => onSetStatus('archived'), hidden: pack.status !== 'published' },
                { label: 'Remove from my decks', icon: Icon.trash, onSelect: onRemove, hidden: !added },
                { label: 'Delete pack', icon: Icon.trash, onSelect: () => onDelete?.(), hidden: !onDelete, danger: true },
              ]}
            />
          </div>
        </section>
      )}

      {/* What is inside */}
      <section>
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <div className="flex items-baseline gap-3">
            <h2 className={`font-display text-[22px] ${t.heading}`}>Decks in this pack</h2>
            <span className={`num-stat text-[14px] ${t.faint}`}>{pack.decks.length}</span>
          </div>
          {added && !isAdmin && (
            <MoreMenu dark={dark} quiet label="Pack actions" items={[{ label: 'Remove pack', icon: Icon.trash, onSelect: onRemove, danger: true }]} />
          )}
        </div>

        {pack.decks.length === 0 ? (
          <div className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center ${dark ? 'border-white/[0.08]' : 'border-zinc-300/70'}`}>
            <p className={`text-[16px] font-bold ${t.heading}`}>No decks in this pack yet.</p>
            <p className={`text-[13px] mt-1 ${t.muted}`}>{isAdmin ? 'Edit the pack to choose its decks.' : 'Check back soon.'}</p>
            {isAdmin && onEdit && <button onClick={onEdit} className={`mt-5 ${pill.ghost(dark)}`}>{Icon.pencil}Choose decks</button>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-7 pt-3">
            {pack.decks.map((pd, i) => {
              const d = decks.find(x => x.id === pd.id);
              if (d) return <DeckTile key={pd.id} deck={d} dark={dark} delay={i * 40} onOpen={() => onOpenDeck(d.id)} onReview={() => onReviewDeck(d.id)} />;
              const a = deckAccent(pd.subject, dark);
              return (
                <div key={pd.id} className={`mk-rise rounded-2xl border p-5 md:p-6 flex flex-col min-h-[180px] ${t.card}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5 ${t.faint}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: a }} />
                    {pd.subject ?? 'Alpha deck'}
                    {pd.status === 'draft' && <span className="ml-1"><StatusPill status="draft" dark={dark} /></span>}
                  </p>
                  <h3 className={`font-display text-[20px] leading-[1.15] mt-3 ${t.heading}`}>{pd.title}</h3>
                  <div className="flex-1" />
                  <p className={`text-[12px] mt-5 ${t.faint}`}>{pd.cards.toLocaleString()} {pd.cards === 1 ? 'card' : 'cards'}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PackView;
