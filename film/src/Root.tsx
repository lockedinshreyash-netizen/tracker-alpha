import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, HEIGHT, TIMELINE, WIDTH } from './score/timeline';
import { SFX_FPS, SOUNDBOARD_FRAMES, SoundBoard } from './sfx/SoundBoard';
import { Arena } from './arena/Arena';
import { ARENA_FPS, ARENA_FRAMES, ARENA_SIZE } from '../../onboarding/arena';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Score"
        component={Film}
        durationInFrames={TIMELINE.durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SoundBoard"
        component={SoundBoard}
        durationInFrames={SOUNDBOARD_FRAMES}
        fps={SFX_FPS}
        width={1920}
        height={1080}
      />
      {/* The app's onboarding cold open (onboarding/ColdOpen.tsx). */}
      <Composition
        id="Arena"
        component={Arena}
        durationInFrames={ARENA_FRAMES}
        fps={ARENA_FPS}
        width={ARENA_SIZE}
        height={ARENA_SIZE}
      />
    </>
  );
};
