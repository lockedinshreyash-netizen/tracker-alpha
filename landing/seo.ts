/* ── What machines read ──
   Built at build time by landing/prerender.tsx, from the same content.ts the
   page renders, so the structured data can never claim what the page does not
   say (Google drops markup that disagrees with the visible text).

   - jsonLd(): one @graph — Organization, WebSite, WebApplication, WebPage and
     FAQPage — linked by @id so engines read them as one entity.
   - llmsTxt(): /llms.txt, the plain-Markdown summary that AI assistants and
     their crawlers look for. Facts first, in sentences worth quoting. */

import { DEFINITION, FAQ, FEATURES, INCLUDED, SITE } from './content';

export const TITLE = 'Tracker Alpha: Free JEE & NEET Study Tracker App for 2027';
export const DESCRIPTION =
  'Free study tracker for JEE and NEET 2027. Time every session, plan your day, track the syllabus chapter-wise, log mock tests and keep your streak. No ads.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const istDate = (ms: number) => {
  const d = new Date(ms + 330 * 60_000);
  return { iso: d.toISOString().slice(0, 10), long: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
};

export const jsonLd = (builtAt: number): object => {
  const id = (frag: string) => `${SITE.url}#${frag}`;
  const modified = istDate(builtAt).iso;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': id('organization'),
        name: SITE.name,
        url: SITE.url,
        logo: { '@type': 'ImageObject', url: SITE.logo, width: 512, height: 512 },
        email: SITE.email,
        sameAs: [SITE.instagram],
        areaServed: { '@type': 'Country', name: 'India' },
      },
      {
        '@type': 'WebSite',
        '@id': id('website'),
        url: SITE.url,
        name: SITE.name,
        alternateName: ['LOCK IN', 'Tracker Alpha study tracker'],
        description: DESCRIPTION,
        inLanguage: 'en-IN',
        publisher: { '@id': id('organization') },
      },
      {
        '@type': 'WebApplication',
        '@id': id('app'),
        name: SITE.name,
        alternateName: 'LOCK IN',
        url: SITE.url,
        description: DEFINITION,
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Study tracker',
        operatingSystem: 'Android, iOS, Windows, macOS, ChromeOS (any modern web browser)',
        browserRequirements: 'Requires JavaScript. Installable to the home screen.',
        inLanguage: 'en-IN',
        isAccessibleForFree: true,
        image: SITE.image,
        screenshot: SITE.image,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', availability: 'https://schema.org/InStock', category: 'free' },
        featureList: FEATURES.map(f => f.title),
        audience: {
          '@type': 'EducationalAudience',
          educationalRole: 'student',
          audienceType: 'JEE Main, JEE Advanced and NEET UG aspirants in Class 11, Class 12 and droppers',
        },
        keywords: 'JEE study tracker, NEET study tracker, study hours tracker, study planner, JEE syllabus tracker, Pomodoro timer, mock test tracker, error notebook, flashcards, study streak, study group leaderboard, JEE 2027, NEET 2027',
        publisher: { '@id': id('organization') },
      },
      {
        '@type': 'WebPage',
        '@id': id('webpage'),
        url: SITE.url,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'en-IN',
        isPartOf: { '@id': id('website') },
        about: { '@id': id('app') },
        mainEntity: { '@id': id('app') },
        primaryImageOfPage: { '@type': 'ImageObject', url: SITE.image, width: 1200, height: 630 },
        dateModified: modified,
      },
      {
        '@type': 'FAQPage',
        '@id': id('faq'),
        url: `${SITE.url}#faq`,
        isPartOf: { '@id': id('webpage') },
        inLanguage: 'en-IN',
        mainEntity: FAQ.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
};

/** Safe inside <script>: no "</script>" can close it early. */
export const jsonLdScript = (builtAt: number): string =>
  `<script type="application/ld+json">${JSON.stringify(jsonLd(builtAt)).replace(/</g, '\\u003c')}</script>`;

export const llmsTxt = (builtAt: number, guides: Array<{ path: string; label: string; description: string }> = []): string => {
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${DEFINITION}`,
    '',
    '## Key facts',
    '',
    `- Website: ${SITE.url}`,
    '- Price: free (₹0). No trial, no card, no ads.',
    '- Made for: JEE Main, JEE Advanced and NEET UG aspirants in Class 11, Class 12 and droppers, preparing for 2027 or 2028.',
    '- Subjects: Physics, Chemistry and Maths for JEE; Physics, Chemistry and Biology for NEET.',
    '- Works in any browser on Android, iPhone, tablets and laptops, and can be installed to the home screen.',
    '- No account is needed to start. A free account syncs devices and unlocks study groups and the leaderboard.',
    '- The study day resets at 4 AM IST, so late-night study counts for the day it belongs to.',
    '- The study timer is a stopwatch or a Pomodoro timer, and each session gets a 1 to 5 focus rating.',
    '- A 365-day study streak of timed sessions earns a physical hamper, shipped to the student.',
    '',
    '## Features',
    '',
    ...FEATURES.map(f => `- [${f.title}](${SITE.url}#feature-${f.id}): ${f.body}`),
    '',
    '## Everything included for free',
    '',
    ...INCLUDED.map(x => `- ${x}`),
    '',
    '## Frequently asked questions',
    '',
    ...FAQ.flatMap(f => [`### ${f.q}`, '', f.a, '']),
    ...(guides.length
      ? ['## Free syllabus guides', '', ...guides.map(g => `- [${g.label}](${SITE.url.replace(/\/$/, '')}${g.path}): ${g.description}`), '']
      : []),
    '## Contact',
    '',
    `- Instagram: ${SITE.instagram}`,
    `- Email: ${SITE.email}`,
    '',
    `Last updated: ${istDate(builtAt).long}`,
    '',
  ];
  return lines.join('\n');
};
