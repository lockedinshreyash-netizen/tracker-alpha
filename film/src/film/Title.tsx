import { AbsoluteFill, interpolate } from 'remotion';
import { TIMELINE } from '../score/timeline';
import { SANS } from './fonts';
import { ACCENT, INK, VOID } from './look';

/**
 * The title sits in the silence before the long run, over the sound of the
 * key being wound. Hard cut in, hard cut out; the red line under it is the
 * winding.
 */
export const Title: React.FC<{ frame: number }> = ({ frame }) => {
  const { titleIn, titleOut, ignition } = TIMELINE;
  if (frame < titleIn || frame >= ignition) return null;
  const showing = frame < titleOut;
  return (
    <AbsoluteFill style={{ backgroundColor: VOID, alignItems: 'center', justifyContent: 'center' }}>
      {showing && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 300,
              letterSpacing: '-0.035em',
              lineHeight: 0.8,
              color: INK,
              scale: interpolate(frame, [titleIn, titleOut], [1, 1.035]),
            }}
          >
            SCORE
          </div>
          <div
            style={{
              height: 3,
              width: 900,
              background: ACCENT,
              boxShadow: `0 0 18px ${ACCENT}`,
              scale: `${interpolate(frame, [titleIn, titleOut], [0, 1], { extrapolateRight: 'clamp' })} 1`,
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
