import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CUES } from '../../../sound/cues';
import '../film/fonts';
import { SANS, SERIF } from '../film/fonts';
import { ACCENT, FAINT, INK, MUTED, VOID } from '../film/look';
import { BOARD, type BoardCue } from './board.generated';

/**
 * Every sound the app makes, one after another, so they can be heard in
 * Studio and judged side by side. The audio is the rendered master
 * (public/sfx/<id>.wav); what the app ships is the AAC made from it.
 *
 *   npm run sfx      → re-render the sounds and this board's data
 *   npm run dev      → open Studio, pick "SoundBoard"
 */

export const SFX_FPS = 30;
/** Silence before each cue, so it lands on a still frame rather than a cut. */
const LEAD = 0.3;
const TAIL = 0.6;

const slotFrames = (c: BoardCue) => Math.ceil((LEAD + Math.max(c.seconds, 0.6) + TAIL) * SFX_FPS);

const SLOTS = BOARD.reduce<{ cue: BoardCue; from: number; frames: number }[]>((acc, cue) => {
  const prev = acc[acc.length - 1];
  acc.push({ cue, from: prev ? prev.from + prev.frames : 0, frames: slotFrames(cue) });
  return acc;
}, []);

export const SOUNDBOARD_FRAMES = Math.max(1, SLOTS.reduce((n, s) => n + s.frames, 0));

const GROUP_LABEL: Record<string, string> = {
  core: 'Core',
  streak: 'Streak moment',
  rare: 'Reward',
  store: 'Alpha Packs',
  social: 'Social',
  onboarding: 'Onboarding',
};

const Waveform: React.FC<{ cue: BoardCue; progress: number }> = ({ cue, progress }) => {
  const bars = cue.peaks.length;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, height: 260, width: 1440 }}>
      {cue.peaks.map((p, i) => {
        const lit = i / bars <= progress;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(2, Math.pow(p, 0.7) * 100)}%`,
              borderRadius: 3,
              background: lit ? INK : FAINT,
            }}
          />
        );
      })}
      {progress > 0 && progress < 1 && (
        <div style={{ position: 'absolute', top: -20, bottom: -20, left: `${progress * 100}%`, width: 3, background: ACCENT }} />
      )}
    </div>
  );
};

const Slot: React.FC<{ cue: BoardCue; index: number }> = ({ cue, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lead = Math.round(LEAD * fps);
  const progress = interpolate(frame, [lead, lead + cue.seconds * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const enter = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const def = CUES[cue.id];

  return (
    <AbsoluteFill style={{ padding: '120px 240px', justifyContent: 'center', gap: 56, fontFamily: SANS }}>
      <Sequence from={lead} layout="none">
        <Audio src={staticFile(`sfx/${cue.id}.wav`)} />
      </Sequence>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 16}px)` }}>
        <div style={{ color: MUTED, fontSize: 24, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {String(index + 1).padStart(2, '0')} / {BOARD.length} · {GROUP_LABEL[def.group]} · {cue.seconds.toFixed(2)}s · {cue.stereo ? 'stereo' : 'mono'}
        </div>
        <div style={{ color: INK, fontSize: 112, fontWeight: 900, lineHeight: 1.05, marginTop: 18 }}>{cue.label}</div>
        <div style={{ color: MUTED, fontFamily: SERIF, fontStyle: 'italic', fontSize: 40, marginTop: 14 }}>{cue.when}</div>
      </div>
      <Waveform cue={cue} progress={progress} />
    </AbsoluteFill>
  );
};

export const SoundBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const current = SLOTS.findIndex(s => frame >= s.from && frame < s.from + s.frames);

  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      {SLOTS.map((s, i) => (
        <Sequence key={s.cue.id} from={s.from} durationInFrames={s.frames} premountFor={SFX_FPS}>
          <Slot cue={s.cue} index={i} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 240px 72px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {SLOTS.map((s, i) => (
            <div key={s.cue.id} style={{ flex: 1, height: 6, borderRadius: 3, background: i === current ? ACCENT : i < current ? MUTED : FAINT }} />
          ))}
        </div>
      </AbsoluteFill>
      {BOARD.length === 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', color: INK, font: `600 40px ${SANS}` }}>
          No sounds rendered yet. Run: npm run sfx
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
