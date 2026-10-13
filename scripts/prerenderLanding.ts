/* ── Pre-render the landing page into dist/index.html ──
   This is a client-rendered app: without this step, a crawler that does not
   run JavaScript — which is most AI crawlers (GPTBot, ClaudeBot,
   PerplexityBot, CCBot) and the first pass of everyone else — sees an empty
   <div id="root"> and nothing else. After it, the whole landing page is in
   the HTML, styled by the built stylesheet, and index.tsx hydrates it in place.

   Runs inside `vite build` (closeBundle), so it happens whether the host calls
   `vite build` or `npm run build`. It throws on any failure: a deploy without
   its landing HTML would silently drop out of search, and a failed build
   leaves the previous deploy serving instead.

   Writes: the landing page into #root (with its build time, which the
   browser's first render reuses so hydration matches), the JSON-LD graph into
   <head>, the static guide pages from site/ (dist/<path>/index.html), the
   sitemap covering all of them, and dist/llms.txt. */

import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Plugin, ResolvedConfig } from 'vite';

const EMPTY_ROOT = '<div id="root"></div>';

interface SiteGuide { path: string; label: string; description: string }

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const prerenderLanding = (): Plugin => {
  let config: ResolvedConfig;
  return {
    name: 'prerender-landing',
    apply: 'build',
    enforce: 'post',
    configResolved(c) { config = c; },
    async closeBundle() {
      if (config.build.ssr) return;
      const root = config.root;
      const outDir = path.resolve(root, config.build.outDir);
      const cache = path.join(root, 'node_modules', '.cache', 'prerender-landing');
      await mkdir(cache, { recursive: true });
      const entry = path.join(cache, 'entry.mjs');

      await build({
        entryPoints: [path.join(root, 'landing', 'prerender.tsx')],
        outfile: entry,
        bundle: true,
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        target: 'node18',
        // React stays external so the render uses the same copy the app ships.
        external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
        loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty' },
        logLevel: 'warning',
      });

      const builtAt = Date.now();
      // The query string defeats Node's module cache across watch rebuilds.
      const mod = await import(`${pathToFileURL(entry).href}?t=${builtAt}`) as {
        prerender: (t: number, guides: SiteGuide[]) => { html: string; head: string; llms: string; title: string; description: string };
        buildSite: (css: string) => { files: Array<{ path: string; html: string }>; urls: Array<{ path: string; lastmod: string }>; guides: SiteGuide[] };
        sitemapXml: (homeLastmod: string, urls: Array<{ path: string; lastmod: string }>) => string;
      };

      // The guide pages: one directory per page, so /jee-main-syllabus/ is served from its index.html.
      const css = await readFile(path.join(root, 'site', 'site.css'), 'utf8');
      const site = mod.buildSite(css);
      for (const f of site.files) {
        const dir = path.join(outDir, ...f.path.split('/').filter(Boolean));
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'index.html'), f.html);
      }
      const today = new Date(builtAt + 330 * 60_000).toISOString().slice(0, 10);
      await writeFile(path.join(outDir, 'sitemap.xml'), mod.sitemapXml(today, site.urls));

      const { html, head, llms, title, description } = mod.prerender(builtAt, site.guides);

      const indexPath = path.join(outDir, 'index.html');
      let doc = await readFile(indexPath, 'utf8');
      if (!doc.includes(EMPTY_ROOT)) throw new Error(`prerender-landing: ${EMPTY_ROOT} not found in ${indexPath}`);
      if (html.length < 2000) throw new Error('prerender-landing: rendered page is suspiciously short');
      doc = doc.replace(EMPTY_ROOT, `<div id="root" data-lp-built="${builtAt}">${html}</div>`);
      // Title and description from landing/seo.ts, so production has one source.
      const TITLE_RE = /<title>[\s\S]*?<\/title>/;
      const DESC_RE = /(<meta name="description"\s+content=")[^"]*(")/;
      if (!TITLE_RE.test(doc) || !DESC_RE.test(doc)) throw new Error('prerender-landing: <title> or meta description not found');
      doc = doc
        .replace(TITLE_RE, `<title>${escapeHtml(title)}</title>`)
        .replace(DESC_RE, (_m, a: string, b: string) => `${a}${escapeHtml(description)}${b}`);
      // The LAST </head>: the first could be inside a comment.
      const headEnd = doc.lastIndexOf('</head>');
      if (headEnd < 0) throw new Error('prerender-landing: </head> not found');
      doc = `${doc.slice(0, headEnd)}  ${head}\n${doc.slice(headEnd)}`;
      await writeFile(indexPath, doc);
      await writeFile(path.join(outDir, 'llms.txt'), llms);

      config.logger.info(`prerender-landing: ${Math.round(html.length / 1024)} kB of landing HTML, ${site.files.length} static pages (guides + legal), sitemap, JSON-LD and llms.txt written`);
    },
  };
};
