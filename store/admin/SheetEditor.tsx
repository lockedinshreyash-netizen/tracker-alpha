/* ── Making a formula sheet ──
   Administrators only. Built around the object, like the pack editor: beside
   the fields is the sheet itself, printed with the first formulas of the
   sections chosen so far, exactly as it will stand on the store's shelf.

   A sheet is made of sections, and a section is an Alpha deck: a formula set
   imported "for formula sheets" (Import formulas), or any Alpha flashcard
   deck, whose cards then also read as a sheet. "Start from a pack" adds a
   pack's decks in one go. Taking a formula set off the sheet deletes it with
   its formulas, because it exists only to be on a sheet; the row says so
   before you press it. Saving writes the details, then the sections
   (`set_sheet_decks`) in one statement. A new sheet is always a draft. */

import React, { useEffect, useMemo, useState } from 'react';
import { Sheet as SheetShell } from '../../ui/kit';
import { listNotes } from '../../decks/api';
import { deckAccent } from '../../decks/theme';
import { Icon, StatusPill, pill } from '../../decks/ui';
import type { AdminDeckStat, DeckSubject, Pack, PackAccess } from '../../decks/types';
import { SheetPaper } from '../sheets/SheetPaper';
import type { FormulaEntry } from '../sheets/Formula';
import type { Sheet, SheetMeta } from '../types';
import { AccessPick, ArrowDown, ArrowUp, Cross, IconBtn, SubjectPick, inputCls, labelCls, optional } from './fields';

interface Props {
  dark: boolean;
  sheet: Sheet | null;
  /** Every Alpha deck, formula sets included (the console's list). */
  decks: AdminDeckStat[];
  packs: Pack[];
  onClose: () => void;
  onSave: (meta: SheetMeta, deckIds: string[]) => Promise<void>;
  /** Import a formulas file straight onto this sheet (existing sheets only). */
  onImport?: () => void;
}

const SheetEditor = ({ dark, sheet, decks, packs, onClose, onSave, onImport }: Props) => {
  const editing = !!sheet;
  const [title, setTitle] = useState(sheet?.title ?? '');
  const [description, setDescription] = useState(sheet?.description ?? '');
  const [examLine, setExamLine] = useState(sheet?.examLine ?? '');
  const [subject, setSubject] = useState<DeckSubject | null>(sheet?.subject ?? null);
  const [access, setAccess] = useState<PackAccess>(sheet?.access ?? 'free');
  const [price, setPrice] = useState(sheet?.priceInr ? String(sheet.priceInr) : '29');
  const [chosen, setChosen] = useState<string[]>(sheet?.decks.map(d => d.id) ?? []);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<FormulaEntry[] | null>(null);

  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const byId = useMemo(() => new Map(decks.map(d => [d.id, d])), [decks]);
  const picked = chosen.map(id => byId.get(id)).filter((d): d is AdminDeckStat => !!d);
  const rupees = Math.round(Number(price));

  const rest = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decks
      .filter(d => !chosen.includes(d.id))
      .filter(d => !q || d.title.toLowerCase().includes(q) || (d.chapter ?? '').toLowerCase().includes(q))
      // Formula sets first (they exist to be on a sheet), then this subject, then by name.
      .sort((a, b) => Number(b.collection === 'sheet') - Number(a.collection === 'sheet') || Number(b.subject === subject) - Number(a.subject === subject) || a.title.localeCompare(b.title));
  }, [decks, chosen, search, subject]);

  // The preview: the first formulas of the first sections, as they will print.
  const head = chosen.slice(0, 2).join('|');
  useEffect(() => {
    let live = true;
    const ids = head ? head.split('|') : [];
    if (!ids.length) { setEntries([]); return; }
    setEntries(null);
    Promise.all(ids.map(id => listNotes(id).then(r => r.notes).catch(() => [])))
      .then(lists => {
        if (!live) return;
        setEntries(lists.flat().slice(0, 6).map(n => ({ deckId: n.deckId, kind: n.kind, front: n.front, back: n.back })));
      });
    return () => { live = false; };
  }, [head]);

  const move = (i: number, by: -1 | 1) => setChosen(list => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const fromPack = (packId: string) => {
    const p = packs.find(x => x.id === packId);
    if (!p) return;
    setChosen(list => [...list, ...p.decks.map(d => d.id).filter(id => !list.includes(id) && byId.has(id))]);
    if (!subject && p.subject) setSubject(p.subject);
  };

  const submit = async () => {
    if (!title.trim() || busy) return;
    if (access === 'paid' && !(rupees >= 1 && rupees <= 99999)) { setError('Set a price between ₹1 and ₹99,999.'); return; }
    const dropping = (sheet?.decks ?? []).filter(d => !chosen.includes(d.id) && byId.get(d.id)?.collection === 'sheet');
    if (dropping.length && !window.confirm(`Taking ${dropping.map(d => `"${d.title}"`).join(', ')} off this sheet deletes ${dropping.length === 1 ? 'that formula set' : 'those formula sets'} and ${dropping.length === 1 ? 'its' : 'their'} formulas, unless another sheet uses ${dropping.length === 1 ? 'it' : 'them'}. Go ahead?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(), description: description.trim() || null, subject, examLine: examLine.trim() || null,
        access, priceInr: access === 'paid' ? rupees : null,
      }, chosen);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const total = picked.reduce((n, d) => n + d.cards, 0);
  const row = 'flex items-center gap-3 px-3 py-2.5 rounded-xl';

  return (
    <SheetShell
      dark={dark}
      onClose={onClose}
      label={editing ? 'Edit sheet' : 'New sheet'}
      width="md:w-[900px]"
      header={
        <div className="px-5 md:px-7 py-4 flex items-center justify-between gap-4">
          <div>
            <p className={`font-display text-[20px] leading-tight ${heading}`}>{editing ? 'Edit formula sheet' : 'New formula sheet'}</p>
            <p className="text-[12px] font-ui mt-0.5 text-zinc-500">Every formula of its sections on one page, read in the store and in Decks.</p>
          </div>
          {onImport && <button onClick={onImport} className={pill.quiet(dark)}>{Icon.upload} Import formulas</button>}
        </div>
      }
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className="flex-1 text-[13px] text-rose-500 min-w-0">{error ?? (!editing && <span className="text-zinc-500">It starts as a draft. Only admins see it until you publish.</span>)}</p>
          <button onClick={onClose} className={pill.quiet(dark)}>Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim() || busy} className={pill.red}>{busy ? 'Saving…' : editing ? 'Save' : 'Create sheet'}</button>
        </div>
      }
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_260px] gap-7 md:gap-8 px-5 md:px-7 py-6 font-ui">
        <aside className="order-first md:order-last md:sticky md:top-6 self-start flex flex-col items-center">
          <div className={`w-full rounded-2xl border flex justify-center pt-6 pb-5 ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-zinc-200/80 bg-zinc-50'}`}>
            <SheetPaper sheet={{ title: title.trim() || 'Name your sheet', sheetNo: sheet?.sheetNo ?? 0, subject, examLine: examLine.trim() || null }} entries={entries} width={200} />
          </div>
          <p className={`text-[12px] leading-snug mt-3 self-start ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
            {picked.length ? `${total.toLocaleString()} ${total === 1 ? 'formula' : 'formulas'} in ${picked.length} ${picked.length === 1 ? 'section' : 'sections'}.` : 'Add a section to see it printed.'} Students see it on the store's Sheets shelf. It never prints.
          </p>
        </aside>

        <div className="min-w-0 space-y-7">
          <div className="space-y-4">
            <div>
              <label className={labelCls(dark)} htmlFor="sh-title">Name</label>
              <input id="sh-title" autoFocus value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Physics formulas" className={`${inputCls(dark)} h-14 text-[20px] font-bold`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="sh-desc">About {optional}</label>
              <input id="sh-desc" value={description} maxLength={600} onChange={e => setDescription(e.target.value)} placeholder="Every formula in Class 11 mechanics." className={`${inputCls(dark)} h-11 text-[14px]`} />
            </div>
            <div>
              <label className={labelCls(dark)} htmlFor="sh-exam">Exam line {optional}</label>
              <input id="sh-exam" value={examLine} maxLength={60} onChange={e => setExamLine(e.target.value)} placeholder="JEE Main" className={`${inputCls(dark)} h-11 text-[14px] uppercase tracking-[0.06em]`} />
            </div>
          </div>

          <SubjectPick dark={dark} value={subject} onChange={setSubject} />
          <AccessPick dark={dark} access={access} onAccess={setAccess} price={price} onPrice={setPrice} noun="sheet" />

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className={labelCls(dark).replace('mb-2.5', 'mb-0')}>Sections</p>
              {packs.length > 0 && (
                <select value="" onChange={e => { if (e.target.value) fromPack(e.target.value); }} aria-label="Start from a pack"
                  className={`h-9 rounded-full px-3 text-[12px] font-semibold outline-none cursor-pointer ${dark ? 'bg-white/[0.04] text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>
                  <option value="">Start from a pack…</option>
                  {packs.map(p => <option key={p.id} value={p.id}>{p.title} ({p.decks.length})</option>)}
                </select>
              )}
            </div>
            {picked.length === 0 ? (
              <div className={`rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] ${dark ? 'border-white/[0.08] text-zinc-500' : 'border-zinc-200 text-zinc-500'}`}>
                Pick sections from the list below, or import a formulas file. Students read them in this order.
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
                        {d.cards.toLocaleString()} {d.collection === 'sheet' ? 'formulas · formula set' : 'cards · Alpha deck'}
                        {d.status === 'draft' && ' · draft, published with the sheet'}
                      </span>
                    </span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <IconBtn dark={dark} label={`Move ${d.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>{ArrowUp}</IconBtn>
                      <IconBtn dark={dark} label={`Move ${d.title} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>{ArrowDown}</IconBtn>
                      <IconBtn dark={dark} label={d.collection === 'sheet' ? `Take ${d.title} off (deletes its formulas)` : `Take ${d.title} off`} onClick={() => setChosen(l => l.filter(x => x !== d.id))}>{Cross}</IconBtn>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <p className={labelCls(dark).replace('mb-2.5', 'mb-0')}>Add sections</p>
              <label className={`flex items-center gap-2 h-9 px-3 rounded-full w-[200px] ${dark ? 'bg-white/[0.04] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                {Icon.search}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a deck" aria-label="Find a deck" className={`bg-transparent outline-none text-[13px] w-full ${heading}`} />
              </label>
            </div>
            {decks.length === 0 ? (
              <p className={`text-[13px] py-4 ${faint}`}>No formula sets or Alpha decks yet. Import a formulas file to make the first.</p>
            ) : rest.length === 0 ? (
              <p className={`text-[13px] py-4 ${faint}`}>{search ? 'Nothing matches that.' : 'Everything is on this sheet.'}</p>
            ) : (
              <ul className="space-y-1 max-h-[260px] overflow-y-auto overscroll-contain -mx-1 px-1">
                {rest.map(d => (
                  <li key={d.id}>
                    <button onClick={() => setChosen(l => [...l, d.id])} className={`${row} w-full text-left transition-colors ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-zinc-50'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.06] text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>{Icon.plus}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deckAccent(d.subject, dark) }} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] font-semibold truncate ${heading}`}>{d.title}</span>
                        <span className={`block text-[11px] ${faint}`}>{d.cards.toLocaleString()} {d.collection === 'sheet' ? 'formulas · formula set' : `cards · Alpha deck${d.packTitle ? ` in ${d.packTitle}` : ''}`}</span>
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
    </SheetShell>
  );
};

export default SheetEditor;
