/* ── Privacy policy and account deletion ──
   Built in the same pass as the guide pages (site/build.tsx) and in the same
   shell, but they are not guides: no FAQ markup, not in the guide lists or
   llms.txt, only in the sitemap and the footers.

   Google Play links to both from the store listing: the privacy policy URL,
   and the "delete account" URL a user can reach without the app installed.

   Every sentence here describes what the code does today. When a feature
   starts collecting something new, this file changes in the same commit, and
   POLICY_EFFECTIVE moves. Copy rules are the site's: short, plain sentences. */

import React from 'react';
import type { Crumb, SitePage } from './pages';

/* The date the policy last changed. Not the deploy date. */
const POLICY_EFFECTIVE = '2026-10-23';
const EFFECTIVE_LONG = '23 October 2026';
const EMAIL = 'lockinhq@gmail.com';

const Mail: React.FC<{ subject?: string }> = ({ subject }) => (
  <a href={`mailto:${EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`}>{EMAIL}</a>
);

const LegalHero: React.FC<{ crumbs: Crumb[]; eyebrow: string; title: string; accent: string; lead: React.ReactNode; cta?: React.ReactNode }> = ({ crumbs, eyebrow, title, accent, lead, cta }) => (
  <header className="hero">
    <div className="wrap">
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          {crumbs.map((c, i) => (
            <li key={c.path}>{i < crumbs.length - 1 ? <a href={c.path}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
          ))}
        </ol>
      </nav>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}{' '}<span className="serif">{accent}<span className="stop">.</span></span></h1>
      <p className="lead">{lead}</p>
      {cta && <div className="hero-ctas">{cta}</div>}
      <p className="updated">Effective <time dateTime={POLICY_EFFECTIVE}>{EFFECTIVE_LONG}</time></p>
    </div>
  </header>
);

const Contents: React.FC<{ items: Array<[string, string]> }> = ({ items }) => (
  <aside className="toc" aria-label="On this page">
    <p className="eyebrow">On this page</p>
    <ol>{items.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
  </aside>
);

const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section id={id} aria-labelledby={`${id}-h`}>
    <h2 id={`${id}-h`}>{title}</h2>
    {children}
  </section>
);

/* ── /privacy/ ── */

const privacyPage = (): SitePage => {
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy/' }];
  const toc: Array<[string, string]> = [
    ['short', 'The short version'],
    ['collect', 'What we collect'],
    ['visible', 'What other students see'],
    ['share', 'Who else gets data'],
    ['keep', 'How long we keep it'],
    ['choices', 'Your choices'],
    ['under-18', 'If you are under 18'],
    ['security', 'Security'],
    ['changes', 'Changes and contact'],
  ];
  return {
    path: '/privacy/',
    label: 'Privacy policy',
    title: 'Privacy Policy | Tracker Alpha',
    description: 'What Tracker Alpha collects, why, who can see it, and how to delete your account. No ads, and we never sell your data.',
    crumbs,
    section: 'legal',
    faq: [],
    updated: POLICY_EFFECTIVE,
    body: (
      <>
        <LegalHero
          crumbs={crumbs}
          eyebrow="Privacy"
          title="Your data,"
          accent="in plain words"
          lead={<>Tracker Alpha is a study tracker for JEE and NEET students. This page says what it stores about you, why, and how to get rid of it.</>}
        />
        <div className="wrap layout">
          <div className="content">
            <Section id="short" title="The short version">
              <ul className="tips">
                <li>You can use Tracker Alpha <b>without an account</b>. Then everything stays in your browser, on your device. We can’t see it.</li>
                <li>If you make an account, we keep a copy of your study data so it <b>syncs</b> between your devices.</li>
                <li>We show <b>no ads</b>. We <b>never sell</b> your data or share it with advertisers.</li>
                <li>You can <b>delete your account</b> and everything in it, from the app, any time. <a href="/delete-account/">Here’s how.</a></li>
              </ul>
            </Section>

            <Section id="collect" title="What we collect">
              <h3>Without an account</h3>
              <p>
                Your sessions, plan, syllabus progress, tasks, mock tests and settings are saved in your browser’s
                storage on that device. They never reach us. Clearing the site’s data, or Review → Reset device,
                deletes them.
              </p>

              <h3>Your account</h3>
              <p>
                You sign in with Google. Google shares your name, email address and profile picture with us, and
                you never give us a password. Accounts made earlier with an email and a password keep that email
                address, and the password stays stored hashed by our sign-in provider, never as text. We can’t
                read it. We email you only about your account.
              </p>

              <h3>Your study data</h3>
              <p>
                When you’re signed in, a copy of what you track is stored on our servers so it can sync: study
                sessions and their focus scores, your plan, syllabus progress, tasks, mock tests, your error
                notebook, sleep times you entered in an earlier version of the app, streak and settings.
              </p>

              <h3>Your profile</h3>
              <p>A handle, a display name, an optional short bio and an avatar: one of ours, or a photo you upload.</p>

              <h3>Features you choose to use</h3>
              <ul className="plain">
                <li><b>Ranks.</b> If you join the race, your display name and today’s study hours, and any race chat messages you post.</li>
                <li><b>Groups.</b> The groups you’re in, the messages and reactions you send, and your hours and today’s tasks, only at the level you pick for each group.</li>
                <li><b>Decks.</b> The decks and cards you make, images you add to them, and your review history.</li>
                <li><b>Notes.</b> Your notes stay on your device. If you’re signed in, a copy of your pages and the images in them is stored on our servers so your other devices get them. Only you can read them. Our staff can’t. Delete a page from the trash and its copy goes too.</li>
                <li><b>Reminders.</b> To remind you when the app is closed: your device’s push address, its browser type, and the reminder itself (the task and when it’s due).</li>
                <li><b>The new-tab extension.</b> If you install it: it copies a summary of your day (streak, today’s hours, goal, week, exam date, your open Focus Tasks, and any session running) from Alpha into your browser’s storage, so your new tab can show it. It stays on your device. The extension sends nothing anywhere.</li>
                <li><b>Daily nudges.</b> If you turn them on: the time you usually study, and the next few days of nudges, each with today’s hours and goal in it (like “7.5h to go”). We hold only what is about to be sent, withdraw it when you log enough, and delete sent ones after a week. Turn them off and nothing more is sent.</li>
                <li><b>Feedback and reports.</b> What you write to us, and your email so we can reply.</li>
                <li><b>Polls.</b> Your answer. Nobody, including us, can see who voted for what. We only see totals.</li>
                <li><b>Voice commands.</b> In Chrome and Edge, your browser sends your voice to Google’s or Microsoft’s speech service to turn it into text. We never receive or keep the audio.</li>
              </ul>

              <h3>How the app is used</h3>
              <p>
                When you’re signed in, we record which days you opened the app and a few numbers: hours studied,
                number of sessions, your device type, whether the app is installed (or bookmarked, or added to your
                calendar from the app), whether daily nudges are on, and which features you’ve used.
                These are numbers, never what you wrote. We mostly look at them as totals across everyone, to see
                what is working.
              </p>
              <p>
                Our admins can also see a list of the newest accounts. It shows each one’s profile (name, handle,
                bio and avatar), when they joined, their exam and class, and the numbers above. It never shows your
                email, your study log or anything you wrote.
              </p>
              <p>
                Our website and app also use Google Analytics, which uses cookies to count visits, the pages
                viewed, the device and browser, and a rough location from your IP address.
              </p>

              <h3>Safety records</h3>
              <p>
                If a group admin or our team removes or hides you from a group or from Ranks, we keep a record of
                that action and the reason given.
              </p>
            </Section>

            <Section id="visible" title="What other students see">
              <ul className="plain">
                <li>Anyone signed in can see your <b>profile</b>: handle, display name, bio and avatar.</li>
                <li>If you join <b>Ranks</b>, anyone signed in can see your display name, your hours and your race chat messages.</li>
                <li>In a <b>group</b>, members see your profile and messages, plus your hours and tasks only if you chose to share them there.</li>
                <li>Everything else, including your study log, plan, mocks, notebook and decks, is <b>yours alone</b>.</li>
              </ul>
            </Section>

            <Section id="share" title="Who else gets data">
              <p>We don’t sell data and we don’t share it with advertisers. We use these services to run the app, and they get only what their job needs:</p>
              <ul className="plain">
                <li><b>Supabase</b> stores your account, synced data and files, and handles sign-in.</li>
                <li><b>Vercel</b> hosts the website, and sees requests like any web host.</li>
                <li><b>Google</b> runs Analytics, Google sign-in, and push delivery for Chrome and Android.</li>
                <li><b>Apple and Mozilla</b> deliver reminders on Safari and Firefox, if you turn them on there.</li>
                <li><b>Font and code services</b> (Google Fonts, cdnfonts.com, the Tailwind CSS CDN) see your IP address when your browser loads them.</li>
                <li><b>YouTube</b>, through its privacy-enhanced player, only after you press play on a video we post.</li>
              </ul>
              <p>These services may store data outside India. We also share data if the law requires it.</p>
            </Section>

            <Section id="keep" title="How long we keep it">
              <p>
                We keep your data for as long as you have an account. When you delete it, it’s removed from our
                database straight away. Our providers’ backups may hold a copy for a short time, until they expire.
                Google Analytics keeps its data under its own settings, and it isn’t linked to your account.
              </p>
            </Section>

            <Section id="choices" title="Your choices">
              <ul className="plain">
                <li><b>See and change</b> your data in the app. To ask what we hold about you, or to fix something, email <Mail />.</li>
                <li><b>Delete your account</b> in the app: Review → Account &amp; sync → Delete account. Can’t sign in? <a href="/delete-account/">Other ways to delete it.</a></li>
                <li><b>Leave</b> Ranks or a group, change what a group sees, or turn off reminders, any time.</li>
                <li><b>Sign out</b> or Reset device to clear a device.</li>
              </ul>
            </Section>

            <Section id="under-18" title="If you are under 18">
              <p>
                Most people using Tracker Alpha are students, and many are under 18. If you are, please use it with
                your parent’s or guardian’s permission. A parent or guardian can email <Mail subject="Delete my child’s account" /> from
                any address to ask us to delete a child’s account, and we will.
              </p>
            </Section>

            <Section id="security" title="Security">
              <p>
                Everything travels over HTTPS. Sign-in is through Google, and the few older passwords are stored
                hashed. Our database checks every request, so an
                account can read only its own private data. No system is perfect, though. If something ever goes
                wrong, we’ll tell the people affected.
              </p>
            </Section>

            <Section id="changes" title="Changes and contact">
              <p>
                If this policy changes, the date at the top changes too, and we’ll tell you in the app about anything
                big. Questions or complaints about your data: <Mail subject="Privacy" />.
              </p>
            </Section>
          </div>
          <Contents items={toc} />
        </div>
      </>
    ),
  };
};

/* ── /delete-account/ ── */

const deleteAccountPage = (): SitePage => {
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Delete your account', path: '/delete-account/' }];
  return {
    path: '/delete-account/',
    label: 'Delete your account',
    title: 'Delete Your Account | Tracker Alpha',
    description: 'How to delete your Tracker Alpha account and all of its data, from the app or by email.',
    crumbs,
    section: 'legal',
    faq: [],
    updated: POLICY_EFFECTIVE,
    body: (
      <>
        <LegalHero
          crumbs={crumbs}
          eyebrow="Your account"
          title="Delete your"
          accent="account"
          lead={<>You can delete your Tracker Alpha account and everything in it yourself, in under a minute. It works the same in the Android app and on the website.</>}
          cta={<a className="btn btn-red" href="/?open=review#account">Open account settings →</a>}
        />
        <div className="wrap layout">
          <div className="content">
            <Section id="steps" title="In the app">
              <ol className="plain">
                <li>Open Tracker Alpha, or go to <a href="/">trackeralpha.in</a>, and sign in.</li>
                <li>Go to <b>Review</b>, then <b>Account &amp; sync</b>.</li>
                <li>Tap <b>Delete account</b>, type DELETE, and tap <b>Delete forever</b>.</li>
              </ol>
              <p>Uninstalling the app does not delete your account. Only these steps, or an email to us, do.</p>
            </Section>

            <Section id="email" title="Can’t sign in?">
              <p>
                Email <Mail subject="Delete my account" /> from the email address on your account, with the subject
                “Delete my account”. We’ll delete it and reply to confirm. A parent or guardian can ask us to delete a
                child’s account from any address.
              </p>
            </Section>

            <Section id="what" title="What gets deleted">
              <ul className="plain">
                <li>Your account, email address and profile, including your photo.</li>
                <li>Your synced study history, plan, syllabus progress, tasks, mock tests and error notebook.</li>
                <li>Your decks, cards, images and review history.</li>
                <li>Your group memberships and messages, your Ranks entries and race chat messages.</li>
                <li>Your reminders, feedback, poll answers and usage stats.</li>
              </ul>
              <p>
                It happens straight away, and it can’t be undone. Groups you own pass to another member. Backups held
                by our providers expire on their own shortly after. Other devices keep what’s saved on them until you
                sign out there.
              </p>
            </Section>

            <Section id="kept" title="What stays">
              <ul className="plain">
                <li>Google Analytics visit counts, which aren’t linked to your account.</li>
                <li>Shared Alpha decks you wrote as one of our team, which belong to every student using them.</li>
              </ul>
              <p>More detail is in our <a href="/privacy/">privacy policy</a>.</p>
            </Section>
          </div>
          <Contents items={[['steps', 'In the app'], ['email', 'Can’t sign in?'], ['what', 'What gets deleted'], ['kept', 'What stays']]} />
        </div>
      </>
    ),
  };
};

export const legalPages = (): SitePage[] => [privacyPage(), deleteAccountPage()];
