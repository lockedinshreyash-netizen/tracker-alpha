/**
 * After the stop.
 *
 * The strip that has been filling at the bottom of the frame all film rises
 * into the whole year at once. Then it empties, day by day, back to the
 * first cell — and the first cell is somebody else's.
 */
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { DAYS, YEAR } from '../score/year';
import { TIMELINE } from '../score/timeline';
import { SANS, SERIF } from './fonts';
import { ACCENT, INK, MUTED, SUBJECT_HEX, VOID } from './look';

const STRIP_X = 96;
const STRIP_W = 1728;
const STRIP_Y = 1080 - 78;
const CELL = STRIP_W / DAYS;

const SIZE = 22;
const PITCH = 28;
const COLS = Math.ceil(DAYS / 7);
const GRID_W = COLS * PITCH - (PITCH - SIZE);
const GX = (1920 - GRID_W) / 2;
const GY = 330;

const COLOR = YEAR.map(y => {
  if (!y.logs.length) return null;
  if (y.logs.every(l => l.source === 'manual')) return '#52525B';
  return SUBJECT_HEX[[...y.logs].sort((a, b) => b.hours - a.hours)[0].subject];
});

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const Ending: React.FC<{ frame: number }> = ({ frame }) => {
  const E = TIMELINE.examFrame;
  if (frame < E) return null;
  const t = frame - E;

  const ground = interpolate(t, [110, 150], [0, 1], clamp);
  const line = interpolate(t, [300, 322, 430, 446], [0, 1, 1, 0], clamp);
  const start = interpolate(t, [636, 650], [0, 1], clamp);
  const mark = interpolate(t, [730, 760], [0, 1], clamp);
  const out = interpolate(t, [960, 1015], [1, 0], clamp);
  const gridOut = interpolate(t, [880, 940], [1, 0.0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out, pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: VOID, opacity: ground }} />

      {YEAR.map((y, d) => {
        // Rise: strip → grid, staggered left to right.
        const r0 = 150 + d * 0.25;
        const p = interpolate(t, [r0, r0 + 44], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.2, 1) });
        const col = Math.floor(d / 7);
        const row = d % 7;
        const x = interpolate(p, [0, 1], [STRIP_X + d * CELL + 0.6, GX + col * PITCH]);
        const yy = interpolate(p, [0, 1], [STRIP_Y, GY + row * PITCH]);
        const w = interpolate(p, [0, 1], [CELL - 1.2, SIZE]);
        const h = interpolate(p, [0, 1], [14, SIZE]);
        // Clear: the last day first, back to the first.
        const c0 = 450 + (DAYS - 1 - d) * 0.22;
        const cleared = t >= c0;
        const color = COLOR[d];
        const first = d === 0;
        const reborn = first && t >= 600;
        const flash = reborn ? Math.exp(-(t - 600) / 10) : 0;
        let fill = color ?? '#1C1C21';
        if (cleared) fill = 'transparent';
        if (reborn) fill = INK;
        const outline = cleared ? (first ? ACCENT : '#26262C') : 'transparent';
        return (
          <div
            key={y.day}
            style={{
              position: 'absolute',
              left: x,
              top: yy,
              width: w,
              height: h,
              background: fill,
              boxShadow: `inset 0 0 0 ${cleared && p >= 1 ? 1.5 : 0}px ${outline}${reborn ? `, 0 0 ${20 + 40 * flash}px rgba(255,255,255,${0.35 + 0.6 * flash})` : ''}`,
              borderRadius: p * 3,
              opacity: (first && cleared ? 1 : gridOut) * (cleared && !first && !reborn ? 0.9 : 1),
            }}
          />
        );
      })}

      <div
        style={{
          position: 'absolute',
          top: GY + 7 * PITCH + 80,
          width: '100%',
          textAlign: 'center',
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: 60,
          color: INK,
          opacity: line,
          translate: `0 ${interpolate(line, [0, 1], [10, 0])}px`,
        }}
      >
        Every note was a day of study.
      </div>

      <div
        style={{
          position: 'absolute',
          top: GY + 7 * PITCH + 70,
          width: '100%',
          textAlign: 'center',
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 120,
          letterSpacing: '-0.035em',
          color: INK,
          opacity: start * interpolate(t, [880, 930], [1, 0], clamp),
          scale: interpolate(start, [0, 1], [0.97, 1]),
        }}
      >
        Start yours.
      </div>

      <div
        style={{
          position: 'absolute',
          top: 470,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          opacity: interpolate(t, [920, 950], [0, 1], clamp) * mark,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 150,
            lineHeight: 0.9,
            color: '#FF2A1F',
            textShadow: `0 0 24px ${ACCENT}, 0 0 60px rgba(225,6,0,0.55)`,
          }}
        >
          α
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 44, letterSpacing: '0.18em', color: INK }}>TRACKER ALPHA</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, letterSpacing: '0.08em', color: MUTED }}>trackeralpha.in</div>
      </div>
    </AbsoluteFill>
  );
};
