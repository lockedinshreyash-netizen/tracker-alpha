/* ── The store's data ──
   What the Alpha Store shows (packs, sheets, kits) and the three ways of
   taking something. Moved out of DecksTab when the store moved out of Decks.

   `acquire*` resolves only once the server agrees the item is yours: a paid
   or Pro item that is not unlocked goes to the checkout seam first, which
   until payments are wired answers "opens soon" (store/checkout.ts). The
   openings play only after this resolves.

   The calls are injectable so the design board (?store=debug) can run the
   real screens on fixtures. */

import { useCallback, useEffect, useState } from 'react';
import { addPack, explorePacks, humanError, packPreview } from '../decks/api';
import type { Pack, PreviewCard } from '../decks/types';
import { addKit, addSheet, exploreKits, exploreSheets, sheetPreview } from './api';
import { checkout } from './checkout';
import type { Kit, Sheet, StoreKind } from './types';
import { KITS_LAUNCHED } from './launch';

export interface StoreOps {
  packs: () => Promise<Pack[]>;
  sheets: () => Promise<Sheet[]>;
  kits: () => Promise<Kit[]>;
  addPack: (id: string) => Promise<unknown>;
  addSheet: (id: string) => Promise<void>;
  addKit: (id: string) => Promise<void>;
  packPreview: (id: string) => Promise<PreviewCard[]>;
  sheetPreview: (id: string) => Promise<PreviewCard[]>;
  checkout: typeof checkout;
}

export const REAL_STORE: StoreOps = {
  packs: explorePacks,
  sheets: exploreSheets,
  kits: exploreKits,
  addPack,
  addSheet,
  addKit,
  packPreview,
  sheetPreview,
  checkout,
};

export interface StoreData {
  packs: Pack[] | null;
  sheets: Sheet[] | null;
  kits: Kit[] | null;
  refresh: () => Promise<void>;
  acquirePack: (p: Pack) => Promise<void>;
  acquireSheet: (s: Sheet) => Promise<void>;
  acquireKit: (k: Kit) => Promise<void>;
  packPreview: (id: string) => Promise<PreviewCard[]>;
  sheetPreview: (id: string) => Promise<PreviewCard[]>;
}

export const useStore = (signedIn: boolean, ops: StoreOps = REAL_STORE): StoreData => {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [kits, setKits] = useState<Kit[] | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    // A database that predates a kind simply shows none of it.
    await Promise.all([
      ops.packs().then(setPacks, () => setPacks([])),
      ops.sheets().then(setSheets, () => setSheets([])),
      // Kits are not launched yet (store/launch.ts): nothing asks for them.
      KITS_LAUNCHED ? ops.kits().then(setKits, () => setKits([])) : setKits([]),
    ]);
  }, [signedIn, ops]);

  useEffect(() => {
    if (!signedIn) { setPacks(null); setSheets(null); setKits(null); return; }
    void refresh();
  }, [signedIn, refresh]);

  const take = useCallback(async (kind: StoreKind, item: { access: Pack['access']; unlocked: boolean }, add: () => Promise<unknown>) => {
    if (!item.unlocked) {
      const paid = await ops.checkout({ kind, access: item.access });
      if ('message' in paid) throw new Error(paid.message);
    }
    try { await add(); } catch (e) { throw new Error(humanError(e)); }
  }, [ops]);

  return {
    packs,
    sheets,
    kits,
    refresh,
    acquirePack: useCallback((p: Pack) => take('pack', p, () => ops.addPack(p.id)), [take, ops]),
    acquireSheet: useCallback((s: Sheet) => take('sheet', s, () => ops.addSheet(s.id)), [take, ops]),
    acquireKit: useCallback((k: Kit) => take('kit', k, () => ops.addKit(k.id)), [take, ops]),
    packPreview: ops.packPreview,
    sheetPreview: ops.sheetPreview,
  };
};
