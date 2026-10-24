/* ── Paying for something in the store ──
   The seam where a payment provider plugs in. It is not wired yet: no
   provider is chosen, and the app takes no money.

   The rule a provider must keep: **the server decides who owns what**.
   A successful checkout means the provider's webhook has written an
   entitlement row (`pack_entitlements`, `sheet_entitlements` or
   `kit_entitlements`, with its `order_ref`) or a `pro_memberships` row, as
   the service role. Only then do `add_pack`/`add_sheet`/`add_kit` agree, and
   only then does anything open. Nothing here, and no button anywhere, can
   mark an item as bought. See supabase/decks.sql §1b and §11.

   Inside the Play app (`isAndroidApp()`), digital goods must go through
   Google Play Billing, not an external checkout. Branch here when payments
   are wired.

   Until then a paid or Pro item says so plainly instead of pretending. */

import type { PackAccess } from '../decks/types';
import type { StoreKind } from './types';

export interface Buyable {
  kind: StoreKind;
  access: PackAccess;
  priceInr: number | null;
  unlocked: boolean;
}

export type CheckoutResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled'; message: string };

const NOUN: Record<StoreKind, string> = { pack: 'packs', sheet: 'sheets', kit: 'kits' };

export const checkout = async (item: Pick<Buyable, 'kind' | 'access'>): Promise<CheckoutResult> => ({
  ok: false,
  reason: 'unavailable',
  message: item.access === 'pro'
    ? `Alpha Pro opens soon. Free ${NOUN[item.kind]} work today.`
    : `Buying ${NOUN[item.kind]} opens soon. Free ${NOUN[item.kind]} work today.`,
});

/** The primary action on an item, as the store prints it. */
export const actionFor = (item: Buyable): { label: string; price: string; needsCheckout: boolean } => {
  if (item.unlocked) {
    return {
      label: 'Add to Alpha',
      price: item.access === 'free' ? 'Free' : item.access === 'pro' ? 'Included with Alpha Pro' : 'Already yours',
      needsCheckout: false,
    };
  }
  if (item.access === 'pro') return { label: 'Get Alpha Pro', price: 'Included with Alpha Pro', needsCheckout: true };
  return { label: `₹${item.priceInr ?? 0} · Get ${item.kind}`, price: `₹${item.priceInr ?? 0}`, needsCheckout: true };
};
