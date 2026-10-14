/* Unit tests for the pure parts of Alpha Decks (decks/tests/*.test.ts), or of
   another feature's <folder>/tests: `node scripts/test-decks.mjs streak`.

   No test framework is installed in this repo, and none is needed: esbuild
   (already here through vite) bundles each test file, and Node's built-in
   runner executes it. `npm run test:decks`. */

import { build } from 'esbuild';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const feature = process.argv[2] ?? 'decks';
const dir = join(root, feature, 'tests');
const files = readdirSync(dir).filter(f => f.endsWith('.test.ts'));
const out = mkdtempSync(join(tmpdir(), `${feature}-tests-`));

try {
  await build({
    entryPoints: files.map(f => join(dir, f)),
    outdir: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    logLevel: 'warning',
    jsx: 'automatic',
  });
  const run = spawnSync(process.execPath, ['--test', ...files.map(f => join(out, f.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
