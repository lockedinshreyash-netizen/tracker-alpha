/* ── Backing up the shelf ──
   The library has no cloud copy, so the student's own file is the recovery
   path: a browser that clears site data, Safari's seven-day eviction for a
   site not added to the home screen, a new laptop. The file is plain JSON on
   purpose, so it opens without Alpha or Alpha's key, and the screen says so
   before it is saved.

   Saving follows share/sharing.ts's rule: iOS Safari ignores `<a download>`
   for blob URLs, so there the OS share sheet is offered (Save to Files), and
   failing that the file opens in a tab. `saveBackup` must be called straight
   from the click: `navigator.share` needs the tap's activation. */

import type { LibraryExport } from './model';

const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const backupFileName = (now: number): string =>
  `alpha-learn-backup-${new Date(now).toISOString().slice(0, 10)}.json`;

export const saveBackup = (data: LibraryExport, now = Date.now()): 'downloaded' | 'shared' | 'opened' => {
  const name = backupFileName(now);
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  if (isIOS()) {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      void navigator.share({ files: [file], title: 'Alpha Learn backup' }).catch(() => undefined);
      return 'shared';
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
};

/** Reads a chosen file as JSON; null when it is not JSON at all. 2 MB is far past any real shelf. */
export const readBackup = async (file: File): Promise<unknown | null> => {
  if (file.size > 2_000_000) return null;
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
};

/* Asked once a library has something in it worth keeping. Chrome grants it
   to an installed or much-used site; Safari and Firefox may ask the student.
   A refusal changes nothing: the backup file is the real safety net. */
export const askToPersist = (): void => {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch { /* not offered */ }
};
