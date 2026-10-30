import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ACTIVITIES, ACTIVITY_BASE, SUBJECT_COLORS, derive, type BlockStyle } from '../../../../schedule/colors';
import { ALPHA_FACE, APP, IN_OUT, SANS, tw } from '../look';
import { Caption, Eyebrow, Glow, Laptop, Pointer, Shot, useRise } from '../kit';
import { AT, CAPTIONS, SCENES } from '../timeline';

/* The grid from 2 PM to 10 PM. Minutes here are minutes after 2 PM. */
const PX = 58 / 60;
const GRID_TOP = 18;
const y = (min: number) => GRID_TOP + min * PX;

/** schedule.ts's formatRange: the meridiem written once when both ends share it. */
const clockOf = (min: number) => {
  const h24 = 14 + Math.floor(min / 60);
  const m = Math.round(min % 60);
  const h = ((h24 + 11) % 12) + 1;
  return { text: `${h}:${String(m).padStart(2, '0')}`, pm: h24 >= 12 && h24 < 24 };
};
const range = (a: number, b: number) => {
  const s = clockOf(a);
  const e = clockOf(b);
  return s.pm === e.pm ? `${s.text} – ${e.text} ${e.pm ? 'PM' : 'AM'}` : `${s.text} ${s.pm ? 'PM' : 'AM'} – ${e.text} ${e.pm ? 'PM' : 'AM'}`;
};

const Block: React.FC<{ st: BlockStyle; kind: string; title: string; start: number; mins: number; style?: React.CSSProperties }> = ({ st, kind, title, start, mins, style }) => (
  <div
    style={{
      position: 'absolute',
      left: 64,
      right: 14,
      top: y(start) + 1,
      height: mins * PX - 3,
      borderRadius: 8,
      background: st.bg,
      border: `1px solid ${st.border}`,
      overflow: 'hidden',
      ...style,
    }}
  >
    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.dot }} />
    <div style={{ padding: '7px 12px 0 14px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <Eyebrow size={9} color={st.text}>{kind}</Eyebrow>
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: APP.ink }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontFamily: SANS, fontWeight: 500, fontSize: 11, color: st.text, fontVariantNumeric: 'tabular-nums' }}>{range(start, start + mins)}</span>
    </div>
  </div>
);

const PlanScreen: React.FC<{ f: number }> = ({ f }) => {
  const move = tw(f, [AT.planGrab + 1, AT.planDrop], [0, 1], IN_OUT);
  const lift = tw(f, [AT.planGrab, AT.planGrab + 4], [0, 1]) * (1 - tw(f, [AT.planDrop, AT.planDrop + 6], [0, 1]));
  // The block snaps to quarter hours as it moves, as the grid does.
  const from = 390;
  const to = 255;
  const start = Math.round((from + (to - from) * move) / 15) * 15;
  const live = from + (to - from) * move;

  const days = ['Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31', 'Sun 1'];
  const cardTop = 206;
  const blockCentreY = cardTop + y(live) + 40;
  const px = f < AT.planGrab ? tw(f, [0, AT.planGrab - 2], [1000, 500]) : 500;
  const py = f < AT.planGrab ? tw(f, [0, AT.planGrab - 2], [700, cardTop + y(from) + 30]) : blockCentreY - 10;
  const down = tw(f, [AT.planGrab - 2, AT.planGrab], [0, 1]) * (1 - tw(f, [AT.planDrop, AT.planDrop + 3], [0, 1]));

  return (
    <AbsoluteFill style={{ background: APP.page }}>
      {/* The rail, collapsed: liquid glass with the α and the tabs as glyphs. */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          bottom: 8,
          width: 58,
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 18,
          gap: 18,
        }}
      >
        <span style={{ fontFamily: ALPHA_FACE, fontSize: 26, color: APP.ink, marginBottom: 8 }}>α</span>
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <span key={i} style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: i === 1 ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
            <i style={{ width: 16, height: 16, borderRadius: i % 2 ? 4 : 8, border: `1.6px solid ${i === 1 ? APP.ink : APP.z600}` }} />
          </span>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 96, top: 34, right: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 36, letterSpacing: '-0.025em', color: APP.ink, lineHeight: 1 }}>Plan</div>
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 14, color: APP.z500, marginTop: 8 }}>Friday · 4h 30m of study planned</div>
          </div>
          <div style={{ padding: '11px 18px', borderRadius: 10, background: APP.accent, fontFamily: SANS, fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', color: '#fff', boxShadow: '0 8px 24px -10px rgba(225,6,0,0.6)' }}>
            + ADD BLOCK
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 26 }}>
          {days.map((d, i) => {
            const [w, n] = d.split(' ');
            const sel = i === 4;
            return (
              <div
                key={d}
                style={{
                  width: 74,
                  height: 62,
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  background: sel ? APP.ink : APP.card,
                  boxShadow: sel ? 'none' : `inset 0 0 0 1px ${APP.edge}`,
                }}
              >
                <Eyebrow size={9} color={sel ? APP.z600 : APP.z500}>{w}</Eyebrow>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 19, color: sel ? '#09090b' : APP.z300 }}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* The day */}
      <div style={{ position: 'absolute', left: 96, top: cardTop, width: 760, height: 500, borderRadius: 12, background: APP.card, boxShadow: `inset 0 0 0 1px ${APP.edge}`, overflow: 'hidden' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y(i * 60) }}>
            <div style={{ position: 'absolute', left: 56, right: 0, top: 0, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ position: 'absolute', left: 14, top: -7, fontFamily: SANS, fontWeight: 500, fontSize: 10.5, color: APP.z600 }}>{((13 + i) % 12) + 1} PM</span>
          </div>
        ))}
        <Block st={derive(ACTIVITY_BASE.class)} kind={ACTIVITIES.class.label} title="Coaching" start={0} mins={120} />
        <Block st={SUBJECT_COLORS.Chemistry} kind="Study" title="Equilibrium" start={150} mins={90} />
        <Block st={derive(ACTIVITY_BASE.meal)} kind={ACTIVITIES.meal.label} title="Dinner" start={360} mins={30} />
        {/* The now-line */}
        <div style={{ position: 'absolute', left: 56, right: 0, top: y(190), height: 2, background: APP.accent, boxShadow: '0 0 12px rgba(225,6,0,0.6)' }} />
        <div style={{ position: 'absolute', left: 51, top: y(190) - 4, width: 10, height: 10, borderRadius: 5, background: APP.accent }} />
        {/* The block being moved. Its ghost stays where it was until it is let go. */}
        {f >= AT.planGrab && f < AT.planDrop && (
          <div style={{ position: 'absolute', left: 64, right: 14, top: y(from) + 1, height: 90 * PX - 3, borderRadius: 8, border: '1.5px dashed rgba(74,144,226,0.35)' }} />
        )}
        <Block
          st={SUBJECT_COLORS.Physics}
          kind="Study"
          title="Laws of Motion"
          start={start}
          mins={90}
          style={{
            top: y(live) + 1 - lift * 4,
            scale: String(1 + lift * 0.025),
            boxShadow: `0 ${lift * 26}px ${lift * 40}px -14px rgba(0,0,0,${0.85 * lift})`,
            zIndex: 5,
          }}
        />
      </div>

      {/* Beside the day: what it adds up to. */}
      <div style={{ position: 'absolute', left: 876, top: cardTop, right: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          ['Study planned', '4h 30m'],
          ['Done so far', '1h 25m'],
          ['Next up', f >= AT.planDrop ? '6:15 PM' : '8:30 PM'],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: '18px 20px', borderRadius: 12, background: APP.card, boxShadow: `inset 0 0 0 1px ${APP.edge}` }}>
            <Eyebrow>{k}</Eyebrow>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 28, letterSpacing: '-0.02em', color: APP.ink, marginTop: 8 }}>{v}</div>
          </div>
        ))}
      </div>

      <Pointer x={px} y={py} down={down} />
    </AbsoluteFill>
  );
};

export const Plan: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useRise(0);
  const c = CAPTIONS.plan;
  return (
    <Shot dur={SCENES.plan.dur} push={[1, 1.06]} origin="45% 75%">
      <Glow color={SUBJECT_COLORS.Physics.dot} x={960} y={720} size={1500} opacity={0.12} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={92} align="center" style={{ position: 'absolute', left: 0, right: 0, top: 64 }} />
      <AbsoluteFill style={{ perspective: 2600 }}>
        <div
          style={{
            position: 'absolute',
            left: 960 - 618,
            top: 226,
            transformOrigin: '50% 100%',
            scale: '0.86',
            translate: `0 ${(1 - rise) * 160}px`,
            transform: `rotateX(${16 - rise * 10}deg)`,
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          <Laptop>
            <PlanScreen f={f} />
          </Laptop>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
