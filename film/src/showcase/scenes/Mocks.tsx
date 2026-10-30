import type React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Eyebrow, Glow, Shot, useRise } from '../kit';
import { APP, IN_OUT, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

/* JEE Main's colour in the trend, dark mode (mocks/model.ts, EXAM_COLORS.mains). */
const blue = '#3987e5';

/* Eight full JEE Main mocks out of 300: a demo run that climbs with one dip. */
const SCORES = [142, 156, 151, 173, 168, 190, 212, 231];
const W = 700;
const H = 300;
const xOf = (i: number) => 20 + (i / (SCORES.length - 1)) * (W - 40);
const yOf = (s: number) => H - 10 - ((s - 100) / 180) * (H - 30);

/* A smooth line through the points (Catmull-Rom as cubic Béziers). */
const PATH = (() => {
  const p = SCORES.map((s, i) => [xOf(i), yOf(s)]);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
})();

export const Mocks: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = useRise(0);
  const c = CAPTIONS.mocks;
  const [a, b] = AT.mocksDraw;
  const draw = tw(f, [a, b], [0, 1], IN_OUT);
  const shown = Math.floor(draw * (SCORES.length - 1) + 0.001);
  const score = Math.round(tw(f, [a, b], [SCORES[0], SCORES[SCORES.length - 1]], IN_OUT));
  const last = pop(f, b, fps, 10, 180);

  return (
    <Shot dur={SCENES.mocks.dur} push={[1, 1.04]}>
      <Glow color={blue} x={640} y={560} size={1300} opacity={0.14} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={96} stack style={{ position: 'absolute', left: 1140, top: 390, width: 760 }} />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: 190,
            top: 190,
            width: 860,
            padding: 40,
            borderRadius: 18,
            background: APP.card,
            boxShadow: `inset 0 0 0 1px ${APP.edge}, 0 80px 120px -50px rgba(0,0,0,0.9)`,
            translate: `0 ${(1 - rise) * 180}px`,
            transform: `rotateY(${18 - rise * 8}deg) rotateX(${8 - rise * 4}deg)`,
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Eyebrow style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i style={{ width: 7, height: 7, borderRadius: 4, background: blue }} />
                JEE Main · full mocks
              </Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
                <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 84, letterSpacing: '-0.035em', color: APP.ink, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, color: APP.z500 }}>/ 300</span>
              </div>
            </div>
            <div
              style={{
                marginTop: 4,
                padding: '8px 13px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 13,
                color: APP.z300,
                opacity: tw(f, [b, b + 6], [0, 1]),
                translate: `0 ${tw(f, [b, b + 10], [8, 0])}px`,
              }}
            >
              +19 vs last
            </div>
          </div>

          <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`} style={{ display: 'block', marginTop: 26, overflow: 'visible' }}>
            {[100, 150, 200, 250].map(v => (
              <g key={v}>
                <line x1={0} x2={W} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,0.05)" />
                <text x={W} y={yOf(v) - 6} textAnchor="end" style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, fill: APP.z600 }}>{v}</text>
              </g>
            ))}
            <defs>
              <linearGradient id="mk-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={blue} stopOpacity="0.28" />
                <stop offset="1" stopColor={blue} stopOpacity="0" />
              </linearGradient>
              <clipPath id="mk-clip">
                <rect x={0} y={0} width={xOf(0) + draw * (xOf(SCORES.length - 1) - xOf(0))} height={H + 30} />
              </clipPath>
            </defs>
            <path d={`${PATH} L${xOf(SCORES.length - 1)} ${H} L${xOf(0)} ${H} Z`} fill="url(#mk-fill)" clipPath="url(#mk-clip)" />
            <path d={PATH} fill="none" stroke={blue} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            {SCORES.map((s, i) => {
              const at = a + (i / (SCORES.length - 1)) * (b - a);
              const p = i === SCORES.length - 1 ? last : pop(f, at, fps, 12, 220);
              if (i > shown && i !== SCORES.length - 1) return null;
              return (
                <g key={i}>
                  {i === SCORES.length - 1 && <circle cx={xOf(i)} cy={yOf(s)} r={8 + last * 14} fill={blue} opacity={0.18 * Math.min(1, last)} />}
                  <circle cx={xOf(i)} cy={yOf(s)} r={(i === SCORES.length - 1 ? 8 : 5.5) * Math.min(1.2, p)} fill={blue} stroke={APP.card} strokeWidth={2.5} />
                  <text x={xOf(i)} y={H + 26} textAnchor="middle" style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, fill: APP.z600, letterSpacing: '0.06em' }}>M{i + 1}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
