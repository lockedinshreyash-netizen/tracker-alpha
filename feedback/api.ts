/* ── Feedback, ideas and moderation reports ──
   Talks to `feedback_tickets` (see supabase/admin.sql §5).

   Three properties the policies give us, which everything below assumes:

     1. A ticket can only be filed under the id in the caller's own JWT. There
        is no request that files one as somebody else.
     2. A ticket can only be READ by its author or by an administrator. This is
        what makes "report abuse" honest — the person being reported cannot go
        looking for the report.
     3. Status and the reply are writable by administrators only, and a new
        ticket must arrive `open` with no reply on it. A user cannot file one
        pre-resolved so that nobody ever reads it, and cannot fabricate an
        answer from support.

   Nothing here ever shows the student a database error. Postgres' own words —
   constraint names, relation names, policy failures — are at best unhelpful and
   at worst tell somebody exactly which wall they just hit. `humanError` is the
   only thing that reaches a user-facing surface. */

import { supabase } from '../supabaseClient';

export type Category = 'bug' | 'idea' | 'abuse' | 'general';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface CategoryDef {
  id: Category;
  label: string;
  blurb: string;
  /** Placeholder for the message box. Sets the expectation of what's useful. */
  hint: string;
  /** Only abuse asks who. Nothing else has a person in it. */
  asksWho: boolean;
}

/* Four, in the order somebody scanning them would want them: the two that are
   about the app, then the one that is about a person, then everything else.
   Copy is plain rather than uppercase — this is the one surface in the product
   where the user is being asked to talk, and shouting at them first is the
   wrong way round. */
export const CATEGORIES: CategoryDef[] = [
  {
    id: 'bug',
    label: 'Report a problem',
    blurb: "Something isn't working correctly.",
    hint: 'What did you do, and what happened instead?',
    asksWho: false,
  },
  {
    id: 'idea',
    label: 'Suggest an idea',
    blurb: "Tell us what you'd like to see.",
    hint: "What would you add, and what would it let you do?",
    asksWho: false,
  },
  {
    id: 'abuse',
    label: 'Report abuse',
    blurb: 'Cheating, leaderboard manipulation, or behaviour that needs looking at.',
    hint: 'What happened, and where did you see it?',
    asksWho: true,
  },
  {
    id: 'general',
    label: 'General feedback',
    blurb: 'Anything else you want to tell us.',
    hint: 'Say whatever you came here to say.',
    asksWho: false,
  },
];

export const categoryLabel = (id: Category): string =>
  CATEGORIES.find(c => c.id === id)?.label ?? id;

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export interface Ticket {
  id: string;
  category: Category;
  subject: string;
  message: string;
  status: TicketStatus;
  admin_response: string | null;
  created_at: string;
}

/** A ticket as the inbox sees it: the same row, plus who sent it. */
export interface AdminTicket extends Ticket {
  user_id: string;
  email: string | null;
  route: string | null;
  user_agent: string | null;
  reported_name: string | null;
  responded_at: string | null;
}

/* Mirrors the CHECK constraints, so bad input is caught in the form rather than
   coming back as a 400 the user cannot interpret. */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;

export interface Draft {
  category: Category;
  subject: string;
  message: string;
  /** Only ever set for an abuse report, and only if they chose to name anyone. */
  reportedName?: string;
  /** Which tab they were on. The app knows; they should not have to type it. */
  route: string;
}

/** The first thing that is wrong with a draft, or null if nothing is. */
export const validate = (draft: Draft): string | null => {
  if (draft.subject.trim().length < SUBJECT_MIN) return 'Add a short subject.';
  if (draft.subject.trim().length > SUBJECT_MAX) return 'That subject is too long.';
  if (draft.message.trim().length < MESSAGE_MIN) return 'Tell us a little more.';
  if (draft.message.trim().length > MESSAGE_MAX) return 'That message is too long to send.';
  return null;
};

/**
 * Whatever went wrong, said in words a seventeen-year-old can act on.
 *
 * The three that actually happen are: not signed in, the migration has not been
 * run, and the network is down. Everything else collapses into one honest line
 * rather than a code nobody can look up.
 */
export const humanError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';

  if (code === '42501' || /row-level security|not authorized/i.test(message)) {
    return "You don't have permission to do that.";
  }
  /* PGRST205 is a missing table and PGRST202 a missing function — both mean
     supabase/admin.sql has not been run on this project. Verified against a
     live project rather than guessed; PostgREST's wording is "Could not find
     …in the schema cache", which no "does not exist" test would have caught. */
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205'
    || /does not exist|could not find the (table|function)/i.test(message)) {
    return 'This is not set up yet. Try again later.';
  }
  if (code === '23514' || /violates check constraint/i.test(message)) {
    return "That doesn't look right — check the length of what you wrote.";
  }
  if (code === '23505') return 'You have already sent that.';
  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'No connection. Check your network and try again.';
  }
  return 'Something went wrong. Try again in a moment.';
};

/**
 * File a ticket.
 *
 * `user_id` is passed explicitly and also pinned by the insert policy's WITH
 * CHECK — the second one is the one that matters, the first is just what makes
 * the request valid.
 *
 * The user agent is trimmed hard. It is genuinely useful on a bug report
 * ("only on iOS Safari") and genuinely uninteresting past a hundred characters.
 */
export const submit = async (userId: string, draft: Draft): Promise<void> => {
  const reported = draft.reportedName?.trim();

  const { error } = await supabase.from('feedback_tickets').insert({
    user_id: userId,
    category: draft.category,
    subject: draft.subject.trim(),
    message: draft.message.trim(),
    route: draft.route.slice(0, 120),
    user_agent: (navigator.userAgent || '').slice(0, 400),
    reported_name: draft.category === 'abuse' && reported ? reported.slice(0, 60) : null,
  });

  if (error) throw error;
};

/** The signed-in user's own tickets, newest first. Their own, only. */
export const listMine = async (userId: string): Promise<Ticket[]> => {
  const { data, error } = await supabase
    .from('feedback_tickets')
    .select('id,category,subject,message,status,admin_response,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as Ticket[];
};


/* ══════════════════════════════════════════════════════════════════════════
   The inbox
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Every ticket, triaged. Open first, then in progress, then resolved.
 *
 * An RPC rather than a select, for one reason: the submitter's email lives in
 * `auth.users`, which no client may read. The function checks `is_admin()` as
 * its first statement and raises otherwise, so it is not a way around the
 * policy — it is the policy, plus one joined column.
 */
export const listAllTickets = async (status: TicketStatus | null): Promise<AdminTicket[]> => {
  const { data, error } = await supabase.rpc('admin_list_feedback', {
    p_status: status,
    p_limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as AdminTicket[];
};

/** Move a ticket along. Admin-only at the database. */
export const setStatus = async (id: string, status: TicketStatus): Promise<void> => {
  const { error } = await supabase
    .from('feedback_tickets')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Write a reply, and resolve in the same stroke.
 *
 * Deliberately not a thread. The submitter reads this under their own ticket in
 * the widget and cannot answer it — a second message from them is a second
 * ticket. That keeps the whole feature one table, one direction, and no
 * unread-state problem; a real conversation belongs in email, and the inbox
 * shows the address.
 */
export const respond = async (
  id: string,
  adminId: string,
  response: string,
  status: TicketStatus,
): Promise<void> => {
  const { error } = await supabase
    .from('feedback_tickets')
    .update({
      admin_response: response.trim() || null,
      responded_at: response.trim() ? new Date().toISOString() : null,
      responded_by: response.trim() ? adminId : null,
      status,
    })
    .eq('id', id);
  if (error) throw error;
};
