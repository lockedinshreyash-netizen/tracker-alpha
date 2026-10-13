/* ── The Play app (twa/) ──
   A thin wrapper over Bubblewrap, so the two things it needs from outside the
   repo — the signing passwords and a pinned version of itself — are never
   typed by hand.

     npm run android:build
         Signed twa/app-release-bundle.aab (upload this to Play) and
         twa/app-release-signed.apk (sideload this to test).

     npm run android:fingerprint -- <SHA-256> "<what it is>"
         Trust another signing key: adds it to twa/twa-manifest.json and
         rewrites public/.well-known/assetlinks.json. Deploy the site after.

   Needs ~/.bubblewrap/config.json (JDK 17 + Android SDK) and the gitignored
   twa/upload.keystore + twa/signing.local.json. See twa/README.md. */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TWA = path.join(ROOT, 'twa');
const MANIFEST = path.join(TWA, 'twa-manifest.json');
const CHECKSUM = path.join(TWA, 'manifest-checksum.txt');
const SIGNING = path.join(TWA, 'signing.local.json');
const ASSETLINKS = path.join(ROOT, 'public', '.well-known', 'assetlinks.json');

// Pinned: a Bubblewrap upgrade regenerates the Android project from a new
// template, which is a change to review, not something a build should pick up.
const BUBBLEWRAP = '@bubblewrap/cli@1.27.0';

const bubblewrap = (args, env = {}) => {
  const r = spawnSync('npx', ['--yes', BUBBLEWRAP, ...args], {
    cwd: TWA,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const sha1 = file => createHash('sha1').update(fs.readFileSync(file)).digest('hex');

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'build') {
  if (!fs.existsSync(SIGNING)) {
    console.error(`No ${path.relative(ROOT, SIGNING)}: the upload key's passwords live there. See twa/README.md.`);
    process.exit(1);
  }
  const s = JSON.parse(fs.readFileSync(SIGNING, 'utf8'));
  bubblewrap(['build'], {
    BUBBLEWRAP_KEYSTORE_PASSWORD: s.keystorePassword,
    BUBBLEWRAP_KEY_PASSWORD: s.keyPassword,
  });
} else if (cmd === 'fingerprint') {
  const [sha256, name = 'Signing key'] = rest;
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(sha256 ?? '')) {
    console.error('Usage: npm run android:fingerprint -- AB:CD:…(32 pairs) "Play app signing key"');
    process.exit(1);
  }
  /* A fingerprint changes what the website vouches for, not what the app is,
     so the Android project is not regenerated for it. Bubblewrap would see a
     changed manifest on the next build and offer to "update", which also bumps
     the version code — so the checksum is re-sealed, but only if it was
     current before: a manifest with other unbuilt edits keeps the prompt. */
  const sealed = fs.readFileSync(CHECKSUM, 'utf8').trim() === sha1(MANIFEST);
  fs.mkdirSync(path.dirname(ASSETLINKS), { recursive: true });
  bubblewrap(['fingerprint', 'add', sha256.toUpperCase(), `--name=${name}`, `--output=${ASSETLINKS}`]);
  if (sealed) fs.writeFileSync(CHECKSUM, sha1(MANIFEST));
  console.log(`\nNow deploy the site so https://trackeralpha.in/.well-known/assetlinks.json serves it.`);
} else {
  console.error('Usage: node scripts/android.mjs build | fingerprint <SHA-256> "<name>"');
  process.exit(1);
}
