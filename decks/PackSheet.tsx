/* ── Making a pack ──
   Administrators only. A pack is made for one place, the Alpha Packs store,
   so the sheet is built around that place rather than around a form:

   - On the right, the pack itself on a hook. It is drawn by the same
     PackCard the store hangs, from what has been typed so far. It is exactly
     what students will see on the rack, name, number of cards, exam line,
     price and packaging included.
   - On the left, only what decides that object: its words, which rack it
     hangs on (its subject; none is the "More packs" rack), its packaging
     (black or white), how it is had (free, paid, Alpha Pro), and its decks.

   There is no "where should students find it?" question. Decks have shelves;
   a pack does not. It is seen on its rack in the store and nowhere else, and
   the sheet says so in one line under the preview.

   A deck lives in at most one pack. Picking one already in another pack says
   so on the row ("moves from Physical Chemistry") rather than failing.
   Saving writes the details, then the deck list (`set_pack_decks`) in one
   statement, so a pack is never half assembled. A new pack is always a
   draft. A price is not a promise of payment: until a provider is wired, a
   paid pack is one nobody can take, and the sheet says that too. */

import React, { useMemo, useState } from 'react';
import { Sheet } from '../ui/kit';
import { PackCard } from './store/PackCard';
import { HookBack, HookFront } from './store/PackHook';
import { PackRail, wallStyle } from './store/PackRail';
import { geometry } from './store/geometry';
import { useRackSize } from './store/env';
import { RACK_NAME, rackName } from './store/racks';
import { deckAccent } from './theme';
import { Icon, StatusPill, pill } from './ui';
import type { AdminDeckStat, DeckSubject, Pack, PackAccess, PackFinish, PackMeta } from './types';

const SUBJECTS: DeckSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];

const inputCls = (dark: boolean) => `w-full rounded-xl px-4 outline-none font-ui ${dark
  ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25] placeholder:text-zinc-700'
  : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-300'}`;
const labelCls = (dark: boolean) => `block text-[10px] font-bold uppercase tracking-[0.08em] font-ui mb-2.5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
const optional = <span className="normal-case tracking-normal font-semibold opacity-70">· optional</span>;

/** A selected option: ink on the page, never the action red. */
const choice = (on: boolean, dark: boolean) => `text-left rounded-xl px-3.5 py-3 transition-all ${on
  ? (dark ? 'bg-white/[0.06] ring-2 ring-white' : 'bg-white ring-2 ring-zinc-900')
  : dark ? 'ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.03]' : 'ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`;

const ArrowUp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>;
const ArrowDown = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
const Cross = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

export const PackSheet: React.FC<{
  dark: boolean;
  /** Present when editing. */
  pack: Pack | null;
  /** Every Alpha deck — the console's list. */
  decks: AdminDeckStat[];
  onClose: () => void;
  onSave: (meta: PackMeta, deckIds: string[]) => Promise<void>;
}> = ({ dark, pack, decks, onClose, onSave }) => {
  const editing = !!pack;
  const [title, setTitle] = useState(pack?.title ?? '');
  const [description, setDescription] = useState(pack?.description ?? '');
  const [examLine, setExamLine] = useState(pack?.examLine ?? '');
  const [subject, setSubject] = useState<DeckSubject | null>(pack?.subject ?? null);
  const [finish, setFinish] = useState<PackFinish>(pack?.finish ?? 'ink');
  const [access, setAccess] = useState<PackAccess>(pack?.access ?? 'free');
  const [price, setPrice] = useState(pack?.priceInr ? String(pack.priceInr) : '49');
  const [chosen, setChosen] = useState<string[]>(pack?.decks.map(d => d.id) ?? []);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = dark ? 'text-white' : 'text-zinc-900';
  const body = dark ? 'text-zinc-300' : 'text-zinc-700';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const byId = useMemo(() => new Map(decks.map(d => [d.id, d])), [decks]);
  const picked = chosen.map(id => byId.get(id)).filter((d): d is AdminDeckStat => !!d);
  const rupees = Math.round(Number(price));

  // The rest, this rack's subject first, then by name. Search is over title and chapter.
  const rest = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decks
      .filter(d => !chosen.includes(d.id))
      .filter(d => !q || d.title.toLowerCase().includes(q) || (d.chapter ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(b.subject === subject) - Number(a.subject === subject) || a.title.localeCompare(b.title));
  }, [decks, chosen, search, subject]);

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
        title: title.trim(), description: description.trim() || null, subject, finish,
        access, priceInr: access === 'paid' ? rupees : null, examLine: examLine.trim() || null,
      }, chosen);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // What the rack will show, from the form as it stands.
  const preview = {
    title: title.trim() || 'Name your pack',
    packNo: pack?.packNo ?? 0,
    subject,
    decks: picked.map(d => ({ id: d.id, title: d.title, subject: d.subject, status: d.status, cards: d.cards })),
    examLine: examLine.trim() || null,
    access,
    priceInr: access === 'paid' && rupees >= 1 ? rupees : null,
    finish,
    status: 'published' as const,
  };

  const row = `flex items-center gap-3 px-3 py-2.5 rounded-xl`;

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label={editing ? 'Edit pack' : 'New pack'}
      width="md:w-[880px]"
      header={
        <div className="px-5 md:px-7 py-4">
          <p className={`font-display text-[20px] leading-tight ${heading}`}>{editing ? 'Edit pack' : 'New Alpha pack'}</p>
          <p className="text-[12px] font-ui mt-0.5 text-zinc-500">Made for the Alpha Packs store. Students take the whole pack in one tap.</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className="flex-1 text-[13px] text-rose-500 min-w-0">{error ?? (!editing && <span className="text-zinc-500">It starts as a draft. Only admins see it until you publish.</span>)}</p>
          <button onClick={onClose} className={pill.quiet(dark)}>Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim() || busy} className={pill.red}>{busy ? 'Saving…' : editing ? 'Save' : 'Create pack'}</button>
        </div>
      }
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_268px] gap-7 md:gap-8 px-5 md:px-7 py-6 font-ui">
        {/* The pack as it will hang. First on a phone, beside the form on a desk. */}
        <aside className="order-first md:order-last md:sticky md:top-6 self-start">
          <PackPreview dark={dark} pack={preview} />
          <p className={`text-[12px] leading-snug mt-3 ${body}`}>
            Students see it on the <b className={heading}>{rackName(subject)}</b> rack in the Alpha Packs store. Packs aren't shown anywhere else.
          </p>
        </aside>

        <div className="min-w-0 space-y-7">
          <div className="space-y-4">
            <div>
              <label className={labelCls(dark)} htmlFor="pk-title">Name</label>
              <input id="pk-title" autoFocus value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Physics Essentials" className={`${inputCls(dark)} h-14 text-[20px] font-bold`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="pk-desc">About {optional}</label>
              <input id="pk-desc" value={description} maxLength={600} onChange={e => setDescription(e.target.value)} placeholder="The formulas you should know cold." className={`${inputCls(dark)} h-11 text-[14px]`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="pk-exam">Exam line {optional}</label>
              <input id="pk-exam" value={examLine} maxLength={60} onChange={e => setExamLine(e.target.value)} placeholder="JEE • PCM" className={`${inputCls(dark)} h-11 text-[14px] uppercase tracking-[0.06em]`} />
            </div>
          </div>

          {/* Where it hangs: the only "where" a pack has. */}
          <div role="radiogroup" aria-label="Which rack?">
            <p className={labelCls(dark)}>Which rack?</p>
            <div className="flex flex-wrap gap-2">
              {[...SUBJECTS, null].map(s => {
                const on = subject === s;
                const c = s ? deckAccent(s, dark) : dark ? '#e4e4e7' : '#27272a';
                return (
                  <button key={s ?? 'more'} type="button" role="radio" aria-checked={on} onClick={() => setSubject(s)}
                    className={`h-10 pl-3 pr-4 rounded-full flex items-center gap-2 text-[13px] font-semibold transition-all ${on ? '' : dark ? 'text-zinc-400 ring-1 ring-inset ring-white/[0.08] hover:text-zinc-200' : 'text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:text-zinc-900'}`}
                    style={on ? { background: `${c}22`, boxShadow: `inset 0 0 0 1.5px ${c}`, color: dark ? '#fff' : '#18181b' } : undefined}>
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                    {s ? RACK_NAME[s] : 'More packs'}
                  </button>
                );
              })}
            </div>
          </div>

          <div role="radiogroup" aria-label="Packaging">
            <p className={labelCls(dark)}>Packaging</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'ink', t: 'Black', l: 'Bold. Good for the big packs.' },
                { v: 'paper', t: 'White', l: 'Light. Good for quick packs.' },
              ] as const).map(o => {
                const on = finish === o.v;
                return (
                  <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => setFinish(o.v)} className={`${choice(on, dark)} flex items-center gap-3`}>
                    <Swatch finish={o.v} />
                    <span className="min-w-0">
                      <span className={`block text-[14px] font-bold ${heading}`}>{o.t}</span>
                      <span className="block text-[12px] mt-0.5 text-zinc-500">{o.l}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div role="radiogroup" aria-label="How do students get it?">
            <p className={labelCls(dark)}>How do students get it?</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'free', t: 'Free', l: 'Anyone can add it.' },
                { v: 'paid', t: 'Paid', l: 'A one-time price.' },
                { v: 'pro', t: 'Alpha Pro', l: 'Included with Pro.' },
              ] as const).map(o => (
                <button key={o.v} type="button" role="radio" aria-checked={access === o.v} onClick={() => setAccess(o.v)} className={choice(access === o.v, dark)}>
                  <span className={`block text-[14px] font-bold ${heading}`}>{o.t}</span>
                  <span className="block text-[12px] mt-0.5 text-zinc-500">{o.l}</span>
                </button>
              ))}
            </div>
            {access === 'paid' && (
              <div className="mt-3 flex items-center gap-3 mk-sheet">
                <label className={`flex items-center h-11 w-[140px] shrink-0 rounded-xl px-4 ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.08]' : 'bg-white ring-1 ring-inset ring-zinc-200'}`}>
                  <span className={`text-[16px] font-bold ${faint}`}>₹</span>
                  <input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} aria-label="Price in rupees" className={`bg-transparent outline-none text-[16px] font-bold w-full ml-1.5 ${heading}`} />
                </label>
                <p className="text-[12px] text-zinc-500 leading-snug">Payments aren't live yet. Until they are, nobody can take a paid pack.</p>
              </div>
            )}
            {access === 'pro' && <p className="text-[12px] text-zinc-500 mt-3">Alpha Pro isn't live yet. Pro packs open for members once it is.</p>}
          </div>

          {/* The decks, in order */}
          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className={labelCls(dark).replace('mb-2.5', 'mb-0')}>Decks in this pack</p>
              <span className={`text-[12px] ${faint}`}>{picked.length ? `${picked.length} ${picked.length === 1 ? 'deck' : 'decks'} · ${picked.reduce((n, d) => n + d.cards, 0).toLocaleString()} cards` : ''}</span>
            </div>
            {picked.length === 0 ? (
              <div className={`rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] ${dark ? 'border-white/[0.08] text-zinc-500' : 'border-zinc-200 text-zinc-500'}`}>
                Pick decks from the list below. Students see them in this order.
              </div>
            ) : (
              <ol className={`rounded-xl p-1.5 space-y-1 ${dark ? 'bg-white/[0.025] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`}>
                {picked.map((d, i) => (
                  <li key={d.id} className={`${row} ${dark ? 'bg-[#16161a]' : 'bg-white shadow-sm'}`}>
                    <span className={`num-stat text-[12px] w-4 text-center ${faint}`}>{i + 1}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deckAccent(d.subject, dark) }} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] font-semibold truncate ${heading}`}>{d.title}</span>
                      <span className={`block text-[11px] ${faint}`}>
                        {d.cards.toLocaleString()} cards
                        {d.status === 'draft' && ' · draft, published with the pack'}
                        {d.packId && d.packId !== pack?.id && ` · moves from ${d.packTitle ?? 'another pack'}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <IconBtn dark={dark} label={`Move ${d.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>{ArrowUp}</IconBtn>
                      <IconBtn dark={dark} label={`Move ${d.title} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>{ArrowDown}</IconBtn>
                      <IconBtn dark={dark} label={`Take ${d.title} out`} onClick={() => setChosen(l => l.filter(x => x !== d.id))}>{Cross}</IconBtn>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <p className={labelCls(dark).replace('mb-2.5', 'mb-0')}>Add decks</p>
              <label className={`flex items-center gap-2 h-9 px-3 rounded-full w-[200px] ${dark ? 'bg-white/[0.04] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                {Icon.search}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a deck" aria-label="Find a deck" className={`bg-transparent outline-none text-[13px] w-full ${heading}`} />
              </label>
            </div>
            {decks.length === 0 ? (
              <p className={`text-[13px] py-4 ${faint}`}>No Alpha decks yet. Create one in Decks and choose Everyone on Alpha.</p>
            ) : rest.length === 0 ? (
              <p className={`text-[13px] py-4 ${faint}`}>{search ? 'No deck matches that.' : 'Every Alpha deck is in this pack.'}</p>
            ) : (
              <ul className="space-y-1 max-h-[280px] overflow-y-auto overscroll-contain -mx-1 px-1">
                {rest.map(d => (
                  <li key={d.id}>
                    <button
                      onClick={() => setChosen(l => [...l, d.id])}
                      className={`${row} w-full text-left transition-colors ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-zinc-50'}`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.06] text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>{Icon.plus}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deckAccent(d.subject, dark) }} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] font-semibold truncate ${heading}`}>{d.title}</span>
                        <span className={`block text-[11px] ${faint}`}>
                          {d.cards.toLocaleString()} cards{d.packTitle ? ` · in ${d.packTitle}` : ''}
                        </span>
                      </span>
                      {d.status !== 'published' && <StatusPill status={d.status} dark={dark} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
};

/* ── The preview: one hook, one pack, on a strip of the store's wall ── */

type PreviewPack = React.ComponentProps<typeof PackCard>['pack'];

const PackPreview: React.FC<{ dark: boolean; pack: PreviewPack }> = ({ dark, pack }) => {
  const phone = useRackSize().w < 170;
  const w = phone ? 132 : 182;
  const h = Math.round(w * 1.505);
  const g = useMemo(() => geometry(w, h, pack.packNo || 1), [w, h, pack.packNo]);
  const width = phone ? w + 120 : 268;
  const pivotY = 40;
  const k = w / 198;
  return (
    <div className={`rounded-2xl border pt-3 ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={wallStyle(dark)} aria-label="How the pack will look on the rack" role="img">
      <div className="relative mx-auto" style={{ width, height: pivotY - g.pivot.y + h + 26 }}>
        <PackRail width={width} dark={dark} brackets={[18, width - 18]} />
        <HookBack x={width / 2} pivotY={pivotY} dark={dark} scale={k} />
        {/* Re-keyed on what changes the object, so a new choice gives it a small swing. */}
        <div key={`${pack.finish}|${pack.subject}|${pack.access}`} className="pk-swing absolute" style={{ left: width / 2 - w / 2, top: pivotY - g.pivot.y, transformOrigin: `${g.pivot.x}px ${g.pivot.y}px` }}>
          <PackCard pack={pack} w={w} h={h} geo={g} style={{ ['--pk-shadow-o' as string]: dark ? 0.6 : 0.2 }} />
        </div>
        <HookFront x={width / 2} pivotY={pivotY} dark={dark} scale={k} />
      </div>
    </div>
  );
};

/** A tiny pack in each finish, for the packaging choice. */
const Swatch: React.FC<{ finish: PackFinish }> = ({ finish }) => {
  const ink = finish === 'ink';
  return (
    <svg width="26" height="36" viewBox="0 0 26 36" aria-hidden className="shrink-0">
      <path d="M8 1h10a2 2 0 0 1 2 2v4h4a2 2 0 0 1 2 2v25a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4V3a2 2 0 0 1 2-2Z"
        fill={ink ? '#111114' : '#f6f4ef'} stroke={ink ? 'rgba(255,255,255,0.18)' : 'rgba(24,24,27,0.18)'} />
      <rect x="10" y="3.5" width="6" height="2" rx="1" fill={ink ? '#2a2a30' : '#d9d5cc'} />
      <rect x="4" y="14" width="12" height="2.5" rx="1" fill={ink ? '#fafafa' : '#18181b'} />
      <rect x="4" y="19" width="16" height="2.5" rx="1" fill={ink ? '#fafafa' : '#18181b'} />
    </svg>
  );
};

const IconBtn: React.FC<{ dark: boolean; label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ dark, label, disabled, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${dark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
  >
    {children}
  </button>
);
