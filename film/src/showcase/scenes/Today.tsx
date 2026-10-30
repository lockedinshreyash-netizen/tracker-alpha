import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SUBJECT_COLORS } from '../../../../schedule/colors';
import type { Subject } from '../../../../types';
import { Capsule, Caption, Eyebrow, Glow, Phone, Shot, Touch, useRise } from '../kit';
import { APP, IN_OUT, SANS, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

const BLUE = SUBJECT_COLORS.Physics.dot;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;

/* The board's geometry on a 390-wide screen: three columns, as the app lays
   them out at this width. */
const COL_W = 114;
const GAP = 8;
const CARD_H = 64;

/** board/TaskCard.tsx: the subject as a 3px edge, its name, the task in bold caps. */
const Card: React.FC<{ subject: Subject; text: string; done?: number; style?: React.CSSProperties }> = ({ subject, text, done = 0, style }) => {
  const c = SUBJECT_COLORS[subject];
  return (
    <div
      style={{
        position: 'absolute',
        width: COL_W,
        height: CARD_H,
        borderRadius: 8,
        overflow: 'hidden',
        background: c.bg,
        border: `1px solid ${c.border}`,
        opacity: 1 - done * 0.55,
        ...style,
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.dot }} />
      <div style={{ padding: '8px 8px 8px 11px' }}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.text }}>{subject}</div>
        <div
          style={{
            marginTop: 3,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 10.5,
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: APP.ink,
            textDecoration: done > 0.5 ? 'line-through' : 'none',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

export const TodayScreen: React.FC<{ f: number }> = ({ f }) => {
  const s = AT.todayStart;
  const on = tw(f, [s, s + 8], [0, 1]);
  const secs = tw(f, [s, s + 64], [0, 5076], IN_OUT);
  const press = f < s ? tw(f, [s - 5, s - 1], [1, 0.96]) : tw(f, [s, s + 6], [0.96, 1]);

  // The card from Doing to Done.
  const lift = tw(f, [AT.todayLift, AT.todayLift + 5], [0, 1]) * (1 - tw(f, [AT.todayDrop, AT.todayDrop + 6], [0, 1]));
  const move = tw(f, [AT.todayLift + 2, AT.todayDrop], [0, 1], IN_OUT);
  const dropped = f >= AT.todayDrop;
  const doneFade = tw(f, [AT.todayDrop + 2, AT.todayDrop + 10], [0, 1]);
  const shift = tw(f, [AT.todayLift + 6, AT.todayDrop], [0, 1], IN_OUT);
  const ping = (f % 22) / 22;

  const colX = (i: number) => 16 + i * (COL_W + GAP);
  const top = 600;
  return (
    <AbsoluteFill style={{ background: APP.page }}>
      {/* Status bar */}
      <div style={{ position: 'absolute', top: 18, left: 34, fontFamily: SANS, fontWeight: 700, fontSize: 15, color: APP.ink }}>9:41</div>
      <div style={{ position: 'absolute', top: 21, right: 30, display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {[5, 7, 9, 11].map(h => <i key={h} style={{ width: 3, height: h, borderRadius: 1, background: APP.ink }} />)}
        </div>
        <div style={{ width: 24, height: 11, borderRadius: 3, border: '1.2px solid rgba(255,255,255,0.5)', padding: 1.5 }}>
          <div style={{ width: '78%', height: '100%', borderRadius: 1.5, background: APP.ink }} />
        </div>
      </div>
      <Capsule tab="Today" />

      {/* PageHeader */}
      <div style={{ position: 'absolute', top: 120, left: 20 }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 32, letterSpacing: '-0.025em', color: APP.ink }}>Today</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 13, color: APP.z500, marginTop: 2 }}>Friday · day 46 of your streak</div>
      </div>

      {/* The stopwatch card */}
      <div
        style={{
          position: 'absolute',
          top: 196,
          left: 16,
          right: 16,
          height: 372,
          borderRadius: 12,
          overflow: 'hidden',
          background: APP.card,
          border: `1px solid ${on > 0.5 ? `${BLUE}66` : APP.edge}`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(95% 75% at 50% 0%, ${BLUE}${on > 0.5 ? '3d' : '1f'}, transparent 72%)`,
          }}
        />
        {on > 0 && (
          <>
            <div style={{ position: 'absolute', top: 20, right: 20, width: 8, height: 8, borderRadius: 4, background: APP.accent, opacity: on }} />
            <div style={{ position: 'absolute', top: 20, right: 20, width: 8, height: 8, borderRadius: 4, background: APP.accent, opacity: on * (1 - ping), scale: String(1 + ping * 1.6) }} />
          </>
        )}
        <div style={{ position: 'relative', paddingTop: 40 }}>
          <Eyebrow style={{ display: 'flex', justifyContent: 'center' }}>{on > 0.5 ? 'Focused on Physics' : 'Pick a subject, then start'}</Eyebrow>
          <div style={{ marginTop: 26, fontFamily: SANS, fontWeight: 700, fontSize: 66, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: APP.ink, lineHeight: 1 }}>
            {clock(secs)}
          </div>

          {/* Before: the subjects and Start. */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 172, opacity: 1 - on, translate: `0 ${on * -8}px` }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {(['Physics', 'Chemistry', 'Maths'] as Subject[]).map(sub => {
                const sel = sub === 'Physics';
                const dot = SUBJECT_COLORS[sub].dot;
                return (
                  <span
                    key={sub}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 13px',
                      borderRadius: 999,
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: 11,
                      color: sel ? APP.ink : APP.z400,
                      background: sel ? `${dot}26` : 'rgba(255,255,255,0.04)',
                      boxShadow: `inset 0 0 0 1px ${sel ? `${dot}88` : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <i style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />
                    {sub}
                  </span>
                );
              })}
            </div>
            <div
              style={{
                margin: '26px 22px 0',
                height: 54,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: APP.accent,
                boxShadow: '0 10px 30px -10px rgba(225,6,0,0.6)',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: '#fff',
                scale: String(press),
              }}
            >
              Start session
            </div>
          </div>

          {/* During: focus quality, Pause and End. */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 168, opacity: on, translate: `0 ${(1 - on) * 10}px` }}>
            <Eyebrow style={{ display: 'flex', justifyContent: 'center' }}>Focus quality</Eyebrow>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <span
                  key={v}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 12,
                    color: v <= 4 ? '#fff' : APP.z500,
                    background: v <= 4 ? APP.accent : 'rgba(255,255,255,0.05)',
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, margin: '24px 22px 0' }}>
              <div style={{ flex: 1, height: 50, borderRadius: 12, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)', fontFamily: SANS, fontWeight: 700, fontSize: 11, letterSpacing: '0.3em', color: APP.z300 }}>
                PAUSE
              </div>
              <div style={{ flex: 1, height: 50, borderRadius: 12, display: 'grid', placeItems: 'center', background: APP.accent, fontFamily: SANS, fontWeight: 700, fontSize: 11, letterSpacing: '0.3em', color: '#fff' }}>
                END
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The board */}
      <div style={{ position: 'absolute', top: top - 24, left: 20, right: 20, display: 'flex', justifyContent: 'space-between' }}>
        <Eyebrow>Focus tasks</Eyebrow>
        <Eyebrow color={APP.z600}>{dropped ? '2 open' : '3 open'}</Eyebrow>
      </div>
      {[
        ['Todo', 2],
        ['Doing', dropped ? 0 : 1],
        ['Done', dropped ? 3 : 2],
      ].map(([label, n], i) => (
        <div key={label as string} style={{ position: 'absolute', top: top + 4, left: colX(i), width: COL_W, height: 196, borderRadius: 10, background: APP.inset, boxShadow: `inset 0 0 0 1px ${APP.edge}` }}>
          <Eyebrow size={9} color={APP.z500} style={{ padding: '9px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <span style={{ color: APP.z600 }}>{n}</span>
          </Eyebrow>
        </div>
      ))}
      <Card subject="Chemistry" text="NCERT exemplar 1–20" style={{ top: top + 34, left: colX(0) }} />
      <Card subject="Maths" text="PYQ set 4" style={{ top: top + 34 + CARD_H + 6, left: colX(0) }} />
      <Card subject="Chemistry" text="Ionic equilibrium recap" done={1} style={{ top: top + 34 + shift * (CARD_H + 6), left: colX(2) }} />
      <Card subject="Maths" text="Binomial formulas" done={1} style={{ top: top + 34 + CARD_H + 6 + shift * (CARD_H + 6), left: colX(2), opacity: 0.45 * (1 - shift) }} />
      {/* Done keeps the latest two and folds the rest away (board.ts, DONE_VISIBLE). */}
      <Eyebrow size={9} color={APP.z600} style={{ position: 'absolute', top: top + 34 + 2 * (CARD_H + 6) + 4, left: colX(2), width: COL_W, textAlign: 'center', opacity: doneFade }}>+1 earlier</Eyebrow>
      {/* The one that moves. */}
      <Card
        subject="Physics"
        text="Laws of motion DPP 3"
        done={doneFade}
        style={{
          top: top + 34 - lift * 8,
          left: colX(1) + move * (COL_W + GAP),
          scale: String(1 + lift * 0.08),
          rotate: `${Math.sin(move * Math.PI) * 4}deg`,
          boxShadow: `0 ${lift * 22}px ${lift * 34}px -10px rgba(0,0,0,${0.7 * lift})`,
          zIndex: 10,
        }}
      />
      <Touch
        x={colX(1) + COL_W / 2 + move * (COL_W + GAP)}
        y={top + 34 + CARD_H / 2 - lift * 8}
        on={tw(f, [AT.todayLift - 4, AT.todayLift], [0, 1]) * (1 - tw(f, [AT.todayDrop, AT.todayDrop + 6], [0, 1]))}
      />
    </AbsoluteFill>
  );
};

export const Today: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useRise(0);
  const c = CAPTIONS.today;
  const focus = tw(f, [AT.todayLift - 16, AT.todayDrop], [0, 1], IN_OUT);
  return (
    <Shot dur={SCENES.today.dur} push={[1, 1.03]}>
      <Glow color={BLUE} x={1290} y={520} size={1200} opacity={0.12 + tw(f, [AT.todayStart, AT.todayStart + 20], [0, 0.16])} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={6} style={{ position: 'absolute', left: 170, top: 400, width: 700 }} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: 'absolute',
            left: 1080,
            top: 104,
            transformOrigin: '50% 80%',
            translate: `0 ${(1 - rise) * 220 - focus * 40}px`,
            rotate: `${(1 - rise) * 4}deg`,
            transform: `rotateY(${-22 + rise * 10 + focus * 6}deg) rotateX(${8 - rise * 4}deg)`,
            scale: String(1 + focus * 0.1),
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          <Phone>
            <TodayScreen f={f} />
          </Phone>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
