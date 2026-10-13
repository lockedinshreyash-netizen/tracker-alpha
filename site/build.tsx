/* ── Turning the guide pages into files ──
   Called by the prerender-landing Vite plugin (scripts/prerenderLanding.ts)
   with the stylesheet's text. Returns finished HTML documents — head, inlined
   CSS, JSON-LD, analytics — plus the sitemap and the list llms.txt links to.

   Static markup only (renderToStaticMarkup): these pages ship no JavaScript of
   ours, so there is nothing to hydrate and no React attributes to carry. */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTENT_UPDATED, SITE_URL, Shell, SitePage, allPages } from './pages';
import { legalPages } from './legal';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (page: SitePage): string => {
  const url = `${SITE_URL}${page.path}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: page.title.replace(/ \| Tracker Alpha$/, ''),
        description: page.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        dateModified: page.updated ?? CONTENT_UPDATED,
        isAccessibleForFree: true,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: page.crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: `${SITE_URL}${c.path}`,
        })),
      },
      // The legal pages have no FAQ, and an empty FAQPage is an error in Search Console.
      ...(page.faq.length ? [{
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        isPartOf: { '@id': `${url}#webpage` },
        mainEntity: page.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }] : []),
    ],
  };
  return JSON.stringify(graph).replace(/</g, '\\u003c');
};

const document = (page: SitePage, pages: SitePage[], css: string): string => {
  let body = renderToStaticMarkup(<Shell page={page} pages={pages} />);
  /* React 19 hoists a preload for the logo to the front of the markup; it
     belongs in <head>. */
  const preloads: string[] = [];
  body = body.replace(/^(<link rel="preload"[^>]*\/>)+/, m => { preloads.push(m); return ''; });
  const url = `${SITE_URL}${page.path}`;
  const title = esc(page.title);
  const desc = esc(page.description);
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta name="theme-color" content="#0a0a0b" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Tracker Alpha" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="en_IN" />
<meta property="article:modified_time" content="${page.updated ?? CONTENT_UPDATED}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://fonts.cdnfonts.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:ital,wght@1,400&display=swap" rel="stylesheet" />
<link href="https://fonts.cdnfonts.com/css/satoshi" rel="stylesheet" />
${preloads.join('\n')}
<style>${css}</style>
<script type="application/ld+json">${jsonLd(page)}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SNSQ4DMRQH"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-SNSQ4DMRQH');</script>
</head>
<body>
${body}
</body>
</html>
`;
};

export interface BuiltSite {
  files: Array<{ path: string; html: string }>;
  /** Paths for the sitemap, homepage first. */
  urls: Array<{ path: string; lastmod: string }>;
  guides: Array<{ path: string; label: string; description: string }>;
}

/* The legal pages (site/legal.tsx) are built in the same shell and go in the
   sitemap, but they are not guides: the footers' guide lists, the landing
   page's "Free guides" and llms.txt list only `pages`. */
export const buildSite = (css: string): BuiltSite => {
  const pages = allPages();
  const all = [...pages, ...legalPages()];
  return {
    files: all.map(p => ({ path: p.path, html: document(p, pages, css) })),
    urls: all.map(p => ({ path: p.path, lastmod: p.updated ?? CONTENT_UPDATED })),
    guides: pages.map(p => ({ path: p.path, label: p.label, description: p.description })),
  };
};

export const sitemapXml = (homeLastmod: string, urls: BuiltSite['urls']): string => `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated at build time by scripts/prerenderLanding.ts from site/pages.tsx. Do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${homeLastmod}</lastmod></url>
${urls.map(u => `  <url><loc>${SITE_URL}${u.path}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
