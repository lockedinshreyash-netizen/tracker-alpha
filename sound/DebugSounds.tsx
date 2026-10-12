/* `?sfx=debug` — every cue in the real player, at real levels. DEV only and
   lazily imported from index.tsx, so it never reaches a production bundle.

   This is where levels get tuned: the catalog's `gain` is what decides how a
   cue sits next to the others, and that can only be judged through the same
   chain the app uses (decode, lead-in trim, cue gain, master curve). The
   Remotion SoundBoard plays the masters flat. */

import React, { useEffect, useState } from 'react';
import * as sfx from '../audio';
import { CUES, CUE_IDS, comboSemitones, streakCue, type Cue, type CueGroup } from './cues';
import { useSound } from './useSound';
import { btn, tokens } from '../ui/kit';

type Info = Awaited<ReturnType<typeof sfx.inspect>> | 'loading' | 'failed';

const GROUPS: CueGroup[] = ['core', 'streak', 'rare', 'store', 'social', 'onboarding'];

const DebugSounds: React.FC = () => {
  const t = tokens(true);
  const { enabled, volume } = useSound();
  const [info, setInfo] = useState<Partial<Record<Cue, Info>>>({});
  const [state, setState] = useState('none');

  useEffect(() => {
    document.body.style.background = '#0B0B0D';
    const id = window.setInterval(() => setState(sfx.contextState()), 250);
    return () => window.clearInterval(id);
  }, []);

  const decodeAll = async () => {
    for (const id of CUE_IDS) {
      setInfo(p => ({ ...p, [id]: 'loading' }));
      const r = await sfx.inspect(id);
      setInfo(p => ({ ...p, [id]: r ?? 'failed' }));
    }
  };

  const combo = () => [0, 1, 2, 3, 4, 5].forEach(k => window.setTimeout(() => sfx.play('task-done', { semitones: comboSemitones(k) }), k * 380));

  return (
    <div className="min-h-screen font-ui text-white p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl">Sound board</h1>
      <p className={`mt-2 text-sm ${t.muted}`}>
        Context <span className="text-white font-bold" data-testid="ctx-state">{state}</span> · sound {enabled ? 'on' : 'off'} · volume {Math.round(volume * 100)}%
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button className={`${btn} px-4 py-2.5 ${t.primary}`} onClick={() => sfx.setSoundEnabled(!enabled)}>
          {enabled ? 'Mute' : 'Sound on'}
        </button>
        <button className={`${btn} px-4 py-2.5 ${t.ghost}`} onClick={decodeAll} data-testid="decode-all">
          Decode every cue
        </button>
        <button className={`${btn} px-4 py-2.5 ${t.ghost}`} onClick={combo}>
          Combo ×6
        </button>
        <label className={`flex items-center gap-3 text-xs ${t.muted}`}>
          Volume
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => sfx.setVolume(Number(e.target.value))} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {[1, 6, 7, 12, 30, 45, 100, 150, 365].map(n => (
          <button key={n} className={`${btn} px-3 py-2 ${t.ghost}`} onClick={() => sfx.play(streakCue(n), { late: 1500 })}>
            Streak {n}
          </button>
        ))}
      </div>

      {GROUPS.map(g => (
        <section key={g} className={`mt-8 rounded-xl border ${t.card}`}>
          <p className="px-5 pt-4 text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500">{g}</p>
          <ul>
            {CUE_IDS.filter(id => CUES[id].group === g).map(id => {
              const d = CUES[id];
              const i = info[id];
              return (
                <li key={id} className={`flex items-center gap-4 px-5 py-3 border-t ${t.rule}`}>
                  <button className={`${btn} px-3 py-2 ${t.ghost} w-16`} onClick={() => sfx.play(id, { late: 2000 })}>
                    Play
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {d.label} <span className="text-zinc-600 font-normal">· {id}</span>
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{d.when}</p>
                  </div>
                  <p className="text-xs tabular-nums text-zinc-400 text-right w-56" data-testid={`info-${id}`}>
                    gain {d.gain.toFixed(2)}
                    {i === 'loading' && ' · decoding'}
                    {i === 'failed' && <span className="text-[#E10600]"> · FAILED</span>}
                    {i && typeof i === 'object' && ` · ${i.seconds.toFixed(2)}s · ${i.channels}ch · lead ${(i.offset * 1000).toFixed(0)}ms`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default DebugSounds;
