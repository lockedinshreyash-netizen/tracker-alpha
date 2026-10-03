import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, HEIGHT, TIMELINE, WIDTH } from './score/timeline';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Score"
      component={Film}
      durationInFrames={TIMELINE.durationInFrames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
