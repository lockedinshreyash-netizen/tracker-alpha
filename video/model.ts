/* ── Alpha Video, the parts that are only arithmetic ──
   Everything here is pure and tested (`npm run test:video`): reading a pasted
   link, where to resume, which speed to snap to, how a time is printed and
   spoken, what each player error means, and which key does what. The player
   component and the library ask these questions; none of them touch the DOM,
   the network or storage. */

/* ── Links ──
   A video is its 11-character id and nothing else. The id is what reaches an
   iframe `src`, so it is validated by shape here and never taken from a URL as
   a string.

   Shorts and playlists are refused on purpose, not because they cannot play:
   Alpha Learn is for lectures, and a Short is the thing a student opened
   YouTube to get away from. A playlist link is refused even when it also names
   a video (`watch?v=…&list=…`), because filing one video out of a playlist is
   not what the link says. */

export type LinkRefusal = 'empty' | 'shorts' | 'playlist' | 'invalid';
/* Both sides name both fields: this tsconfig has no strictNullChecks, and
   without it TypeScript cannot narrow a union on `ok: true | false`. */
export type LinkResult =
  | { ok: true; id: string; reason?: undefined }
  | { ok: false; id?: undefined; reason: LinkRefusal };

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be']);

export const parseVideoLink = (raw: string): LinkResult => {
  const input = raw.trim();
  if (!input) return { ok: false, reason: 'empty' };
  if (ID.test(input)) return { ok: true, id: input };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!HOSTS.has(host)) return { ok: false, reason: 'invalid' };

  const path = url.pathname.split('/').filter(Boolean);
  if (path[0] === 'shorts') return { ok: false, reason: 'shorts' };
  if (url.searchParams.has('list') || path[0] === 'playlist') return { ok: false, reason: 'playlist' };

  let id: string | null = null;
  if (host === 'youtu.be') id = path[0] ?? null;
  else if (path[0] === 'watch') id = url.searchParams.get('v');
  else if (path[0] === 'embed' || path[0] === 'live' || path[0] === 'v') id = path[1] ?? null;

  return id && ID.test(id) ? { ok: true, id } : { ok: false, reason: 'invalid' };
};

/** What a refused link says. Empty says nothing: the field is just empty. */
export const REFUSAL_COPY: Record<Exclude<LinkRefusal, 'empty'>, string> = {
  shorts: "Shorts don't go on the shelf. Paste a full lecture.",
  playlist: "Playlists don't go on the shelf. Open one lecture and copy its own link.",
  invalid: "That's not a YouTube video link.",
};

export const watchUrl = (id: string, at = 0): string =>
  `https://www.youtube.com/watch?v=${id}${at >= 1 ? `&t=${Math.floor(at)}s` : ''}`;

/* ── Resuming ──
   YouTube seeks to the keyframe before the time asked for, so landing a few
   seconds early is what it does anyway; doing it on purpose means the student
   hears the end of the sentence they left on. Under ten seconds in, or within
   the last fifteen, starts from the top: nobody wants to resume the credits. */

export const RESUME_BACK_S = 3;
const RESUME_MIN_S = 10;
const RESUME_TAIL_S = 15;

export const resumeAt = (position: number, duration?: number | null): number => {
  if (!Number.isFinite(position) || position < RESUME_MIN_S) return 0;
  if (duration && Number.isFinite(duration) && position > duration - RESUME_TAIL_S) return 0;
  return Math.max(0, Math.floor(position - RESUME_BACK_S));
};

/* ── Speed ──
   Only the rates the player itself reports are ever offered, and a request is
   snapped to the nearest of them. `setPlaybackRate` is a suggestion YouTube
   may ignore, so the UI shows the rate the player confirms, not the one asked. */

export const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const usable = (available: readonly number[]): number[] => {
  const list = available.filter(r => Number.isFinite(r) && r > 0);
  return (list.length ? list : [1]).slice().sort((a, b) => a - b);
};

export const snapRate = (requested: number, available: readonly number[]): number =>
  usable(available).reduce((best, r) => (Math.abs(r - requested) < Math.abs(best - requested) ? r : best));

/** One step slower (-1) or faster (+1), stopping at the ends. */
export const stepRate = (current: number, available: readonly number[], dir: 1 | -1): number => {
  const list = usable(available);
  const i = list.indexOf(snapRate(current, list));
  return list[Math.min(list.length - 1, Math.max(0, i + dir))];
};

export const rateLabel = (rate: number): string => `${Number(rate.toFixed(2))}×`;

/* ── Time ── */

/** "4:05", "12:34", "1:02:05". */
export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** "1 hour 2 minutes 5 seconds", for screen readers. */
export const spokenTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const parts: [number, string][] = [[Math.floor(s / 3600), 'hour'], [Math.floor((s % 3600) / 60), 'minute'], [s % 60, 'second']];
  const said = parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`);
  return said.length ? said.join(' ') : '0 seconds';
};

/* ── Player errors ──
   The codes are YouTube's (IFrame Player API, onError). `load` is ours: the
   API script itself never arrived. Every message says what happened in plain
   words and offers the one thing that can help.

   `load` is not "check your connection" unless the browser really is
   offline. Far more often the internet is fine and something blocks
   youtube.com/iframe_api by name: an ad blocker, a browser shield (Brave,
   Firefox's strict mode) or a school or ISP filter. The plain embed is a
   different URL that those usually let through, so that case offers it
   (`plain`): the video plays, without Alpha's controls. */

export type VideoErrorKind = 'invalid' | 'player' | 'missing' | 'blocked' | 'identity' | 'load';

export interface VideoError {
  kind: VideoErrorKind;
  code: number | null;
  title: string;
  body: string;
  /** The video exists and YouTube will play it on its own site. */
  openOnYouTube: boolean;
  /** Trying again could work. */
  retry: boolean;
  /** YouTube's own embed, without the API, may still play it. */
  plain: boolean;
}

export const errorFor = (code: number | null, online = true): VideoError => {
  const e = (x: Omit<VideoError, 'code' | 'plain'> & { plain?: boolean }): VideoError => ({ plain: false, ...x, code });
  switch (code) {
    case 2:
      return e({ kind: 'invalid', title: "That link doesn't point to a video.", body: 'Check it and paste it again.', openOnYouTube: false, retry: false });
    case 5:
      return e({ kind: 'player', title: "YouTube's player failed here.", body: 'It happens. Try again.', openOnYouTube: true, retry: true });
    case 100:
      return e({ kind: 'missing', title: 'This video is gone.', body: 'It was removed or made private.', openOnYouTube: false, retry: false });
    /* In practice YouTube also answers 150 for an id with no video behind it,
       not 100 as documented (seen on youtube-nocookie.com, Nov 2026). So the
       player alone cannot tell "blocked" from "gone", and the copy says both.
       Where the Data API has been asked (Discover), the caller knows which. */
    case 101:
    case 150:
      return e({ kind: 'blocked', title: "This video won't play in Alpha.", body: 'The creator may only allow it on YouTube, or it is no longer up.', openOnYouTube: true, retry: false });
    case 153:
      return e({ kind: 'identity', title: "The player couldn't check where it's playing.", body: 'Reload the page and try again.', openOnYouTube: true, retry: true });
    case null:
      return online
        ? e({
          kind: 'load',
          title: "YouTube's player didn't load here.",
          body: "Your internet is fine; something is blocking YouTube's player: an ad blocker, a browser shield or your network's filter. You can still watch, without Alpha's controls.",
          openOnYouTube: true,
          retry: true,
          plain: true,
        })
        : e({ kind: 'load', title: "You're offline.", body: 'Connect to the internet and try again.', openOnYouTube: false, retry: true });
    default:
      return e({ kind: 'player', title: "YouTube's player failed here.", body: 'Try again.', openOnYouTube: true, retry: true });
  }
};

/* ── Keys ──
   These work while focus is on Alpha's page. Once the student clicks into the
   player, the iframe has the keyboard and YouTube's own keys apply instead;
   no page can change that. Arrows move ten seconds (YouTube's own move five),
   because a lecture is long. Typing in a field, or holding a modifier, is
   never a shortcut. */

export type VideoAction = 'toggle' | 'back' | 'forward' | 'slower' | 'faster';

export const SEEK_STEP_S = 10;

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** True when the event came from a text field or an editable element. */
  typing?: boolean;
}

export const actionForKey = (e: KeyLike): VideoAction | null => {
  if (e.typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case ' ':
    case 'k':
    case 'K':
      return 'toggle';
    case 'ArrowLeft':
      return 'back';
    case 'ArrowRight':
      return 'forward';
    case '<':
    case ',':
      return 'slower';
    case '>':
    case '.':
      return 'faster';
    default:
      return null;
  }
};

/** Where a ±10s jump lands, kept inside the video. */
export const seekTarget = (current: number, dir: 1 | -1, duration?: number | null): number => {
  const next = Math.max(0, current + dir * SEEK_STEP_S);
  return duration && duration > 0 ? Math.min(next, Math.max(0, duration - 1)) : next;
};
