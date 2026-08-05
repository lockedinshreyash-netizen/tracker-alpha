import { QSubject, Subject, SyllabusStatus, TabType, TimerMode } from '../types';

/* ── Voice grammar ──
   Pure transcript → intent. No React, no app state: the rules live in one place
   and can be reasoned about (and tested) without a microphone.

   Two rules hold this together:

   1. Every command matches the *whole* utterance. The mic runs continuously, so
      a substring match would let ordinary talk in the room ("...then I'll stop
      the timer later") fire real actions. An unrecognised sentence is ignored,
      which is the safe failure.

   2. Recognition of Indian-accented English is good but not exact, so subject
      and tab names are matched fuzzily against a list of real mishearings.
      Command *verbs* stay exact — fuzzing those is how "part" becomes "start". */

export type QueryTopic =
  | 'streak'
  | 'hoursToday'
  | 'goal'
  | 'questionsToday'
  | 'score'
  | 'daysLeft';

export type VoiceIntent =
  | { kind: 'navigate'; tab: TabType }
  | { kind: 'startSession'; subject: Subject | null }
  | { kind: 'endSession' }
  | { kind: 'pauseTimer' }
  | { kind: 'resumeTimer' }
  | { kind: 'resetPomodoro' }
  | { kind: 'setTimerMode'; mode: TimerMode }
  | { kind: 'addTask'; text: string; subject: Subject }
  | { kind: 'askTaskBody' }
  | { kind: 'completeTask'; query: string }
  | { kind: 'deleteTask'; query: string }
  | { kind: 'logQuestions'; subject: Subject; count: number }
  | { kind: 'logHours'; subject: Subject | null; hours: number }
  | { kind: 'setGoal'; hours: number }
  | { kind: 'adjustGoal'; delta: number }
  | { kind: 'setTheme'; theme: 'dark' | 'light' }
  | { kind: 'setChapterStatus'; chapter: string; status: SyllabusStatus }
  | { kind: 'query'; topic: QueryTopic }
  | { kind: 'stopListening' }
  | { kind: 'setSpeech'; on: boolean }
  | { kind: 'help' };

/* ── Fuzzy matching ────────────────────────────────────────────────────── */

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
};

/* Short words get no slack — at three letters, one edit reaches half the
   dictionary. Longer words earn proportionally more. */
const allowedEdits = (word: string): number => {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
};

const matchesAlias = (token: string, aliases: string[]): boolean =>
  aliases.some(alias =>
    alias === token || levenshtein(token, alias) <= Math.min(allowedEdits(alias), allowedEdits(token))
  );

/* ── Vocabulary ────────────────────────────────────────────────────────── */

/* Real mishearings, not an exhaustive phonetic map. Anything the fuzzy matcher
   already reaches within its edit budget is left out. */
const SUBJECT_ALIASES: [Subject, string[]][] = [
  ['Physics', ['physics', 'physic', 'phy', 'fizix', 'physik', 'physicks']],
  ['Chemistry', ['chemistry', 'chem', 'chemi', 'kemistry', 'chemestry']],
  ['Maths', ['maths', 'math', 'mathematics', 'maath', 'mats']],
  ['Biology', ['biology', 'bio', 'bilogy', 'byology']],
  ['General', ['general', 'other', 'misc', 'revision']],
];

const TAB_ALIASES: [TabType, string[]][] = [
  ['Today', ['today', 'home', 'timer', 'dashboard']],
  ['Syllabus', ['syllabus', 'silabus', 'syllabi', 'chapters', 'chapter']],
  // "strike" is what en-IN most often hears for "streak".
  ['Streak', ['streak', 'streaks', 'strike', 'strick']],
  ['Questions', ['questions', 'question', 'practice', 'pyq', 'pyqs']],
  ['Review', ['review', 'reviews', 'score', 'progress', 'stats']],
];

const STATUS_ALIASES: [SyllabusStatus, string[]][] = [
  ['completed', ['done', 'complete', 'completed', 'finished', 'finish']],
  ['in_progress', ['started', 'starting', 'ongoing', 'progress']],
  ['revision_pending', ['revision', 'revise', 'revising', 'rivision']],
  ['not_started', ['untouched', 'unstarted', 'pending', 'nothing']],
];

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/* Words allowed to pad a command without changing its meaning, so "begin the
   session on physics" and "start physics" both land. Anything outside this set
   makes the utterance a non-command. */
const FILLER = new Set([
  'the', 'a', 'an', 'my', 'me', 'to', 'on', 'in', 'for', 'with', 'now',
  'please', 'session', 'sessions', 'timer', 'study', 'studying', 'studies',
  'focus', 'focusing', 'work', 'working', 'up', 'it', 'and', 'let', 's',
  'go', 'open', 'show', 'switch', 'take', 'tab', 'page', 'of', 'block',
]);

/* ── Helpers ───────────────────────────────────────────────────────────── */

const normalize = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const toQSubject = (subject: Subject): QSubject | null => {
  switch (subject) {
    case 'Physics': return 'physics';
    case 'Chemistry': return 'chemistry';
    case 'Maths': return 'math';
    case 'Biology': return 'biology';
    default: return null;
  }
};

const resolve = <T,>(token: string, table: [T, string[]][]): T | null => {
  for (const [value, aliases] of table) {
    if (matchesAlias(token, aliases)) return value;
  }
  return null;
};

const findSubject = (tokens: string[]): Subject | null => {
  for (const token of tokens) {
    const hit = resolve(token, SUBJECT_ALIASES);
    if (hit) return hit;
  }
  return null;
};

const findTab = (tokens: string[]): TabType | null => {
  for (const token of tokens) {
    const hit = resolve(token, TAB_ALIASES);
    if (hit) return hit;
  }
  return null;
};

const findStatus = (tokens: string[]): SyllabusStatus | null => {
  for (const token of tokens) {
    const hit = resolve(token, STATUS_ALIASES);
    if (hit) return hit;
  }
  return null;
};

/**
 * First quantity in the token stream: digits, number words, or the compounds
 * people actually say — "twenty five" (25), "one fifty" (150), "a hundred".
 */
const findNumber = (tokens: string[]): number | null => {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (/^\d+$/.test(token)) {
      const value = parseInt(token, 10);
      // "one fifty" arrives as ["1","50"] about as often as ["one","fifty"].
      const next = tokens[i + 1];
      if (value < 10 && next && /^\d0$/.test(next)) return value * 100 + parseInt(next, 10);
      return value;
    }

    if (token === 'half') return 0.5;

    const value = WORD_NUMBERS[token];
    if (value === undefined) continue;

    const nextWord = tokens[i + 1];
    const next = nextWord === undefined ? undefined : WORD_NUMBERS[nextWord];

    // "one hundred", "two hundred fifty"
    if (nextWord === 'hundred') {
      const after = WORD_NUMBERS[tokens[i + 2]];
      return value * 100 + (after !== undefined ? after : 0);
    }
    // "twenty five"
    if (value >= 20 && value % 10 === 0 && next !== undefined && next > 0 && next < 10) {
      return value + next;
    }
    // "one fifty" meaning 150
    if (value < 10 && next !== undefined && next >= 20 && next % 10 === 0) {
      return value * 100 + next;
    }
    return value;
  }

  // "a hundred" / "hundred"
  if (tokens.includes('hundred')) return 100;
  return null;
};

/** Hours from a spoken duration: "2 hours", "45 minutes", "an hour and a half". */
const findDuration = (tokens: string[]): number | null => {
  const text = tokens.join(' ');
  const hasHours = /\b(hours?|hrs?|hr)\b/.test(text);
  const hasMinutes = /\b(minutes?|mins?|min)\b/.test(text);
  if (!hasHours && !hasMinutes) return null;

  /* Strip the trailing "and a half" before looking for the base number,
     otherwise "an hour and a half" finds the 0.5 and reports one hour. */
  const andAHalf = /\band a half\b/.test(text);
  const base = text.replace(/\band a half\b/g, ' ').replace(/\s+/g, ' ').trim();

  let value = findNumber(base.split(' '));
  // "an hour", "half an hour" — no explicit numeral.
  if (value === null) value = /\bhalf\b/.test(base) ? 0.5 : 1;
  if (andAHalf) value += 0.5;

  if (hasHours) return value;
  return value / 60;
};

/** True when every leftover token is filler or an already-consumed keyword. */
const onlyFiller = (tokens: string[], consumed: Set<string>): boolean =>
  tokens.every(t => FILLER.has(t) || consumed.has(t));

const consumedBy = <T,>(tokens: string[], table: [T, string[]][], value: T): Set<string> =>
  new Set(tokens.filter(t => resolve(t, table) === value));

/* ── Parser ────────────────────────────────────────────────────────────── */

export const parseCommand = (raw: string): VoiceIntent | null => {
  const text = normalize(raw);
  if (!text) return null;
  const tokens = text.split(' ');

  // ── Help ──
  if (/^(?:help|commands?|voice help|what can i say|show (?:me )?commands?)$/.test(text)) {
    return { kind: 'help' };
  }

  // ── Mic off ── must precede endSession, which also starts with "stop".
  if (/^(?:stop listening|mic off|turn off (?:the )?mic(?:rophone)?|mute|stop the mic)$/.test(text)) {
    return { kind: 'stopListening' };
  }

  /* ── Spoken replies ── separate from the mic: "mute" closes the microphone,
     "be quiet" only stops the app talking back. */
  if (/^(?:stop talking|be quiet|quiet|stop speaking|don t (?:talk|speak)|shut up)$/.test(text)) {
    return { kind: 'setSpeech', on: false };
  }
  if (/^(?:start talking|speak to me|talk to me|speak up|say it out loud)$/.test(text)) {
    return { kind: 'setSpeech', on: true };
  }

  /* ── Questions the app can answer ──
     Anchored end to end like every other command. A loose "contains streak"
     test would fire on "my streak is gone because I skipped". Note that
     normalize() has already turned "what's" into "what s". */
  const ASK = '(?:what s|whats|what is|how s|hows|how is|tell me|show me)';

  if (new RegExp(`^(?:${ASK} )?(?:my )?streak$`).test(text)) {
    return { kind: 'query', topic: 'streak' };
  }
  if (new RegExp(`^(?:${ASK} )?(?:my )?(?:lock in )?score$`).test(text)) {
    return { kind: 'query', topic: 'score' };
  }
  if (/^(?:(?:how many|how much) )?hours?(?: have i| did i)?(?: studied| done| logged)?(?: today)?$/.test(text)
    && /\b(?:how many|how much|today)\b/.test(text)) {
    return { kind: 'query', topic: 'hoursToday' };
  }
  if (/^(?:how many )?questions?(?: have i| did i)?(?: done| solved)?(?: today)?$/.test(text)
    && /\b(?:how many|today)\b/.test(text)) {
    return { kind: 'query', topic: 'questionsToday' };
  }
  if (/^(?:how many )?days (?:are )?(?:left|remaining|to go)$/.test(text)) {
    return { kind: 'query', topic: 'daysLeft' };
  }
  if (/^(?:how am i doing|(?:how s|hows|how is) my (?:goal|progress|day)|am i on track)$/.test(text)) {
    return { kind: 'query', topic: 'goal' };
  }

  // ── Theme ──
  const theme = text.match(/^(?:switch to |turn on |enable |use )?(dark|light|night|day)(?: mode| theme)?$/);
  if (theme) {
    return { kind: 'setTheme', theme: theme[1] === 'dark' || theme[1] === 'night' ? 'dark' : 'light' };
  }

  // ── Timer mode ──
  const mode = text.match(/^(?:switch to |change to |use |turn on )?(pomodoro|stopwatch|stop watch)(?: mode| timer)?$/);
  if (mode) {
    return { kind: 'setTimerMode', mode: mode[1] === 'pomodoro' ? 'pomodoro' : 'stopwatch' };
  }

  // ── Pomodoro transport ──
  if (/^pause(?: (?:the |my )?(?:timer|session|block|pomodoro))?$/.test(text)) return { kind: 'pauseTimer' };
  if (/^(?:resume|continue|unpause)(?: (?:the |my )?(?:timer|session|block|pomodoro))?$/.test(text)) {
    return { kind: 'resumeTimer' };
  }
  if (/^reset(?: (?:the |my )?(?:set|pomodoro|blocks?|counter))?$/.test(text)) return { kind: 'resetPomodoro' };

  // ── Tasks ── free text, so these run before the keyword rules.
  if (/^(?:add|new|create|make)(?: an?)? (?:task|todo|to do)$/.test(text)) {
    return { kind: 'askTaskBody' };
  }

  const task = text.match(/^(?:add|new|create|make)\s+(?:an?\s+)?(?:task|todo|to do)\s+(?:that\s+|to\s+)?(.+)$/);
  if (task) {
    let body = task[1].trim();
    // "add task for physics revise waves" — an explicit lead-in is stripped so
    // it doesn't end up inside the task text.
    const lead = body.match(/^for\s+(\w+)\s+(.+)$/);
    let subject: Subject | null = null;
    if (lead) {
      const named = findSubject([lead[1]]);
      if (named) {
        subject = named;
        body = lead[2].trim();
      }
    }
    if (!body) return null;
    return { kind: 'addTask', text: body, subject: subject ?? findSubject(body.split(' ')) ?? 'General' };
  }

  const doneTask = text.match(/^(?:complete|finish|tick off|check off|mark done)\s+(?:the\s+)?(?:task\s+)?(.+)$/);
  if (doneTask && doneTask[1].trim()) return { kind: 'completeTask', query: doneTask[1].trim() };

  const dropTask = text.match(/^(?:delete|remove|drop)\s+(?:the\s+)?task\s+(.+)$/);
  if (dropTask && dropTask[1].trim()) return { kind: 'deleteTask', query: dropTask[1].trim() };

  // ── Questions practised ── "log 20 physics questions".
  if (/^(?:log|add|record|did|done|solved|solve|attempted)\b/.test(text) && /\bquestions?\b/.test(text)) {
    const count = findNumber(tokens);
    const subject = findSubject(tokens);
    if (count !== null && count > 0 && subject) return { kind: 'logQuestions', subject, count };
    return null;
  }

  // ── Study time, entered by hand ── "log 2 hours of physics".
  if (/^(?:log|add|record|put)\b/.test(text)) {
    const hours = findDuration(tokens);
    if (hours !== null && hours > 0) {
      return { kind: 'logHours', subject: findSubject(tokens), hours };
    }
  }

  // ── Daily goal ──
  if (/\b(?:goal|target)\b/.test(text)) {
    if (/^(?:set|change|make|update)\b/.test(text)) {
      const hours = findNumber(tokens);
      if (hours !== null && hours > 0) return { kind: 'setGoal', hours };
      return null;
    }
    const bump = text.match(/^(increase|raise|decrease|lower|reduce)\b/);
    if (bump) {
      const by = findNumber(tokens) ?? 1;
      const sign = /^(?:increase|raise)$/.test(bump[1]) ? 1 : -1;
      return { kind: 'adjustGoal', delta: sign * by };
    }
  }

  // ── Syllabus ── "mark rotational motion as done".
  const chapter = text.match(/^mark\s+(?:chapter\s+)?(.+?)\s+(?:as\s+)?(\w+)$/);
  if (chapter) {
    const status = findStatus([chapter[2]]);
    const name = chapter[1].trim();
    if (status && name) return { kind: 'setChapterStatus', chapter: name, status };
  }

  // ── End session ── a named subject is accepted but ignored: only one session
  // can be running, so "stop physics" can only mean that one.
  const end = text.match(/^(?:end|stop|finish|done with|wrap up)\s*(.*)$/);
  if (end) {
    const rest = end[1] ? end[1].split(' ') : [];
    const consumed = new Set(rest.filter(t => findSubject([t]) !== null));
    if (onlyFiller(rest, consumed)) return { kind: 'endSession' };
    return null;
  }

  // ── Start session ── optional subject.
  const start = text.match(/^(?:start|begin|kick off)\s*(.*)$/);
  if (start) {
    const rest = start[1] ? start[1].split(' ') : [];
    const subject = findSubject(rest);
    const consumed = subject ? consumedBy(rest, SUBJECT_ALIASES, subject) : new Set<string>();
    if (onlyFiller(rest, consumed)) return { kind: 'startSession', subject };
    return null;
  }

  // ── Navigate ── "go to syllabus", "open review", or just "syllabus".
  const tab = findTab(tokens);
  if (tab) {
    const consumed = consumedBy(tokens, TAB_ALIASES, tab);
    if (onlyFiller(tokens, consumed)) return { kind: 'navigate', tab };
  }

  return null;
};

/**
 * Recognition returns several guesses per utterance. Accented speech often puts
 * the right words in a lower-ranked one, so every alternative gets a try and
 * the first that parses wins.
 */
export const parseBestOf = (candidates: string[]): { intent: VoiceIntent; heard: string } | null => {
  for (const candidate of candidates) {
    const intent = parseCommand(candidate);
    if (intent) return { intent, heard: candidate };
  }
  return null;
};

/** A free-text utterance being captured as a task body, not parsed as a command. */
export const asTaskBody = (raw: string): string => normalize(raw);

/* Shown in the command sheet. Kept next to the grammar so the two can't drift. */
export const COMMAND_HELP: { group: string; examples: string[] }[] = [
  { group: 'Session', examples: ['start physics', 'end session', 'pause', 'resume'] },
  { group: 'Navigate', examples: ['go to syllabus', 'open streak', 'review'] },
  { group: 'Log', examples: ['log 20 physics questions', 'log 2 hours of maths', 'set daily target to 10 hours'] },
  { group: 'Tasks', examples: ['add task revise thermodynamics', 'complete task revise thermodynamics'] },
  { group: 'Syllabus', examples: ['mark rotational motion as done', 'mark integrals as revision'] },
  { group: 'Ask', examples: ["what's my streak", 'how many hours today', 'how many days left'] },
  { group: 'Other', examples: ['pomodoro', 'dark mode', 'be quiet', 'stop listening'] },
];
