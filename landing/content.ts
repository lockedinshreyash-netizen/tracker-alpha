/* ── Every word on the landing page ──
   One source for three readers: the page itself, the structured data a search
   engine reads (`seo.ts`), and /llms.txt, which AI assistants read. Writing the
   FAQ once here is what keeps the FAQPage markup word-for-word identical to the
   visible answers — Google ignores structured data that says something the page
   does not.

   Rules for this copy:
   - The reader is sixteen, on a phone, and will read about ten words before
     deciding. Say it in fewer. A line a twelve-year-old could not read aloud
     first time is too hard.
   - Every claim must be true of the app today. No invented numbers, users,
     seat counts or waitlist sizes. Never "free" or ₹0: Alpha is invite-only.
   - Lead each FAQ answer with the answer. AI search quotes first sentences.
   - FEATURES is for machines (llms.txt, featureList), so it may say more than
     the page does. TOOLS is what the page shows: a title and five words.
   - One page per exam (VARIANTS): the root sells Alpha for every exam, and
     /bitsat-study-tracker/ is the same page told for BITSAT, so a student who
     searches "BITSAT study tracker" lands on their own exam. */

import { EXAMS as EXAM_DEFS, OFFICIAL, examById, yearChoices, type ExamId, type Stream } from '../content/exams';
import { landingNow } from './clock';

export type Exam = 'JEE' | 'NEET';

export const SITE = {
  name: 'Tracker Alpha',
  url: 'https://trackeralpha.in/',
  logo: 'https://trackeralpha.in/icon-512.png',
  image: 'https://trackeralpha.in/og-image.png',
  instagram: 'https://instagram.com/trackeralpha',
  email: 'lockinhq@gmail.com',
};

/* The one-sentence definition. It opens the FAQ, the structured data and
   llms.txt, so every engine learns the same thing about what this is. */
export const DEFINITION =
  'Tracker Alpha is an invite-only study tracker for JEE, NEET, BITSAT and other entrance exams. It times your study, tracks your syllabus, logs your mocks and puts you on a live leaderboard.';

/* ── One page per exam ──
   `exams[0]` is the one the countdown counts to. `stream` is what the CTA
   hands onboarding (App still thinks in streams: 'JEE' = PCM, 'NEET' = PCB). */
export interface Variant {
  id: string;
  /** '/' for the page that covers every exam. */
  path: string;
  /** How the page names the exam: "BITSAT". */
  label: string;
  exams: ExamId[];
  streams: Stream[];
}

export const ROOT: Variant = { id: 'all', path: '/', label: 'JEE, NEET and more', exams: ['jee-main', 'neet-ug'], streams: ['PCM', 'PCB'] };

export const VARIANTS: Variant[] = [
  { id: 'jee', path: '/jee-study-tracker/', label: 'JEE', exams: ['jee-main', 'jee-advanced'], streams: ['PCM'] },
  { id: 'neet', path: '/neet-study-tracker/', label: 'NEET', exams: ['neet-ug'], streams: ['PCB'] },
  { id: 'bitsat', path: '/bitsat-study-tracker/', label: 'BITSAT', exams: ['bitsat'], streams: ['PCM'] },
  { id: 'comedk', path: '/comedk-study-tracker/', label: 'COMEDK', exams: ['comedk'], streams: ['PCM'] },
  { id: 'mht-cet', path: '/mht-cet-study-tracker/', label: 'MHT CET', exams: ['mht-cet'], streams: ['PCM', 'PCB'] },
  { id: 'kcet', path: '/kcet-study-tracker/', label: 'KCET', exams: ['kcet'], streams: ['PCM', 'PCB'] },
  { id: 'wbjee', path: '/wbjee-study-tracker/', label: 'WBJEE', exams: ['wbjee'], streams: ['PCM'] },
  { id: 'viteee', path: '/viteee-study-tracker/', label: 'VITEEE', exams: ['viteee'], streams: ['PCM'] },
];

export const variantByPath = (path: string): Variant =>
  VARIANTS.find(v => v.path === path || v.path === `${path}/`) ?? ROOT;

/** The two years the page talks about: this season and the next (2027 and 2028 in late 2026). Build time, so it hydrates. */
export const YEARS = (): [number, number] => {
  const [a, b] = yearChoices(new Date(landingNow() + 330 * 60_000));
  return [a, b];
};

/** When an exam is expected in a year, as an instant at 00:00 IST. Computed in UTC so every machine agrees. */
export const examTarget = (id: ExamId, year: number): number => {
  const announced = OFFICIAL[id]?.[year];
  if (announced) return Date.parse(`${announced}T00:00:00+05:30`);
  const { month, day } = examById(id).usual;
  let d = day;
  if (d === 0) { // first Sunday of the month
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    d = 1 + ((7 - first) % 7);
  }
  return Date.UTC(year, month - 1, d) - 330 * 60_000;
};

export const examName = (id: ExamId): string => examById(id).name;
export const examShort = (id: ExamId): string => examById(id).short;

/** The chips under the hero: every exam Alpha knows, each linking to its page. */
export const EXAM_ROW: Array<{ label: string; path: string }> = VARIANTS.map(v => ({ label: v.label, path: v.path }));

/** "Physics, Chemistry and Maths" / "… or Biology". */
const subjectsOf = (streams: Stream[]): string =>
  streams.length > 1 ? 'Physics, Chemistry and either Maths or Biology' : streams[0] === 'PCB' ? 'Physics, Chemistry and Biology' : 'Physics, Chemistry and Maths';

export const ALL_EXAM_NAMES = EXAM_DEFS.map(e => e.name);

/* The app's own subject colours (schedule/colors.ts). */
export const SUBJECT_DOT = {
  Physics: '#4A90E2',
  Chemistry: '#34C77B',
  Maths: '#9B59E2',
  Biology: '#E29B29',
} as const;

/* The three things the page shows, one screen each on a phone. */
export const PILLARS = [
  { id: 'timer', line: 'Every hour, timed.', small: 'Press start. We count.' },
  { id: 'syllabus', line: 'Every chapter, tracked.', small: 'See what’s left.' },
  { id: 'streak', line: 'Every day, counted.', small: 'Don’t break the chain.' },
] as const;

/* What the page shows of everything else: a title and a few words. */
export const TOOLS = [
  { title: 'Pomodoro', small: 'Work, break, repeat.' },
  { title: 'Day planner', small: 'Plan the whole day.' },
  { title: 'Mock tests', small: 'Log scores. See the trend.' },
  { title: 'Error notebook', small: 'Never miss it twice.' },
  { title: 'Flashcards', small: 'Back right before you forget.' },
  { title: 'Notes', small: 'With real maths in them.' },
  { title: 'Study groups', small: 'Your friends, one link.' },
  { title: 'Streak rewards', small: 'Day 365: a real hamper.' },
];

/* The race and the groups. No numbers: none of these may ever be invented. */
export const CROWD = {
  title: 'You’re not studying alone.',
  lines: [
    { big: 'Every day.', small: 'Loads of students log their hours here, every single day.' },
    { big: 'Live race.', small: 'Climb the leaderboard. It resets every morning at 4.' },
    { big: 'Groups.', small: 'Study groups are forming. Bring your friends.' },
  ],
};

export interface Feature {
  id: string;
  title: string;
  body: string;
}

/* For llms.txt and the structured data's featureList. Not shown on the page. */
export const FEATURES: Feature[] = [
  { id: 'timer', title: 'Study timer and Pomodoro', body: 'Pick a subject and press start. Every session is timed to the second and rated 1 to 5 for focus. Pomodoro blocks with your own lengths too.' },
  { id: 'planner', title: 'Daily study planner', body: 'Plan the whole day on one timeline, then see what you planned next to what you did.' },
  { id: 'syllabus', title: 'JEE and NEET syllabus tracker', body: 'Every Class 11 and 12 chapter. Mark each one started, done or due for revision.' },
  { id: 'mocks', title: 'Mock test tracker', body: 'Log every JEE Main, JEE Advanced or NEET mock. See your score trend and the chapters costing you marks.' },
  { id: 'errors', title: 'Error notebook', body: 'Save every question you got wrong and test yourself on it again.' },
  { id: 'flashcards', title: 'Spaced-repetition flashcards', body: 'Make or import decks. Each card comes back just before you would forget it.' },
  { id: 'streaks', title: 'Study streaks and real rewards', body: 'Rewards unlock at 30, 100 and 365 days. The last one is a real hamper, shipped to you.' },
  { id: 'groups', title: 'Study groups and a live leaderboard', body: 'Race friends on a live leaderboard of study hours. You choose what each group sees.' },
  { id: 'stats', title: 'Honest study stats', body: 'Hours by subject, your weekly trend and one Lock-In score.' },
  { id: 'devices', title: 'On every device', body: 'Any browser on Android, iPhone or laptop, or add it to your home screen. Saves on your device first.' },
];

/* The three ways in. The Pass price matches access/cutover.ts (PASS_PRICE_LABEL);
   it is not on sale until payments are wired, and the page says so. */
export interface Way {
  id: 'invite' | 'pass';
  title: string;
  small: string;
}

export const WAYS: Way[] = [
  { id: 'invite', title: 'Get gifted a pass', small: 'A member gifts you an Access Pass, worth ₹2,500.' },
  { id: 'pass', title: 'Buy a pass', small: '₹2,500, once. Opens soon.' },
];

/* The FAQ, told for a page. The first and the exam question change per exam;
   the rest is the same everywhere. Word for word what the FAQPage markup says. */
export const faqFor = (v: Variant): Array<{ q: string; a: string }> => {
  const [y1, y2] = YEARS();
  const examQ = v === ROOT
    ? { q: 'Which exams does it work for?', a: `${ALL_EXAM_NAMES.slice(0, -1).join(', ')} and ${ALL_EXAM_NAMES[ALL_EXAM_NAMES.length - 1]}.` }
    : { q: `Does it work for ${v.label}?`, a: `Yes. Pick ${v.label} and you get ${subjectsOf(v.streams)}, chapter by chapter, and a countdown to ${examName(v.exams[0])}.` };
  return [
    { q: 'What is Tracker Alpha?', a: DEFINITION },
    examQ,
    { q: `Does it work for ${y2}?`, a: `Yes. Pick ${y1} or ${y2} and your countdown follows it.` },
    { q: 'How do I get in?', a: 'With an Access Pass. A member can gift you one, or you can buy one when they open.' },
    { q: 'What is the Access Pass?', a: 'Lifetime access to Alpha, plus one pass to gift a friend. It costs ₹2,500 once. It is not on sale yet.' },
    { q: 'What is a gifted pass?', a: 'Every member can gift one friend an Access Pass, worth ₹2,500. It costs the friend nothing. It works once.' },
    { q: 'Why invite-only?', a: 'So Alpha stays fast. People come in a few at a time.' },
    { q: 'I already use Alpha. Am I in?', a: 'Yes. If you had an account before it went invite-only, you are a founding member. You never pay for what you use today. Just sign in.' },
    { q: 'Does it work on my phone?', a: 'Yes. It runs in any browser, and you can add it to your home screen.' },
  ];
};

/* ── Words that change per exam ── */

export const heroLine = (v: Variant): string => {
  const [y1, y2] = YEARS();
  return v === ROOT
    ? `The study tracker for JEE, NEET, BITSAT and more. ${y1} and ${y2}.`
    : `The ${v.label} study tracker. ${y1} and ${y2}.`;
};

export const pageTitle = (v: Variant): string => {
  const [y1, y2] = YEARS();
  return v === ROOT
    ? `Tracker Alpha: Invite-Only Study Tracker for JEE, NEET & BITSAT ${y1}`
    : `${v.label} Study Tracker for ${y1} & ${y2} | Tracker Alpha`;
};

export const pageDescription = (v: Variant): string => {
  const [y1, y2] = YEARS();
  return v === ROOT
    ? `The invite-only study tracker for JEE, NEET, BITSAT and more, ${y1} and ${y2}. Time every session, track the syllabus, log mocks and race on a live leaderboard.`
    : `The invite-only ${v.label} study tracker for ${y1} and ${y2}. Time every session, track the ${v.label} syllabus, log mocks and race on a live leaderboard.`;
};
