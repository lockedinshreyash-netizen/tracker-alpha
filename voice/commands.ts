import { QSubject, Subject, TabType } from '../types';

/* ── Voice grammar ──
   Pure transcript → intent. No React, no state: the rules live in one place and
   can be reasoned about (and later tested) without a microphone.

   Design rule: every command must match the *whole* utterance. The mic runs
   continuously while it's on, so a substring match would let ordinary talk in
   the room ("...then I'll stop the timer later") fire real actions. Anchoring
   means an unrecognised sentence is simply ignored, which is the safe failure. */

export type VoiceIntent =
  | { kind: 'navigate'; tab: TabType }
  | { kind: 'startSession'; subject: Subject | null }
  | { kind: 'endSession' }
  | { kind: 'addTask'; text: string; subject: Subject }
  | { kind: 'logQuestions'; subject: Subject; count: number }
  | { kind: 'setGoal'; hours: number }
  | { kind: 'help' };

/* Speech recognition is loose with subject names; these are the mishearings
   that actually show up rather than an exhaustive phonetic map. */
const SUBJECT_ALIASES: [Subject, string[]][] = [
  ['Physics', ['physics', 'physic', 'fizix', 'physiscs']],
  ['Chemistry', ['chemistry', 'chem', 'chemi', 'chemestry']],
  ['Maths', ['maths', 'math', 'mathematics', 'mats']],
  ['Biology', ['biology', 'bio', 'biolgy']],
  ['General', ['general', 'other', 'misc']],
];

/** The Questions tab tracks its own subject ids, and has no "General". */
export const toQSubject = (subject: Subject): QSubject | null => {
  switch (subject) {
    case 'Physics': return 'physics';
    case 'Chemistry': return 'chemistry';
    case 'Maths': return 'math';
    case 'Biology': return 'biology';
    default: return null;
  }
};

const TAB_ALIASES: [TabType, string[]][] = [
  ['Today', ['today', 'home', 'timer']],
  ['Syllabus', ['syllabus', 'chapters', 'silabus']],
  ['Streak', ['streak', 'streaks', 'stats']],
  ['Questions', ['questions', 'question', 'practice']],
  ['Review', ['review', 'score', 'progress']],
];

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

/** Lowercase, strip punctuation, collapse whitespace. */
const normalize = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * First number in the token stream, digits or words.
 * Handles the one compound case that matters in practice ("twenty five" → 25).
 */
const findNumber = (tokens: string[]): number | null => {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\d+$/.test(token)) return parseInt(token, 10);

    const value = WORD_NUMBERS[token];
    if (value === undefined) continue;
    // "twenty five" style: a tens word directly followed by a units word.
    if (value >= 20 && value % 10 === 0) {
      const next = WORD_NUMBERS[tokens[i + 1]];
      if (next !== undefined && next > 0 && next < 10) return value + next;
    }
    return value;
  }
  return null;
};

/** The first subject named anywhere in the tokens, if any. */
const findSubject = (tokens: string[]): Subject | null => {
  for (const token of tokens) {
    for (const [subject, aliases] of SUBJECT_ALIASES) {
      if (aliases.includes(token)) return subject;
    }
  }
  return null;
};

const findTab = (tokens: string[]): TabType | null => {
  for (const token of tokens) {
    for (const [tab, aliases] of TAB_ALIASES) {
      if (aliases.includes(token)) return tab;
    }
  }
  return null;
};

/* Words allowed to pad a start/stop/navigate command without changing it, so
   "begin the session on physics" and "start physics" both land. Anything
   outside this set makes the utterance a non-command. */
const FILLER = new Set([
  'the', 'a', 'an', 'my', 'me', 'to', 'on', 'in', 'for', 'with', 'now',
  'please', 'session', 'sessions', 'timer', 'study', 'studying', 'studies',
  'focus', 'focusing', 'work', 'working', 'up', 'it', 'lock', 'and', 'let', 's',
  'go', 'open', 'show', 'switch', 'take', 'tab', 'page',
]);

/** True when every leftover token is filler or the already-consumed keyword. */
const onlyFiller = (tokens: string[], consumed: Set<string>): boolean =>
  tokens.every(t => FILLER.has(t) || consumed.has(t));

export const parseCommand = (raw: string): VoiceIntent | null => {
  const text = normalize(raw);
  if (!text) return null;
  const tokens = text.split(' ');

  // ── Help ──
  if (/^(?:help|commands?|voice help|what can i say|show (?:me )?commands?)$/.test(text)) {
    return { kind: 'help' };
  }

  // ── Add task ── free text, so it must be checked before keyword rules.
  const task = text.match(/^(?:add|new|create|make)\s+(?:a\s+|an\s+)?(?:task|todo|to do)\s+(?:that\s+|to\s+)?(.+)$/);
  if (task) {
    let body = task[1].trim();
    // "add task for physics revise waves" — an explicit lead-in gets stripped
    // so it doesn't end up inside the task text.
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
    // Otherwise tag by whatever subject the task itself mentions.
    return { kind: 'addTask', text: body, subject: subject ?? findSubject(body.split(' ')) ?? 'General' };
  }

  // ── Log questions ── e.g. "log 20 physics questions".
  if (/^(?:log|add|record|did|done|solved|solve)\b/.test(text) && /\bquestions?\b/.test(text)) {
    const count = findNumber(tokens);
    const subject = findSubject(tokens);
    if (count !== null && count > 0 && subject) {
      return { kind: 'logQuestions', subject, count };
    }
    return null;
  }

  // ── Daily goal ── e.g. "set my daily target to 10 hours".
  if (/^(?:set|change|make|update)\b/.test(text) && /\b(?:goal|target)\b/.test(text)) {
    const hours = findNumber(tokens);
    if (hours !== null && hours > 0) return { kind: 'setGoal', hours };
    return null;
  }

  // ── End session ── a named subject is accepted but ignored: there is only
  // ever one session running, so "stop physics" can only mean that one.
  const end = text.match(/^(?:end|stop|finish|done with)\s*(.*)$/);
  if (end) {
    const rest = end[1] ? end[1].split(' ') : [];
    const consumed = new Set(rest.filter(t => findSubject([t]) !== null));
    if (onlyFiller(rest, consumed)) return { kind: 'endSession' };
    return null;
  }

  // ── Start session ── optional subject.
  const start = text.match(/^(?:start|begin|resume)\s*(.*)$/);
  if (start) {
    const rest = start[1] ? start[1].split(' ') : [];
    const subject = findSubject(rest);
    const consumed = new Set(subject ? rest.filter(t => findSubject([t]) === subject) : []);
    if (onlyFiller(rest, consumed)) return { kind: 'startSession', subject };
    return null;
  }

  // ── Navigate ── "go to syllabus", "open review", or just "syllabus".
  const tab = findTab(tokens);
  if (tab) {
    const consumed = new Set(tokens.filter(t => findTab([t]) === tab));
    if (onlyFiller(tokens, consumed)) return { kind: 'navigate', tab };
  }

  return null;
};

/* Shown in the command sheet. Kept next to the grammar so the two can't drift. */
export const COMMAND_HELP: { group: string; examples: string[] }[] = [
  { group: 'Session', examples: ['start session', 'start physics', 'end session'] },
  { group: 'Navigate', examples: ['go to syllabus', 'open streak', 'review'] },
  { group: 'Log', examples: ['log 20 physics questions', 'set daily target to 10 hours'] },
  { group: 'Tasks', examples: ['add task revise thermodynamics'] },
];
