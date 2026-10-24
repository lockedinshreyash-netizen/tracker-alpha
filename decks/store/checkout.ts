/* ── Paying for a pack ──
   Packs go through the store's one checkout seam (store/checkout.ts), which
   kits and sheets share. These wrappers keep the rack's own call sites
   (PackDetail, DecksTab's design board) unchanged. */

import { actionFor as storeActionFor, checkout as storeCheckout, type CheckoutResult } from '../../store/checkout';
import type { Pack } from '../types';

export type { CheckoutResult };

export const checkout = (pack: Pick<Pack, 'access'>): Promise<CheckoutResult> => storeCheckout({ kind: 'pack', access: pack.access });

/** The primary action on a pack, as the store prints it. */
export const actionFor = (pack: Pick<Pack, 'access' | 'priceInr' | 'unlocked'>) => storeActionFor({ kind: 'pack', ...pack });
