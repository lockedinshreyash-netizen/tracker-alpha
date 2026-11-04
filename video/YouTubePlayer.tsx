/* ── Alpha Video: the YouTube player ──
   A face first, the real player only on the tap that means "play". The face
   is the caller's own art (a lecture's cover), never a YouTube thumbnail, so a
   shelf of lectures makes no request to YouTube until one is played.

   What Alpha may and may not do around this player is set by YouTube's
   policies, and the component is built to them:
   - nothing is ever drawn in front of the live player. The face is removed
     the moment the player is ready, and while it loads the player is hidden
     rather than covered, so autoplay cannot start behind anything;
   - the player keeps YouTube's own controls and branding; Alpha's controls
     live outside the frame and use only the documented API;
   - the frame is never smaller than 200×200 (Required Minimum Functionality),
     so on a narrow phone it letterboxes rather than shrinking;
   - after an error the player is taken down and Alpha says what happened.

   React owns the wrapper and never any child of it: YouTube replaces the
   element it is given with its iframe, and two owners of one node is how the
   share modal once threw NotFoundError. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { errorFor, watchUrl, type VideoError } from './model';
import { loadIframeApi, stateName, type PlayerState, type YTPlayer } from './youtube';
import { youTubeController, type PlayerController } from './controller';

interface Props {
  videoId: string;
  title: string;
  dark: boolean;
  /** Seconds. Pass `resumeAt(position, duration)`, not a raw position. */
  startAt?: number;
  /** Drawn inside the play button before the first play. */
  face?: React.ReactNode;
  /* Start at once instead of waiting for a tap on the face: for a player
     mounted by a tap elsewhere (a bookmark's time, pressed before play). */
  autoStart?: boolean;
  /** The controller once the player is ready, and null once it is gone. */
  onController?: (c: PlayerController | null) => void;
  onState?: (s: PlayerState) => void;
  /** The rate the player confirmed, which may differ from the one asked for. */
  onRate?: (rate: number) => void;
  onError?: (e: VideoError) => void;
  /** Playing in YouTube's plain embed: Alpha's controls are off. */
  onPlain?: () => void;
  className?: string;
  /** Extra style for the frame (the theater sizes it to the screen). */
  style?: React.CSSProperties;
}

/* `plain` is YouTube's own embed with no API: the way to still watch when
   something blocks the API script (see errorFor). No controller, so Alpha's
   controls, resume and marks are off for that viewing, and the caller is told. */
type Phase = 'face' | 'loading' | 'live' | 'error' | 'plain';

const MIN_PX = 200;

const YouTubePlayer = ({ videoId, title, dark, startAt = 0, face, autoStart = false, onController, onState, onRate, onError, onPlain, className = '', style }: Props) => {
  const [phase, setPhase] = useState<Phase>('face');
  const [error, setError] = useState<VideoError | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const attemptRef = useRef(0);

  // Callbacks change identity every render; the player's listeners read them from here.
  const cb = useRef({ onController, onState, onRate, onError, onPlain });
  cb.current = { onController, onState, onRate, onError, onPlain };

  const teardown = useCallback(() => {
    attemptRef.current += 1;
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try { p.destroy(); } catch { /* already gone */ }
      cb.current.onController?.(null);
    }
    wrapRef.current?.replaceChildren();
  }, []);

  // A new video starts again from its face; leaving takes the player down.
  useEffect(() => {
    setPhase('face');
    setError(null);
    return teardown;
  }, [videoId, teardown]);

  const fail = useCallback((e: VideoError) => {
    teardown();
    setError(e);
    setPhase('error');
    cb.current.onError?.(e);
  }, [teardown]);

  const start = useCallback(() => {
    const attempt = ++attemptRef.current;
    setError(null);
    setPhase('loading');
    loadIframeApi().then(YT => {
      const wrap = wrapRef.current;
      if (attempt !== attemptRef.current || !wrap) return;
      const host = document.createElement('div');
      wrap.replaceChildren(host);
      const vars: Record<string, string | number> = {
        playsinline: 1,
        rel: 0,
        enablejsapi: 1,
        origin: window.location.origin,
      };
      if (startAt >= 1) vars.start = Math.floor(startAt);
      playerRef.current = new YT.Player(host, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '100%',
        playerVars: vars,
        events: {
          onReady: e => {
            if (attempt !== attemptRef.current) return;
            setPhase('live');
            cb.current.onController?.(youTubeController(e.target));
            // Played only now that it is on screen and uncovered. If the browser
            // blocks it (iOS after the async load), YouTube shows its own play button.
            e.target.playVideo();
          },
          onStateChange: e => {
            if (attempt === attemptRef.current) cb.current.onState?.(stateName(e.data));
          },
          onPlaybackRateChange: e => {
            if (attempt === attemptRef.current) cb.current.onRate?.(e.data);
          },
          onError: e => {
            if (attempt === attemptRef.current) fail(errorFor(e.data));
          },
        },
      });
    }).catch(() => {
      if (attempt === attemptRef.current) fail(errorFor(null, navigator.onLine !== false));
    });
  }, [videoId, startAt, fail]);

  // After the [videoId] effect above, which resets to the face; mount-only by design.
  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playPlain = useCallback(() => {
    teardown();
    setError(null);
    setPhase('plain');
    cb.current.onPlain?.();
  }, [teardown]);

  const frame = dark ? 'border-white/[0.08]' : 'border-zinc-200';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border bg-black ${frame} ${className}`}
      style={{ aspectRatio: '16 / 9', minWidth: MIN_PX, minHeight: MIN_PX, ...style }}
    >
      <div
        ref={wrapRef}
        className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full"
        style={{ visibility: phase === 'live' ? 'visible' : 'hidden' }}
      />

      {(phase === 'face' || phase === 'loading') && (
        <button
          type="button"
          onClick={phase === 'face' ? start : undefined}
          aria-label={phase === 'face' ? `Play: ${title}` : `Loading: ${title}`}
          aria-busy={phase === 'loading'}
          className="absolute inset-0 w-full h-full group"
        >
          {face ?? <DefaultFace title={title} />}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full transition-transform group-hover:scale-110 group-active:scale-95"
            style={{
              width: 60,
              height: 60,
              transform: 'translate(-50%, -50%)',
              background: '#E10600',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            }}
          >
            {phase === 'loading' ? (
              <span className="block w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z" /></svg>
            )}
          </span>
        </button>
      )}

      {phase === 'error' && error && (
        <VideoErrorPanel error={error} videoId={videoId} onRetry={error.retry ? start : undefined} onPlain={error.plain ? playPlain : undefined} />
      )}

      {phase === 'plain' && (
        <iframe
          src={plainEmbedUrl(videoId, startAt)}
          title={title}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}
    </div>
  );
};

/** What fills the frame when a caller has no art of its own. */
const DefaultFace = ({ title }: { title: string }) => (
  <span
    className="absolute inset-0 flex items-end p-5 text-left"
    style={{ background: 'radial-gradient(120% 90% at 70% 20%, #1c1d24 0%, #0b0b0d 70%)' }}
  >
    <span className="font-ui font-bold text-white/80 text-sm leading-snug line-clamp-2">{title}</span>
  </span>
);

/* The id has already been checked by shape (model.ts); it is still encoded,
   because it is going into a URL. */
const plainEmbedUrl = (id: string, startAt: number): string =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1&autoplay=1${startAt >= 1 ? `&start=${Math.floor(startAt)}` : ''}`;

interface ErrorProps {
  error: VideoError;
  videoId: string;
  onRetry?: () => void;
  onPlain?: () => void;
}

/** Shown in place of the player, never over a live one. */
export const VideoErrorPanel = ({ error, videoId, onRetry, onPlain }: ErrorProps) => (
  <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#0B0B0D]">
    <p className="font-ui font-bold text-white text-base leading-snug max-w-sm">{error.title}</p>
    <p className="font-ui text-zinc-400 text-sm max-w-sm">{error.body}</p>
    <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
      {onPlain && (
        <button
          type="button"
          onClick={onPlain}
          className="h-10 px-4 rounded-lg font-ui font-bold text-sm text-white bg-[#E10600] hover:bg-[#c90500]"
        >
          Watch without controls
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`h-10 px-4 rounded-lg font-ui font-bold text-sm ${onPlain ? 'text-zinc-200 border border-white/[0.12] hover:bg-white/[0.05]' : 'text-white bg-[#E10600] hover:bg-[#c90500]'}`}
        >
          Try again
        </button>
      )}
      {error.openOnYouTube && (
        <a
          href={watchUrl(videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 px-4 inline-flex items-center rounded-lg font-ui font-bold text-sm text-zinc-200 border border-white/[0.12] hover:bg-white/[0.05]"
        >
          Open on YouTube ↗
        </a>
      )}
    </div>
  </div>
);

export default YouTubePlayer;
