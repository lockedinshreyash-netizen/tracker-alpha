/* ── What machines read ──
   Built at build time by landing/prerender.tsx, from the same content.ts the
   page renders, so the structured data can never claim what the page does not
   say (Google drops markup that disagrees with the visible text).

   - jsonLd(): one @graph — Organization, WebSite, WebApplication, WebPage and
     FAQPage — linked by @id so engines read them as one entity. Each exam's
     page (VARIANTS) gets its own WebPage and FAQPage, pointing at the same
     Organization, WebSite and WebApplication on the root.
   - llmsTxt(): /llms.txt, the plain-Markdown summary that AI assistants and
     their crawlers look for. Facts first, in sentences worth quoting. */

import { DEFINITION, FEATURES, ROOT, SITE, VARIANTS, WAYS, faqFor, pageDescription, pageTitle, type Variant } from './content';

const ORIGIN = SITE.url.replace(/\/$/, '');
export const pageUrl = (v: Variant): string => `${ORIGIN}${v.path}`;


const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const istDate = (ms: number) => {
  const d = new Date(ms + 330 * 60_000);
  return { iso: d.toISOString().slice(0, 10), long: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
};

export const jsonLd = (builtAt: number, v: Variant = ROOT): object => {
  const id = (frag: string) => `${SITE.url}#${frag}`;
  const here = (frag: string) => `${pageUrl(v)}#${frag}`;
  const TITLE = pageTitle(v);
  const DESCRIPTION = pageDescription(v);
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
        description: pageDescription(ROOT),
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
        image: SITE.image,
        screenshot: SITE.image,
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
        '@id': here('webpage'),
        url: pageUrl(v),
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
        '@id': here('faq'),
        url: `${pageUrl(v)}#faq`,
        isPartOf: { '@id': here('webpage') },
        inLanguage: 'en-IN',
        mainEntity: faqFor(v).map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
};

/** Safe inside <script>: no "</script>" can close it early. */
export const jsonLdScript = (builtAt: number, v: Variant = ROOT): string =>
  `<script type="application/ld+json">${JSON.stringify(jsonLd(builtAt, v)).replace(/</g, '\\u003c')}</script>`;

export const llmsTxt = (builtAt: number, guides: Array<{ path: string; label: string; description: string }> = []): string => {
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${DEFINITION}`,
    '',
    '## Key facts',
    '',
    `- Website: ${SITE.url}`,
    '- Access: invite-only from 1 November 2026, so the app stays fast while it grows.',
    '- Three ways in: an invite from a member (every member has exactly one), the Priority Pass (₹2,500 paid once for lifetime access; not on sale yet), or the waitlist (sign in with Google, apply, get a place number; people are let in by waves).',
    '- Members do not pay. The Priority Pass is only for skipping the line.',
    '- Everyone who used the app before 1 November 2026 is a founding member.',
    '- Made for: Class 11, Class 12 and droppers preparing for JEE Main, JEE Advanced, NEET UG, BITSAT, MHT CET, WBJEE, KCET, COMEDK UGET or VITEEE, in 2027 or 2028.',
    '- Subjects: Physics, Chemistry and Maths for engineering exams; Physics, Chemistry and Biology for NEET.',
    '- Every day, students race on a live leaderboard of study hours, which resets at 4 AM IST, and study in groups with friends.',
    '- Works in any browser on Android, iPhone, tablets and laptops, and can be installed to the home screen.',
    '- Sign-in is with Google. It syncs phone and laptop, and unlocks study groups and the leaderboard.',
    '- The study day resets at 4 AM IST, so late-night study counts for the day it belongs to.',
    '- The study timer is a stopwatch or a Pomodoro timer, and each session gets a 1 to 5 focus rating.',
    '- A 365-day study streak of timed sessions earns a physical hamper, shipped to the student.',
    '',
    '## Features',
    '',
    ...FEATURES.map(f => `- ${f.title}: ${f.body}`),
    '',
    '## A page for each exam',
    '',
    ...VARIANTS.map(v => `- [${v.label} study tracker](${pageUrl(v)}): ${pageDescription(v)}`),
    '',
    '## Three ways in',
    '',
    ...WAYS.map(w => `- ${w.title}: ${w.small}`),
    '',
    '## Frequently asked questions',
    '',
    ...faqFor(ROOT).flatMap(f => [`### ${f.q}`, '', f.a, '']),
    ...(guides.length
      ? ['## Syllabus guides (open to everyone)', '', ...guides.map(g => `- [${g.label}](${SITE.url.replace(/\/$/, '')}${g.path}): ${g.description}`), '']
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
