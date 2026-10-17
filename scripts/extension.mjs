/* Builds the new-tab extension (extension/) for the Chrome Web Store.
   `npm run extension:build`

   1. Icons at 16/32/48/128 from public/icon-512.png, the app's own icon.
   2. Checks the manifest points only at files that exist.
   3. Zips extension/ into dist-extension/tracker-alpha-extension-<version>.zip,
      which is the file the Web Store's developer dashboard takes.

   The extension has no build step of its own: plain HTML, CSS and JS load
   faster on every new tab than a bundle would, and the store reviews exactly
   the source that ships. */

import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const ext = join(root, 'extension');
const out = join(root, 'dist-extension');

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));

mkdirSync(join(ext, 'icons'), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(join(root, 'public', 'icon-512.png'))
    .resize(size, size, { kernel: size <= 32 ? 'lanczos3' : 'mitchell' })
    .png({ compressionLevel: 9 })
    .toFile(join(ext, 'icons', `icon-${size}.png`));
}

const referenced = [
  ...Object.values(manifest.icons),
  manifest.chrome_url_overrides.newtab,
  ...manifest.content_scripts.flatMap(c => c.js),
  manifest.background.service_worker,
  'newtab.css', 'newtab.js', 'ascii.js', 'palettes.js', 'welcome.html', 'welcome.js',
  'fonts/satoshi-500.woff2', 'fonts/satoshi-700.woff2', 'fonts/satoshi-900.woff2', 'fonts/playfair-italic.woff2',
];
const missing = referenced.filter(f => !existsSync(join(ext, f)));
if (missing.length) throw new Error(`extension: missing ${missing.join(', ')}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const zip = join(out, `tracker-alpha-extension-${manifest.version}.zip`);
/* The design board (board.*) is for us, not for students: never packed. */
execFileSync('zip', ['-r', '-X', '-q', zip, '.', '-x', '.*', '-x', '__MACOSX/*', '-x', 'README.md', '-x', 'board.html', '-x', 'board.css', '-x', 'board.js'], { cwd: ext });
console.log(`extension: ${manifest.name} ${manifest.version} → ${zip.replace(root + '/', '')}`);
