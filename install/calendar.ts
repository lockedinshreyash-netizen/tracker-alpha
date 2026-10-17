/* ── A daily study block in the student's own calendar ──
   The one fallback that works on every device, with no install, no permission
   prompt and no account: the calendar app the phone already has will ring at
   the same time every day and carry a link straight back to Alpha.

   Two forms, because there are two calendar worlds:
     Google   a template link that opens a prefilled, repeating event.
     Apple /  an .ics file. iOS hands it to Calendar, macOS too, and Outlook
     Outlook  imports it.

   The time is the study-day axis (`DayMinute`, 0 = 04:00 IST) like every
   other time in the app, and the event is pinned to Asia/Kolkata so a laptop
   set to another zone still rings at the student's hour. Pure apart from the
   download helper at the bottom. */

import type { DayMinute } from '../types';

export const APP_URL = 'https://trackeralpha.in/?open=today';
export const DEFAULT_STUDY_MINUTE: DayMinute = 840; // 18:00
const BLOCK_MINUTES = 60;

/** Study-day minute → wall-clock hours and minutes in IST. */
const wall = (m: DayMinute): { h: number; min: number } => {
  const t = (((m + 240) % 1440) + 1440) % 1440;
  return { h: Math.floor(t / 60), min: t % 60 };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The first occurrence: today's IST date, as YYYYMMDD. */
const ymd = (isoDate: string) => isoDate.replace(/-/g, '');

const stamp = (isoDate: string, m: DayMinute): string => {
  const { h, min } = wall(m);
  /* A study-day minute past midnight belongs to the next calendar date. */
  const date = m >= 1200 ? nextDate(isoDate) : isoDate;
  return `${ymd(date)}T${pad(h)}${pad(min)}00`;
};

const nextDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export interface CalendarEvent {
  title: string;
  details: string;
  /** First day, YYYY-MM-DD (IST). */
  from: string;
  minute: DayMinute;
}

export const studyEvent = (goalHours: number, from: string, minute: DayMinute = DEFAULT_STUDY_MINUTE): CalendarEvent => ({
  title: 'LOCK IN · Study block',
  details: `Your ${goalHours}h day starts now. Open Alpha and start the clock: ${APP_URL}`,
  from,
  minute,
});

export const googleCalendarUrl = (e: CalendarEvent): string => {
  const end = Math.min(e.minute + BLOCK_MINUTES, 1439);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    details: e.details,
    dates: `${stamp(e.from, e.minute)}/${stamp(e.from, end)}`,
    ctz: 'Asia/Kolkata',
    recur: 'RRULE:FREQ=DAILY',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
};

/* RFC 5545 text escaping, and lines folded at 75 octets. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = (line: string): string => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join('\r\n');
};

export const icsFile = (e: CalendarEvent, now = new Date()): string => {
  const end = Math.min(e.minute + BLOCK_MINUTES, 1439);
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tracker Alpha//Study block//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    /* India has no daylight saving, so one fixed offset is the whole zone. */
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kolkata',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:study-block-${e.from}-${e.minute}@trackeralpha.in`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Asia/Kolkata:${stamp(e.from, e.minute)}`,
    `DTEND;TZID=Asia/Kolkata:${stamp(e.from, end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details)}`,
    `URL:${APP_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
};

/** Hands the .ics to the device. iOS opens it straight into Calendar. */
export const downloadIcs = (e: CalendarEvent): void => {
  const blob = new Blob([icsFile(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alpha-study-block.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
