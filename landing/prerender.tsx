/* ── Build-time render of the landing page ──
   Bundled for Node and run by the `prerender-landing` Vite plugin
   (scripts/prerenderLanding.ts) after every production build, together with
   the static guide pages in site/. Never imported by the app. */

import React from 'react';
import { renderToString } from 'react-dom/server';
import LandingPage from '../LandingPage';
import { setLandingClock } from './clock';
import { jsonLdScript, llmsTxt, pageUrl } from './seo';
import { ROOT, VARIANTS, pageDescription, pageTitle, type Variant } from './content';
import { buildSite, sitemapXml } from '../site/build';

/* The guide pages (site/) ride the same bundle, so one esbuild pass renders everything. */
export { buildSite, sitemapXml };

const page = (builtAt: number, v: Variant) => ({
  id: v.id,
  path: v.path,
  url: pageUrl(v),
  html: renderToString(<LandingPage onCtaClick={() => {}} variant={v} />),
  head: jsonLdScript(builtAt, v),
  title: pageTitle(v),
  description: pageDescription(v),
});

/* The root page, then one per exam (landing/content.ts VARIANTS), each written
   to its own copy of index.html by scripts/prerenderLanding.ts. */
export const prerender = (builtAt: number, guides: Array<{ path: string; label: string; description: string }> = []) => {
  setLandingClock(builtAt);
  return {
    ...page(builtAt, ROOT),
    llms: llmsTxt(builtAt, guides),
    variants: VARIANTS.map(v => page(builtAt, v)),
  };
};
