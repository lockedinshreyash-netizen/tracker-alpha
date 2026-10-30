import type React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Glow, Phone, Shot, useRise } from '../kit';
import { APP, IN_OUT, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';
import { TodayScreen } from './Today';

const FIREWOOD = '#F59F00';

/** streak/FirewoodCard.tsx's icon: a flame over two crossed logs. */
const FirewoodIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={FIREWOOD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.8c1.9 2.1 3.1 3.8 3.1 5.6a3.1 3.1 0 0 1-6.2 0c0-1.4.8-2.5 1.7-3.3.2 1 .7 1.6 1.4 1.8-.4-1.4-.4-2.8 0-4.1z" />
    <rect x="3" y="14.2" width="18" height="4.4" rx="2.2" transform="rotate(-12 12 16.4)" />
    <rect x="3" y="14.2" width="18" height="4.4" rx="2.2" transform="rotate(12 12 16.4)" />
  </svg>
);

/* streak/StreakMoment.tsx, day 47: liquid glass over a light scrim, the
   count rolling from yesterday's number to today's, the last seven days with
   today landing in red. The line is the app's own for 47 (`streakLine`). */
const Moment: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  const glass = pop(f, AT.streakPop, fps, 16, 170);
  // The roll: 560 ms on cubic-bezier(0.2, 0.9, 0.25, 1.15), as in the app.
  const roll = interpolate(f, [AT.streakRoll, AT.streakRoll + 17], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.9, 0.25, 1.15),
  });
  const today = pop(f, AT.streakRoll + 4, fps, 9, 260);
  const week = ['S', 'S', 'M', 'T', 'W', 'T', 'F'];
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)' }}>
        <TodayScreen f={200} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', opacity: tw(f, [0, 6], [0, 1]) }} />
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: 150,
          borderRadius: 28,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(48,48,54,0.62), rgba(22,22,26,0.7))',
          backdropFilter: 'blur(26px) saturate(1.8)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.06), 0 40px 80px -30px rgba(0,0,0,0.9)',
          scale: String(0.9 + 0.1 * glass),
          opacity: Math.min(1, glass * 1.4),
          textAlign: 'center',
        }}
      >
        <div style={{ padding: '40px 30px 30px', background: 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.18) 0%, transparent 65%)' }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: APP.accent, marginBottom: 24 }}>Streak extended</div>
          <div style={{ position: 'relative', height: 88, overflow: 'hidden' }}>
            <div style={{ translate: `0 ${-88 * roll}px` }}>
              {[46, 47].map(n => (
                <div key={n} style={{ height: 88, lineHeight: '88px', fontFamily: SANS, fontWeight: 900, fontSize: 88, letterSpacing: '-0.05em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: APP.z600, marginTop: 8 }}>days in a row</div>
          <div style={{ width: 32, height: 2, borderRadius: 1, background: APP.accent, opacity: 0.7, margin: '20px auto 24px' }} />
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', color: '#fff', marginBottom: 24 }}>Keep the run alive.</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            {week.map((d, i) => {
              const isToday = i === 6;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: isToday ? APP.accent : '#F4F4F5',
                      scale: String(isToday ? 0.4 + 0.6 * today : 1),
                      boxShadow: isToday ? `0 0 ${16 * Math.min(1, today)}px rgba(225,6,0,0.8)` : 'none',
                    }}
                  />
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 10, color: isToday ? APP.accent : APP.z600 }}>{d}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 13, color: APP.z400, marginTop: 24 }}>53 days to The Book.</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: SANS, fontWeight: 500, fontSize: 12, color: APP.z600, marginTop: 8 }}>
            <FirewoodIcon size={14} />9 firewood in the bank
          </div>
        </div>
        <div style={{ padding: '18px 30px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '13px 0', borderRadius: 6, background: APP.accent, fontFamily: SANS, fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#fff' }}>KEEP GOING</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Streak: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useRise(0);
  const c = CAPTIONS.streak;
  const focus = tw(f, [AT.streakRoll - 6, AT.streakRoll + 26], [0, 1], IN_OUT);
  return (
    <Shot dur={SCENES.streak.dur} push={[1, 1.03]}>
      <Glow color={APP.accent} x={600} y={480} size={1100} opacity={0.08 + tw(f, [AT.streakRoll, AT.streakRoll + 10], [0, 0.14])} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={4} size={104} stack style={{ position: 'absolute', left: 1080, top: 390, width: 700 }} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: 'absolute',
            left: 390,
            top: 104,
            transformOrigin: '50% 34%',
            translate: `0 ${(1 - rise) * 220}px`,
            transform: `rotateY(${20 - rise * 9 - focus * 5}deg) rotateX(${8 - rise * 4}deg)`,
            scale: String(1 + focus * 0.12),
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          <Phone>
            <Moment f={f} />
          </Phone>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
