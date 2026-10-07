/* ── Paying for a pack ──
   The seam where a payment provider plugs in. It is not wired yet: no
   provider is chosen, and the app takes no money.

   The rule a provider must keep: **the server decides who owns a pack**.
   A successful checkout means the provider's webhook has written a
   `pack_entitlements` row (or a `pro_memberships` row) as the service role.
   Only then does `add_pack` agree, and only then does the pack come off its
   hook. Nothing here, and no button anywhere, can mark a pack as bought.
   See supabase/decks.sql §1b.

   Until then a paid or Pro pack says so plainly instead of pretending. */

import type { Pack } from '../types';

export type CheckoutResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled'; message: string };

export const checkout = async (pack: Pick<Pack, 'access'>): Promise<CheckoutResult> => ({
  ok: false,
  reason: 'unavailable',
  message: pack.access === 'pro' ? 'Alpha Pro opens soon. Free packs work today.' : 'Buying packs opens soon. Free packs work today.',
});

/** The primary action on a pack, as the store prints it. */
export const actionFor = (pack: Pick<Pack, 'access' | 'priceInr' | 'unlocked'>): { label: string; price: string; needsCheckout: boolean } => {
  if (pack.unlocked) {
    return {
      label: 'Add to Alpha',
      price: pack.access === 'free' ? 'Free' : pack.access === 'pro' ? 'Included with Alpha Pro' : 'Already yours',
      needsCheckout: false,
    };
  }
  if (pack.access === 'pro') return { label: 'Get Alpha Pro', price: 'Included with Alpha Pro', needsCheckout: true };
  return { label: `₹${pack.priceInr ?? 0} · Get pack`, price: `₹${pack.priceInr ?? 0}`, needsCheckout: true };
};
