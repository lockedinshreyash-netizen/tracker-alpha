import { Composition, Folder } from 'remotion';
import { Film } from './film/Film';
import { FPS, HEIGHT, TIMELINE, WIDTH } from './score/timeline';
import { SFX_FPS, SOUNDBOARD_FRAMES, SoundBoard } from './sfx/SoundBoard';
import { Arena } from './arena/Arena';
import { ARENA_FPS, ARENA_FRAMES, ARENA_LANDSCAPE, ARENA_PORTRAIT } from '../../onboarding/arena';
import { Showcase } from './showcase/Showcase';
import { DURATION as SHOWCASE_FRAMES, FPS as SHOWCASE_FPS, HEIGHT as SHOWCASE_H, OVERLAP, SCENES, WIDTH as SHOWCASE_W } from './showcase/timeline';
import { Open } from './showcase/scenes/Open';
import { Today } from './showcase/scenes/Today';
import { Plan } from './showcase/scenes/Plan';
import { Syllabus } from './showcase/scenes/Syllabus';
import { Mocks } from './showcase/scenes/Mocks';
import { Decks } from './showcase/scenes/Decks';
import { Pack } from './showcase/scenes/Pack';
import { Notes } from './showcase/scenes/Notes';
import { Streak } from './showcase/scenes/Streak';
import { End } from './showcase/scenes/End';

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
      {/* The app's onboarding cold open (onboarding/ColdOpen.tsx), framed
          for a phone and for a laptop. */}
      <Composition id="ArenaPortrait" component={Arena} durationInFrames={ARENA_FRAMES} fps={ARENA_FPS} {...ARENA_PORTRAIT} />
      <Composition id="ArenaLandscape" component={Arena} durationInFrames={ARENA_FRAMES} fps={ARENA_FPS} {...ARENA_LANDSCAPE} />
      {/* The landing page's "Look inside." film (src/showcase), and each of its
          scenes on its own for working on one at a time. */}
      <Composition id="Showcase" component={Showcase} durationInFrames={SHOWCASE_FRAMES} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} defaultProps={{ withAudio: true }} />
      <Folder name="Showcase-scenes">
        <Composition id="ShowcaseOpen" component={Open} durationInFrames={SCENES.open.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseToday" component={Today} durationInFrames={SCENES.today.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcasePlan" component={Plan} durationInFrames={SCENES.plan.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseSyllabus" component={Syllabus} durationInFrames={SCENES.syllabus.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseMocks" component={Mocks} durationInFrames={SCENES.mocks.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseDecks" component={Decks} durationInFrames={SCENES.decks.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcasePack" component={Pack} durationInFrames={SCENES.pack.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseNotes" component={Notes} durationInFrames={SCENES.notes.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseStreak" component={Streak} durationInFrames={SCENES.streak.dur + OVERLAP} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
        <Composition id="ShowcaseEnd" component={End} durationInFrames={SCENES.end.dur} fps={SHOWCASE_FPS} width={SHOWCASE_W} height={SHOWCASE_H} />
      </Folder>
    </>
  );
};
