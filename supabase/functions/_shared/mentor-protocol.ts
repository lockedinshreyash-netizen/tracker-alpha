/* ── The Mentor protocol ──
   The single source of truth for what passes between the browser and the
   `mentor` edge function, and for the tools the model is offered.

   Imported by BOTH sides: Deno (supabase/functions/mentor) and Vite (mentor/).
   That is only possible because this file imports nothing at all — keep it that
   way. A shared file with an import would need a specifier both runtimes
   resolve identically, and there is no such thing.

   Why the tool list lives here rather than on the server alone: tools execute
   on the device (the device holds the student's data — see CLAUDE.md), but the
   server decides what the model is offered and validates what it asks for. Two
   copies of these schemas would drift, and a drift here means the model is
   promised a tool the client cannot run. */

/** Bump when the wire shape or tool contract changes incompatibly. */
export const MENTOR_PROTOCOL_VERSION = 1;

/* ── Limits ── enforced by the server, mirrored by the client. */
export const MENTOR_LIMITS = {
  /** Model calls per student turn, including tool rounds. */
  maxCallsPerTurn: 4,
  /** Messages of history the client sends (the snapshot is separate). */
  maxHistoryMessages: 16,
  maxMessageChars: 4_000,
  maxToolResultChars: 8_000,
  maxSnapshotChars: 12_000,
  maxBodyBytes: 64_000,
  maxTasksPerProposal: 12,
  maxChangesPerProposal: 20,
  maxChapterItems: 40,
} as const;

/* ── Wire ── OpenAI chat-completions shaped, because every provider we can
   use speaks it. The server adds the system prompt; a client can never send
   one. */
export interface WireToolCall {
  id: string;
  name: string;
  /** JSON text, exactly as the model produced it. */
  arguments: string;
}

export type WireMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: WireToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** What the student asked for. Decides the reasoning effort, nothing else. */
export type MentorIntent = 'chat' | 'plan_day' | 'on_track' | 'roadmap' | 'review_week' | 'replan';

export const MENTOR_INTENTS: MentorIntent[] = ['chat', 'plan_day', 'on_track', 'roadmap', 'review_week', 'replan'];

export interface MentorRequest {
  v: number;
  intent: MentorIntent;
  /** The device's snapshot of the student's data (mentor/brief.ts). Data, not instructions. */
  snapshot: unknown;
  messages: WireMessage[];
}

export type MentorErrorCode =
  | 'not_configured'  // no provider key set — the feature was never deployed
  | 'unauthorized'    // no or bad session
  | 'forbidden'       // not in the closed beta
  | 'bad_request'
  | 'user_limit'      // this student's daily allowance is spent
  | 'global_limit'    // the whole app's daily budget is spent
  | 'busy'            // every provider rate-limited us; retry after `retryAfter`
  | 'unavailable'     // every provider failed
  | 'invalid_output'; // the model's output could not be validated, even after a repair

export type MentorResponse =
  | {
    ok: true;
    content: string;
    tool_calls: WireToolCall[];
    /** Which model answered, for the footer. */
    model: string;
    /** Model calls left today, or null when unknown. */
    remaining: number | null;
  }
  | { ok: false; error: MentorErrorCode; retryAfter?: number; remaining?: number | null };

/* ── A tiny JSON-schema subset ──
   Enough to validate tool arguments on both sides without a dependency:
   object/array/string/number/integer/boolean, enum, required,
   additionalProperties:false, min/max, minItems/maxItems, maxLength, pattern. */
export interface Schema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  pattern?: string;
}

/** Every problem with `value`, as short paths a model can act on. Empty means valid. */
export const validateSchema = (schema: Schema, value: unknown, path = 'args'): string[] => {
  const errs: string[] = [];
  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path} must be an object`];
      const obj = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (obj[key] === undefined || obj[key] === null) errs.push(`${path}.${key} is required`);
      }
      for (const [key, v] of Object.entries(obj)) {
        const sub = schema.properties?.[key];
        if (!sub) {
          if (schema.additionalProperties === false) errs.push(`${path}.${key} is not allowed`);
          continue;
        }
        if (v === undefined || v === null) continue;
        errs.push(...validateSchema(sub, v, `${path}.${key}`));
      }
      return errs;
    }
    case 'array': {
      if (!Array.isArray(value)) return [`${path} must be an array`];
      if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path} needs at least ${schema.minItems} items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path} allows at most ${schema.maxItems} items`);
      if (schema.items) value.forEach((v, i) => errs.push(...validateSchema(schema.items!, v, `${path}[${i}]`)));
      return errs;
    }
    case 'string': {
      if (typeof value !== 'string') return [`${path} must be a string`];
      if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${path} is longer than ${schema.maxLength}`);
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path} has the wrong format`);
      if (schema.enum && !schema.enum.includes(value)) errs.push(`${path} must be one of ${schema.enum.join(', ')}`);
      return errs;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return [`${path} must be a number`];
      if (schema.type === 'integer' && !Number.isInteger(value)) errs.push(`${path} must be a whole number`);
      if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path} must be ≥ ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path} must be ≤ ${schema.maximum}`);
      if (schema.enum && !schema.enum.includes(value)) errs.push(`${path} must be one of ${schema.enum.join(', ')}`);
      return errs;
    }
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path} must be true or false`];
  }
};

/* ── Tools ── */
const DATE = '^\\d{4}-\\d{2}-\\d{2}$';
const date = (description: string): Schema => ({ type: 'string', pattern: DATE, description });
const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'General'];
const STATUSES = ['not_started', 'in_progress', 'completed', 'revision_pending'];
const summary: Schema = {
  type: 'string', maxLength: 600,
  description: 'What you are proposing and why, in 1-3 short sentences. Shown on the review card.',
};
const chapterRef: Schema = {
  type: 'object',
  properties: {
    classId: { type: 'integer', enum: [11, 12] },
    subject: { type: 'string', enum: SUBJECTS },
    chapter: { type: 'string', maxLength: 120, description: 'Exact chapter name from get_syllabus' },
  },
  required: ['classId', 'subject', 'chapter'],
  additionalProperties: false,
};

export type ToolKind = 'read' | 'propose';

export interface ToolDef {
  name: string;
  kind: ToolKind;
  description: string;
  parameters: Schema;
}

/**
 * Read tools run on the device over the student's own data. Propose tools
 * change NOTHING — each produces a card the student reviews and applies
 * themselves. No tool accepts a user id; there is no way to name anyone else.
 */
export const MENTOR_TOOLS: ToolDef[] = [
  {
    name: 'get_syllabus',
    kind: 'read',
    description: 'Chapters with status, weightage tier, whether foundational, and estimated hours left (low/mid/high). Filter to keep results small.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', enum: SUBJECTS },
        classId: { type: 'integer', enum: [11, 12] },
        status: { type: 'string', enum: STATUSES },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_study_stats',
    kind: 'read',
    description: 'Totals for a date range (max 92 days): hours per subject and per day, study days, timed share, average focus quality.',
    parameters: {
      type: 'object',
      properties: { from: date('Start, inclusive'), to: date('End, inclusive') },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_study_log',
    kind: 'read',
    description: 'Individual study sessions in a date range (max 50, newest first). Only use when totals are not enough.',
    parameters: {
      type: 'object',
      properties: {
        from: date('Start, inclusive'),
        to: date('End, inclusive'),
        subject: { type: 'string', enum: SUBJECTS },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_tasks',
    kind: 'read',
    description: 'Task cards with handles (t1, t2...) you can reference in propose_task_changes. Filters: open, overdue, due_between (needs from/to), done_recently (last 7 days).',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['open', 'overdue', 'due_between', 'done_recently'] },
        from: date('For due_between'),
        to: date('For due_between'),
      },
      required: ['filter'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_day',
    kind: 'read',
    description: 'One day: timetable blocks, free minutes, realistic study capacity, tasks due, and (for past days) plan vs actual.',
    parameters: {
      type: 'object',
      properties: { date: date('The study day') },
      required: ['date'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_pace',
    kind: 'read',
    description: 'Deterministic pace check against a target date (default: the syllabus deadline or exam date): remaining hours range, days available, required vs recent hours per day, projected finish range, verdict.',
    parameters: {
      type: 'object',
      properties: { targetDate: date('Optional target') },
      additionalProperties: false,
    },
  },
  {
    name: 'get_roadmap',
    kind: 'read',
    description: 'The active syllabus roadmap: target, this week, next week, and drift against it.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_questions',
    kind: 'read',
    description: 'Practice questions solved per subject in a date range (max 92 days) against weekly goals.',
    parameters: {
      type: 'object',
      properties: { from: date('Start, inclusive'), to: date('End, inclusive') },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'count_days',
    kind: 'read',
    description: 'Exact day arithmetic: calendar days and study days between two dates, excluding given weekdays (0=Sun..6=Sat). Use instead of computing dates yourself.',
    parameters: {
      type: 'object',
      properties: {
        from: date('Start, inclusive'),
        to: date('End, inclusive'),
        excludeWeekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, maxItems: 7 },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_tasks',
    kind: 'propose',
    description: 'Propose new task cards for one day. The student reviews and adds them. Keep total minutes within that day\'s capacity from get_day or the prepared plan. Be specific: chapter + what to do.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        date: date('The day these are for'),
        items: {
          type: 'array', minItems: 1, maxItems: MENTOR_LIMITS.maxTasksPerProposal,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', maxLength: 140 },
              subject: { type: 'string', enum: SUBJECTS },
              chapter: { type: 'string', maxLength: 120 },
              estMins: { type: 'integer', minimum: 10, maximum: 240 },
            },
            required: ['text', 'subject', 'estMins'],
            additionalProperties: false,
          },
        },
        placeOnTimeline: { type: 'boolean', description: 'Also put them on the Plan timeline in free slots' },
      },
      required: ['summary', 'date', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_task_changes',
    kind: 'propose',
    description: 'Propose edits to existing tasks by handle from get_tasks: reschedule (dueAt), edit (text/estMins/subject), complete, or delete.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        changes: {
          type: 'array', minItems: 1, maxItems: MENTOR_LIMITS.maxChangesPerProposal,
          items: {
            type: 'object',
            properties: {
              task: { type: 'string', maxLength: 8, description: 'Handle like t3' },
              action: { type: 'string', enum: ['reschedule', 'edit', 'complete', 'delete'] },
              dueAt: date('New due day, for reschedule'),
              text: { type: 'string', maxLength: 140 },
              estMins: { type: 'integer', minimum: 10, maximum: 240 },
              subject: { type: 'string', enum: SUBJECTS },
            },
            required: ['task', 'action'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'changes'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_roadmap',
    kind: 'propose',
    description: 'Propose (re)building the syllabus roadmap. You choose the parameters; the app computes the weeks. Check get_pace first.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        targetDate: date('Finish the syllabus by'),
        hoursPerDay: { type: 'number', minimum: 0.5, maximum: 12, description: 'Omit to use the student\'s stated or recent hours' },
        restDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, maxItems: 3 },
        exclude: { type: 'array', items: chapterRef, maxItems: 20, description: 'Chapters the student agreed to drop. Never foundational ones.' },
      },
      required: ['summary', 'targetDate'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_chapter_status',
    kind: 'propose',
    description: 'Propose syllabus status updates, e.g. when the student says they finished chapters the app shows as not started.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        items: {
          type: 'array', minItems: 1, maxItems: MENTOR_LIMITS.maxChapterItems,
          items: {
            ...chapterRef,
            properties: { ...chapterRef.properties, status: { type: 'string', enum: STATUSES } },
            required: ['classId', 'subject', 'chapter', 'status'],
          },
        },
      },
      required: ['summary', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_preferences',
    kind: 'propose',
    description: 'Propose saving what the student told you about their time or dates: hours per weekday (Sun..Sat, 7 numbers), rest days, syllabus deadline, exam date.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        weeklyHours: { type: 'array', items: { type: 'number', minimum: 0, maximum: 14 }, minItems: 7, maxItems: 7 },
        restDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, maxItems: 3 },
        syllabusBy: date('Syllabus completion deadline'),
        examDate: date('The student\'s exam date'),
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_replan',
    kind: 'propose',
    description: 'Propose redistributing unfinished and overdue Mentor-planned work across the coming days. The app computes the moves from capacity and deadlines; you explain them.',
    parameters: {
      type: 'object',
      properties: {
        summary,
        horizonDays: { type: 'integer', minimum: 2, maximum: 14, description: 'How many days ahead to spread over (default 7)' },
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
];

export const toolByName = (name: string): ToolDef | undefined => MENTOR_TOOLS.find(t => t.name === name);

/**
 * A tool call checked against its schema. `args` is only present when valid.
 */
export const checkToolCall = (call: WireToolCall): { ok: true; def: ToolDef; args: Record<string, unknown> } | { ok: false; error: string } => {
  const def = toolByName(call.name);
  if (!def) return { ok: false, error: `Unknown tool "${call.name}".` };
  let args: unknown;
  try {
    args = call.arguments?.trim() ? JSON.parse(call.arguments) : {};
  } catch {
    return { ok: false, error: `Arguments for ${call.name} are not valid JSON.` };
  }
  const errors = validateSchema(def.parameters, args);
  return errors.length
    ? { ok: false, error: `Invalid arguments for ${call.name}: ${errors.slice(0, 6).join('; ')}` }
    : { ok: true, def, args: args as Record<string, unknown> };
};
