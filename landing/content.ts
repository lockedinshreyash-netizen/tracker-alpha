/* ── Every word on the landing page ──
   One source for three readers: the page itself, the structured data a search
   engine reads (`seo.ts`), and /llms.txt, which AI assistants read. Writing the
   FAQ once here is what keeps the FAQPage markup word-for-word identical to the
   visible answers — Google ignores structured data that says something the page
   does not.

   Rules for this copy:
   - Short, plain sentences. The reader is sixteen and on a phone.
   - Say the words students type: "study tracker", "JEE 2027", "NEET",
     "syllabus tracker", "Pomodoro timer", "mock test", "study planner".
   - Every claim must be true of the app today. No invented numbers, users or
     reviews. If a feature changes, change it here.
   - Lead each FAQ answer with the answer. AI search quotes first sentences. */

export type Exam = 'JEE' | 'NEET';

export const SITE = {
  name: 'Tracker Alpha',
  url: 'https://trackeralpha.in/',
  logo: 'https://trackeralpha.in/icon-512.png',
  image: 'https://trackeralpha.in/og-image.png',
  instagram: 'https://instagram.com/trackeralpha',
  email: 'lockinhq@gmail.com',
};

/* The one-sentence definition. It opens the page, the structured data and
   llms.txt, so every engine learns the same thing about what this is. */
export const DEFINITION =
  'Tracker Alpha is a free study tracker for JEE and NEET 2027 aspirants. It times every study session, plans your day, tracks the syllabus chapter by chapter, logs mock tests and keeps your streak, all in one app.';

/* Countdown targets, at midnight / the 2 PM start in IST. The exam bodies have
   not announced 2027 dates, so the copy says "expected", and the JEE clock
   counts to the start of January rather than inventing a day. Update these
   when NTA publishes the calendar. */
export const EXAMS: Record<Exam, {
  label: string;
  full: string;
  target: number;
  unit: string;
  note: string;
  thanks: string;
  subjects: Array<'Physics' | 'Chemistry' | 'Maths' | 'Biology'>;
}> = {
  JEE: {
    label: 'JEE',
    full: 'JEE Main 2027',
    target: Date.UTC(2026, 11, 31, 18, 30),
    unit: 'days left in 2026',
    note: 'JEE Main 2027 Session 1 is expected in January.',
    thanks: 'Thank yourself in January.',
    subjects: ['Physics', 'Chemistry', 'Maths'],
  },
  NEET: {
    label: 'NEET',
    full: 'NEET UG 2027',
    target: Date.UTC(2027, 4, 2, 8, 30),
    unit: 'days to NEET UG 2027',
    note: 'NEET UG is usually held on the first Sunday of May.',
    thanks: 'Thank yourself in May.',
    subjects: ['Physics', 'Chemistry', 'Biology'],
  },
};

/* The app's own subject colours (schedule/colors.ts), so the page shows the
   product as it really looks. */
export const SUBJECT_DOT = {
  Physics: '#4A90E2',
  Chemistry: '#34C77B',
  Maths: '#9B59E2',
  Biology: '#E29B29',
} as const;

export const RIBBON = [
  'JEE Main', 'JEE Advanced', 'NEET UG', 'Class 11', 'Class 12', 'Droppers',
  'Physics', 'Chemistry', 'Maths', 'Biology',
];

export interface Feature {
  id: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    id: 'timer',
    title: 'Study timer and Pomodoro',
    body: 'Pick a subject and press start. The stopwatch times every session to the second, and you rate your focus from 1 to 5 when you stop. Prefer fixed blocks? Switch to Pomodoro and set your own work and break lengths.',
  },
  {
    id: 'planner',
    title: 'Daily study planner',
    body: 'Plan your whole day on one timeline: coaching, self-study, meals and sleep. Make blocks repeat every day. At night, see what you planned next to what you really did.',
  },
  {
    id: 'syllabus',
    title: 'JEE and NEET syllabus tracker',
    body: 'Every Class 11 and 12 chapter of Physics, Chemistry, Maths and Biology. Mark each one started, done or due for revision, and always know what is left.',
  },
  {
    id: 'mocks',
    title: 'Mock test tracker',
    body: 'Log every JEE Main, JEE Advanced or NEET mock. See your score trend, the marks you lost, and the chapters that keep costing you.',
  },
  {
    id: 'errors',
    title: 'Error notebook',
    body: 'Save every question you got wrong, and why. Test yourself again with shuffled options. Get it right twice in a row and it is cleared.',
  },
  {
    id: 'flashcards',
    title: 'Spaced-repetition flashcards',
    body: 'Make your own decks or import one. Each card comes back just before you would forget it, so formulas and reactions stick.',
  },
  {
    id: 'streaks',
    title: 'Study streaks and real rewards',
    body: 'Study every day to grow your streak. Rewards unlock at 30, 100 and 365 days. The last one is a real hamper, shipped to you.',
  },
  {
    id: 'groups',
    title: 'Study groups and a live leaderboard',
    body: 'Start a group with friends, share one invite link, and race on a live leaderboard of study hours. You choose what each group can see.',
  },
  {
    id: 'stats',
    title: 'Honest study stats',
    body: 'Hours by subject, your best time of day, your weekly trend and one Lock-In score. You will know exactly where your time went.',
  },
  {
    id: 'devices',
    title: 'On every device you own',
    body: 'Use it in any browser on Android, iPhone or laptop, or add it to your home screen like an app. Your data saves on your device first, so a bad network never loses a session.',
  },
];

export const FACTS = [
  { value: '10', unit: 'tools', label: 'Timer, planner, syllabus, mocks, flashcards and more. One app.' },
  { value: '4', unit: 'AM', label: 'When your study day resets. Late nights still count for today.' },
  { value: '365', unit: 'days', label: 'The streak that earns a real hamper, shipped to your door.' },
  { value: '₹0', unit: '', label: 'What you pay. No trial. No card. No ads.' },
];

export const STEPS = [
  { title: 'Pick JEE or NEET', body: 'Choose your exam and your class. Your subjects and the full syllabus load at once.' },
  { title: 'Press start', body: 'Start the timer on a subject. Every minute you study is logged for you.' },
  { title: 'See where you stand', body: 'Hours, syllabus done, mock scores and your streak, in one place. Fix the weak spot tomorrow.' },
];

export const INCLUDED = [
  'Unlimited study tracking',
  'Study timer and Pomodoro',
  'Daily study planner',
  'Full JEE and NEET syllabus tracker',
  'Mock tests and error notebook',
  'Spaced-repetition flashcards',
  'Study groups and live leaderboard',
  'Streak rewards',
  'Sync across phone and laptop',
];

/* ✓ yes · ✗ no · anything else is printed as written. Generic rivals only:
   statements about a category stay true as products change. */
/* Ours first: on a phone the table scrolls sideways, and the column that
   matters must be the one on screen without scrolling. */
export const COMPARE = {
  columns: ['Tracker Alpha', 'Focus timer apps', 'Paper notebook'],
  rows: [
    { label: 'Times every study session', cells: ['✓', '✓', '✗'] },
    { label: 'Shows your hours by subject', cells: ['✓', 'Some', 'By hand'] },
    { label: 'Knows the JEE and NEET syllabus', cells: ['✓', '✗', '✗'] },
    { label: 'Plans your whole day', cells: ['✓', '✗', 'By hand'] },
    { label: 'Tracks mock tests and mistakes', cells: ['✓', '✗', 'By hand'] },
    { label: 'Spaced-repetition flashcards', cells: ['✓', '✗', '✗'] },
    { label: 'Study groups and leaderboard', cells: ['✓', 'Some', '✗'] },
    { label: 'Price', cells: ['₹0', 'Varies', 'A few rupees'] },
  ],
};

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What is Tracker Alpha?',
    a: DEFINITION,
  },
  {
    q: 'Is Tracker Alpha really free?',
    a: 'Yes. The study tracker is free, with no trial, no card and no ads. Every feature on this page costs ₹0.',
  },
  {
    q: 'What is the best free study tracker for JEE 2027?',
    a: 'A good JEE study tracker should time your sessions, know the JEE syllabus and show your real hours every day. Tracker Alpha does all three for free, and adds a daily planner, mock test tracking, flashcards and study groups.',
  },
  {
    q: 'Does Tracker Alpha work for NEET?',
    a: 'Yes. Choose NEET and you get Physics, Chemistry and Biology, the NEET syllabus chapter by chapter, NEET mock tracking and a countdown to NEET UG 2027.',
  },
  {
    q: 'How many hours should I study for JEE?',
    a: 'There is no magic number. Most serious aspirants aim for 6 to 10 focused hours a day, but steady hours every day beat one huge day. Track your real hours first, then raise them slowly.',
  },
  {
    q: 'Can I use Tracker Alpha on my phone?',
    a: 'Yes. It runs in any browser on Android, iPhone, tablet or laptop, and you can add it to your home screen like an app. Your data saves on your phone first, so a bad network never loses a session.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. You can start tracking without signing up. Make a free account when you want to sync your phone and laptop, join study groups or race on the leaderboard.',
  },
  {
    q: 'How does the study timer work?',
    a: 'Pick a subject and press start. The stopwatch times your session to the second and logs it when you stop, with a 1 to 5 rating for how well you focused. Start from a planned block and the chapter is saved too.',
  },
  {
    q: 'Does it have a Pomodoro timer?',
    a: 'Yes. Switch the timer to Pomodoro and set your own work and break lengths. Every block is logged the moment it ends, even if you switch tabs.',
  },
  {
    q: 'Can I study with friends?',
    a: 'Yes. Create a study group, invite friends with a link, and see a live leaderboard of study hours with a group chat. You choose what each group sees: your hours, your tasks or nothing.',
  },
  {
    q: 'How is it different from YPT or Forest?',
    a: 'Like YPT and Forest, Tracker Alpha has a focus timer. Unlike them, it is built only for JEE and NEET: it knows your syllabus, tracks mock tests and mistakes, and plans your whole day.',
  },
  {
    q: 'Who is Tracker Alpha for?',
    a: 'Class 11 and 12 students and droppers preparing for JEE Main, JEE Advanced or NEET UG in 2027 or 2028.',
  },
];
