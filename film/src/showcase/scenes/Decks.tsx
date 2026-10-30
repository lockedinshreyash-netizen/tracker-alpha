import type React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { RATING_RAMP, STATE_COLOR, deckAccent, room } from '../../../../decks/theme';
import { Caption, Eyebrow, Shot, useRise } from '../kit';
import { APP, IN_OUT, SANS, pop, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

const R = room(true);
const ACCENT = deckAccent('Physics', true);
const RAMP = RATING_RAMP(true);
const STATES = STATE_COLOR(true);

/** The review room's card: one fill-the-blank, its answer landing on a ruled slot. */
const CardFace: React.FC<{ f: number }> = ({ f }) => {
  const shown = tw(f, [AT.deckReveal, AT.deckReveal + 8], [0, 1]);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '46px 56px', display: 'flex', flexDirection: 'column' }}>
      <Eyebrow color={ACCENT} size={11}>Work, Energy & Power</Eyebrow>
      <div style={{ marginTop: 34, fontFamily: SANS, fontWeight: 500, fontSize: 40, lineHeight: 1.32, color: R.ink, letterSpacing: '-0.01em' }}>
        A body of mass <i>m</i> moving at <i>v</i> has
        <br />
        kinetic energy{' '}
        <span style={{ position: 'relative', display: 'inline-block', width: 170, height: 50, verticalAlign: 'baseline' }}>
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -4,
              height: 2.5,
              borderRadius: 2,
              background: shown > 0.5 ? ACCENT : 'rgba(255,255,255,0.22)',
              boxShadow: shown > 0.5 ? `0 0 14px ${ACCENT}` : 'none',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 2,
              textAlign: 'center',
              fontWeight: 700,
              color: R.ink,
              opacity: shown,
              translate: `0 ${(1 - shown) * -18}px`,
            }}
          >
            ½<i>mv</i>
            <sup style={{ fontSize: '0.6em' }}>2</sup>
          </span>
        </span>
        .
      </div>
    </div>
  );
};

export const Decks: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = useRise(0);
  const c = CAPTIONS.decks;
  const revealed = f >= AT.deckReveal;
  const good = AT.deckGood;
  const press = f >= good - 2 && f < good + 5 ? tw(f, [good - 2, good], [1, 0.92]) : 1;
  const away = tw(f, [good + 4, good + 18], [0, 1], IN_OUT);
  const chip = pop(f, good, fps, 16, 140);
  const chipFade = tw(f, [good + 14, good + 22], [1, 0]);
  const docks = tw(f, [AT.deckReveal, AT.deckReveal + 8], [0, 1]);

  const cardW = 780;
  const cardH = 320;
  const left = 960 - cardW / 2;
  const top = 400;
  return (
    <Shot dur={SCENES.decks.dur} push={[1, 1.04]}>
      {/* The deck's colour as light from above. */}
      <AbsoluteFill style={{ background: `radial-gradient(48% 50% at 50% 18%, ${ACCENT}33, transparent 70%)` }} />
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={88} align="center" style={{ position: 'absolute', left: 0, right: 0, top: 64 }} />

      <div style={{ position: 'absolute', left, top: top - 46, width: cardW, display: 'flex', justifyContent: 'space-between', opacity: tw(f, [4, 12], [0, 1]) }}>
        <Eyebrow size={12} color={APP.z400}>Physics · essentials</Eyebrow>
        <div style={{ display: 'flex', gap: 16, fontFamily: SANS, fontWeight: 700, fontSize: 13 }}>
          {[
            [8, 'new', STATES.new],
            [3, 'learning', STATES.learning],
            [41 - (f >= good ? 1 : 0), 'due', STATES.due],
          ].map(([n, w, col]) => (
            <span key={w as string} style={{ color: APP.z500 }}>
              <span style={{ color: col as string, fontVariantNumeric: 'tabular-nums' }}>{n}</span> {w}
            </span>
          ))}
        </div>
      </div>

      <AbsoluteFill style={{ perspective: 2000 }}>
        {/* The rest of the deck, stacked under the card on the desk. */}
        {[2, 1].map(k => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left,
              top: top + k * 16 - away * 16,
              width: cardW,
              height: cardH,
              borderRadius: 26,
              background: k === 2 ? R.layer2 : R.layer,
              boxShadow: R.layerShadow,
              scale: String(1 - k * 0.045 + away * 0.045),
              opacity: tw(f, [0, 10], [0, 1]),
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width: cardW,
            height: cardH,
            borderRadius: 26,
            background: R.card,
            boxShadow: R.cardShadow,
            overflow: 'hidden',
            translate: `${-away * 1100}px ${(1 - rise) * 160}px`,
            rotate: `${-away * 9}deg`,
            transform: `rotateX(${(1 - rise) * 18}deg)`,
            opacity: tw(f, [0, 8], [0, 1]) * (1 - away * 0.4),
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: ACCENT, opacity: 0.85 }} />
          <CardFace f={f} />
        </div>
      </AbsoluteFill>

      {/* The dock: Show answer, then the four ratings with their next intervals. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: top + cardH + 64, display: 'flex', justifyContent: 'center' }}>
        {!revealed ? (
          <div
            style={{
              padding: '18px 44px',
              borderRadius: 14,
              background: R.ink,
              color: '#09090b',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              opacity: tw(f, [6, 14], [0, 1]),
              scale: String(tw(f, [AT.deckReveal - 3, AT.deckReveal], [1, 0.95])),
            }}
          >
            Show answer
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {(
              [
                [1, 'Again', '<1m'],
                [2, 'Hard', '6m'],
                [3, 'Good', '4d'],
                [4, 'Easy', '9d'],
              ] as const
            ).map(([r, label, next], i) => (
              <div
                key={label}
                style={{
                  position: 'relative',
                  width: 150,
                  padding: '14px 0',
                  borderRadius: 14,
                  textAlign: 'center',
                  background: RAMP[r],
                  color: r === 4 ? '#0b1a2e' : '#fff',
                  opacity: tw(f, [AT.deckReveal + i * 2, AT.deckReveal + 6 + i * 2], [0, 1]) * (r === 3 ? 1 : 1 - away * 0.5),
                  translate: `0 ${tw(f, [AT.deckReveal + i * 2, AT.deckReveal + 10 + i * 2], [14, 0])}px`,
                  scale: String(r === 3 ? press : docks),
                }}
              >
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 15 }}>{label}</div>
                <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 12, opacity: 0.75, marginTop: 3 }}>{next}</div>
                {r === 3 && f >= good && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -18,
                      translate: `-50% ${-chip * 56}px`,
                      whiteSpace: 'nowrap',
                      padding: '9px 16px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.1)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: 14,
                      color: APP.ink,
                      opacity: Math.min(1, chip) * chipFade,
                    }}
                  >
                    Good · next in 4d
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shot>
  );
};
