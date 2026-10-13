/**
 *   npx tsx scripts/stills.ts 0 96 1400 ...              → out/stills/f<frame>.png
 *   npx tsx scripts/stills.ts --id=Arena 0 96 ...        → out/stills/arena-f<frame>.png
 * One bundle, many frames. For checking the picture without scrubbing.
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const id = args.find(a => a.startsWith('--id='))?.split('=')[1] ?? 'Score';
const frames = args.filter(a => !a.startsWith('--')).map(Number);
const prefix = id === 'Score' ? 'f' : `${id.toLowerCase()}-f`;
const run = async () => {
  const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
  const composition = await selectComposition({ serveUrl, id, chromiumOptions: { gl: 'angle' } });
  mkdirSync('out/stills', { recursive: true });
  for (const frame of frames) {
    const output = `out/stills/${prefix}${String(frame).padStart(5, '0')}.png`;
    await renderStill({ serveUrl, composition, frame, output, chromiumOptions: { gl: 'angle' }, scale: 0.5 });
    console.log(output);
  }
};
run().catch(e => {
  console.error(e);
  process.exit(1);
});
