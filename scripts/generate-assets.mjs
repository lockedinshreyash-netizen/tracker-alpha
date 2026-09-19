/* ── Brand assets, generated from one source image ──
   Regenerate with:  npm run assets:generate
   Source of truth:  public/icon-512.png  (everything below is derived from it)

   Produces: favicon.ico (16/32/48), favicon-16/32/48.png, apple-touch-icon.png,
   icon-maskable-512.png, og-image.png.

   Committed rather than generated at build time on purpose — these are brand
   assets, they change roughly never, and a build step that needs `sharp` on a
   deploy runner is a build that breaks on a machine nobody is watching.

   `sharp` is present via kokoro-js rather than declared directly. If that
   dependency ever goes, install sharp before running this. Nothing in the app
   itself imports it.
*/
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PUB = process.argv[2];
const SRC = path.join(PUB, 'icon-512.png');
/* Pure black, not --bg-base #0B0B0D. The source icon's own field is #000000,
   and padding it with the app's near-black leaves a visible square seam where
   the two meet — the one artefact a launcher icon cannot have. */
const INK = { r: 0, g: 0, b: 0, alpha: 1 };

// ── Favicons ──────────────────────────────────────────────────────────────
for (const size of [16, 32, 48, 180, 192, 512]) {
  const out = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`;
  if (size === 192 || size === 512) continue;
  await sharp(SRC).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(PUB, out));
}

// ── Maskable ──────────────────────────────────────────────────────────────
// Android crops a maskable icon to a circle/squircle. Content must sit inside
// the inner 80% — so the glyph is scaled to 66% on a solid field, which is what
// keeps the alpha off the crop line on every launcher shape.
const inner = Math.round(512 * 0.66);
await sharp({ create: { width: 512, height: 512, channels: 4, background: INK } })
  .composite([{ input: await sharp(SRC).resize(inner, inner).toBuffer(), gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUB, 'icon-maskable-512.png'));

// ── favicon.ico ───────────────────────────────────────────────────────────
// Written by hand: an ICO is a 6-byte ICONDIR, one 16-byte ICONDIRENTRY per
// image, then the payloads — and since Vista the payload may be a whole PNG,
// which every browser in use understands. No extra dependency for six bytes of
// header arithmetic.
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map(s => sharp(SRC).resize(s, s).png().toBuffer()));
const dir = Buffer.alloc(6 + 16 * icoSizes.length);
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(icoSizes.length, 4);
let offset = dir.length;
icoSizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  dir.writeUInt8(s === 256 ? 0 : s, e);       // width
  dir.writeUInt8(s === 256 ? 0 : s, e + 1);   // height
  dir.writeUInt8(0, e + 2);                   // palette
  dir.writeUInt8(0, e + 3);                   // reserved
  dir.writeUInt16LE(1, e + 4);                // colour planes
  dir.writeUInt16LE(32, e + 6);               // bits per pixel
  dir.writeUInt32LE(pngs[i].length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([dir, ...pngs]));

console.log('icons written');

// ── Social card (og:image / twitter:image) ────────────────────────────────
// 1200×630, the size every crawler crops to. Drawn rather than screenshotted so
// it is reproducible from the repo: `node gen-assets.mjs public` regenerates it.
//
// Type is a heavy grotesque rather than the app's Anton — sharp's bundled
// librsvg resolves fonts through its own fontconfig and will not load one from
// this repo, and a card that renders differently on another machine is worse
// than one that renders the same everywhere. The α does the brand recognition.
const OG_W = 1200, OG_H = 630;
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <radialGradient id="glow" cx="22%" cy="45%" r="62%">
      <stop offset="0%"   stop-color="#E10600" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#E10600" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="#0B0B0D"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#glow)"/>

  <!-- The countdown rule from the app's own header, at the same 64%. -->
  <rect x="0" y="0" width="${OG_W}" height="7" fill="#17171A"/>
  <rect x="0" y="0" width="${Math.round(OG_W * 0.64)}" height="7" fill="#E10600"/>

  <text x="406" y="268" font-family="${SANS}" font-size="82" font-weight="700"
        letter-spacing="-1.5" fill="#FFFFFF">TRACKER ALPHA</text>

  <rect x="408" y="300" width="86" height="5" fill="#E10600"/>

  <text x="406" y="368" font-family="${SANS}" font-size="31" font-weight="500" fill="#A1A1AA">
    The free JEE 2027 study tracker. No fluff.
  </text>
  <text x="406" y="414" font-family="${SANS}" font-size="31" font-weight="500" fill="#A1A1AA">
    Hours, syllabus, questions, streaks.
  </text>

  <text x="406" y="512" font-family="${SANS}" font-size="21" font-weight="600"
        letter-spacing="2.4" fill="#5B5B63">TRACKERALPHA.IN</text>
</svg>`;

await sharp(Buffer.from(og))
  .composite([{
    input: await sharp(SRC).resize(250, 250).toBuffer(),
    left: 104, top: 190,
    /* `screen` so the icon's own black field drops out against the card
       instead of sitting on it as a slightly different black square. */
    blend: 'screen',
  }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUB, 'og-image.png'));

console.log('social card written');
