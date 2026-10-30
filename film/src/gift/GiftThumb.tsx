/* ── The picture a gift link shows ──
   What WhatsApp, iMessage and Telegram draw under a link to /gift/<code>
   (public/gift/index.html points its og:image here). It has to read as a gift
   from a real product at thumbnail size, so: one object, centred, the value
   large, the brand named. WhatsApp sometimes crops to a centred square, so
   everything that matters sits inside the middle 630px.

   The pass is the app's own (access/GiftPass.tsx + access.css), redrawn here
   in inline styles: the app's CSS is not part of this bundle. */

import { loadFont } from '@remotion/fonts';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { AbsoluteFill, staticFile } from 'remotion';

for (const weight of ['500', '700', '900'] as const) {
  loadFont({ family: 'Satoshi', url: staticFile(`fonts/Satoshi-${weight}.woff2`), weight });
}
loadPlayfair('normal', { weights: ['400'], subsets: ['latin'] });
loadPlayfair('italic', { weights: ['400'], subsets: ['latin'] });

const SANS = "Satoshi, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Playfair Display', Georgia, serif";
const INK = '#1d1a14';
const INK2 = '#6f665a';

const SEAL_PATH = (() => {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 46 + 1.6 * Math.sin(t * 7 + 0.6) + 1.1 * Math.sin(t * 13 + 2.1) + 0.7 * Math.cos(t * 5);
    pts.push(`${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const Seal: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.45))' }}>
    <defs>
      <radialGradient id="wax" cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#e2261b" />
        <stop offset="0.55" stopColor="#a90d07" />
        <stop offset="1" stopColor="#5c0603" />
      </radialGradient>
    </defs>
    <path d={SEAL_PATH} fill="url(#wax)" />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" />
    <text x="50.9" y="64.9" textAnchor="middle" style={{ fontFamily: 'Georgia, serif', fontSize: 46, fill: 'rgba(255,150,130,0.45)' }}>α</text>
    <text x="50" y="64" textAnchor="middle" style={{ fontFamily: 'Georgia, serif', fontSize: 46, fill: '#4a0402' }}>α</text>
  </svg>
);

const Diya: React.FC<{ width: number }> = ({ width }) => (
  <svg width={width} viewBox="0 0 44 40" style={{ overflow: 'visible' }}>
    <defs>
      <radialGradient id="glow" cx="50%" cy="45%" r="50%">
        <stop offset="0" stopColor="#FFD8A0" stopOpacity="0.95" />
        <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#D47A33" />
        <stop offset="0.6" stopColor="#A9521C" />
        <stop offset="1" stopColor="#6E2E0C" />
      </linearGradient>
    </defs>
    <circle cx="22" cy="11" r="15" fill="url(#glow)" />
    <path d="M22 3 C25 8 26 11 22 15 C18 11 19 8 22 3 Z" fill="#FFB020" />
    <path d="M22 7 C23.4 9.5 23.6 11.2 22 13.4 C20.4 11.2 20.6 9.5 22 7 Z" fill="#FFF3C4" />
    <path d="M4 20 C4 30 12 36 22 36 C32 36 40 30 40 20 C31 22.5 13 22.5 4 20 Z" fill="url(#bowl)" />
    <ellipse cx="22" cy="20" rx="18" ry="2.6" fill="#2E1405" />
  </svg>
);

/* Soft out-of-focus lamps behind the voucher, the Diwali edition only. A
   fixed list, so every render is the same picture. */
const LAMPS = [
  [110, 120, 70, 0.22], [250, 470, 90, 0.16], [960, 110, 80, 0.2], [1090, 430, 110, 0.17],
  [1010, 560, 50, 0.24], [170, 560, 46, 0.2], [420, 60, 38, 0.18], [790, 590, 44, 0.16],
] as const;

const caps = (size: number, color: string, spacing = 0.24): React.CSSProperties => ({
  fontFamily: SANS, fontWeight: 700, fontSize: size, letterSpacing: `${spacing}em`, textTransform: 'uppercase', color,
});

export const GiftThumb: React.FC<{ diwali: boolean }> = ({ diwali }) => {
  const W = 620;
  const H = Math.round(W / 1.75);
  return (
    <AbsoluteFill
      style={{
        background: diwali
          ? 'radial-gradient(70% 90% at 50% 58%, #3a2412 0%, #170f09 52%, #090605 100%)'
          : 'radial-gradient(70% 90% at 50% 58%, #26221d 0%, #100e0c 55%, #070605 100%)',
        alignItems: 'center',
      }}
    >
      {diwali && LAMPS.map(([x, y, r, a], i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,190,110,${a}) 0%, rgba(255,150,60,${a * 0.45}) 45%, transparent 70%)`,
          }}
        />
      ))}

      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center', ...caps(15, 'rgba(244,236,222,0.62)', 0.34) }}>
        Tracker Alpha · {diwali ? 'A Diwali gift' : 'A gift'}
      </div>
      <div style={{ position: 'absolute', top: 76, width: '100%', textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 46, color: '#f4ecde' }}>
        A gift for you.
      </div>

      {/* The pass */}
      <div
        style={{
          position: 'absolute', left: (1200 - W) / 2, top: 168, width: W, height: H,
          transform: 'rotate(-3.5deg)',
          borderRadius: 18, overflow: 'hidden', display: 'flex', color: INK,
          background: 'radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.55), transparent 55%), linear-gradient(160deg, #efe8da, #e3d8c2)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 40px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.5,
            background:
              'repeating-radial-gradient(circle at 18% 120%, transparent 0 10px, rgba(120,96,60,0.13) 10px 11px), repeating-radial-gradient(circle at 92% -30%, transparent 0 13px, rgba(120,96,60,0.1) 13px 14px)',
          }}
        />
        {diwali && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: 10,
              background:
                'radial-gradient(circle at 7px 3px, #f76707 0 4.6px, transparent 5.2px) 0 0 / 20px 10px repeat-x, radial-gradient(circle at 17px 3px, #fab005 0 3.8px, transparent 4.3px) 0 0 / 20px 10px repeat-x',
            }}
          />
        )}
        <div style={{ position: 'relative', flex: 1, padding: '44px 34px 34px 42px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...caps(13, INK2, 0.22) }}>
            <span>Tracker Alpha</span>
            <span style={{ fontVariantNumeric: 'lining-nums' }}>Worth ₹2,500</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: INK2 }}>{diwali ? 'A Diwali gift' : 'A gift'}</span>
            <span style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 70, lineHeight: 1, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>Access Pass</span>
            <span style={{ marginTop: 12, ...caps(13, INK2, 0.2) }}>For life · Admits one</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(29,26,20,0.16)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', ...caps(12, INK2, 0.2) }}>
            <span>Nothing to pay</span>
            <span>trackeralpha.in</span>
          </div>
        </div>
        <div
          style={{
            position: 'relative', width: '27%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
            padding: '46px 0 34px', background: 'linear-gradient(180deg, rgba(29,26,20,0.04), rgba(29,26,20,0.08))',
            borderLeft: '2px dotted rgba(29,26,20,0.32)',
          }}
        >
          {diwali ? <Diya width={92} /> : <span style={{ fontFamily: 'Georgia, serif', fontSize: 82, lineHeight: 1 }}>α</span>}
          <span style={{ ...caps(11, INK2, 0.22), writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Admit one</span>
        </div>
        <div style={{ position: 'absolute', right: `calc(27% - 40px)`, bottom: '13%' }}>
          <Seal size={80} />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 34, width: '100%', textAlign: 'center', ...caps(14, 'rgba(244,236,222,0.55)', 0.3) }}>
        Every member can gift just one
      </div>
    </AbsoluteFill>
  );
};
