import type React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { geometry } from '../../../../decks/store/geometry';
import { deckAccent, room } from '../../../../decks/theme';
import { Caption, Eyebrow, Glow, Shot } from '../kit';
import { APP, IN_OUT, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

/* The pack is decks/store/PackCard.tsx in the ink finish, drawn from the same
   die-cut (geometry.ts, seeded by the pack number so it tears the same way
   the app tears it). The opening follows PackOpeningAnimation's order: lift,
   tear from the slot down and along the perforation, the flap folds away,
   three real decks rise and fan. */
const W = 300;
const H = 430;
const G = geometry(W, H, 7);
const k = W / 198;
const SKIN = { top: '#1a1a1e', bottom: '#09090b', ink: '#FAFAFA', muted: '#8f8f98', rule: 'rgba(255,255,255,0.12)', edge: 'rgba(255,255,255,0.22)', perf: 'rgba(255,255,255,0.28)', ring: 'rgba(255,255,255,0.22)', fiber: '#d9d4c9', crack: '#e9e4d8' };
const ACCENT = deckAccent('Physics', true);
const R = room(true);

const BARS = (() => {
  let a = (7 * 9301 + 49297) % 233280;
  return Array.from({ length: 15 }, () => {
    a = (a * 9301 + 49297) % 233280;
    return 1 + Math.floor((a / 233280) * 3);
  });
})();

const DECKS = [
  { name: 'Kinematics', cards: 96 },
  { name: 'Laws of Motion', cards: 112 },
  { name: 'Gravitation', cards: 104 },
];

const Inside: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {DECKS.map((d, i) => {
        const p = pop(f, AT.packReveal + i * 3, fps, 15, 120);
        const side = i - 1;
        return (
          <div
            key={d.name}
            style={{
              position: 'absolute',
              left: W / 2 - 85,
              top: G.perf + 30,
              width: 170,
              height: 232,
              borderRadius: 14,
              background: R.card,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 30px 50px -20px rgba(0,0,0,0.8)',
              overflow: 'hidden',
              translate: `${side * 172 * p}px ${-p * (250 - Math.abs(side) * 30)}px`,
              rotate: `${side * 13 * p}deg`,
              zIndex: i === 1 ? 2 : 1,
            }}
          >
            <div style={{ height: 3, background: ACCENT }} />
            <div style={{ padding: '18px 18px' }}>
              <Eyebrow size={9} color={ACCENT}>Physics</Eyebrow>
              <div style={{ marginTop: 10, fontFamily: SANS, fontWeight: 900, fontSize: 22, lineHeight: 1, letterSpacing: '-0.01em', color: R.ink, textTransform: 'uppercase' }}>{d.name}</div>
              <div style={{ position: 'absolute', left: 18, bottom: 16, fontFamily: SANS, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', color: APP.z500 }}>{d.cards} CARDS</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

export const Pack: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = CAPTIONS.pack;

  const hang = pop(f, -4, fps, 9, 90);
  const sway = Math.sin(f / 5) * 3 * Math.exp(-f / 14);
  const lift = tw(f, [AT.packLift, AT.packLift + 10], [0, 1], IN_OUT);
  const down = tw(f, [AT.packTear, AT.packTear + 5], [1, 0]);
  const side = tw(f, [AT.packTear + 4, AT.packTear + 11], [1, 0]);
  const flap = tw(f, [AT.packTear + 11, AT.packTear + 24], [0, 1], IN_OUT);
  const fall = tw(f, [AT.packAdded - 12, AT.packAdded + 2], [0, 1], IN_OUT);
  const added = pop(f, AT.packAdded, fps, 16, 160);
  const torn = f >= AT.packTear + 11;

  const fs = 23 * k * 0.92;
  return (
    <Shot dur={SCENES.pack.dur} push={[1, 1.035]}>
      {/* A spot from above, onto the pack. */}
      <AbsoluteFill style={{ background: 'radial-gradient(28% 70% at 64% 0%, rgba(236,230,218,0.11), transparent 70%)' }} />
      <Glow color={ACCENT} x={1230} y={600} size={1000} opacity={0.08 + flap * 0.14} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={104} style={{ position: 'absolute', left: 170, top: 420, width: 640 }} />

      {/* The rail and the hook stay on the wall. */}
      <div style={{ position: 'absolute', left: 1000, top: 150, width: 460, height: 10, borderRadius: 5, background: 'linear-gradient(180deg, #6b6b72, #2b2b30)', boxShadow: '0 8px 16px -6px rgba(0,0,0,0.8)' }} />
      <div style={{ position: 'absolute', left: 1230 - 3, top: 158, width: 6, height: 50, borderRadius: 3, background: 'linear-gradient(90deg, #8a8a92, #3a3a40)' }} />

      <div
        style={{
          position: 'absolute',
          left: 1230 - W / 2,
          top: 200 - G.pivot.y,
          width: W,
          height: H,
          transformOrigin: `${G.pivot.x}px ${G.pivot.y}px`,
          translate: `0 ${(1 - hang) * -520 + lift * 250}px`,
          rotate: `${sway * (1 - lift)}deg`,
          scale: String(1 + lift * 0.22),
        }}
      >
        {/* Shadow on the wall. */}
        <div style={{ position: 'absolute', left: 12 * k, right: 12 * k, top: G.perf + 10, bottom: 6, borderRadius: 18 * k, background: '#000', filter: `blur(${14 + lift * 20}px)`, translate: `0 ${lift * 30}px`, opacity: 0.9 * (1 - fall) }} />
        {/* The decks inside, under the body. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {f >= AT.packReveal - 2 && <Inside f={f} />}
        </div>
        {/* Body */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, translate: `0 ${fall * 260}px`, opacity: 1 - fall }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="pk-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SKIN.top} /><stop offset="1" stopColor={SKIN.bottom} /></linearGradient>
              <linearGradient id="pk-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.07} /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /></linearGradient>
            </defs>
            <path d={G.bodyPath} fill="url(#pk-f)" />
            <path d={G.bodyPath} fill="url(#pk-s)" />
            <path d={G.bodyPath} fill="none" stroke={SKIN.edge} strokeWidth="1" opacity="0.8" />
            <path d={G.edge.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y + 0.6}`).join(' ')} fill="none" stroke={SKIN.fiber} strokeWidth={1.6} strokeLinejoin="round" opacity={torn ? 1 : 0} />
          </svg>
          <div style={{ position: 'absolute', left: 15 * k, right: 15 * k, top: G.perf + 12 * k, bottom: 13 * k, color: SKIN.ink, fontFamily: SANS }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5 * k, letterSpacing: '0.2em', fontWeight: 900 }}>ALPHA</span>
              <span style={{ fontSize: 9 * k, letterSpacing: '0.14em', fontWeight: 700, color: SKIN.muted }}>PACK 007</span>
            </div>
            <div style={{ marginTop: 13 * k, width: 22 * k, height: 3 * k, borderRadius: 2, background: ACCENT }} />
            <p style={{ margin: `${9 * k}px 0 0`, fontSize: fs, lineHeight: 0.98, letterSpacing: '-0.005em', fontWeight: 900 }}>PHYSICS ESSENTIALS</p>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <p style={{ margin: 0, fontSize: 10 * k, letterSpacing: '0.14em', fontWeight: 900 }}>312 CARDS</p>
              <p style={{ margin: `${3 * k}px 0 0`, fontSize: 9 * k, letterSpacing: '0.12em', fontWeight: 700, color: SKIN.muted }}>JEE MAIN · ADVANCED</p>
              <div style={{ height: 1, background: SKIN.rule, margin: `${9 * k}px 0 ${8 * k}px` }} />
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11 * k, letterSpacing: '0.2em', fontWeight: 900 }}>3 DECKS</span>
                <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 16 * k, opacity: 0.55 }}>
                  {BARS.map((b, i) => <span key={i} style={{ width: b * 0.75 * k, height: i % 5 === 0 ? '100%' : '82%', background: SKIN.ink }} />)}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Flap: the hang tab and the strip above the perforation. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: G.perf + 3,
            zIndex: 2,
            transformOrigin: `0px ${G.perf}px`,
            rotate: `${-flap * 32}deg`,
            translate: `${-flap * 160}px ${-flap * 220}px`,
            opacity: 1 - tw(f, [AT.packTear + 18, AT.packTear + 26], [0, 1]),
          }}
        >
          <svg width={W} height={G.perf + 3} viewBox={`0 0 ${W} ${G.perf + 3}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <path d={G.flapPath} fill="url(#pk-f)" fillRule="evenodd" />
            <path d={G.flapPath} fill="url(#pk-s)" fillRule="evenodd" />
            <path d={G.holePath} fill="none" stroke={SKIN.ring} strokeWidth={2.4 * k} />
            <line x1={7 * k} x2={W - 7 * k} y1={G.perf} y2={G.perf} stroke={SKIN.perf} strokeWidth={1.1} strokeDasharray={`${2.2 * k} ${2.6 * k}`} strokeLinecap="round" />
            <text x={W - 9 * k} y={G.perf - 4 * k} textAnchor="end" fontSize={6.5 * k} fontWeight="800" letterSpacing={0.9 * k} fill={SKIN.muted} style={{ fontFamily: SANS }}>TEAR TO OPEN</text>
            <path d={G.crackDown} fill="none" stroke={SKIN.crack} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={G.crackLen.down} strokeDashoffset={G.crackLen.down * down} />
            <path d={G.crackLeft} fill="none" stroke={SKIN.crack} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={G.crackLen.side} strokeDashoffset={G.crackLen.side * side} />
            <path d={G.crackRight} fill="none" stroke={SKIN.crack} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={G.crackLen.side} strokeDashoffset={G.crackLen.side * side} />
          </svg>
        </div>
        {/* The hook's ball tip, over the pack while it hangs. */}
        <div style={{ position: 'absolute', left: G.pivot.x - 7, top: G.pivot.y - 9, width: 14, height: 14, borderRadius: 7, zIndex: 3, background: 'radial-gradient(circle at 35% 30%, #d4d4d8, #52525b 70%)', opacity: 1 - tw(f, [AT.packLift, AT.packLift + 4], [0, 1]) }} />
      </div>

      {/* ✓ ADDED TO ALPHA */}
      <div
        style={{
          position: 'absolute',
          left: 1230 - 200,
          width: 400,
          top: 680,
          textAlign: 'center',
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: '0.24em',
          color: APP.ink,
          opacity: Math.min(1, added),
          translate: `0 ${(1 - Math.min(1, added)) * 20}px`,
        }}
      >
        ✓ ADDED TO ALPHA
      </div>
    </Shot>
  );
};
