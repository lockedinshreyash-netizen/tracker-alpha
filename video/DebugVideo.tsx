/* ── `?learn=debug` (DEV only) ──
   Alpha Learn before there is a Learn tab: the player with its face, resume,
   speed and keys; every error panel; the link reader on real-world links; and
   the encrypted library store (learn/DebugLibrary.tsx). The player sections
   write nothing: "Resume here" remounts the player at the resume point. Only
   the store section writes, to `alpha-learn-debug-*` databases. */

import React, { useState } from 'react';
import YouTubePlayer, { VideoErrorPanel } from './YouTubePlayer';
import PlayerControls from './PlayerControls';
import { REFUSAL_COPY, errorFor, formatTime, parseVideoLink, resumeAt } from './model';
import type { PlayerController } from './controller';
import type { PlayerState } from './youtube';
import DebugLibrary from '../learn/DebugLibrary';

// YouTube's own IFrame API sample video: published by YouTube, always embeddable.
const SAMPLE = 'M7lc1UVf-VE';

const LINKS = [
  `https://www.youtube.com/watch?v=${SAMPLE}`,
  `https://youtu.be/${SAMPLE}?si=Xy12&t=40`,
  `https://m.youtube.com/watch?v=${SAMPLE}&feature=share`,
  `https://www.youtube.com/live/${SAMPLE}`,
  `https://www.youtube.com/shorts/${SAMPLE}`,
  `https://www.youtube.com/watch?v=${SAMPLE}&list=PL123&index=2`,
  'https://www.youtube.com/playlist?list=PL123',
  `https://vimeo.com/${SAMPLE}`,
  'rotational motion one shot',
];

const ERROR_CODES: (number | null)[] = [150, 100, 2, 5, 153, null];

const DebugVideo = () => {
  const [dark, setDark] = useState(true);
  const [videoId, setVideoId] = useState(SAMPLE);
  const [startAt, setStartAt] = useState(0);
  const [mount, setMount] = useState(0);
  const [link, setLink] = useState('');
  const [controller, setController] = useState<PlayerController | null>(null);
  const [state, setState] = useState<PlayerState>('unstarted');
  const [rate, setRate] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog(l => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 12));

  const parsed = parseVideoLink(link);
  const page = dark ? 'bg-[#0B0B0D] text-zinc-200' : 'bg-[#F2F0EC] text-zinc-800';
  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm';
  const eyebrow = 'text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500';
  const input = `w-full px-3.5 py-2.5 rounded-lg border text-sm font-ui outline-none focus:border-[#E10600] ${
    dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white placeholder:text-zinc-600' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
  }`;

  const remount = (id: string, at: number) => {
    setController(null);
    setState('unstarted');
    setRate(1);
    setVideoId(id);
    setStartAt(at);
    setMount(m => m + 1);
  };

  return (
    <div className={`min-h-screen font-ui ${page}`}>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>DEV · ?learn=debug</p>
            <h1 className={`font-display text-3xl ${dark ? 'text-white' : 'text-zinc-900'}`}>Alpha Video</h1>
            <p className="text-sm text-zinc-500 mt-1">The player and the library store, before there is a Learn tab. Only the store section saves, to its own debug databases.</p>
          </div>
          <button
            type="button"
            onClick={() => setDark(d => !d)}
            className={`h-10 px-4 rounded-lg border text-sm font-bold ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`}
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </header>

        <section className="space-y-4">
          <p className={eyebrow}>Player</p>
          <YouTubePlayer
            key={mount}
            videoId={videoId}
            title="YouTube's IFrame API sample video"
            dark={dark}
            startAt={startAt}
            onController={c => { setController(c); note(c ? 'ready' : 'player gone'); }}
            onState={s => { setState(s); note(`state ${s}`); }}
            onRate={r => { setRate(r); note(`rate ${r}`); }}
            onError={e => note(`error ${e.code ?? 'load'} · ${e.kind}`)}
          />
          <PlayerControls controller={controller} state={state} rate={rate} dark={dark}>
            <button
              type="button"
              disabled={!controller}
              onClick={() => controller && remount(videoId, resumeAt(controller.time(), controller.duration()))}
              className={`h-9 px-3 rounded-lg border text-xs font-bold disabled:opacity-40 ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`}
            >
              Resume here
            </button>
          </PlayerControls>
          <p className="text-xs text-zinc-500">
            Keys while focus is on this page: Space or K play/pause · ← → ten seconds · &lt; &gt; speed. Click into the player and YouTube's own keys take over.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
              <p className={eyebrow}>Load a video</p>
              <input className={input} value={link} onChange={e => setLink(e.target.value)} placeholder="Paste a YouTube link" aria-label="YouTube link" />
              <p className="text-sm min-h-[20px]">
                {parsed.ok ? <span>Video <code>{parsed.id}</code></span> : parsed.reason !== 'empty' && <span className="text-zinc-500">{REFUSAL_COPY[parsed.reason]}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!parsed.ok}
                  onClick={() => parsed.ok && remount(parsed.id, 0)}
                  className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#E10600] hover:bg-[#c90500] disabled:opacity-40"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => remount(SAMPLE, 95)}
                  className={`h-9 px-3 rounded-lg border text-xs font-bold ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`}
                >
                  Sample from 1:35
                </button>
                <button
                  type="button"
                  onClick={() => remount('AAAAAAAAAAA', 0)}
                  className={`h-9 px-3 rounded-lg border text-xs font-bold ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`}
                >
                  A video that doesn't exist
                </button>
              </div>
              <p className="text-xs text-zinc-500">Starts at {formatTime(startAt)}. YouTube answers a missing video with code 150, the same as one whose creator turned embedding off.</p>
            </div>
            <div className={`rounded-xl border p-4 space-y-2 ${card}`}>
              <p className={eyebrow}>Events</p>
              <ol className="font-mono text-xs space-y-1 text-zinc-500 min-h-[120px]">
                {log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>Press play.</li>}
              </ol>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <p className={eyebrow}>Every error, as it replaces the player</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ERROR_CODES.map(code => (
              <figure key={String(code)} className="space-y-2 m-0">
                <div className="relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black" style={{ aspectRatio: '16 / 9', minHeight: 200 }}>
                  <VideoErrorPanel error={errorFor(code)} videoId={SAMPLE} onRetry={errorFor(code).retry ? () => note(`retry ${code ?? 'load'}`) : undefined} />
                </div>
                <figcaption className="text-xs text-zinc-500 font-mono">{code === null ? 'script did not load' : `code ${code}`} · {errorFor(code).kind}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <p className={eyebrow}>Link reader</p>
          <div className={`rounded-xl border overflow-x-auto ${card}`}>
            <table className="w-full text-sm">
              <tbody>
                {LINKS.map(l => {
                  const r = parseVideoLink(l);
                  return (
                    <tr key={l} className={`border-b last:border-0 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                      <td className="px-4 py-2.5 font-mono text-xs break-all">{l}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.ok ? <code className="text-[#34C77B]">{r.id}</code> : <span className="text-zinc-500">{r.reason}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <DebugLibrary dark={dark} />
      </div>
    </div>
  );
};

export default DebugVideo;
