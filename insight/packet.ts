import { SleepLog } from '../types';
import { ExperimentState, evidenceGates, formatRange } from './observe';

/* ── The only thing that ever leaves the device ──
   This module is the entire boundary between the student's record and a third
   party. Nothing else in the app builds data destined for an API call, and
   nothing here reads a field it does not need.

   Two rules, and they are the reason this is a separate file rather than a few
   lines inside a component:

   1. **Aggregates only.** Counts, means and ratios. Never a log, never a
      chapter name, never a task, never a note, never a date.
   2. **The packet is the whole prompt.** The model is given this object and
      nothing else about the user — no id, no name, no email. The edge function
      knows who is asking, for quota; Anthropic does not. */

/**
 * Bumped whenever the packet shape or the prompt changes.
 *
 * It is part of the cache key, so raising it invalidates every stored insight
 * at once — which is exactly right, because an insight written against a
 * different prompt is not the insight this version would produce.
 */
export const PROMPT_VERSION = 1;

/**
 * Pre-computed statistics, rounded, with no identifiers in them.
 *
 * Deliberately terse keys: this is machine-read, it is billed by the token, and
 * a fixed small shape is also what makes the cost model hold — see the cost
 * plan's note that calls per month, not tokens per call, is the thing that can
 * run away.
 *
 * Periods are relative labels (`last_30d`) rather than dates. A packet with a
 * calendar range in it could be lined up against anything else about the
 * student; one without cannot be pinned to a person or a moment.
 */
export interface StatsPacket {
  v: number;
  period: 'last_30d';
  /** Calendar days since the experiment began. */
  day: number;
  sessions: number;
  hours: number;
  study_days: number;
  /** Study days as a share of days elapsed, 0–1. */
  consistency: number;
  avg_session_mins: number;
  /** How far the evidence gates have opened, as have/need pairs. */
  gates: { sessions: [number, number]; days: [number, number]; span: [number, number] };
  confidence: 'insufficient' | 'emerging' | 'established';
  /* Present only when the confidence tier allows the claim to be made at all.
     An insufficient finding is not sent and then suppressed by instruction —
     it is never in the packet, so there is nothing for the model to overclaim
     from. The prompt's prohibition is belt and braces. */
  best?: { window: string; quality: number; sessions: number; days: number };
  rest_quality?: number;
  worst?: { window: string; quality: number };
  sleep?: { nights: number; avg_hours: number };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The packet, from the experiment state that is already on screen.
 *
 * Pure, and takes the narrowest input that answers the question — the same
 * contract every other module in `insight/` keeps.
 */
export const buildPacket = (exp: ExperimentState, sleepLogs: SleepLog[]): StatsPacket => {
  const gates = evidenceGates(exp);
  const [sessionsGate, daysGate, spanGate] = gates;

  const packet: StatsPacket = {
    v: PROMPT_VERSION,
    period: 'last_30d',
    day: exp.dayNumber,
    sessions: exp.sessions,
    hours: round1(exp.hours),
    study_days: exp.studyDays,
    consistency: exp.dayNumber > 0 ? round1(exp.studyDays / exp.dayNumber) : 0,
    avg_session_mins: exp.sessions > 0 ? Math.round((exp.hours * 60) / exp.sessions) : 0,
    gates: {
      sessions: [sessionsGate.have, sessionsGate.need],
      days: [daysGate.have, daysGate.need],
      span: [spanGate.have, spanGate.need],
    },
    confidence: exp.windows.confidence,
  };

  const { best, worst, restQuality, confidence } = exp.windows;

  /* Only what the gates have actually earned. `emerging` gets the window it is
     watching but no comparison to name it against; `established` gets the full
     three-way picture. */
  if (best && best.quality !== null && confidence !== 'insufficient') {
    packet.best = {
      window: formatRange(best.start, best.end),
      quality: round1(best.quality),
      sessions: best.sessions,
      days: best.days,
    };
  }

  if (confidence === 'established') {
    if (typeof restQuality === 'number') packet.rest_quality = round1(restQuality);
    if (worst && worst.quality !== null) {
      packet.worst = { window: formatRange(worst.start, worst.end), quality: round1(worst.quality) };
    }
  }

  /* Sleep is sent only as a count and a mean, and only once there are enough
     nights for a mean to mean anything. Never a bedtime, never a wake time,
     never a night. */
  const nights = exp.startedOn ? sleepLogs.filter(s => s.date >= (exp.startedOn as string)) : [];
  if (nights.length >= 7) {
    const avg = nights.reduce((a, n) => a + (n.wakeAt - n.bedAt), 0) / nights.length / 3_600_000;
    packet.sleep = { nights: nights.length, avg_hours: round1(avg) };
  }

  return packet;
};

/**
 * A stable string for a packet, so the same statistics always hash the same.
 *
 * `JSON.stringify` preserves insertion order, and `buildPacket` assembles keys
 * conditionally — so two identical weeks could serialise differently and pay
 * twice. Sorting the keys is what makes the cache actually hit.
 */
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
};

/**
 * The cache key: the statistics plus the prompt version.
 *
 * A week that has not changed never regenerates, on any device — the same
 * numbers produce the same hash, so a review generated on the laptop is free on
 * the phone. And because the prompt version is inside the hash, editing the
 * prompt invalidates every cached insight and nothing else does.
 */
export const packetHash = async (packet: StatsPacket): Promise<string> => {
  const data = new TextEncoder().encode(`${PROMPT_VERSION}:${canonical(packet)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Whether there is enough here to be worth asking about.
 *
 * A model handed three sessions writes three sentences of encouragement, which
 * is not what this feature is for and is not worth a request. The button does
 * not appear below this line — and the line is the same one the deterministic
 * layer uses to decide it can say anything at all.
 */
export const worthExplaining = (exp: ExperimentState): boolean =>
  exp.sessions >= 8 && exp.studyDays >= 3;
