/* ── Voice clip check ──
   Generation can succeed and still produce a bad clip: a truncated render, or a
   file that is valid AAC but silent. Neither throws, and neither is audible
   until a user hits it, so every clip is measured after the fact.

   Run: npm run voice:check */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allClips } from '../voice/clipManifest.ts';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'voice');

/** Words per second is roughly constant, so duration should track word count. */
const expectedSeconds = (phrase: string) => Math.max(0.6, phrase.split(/\s+/).length / 3.2);

const durationOf = (file: string): number => {
  const info = execFileSync('afinfo', [file], { encoding: 'utf8' });
  const m = info.match(/estimated duration:\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
};

const clips = allClips();
const missing: string[] = [];
const problems: string[] = [];
let bytes = 0;

for (const clip of clips) {
  const file = join(OUT_DIR, `${clip.id}.m4a`);
  if (!existsSync(file)) {
    missing.push(clip.id);
    continue;
  }

  const size = statSync(file).size;
  bytes += size;

  // A near-empty container means the render produced nothing.
  if (size < 2000) {
    problems.push(`${clip.id}: only ${size} bytes`);
    continue;
  }

  const seconds = durationOf(file);
  const expected = expectedSeconds(clip.phrase);
  if (seconds < 0.3) {
    problems.push(`${clip.id}: ${seconds.toFixed(2)}s — effectively empty`);
  } else if (seconds < expected * 0.45) {
    problems.push(`${clip.id}: ${seconds.toFixed(2)}s for "${clip.phrase}" (expected ~${expected.toFixed(1)}s) — truncated?`);
  } else if (seconds > expected * 3 + 2) {
    problems.push(`${clip.id}: ${seconds.toFixed(2)}s for "${clip.phrase}" (expected ~${expected.toFixed(1)}s) — runaway?`);
  }
}

const present = clips.length - missing.length;
console.log(`${present}/${clips.length} clips present, ${(bytes / 1048576).toFixed(1)} MB total, avg ${Math.round(bytes / Math.max(1, present) / 1024)} KB.`);

if (missing.length) {
  console.log(`\n${missing.length} missing (these fall back to the browser voice):`);
  missing.slice(0, 20).forEach(id => console.log('  ', id));
  if (missing.length > 20) console.log(`   …and ${missing.length - 20} more`);
}

if (problems.length) {
  console.log(`\n${problems.length} suspicious:`);
  problems.slice(0, 30).forEach(p => console.log('  ', p));
} else if (present) {
  console.log('\nNo silent or truncated clips found.');
}

const stray = readdirSync(OUT_DIR).filter(f => f.endsWith('.m4a') && !clips.some(c => `${c.id}.m4a` === f));
if (stray.length) console.log(`\n${stray.length} files no longer in the manifest (safe to delete): ${stray.slice(0, 5).join(', ')}…`);

process.exit(problems.length ? 1 : 0);
