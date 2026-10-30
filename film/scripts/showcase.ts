/**
 * Builds everything the landing page's "Look inside." section ships:
 *
 *   npm run showcase
 *     → film/public/showcase/score.wav   (the sound, read by the composition)
 *     → public/showcase/showcase.mp4     (H.264 + AAC, the film)
 *     → public/showcase/poster.jpg       (the still the page shows before a tap)
 *     → public/showcase/captions.vtt     (the film's words, for <track>)
 *
 * The page never loads the mp4 until someone taps play (landing/Showcase.tsx),
 * so its size only costs the people who asked for it. It is kept to about
 * 8–10 MB anyway: CRF picked so a 24-second 1080p film lands there.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTIONS, DURATION, FPS, SCENES, SITE_LINE, type SceneId } from '../src/showcase/timeline';

const FILM = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(FILM, '..', 'public', 'showcase');
/** The poster: Today, the clock running and the card on its way to Done. */
export const POSTER_FRAME = SCENES.today.from + 66;

const run = (args: string[]) => execFileSync('npx', args, { cwd: FILM, stdio: 'inherit' });
mkdirSync(OUT, { recursive: true });

run(['tsx', 'scripts/render-showcase-audio.ts']);

run([
  'remotion', 'render', 'Showcase', join(OUT, 'showcase.mp4'),
  '--codec=h264',
  '--crf=18',
  '--x264-preset=slow',
  '--pixel-format=yuv420p',
  // Tagged BT.709, limited range: what Safari and every phone expect from H.264.
  '--color-space=bt709',
  '--audio-codec=aac',
  '--audio-bitrate=160k',
  '--jpeg-quality=95',
]);

run([
  'remotion', 'still', 'Showcase', join(OUT, 'poster.jpg'),
  `--frame=${POSTER_FRAME}`,
  '--image-format=jpeg',
  '--jpeg-quality=82',
  '--props={"withAudio":false}',
]);

/* The captions: each scene's line, while it is on screen. */
const ts = (frame: number) => {
  const ms = Math.round((frame / FPS) * 1000);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
const order: SceneId[] = ['open', 'today', 'plan', 'syllabus', 'mocks', 'decks', 'pack', 'notes', 'streak', 'end'];
const cues = order.map((id, i) => {
  const c = CAPTIONS[id];
  const from = SCENES[id].from + (id === 'open' ? 12 : 4);
  const to = id === 'end' ? DURATION : SCENES[id].from + SCENES[id].dur;
  const text = id === 'end' ? `${c.lead} ${c.em}\n${SITE_LINE}` : `${c.lead} ${c.em}`;
  return `${i + 1}\n${ts(from)} --> ${ts(to)}\n${text}`;
});
writeFileSync(join(OUT, 'captions.vtt'), `WEBVTT\n\n${cues.join('\n\n')}\n`);

for (const f of ['showcase.mp4', 'poster.jpg', 'captions.vtt']) {
  const kb = statSync(join(OUT, f)).size / 1024;
  console.log(`${f.padEnd(14)} ${kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(0)} kB`}`);
}
