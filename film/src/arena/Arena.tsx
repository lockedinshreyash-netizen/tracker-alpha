import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ArenaScene } from './ArenaScene';

/**
 * The onboarding's cold open: a city at night where every lit window is
 * someone studying, and one of them is you. Rendered without words or grain.
 * The app lays the words on top (one of them is the viewer's live clock) and
 * adds its own grain, which also keeps the video small: noise is the most
 * expensive thing a codec can be asked to keep.
 *
 * Rendered to public/onboarding/arena-{portrait,landscape}.mp4; the command is
 * in onboarding/arena.ts.
 */
export const Arena: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#020203' }}>
      <ThreeCanvas width={width} height={height} flat dpr={1} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <ArenaScene t={frame / fps} width={width} height={height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
