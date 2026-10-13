/* ── The guide pages ──
   Built at deploy time into plain HTML (site/build.tsx): no app bundle, no
   hydration, nothing to load but the page. Each page answers one thing a
   student actually searches — "JEE Main 2027 Physics syllabus", "NEET chapter
   weightage" — with the full answer on the page, then offers to track it.

   Copy rules (same as landing/content.ts): short plain sentences, the words
   students type, and nothing the data cannot back. Tiers, never percentages.
   URLs carry no year so they keep their ranking from one exam cycle to the
   next; titles and headings carry YEAR. */

import React from 'react';
import type { WeightTier } from '../content';
import {
  ChapterRow, EXAM_INFO, SUBJECTS, SUBJECT_DOT, SiteExam, SiteSubject, TIER_LABEL, TIER_ORDER, YEAR,
  appLink, byTier, chaptersFor, listOf, onePerSubject, subjectSlug,
} from './data';

/* Change when the guide content changes, not on every deploy: "updated" has to mean something. */
export const CONTENT_UPDATED = '2026-10-11';
const UPDATED_LONG = '11 October 2026';
export const SITE_URL = 'https://trackeralpha.in';

export interface Crumb { name: string; path: string }
export interface Faq { q: string; a: string }
export interface SitePage {
  path: string;
  title: string;
  description: string;
  crumbs: Crumb[];
  section: 'syllabus' | 'jee' | 'neet' | 'weightage' | 'legal';
  faq: Faq[];
  body: React.ReactNode;
  /** For the hub, the sitemap and llms.txt. */
  label: string;
  /** When this page last changed, if not CONTENT_UPDATED (the legal pages carry their own). */
  updated?: string;
}

/* ── Shared pieces ── */

const examName = (exam: SiteExam) => (exam === 'JEE' ? 'JEE Main' : 'NEET');
const subjectPath = (exam: SiteExam, s: SiteSubject) => `/${EXAM_INFO[exam].slug}/${subjectSlug(s)}/`;
const examPath = (exam: SiteExam) => `/${EXAM_INFO[exam].slug}/`;
const weightagePath = (exam: SiteExam) => `/${EXAM_INFO[exam].weightageSlug}/`;

const Tier: React.FC<{ tier: WeightTier; estimate?: boolean }> = ({ tier, estimate }) => (
  <>
    <span className={`tier tier-${tier}`}>{TIER_LABEL[tier]}</span>
    {estimate && <span className="est">estimate</span>}
  </>
);

const Legend: React.FC = () => (
  <div className="legend">
    {TIER_ORDER.map(t => <span key={t} className={`tier tier-${t}`}>{TIER_LABEL[t]}</span>)}
    <span><span className="badge" style={{ marginLeft: 0, marginRight: 8 }}>Foundation</span> other chapters build on it</span>
  </div>
);

const Hero: React.FC<{
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  accent: string;
  lead: React.ReactNode;
  stats?: React.ReactNode[];
  exam?: SiteExam;
}> = ({ crumbs, eyebrow, title, accent, lead, stats, exam }) => (
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
      {stats && <ul className="stats">{stats.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      <div className="hero-ctas">
        <a className="btn btn-red" href={exam ? appLink(exam) : '/'}>{exam ? 'Track this syllabus free' : 'Open Tracker Alpha'} →</a>
      </div>
      <p className="updated">Updated <time dateTime={CONTENT_UPDATED}>{UPDATED_LONG}</time></p>
    </div>
  </header>
);

const Toc: React.FC<{ items: Array<[string, string]> }> = ({ items }) => (
  <aside className="toc" aria-label="On this page">
    <p className="eyebrow">On this page</p>
    <ol>{items.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
  </aside>
);

const FaqBlock: React.FC<{ items: Faq[] }> = ({ items }) => (
  <section id="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">Questions students ask</h2>
    <div className="faq">
      {items.map((f, i) => (
        <details key={f.q} open={i === 0}>
          <summary><h3>{f.q}</h3></summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  </section>
);

const Method: React.FC<{ exam: SiteExam }> = ({ exam }) => {
  const info = EXAM_INFO[exam];
  return (
    <section id="method" aria-labelledby="method-h">
      <h2 id="method-h">How we rank chapters</h2>
      <div className="method" style={{ marginTop: 16 }}>
        <p>
          We compared {info.pyqBasis}. The sources agree on which chapters come up most, but not on exact
          percentages, so we show tiers instead of numbers that look more precise than they are.
        </p>
        <p>
          Chapters marked <b>estimate</b> have thin data, so treat their tier as a rough guide. Chapters marked{' '}
          <b>Foundation</b> may carry fewer direct questions, but other chapters depend on them. Do not skip them.
        </p>
        <p>
          The chapter list follows the current {info.syllabusFrom} syllabus. The official {YEAR} syllabus comes with
          the information bulletin on {info.officialSite}. We update this page when it changes.
        </p>
      </div>
    </section>
  );
};

const Cta: React.FC<{ exam?: SiteExam; text?: string }> = ({ exam, text }) => (
  <aside className="cta" aria-label="Track your syllabus">
    <h2>Track every chapter. <span className="serif">Free<span className="stop">.</span></span></h2>
    <p>{text ?? 'Tracker Alpha has this full syllabus built in. Mark each chapter as started, done or due for revision, time your study, and see what is left before the exam.'}</p>
    <a className="btn btn-red" href={exam ? appLink(exam) : '/'}>Start tracking free →</a>
  </aside>
);

const Related: React.FC<{ links: Array<{ href: string; eyebrow: string; title: string; text: string }> }> = ({ links }) => (
  <section id="related" aria-labelledby="related-h">
    <h2 id="related-h">Keep reading</h2>
    <div className="grid grid-2">
      {links.map(l => (
        <a key={l.href} className="link-card" href={l.href}>
          <span className="eyebrow">{l.eyebrow}</span>
          <h3>{l.title}</h3>
          <p>{l.text}</p>
        </a>
      ))}
    </div>
  </section>
);

const ChapterTable: React.FC<{ rows: ChapterRow[]; caption: string; startAt?: number; stream?: boolean }> = ({ rows, caption, startAt = 1, stream }) => (
  <div className="card">
    <div className="table-scroll">
      <table className="chapters">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">#</th><th scope="col">Chapter</th><th scope="col">Weightage</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.chapter}>
              <td>{String(startAt + i).padStart(2, '0')}</td>
              <td className="ch">
                {r.chapter}
                {stream && r.stream && <span className={`badge ${r.stream === 'botany' ? 'badge-bot' : 'badge-zoo'}`}>{r.stream === 'botany' ? 'Botany' : 'Zoology'}</span>}
                {r.foundational && <span className="badge">Foundation</span>}
                {r.note && <small>{r.note}</small>}
              </td>
              <td><Tier tier={r.tier} estimate={r.estimate} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Legend />
  </div>
);

/* ── Subject page: /jee-main-syllabus/physics/ ── */

const subjectPage = (exam: SiteExam, subject: SiteSubject): SitePage => {
  const info = EXAM_INFO[exam];
  const name = examName(exam);
  const rows = chaptersFor(exam, subject);
  const c11 = rows.filter(r => r.classId === 11);
  const c12 = rows.filter(r => r.classId === 12);
  const tiers = byTier(rows);
  const top = tiers.critical.map(r => r.chapter);
  const foundations = rows.filter(r => r.foundational).map(r => r.chapter);
  const withTopics = rows.filter(r => r.topics.length > 0);
  const others = SUBJECTS[exam].filter(s => s !== subject);
  const otherExam: SiteExam = exam === 'JEE' ? 'NEET' : 'JEE';

  const faq: Faq[] = [
    {
      q: `How many chapters are in ${name} ${YEAR} ${subject}?`,
      a: `${name} ${subject} has ${rows.length} chapters: ${c11.length} from Class 11 and ${c12.length} from Class 12. The full list is on this page.`,
    },
    {
      q: `Which ${name} ${subject} chapters have the highest weightage?`,
      a: top.length > 5
        ? `The heaviest are ${listOf(top.slice(0, 5))}. In all, ${top.length} ${subject} chapters are in the very high tier for ${name}. Give them the most time, but finish the foundation chapters first.`
        : `${listOf(top)} come up the most in past ${name} papers. Give them the most time, but finish the foundation chapters first.`,
    },
    {
      q: `Which ${subject} chapters should I study first?`,
      a: foundations.length
        ? `Start with the foundation chapters: ${listOf(foundations.slice(0, 5))}. Later chapters build on them, even when they carry fewer direct questions. Then spend most of your time on the very high and high weightage chapters.`
        : `Start with the very high weightage chapters, then the high ones. Keep revising both until the exam.`,
    },
    {
      q: `Is this the official ${name} ${YEAR} ${subject} syllabus?`,
      a: `It follows the current ${info.syllabusFrom} syllabus. The official ${YEAR} syllabus is published with the information bulletin on ${info.officialSite}, and we update this page when it changes.`,
    },
  ];

  const toc: Array<[string, string]> = [
    ['important', 'Most important chapters'],
    ['class-11', `Class 11 ${subject}`],
    ['class-12', `Class 12 ${subject}`],
    ...(withTopics.length ? [['topics', 'Key topics'] as [string, string]] : []),
    ['study-order', 'How to use this list'],
    ['method', 'How we rank chapters'],
    ['faq', 'FAQ'],
  ];

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Syllabus', path: '/syllabus/' },
    { name: `${name} ${YEAR}`, path: examPath(exam) },
    { name: subject, path: subjectPath(exam, subject) },
  ];

  return {
    path: subjectPath(exam, subject),
    label: `${name} ${YEAR} ${subject} syllabus`,
    title: `${name} ${YEAR} ${subject} Syllabus & Chapter Weightage | Tracker Alpha`,
    description: `All ${rows.length} ${name} ${subject} chapters for Class 11 and 12, ranked by weightage in past papers. See which chapters matter most and which to study first. Free.`,
    crumbs,
    section: exam === 'JEE' ? 'jee' : 'neet',
    faq,
    body: (
      <>
        <Hero
          crumbs={crumbs}
          eyebrow={`${name} ${YEAR} · ${subject}`}
          title={`${name} ${YEAR} ${subject} syllabus`}
          accent="ranked by weightage"
          exam={exam}
          lead={<>All <strong>{rows.length} chapters</strong> of {name} {subject}, Class 11 and 12, ranked by how often they come up in past papers. See what matters most, what to study first, and track every chapter free.</>}
          stats={[
            <><b>{rows.length}</b> chapters</>,
            <><b>{c11.length}</b> Class 11 · <b>{c12.length}</b> Class 12</>,
            <>{info.perSubject[subject]}</>,
            <><b>{top.length}</b> very high weightage</>,
          ]}
        />
        <div className="wrap layout">
          <div className="content">
            <section id="important" aria-labelledby="important-h">
              <h2 id="important-h">Most important {subject} chapters <span className="serif">for {name}</span></h2>
              <p>These chapters come up the most in past {name} papers, heaviest first. Give them the most time.</p>
              <ol className="card ranked">
                {tiers.critical.map(r => (
                  <li key={r.chapter}>
                    <span className="ranked-ch">{r.chapter}{r.foundational && <span className="badge">Foundation</span>}</span>
                    <span className="ranked-meta">Class {r.classId}{r.stream ? ` · ${r.stream === 'botany' ? 'Botany' : 'Zoology'}` : ''}</span>
                    {r.note && <span className="ranked-note">{r.note}</span>}
                  </li>
                ))}
              </ol>
            </section>

            <section id="class-11" aria-labelledby="c11-h">
              <h2 id="c11-h">Class 11 {subject} chapters</h2>
              <ChapterTable rows={c11} caption={`${name} ${subject}, Class 11 · ${c11.length} chapters`} stream={subject === 'Biology'} />
            </section>

            <section id="class-12" aria-labelledby="c12-h">
              <h2 id="c12-h">Class 12 {subject} chapters</h2>
              <ChapterTable rows={c12} caption={`${name} ${subject}, Class 12 · ${c12.length} chapters`} startAt={c11.length + 1} stream={subject === 'Biology'} />
            </section>

            {withTopics.length > 0 && (
              <section id="topics" aria-labelledby="topics-h">
                <h2 id="topics-h">Key topics in the heaviest chapters</h2>
                <p>Each one is a single study sitting. Work through them in order.</p>
                <div className="topics">
                  {withTopics.map(r => (
                    <div key={r.chapter} className="card card-pad" style={{ marginTop: 0 }}>
                      <h3>{r.chapter}</h3>
                      <ol>{r.topics.map(t => <li key={t}>{t}</li>)}</ol>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section id="study-order" aria-labelledby="order-h">
              <h2 id="order-h">How to use this list</h2>
              <ul className="tips">
                <li><b>Foundations first.</b> {foundations.length ? `${listOf(foundations.slice(0, 4))} look small, but later chapters depend on them.` : 'Clear the basics before the heavy chapters.'}</li>
                <li><b>Then the very high chapters.</b> They earn the most marks per hour. Revise them more than once.</li>
                <li><b>Never drop a chapter just because its tier is lower.</b> One question can be the difference in rank.</li>
                <li><b>Track it.</b> Mark each chapter as started, done or due for revision, so you always know what is left.</li>
              </ul>
            </section>

            <Method exam={exam} />
            <FaqBlock items={faq} />
            <Cta exam={exam} />
            <Related links={[
              ...others.map(s => ({ href: subjectPath(exam, s), eyebrow: `${name} ${YEAR}`, title: `${s} syllabus`, text: `Every ${s} chapter, ranked by weightage.` })),
              { href: weightagePath(exam), eyebrow: 'Weightage', title: `${name} chapter-wise weightage`, text: 'Every chapter in every subject, grouped by how much it counts.' },
              ...(SUBJECTS[otherExam].includes(subject) ? [{ href: subjectPath(otherExam, subject), eyebrow: `${examName(otherExam)} ${YEAR}`, title: `${examName(otherExam)} ${subject} syllabus`, text: `The same subject, ranked for ${examName(otherExam)}.` }] : []),
            ]} />
          </div>
          <Toc items={toc} />
        </div>
      </>
    ),
  };
};

/* ── Exam overview: /jee-main-syllabus/ ── */

const examPage = (exam: SiteExam): SitePage => {
  const info = EXAM_INFO[exam];
  const name = examName(exam);
  const subjects = SUBJECTS[exam];
  const all = subjects.map(s => ({ s, rows: chaptersFor(exam, s) }));
  const total = all.reduce((n, x) => n + x.rows.length, 0);
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Syllabus', path: '/syllabus/' },
    { name: `${name} ${YEAR}`, path: examPath(exam) },
  ];
  const faq: Faq[] = [
    {
      q: `How many chapters are in the ${name} ${YEAR} syllabus?`,
      a: `${total} chapters across ${listOf(subjects)}: ${all.map(x => `${x.rows.length} in ${x.s}`).join(', ')}.`,
    },
    {
      q: `What is the ${name} exam pattern?`,
      a: `${info.pattern.slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('. ')}. ${info.body} confirms the ${YEAR} pattern in its information bulletin.`,
    },
    {
      q: `Is the ${name} syllabus the same for Class 11 and Class 12?`,
      a: `No. Roughly half the chapters come from Class 11 and half from Class 12, and both count equally in the exam. Class 11 chapters like ${listOf(onePerSubject(all.flatMap(x => x.rows), subjects, r => r.classId === 11 && r.foundational).map(r => r.chapter))} are the base for much of Class 12.`,
    },
    {
      q: `Where can I find the official ${name} ${YEAR} syllabus?`,
      a: `On ${info.officialSite}, published with the information bulletin. This page follows the current ${info.syllabusFrom} syllabus and is updated when the official one changes.`,
    },
  ];
  return {
    path: examPath(exam),
    label: `${name} ${YEAR} syllabus`,
    title: exam === 'JEE'
      ? `JEE Main ${YEAR} Syllabus: All Chapters for PCM | Tracker Alpha`
      : `NEET ${YEAR} Syllabus: All Chapters for PCB | Tracker Alpha`,
    description: `The full ${name} ${YEAR} syllabus: all ${total} chapters of ${listOf(subjects)} for Class 11 and 12, the exam pattern, and the most important chapters. Free.`,
    crumbs,
    section: exam === 'JEE' ? 'jee' : 'neet',
    faq,
    body: (
      <>
        <Hero
          crumbs={crumbs}
          eyebrow={`${name} ${YEAR}`}
          title={`${name} ${YEAR} syllabus,`}
          accent="every chapter"
          exam={exam}
          lead={<>All <strong>{total} chapters</strong> of {listOf(subjects)} for Class 11 and 12, the exam pattern, and the chapters that count the most. Tap a subject for its full ranked list.</>}
          stats={[
            <><b>{total}</b> chapters</>,
            ...all.map(x => <><span className="dot" style={{ background: SUBJECT_DOT[x.s] }} /><b>{x.rows.length}</b> {x.s}</>),
          ]}
        />
        <div className="wrap layout">
          <div className="content">
            <section id="pattern" aria-labelledby="pattern-h">
              <h2 id="pattern-h">{name} exam pattern</h2>
              <div className="card">
                <dl className="pattern">
                  {info.pattern.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
                </dl>
              </div>
              <p className="muted" style={{ marginTop: 10 }}>{info.body} confirms the {YEAR} pattern in its information bulletin on {info.officialSite}.</p>
            </section>

            <section id="subjects" aria-labelledby="subjects-h">
              <h2 id="subjects-h">Syllabus by subject</h2>
              <div className={`grid grid-${subjects.length === 3 ? 3 : 2}`}>
                {all.map(x => (
                  <a key={x.s} className="link-card" href={subjectPath(exam, x.s)}>
                    <span className="eyebrow"><span className="dot" style={{ background: SUBJECT_DOT[x.s] }} />{info.perSubject[x.s]}</span>
                    <h3>{x.s}</h3>
                    <p>{x.rows.length} chapters. Most important: {listOf(byTier(x.rows).critical.slice(0, 3).map(r => r.chapter))}.</p>
                  </a>
                ))}
              </div>
            </section>

            {all.map(x => (
              <section key={x.s} id={subjectSlug(x.s)} aria-labelledby={`${subjectSlug(x.s)}-h`}>
                <h2 id={`${subjectSlug(x.s)}-h`}>{name} {x.s} chapters</h2>
                <div className="grid grid-2">
                  {([11, 12] as const).map(cls => {
                    const rows = x.rows.filter(r => r.classId === cls);
                    return (
                      <div key={cls} className="card card-pad" style={{ marginTop: 0 }}>
                        <h3>Class {cls} · {rows.length} chapters</h3>
                        <ol className="chlist">
                          {rows.map(r => <li key={r.chapter}>{r.chapter}</li>)}
                        </ol>
                      </div>
                    );
                  })}
                </div>
                <p style={{ marginTop: 14 }}><a href={subjectPath(exam, x.s)}>{x.s} chapters ranked by weightage →</a></p>
              </section>
            ))}

            <Method exam={exam} />
            <FaqBlock items={faq} />
            <Cta exam={exam} />
            <Related links={[
              { href: weightagePath(exam), eyebrow: 'Weightage', title: `${name} chapter-wise weightage`, text: 'Every chapter grouped by how much it counts.' },
              { href: examPath(exam === 'JEE' ? 'NEET' : 'JEE'), eyebrow: 'Syllabus', title: `${examName(exam === 'JEE' ? 'NEET' : 'JEE')} ${YEAR} syllabus`, text: 'The other exam, chapter by chapter.' },
            ]} />
          </div>
          <Toc items={[['pattern', 'Exam pattern'], ['subjects', 'By subject'], ...all.map(x => [subjectSlug(x.s), `${x.s} chapters`] as [string, string]), ['method', 'How we rank'], ['faq', 'FAQ']]} />
        </div>
      </>
    ),
  };
};

/* ── Weightage: /jee-main-chapter-weightage/ ── */

const weightagePage = (exam: SiteExam): SitePage => {
  const name = examName(exam);
  const subjects = SUBJECTS[exam];
  const rows = subjects.flatMap(s => chaptersFor(exam, s));
  const quiet = rows.filter(r => r.foundational && (r.tier === 'medium' || r.tier === 'low'));
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Syllabus', path: '/syllabus/' },
    { name: `${name} weightage`, path: weightagePath(exam) },
  ];
  /* NEET's four sections are the same size, so one ranking across subjects is
     valid. JEE's are not comparable, so JEE ranks within each subject. */
  const crossSubject = exam === 'NEET';
  const critical = byTier(rows).critical;
  const faq: Faq[] = [
    {
      q: `Which chapters have the highest weightage in ${name}?`,
      a: crossSubject
        ? `${listOf(critical.slice(0, 5).map(r => r.chapter))} are the highest-weightage chapters in NEET, and ${critical[0]?.chapter} tops the whole paper.`
        : subjects.map(s => `${s}: ${listOf(byTier(rows.filter(r => r.subject === s)).critical.slice(0, 3).map(r => r.chapter))}`).join('. ') + '.',
    },
    {
      q: `Can I skip low-weightage chapters in ${name}?`,
      a: `Be careful. Some lower-weightage chapters, like ${listOf(onePerSubject(quiet, subjects, () => true).map(r => r.chapter))}, are foundations that other chapters depend on. Study those even if they rarely get their own question.`,
    },
    {
      q: `Why don't you show exact percentages?`,
      a: `Published analyses agree on which chapters matter most, but they disagree on the exact share by several points. Tiers are honest about that. A precise-looking number would not be.`,
    },
    ...(crossSubject ? [] : [{
      q: 'Can I compare weightage across Physics, Chemistry and Maths?',
      a: 'Not directly. Each subject is ranked against its own chapters. Every JEE Main subject carries the same marks, so a very high Physics chapter and a very high Maths chapter are each among the most important in their subject.',
    }]),
  ];

  const Group: React.FC<{ tier: WeightTier; list: ChapterRow[]; showSubject: boolean }> = ({ tier, list, showSubject }) => (
    <div className="tier-group">
      <h3><span className={`tier tier-${tier}`}>{TIER_LABEL[tier]} weightage</span> <span className="muted">· {list.length}</span></h3>
      <ul className="chips">
        {list.map(r => (
          <li key={`${r.subject}-${r.chapter}`}>
            {showSubject && <span className="dot" style={{ background: SUBJECT_DOT[r.subject] }} />}
            {r.chapter}
            <small>{showSubject ? `${r.subject} · ` : ''}C{r.classId}{r.estimate ? ' · est.' : ''}</small>
          </li>
        ))}
      </ul>
    </div>
  );

  return {
    path: weightagePath(exam),
    label: `${name} ${YEAR} chapter-wise weightage`,
    title: `${name} ${YEAR} Chapter-wise Weightage${exam === 'JEE' ? ' (PCM)' : ''} | Tracker Alpha`,
    description: `Which ${name} chapters matter most? Every ${listOf(subjects)} chapter, grouped by weightage in past papers. Free, updated for ${YEAR}.`,
    crumbs,
    section: 'weightage',
    faq,
    body: (
      <>
        <Hero
          crumbs={crumbs}
          eyebrow={`${name} ${YEAR} · Weightage`}
          title={`${name} ${YEAR} chapter-wise weightage,`}
          accent="ranked"
          exam={exam}
          lead={<>Every chapter of {listOf(subjects)}, grouped by how often it comes up in past {name} papers. Use it to decide where your hours go.</>}
          stats={[<><b>{rows.length}</b> chapters</>, <><b>{critical.length}</b> very high</>, <><b>{quiet.length}</b> quiet foundations</>]}
        />
        <div className="wrap layout">
          <div className="content">
            {crossSubject ? (
              <section id="ranking" aria-labelledby="ranking-h">
                <h2 id="ranking-h">NEET chapters by weightage</h2>
                <p>NEET has four sections of 45 questions each, so chapters can be compared across subjects. Very high chapters are the biggest single sources of marks in the paper.</p>
                <div className="card card-pad">
                  {TIER_ORDER.map(t => <Group key={t} tier={t} list={byTier(rows)[t]} showSubject />)}
                </div>
              </section>
            ) : subjects.map(s => (
              <section key={s} id={subjectSlug(s)} aria-labelledby={`${subjectSlug(s)}-h`}>
                <h2 id={`${subjectSlug(s)}-h`}><span className="dot" style={{ background: SUBJECT_DOT[s], width: 12, height: 12 }} />{name} {s} weightage</h2>
                <div className="card card-pad">
                  {TIER_ORDER.map(t => <Group key={t} tier={t} list={byTier(rows.filter(r => r.subject === s))[t]} showSubject={false} />)}
                </div>
                <p style={{ marginTop: 14 }}><a href={subjectPath(exam, s)}>Full {s} syllabus with study notes →</a></p>
              </section>
            ))}

            <section id="foundations" aria-labelledby="foundations-h">
              <h2 id="foundations-h">Low on paper, <span className="serif">not optional</span></h2>
              <p>These chapters rarely get many questions of their own, but other chapters are built on them. Skip them and the high-weightage chapters get harder.</p>
              <ul className="chips" style={{ marginTop: 16 }}>
                {quiet.map(r => <li key={`${r.subject}-${r.chapter}`}><span className="dot" style={{ background: SUBJECT_DOT[r.subject] }} />{r.chapter}<small>{r.subject} · C{r.classId}</small></li>)}
              </ul>
            </section>

            <Method exam={exam} />
            <FaqBlock items={faq} />
            <Cta exam={exam} text="Tracker Alpha shows this weightage next to every chapter in your syllabus, and its daily coach suggests what to study next with it." />
            <Related links={subjects.map(s => ({ href: subjectPath(exam, s), eyebrow: `${name} ${YEAR}`, title: `${s} syllabus`, text: `Every ${s} chapter with notes and key topics.` }))} />
          </div>
          <Toc items={[...(crossSubject ? [['ranking', 'Ranked chapters'] as [string, string]] : subjects.map(s => [subjectSlug(s), s] as [string, string])), ['foundations', 'Quiet foundations'], ['method', 'How we rank'], ['faq', 'FAQ']]} />
        </div>
      </>
    ),
  };
};

/* ── Hub: /syllabus/ ── */

const hubPage = (): SitePage => {
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Syllabus', path: '/syllabus/' }];
  const faq: Faq[] = [
    { q: `What is the difference between the JEE Main and NEET syllabus?`, a: 'Both cover Class 11 and 12 Physics and Chemistry. JEE Main adds Maths, NEET adds Biology. Chemistry differs slightly too: NEET keeps s-Block Elements, Hydrogen and p-Block groups 13 and 14, which JEE Main dropped.' },
    { q: 'Are these syllabus pages free?', a: 'Yes. Every page here is free, and so is Tracker Alpha, the study tracker that has these chapter lists built in.' },
  ];
  return {
    path: '/syllabus/',
    label: `JEE and NEET ${YEAR} syllabus`,
    title: `JEE & NEET ${YEAR} Syllabus, Chapter by Chapter | Tracker Alpha`,
    description: `Free chapter-wise syllabus and weightage for JEE Main ${YEAR} and NEET ${YEAR}: Physics, Chemistry, Maths and Biology for Class 11 and 12.`,
    crumbs,
    section: 'syllabus',
    faq,
    body: (
      <>
        <Hero
          crumbs={crumbs}
          eyebrow={`Syllabus · ${YEAR}`}
          title={`JEE and NEET ${YEAR} syllabus,`}
          accent="chapter by chapter"
          lead={<>Every chapter of Physics, Chemistry, Maths and Biology for Class 11 and 12, ranked by how much it counts. Pick your exam.</>}
        />
        <div className="wrap layout">
          <div className="content">
            {(['JEE', 'NEET'] as const).map(exam => (
              <section key={exam} id={exam.toLowerCase()} aria-labelledby={`${exam}-h`}>
                <h2 id={`${exam}-h`}>{examName(exam)} {YEAR}</h2>
                <div className="grid grid-2">
                  <a className="link-card" href={examPath(exam)}>
                    <span className="eyebrow">Full syllabus</span>
                    <h3>{examName(exam)} {YEAR} syllabus</h3>
                    <p>All chapters, the exam pattern and the most important chapters.</p>
                  </a>
                  <a className="link-card" href={weightagePath(exam)}>
                    <span className="eyebrow">Weightage</span>
                    <h3>Chapter-wise weightage</h3>
                    <p>Every chapter grouped from very high to lower weightage.</p>
                  </a>
                  {SUBJECTS[exam].map(s => (
                    <a key={s} className="link-card" href={subjectPath(exam, s)}>
                      <span className="eyebrow"><span className="dot" style={{ background: SUBJECT_DOT[s] }} />{EXAM_INFO[exam].perSubject[s]}</span>
                      <h3>{s}</h3>
                      <p>{chaptersFor(exam, s).length} chapters, ranked by weightage.</p>
                    </a>
                  ))}
                </div>
              </section>
            ))}
            <FaqBlock items={faq} />
            <Cta text="Tracker Alpha has the full JEE and NEET syllabus built in. Track every chapter, time your study, log mock tests and keep a daily streak. Free." />
          </div>
          <Toc items={[['jee', 'JEE Main'], ['neet', 'NEET'], ['faq', 'FAQ']]} />
        </div>
      </>
    ),
  };
};

export const allPages = (): SitePage[] => [
  hubPage(),
  examPage('JEE'),
  ...SUBJECTS.JEE.map(s => subjectPage('JEE', s)),
  weightagePage('JEE'),
  examPage('NEET'),
  ...SUBJECTS.NEET.map(s => subjectPage('NEET', s)),
  weightagePage('NEET'),
];

/* ── Chrome around every page ── */

export const Shell: React.FC<{ page: SitePage; pages: SitePage[] }> = ({ page, pages }) => (
  <>
    <nav className="nav" aria-label="Main">
      <div className="wrap">
        <a className="brand" href="/"><img src="/apple-touch-icon.png" width={28} height={28} alt="" />Tracker Alpha</a>
        <div className="nav-links">
          <a href="/syllabus/" aria-current={page.section === 'syllabus' ? 'page' : undefined}>Syllabus</a>
          <a href={examPath('JEE')} aria-current={page.section === 'jee' ? 'page' : undefined}>JEE Main</a>
          <a href={examPath('NEET')} aria-current={page.section === 'neet' ? 'page' : undefined}>NEET</a>
          <a href={weightagePath('JEE')} aria-current={page.section === 'weightage' ? 'page' : undefined}>Weightage</a>
        </div>
        <a className="btn btn-red btn-sm" href="/">Start free</a>
      </div>
    </nav>
    <main>{page.body}</main>
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a className="brand" href="/"><img src="/apple-touch-icon.png" width={28} height={28} alt="" loading="lazy" />Tracker Alpha</a>
            <p>The free study tracker for JEE and NEET {YEAR}. Time every session, plan your day and finish the syllabus chapter by chapter.</p>
          </div>
          <div>
            <p className="foot-h">JEE Main</p>
            <ul>{pages.filter(p => p.path.startsWith('/jee-')).map(p => <li key={p.path}><a href={p.path}>{shortLabel(p)}</a></li>)}</ul>
          </div>
          <div>
            <p className="foot-h">NEET</p>
            <ul>{pages.filter(p => p.path.startsWith('/neet-')).map(p => <li key={p.path}><a href={p.path}>{shortLabel(p)}</a></li>)}</ul>
          </div>
          <div>
            <p className="foot-h">Tracker Alpha</p>
            <ul>
              <li><a href="/">Study tracker app</a></li>
              <li><a href="/syllabus/">All syllabus guides</a></li>
              <li><a href="https://instagram.com/trackeralpha" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="mailto:lockinhq@gmail.com">Email us</a></li>
              <li><a href="/privacy/">Privacy policy</a></li>
              <li><a href="/delete-account/">Delete your account</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-base">
          <span>© {CONTENT_UPDATED.slice(0, 4)} Tracker Alpha</span>
          <span>Made in India for JEE and NEET aspirants</span>
        </div>
      </div>
    </footer>
  </>
);

const shortLabel = (p: SitePage) => {
  const m = p.label.match(/(Physics|Chemistry|Maths|Biology) syllabus$/);
  if (m) return `${m[1]} syllabus`;
  if (/weightage/.test(p.label)) return 'Chapter weightage';
  return 'Full syllabus';
};
