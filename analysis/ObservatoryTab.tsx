import React, { useMemo } from 'react';
import { AiInsight, AiPrefs, DailyLog, SleepLog, SleepState } from '../types';
import { getISTDateString } from '../utils';
import {
  ExperimentState, dayRows, evidenceGates, formatRange, formatStartDate,
} from '../insight/observe';
import { MIN_DAYS } from '../insight/confidence';
import WhenYouStudy from './WhenYouStudy';
import RecentDays from './RecentDays';
import ProgressRows from './ProgressRows';
import SleepEntry, { fmtDuration } from './SleepEntry';
import ExplainCard from './ExplainCard';
import { worthExplaining } from '../insight/packet';

interface Props {
  experiment: ExperimentState;
  logs: DailyLog[];
  sleep: SleepState;
  theme: 'dark' | 'light';
  analysisStartedAt: number | null;
  arriving: boolean;
  onReadIntro: () => void;
  onBegin: () => void;
  onToggleSleep: (enabled: boolean) => void;
  onDeleteAllSleep: () => void;
  onLogSleep: (log: SleepLog) => void;
  onClearNight: (date: string) => void;
  ai: AiPrefs;
  signedIn: boolean;
  onToggleAi: (enabled: boolean) => void;
  onCacheInsight: (hash: string, insight: AiInsight) => void;
}

/**
 * One card. One idea.
 *
 * Every section on this page is a title, an optional sentence of plain English,
 * and one figure. If a card needs a second paragraph to be understood, the
 * figure is wrong — that is the rule the whole redesign turns on.
 */
const Card: React.FC<{
  label?: string;
  title?: string;
  sub?: string;
  delay?: number;
  /* The card is showing a worked example rather than the student's own record.
     Marked in the header, every time, without exception — this feature's whole
     claim is that it never shows a figure it cannot stand behind, and an
     unlabelled example would break that on the first screen. */
  example?: boolean;
  children: React.ReactNode;
}> = ({ label, title, sub, delay = 0, example, children }) => (
  <section className="o-card o-in" style={{ animationDelay: `${delay}ms` }}>
    {label && (
      <div className="flex items-center gap-3 mb-3">
        <p className="o-label">{label}</p>
        {example && <span className="o-chip" style={{ padding: '3px 10px', fontSize: 11 }}>Example</span>}
      </div>
    )}
    {title && <h2 className="o-title mb-1.5">{title}</h2>}
    {sub && <p className="o-body mb-7" style={{ maxWidth: '52ch' }}>{sub}</p>}
    {!sub && (title || label) && <div className="mb-7" />}
    {children}
  </section>
);

/**
 * The Observatory.
 *
 * Alpha's other tabs ask the student to do something. This one asks them to
 * look — so there is almost nothing here to press, and everything is written to
 * be understood at a glance by somebody who has never been taught to read a
 * chart.
 *
 * The page answers three questions in order, and refuses to answer the third
 * until it honestly can: what have I done, when do I do it, and what does that
 * say about me.
 */
const ObservatoryTab: React.FC<Props> = ({
  experiment, logs, sleep, theme, arriving,
  onReadIntro, onBegin, onToggleSleep, onDeleteAllSleep, onLogSleep, onClearNight,
  ai, signedIn, onToggleAi, onCacheInsight,
}) => {
  const dark = theme === 'dark';
  const today = getISTDateString();
  const { windows, grid, status } = experiment;
  const named = windows.confidence === 'established';

  const rows = useMemo(
    () => dayRows(logs, experiment.startedOn, today),
    [logs, experiment.startedOn, today],
  );
  const gates = useMemo(() => evidenceGates(experiment), [experiment]);

  const nights = experiment.nights;
  const recentNights = useMemo(() => sleep.logs.slice(-7), [sleep.logs]);
  const avgPerDay = experiment.studyDays > 0 ? experiment.hours / experiment.studyDays : 0;

  if (status === 'unstarted') {
    return (
      <div className={`obs ${dark ? 'obs-dark' : ''} min-h-full -m-4 md:-m-8 p-4 md:p-8`}>
        <Unstarted onBegin={onBegin} onReadIntro={onReadIntro} />
      </div>
    );
  }

  return (
    <div className={`obs ${dark ? 'obs-dark' : ''} min-h-full -m-4 md:-m-8 p-4 md:p-8 ${arriving ? 'o-in' : ''}`}>
      <div className="max-w-3xl mx-auto py-4 md:py-8">

        {/* ── Hero ──
            Whoop's lesson, kept: one number people can say out loud, the plain
            sentence that gives it meaning, and nothing else competing with it. */}
        <header className="mb-7 md:mb-9">
          <div className="flex items-start justify-between gap-6 mb-9">
            <div>
              <p className="o-label mb-2">Observatory</p>
              <p className="o-body" style={{ fontSize: 14 }}>
                Started {experiment.startedOn ? formatStartDate(experiment.startedOn) : '—'}
              </p>
            </div>
            <button onClick={onReadIntro} className="o-chip shrink-0">How this works</button>
          </div>

          <div className="flex items-end gap-7 md:gap-10 flex-wrap">
            <div className="o-in" style={{ animationDelay: '80ms' }}>
              <div className="flex items-baseline gap-2.5">
                <span className="o-hero" style={{ fontSize: 'clamp(4rem, 17vw, 6.5rem)' }}>
                  {experiment.dayNumber}
                </span>
                <span className="o-num" style={{ fontSize: 20, color: 'var(--o-ink-3)' }}>
                  {experiment.dayNumber === 1 ? 'day' : 'days'}
                </span>
              </div>
              <p className="o-body mt-3" style={{ maxWidth: '34ch' }}>
                {headline(experiment, named)}
              </p>
            </div>
          </div>

          {/* Three quiet supporting numbers. Whoop again: the hero gets the
              weight, the context sits under it in one row. */}
          <div className="grid grid-cols-3 gap-4 mt-9">
            <Stat value={experiment.sessions.toString()} label="Sessions" delay={160} />
            <Stat value={experiment.hours.toFixed(1)} label="Hours" delay={200} />
            <Stat value={avgPerDay > 0 ? `${avgPerDay.toFixed(1)}h` : '—'} label="Avg / study day" delay={240} />
          </div>
        </header>

        <div className="flex flex-col gap-4 md:gap-5">

          {/* ── The finding, or honestly nothing ── */}
          {named && windows.best && windows.worst ? (
            <Card label="What Alpha found" delay={280}>
              <p className="o-title" style={{ fontSize: 'clamp(1.3rem, 4.5vw, 1.9rem)', lineHeight: 1.25, marginBottom: 20 }}>
                You focus best between{' '}
                <span className="o-accent">{formatRange(windows.best.start, windows.best.end)}</span>.
              </p>
              <p className="o-body" style={{ maxWidth: '48ch', marginBottom: 26 }}>
                Across {windows.best.sessions} sessions on {windows.best.days} different days, your
                focus in that window averaged {windows.best.quality?.toFixed(1)} out of 5 — against{' '}
                {windows.restQuality?.toFixed(1)} the rest of the day.
              </p>

              <Compare
                best={{ label: formatRange(windows.best.start, windows.best.end), value: windows.best.quality ?? 0 }}
                rest={{ label: 'Rest of your day', value: windows.restQuality ?? 0 }}
                worst={{ label: formatRange(windows.worst.start, windows.worst.end), value: windows.worst.quality ?? 0 }}
              />

              <p className="o-body mt-7" style={{ fontSize: 13.5, color: 'var(--o-ink-3)', maxWidth: '52ch' }}>
                This is where your sessions have gone best. It doesn't mean the time of day
                caused it.
              </p>
            </Card>
          ) : windows.confidence === 'emerging' && windows.best ? (
            <Card label="Early signal" delay={280}>
              <p className="o-title" style={{ fontSize: 'clamp(1.25rem, 4.2vw, 1.75rem)', lineHeight: 1.3, marginBottom: 14 }}>
                <span className="o-accent">{formatRange(windows.best.start, windows.best.end)}</span>{' '}
                is your strongest so far.
              </p>
              <p className="o-body" style={{ maxWidth: '50ch' }}>
                {windows.best.sessions} sessions across {windows.best.days} days — enough to look
                at, not yet enough to be sure. The gap between it and the rest of your day could
                still be chance.
              </p>
            </Card>
          ) : null}

          {/* ── When you study ── */}
          <Card
            label="When you study"
            example={grid.sessionCount === 0}
            title={grid.sessionCount === 0 ? 'This is what it will look like' : peakSentence(grid)}
            sub={
              grid.sessionCount === 0
                ? 'Somebody else\u2019s week, shown so you know what to expect. Time a session on Today and your own hours replace it.'
                : `Every hour you've studied since you began, across ${grid.dayCount} ${grid.dayCount === 1 ? 'day' : 'days'}.`
            }
            delay={340}
          >
            <WhenYouStudy grid={grid} best={windows.best} labelled={named} />
          </Card>

          {/* ── The last fortnight ── */}
          {rows.length > 0 && (
            <Card
              label="Recent days"
              example={experiment.sessions === 0}
              title={experiment.sessions === 0 ? 'A fortnight, once you have one' : 'Your last two weeks'}
              sub={
                experiment.sessions === 0
                  ? 'An example week. Each bar will be one of your days, and the gaps are days nothing was recorded.'
                  : 'Hours studied each day. Flat days are days nothing was recorded.'
              }
              delay={400}
            >
              <RecentDays rows={rows} />
            </Card>
          )}

          {/* ── What's still needed ── */}
          {!named && (
            <Card
              label="Before Alpha can be sure"
              title="What's still needed"
              sub="Alpha won't name your best time of day until there's enough evidence behind it. Here's how close you are."
              delay={460}
            >
              <ProgressRows gates={gates} />
            </Card>
          )}

          {/* ── Sleep ──
              Both the switch and the entry live here, because this is the only
              place the data is ever read. Today keeps a small dismissable nudge
              and nothing else. */}
          <Card
            label="Sleep"
            title={sleepTitle(sleep, nights)}
            sub={
              sleep.enabled
                ? 'Sleep gives one reading a night, so this fills slowly. After three weeks Alpha can start comparing your nights to the days after them.'
                : 'Two times each morning, and Alpha can start comparing your sleep to the day that follows it. Off until you ask for it.'
            }
            delay={520}
          >
            {sleep.enabled && (
              <>
                <SleepEntry
                  sleep={sleep}
                  theme={theme}
                  onLogSleep={onLogSleep}
                  onClearNight={onClearNight}
                />

                <div className="mt-7">
                  <div className="flex items-baseline justify-between gap-4 mb-2.5">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Nights recorded</span>
                    <span className="o-num" style={{ fontSize: 15, color: nights >= 21 ? 'var(--o-accent)' : 'var(--o-ink-2)' }}>
                      {nights}
                      <span style={{ color: 'var(--o-ink-3)', fontWeight: 600 }}> / 21</span>
                    </span>
                  </div>
                  <div className="o-track" style={{ height: 10 }}>
                    <div
                      className="o-fill o-bar-x"
                      style={{
                        width: `${Math.min(100, (nights / 21) * 100)}%`,
                        background: nights >= 21 ? 'var(--o-accent)' : 'var(--o-bar)',
                        animationDelay: '160ms',
                      }}
                    />
                  </div>
                </div>

                {recentNights.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-6">
                    {recentNights.map(n => (
                      <span key={n.date} className="o-chip">
                        {fmtDuration(n.wakeAt - n.bedAt)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 flex-wrap items-center mt-7">
              <button
                onClick={() => onToggleSleep(!sleep.enabled)}
                className={`o-btn ${sleep.enabled ? 'o-btn-quiet' : ''}`}
              >
                {sleep.enabled ? 'Stop tracking' : 'Track my sleep'}
              </button>
              {sleep.enabled && sleep.logs.length > 0 && (
                <button onClick={onDeleteAllSleep} className="o-chip" style={{ cursor: 'pointer' }}>
                  Delete {sleep.logs.length} {sleep.logs.length === 1 ? 'night' : 'nights'}
                </button>
              )}
            </div>

            <p className="o-body mt-6" style={{ fontSize: 13.5, color: 'var(--o-ink-3)', maxWidth: '52ch' }}>
              Alpha will never suggest sleeping less to study more.
            </p>
          </Card>

          {/* Last, and least important. Everything above is arithmetic Alpha
              does itself; this only puts some of it into sentences, and only
              when asked. Renders nothing at all unless the deployment has the
              feature configured. */}
          <ExplainCard
            experiment={experiment}
            sleepLogs={sleep.logs}
            ai={ai}
            signedIn={signedIn}
            worth={worthExplaining(experiment)}
            onToggle={onToggleAi}
            onCached={onCacheInsight}
          />
        </div>

        <p className="o-body text-center mt-9" style={{ fontSize: 13, color: 'var(--o-ink-3)' }}>
          Every number here comes from sessions Alpha timed itself.
        </p>
      </div>
    </div>
  );
};

/* ── Copy ──
   Written as a sentence a person would say. The status enum stays in the data
   layer; what reaches the screen is English. */
const headline = (exp: ExperimentState, named: boolean): string => {
  if (exp.sessions === 0) return 'Your experiment has started. Nothing recorded yet — start a timed session and the first one lands here.';
  if (named) return 'Alpha has enough evidence to name your strongest time of day.';
  if (exp.studyDays < 2) return 'First day on the record. Come back tomorrow and there will be something to compare it to.';
  return `Alpha is watching. ${MIN_DAYS - exp.studyDays > 0 ? `${MIN_DAYS - exp.studyDays} more study ${MIN_DAYS - exp.studyDays === 1 ? 'day' : 'days'} before it can start testing a pattern.` : 'Building the evidence to test a pattern.'}`;
};

/** "Most of your time lands around 9am." Derived, never asserted. */
const peakSentence = (grid: { buckets: { minutes: number }[] }): string => {
  let bestIdx = -1;
  let bestMins = 0;
  grid.buckets.forEach((b, i) => {
    if (b.minutes > bestMins) { bestMins = b.minutes; bestIdx = i; }
  });
  if (bestIdx < 0) return 'Nothing recorded yet';
  const wall = (4 * 60 + bestIdx * 30) % 1440;
  const hour = Math.floor(wall / 60);
  const label = hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  return `Most of your time lands around ${label}`;
};

/** The sleep card's headline, as a sentence rather than a state name. */
const sleepTitle = (sleep: SleepState, nights: number): string => {
  if (!sleep.enabled) return 'Not being tracked';
  if (nights === 0) return 'Log your first night';
  if (nights >= 21) return `${nights} nights — enough to start comparing`;
  return `${nights} ${nights === 1 ? 'night' : 'nights'} recorded`;
};

const Stat: React.FC<{ value: string; label: string; delay: number }> = ({ value, label, delay }) => (
  <div className="o-in" style={{ animationDelay: `${delay}ms` }}>
    <p className="o-num" style={{ fontSize: 'clamp(1.35rem, 5vw, 1.8rem)' }}>{value}</p>
    <p className="o-body mt-1" style={{ fontSize: 13 }}>{label}</p>
  </div>
);

/**
 * The finding, drawn on the rating scale itself.
 *
 * Three bars on a fixed 1–5 scale — fixed, never fitted to the data's own
 * range, because an auto-fitted axis makes a trivial difference look enormous.
 * That is exactly the exaggeration the confidence gates exist to prevent, and
 * it would be silly to let the chart put it back.
 */
const Compare: React.FC<{
  best: { label: string; value: number };
  rest: { label: string; value: number };
  worst: { label: string; value: number };
}> = ({ best, rest, worst }) => {
  const row = (r: { label: string; value: number }, tone: 'accent' | 'mid' | 'low', i: number) => (
    <div key={r.label} className="o-in" style={{ animationDelay: `${180 + i * 90}ms` }}>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <span style={{ fontSize: 14, fontWeight: tone === 'accent' ? 700 : 500, color: tone === 'low' ? 'var(--o-ink-2)' : undefined }}>
          {r.label}
        </span>
        <span className="o-num shrink-0" style={{ fontSize: 14, color: tone === 'accent' ? 'var(--o-accent)' : 'var(--o-ink-2)' }}>
          {r.value.toFixed(1)}
        </span>
      </div>
      <div className="o-track" style={{ height: tone === 'accent' ? 12 : 9 }}>
        <div
          className="o-fill o-bar-x"
          style={{
            width: `${(Math.min(5, Math.max(1, r.value)) / 5) * 100}%`,
            background: tone === 'accent' ? 'var(--o-accent)' : 'var(--o-bar)',
            animationDelay: `${240 + i * 90}ms`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {row(best, 'accent', 0)}
      {row(rest, 'mid', 1)}
      {row(worst, 'low', 2)}
      <p className="o-body" style={{ fontSize: 12.5, color: 'var(--o-ink-3)' }}>
        Focus rating out of 5, weighted by how long each session ran.
      </p>
    </div>
  );
};

/**
 * Before the study exists.
 *
 * Not a locked panel and not a teaser — the experiment hasn't started because
 * the student hasn't started it, so the honest thing here is the door and a
 * straight account of what walking through it does.
 */
const Unstarted: React.FC<{ onBegin: () => void; onReadIntro: () => void }> = ({ onBegin, onReadIntro }) => (
  <div className="max-w-2xl mx-auto py-10 md:py-20">
    <p className="o-label mb-5 o-in">Observatory</p>

    <h1
      className="o-hero o-in"
      style={{ fontSize: 'clamp(2.4rem, 9vw, 4rem)', animationDelay: '60ms' }}
    >
      Find out how<br />you actually study.
    </h1>

    <p className="o-body o-in mt-6" style={{ fontSize: 17, maxWidth: '42ch', animationDelay: '140ms' }}>
      Alpha will watch when you study, how long you last and how well it goes — then
      show you your own patterns. Not what you think you do. What you actually do.
    </p>

    <div className="flex flex-col gap-3 mt-10 o-in" style={{ animationDelay: '220ms' }}>
      <Promise text="Your strongest hours, once there's enough evidence" />
      <Promise text="Where your focus drops off" />
      <Promise text="How your sleep relates to the next day, if you track it" />
    </div>

    <div className="flex flex-wrap items-center gap-4 mt-10 o-in" style={{ animationDelay: '300ms' }}>
      <button onClick={onBegin} className="o-btn" style={{ padding: '17px 36px', fontSize: 15 }}>
        Start my experiment
      </button>
      <button onClick={onReadIntro} className="o-chip" style={{ cursor: 'pointer' }}>
        How it works
      </button>
    </div>

    <p className="o-body mt-7 o-in" style={{ fontSize: 13.5, color: 'var(--o-ink-3)', animationDelay: '380ms' }}>
      Today becomes day one. Alpha won't claim to have found a pattern until your data
      backs it up.
    </p>
  </div>
);

const Promise: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-3">
    <span
      className="shrink-0"
      style={{
        width: 6, height: 6, borderRadius: 999,
        background: 'var(--o-accent)', marginTop: 9,
      }}
      aria-hidden="true"
    />
    <span className="o-body" style={{ fontSize: 15, color: 'var(--o-ink)' }}>{text}</span>
  </div>
);

export default ObservatoryTab;
