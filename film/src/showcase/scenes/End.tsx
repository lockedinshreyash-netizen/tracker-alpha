import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Glow, Seal } from '../kit';
import { BONE_2, HAIR, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SITE_LINE } from '../timeline';

/** The door again: the seal, the line, the address. Held to the last frame. */
export const End: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = pop(f, AT.endSeal, fps, 11, 170);
  const c = CAPTIONS.end;
  const site = tw(f, [34, 48], [0, 1]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: tw(f, [0, 8], [0, 1]) }}>
      <Glow color="#b10e08" x={960} y={300} size={800} opacity={tw(f, [AT.endSeal + 3, AT.endSeal + 30], [0.4, 0.12])} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', scale: String(tw(f, [0, 120], [1, 1.035], (x: number) => x)) }}>
        <Seal
          id="end-wax"
          size={112}
          style={{
            opacity: tw(f, [AT.endSeal, AT.endSeal + 3], [0, 1]),
            scale: String(1.75 - 0.75 * press),
            rotate: `${-16 + 16 * press}deg`,
          }}
        />
        <Caption lead={c.lead} em={c.em} at={10} size={150} align="center" stack style={{ marginTop: 44 }} />
        <div
          style={{
            marginTop: 52,
            padding: '16px 30px',
            borderRadius: 999,
            boxShadow: `inset 0 0 0 1px ${HAIR}`,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: BONE_2,
            opacity: site,
            translate: `0 ${(1 - site) * 14}px`,
          }}
        >
          {SITE_LINE}
        </div>
      </div>
    </AbsoluteFill>
  );
};
