/* ── Spoken clip manifest ──
   The single source of truth for everything the app can say out loud, shared by
   the build-time generator (scripts/generate-voice.ts) and the runtime player
   (voice/clips.ts). Because both read this file, a clip can never drift from
   the message that triggers it.

   Three rules shape it:

   1. Speech confirms an action; the screen reports data. "How many hours today"
      is answered by the pill the user is already looking at, so it is spoken as
      nothing at all. That is what keeps this set small — the alternative was
      generating a clip per hour count, per streak length, per days-remaining.

   2. Whole phrases only. Stitching words together ("logged" + "two" + "hours")
      is audibly seamed, so every phrase is rendered complete.

   3. No value is ever read back. Task names, chapter titles and numbers are
      dropped from the spoken form — "Task completed", not the task's text.
      Reading arbitrary user input aloud is exactly where synthesis sounds worst,
      and it is the only thing that would need a model at runtime.

   Anything not matched here falls back to the browser's own voice, which in
   normal operation should be nothing at all. */

export interface ClipRule {
  /** Matched against the display message. Regex captures feed id and phrase. */
  match: RegExp;
  /** Stable filename stem. Must be URL and filesystem safe. */
  id: (...caps: string[]) => string;
  /** What is actually spoken. */
  phrase: (...caps: string[]) => string;
  /** Every possible value of each capture group, for exhaustive generation. */
  domain?: string[][];
}

const SUBJECTS = ['PHYSICS', 'CHEMISTRY', 'MATHS', 'BIOLOGY', 'GENERAL'];
const TABS = ['TODAY', 'PLAN', 'SYLLABUS', 'STREAK', 'QUESTIONS', 'RANKS', 'REVIEW'];
const PHASES = ['FOCUS', 'SHORT BREAK', 'LONG BREAK'];
const EXAMS = ['JEE', 'NEET'];
const MODES = ['STOPWATCH', 'POMODORO'];
const THEMES = ['DARK', 'LIGHT'];
const STATUSES = ['NOT STARTED', 'IN PROGRESS', 'COMPLETED', 'REVISION'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Spelled out because "JEE" is read as a word otherwise. NEET already is one. */
const sayExam = (exam: string) => (exam === 'JEE' ? 'J E E' : 'NEET');

/** A phrase with no variables. */
const fixed = (message: string, id: string, phrase: string): ClipRule => ({
  match: new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  id: () => id,
  phrase: () => phrase,
});

/** Same, but matched on a prefix because the message carries a value we drop. */
const prefixed = (pattern: RegExp, id: string, phrase: string): ClipRule => ({
  match: pattern,
  id: () => id,
  phrase: () => phrase,
});

export const CLIP_RULES: ClipRule[] = [
  /* ── Session ──
     The subject is the one value worth echoing: hearing "chemistry session
     started" when you said physics is how you catch a misheard command. */
  {
    match: /^SESSION LIVE: ([A-Z]+)\.$/,
    domain: [SUBJECTS],
    id: s => `session-started-${slug(s)}`,
    phrase: s => `${s.toLowerCase()} session started.`,
  },
  {
    match: /^(FOCUS|SHORT BREAK|LONG BREAK) STARTED\.$/,
    domain: [PHASES],
    id: p => `phase-started-${slug(p)}`,
    phrase: p => `${p.toLowerCase()} started.`,
  },
  {
    match: /^(FOCUS|SHORT BREAK|LONG BREAK) RUNNING\.$/,
    domain: [PHASES],
    id: p => `phase-running-${slug(p)}`,
    phrase: p => `${p.toLowerCase()} running.`,
  },
  prefixed(/^LOGGED [\d.]+H [A-Z]+\.$/, 'session-logged', 'session logged.'),
  fixed('SESSION ALREADY RUNNING.', 'session-already-running', 'session already running.'),
  fixed('A BLOCK IS ALREADY RUNNING.', 'block-already-running', 'a block is already running.'),
  fixed('ALREADY RUNNING.', 'already-running', 'already running.'),
  fixed('NOTHING RUNNING.', 'nothing-running', 'nothing running.'),
  fixed('BLOCK ABANDONED. NOTHING LOGGED.', 'block-abandoned', 'block abandoned. nothing logged.'),
  fixed('BLOCK STOPPED. NOTHING LOGGED.', 'block-stopped', 'block stopped. nothing logged.'),
  fixed('SET RESET.', 'set-reset', 'set reset.'),
  fixed('NOT IN POMODORO MODE.', 'not-pomodoro-mode', 'not in pomodoro mode.'),
  fixed('FINISH THE RUNNING SESSION FIRST.', 'finish-session-first', 'finish the running session first.'),
  fixed('THE STOPWATCH DOESN’T PAUSE. SAY “END SESSION”.', 'stopwatch-no-pause', "the stopwatch doesn't pause. say, end session."),
  fixed('SAY “START SESSION” TO BEGIN.', 'say-start-session', 'say, start session, to begin.'),

  // ── Logging ── the count and the hours are on screen.
  prefixed(/^\+\d+ [A-Z]+ QUESTIONS\.$/, 'questions-logged', 'questions logged.'),
  prefixed(/^DAILY TARGET: \d+H\.$/, 'target-updated', 'target updated.'),
  prefixed(/^TARGET STAYS AT \d+H\.$/, 'target-unchanged', 'target unchanged.'),

  // ── Tasks ── never the task's text.
  prefixed(/^TASK ADDED: /, 'task-added', 'task added.'),
  prefixed(/^DONE: /, 'task-done', 'task completed.'),
  prefixed(/^WIPED: /, 'task-wiped', 'task deleted.'),
  prefixed(/^NO (?:OPEN )?TASK MATCHING /, 'no-task', 'no matching task.'),
  fixed("WHAT'S THE TASK?", 'whats-the-task', "what's the task?"),
  fixed('TASK CANCELLED.', 'task-cancelled', 'task cancelled.'),

  // ── Syllabus ── never the chapter title.
  {
    match: /^.+ → (NOT STARTED|IN PROGRESS|COMPLETED|REVISION)\.$/,
    domain: [STATUSES],
    id: s => `chapter-marked-${slug(s)}`,
    phrase: s => `marked as ${s.toLowerCase()}.`,
  },
  prefixed(/^NO CLASS \d+ CHAPTER MATCHING /, 'no-chapter', 'no chapter matched that.'),
  prefixed(/MATCHES MORE THAN ONE CHAPTER/, 'chapter-ambiguous', 'that matches more than one chapter. name the subject.'),

  // ── Navigation and settings ──
  {
    match: /^OPENED ([A-Z]+)\.$/,
    domain: [TABS],
    id: t => `opened-${slug(t)}`,
    phrase: t => `${t.toLowerCase()}.`,
  },
  {
    match: /^(STOPWATCH|POMODORO) MODE\.$/,
    domain: [MODES],
    id: m => `mode-${slug(m)}`,
    phrase: m => `${m.toLowerCase()} mode.`,
  },
  {
    match: /^ALREADY IN (STOPWATCH|POMODORO)\.$/,
    domain: [MODES],
    id: m => `already-mode-${slug(m)}`,
    phrase: m => `already in ${m.toLowerCase()} mode.`,
  },
  {
    match: /^(DARK|LIGHT) MODE\.$/,
    domain: [THEMES],
    id: t => `theme-${slug(t)}`,
    phrase: t => `${t.toLowerCase()} mode.`,
  },
  {
    match: /^ALREADY (DARK|LIGHT)\.$/,
    domain: [THEMES],
    id: t => `already-theme-${slug(t)}`,
    phrase: t => `already ${t.toLowerCase()}.`,
  },

  /* ── Refusals ── the subject and exam stay, because the whole point of the
     message is telling you which one is wrong. */
  {
    match: /^([A-Z]+) ISN'T IN YOUR (JEE|NEET) TRACK\.$/,
    domain: [SUBJECTS, EXAMS],
    id: (s, e) => `not-in-track-${slug(s)}-${slug(e)}`,
    phrase: (s, e) => `${s.toLowerCase()} isn't in your ${sayExam(e)} track.`,
  },
  {
    match: /^([A-Z]+) ISN'T TRACKED FOR QUESTIONS IN (JEE|NEET)\.$/,
    domain: [SUBJECTS, EXAMS],
    id: (s, e) => `not-tracked-questions-${slug(s)}-${slug(e)}`,
    phrase: (s, e) => `${s.toLowerCase()} isn't tracked for questions in ${sayExam(e)}.`,
  },
  fixed('HOW LONG? TRY “LOG 2 HOURS OF PHYSICS”.', 'how-long', 'how long? try, log 2 hours of physics.'),
  fixed('UNKNOWN COMMAND.', 'didnt-catch', "didn't catch that."),
  fixed('UNKNOWN QUESTION.', 'didnt-catch', "didn't catch that."),

  // ── Voice control itself ──
  fixed('MIC OFF.', 'mic-off', 'mic off.'),
  fixed('LISTENING. SAY “HELP” FOR COMMANDS.', 'listening', 'listening. say help for commands.'),
  fixed('SPEAKING REPLIES.', 'speaking-replies', 'speaking replies.'),
];

/* ── Shown, never spoken ──
   Answers to questions. The number is already on screen and reading it aloud
   would mean a clip per possible value, so these are deliberately silent rather
   than falling through to the browser's voice. */
const SILENT_PATTERNS: RegExp[] = [
  /^STREAK: \d+ DAYS?\.$/,
  /^NO STREAK\./,
  /^[\d.]+H TODAY, TARGET \d+H\.$/,
  /^TARGET HIT\./,
  /^[\d.]+H SHORT OF TODAY'S \d+H\.$/,
  /^\d+ QUESTIONS? TODAY\.$/,
  /^LOCK-IN SCORE: \d+\/100\.$/,
  /^\d+ DAYS TO (?:JEE|NEET) \d{4}\.$/,
  // Ambient speech the parser rejected — never worth announcing.
  /^NOT A COMMAND: /,
];

export type ClipResolution =
  | { kind: 'clip'; id: string; phrase: string }
  | { kind: 'silent' }
  | null;

/**
 * Decide how a display message should be spoken.
 *
 * `clip` plays pre-rendered audio, `silent` says nothing on purpose, and null
 * means unrecognised — the caller falls back to the browser's voice.
 */
export const resolveClip = (message: string): ClipResolution => {
  for (const pattern of SILENT_PATTERNS) {
    if (pattern.test(message)) return { kind: 'silent' };
  }
  for (const rule of CLIP_RULES) {
    const m = message.match(rule.match);
    if (!m) continue;
    const caps = m.slice(1);
    return { kind: 'clip', id: rule.id(...caps), phrase: rule.phrase(...caps) };
  }
  return null;
};

export interface Clip {
  id: string;
  phrase: string;
}

/** Every clip the generator should produce, deduplicated by id. */
export const allClips = (): Clip[] => {
  const out = new Map<string, string>();

  for (const rule of CLIP_RULES) {
    const domains = rule.domain ?? [];
    if (!domains.length) {
      out.set(rule.id(), rule.phrase());
      continue;
    }
    // Cartesian product across every capture group's domain.
    let combos: string[][] = [[]];
    for (const values of domains) {
      combos = combos.flatMap(prefix => values.map(v => [...prefix, v]));
    }
    for (const combo of combos) out.set(rule.id(...combo), rule.phrase(...combo));
  }

  return [...out].map(([id, phrase]) => ({ id, phrase }));
};
