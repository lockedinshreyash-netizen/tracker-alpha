/* ── What a gift says when it is sent ──
   One message, read by WhatsApp, the OS share sheet and the clipboard alike.
   The sender's phone sends it, so it is in their voice: the link preview
   (public/gift/index.html) carries the picture, this carries the person. */

import { PASS_PRICE_LABEL } from './cutover';

export const giftMessage = (diwali: boolean): string =>
  diwali
    ? `This Diwali, I'm gifting you an Alpha Access Pass. It's lifetime access, worth ${PASS_PRICE_LABEL}, and every member can gift just one. I picked you. 🪔`
    : `I'm gifting you an Alpha Access Pass. It's lifetime access, worth ${PASS_PRICE_LABEL}, and every member can gift just one. I picked you.`;

/** wa.me opens the WhatsApp app on a phone and WhatsApp Web on a laptop, with the text filled in. */
export const whatsappLink = (message: string, link: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${message}\n\n${link}`)}`;
