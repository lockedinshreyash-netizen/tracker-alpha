/* ── Console → Store ──
   The Alpha Store's kits and formula sheets: made here, priced here (free /
   paid / Alpha Pro) and published here. Publishing a kit or a sheet
   publishes its draft contents with it. Packs stay in the Decks section,
   beside the decks they are made of.

   Import formulas takes a CSV of formulas and asks what they are for: a
   formula sheet (a section of one, read on one page and never studied as
   cards) or a flashcard deck (an Alpha deck like any other). See
   store/admin/FormulaImport.tsx.

   Aggregates only, like Decks: how many students have each item, never who.
   Fixed grid columns, the action one included, and one visible action per
   row (the next step in its life) with the rest in its menu.

   Loaded lazily from AdminTab so the store's data layer stays out of the
   main bundle. */

import React, { useCallback, useEffect, useState } from 'react';
import { fetchAdminPacks, fetchAdminStats } from '../decks/api';
import { deckAccent } from '../decks/theme';
import { Icon, MoreMenu, StatusPill, pill } from '../decks/ui';
import { priceLabel } from '../decks/store/PackCard';
import type { AdminDeckStat, DeckStatus, Pack } from '../decks/types';
import {
  createKit, createSheet, deleteKit, deleteSheet, fetchAdminKits, fetchAdminSheets, humanError, setKitItems, setKitStatus,
  setSheetDecks, setSheetStatus, updateKit, updateSheet,
} from '../store/api';
import { KitBox, kitNumber } from '../store/kits/KitBox';
import { SheetPaper, sheetNumber } from '../store/sheets/SheetPaper';
import type { Kit, KitItemKind, KitMeta, Sheet, SheetMeta } from '../store/types';
import KitEditor from '../store/admin/KitEditor';
import SheetEditor from '../store/admin/SheetEditor';
import FormulaImport, { type ImportDone } from '../store/admin/FormulaImport';
import { pushToast } from '../notify/toastBus';
import { KITS_LAUNCHED } from '../store/launch';

/** What the console does. The design board swaps in fakes. */
export interface StoreAdminOps {
  kits: () => Promise<Kit[]>;
  sheets: () => Promise<Sheet[]>;
  decks: () => Promise<AdminDeckStat[]>;
  packs: () => Promise<Pack[]>;
  createKit: (m: KitMeta) => Promise<string>;
  updateKit: (id: string, m: Partial<KitMeta>) => Promise<void>;
  setKitItems: (id: string, items: { kind: KitItemKind; id: string }[]) => Promise<void>;
  setKitStatus: (id: string, s: DeckStatus) => Promise<void>;
  deleteKit: (id: string) => Promise<void>;
  createSheet: (m: SheetMeta) => Promise<string>;
  updateSheet: (id: string, m: Partial<SheetMeta>) => Promise<void>;
  setSheetDecks: (id: string, deckIds: string[]) => Promise<void>;
  setSheetStatus: (id: string, s: DeckStatus) => Promise<void>;
  deleteSheet: (id: string) => Promise<void>;
}

const REAL: StoreAdminOps = {
  kits: fetchAdminKits, sheets: fetchAdminSheets, decks: fetchAdminStats, packs: fetchAdminPacks,
  createKit, updateKit, setKitItems, setKitStatus, deleteKit,
  createSheet, updateSheet, setSheetDecks, setSheetStatus, deleteSheet,
};

const CONFIRM: Record<'kit' | 'sheet', Record<DeckStatus, string>> = {
  kit: {
    published: 'Publish this kit? It goes on the store\'s Kits table for every student, and its draft packs, sheets and decks are published with it.',
    draft: 'Unpublish this kit? It leaves the store. Students who already have it keep it.',
    archived: 'Archive this kit? It leaves the store. Students who already have it keep everything in it.',
  },
  sheet: {
    published: 'Publish this sheet? It goes on the store\'s Sheets shelf for every student, and its draft sections are published with it.',
    draft: 'Unpublish this sheet? It leaves the store. Students who already have it keep it.',
    archived: 'Archive this sheet? It leaves the store. Students who already have it keep reading it.',
  },
};

const GRID = 'md:grid-cols-[minmax(0,1fr)_104px_repeat(3,80px)_148px]';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
  /** Open an Alpha deck in the Decks tab (after importing formulas as a deck). */
  onOpenDeck: (id: string | null) => void;
  ops?: StoreAdminOps;
}

const StoreAdmin = ({ adminId, theme, onOpenDeck, ops = REAL }: Props) => {
  const dark = theme === 'dark';
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [decks, setDecks] = useState<AdminDeckStat[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [kitSheet, setKitSheet] = useState<{ kit: Kit | null } | null>(null);
  const [sheetSheet, setSheetSheet] = useState<{ sheet: Sheet | null } | null>(null);
  const [importing, setImporting] = useState<{ sheetId: string | null } | null>(null);

  const load = useCallback(async () => {
    // A database before the store's tables simply shows the start screens.
    await Promise.all([
      // Kits are not launched yet (store/launch.ts): nothing asks for them.
      KITS_LAUNCHED ? ops.kits().then(setKits, e => { setKits([]); setError(humanError(e)); }) : setKits([]),
      ops.sheets().then(setSheets, () => setSheets([])),
      ops.decks().then(setDecks, () => setDecks([])),
      ops.packs().then(setPacks, () => setPacks([])),
    ]);
  }, [ops]);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); await load(); } catch (e) { setError(humanError(e)); } finally { setBusy(null); }
  };
  const status = (kind: 'kit' | 'sheet', id: string, s: DeckStatus) => {
    if (!window.confirm(CONFIRM[kind][s])) return;
    void act(id, () => (kind === 'kit' ? ops.setKitStatus(id, s) : ops.setSheetStatus(id, s)));
  };

  const card = `rounded-2xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const live = (kits ?? []).filter(k => k.status === 'published').length + (sheets ?? []).filter(s => s.status === 'published').length;
  const students = (kits ?? []).reduce((n, k) => n + k.students, 0) + (sheets ?? []).reduce((n, s) => n + s.students, 0);
  const access = (x: Pick<Kit, 'access' | 'priceInr'>) => (x.access === 'pro' ? 'Alpha Pro' : priceLabel(x) === 'FREE' ? 'Free' : priceLabel(x));

  return (
    <section className="space-y-8 font-ui">
      <div className={`${card} p-6 md:p-7 flex flex-wrap items-end justify-between gap-5`}>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>Alpha Store</p>
          <p className={`font-display text-[26px] leading-tight mt-2 ${heading}`}>
            {kits && sheets ? `${live} live · ${students.toLocaleString()} ${students === 1 ? 'student' : 'students'}` : '…'}
          </p>
          <p className="text-[13px] mt-1.5 text-zinc-500">{KITS_LAUNCHED ? 'Kits and formula sheets.' : 'Formula sheets.'} Packs are made in the Decks section.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setImporting({ sheetId: null })} className={pill.red}>{Icon.upload}Import formulas</button>
          <button onClick={() => setSheetSheet({ sheet: null })} className={pill.ghost(dark)}>{Icon.plus}New sheet</button>
          {KITS_LAUNCHED && <button onClick={() => setKitSheet({ kit: null })} className={pill.ghost(dark)}>{Icon.plus}New kit</button>}
        </div>
      </div>

      {error && <p className="text-[13px] text-rose-500">{error}</p>}

      {KITS_LAUNCHED && (
      <>
      {/* ── Kits ── */}
      <div>
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-2.5">
            <h3 className={`font-display text-[20px] ${heading}`}>Kits</h3>
            <span className={`num-stat text-[13px] ${faint}`}>{kits?.length ?? ''}</span>
          </div>
          <p className="text-[12px] text-zinc-500 hidden sm:block">Boxes of packs, sheets and decks. Taking one unlocks everything in it.</p>
        </div>
        {!kits ? <div className={`${card} h-32`} aria-busy="true" /> : kits.length === 0 ? (
          <div className={`${card} grid md:grid-cols-[auto_1fr_auto] items-center gap-6 p-6 md:p-7`}>
            <div className="hidden md:block -my-4"><KitBox kit={{ title: 'Physics Kit', kitNo: 0, subject: 'Physics', examLine: null, finish: dark ? 'black' : 'white' }} size={120} /></div>
            <div>
              <p className={`text-[16px] font-bold ${heading}`}>Put a subject in a box.</p>
              <p className="text-[13px] mt-1 text-zinc-500 max-w-[480px]">Physics Kit: Physics Essentials, the mechanics formula sheet and two loose decks. Kits stand on the store's table, and students take the whole box in one tap.</p>
            </div>
            <button onClick={() => setKitSheet({ kit: null })} className={pill.red}>{Icon.plus}New kit</button>
          </div>
        ) : (
          <Table dark={dark} cols={['Kit', 'Status', 'Items', 'Students', 'Access']}>
            {kits.map(k => (
              <li key={k.id} className={`grid ${GRID} gap-x-4 gap-y-2 items-center px-6 py-4`}>
                <button onClick={() => setKitSheet({ kit: k })} className="text-left min-w-0 group">
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: deckAccent(k.subject, dark) }} />
                    {kitNumber(k.kitNo)} · {k.finish === 'black' ? 'Black' : 'White'} box
                  </span>
                  <span className={`block text-[15px] font-bold truncate mt-1 group-hover:underline ${heading}`}>{k.title}</span>
                  <span className={`block text-[11px] mt-0.5 truncate ${faint}`}>{k.items.map(i => i.title).join(' · ') || 'Empty'}</span>
                </button>
                <span><StatusPill status={k.status} dark={dark} /></span>
                <Num dark={dark} label="Items" value={k.items.length} />
                <Num dark={dark} label="Students" value={k.students} />
                <span className={`text-[13px] font-semibold md:text-right ${heading}`}>{access(k)}</span>
                <span className="flex items-center gap-1 md:justify-end">
                  {k.status === 'draft' && <button disabled={busy === k.id || !k.items.length} onClick={() => status('kit', k.id, 'published')} className={`${pill.red} !h-9 !px-4 !text-[13px]`}>Publish</button>}
                  {k.status === 'archived' && <button disabled={busy === k.id} onClick={() => status('kit', k.id, 'published')} className={pill.quiet(dark)}>Publish again</button>}
                  <MoreMenu dark={dark} quiet label={`Actions for ${k.title}`} items={[
                    { label: 'Edit kit', icon: Icon.pencil, onSelect: () => setKitSheet({ kit: k }) },
                    { label: 'Unpublish', icon: Icon.pause, onSelect: () => status('kit', k.id, 'draft'), hidden: k.status !== 'published' },
                    { label: 'Archive', icon: Icon.trash, onSelect: () => status('kit', k.id, 'archived'), hidden: k.status !== 'published' },
                    { label: 'Delete kit', icon: Icon.trash, danger: true, onSelect: () => {
                      if (!window.confirm(`Delete the kit "${k.title}"? What is in it stays, on its own. Students who took it lose the kit. This can't be undone.`)) return;
                      void act(k.id, () => ops.deleteKit(k.id));
                    } },
                  ]} />
                </span>
              </li>
            ))}
          </Table>
        )}
      </div>
      </>
      )}

      {/* ── Sheets ── */}
      <div>
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-2.5">
            <h3 className={`font-display text-[20px] ${heading}`}>Formula sheets</h3>
            <span className={`num-stat text-[13px] ${faint}`}>{sheets?.length ?? ''}</span>
          </div>
          <p className="text-[12px] text-zinc-500 hidden sm:block">Every formula of their sections on one page. Read on screen, never printed.</p>
        </div>
        {!sheets ? <div className={`${card} h-32`} aria-busy="true" /> : sheets.length === 0 ? (
          <div className={`${card} grid md:grid-cols-[auto_1fr_auto] items-center gap-6 p-6 md:p-7`}>
            <div className="hidden md:block"><SheetPaper sheet={{ title: 'Kinematics', sheetNo: 0, subject: 'Physics', examLine: null }} entries={null} width={84} lines={4} /></div>
            <div>
              <p className={`text-[16px] font-bold ${heading}`}>Start with a formulas file.</p>
              <p className="text-[13px] mt-1 text-zinc-500 max-w-[480px]">Import a CSV of formulas (name, formula, tags) and choose "A formula sheet". It becomes the first section of a new sheet. You can add more sections, or any Alpha deck, later.</p>
            </div>
            <button onClick={() => setImporting({ sheetId: null })} className={pill.red}>{Icon.upload}Import formulas</button>
          </div>
        ) : (
          <Table dark={dark} cols={['Sheet', 'Status', 'Sections', 'Formulas', 'Students']}>
            {sheets.map(s => (
              <li key={s.id} className={`grid ${GRID} gap-x-4 gap-y-2 items-center px-6 py-4`}>
                <button onClick={() => setSheetSheet({ sheet: s })} className="text-left min-w-0 group">
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: deckAccent(s.subject, dark) }} />
                    {sheetNumber(s.sheetNo)} · {access(s)}
                  </span>
                  <span className={`block text-[15px] font-bold truncate mt-1 group-hover:underline ${heading}`}>{s.title}</span>
                  <span className={`block text-[11px] mt-0.5 truncate ${faint}`}>{s.decks.map(d => d.title).join(' · ') || 'No sections yet'}</span>
                </button>
                <span><StatusPill status={s.status} dark={dark} /></span>
                <Num dark={dark} label="Sections" value={s.decks.length} />
                <Num dark={dark} label="Formulas" value={s.entries} />
                <Num dark={dark} label="Students" value={s.students} />
                <span className="flex items-center gap-1 md:justify-end">
                  {s.status === 'draft' && <button disabled={busy === s.id || !s.decks.length} onClick={() => status('sheet', s.id, 'published')} className={`${pill.red} !h-9 !px-4 !text-[13px]`}>Publish</button>}
                  {s.status === 'archived' && <button disabled={busy === s.id} onClick={() => status('sheet', s.id, 'published')} className={pill.quiet(dark)}>Publish again</button>}
                  <MoreMenu dark={dark} quiet label={`Actions for ${s.title}`} items={[
                    { label: 'Edit sheet', icon: Icon.pencil, onSelect: () => setSheetSheet({ sheet: s }) },
                    { label: 'Import formulas into it', icon: Icon.upload, onSelect: () => setImporting({ sheetId: s.id }) },
                    { label: 'Unpublish', icon: Icon.pause, onSelect: () => status('sheet', s.id, 'draft'), hidden: s.status !== 'published' },
                    { label: 'Archive', icon: Icon.trash, onSelect: () => status('sheet', s.id, 'archived'), hidden: s.status !== 'published' },
                    { label: 'Delete sheet', icon: Icon.trash, danger: true, onSelect: () => {
                      if (!window.confirm(`Delete the sheet "${s.title}"? Formula sets that are only on this sheet are deleted with it. Alpha decks on it stay. This can't be undone.`)) return;
                      void act(s.id, () => ops.deleteSheet(s.id));
                    } },
                  ]} />
                </span>
              </li>
            ))}
          </Table>
        )}
        <p className={`text-[12px] mt-3 ${faint}`}>To fix a typo in a formula, open its sheet's editor, then the section in Decks. Formula sets never appear on students' shelves.</p>
      </div>

      {kitSheet && (
        <KitEditor
          dark={dark}
          kit={kitSheet.kit}
          packs={packs}
          sheets={sheets ?? []}
          decks={decks}
          onClose={() => setKitSheet(null)}
          onSave={async (meta, items) => {
            try {
              const id = kitSheet.kit ? kitSheet.kit.id : await ops.createKit(meta);
              if (kitSheet.kit) await ops.updateKit(id, meta);
              await ops.setKitItems(id, items);
              await load();
            } catch (e) { throw new Error(humanError(e)); }
          }}
        />
      )}

      {sheetSheet && (
        <SheetEditor
          dark={dark}
          sheet={sheetSheet.sheet}
          decks={decks}
          packs={packs}
          onClose={() => setSheetSheet(null)}
          onImport={sheetSheet.sheet ? () => { const id = sheetSheet.sheet!.id; setSheetSheet(null); setImporting({ sheetId: id }); } : undefined}
          onSave={async (meta, deckIds) => {
            try {
              const id = sheetSheet.sheet ? sheetSheet.sheet.id : await ops.createSheet(meta);
              if (sheetSheet.sheet) await ops.updateSheet(id, meta);
              await ops.setSheetDecks(id, deckIds);
              await load();
            } catch (e) { throw new Error(humanError(e)); }
          }}
        />
      )}

      {importing && (
        <FormulaImport
          uid={adminId}
          dark={dark}
          sheets={sheets ?? []}
          decks={decks}
          presetSheetId={importing.sheetId}
          onClose={() => setImporting(null)}
          onDone={(done: ImportDone) => {
            setImporting(null);
            void load();
            const what = `${done.inserted.toLocaleString()} ${done.inserted === 1 ? 'formula' : 'formulas'}`;
            const skipped = done.duplicates ? ` ${done.duplicates.toLocaleString()} were already there.` : '';
            pushToast({
              id: 'st-import',
              title: done.target === 'sheet' ? `${what} added to ${done.title}.${skipped}` : `${what} added to the deck ${done.title}.${skipped}`,
              tone: 'good',
              ...(done.target === 'deck' ? { action: { label: 'Open deck', run: () => onOpenDeck(done.id) } } : {}),
            });
          }}
        />
      )}
    </section>
  );
};

/* ── Rows ── */

const Table = ({ dark, cols, children }: { dark: boolean; cols: string[]; children: React.ReactNode }) => {
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  return (
    <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className={`hidden md:grid ${GRID} gap-4 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.08em] ${faint} ${dark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`}>
        {cols.map((c, i) => <span key={c} className={i >= 2 ? 'text-right' : ''}>{c}</span>)}
        <span />
      </div>
      <ul className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>{children}</ul>
    </div>
  );
};

const Num = ({ dark, label, value }: { dark: boolean; label: string; value: number }) => (
  <span className={`num-stat text-[15px] md:text-right tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
    <span className={`md:hidden text-[11px] font-ui font-semibold mr-1.5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{label}</span>
    {value.toLocaleString()}
  </span>
);

export default StoreAdmin;
