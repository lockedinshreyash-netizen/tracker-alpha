import { Audio } from '@remotion/media';
import { ThreeCanvas } from '@remotion/three';
import { useMemo } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SCORE_SIGNATURE } from '../score/signature.generated';
import { timelineSignature } from '../score/signature';
import { TIMELINE } from '../score/timeline';
import { cameraFor } from './edit';
import { Ending } from './Ending';
import './fonts';
import { Grain } from './Grain';
import { Hud } from './hud/Hud';
import { VOID } from './look';
import { Scene } from './Scene';
import { frameState } from './state';
import { Title } from './Title';

const SIGNATURE_OK = timelineSignature() === SCORE_SIGNATURE;

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = useMemo(() => frameState(frame), [frame]);
  const cam = useMemo(() => cameraFor(s), [s]);

  // The title and the black either side of it hide the machine entirely.
  const blackout = frame >= TIMELINE.titleIn && frame < TIMELINE.ignition;

  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <Audio src={staticFile('score.wav')} premountFor={fps} />
      <AbsoluteFill style={{ opacity: blackout ? 0 : 1 }}>
        <ThreeCanvas width={width} height={height} flat dpr={1} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <Scene s={s} cam={cam} width={width} height={height} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Hud s={s} cam={cam} />
      <Title frame={frame} />
      <Ending frame={frame} />
      <Grain frame={frame} />
      {!SIGNATURE_OK && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 40, pointerEvents: 'none' }}>
          <div style={{ background: '#E10600', color: 'white', font: '600 26px Satoshi, sans-serif', padding: '14px 20px', alignSelf: 'flex-start' }}>
            Score is out of date with the timeline. Run: npm run score
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
