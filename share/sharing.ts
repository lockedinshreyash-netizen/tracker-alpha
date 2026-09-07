/**
 * Getting the card off the device.
 *
 * What is actually possible from a web page, having checked rather than
 * assumed:
 *
 *  - **Instagram Stories and DMs cannot be targeted.** There is no web API.
 *    `instagram://story-camera` opens the camera but carries nothing with it,
 *    and the documented Stories path (writing
 *    `com.instagram.sharedSticker.backgroundImage` to the iOS pasteboard)
 *    requires a native app with a registered Facebook App ID.
 *  - **WhatsApp carries text only.** `wa.me/?text=` and `whatsapp://send?text=`
 *    take a string; neither can attach an image from the web.
 *
 * So there are no Instagram or WhatsApp buttons here. The OS share sheet lists
 * both — along with Messages, Mail, AirDrop and everything else the user
 * actually has — and it is the only real integration that exists. A button
 * labelled "Instagram Story" that silently did something else would be worse
 * than not offering it.
 */

/** What this browser can actually do, decided by asking it, never by its UA. */
export type ShareAbility = 'files' | 'download';

export type ShareOutcome = 'shared' | 'saved' | 'cancelled' | 'failed';

const FILE_TYPE = 'image/png';

/**
 * Probed with a real one-byte `File`, because `navigator.share` existing says
 * nothing about whether *files* can be shared — desktop Firefox and Chrome on
 * Linux have the method and reject the payload. The answer is stable for a
 * session, so it is computed once and reused.
 */
let ability: ShareAbility | null = null;

export const shareAbility = (): ShareAbility => {
  if (ability) return ability;
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: FILE_TYPE });
    ability = navigator.canShare?.({ files: [probe] }) && typeof navigator.share === 'function'
      ? 'files'
      : 'download';
  } catch {
    ability = 'download';
  }
  return ability;
};

export const fileNameFor = (period: string, stamp: string): string =>
  `tracker-alpha-${period}-${stamp}.png`;

export const toFile = (blob: Blob, name: string): File =>
  new File([blob], name, { type: FILE_TYPE });

/**
 * iOS Safari drops `<a download>` for blob URLs. It is the one place a UA check
 * is the right tool — this is about a rendering quirk of a specific browser,
 * not about a capability that can be feature-detected, and getting it wrong
 * means the user taps Save and nothing at all happens.
 */
const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Saves the card, and reports how — the caller has to tell an iOS user to
 * long-press, because on that browser "save" opens a tab rather than writing a
 * file, and silence there reads as a broken button.
 */
export const saveCard = (blob: Blob, name: string): 'downloaded' | 'opened' => {
  const url = URL.createObjectURL(blob);
  try {
    if (isIOS()) {
      window.open(url, '_blank');
      return 'opened';
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } finally {
    // Long enough for the navigation or download to have taken the URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};

/**
 * Opens the OS share sheet.
 *
 * **Must be called synchronously from the click handler.** `navigator.share`
 * requires transient user activation, and an `await` before it — rendering the
 * card, encoding the blob — spends that activation, after which iOS Safari
 * throws `NotAllowedError`. The card is therefore rendered when the preview is,
 * and this only ever receives an already-resolved blob.
 */
export const shareCard = async (blob: Blob, name: string, text: string): Promise<ShareOutcome> => {
  const file = toFile(blob, name);
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (err) {
    /* Dismissing the sheet is not a failure and must not surface as one — it is
       by far the most common way this promise rejects. */
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
};

export const CAPTION = 'Tracked with Tracker Alpha — trackeralpha.in';

export const copyCaption = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
