/* ── Making a subject kit ──
   Administrators only. Beside the fields is the box itself, drawn by the
   store's own KitBox from what has been typed (name on the lid, the subject's
   line, the finish), turning toward the pointer as it will on the table.

   What goes in it is picked across the three kinds the store has: packs,
   sheets and Alpha decks (never a sheet's formula sets on their own, and
   never a personal deck). Order is the order "What's in the box" shows.
   A free kit holding paid things gives them away, and the editor says so
   before you save. Saving writes the details, then the contents
   (`set_kit_items`) in one statement. A new kit is always a draft. */

import React, { useMemo, useState } from 'react';
import { Sheet as SheetShell } from '../../ui/kit';
import { deckAccent } from '../../decks/theme';
import { Icon, StatusPill, pill } from '../../decks/ui';
import type { AdminDeckStat, DeckSubject, Pack, PackAccess } from '../../decks/types';
import { KitBox } from '../kits/KitBox';
import { kitLine, type Kit, type KitFinish, type KitItem, type KitItemKind, type KitMeta, type Sheet } from '../types';
import { AccessPick, ArrowDown, ArrowUp, Cross, IconBtn, Segment, SubjectPick, choice, inputCls, labelCls, optional } from './fields';

interface Props {
  dark: boolean;
  kit: Kit | null;
  packs: Pack[];
  sheets: Sheet[];
  decks: AdminDeckStat[];
  onClose: () => void;
  onSave: (meta: KitMeta, items: { kind: KitItemKind; id: string }[]) => Promise<void>;
}

type Ref = { kind: KitItemKind; id: string };
const key = (r: Ref) => `${r.kind}:${r.id}`;

const KitEditor = ({ dark, kit, packs, sheets, decks, onClose, onSave }: Props) => {
  const editing = !!kit;
  const [title, setTitle] = useState(kit?.title ?? '');
  const [tagline, setTagline] = useState(kit?.tagline ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [examLine, setExamLine] = useState(kit?.examLine ?? '');
  const [subject, setSubject] = useState<DeckSubject | null>(kit?.subject ?? null);
  const [finish, setFinish] = useState<KitFinish>(kit?.finish ?? 'white');
  const [access, setAccess] = useState<PackAccess>(kit?.access ?? 'free');
  const [price, setPrice] = useState(kit?.priceInr ? String(kit.priceInr) : '199');
  const [chosen, setChosen] = useState<Ref[]>(kit?.items.map(i => ({ kind: i.kind, id: i.id })) ?? []);
  const [tab, setTab] = useState<KitItemKind>('pack');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const rupees = Math.round(Number(price));
  const flashDecks = useMemo(() => decks.filter(d => d.collection !== 'sheet'), [decks]);

  /** Everything that can go in a box, as the box lists it. */
  const all: KitItem[] = useMemo(() => [
    ...packs.map(p => ({ kind: 'pack' as const, id: p.id, title: p.title, subject: p.subject, status: p.status, count: p.decks.reduce((n, d) => n + d.cards, 0), decks: p.decks.length, finish: p.finish, packNo: p.packNo })),
    ...sheets.map(s => ({ kind: 'sheet' as const, id: s.id, title: s.title, subject: s.subject, status: s.status, count: s.entries })),
    ...flashDecks.map(d => ({ kind: 'deck' as const, id: d.id, title: d.title, subject: d.subject, status: d.status, count: d.cards })),
  ], [packs, sheets, flashDecks]);
  const byKey = useMemo(() => new Map(all.map(i => [key(i), i])), [all]);
  const picked = chosen.map(r => byKey.get(key(r))).filter((i): i is KitItem => !!i);
  const pickedKeys = new Set(chosen.map(key));

  const paidInside = picked.filter(i =>
    (i.kind === 'pack' && packs.find(p => p.id === i.id)?.access !== 'free') || (i.kind === 'sheet' && sheets.find(s => s.id === i.id)?.access !== 'free'));

  const rest = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter(i => i.kind === tab && !pickedKeys.has(key(i)))
      .filter(i => !q || i.title.toLowerCase().includes(q))
      .sort((a, b) => Number(b.subject === subject) - Number(a.subject === subject) || a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, search, subject, chosen]);

  const move = (i: number, by: -1 | 1) => setChosen(list => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const submit = async () => {
    if (!title.trim() || busy) return;
    if (access === 'paid' && !(rupees >= 1 && rupees <= 99999)) { setError('Set a price between ₹1 and ₹99,999.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(), tagline: tagline.trim() || null, description: description.trim() || null, subject,
        examLine: examLine.trim() || null, finish, access, priceInr: access === 'paid' ? rupees : null,
      }, chosen);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const row = 'flex items-center gap-3 px-3 py-2.5 rounded-xl';
  const KIND: Record<KitItemKind, string> = { pack: 'Pack', sheet: 'Sheet', deck: 'Deck' };

  return (
    <SheetShell
      dark={dark}
      onClose={onClose}
      label={editing ? 'Edit kit' : 'New kit'}
      width="md:w-[920px]"
      header={
        <div className="px-5 md:px-7 py-4">
          <p className={`font-display text-[20px] leading-tight ${heading}`}>{editing ? 'Edit kit' : 'New subject kit'}</p>
          <p className="text-[12px] font-ui mt-0.5 text-zinc-500">A box of packs, sheets and decks. Taking the kit unlocks everything in it.</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className="flex-1 text-[13px] text-rose-500 min-w-0">{error ?? (!editing && <span className="text-zinc-500">It starts as a draft. Only admins see it until you publish.</span>)}</p>
          <button onClick={onClose} className={pill.quiet(dark)}>Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim() || busy} className={pill.red}>{busy ? 'Saving…' : editing ? 'Save' : 'Create kit'}</button>
        </div>
      }
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_280px] gap-7 md:gap-8 px-5 md:px-7 py-6 font-ui">
        <aside className="order-first md:order-last md:sticky md:top-6 self-start">
          <div className={`rounded-2xl border flex justify-center py-4 ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={{ background: dark ? 'radial-gradient(120% 80% at 50% 0%, #26262c, #18181c)' : 'radial-gradient(120% 80% at 50% 0%, #ffffff, #ebe8e2)' }}>
            <KitBox kit={{ title: title.trim() || 'Name your kit', kitNo: kit?.kitNo ?? 0, subject, examLine: examLine.trim() || null, finish }} size={196} interactive />
          </div>
          <p className={`text-[12px] leading-snug mt-3 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{kitLine(picked)}. Students see it on the store's Kits table.</p>
          {access === 'free' && paidInside.length > 0 && (
            <p className={`text-[12px] mt-3 rounded-lg border px-3 py-2.5 ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              This kit is free and holds {paidInside.length} paid {paidInside.length === 1 ? 'item' : 'items'}. Anyone who takes the kit gets {paidInside.length === 1 ? 'it' : 'them'} free.
            </p>
          )}
        </aside>

        <div className="min-w-0 space-y-7">
          <div className="space-y-4">
            <div>
              <label className={labelCls(dark)} htmlFor="kt-title">Name</label>
              <input id="kt-title" autoFocus value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Physics Kit" className={`${inputCls(dark)} h-14 text-[20px] font-bold`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="kt-tag">Tagline {optional}</label>
              <input id="kt-tag" value={tagline} maxLength={120} onChange={e => setTagline(e.target.value)} placeholder="Everything for mechanics." className={`${inputCls(dark)} h-11 text-[14px]`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="kt-desc">About {optional}</label>
              <input id="kt-desc" value={description} maxLength={600} onChange={e => setDescription(e.target.value)} placeholder="The packs, sheets and decks to finish Class 11 Physics." className={`${inputCls(dark)} h-11 text-[14px]`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="kt-exam">Exam line {optional}</label>
              <input id="kt-exam" value={examLine} maxLength={60} onChange={e => setExamLine(e.target.value)} placeholder="JEE • PCM" className={`${inputCls(dark)} h-11 text-[14px] uppercase tracking-[0.06em]`} />
            </div>
          </div>

          <SubjectPick dark={dark} value={subject} onChange={setSubject} />

          <div role="radiogroup" aria-label="The box">
            <p className={labelCls(dark)}>The box</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'white', t: 'White', l: 'Matte white, ink type.' },
                { v: 'black', t: 'Black', l: 'Matte black, white type.' },
              ] as const).map(o => (
                <button key={o.v} type="button" role="radio" aria-checked={finish === o.v} onClick={() => setFinish(o.v)} className={`${choice(finish === o.v, dark)} flex items-center gap-3`}>
                  <span aria-hidden className="w-9 h-7 rounded-md shrink-0" style={{ background: o.v === 'white' ? 'linear-gradient(160deg,#fff,#e4e2dc)' : 'linear-gradient(160deg,#2c2c31,#0d0d0f)', boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.25)' }} />
                  <span className="min-w-0">
                    <span className={`block text-[14px] font-bold ${heading}`}>{o.t}</span>
                    <span className="block text-[12px] mt-0.5 text-zinc-500">{o.l}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <AccessPick dark={dark} access={access} onAccess={setAccess} price={price} onPrice={setPrice} noun="kit" />

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className={labelCls(dark).replace('mb-2.5', 'mb-0')}>What's in the box</p>
              <span className={`text-[12px] ${faint}`}>{picked.length ? kitLine(picked) : ''}</span>
            </div>
            {picked.length === 0 ? (
              <div className={`rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] ${dark ? 'border-white/[0.08] text-zinc-500' : 'border-zinc-200 text-zinc-500'}`}>
                Pick packs, sheets and decks from below. Students see them in this order.
              </div>
            ) : (
              <ol className={`rounded-xl p-1.5 space-y-1 ${dark ? 'bg-white/[0.025] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`}>
                {picked.map((it, i) => (
                  <li key={key(it)} className={`${row} ${dark ? 'bg-[#16161a]' : 'bg-white shadow-sm'}`}>
                    <span className={`num-stat text-[12px] w-4 text-center ${faint}`}>{i + 1}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deckAccent(it.subject, dark) }} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] font-semibold truncate ${heading}`}>{it.title}</span>
                      <span className={`block text-[11px] ${faint}`}>{KIND[it.kind]} · {it.count.toLocaleString()} {it.kind === 'sheet' ? 'formulas' : 'cards'}{it.status === 'draft' ? ' · draft, published with the kit' : ''}</span>
                    </span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <IconBtn dark={dark} label={`Move ${it.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>{ArrowUp}</IconBtn>
                      <IconBtn dark={dark} label={`Move ${it.title} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>{ArrowDown}</IconBtn>
                      <IconBtn dark={dark} label={`Take ${it.title} out`} onClick={() => setChosen(l => l.filter(x => key(x) !== key(it)))}>{Cross}</IconBtn>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <Segment<KitItemKind> dark={dark} value={tab} onChange={setTab} options={[['pack', 'Packs', false], ['sheet', 'Sheets', false], ['deck', 'Decks', false]]} />
              <label className={`flex items-center gap-2 h-9 px-3 rounded-full w-[200px] ${dark ? 'bg-white/[0.04] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                {Icon.search}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find" aria-label="Find" className={`bg-transparent outline-none text-[13px] w-full ${heading}`} />
              </label>
            </div>
            {rest.length === 0 ? (
              <p className={`text-[13px] py-4 ${faint}`}>{search ? 'Nothing matches that.' : `No more ${tab}s to add.`}</p>
            ) : (
              <ul className="space-y-1 max-h-[260px] overflow-y-auto overscroll-contain -mx-1 px-1">
                {rest.map(it => (
                  <li key={key(it)}>
                    <button onClick={() => setChosen(l => [...l, { kind: it.kind, id: it.id }])} className={`${row} w-full text-left transition-colors ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-zinc-50'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.06] text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>{Icon.plus}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deckAccent(it.subject, dark) }} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] font-semibold truncate ${heading}`}>{it.title}</span>
                        <span className={`block text-[11px] ${faint}`}>{it.count.toLocaleString()} {it.kind === 'sheet' ? 'formulas' : 'cards'}</span>
                      </span>
                      {it.status !== 'published' && <StatusPill status={it.status} dark={dark} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SheetShell>
  );
};

export default KitEditor;
