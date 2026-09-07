/**
 * Renders a card and hands back the canvas and its PNG.
 *
 * Two things this exists to guarantee:
 *
 *  1. **The blob is ready before the user can press Share.** `navigator.share`
 *     needs transient user activation, which an `await` inside the click
 *     handler would spend — so encoding happens here, alongside the preview,
 *     and the handler only ever passes along something already in hand.
 *  2. **The same card is never drawn twice.** Flipping Daily → Weekly → Daily
 *     is free, which is what makes the period switcher feel like a control
 *     rather than a request.
 */

import { useEffect, useRef, useState } from 'react';
import { CardData, CardFormat } from './types';
import { cardKey } from './stats';
import { renderCard } from './render';

export type RenderState = 'rendering' | 'ready' | 'error';

export interface CardImage {
  state: RenderState;
  canvas: HTMLCanvasElement | null;
  blob: Blob | null;
  error: string | null;
  /** False when the real faces did not load and the fallback stack drew. */
  fontsLoaded: boolean;
}

interface Entry {
  canvas: HTMLCanvasElement;
  blob: Blob;
  fontsLoaded: boolean;
}

/* Bounded on purpose: each entry holds a 2160px canvas and its PNG, and a
   session that browsed every period at every ratio would otherwise sit on tens
   of megabytes for cards it is not going to show again. */
const LIMIT = 9;
const cache = new Map<string, Entry>();

const remember = (key: string, entry: Entry) => {
  cache.set(key, entry);
  while (cache.size > LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

export const useCardImage = (data: CardData | null, format: CardFormat): CardImage => {
  const key = data ? `${cardKey(data)}:${format}` : null;

  /* The effect keys on the *content*, never on `data`'s identity. App rebuilds
     the stats slice on every render — a timer tick is enough — so depending on
     the object would redraw, or at least re-set state, once per second for a
     card whose numbers had not moved. `cardKey` already covers everything a
     card can display, so an unchanged key means an unchanged card. */
  const latest = useRef(data);
  latest.current = data;
  const [image, setImage] = useState<CardImage>(() => {
    const hit = key ? cache.get(key) : undefined;
    return hit
      ? { state: 'ready', canvas: hit.canvas, blob: hit.blob, error: null, fontsLoaded: hit.fontsLoaded }
      : { state: 'rendering', canvas: null, blob: null, error: null, fontsLoaded: true };
  });

  useEffect(() => {
    const current = latest.current;
    if (!current || !key) return;

    const hit = cache.get(key);
    if (hit) {
      setImage({ state: 'ready', canvas: hit.canvas, blob: hit.blob, error: null, fontsLoaded: hit.fontsLoaded });
      return;
    }

    let alive = true;
    setImage(prev => ({ ...prev, state: 'rendering', error: null }));

    /* Yielded to the next frame so the sheet paints before a 2160×2700 draw
       occupies the main thread — the modal appearing instantly matters more
       than the card appearing 16ms sooner. */
    const frame = requestAnimationFrame(() => {
      renderCard(current, format)
        .then(({ canvas, blob, fontsLoaded }) => {
          remember(key, { canvas, blob, fontsLoaded });
          if (alive) setImage({ state: 'ready', canvas, blob, error: null, fontsLoaded });
        })
        .catch((err: unknown) => {
          if (!alive) return;
          setImage({
            state: 'error',
            canvas: null,
            blob: null,
            error: err instanceof Error ? err.message : 'The card could not be drawn.',
            fontsLoaded: true,
          });
        });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [key, format]);

  return image;
};
