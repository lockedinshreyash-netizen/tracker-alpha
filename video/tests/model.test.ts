import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionForKey, errorFor, formatTime, parseVideoLink, rateLabel, resumeAt, seekTarget, snapRate, spokenTime, stepRate, watchUrl,
} from '../model';

const ID = 'M7lc1UVf-VE';

test('every ordinary way of writing a video link gives its id', () => {
  for (const link of [
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=95s`,
    `youtube.com/watch?feature=share&v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123&t=12`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `https://www.youtube.com/live/${ID}`,
    `  https://www.youtube.com/watch?v=${ID}  `,
  ]) {
    assert.deepEqual(parseVideoLink(link), { ok: true, id: ID }, link);
  }
});

test('Shorts are refused, however they are written', () => {
  assert.deepEqual(parseVideoLink(`https://www.youtube.com/shorts/${ID}`), { ok: false, reason: 'shorts' });
  assert.deepEqual(parseVideoLink(`youtube.com/shorts/${ID}?feature=share`), { ok: false, reason: 'shorts' });
});

test('a playlist is refused, even when the link also names a video', () => {
  assert.deepEqual(parseVideoLink('https://www.youtube.com/playlist?list=PL1234567890'), { ok: false, reason: 'playlist' });
  assert.deepEqual(parseVideoLink(`https://www.youtube.com/watch?v=${ID}&list=PL1234567890&index=3`), { ok: false, reason: 'playlist' });
  assert.deepEqual(parseVideoLink(`https://youtu.be/${ID}?list=PL1234567890`), { ok: false, reason: 'playlist' });
});

test('anything else is invalid, and nothing but an 11-character id gets through', () => {
  assert.deepEqual(parseVideoLink(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseVideoLink('   '), { ok: false, reason: 'empty' });
  for (const link of [
    'rotational motion',
    `https://vimeo.com/${ID}`,
    `https://evil.example/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE"><script>',
    'https://www.youtube.com/@AxisPhysics',
    'https://www.youtube.com/',
    'javascript:alert(1)',
  ]) {
    assert.deepEqual(parseVideoLink(link), { ok: false, reason: 'invalid' }, link);
  }
});

test('watch links carry a start time only when there is one', () => {
  assert.equal(watchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(watchUrl(ID, 0.4), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(watchUrl(ID, 95.7), `https://www.youtube.com/watch?v=${ID}&t=95s`);
});

test('resume lands a few seconds early, and never on the opening or the credits', () => {
  assert.equal(resumeAt(0), 0);
  assert.equal(resumeAt(9), 0);
  assert.equal(resumeAt(95.6), 92);
  assert.equal(resumeAt(3600, 3700), 3597);
  assert.equal(resumeAt(3690, 3700), 0);
  assert.equal(resumeAt(NaN), 0);
  assert.equal(resumeAt(500, null), 497);
});

test('speeds snap to what the player offers', () => {
  const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  assert.equal(snapRate(1.3, rates), 1.25);
  assert.equal(snapRate(3, rates), 2);
  assert.equal(snapRate(1.5, [1]), 1);
  assert.equal(snapRate(1.5, []), 1);
  assert.equal(stepRate(1, rates, 1), 1.25);
  assert.equal(stepRate(1, rates, -1), 0.75);
  assert.equal(stepRate(2, rates, 1), 2);
  assert.equal(stepRate(0.25, rates, -1), 0.25);
  assert.equal(stepRate(1.1, [2, 1, 1.5], 1), 1.5);
  assert.equal(rateLabel(1), '1×');
  assert.equal(rateLabel(1.25), '1.25×');
});

test('times print like a clock and read like words', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(245.9), '4:05');
  assert.equal(formatTime(754), '12:34');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-4), '0:00');
  assert.equal(spokenTime(754), '12 minutes 34 seconds');
  assert.equal(spokenTime(3601), '1 hour 1 second');
  assert.equal(spokenTime(0), '0 seconds');
});

test('each player error says what helps', () => {
  assert.equal(errorFor(150).kind, 'blocked');
  assert.equal(errorFor(101).kind, 'blocked');
  assert.equal(errorFor(150).openOnYouTube, true);
  assert.equal(errorFor(150).retry, false);
  assert.equal(errorFor(100).kind, 'missing');
  assert.equal(errorFor(100).openOnYouTube, false);
  assert.equal(errorFor(2).kind, 'invalid');
  assert.equal(errorFor(5).retry, true);
  assert.equal(errorFor(153).kind, 'identity');
  assert.equal(errorFor(null).kind, 'load');
  // A blocked script is not "check your connection": online, it offers the plain embed.
  assert.equal(errorFor(null, true).plain, true);
  assert.doesNotMatch(errorFor(null, true).body, /connection/i);
  assert.equal(errorFor(null, false).title, "You're offline.");
  assert.equal(errorFor(null, false).plain, false);
  assert.equal(errorFor(150).plain, false);
  assert.equal(errorFor(999).kind, 'player');
});

test('keys act only outside text fields and without modifiers', () => {
  assert.equal(actionForKey({ key: ' ' }), 'toggle');
  assert.equal(actionForKey({ key: 'k' }), 'toggle');
  assert.equal(actionForKey({ key: 'ArrowLeft' }), 'back');
  assert.equal(actionForKey({ key: 'ArrowRight' }), 'forward');
  assert.equal(actionForKey({ key: '<' }), 'slower');
  assert.equal(actionForKey({ key: '>' }), 'faster');
  assert.equal(actionForKey({ key: ' ', typing: true }), null);
  assert.equal(actionForKey({ key: 'ArrowLeft', metaKey: true }), null);
  assert.equal(actionForKey({ key: 'k', ctrlKey: true }), null);
  assert.equal(actionForKey({ key: 'x' }), null);
});

test('a ten-second jump stays inside the video', () => {
  assert.equal(seekTarget(5, -1), 0);
  assert.equal(seekTarget(100, 1), 110);
  assert.equal(seekTarget(595, 1, 600), 599);
  assert.equal(seekTarget(100, 1, null), 110);
});
