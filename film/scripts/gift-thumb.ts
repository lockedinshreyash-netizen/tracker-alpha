/**
 *   npx tsx scripts/gift-thumb.ts   → ../public/gift/og-diwali.jpg and og.jpg
 * The gift link's preview image (src/gift/GiftThumb.tsx), at 1200×630.
 * JPEG, because WhatsApp drops a preview image much over 300 kB.
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('../public/gift');
const JOBS: Array<[string, string]> = [['GiftThumbDiwali', 'og-diwali.jpg'], ['GiftThumb', 'og.jpg']];

const run = async () => {
  const serveUrl = await bundle({ entryPoint: path.resolve('src/gift/index.ts') });
  mkdirSync(OUT, { recursive: true });
  for (const [id, file] of JOBS) {
    const composition = await selectComposition({ serveUrl, id });
    const output = path.join(OUT, file);
    await renderStill({ serveUrl, composition, frame: 0, output, imageFormat: 'jpeg', jpegQuality: 86 });
    console.log(`${output}  ${Math.round(statSync(output).size / 1024)} kB`);
  }
};
run().catch(e => {
  console.error(e);
  process.exit(1);
});
