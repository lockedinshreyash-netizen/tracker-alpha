/* ── Voice clip generator ──
   Renders every phrase in voice/clipManifest.ts to an AAC clip with Kokoro-82M,
   run locally. Nothing here ships to the browser: the app only ever fetches the
   finished audio, so users pay no model download and no synthesis latency.

   Run: npm run voice:generate
   Output: public/voice/<id>.m4a  (+ index.json)

   Already-rendered clips are skipped, so an interrupted run resumes where it
   stopped. Pass --force to re-render everything, --only=<substr> to work on a
   subset, and --voice=<id> to change speaker.

   AAC rather than Opus deliberately: the audience is mostly Windows and
   Android, where AAC is hardware-decoded and universally supported, and it
   still plays on Safari and iOS where Opus support is patchy. */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allClips } from '../voice/clipManifest.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'voice');
const TMP_WAV = join(OUT_DIR, '.tmp.wav');

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const FORCE = args.includes('--force');
const ONLY = flag('only');
const VOICE = flag('voice') ?? 'af_heart';
/* Build-time, so quality wins over speed and size: fp32 is the unquantised
   graph. The weights are downloaded once to the local HF cache. */
const DTYPE = (flag('dtype') ?? 'fp32') as 'fp32' | 'q8';
const BITRATE = flag('bitrate') ?? '48000';

const encode = (wav: string, out: string) => {
  // afconvert ships with macOS; the AAC it writes is standard MPEG-4 audio.
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', BITRATE, wav, out], { stdio: 'pipe' });
};

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });

  let clips = allClips();
  if (ONLY) clips = clips.filter(c => c.id.includes(ONLY) || c.phrase.includes(ONLY));

  const pending = FORCE ? clips : clips.filter(c => !existsSync(join(OUT_DIR, `${c.id}.m4a`)));
  console.log(`${clips.length} clips in manifest, ${pending.length} to render (voice=${VOICE}, dtype=${DTYPE})`);
  if (!pending.length) {
    writeIndex(clips.map(c => c.id));
    return;
  }

  console.log('Loading Kokoro…');
  const { KokoroTTS } = await import('kokoro-js');
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: 'cpu' });
  console.log('Model ready.\n');

  const started = Date.now();
  let done = 0;
  let failed = 0;

  for (const clip of pending) {
    const target = join(OUT_DIR, `${clip.id}.m4a`);
    try {
      const audio = await tts.generate(clip.phrase, { voice: VOICE as Parameters<typeof tts.generate>[1]['voice'] });
      writeFileSync(TMP_WAV, Buffer.from(audio.toWav()));
      encode(TMP_WAV, target);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${clip.id}: ${(err as Error).message}`);
      continue;
    }

    done++;
    if (done % 25 === 0 || done === pending.length) {
      const rate = done / ((Date.now() - started) / 1000);
      const left = Math.round((pending.length - done) / rate);
      console.log(`  ${done}/${pending.length}  (${rate.toFixed(1)}/s, ~${Math.floor(left / 60)}m ${left % 60}s left)`);
    }
  }

  rmSync(TMP_WAV, { force: true });
  writeIndex(clips.map(c => c.id));

  const bytes = readdirSync(OUT_DIR)
    .filter(f => f.endsWith('.m4a'))
    .reduce((a, f) => a + statSync(join(OUT_DIR, f)).size, 0);
  console.log(`\nRendered ${done}, failed ${failed}. Total ${(bytes / 1048576).toFixed(1)} MB across ${readdirSync(OUT_DIR).filter(f => f.endsWith('.m4a')).length} files.`);
};

/** Lets the app tell "clip missing" apart from "clip never existed". */
const writeIndex = (ids: string[]) => {
  const present = ids.filter(id => existsSync(join(OUT_DIR, `${id}.m4a`)));
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ voice: VOICE, format: 'm4a', ids: present.sort() }, null, 0));
  console.log(`index.json: ${present.length}/${ids.length} clips present.`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
