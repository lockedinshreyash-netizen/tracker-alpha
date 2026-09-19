import React, { useState } from 'react';
import { embedUrl, thumbUrl, watchUrl } from './api';

interface Props {
  videoId: string;
  title: string;
  theme: 'dark' | 'light';
}

/**
 * A YouTube video inside the announcement modal.
 *
 * A facade, not an iframe. This modal opens by itself on Today for every user
 * the moment a video goes out, and a YouTube embed pulls roughly a megabyte of
 * player and sets third-party cookies before anybody has decided to watch. So
 * what loads first is one thumbnail image; the real player is mounted only on
 * the tap that means "play", with `autoplay=1` so that tap is not spent.
 *
 * The embed is `youtube-nocookie.com` for the same reason — this audience is
 * largely minors, and nothing should be tracking them for opening Today.
 */
const VideoBody: React.FC<Props> = ({ videoId, title, theme }) => {
  const dark = theme === 'dark';
  const [playing, setPlaying] = useState(false);

  return (
    <div className="space-y-2.5">
      <div
        className={`relative w-full overflow-hidden rounded-xl border ${dark ? 'border-white/[0.08] bg-black' : 'border-[#E3E0D9] bg-black'}`}
        style={{ aspectRatio: '16 / 9' }}
      >
        {playing ? (
          <iframe
            src={embedUrl(videoId, true)}
            title={title}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={`Play: ${title}`}
          >
            <img
              src={thumbUrl(videoId)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* A scrim so the play mark reads over a bright frame. */}
            <span className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.28)' }} aria-hidden="true" />
            <span
              className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full transition-transform group-hover:scale-110 group-active:scale-95"
              style={{
                width: 56, height: 56,
                transform: 'translate(-50%, -50%)',
                background: '#E10600',
                boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
              }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Some people would rather watch it in the app they subscribe from. */}
      <a
        href={watchUrl(videoId)}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'}`}
      >
        Watch on YouTube →
      </a>
    </div>
  );
};

export default VideoBody;
