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
   sitemap covering all of them, and dist/llms.txt.

   The landing page is written more than once: into dist/index.html for "/",
   and into dist/<exam>-study-tracker/index.html for each exam's version
   (landing/content.ts VARIANTS). Each copy is the whole app shell, so the
   page hydrates and its buttons work exactly as on "/"; #root carries
   `data-lp-variant` so the browser renders the version it was served, and
   the canonical and share tags point at that copy's own address. */

import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Plugin, ResolvedConfig } from 'vite';

const EMPTY_ROOT = '<div id="root"></div>';

interface SiteGuide { path: string; label: string; description: string }
interface LandingDoc { id: string; path: string; url: string; html: string; head: string; title: string; description: string }

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
        prerender: (t: number, guides: SiteGuide[]) => LandingDoc & { llms: string; variants: LandingDoc[] };
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
      const landing = mod.prerender(builtAt, site.guides);
      const today = new Date(builtAt + 330 * 60_000).toISOString().slice(0, 10);
      const examUrls = landing.variants.map(v => ({ path: v.path, lastmod: today }));
      await writeFile(path.join(outDir, 'sitemap.xml'), mod.sitemapXml(today, [...examUrls, ...site.urls]));

      const indexPath = path.join(outDir, 'index.html');
      const template = await readFile(indexPath, 'utf8');
      if (!template.includes(EMPTY_ROOT)) throw new Error(`prerender-landing: ${EMPTY_ROOT} not found in ${indexPath}`);

      const fill = (page: LandingDoc, variant: boolean): string => {
        if (page.html.length < 2000) throw new Error(`prerender-landing: ${page.path} is suspiciously short`);
        const attrs = `data-lp-built="${builtAt}"${variant ? ` data-lp-variant="${escapeHtml(page.id)}"` : ''}`;
        let doc = template.replace(EMPTY_ROOT, `<div id="root" ${attrs}>${page.html}</div>`);
        // Title and description from landing/seo.ts, so production has one source.
        const TITLE_RE = /<title>[\s\S]*?<\/title>/;
        const DESC_RE = /(<meta name="description"\s+content=")[^"]*(")/;
        if (!TITLE_RE.test(doc) || !DESC_RE.test(doc)) throw new Error('prerender-landing: <title> or meta description not found');
        doc = doc
          .replace(TITLE_RE, `<title>${escapeHtml(page.title)}</title>`)
          .replace(DESC_RE, (_m, a: string, b: string) => `${a}${escapeHtml(page.description)}${b}`);
        if (variant) {
          // Its own address, or Google folds the page into "/" as a duplicate.
          const swaps: Array<[RegExp, string]> = [
            [/(<link rel="canonical" href=")[^"]*(")/, page.url],
            [/(<meta property="og:url" content=")[^"]*(")/, page.url],
            [/(<meta property="og:title" content=")[^"]*(")/, page.title],
            [/(<meta name="twitter:title" content=")[^"]*(")/, page.title],
            [/(<meta property="og:description"\s+content=")[^"]*(")/, page.description],
            [/(<meta name="twitter:description"\s+content=")[^"]*(")/, page.description],
          ];
          for (const [re, value] of swaps) {
            if (!re.test(doc)) throw new Error(`prerender-landing: ${re} not found for ${page.path}`);
            doc = doc.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`);
          }
        }
        // The LAST </head>: the first could be inside a comment.
        const headEnd = doc.lastIndexOf('</head>');
        if (headEnd < 0) throw new Error('prerender-landing: </head> not found');
        return `${doc.slice(0, headEnd)}  ${page.head}\n${doc.slice(headEnd)}`;
      };

      await writeFile(indexPath, fill(landing, false));
      for (const v of landing.variants) {
        const dir = path.join(outDir, ...v.path.split('/').filter(Boolean));
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'index.html'), fill(v, true));
      }
      await writeFile(path.join(outDir, 'llms.txt'), landing.llms);

      config.logger.info(`prerender-landing: ${Math.round(landing.html.length / 1024)} kB of landing HTML, ${landing.variants.length} exam pages, ${site.files.length} static pages (guides + legal), sitemap, JSON-LD and llms.txt written`);
    },
  };
};
