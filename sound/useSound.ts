/* React's view of the sound switch and volume. The state lives in audio.ts
   (module-level, device-local); this only subscribes to it, so the header
   button and the settings row move together without anything in AppState. */

import { useEffect, useSyncExternalStore } from 'react';
import * as sfx from '../audio';

export const useSound = (): sfx.SoundSnapshot => useSyncExternalStore(sfx.subscribe, sfx.getSnapshot, sfx.getSnapshot);

const typing = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/** `M` mutes and unmutes from anywhere — except while typing, and never with
 *  a modifier held, so Cmd+M still minimises the window. */
export const useSoundHotkey = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (typing(e.target) || typing(document.activeElement)) return;
      sfx.toggleSound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
