/* ── Support Alpha: the payment details ──
   The only place they live. The in-app page (support/SupportPage.tsx) and the
   static /support/ page (site/support.tsx) both read from here, so swapping
   the QR or the UPI id is one edit and no component changes.

   Set either to null and its part of the card disappears; set both to null
   and the card says plainly that support isn't set up yet, rather than
   showing a QR that pays nobody. Nothing here verifies a payment, and nothing
   anywhere in the app claims to. */

/** Served from public/. Replace the file in place to change the QR. */
export const SUPPORT_QR: string | null = '/support/fampay-qr.png';

/** The QR's own pixel size, so the image reserves its space before it loads. */
export const SUPPORT_QR_SIZE = { width: 826, height: 789 };

export const UPI_ID: string | null = '28shreyash@fam';

/* A UPI intent link built from the id above: on a phone it opens the
   student's payment app with the id filled in. It is exactly what the QR
   encodes (`upi://pay?pa=…`, checked by decoding the image), with no amount,
   because the amount is theirs to choose. */
export const upiLink = (id: string): string => `upi://pay?pa=${id}`;

/** True when there is anything to pay with at all. */
export const supportReady = (): boolean => SUPPORT_QR !== null || UPI_ID !== null;
