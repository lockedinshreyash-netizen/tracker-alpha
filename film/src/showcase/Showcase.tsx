/**
 * Tracker Alpha, inside: a 24-second showcase for the landing page.
 *
 * Motion graphics, not a screen recording. Every piece of UI is drawn here
 * from the app's own tokens (schedule/colors.ts, decks/theme.ts, the pack's
 * die-cut from decks/store/geometry.ts, the streak moment's layout), on the
 * landing page's warm near-black, with one Playfair line per scene. All the
 * numbers are a demo account's, and the corner says so.
 *
 * Timing lives in timeline.ts, which the score script reads too.
 * Render with `npm run showcase` (scripts/showcase.ts).
 */
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from 'remotion';
import { DemoMark } from './kit';
import { NIGHT } from './look';
import { OVERLAP, SCENES } from './timeline';
import { Open } from './scenes/Open';
import { Today } from './scenes/Today';
import { Plan } from './scenes/Plan';
import { Syllabus } from './scenes/Syllabus';
import { Mocks } from './scenes/Mocks';
import { Decks } from './scenes/Decks';
import { Pack } from './scenes/Pack';
import { Notes } from './scenes/Notes';
import { Streak } from './scenes/Streak';
import { End } from './scenes/End';

/** The room: the landing page's night, with one warm light from above. */
const Room: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(70% 55% at 50% -8%, rgba(236,230,218,0.075), rgba(236,230,218,0.015) 55%, transparent 80%), ${NIGHT}`,
    }}
  />
);

/** Edges fall off, as a lens does. */
const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
);

export const Showcase: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const { fps } = useVideoConfig();
  const S = SCENES;
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <Room />
      <Sequence name="Open" from={S.open.from} durationInFrames={S.open.dur + OVERLAP} premountFor={fps}>
        <Open />
      </Sequence>
      <Sequence name="Today" from={S.today.from} durationInFrames={S.today.dur + OVERLAP} premountFor={fps}>
        <Today />
      </Sequence>
      <Sequence name="Plan" from={S.plan.from} durationInFrames={S.plan.dur + OVERLAP} premountFor={fps}>
        <Plan />
      </Sequence>
      <Sequence name="Syllabus" from={S.syllabus.from} durationInFrames={S.syllabus.dur + OVERLAP} premountFor={fps}>
        <Syllabus />
      </Sequence>
      <Sequence name="Mocks" from={S.mocks.from} durationInFrames={S.mocks.dur + OVERLAP} premountFor={fps}>
        <Mocks />
      </Sequence>
      <Sequence name="Decks" from={S.decks.from} durationInFrames={S.decks.dur + OVERLAP} premountFor={fps}>
        <Decks />
      </Sequence>
      <Sequence name="Pack" from={S.pack.from} durationInFrames={S.pack.dur + OVERLAP} premountFor={fps}>
        <Pack />
      </Sequence>
      <Sequence name="Notes" from={S.notes.from} durationInFrames={S.notes.dur + OVERLAP} premountFor={fps}>
        <Notes />
      </Sequence>
      <Sequence name="Streak" from={S.streak.from} durationInFrames={S.streak.dur + OVERLAP} premountFor={fps}>
        <Streak />
      </Sequence>
      <Sequence name="End" from={S.end.from} durationInFrames={S.end.dur} premountFor={fps}>
        <End />
      </Sequence>
      <Vignette />
      <DemoMark from={S.today.from} to={S.end.from + 4} />
      {withAudio && <Audio name="Score" src={staticFile('showcase/score.wav')} />}
    </AbsoluteFill>
  );
};
