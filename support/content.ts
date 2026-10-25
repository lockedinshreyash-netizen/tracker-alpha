/* ── Support Alpha: the words ──
   Read by the in-app page and by the static /support/ page, so the two can
   never say different things. Sincere and short on purpose: no anecdotes, no
   numbers, no promises about what the money will do. This is the one page in
   Alpha that is quiet, and it should stay that way.

   The `promise` block is the page's loudest thing on purpose: nobody reaches
   the QR without first reading that paying is optional and changes nothing.
   Every line in it must stay literally true. Two tempting ones are not:
   "nothing in Alpha is locked" (the Alpha Store has priced packs and Pro) and
   "nobody can see who paid" (a UPI app shows the payer's name to the payee).
   What IS true: the app has no payment integration at all, so it cannot know
   who paid, and nothing anywhere asks for money unprompted. */

export const SUPPORT_COPY = {
  eyebrow: 'A note from the founder',
  title: 'Help build',
  accent: 'what’s next',
  letter: [
    'Alpha started with a simple idea: make preparing for competitive exams a little less overwhelming.',
    'It’s grown into something bigger, with students tracking their preparation, building routines, and finding their people along the way.',
    'If Alpha has become a part of your journey and you’d like to support its continued development, you’re welcome to.',
  ],
  signature: 'Shreyash',
  signatureRole: 'Founder, Tracker Alpha',
  optional: 'Entirely optional. Alpha remains free to use.',

  promiseTitle: 'This is 101% optional',
  promiseAccent: 'No pressure. Ever',
  promise: [
    { head: 'Paying unlocks nothing', body: 'Not paying takes nothing away. Your tracker, streak and everything you use stay exactly the same.' },
    { head: 'Alpha doesn’t know who paid', body: 'There is no payment system inside the app. Nothing in your account changes either way.' },
    { head: 'No reminders. No pop-ups', body: 'Alpha never asks you for money. This page is only here for people who come looking.' },
    { head: 'Under 18? Ask a parent first', body: 'And please never use money that’s meant for something else. Your exam comes first.' },
  ],
  noteFree: 'A note costs nothing, and it means just as much.',

  supportTitle: 'Support Alpha',
  supportBody: 'Your support helps me keep building, improving, and maintaining Alpha.',
  onlyIfYouWant: 'Only if you want to',
  anyAmount: 'Any amount is fine. So is nothing at all.',
  scan: 'Scan with a supported payment app.',
  orPayTo: 'Or pay to this UPI ID',
  setup: 'Support isn’t set up yet. Check back soon.',
  qrFailed: 'The QR code didn’t load. You can still pay to the UPI ID below.',

  noteTitle: 'A note for the founder',
  noteBody: 'Anything you’d like to say? I’d love to hear it.',
  notePlaceholder: 'Write something...',
  noteReceived: 'Message received.',
  noteThanks: 'Thank you for taking a moment to write.',

  closing: 'Thanks for being part of Alpha',
} as const;
