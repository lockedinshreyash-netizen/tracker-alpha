import type React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { SYLLABUS_DATA } from '../../../../constants';
import { SUBJECT_COLORS } from '../../../../schedule/colors';
import { Caption, Eyebrow, Glow, Shot, useRise } from '../kit';
import { APP, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

/* constants.tsx's STATUS_COLORS, as the colours Tailwind gives those classes. */
const STATUS = {
  completed: { label: 'Completed', text: '#22c55e', edge: 'rgba(22,163,74,0.5)', bg: 'rgba(22,163,74,0.1)' },
  in_progress: { label: 'In progress', text: '#ca8a04', edge: 'rgba(202,138,4,0.5)', bg: 'rgba(202,138,4,0.05)' },
  practice_pending: { label: 'Practice left', text: '#fb923c', edge: 'rgba(249,115,22,0.5)', bg: 'rgba(249,115,22,0.05)' },
};
type Status = keyof typeof STATUS;

const CHAPTERS = SYLLABUS_DATA[11].Physics.slice(0, 6);
const START: Status[] = ['completed', 'completed', 'in_progress', 'in_progress', 'practice_pending', 'in_progress'];
const TOTAL = SYLLABUS_DATA[11].Physics.length;
/* Two done on screen, four more further down the list. */
const DONE_BEFORE = 6;

const Pill: React.FC<{ s: Status; style?: React.CSSProperties }> = ({ s, style }) => (
  <span
    style={{
      position: 'absolute',
      right: 0,
      top: 0,
      padding: '6px 11px',
      borderRadius: 6,
      border: `1px solid ${STATUS[s].edge}`,
      fontFamily: SANS,
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: STATUS[s].text,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {STATUS[s].label}
  </span>
);

export const Syllabus: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = useRise(0);
  const c = CAPTIONS.syllabus;
  const ticked = AT.syllabusTicks.filter(t => f >= t).length;
  const done = DONE_BEFORE + ticked;
  const pctFrom = Math.round(((DONE_BEFORE + Math.max(0, ticked - 1)) / TOTAL) * 100);
  const pctTo = Math.round((done / TOTAL) * 100);
  const lastTick = AT.syllabusTicks[Math.max(0, ticked - 1)];
  const pct = ticked === 0 ? Math.round((DONE_BEFORE / TOTAL) * 100) : Math.round(tw(f, [lastTick, lastTick + 6], [pctFrom, pctTo]));
  const blue = SUBJECT_COLORS.Physics.dot;

  return (
    <Shot dur={SCENES.syllabus.dur} push={[1, 1.04]}>
      <Glow color="#22c55e" x={1250} y={560} size={1300} opacity={0.05 + 0.03 * ticked} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={96} stack style={{ position: 'absolute', left: 150, top: 370, width: 620 }} />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: 860,
            top: 150,
            width: 860,
            padding: 34,
            borderRadius: 18,
            background: APP.card,
            boxShadow: `inset 0 0 0 1px ${APP.edge}, 0 80px 120px -50px rgba(0,0,0,0.9)`,
            translate: `0 ${(1 - rise) * 180}px`,
            transform: `rotateY(${-20 + rise * 9}deg) rotateX(${8 - rise * 4}deg)`,
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i style={{ width: 10, height: 10, borderRadius: 5, background: blue }} />
                <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 30, letterSpacing: '-0.02em', color: APP.ink }}>Physics</span>
              </div>
              <Eyebrow style={{ marginTop: 8 }}>Class 11 · {done} of {TOTAL} done</Eyebrow>
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 64, letterSpacing: '-0.03em', color: APP.ink, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>
              {pct}
              <span style={{ fontSize: 30, color: APP.z500 }}>%</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 22 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 2, background: APP.accent, boxShadow: '0 0 12px rgba(225,6,0,0.5)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
            {CHAPTERS.map((ch, i) => {
              const tick = i >= 2 ? AT.syllabusTicks[i - 2] : -1;
              const flip = tick < 0 ? 1 : pop(f, tick, fps, 13, 220);
              const now: Status = tick < 0 || f >= tick ? 'completed' : START[i];
              const enter = tw(f, [i * 2, i * 2 + 14], [0, 1]);
              const greenBg = tick < 0 ? 1 : Math.min(1, flip);
              return (
                <div
                  key={ch}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    height: 62,
                    padding: '0 18px',
                    borderRadius: 12,
                    border: `1px solid ${now === 'completed' ? STATUS.completed.edge : STATUS[START[i]].edge}`,
                    background: now === 'completed' ? `rgba(22,163,74,${0.1 * greenBg})` : STATUS[START[i]].bg,
                    opacity: enter,
                    translate: `0 ${(1 - enter) * 26}px`,
                  }}
                >
                  <span style={{ position: 'relative', width: 26, height: 26 }}>
                    <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 11, color: APP.z600, opacity: now === 'completed' ? 0 : 1 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: 'absolute', inset: 0, opacity: now === 'completed' ? 1 : 0, scale: String(0.4 + 0.6 * Math.min(1.15, flip)) }}>
                      <circle cx="13" cy="13" r="12" fill="#16a34a" />
                      <path d="M7.5 13.5l3.6 3.4 7.4-7.6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span style={{ flex: 1, fontFamily: SANS, fontWeight: 700, fontSize: 18, color: APP.ink, letterSpacing: '-0.01em' }}>{ch}</span>
                  <span style={{ position: 'relative', width: 128, height: 28 }}>
                    {now === 'completed' && tick >= 0 && f < tick + 8 && (
                      <Pill s={START[i]} style={{ opacity: 1 - flip, translate: `0 ${-flip * 10}px` }} />
                    )}
                    <Pill
                      s={now}
                      style={now === 'completed' && tick >= 0 ? { opacity: Math.min(1, flip), translate: `0 ${(1 - Math.min(1, flip)) * 10}px` } : undefined}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
