/* ── Images: compressed on the device, before anything is stored ──
   A phone photo of a notebook page is 4–8 MB. Notes keep it at most 1600px on
   its long side, as WebP where the browser can write it (Safari before 17
   cannot, and gets JPEG), which lands most pages at 150–400 kB. */

import { newId } from './bytes';
import type { NotesStore } from './store';

const MAX_SIDE = 1600;
const MAX_BYTES = 3 * 1024 * 1024;

const encode = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality));

export interface StoredImage { id: string; w: number; h: number }

export const storeImage = async (store: NotesStore, file: Blob): Promise<StoredImage> => {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t an image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let blob = await encode(canvas, 'image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('Couldn’t read that image.');
  if (blob.size > MAX_BYTES) throw new Error('That image is too large, even compressed.');
  const id = newId();
  await store.putFile({ id, blob, w, h, uploaded: false });
  return { id, w, h };
};
