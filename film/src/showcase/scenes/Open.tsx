import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Glow, Seal, Shot } from '../kit';
import { pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

/** The door: the seal is pressed, then the landing page's headline. */
export const Open: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = pop(f, AT.sealPress, fps, 11, 170);
  const c = CAPTIONS.open;
  return (
    <Shot dur={SCENES.open.dur} push={[1.02, 1.08]}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* The flash of the press: a red bloom that fades as the wax sets. */}
        <Glow color="#b10e08" x={960} y={330} size={900} opacity={tw(f, [AT.sealPress + 3, AT.sealPress + 30], [0.55, 0.16])} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Seal
            id="open-wax"
            size={150}
            style={{
              opacity: tw(f, [AT.sealPress, AT.sealPress + 3], [0, 1]),
              scale: String(1.75 - 0.75 * press),
              rotate: `${-16 + 16 * press}deg`,
            }}
          />
          <Caption label={c.label} lead={c.lead} em={c.em} at={12} size={168} align="center" stack style={{ marginTop: 40 }} />
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
