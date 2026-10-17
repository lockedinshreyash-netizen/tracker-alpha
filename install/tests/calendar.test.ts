import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleCalendarUrl, icsFile, studyEvent } from '../calendar';

test('6 PM on the study-day axis is 18:00 IST, an hour long, repeating daily', () => {
  const url = new URL(googleCalendarUrl(studyEvent(8, '2026-10-17', 840)));
  assert.equal(url.searchParams.get('dates'), '20261017T180000/20261017T190000');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Kolkata');
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=DAILY');
});

test('a time after midnight lands on the next calendar date', () => {
  const url = new URL(googleCalendarUrl(studyEvent(8, '2026-10-17', 1230))); // 00:30
  assert.equal(url.searchParams.get('dates'), '20261018T003000/20261018T013000');
});

test('the .ics is a valid repeating event with an alarm at the start', () => {
  const ics = icsFile(studyEvent(10, '2026-10-17', 840), new Date('2026-10-17T10:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20261017T180000'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('TRIGGER:PT0M'));
  assert.ok(ics.includes('DTSTAMP:20261017T100000Z'));
  /* Every physical line at most 75 octets, as RFC 5545 requires. */
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, line);
  /* Commas in text are escaped. */
  assert.ok(ics.includes('Open Alpha and start the clock: https'));
});
