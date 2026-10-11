/* ── Build-time render of the landing page ──
   Bundled for Node and run by the `prerender-landing` Vite plugin
   (scripts/prerenderLanding.ts) after every production build, together with
   the static guide pages in site/. Never imported by the app. */

import React from 'react';
import { renderToString } from 'react-dom/server';
import LandingPage from '../LandingPage';
import { setLandingClock } from './clock';
import { DESCRIPTION, TITLE, jsonLdScript, llmsTxt } from './seo';
import { buildSite, sitemapXml } from '../site/build';

/* The guide pages (site/) ride the same bundle, so one esbuild pass renders everything. */
export { buildSite, sitemapXml };

export const prerender = (builtAt: number, guides: Array<{ path: string; label: string; description: string }> = []) => {
  setLandingClock(builtAt);
  return {
    html: renderToString(<LandingPage onCtaClick={() => {}} />),
    head: jsonLdScript(builtAt),
    llms: llmsTxt(builtAt, guides),
    title: TITLE,
    description: DESCRIPTION,
  };
};
