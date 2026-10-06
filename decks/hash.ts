/* ── Note identity ──
   Two notes are the same note when their text is the same once formatting is
   set aside: bold or not, an extra space or not, a different HTML entity for
   the same character. Case is kept — LiAlH4 and lialh4 are different
   chemistry. Cloze markers are kept, so {{c1::x}} and {{c2::x}} differ.

   SHA-256 because the database stores and checks it (`content_hash`, unique
   per deck); it is the same function on every device. */

import { toPlain } from './html';

export const normalizeForHash = (front: string, back: string): string =>
  `${toPlain(front).normalize('NFC')}\u001f${toPlain(back).normalize('NFC')}`;

export const sha256 = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const contentHash = (front: string, back: string): Promise<string> => sha256(normalizeForHash(front, back));
