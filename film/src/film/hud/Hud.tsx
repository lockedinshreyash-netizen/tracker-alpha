/**
 * The broadcast layer. Four numbers, a strip of the year, and only the
 * captions the data earns. Hidden while the title runs; gone after the stop.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { AbsoluteFill, interpolate } from 'remotion';
import { REWARDS } from '../../../../rewards/catalog';
import { DAYS, YEAR, type Subject3 } from '../../score/year';
import { PRE_ROLL, TIMELINE, eventsOf, type FilmEvent } from '../../score/timeline';
import type { CameraState } from '../edit';
import { SANS } from '../fonts';
import { ACCENT, DAY_ANGLE, FAINT, GHOST, INK, MUTED, R, SUBJECT_HEX } from '../look';
import type { FrameState } from '../state';

const EYEBROW: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#A1A1AA',
};
const NUM: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
  color: INK,
  lineHeight: 1,
};

const STRIP_X = 96;
const STRIP_W = 1728;
const STRIP_Y = 1080 - 78;
const CELL = STRIP_W / DAYS;

/** Dominant subject per day, or null for a missed day. */
const DAY_COLOR: (string | null)[] = YEAR.map(y => {
  if (!y.logs.length) return null;
  if (y.logs.every(l => l.source === 'manual')) return '#52525B';
  const top = [...y.logs].sort((a, b) => b.hours - a.hours)[0];
  return SUBJECT_HEX[top.subject];
});

const mocks = eventsOf('mock');
const chips = TIMELINE.events.filter(e => e.type === 'newBest' || e.type === 'reward' || (e.type === 'crash' && e.stall));
const captions = eventsOf('note');

const rewardTitle = (id: 'wallpaper' | 'book') => REWARDS.find(r => r.kind === id)?.title ?? id;

const chipFor = (e: FilmEvent): { label: string; detail: string; tone: string } => {
  if (e.type === 'newBest') return { label: 'New best', detail: `${e.s} days`, tone: GHOST };
  if (e.type === 'reward') return { label: 'Unlocked', detail: rewardTitle(e.reward), tone: GHOST };
  if (e.type === 'crash') return { label: 'Streak broken', detail: `${e.s} days`, tone: ACCENT };
  return { label: '', detail: '', tone: INK };
};

const projector = new THREE.PerspectiveCamera();
const project = (cam: CameraState, p: THREE.Vector3): { x: number; y: number; ok: boolean } => {
  projector.position.set(...cam.pos);
  projector.up.set(...cam.up);
  projector.lookAt(...cam.target);
  projector.fov = cam.fov;
  projector.aspect = 1920 / 1080;
  projector.near = 0.03;
  projector.far = 400;
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld();
  const v = p.clone().project(projector);
  return { x: (v.x * 0.5 + 0.5) * 1920, y: (-v.y * 0.5 + 0.5) * 1080, ok: v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9 };
};

export const Hud: React.FC<{ s: FrameState; cam: CameraState }> = ({ s, cam }) => {
  const { frame, step } = s;
  const { titleIn, ignition, examFrame } = TIMELINE;

  const visible =
    frame < PRE_ROLL
      ? 0
      : frame >= titleIn && frame < ignition
        ? 0
        : frame >= examFrame
          ? Math.max(0, 1 - (frame - examFrame) / 24)
          : Math.min(1, (frame - PRE_ROLL + 1) / 6);

  const best = Math.max(step.best, step.s);
  const dayN = Math.min(DAYS, Math.max(1, Math.floor(s.dayPos) + 1));

  const chapters = useMemo(() => {
    const out: Partial<Record<Subject3, string>> = {};
    for (const n of TIMELINE.notes) {
      if (n.frame > s.sceneFrame) break;
      out[n.subject] = n.chapter;
    }
    return out;
  }, [s.sceneFrame]);

  if (visible <= 0) return null;

  const chip = [...chips].reverse().find(e => frame >= e.frame && frame < e.frame + 130);
  const caption = captions.find(e => frame >= e.frame && frame < e.frame + 150);
  const legend = interpolate(frame, [PRE_ROLL, PRE_ROLL + 20, 900, 960], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // The ghost's label, pinned above its bar in the picture.
  const gs = s.gates.find(g => g.opacity > 0.05 && !g.gate.passed) ?? s.gates.find(g => g.opacity > 0.05);
  let gateLabel: { x: number; y: number; text: string; gap: number; o: number } | null = null;
  if (gs) {
    const a = (gs.gate.d + 0.5 - s.dayPos) * DAY_ANGLE;
    const p = project(cam, new THREE.Vector3(0, (R + 1.15) * Math.cos(a), -(R + 1.15) * Math.sin(a)));
    if (p.ok) gateLabel = { x: p.x, y: p.y, text: `Best ${gs.gate.best}`, gap: Math.max(0, Math.ceil(gs.gate.d - s.dayPos)), o: gs.opacity };
  }

  const pastMocks = mocks.filter(m => m.frame <= s.sceneFrame);
  const mockX = (d: number) => STRIP_X + (d + 0.5) * CELL;
  const mockY = (score: number) => STRIP_Y - 18 - ((score - 30) / 70) * 70;

  return (
    <AbsoluteFill style={{ opacity: visible, pointerEvents: 'none' }}>
      {/* Day, top left. */}
      <div style={{ position: 'absolute', left: 96, top: 80, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={EYEBROW}>Day</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ ...NUM, fontSize: 92, letterSpacing: '-0.03em' }}>{String(dayN).padStart(3, '0')}</span>
          <span style={{ ...NUM, fontSize: 30, fontWeight: 700, color: MUTED }}>/ 365</span>
        </div>
        <div style={{ display: 'flex', gap: 40, marginTop: 14 }}>
          <Stat label="Streak" value={step.s} tone={step.s > 0 ? INK : MUTED} />
          <Stat label="Best" value={best} tone={GHOST} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={EYEBROW}>Gear</div>
            <div style={{ display: 'flex', gap: 5, height: 36, alignItems: 'flex-end' }}>
              {[1, 2, 3, 4, 5, 6].map(g => (
                <div
                  key={g}
                  style={{
                    width: 9,
                    height: 12 + g * 4,
                    background: g <= step.gear ? (g === 6 ? ACCENT : INK) : FAINT,
                    opacity: g <= step.gear ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
          {(['Physics', 'Chemistry', 'Maths'] as Subject3[]).map(sub => (
            <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: chapters[sub] ? 1 : 0.35 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: SUBJECT_HEX[sub] }} />
              <div style={{ ...EYEBROW, fontSize: 13, letterSpacing: '0.1em', color: '#D4D4D8' }}>
                {sub}
                <span style={{ color: MUTED }}> · {chapters[sub] ?? 'not started'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend: what you are hearing. Only while it is still a question. */}
      {legend > 0 && (
        <div style={{ position: 'absolute', right: 96, top: 84, ...EYEBROW, opacity: legend, color: '#D4D4D8' }}>
          1 note = 1 day of study
        </div>
      )}

      {/* Event chip. */}
      {chip && <Chip e={chip} frame={frame} />}

      {/* Something the student wrote down that day. */}
      {caption && <Caption text={caption.text} frame={frame - caption.frame} />}

      {/* The ghost's name tag. */}
      {gateLabel && (
        <div
          style={{
            position: 'absolute',
            left: gateLabel.x,
            top: gateLabel.y - 48,
            translate: '-50% 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            opacity: gateLabel.o,
          }}
        >
          <div style={{ ...EYEBROW, color: GHOST, fontSize: 16 }}>{gateLabel.text}</div>
          <div style={{ ...EYEBROW, color: MUTED, fontSize: 12 }}>{gateLabel.gap} to go</div>
        </div>
      )}

      {/* The year so far. */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {DAY_COLOR.map((c, d) => {
          const lived = d < s.dayPos - 0.0001;
          return (
            <rect
              key={d}
              x={STRIP_X + d * CELL + 0.6}
              y={STRIP_Y}
              width={CELL - 1.2}
              height={14}
              fill={lived ? (c ?? '#1F1F24') : '#121216'}
              opacity={lived && c ? 0.95 : 1}
            />
          );
        })}
        {pastMocks.length > 1 && (
          <polyline
            points={pastMocks.map(m => `${mockX(m.d)},${mockY(m.score)}`).join(' ')}
            fill="none"
            stroke="rgba(244,244,245,0.55)"
            strokeWidth={1.5}
          />
        )}
        {pastMocks.map(m => {
          const x = mockX(m.d);
          const y = mockY(m.score);
          if (m.scope === 'chapter') return <rect key={m.d} x={x - 3.5} y={y - 3.5} width={7} height={7} fill={GHOST} transform={`rotate(45 ${x} ${y})`} />;
          if (m.scope === 'part') return <circle key={m.d} cx={x} cy={y} r={3.6} fill="#040405" stroke={GHOST} strokeWidth={1.5} />;
          return <circle key={m.d} cx={x} cy={y} r={4} fill={GHOST} />;
        })}
        {pastMocks.length > 0 && (
          <text
            x={mockX(pastMocks[pastMocks.length - 1].d) + 10}
            y={mockY(pastMocks[pastMocks.length - 1].score) + 5}
            fill={GHOST}
            style={{ font: `700 14px ${SANS}`, letterSpacing: '0.08em' }}
          >
            MOCK {pastMocks[pastMocks.length - 1].score}%
          </text>
        )}
        <rect x={STRIP_X + s.dayPos * CELL - 1} y={STRIP_Y - 8} width={2} height={30} fill={ACCENT} />
      </svg>
      <div style={{ position: 'absolute', left: STRIP_X, top: STRIP_Y + 24, ...EYEBROW, fontSize: 12, color: MUTED }}>The year so far</div>
      <div style={{ position: 'absolute', right: 96, top: STRIP_Y + 24, ...EYEBROW, fontSize: 12, color: MUTED }}>Exam day</div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={EYEBROW}>{label}</div>
    <div style={{ ...NUM, fontSize: 36, color: tone }}>{value}</div>
  </div>
);

const Chip: React.FC<{ e: FilmEvent; frame: number }> = ({ e, frame }) => {
  const { label, detail, tone } = chipFor(e);
  const t = frame - e.frame;
  const wipe = interpolate(t, [0, 9], [0, 100], { extrapolateRight: 'clamp' });
  const out = interpolate(t, [112, 130], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        right: 96,
        top: 80,
        display: 'flex',
        alignItems: 'stretch',
        clipPath: `inset(0 0 0 ${100 - wipe}%)`,
        opacity: out,
      }}
    >
      <div style={{ width: 6, background: tone }} />
      <div style={{ background: 'rgba(10,10,12,0.82)', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...EYEBROW, color: tone, fontSize: 16 }}>{label}</div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 40, color: INK, letterSpacing: '-0.01em' }}>{detail}</div>
      </div>
    </div>
  );
};

const Caption: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const shown = Math.min(text.length, Math.floor(frame / 1.6));
  const o = interpolate(frame, [0, 4, 130, 150], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 96, bottom: 140, display: 'flex', flexDirection: 'column', gap: 10, opacity: o }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 16 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: 3, height: 5 + 10 * Math.abs(Math.sin(frame * 0.5 + i * 1.3)) * (frame < 40 ? 1 : 0.2), background: '#D4D4D8' }} />
          ))}
        </div>
        <div style={EYEBROW}>Note to self</div>
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 40, color: INK, letterSpacing: '-0.005em' }}>
        {text.slice(0, shown)}
      </div>
    </div>
  );
};
