/* ── Festive artwork, as SVG data URIs ──

   No image files: every piece is drawn here, once, at module init, the same
   stance rewards/wallpapers.ts takes. Repeating pieces (the toran, the string
   of lights) are single tiles laid with `background-repeat: repeat-x`, so a
   4K monitor and a phone cost the same one small string. */

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;

/* ─── Dussehra + Diwali ─── */

/* A marigold: a scalloped rim (a dashed stroke reads as petals), then two
   rings of colour and a seed centre. */
const marigold = (x: number, y: number, r: number, rim: string, body: string, heart: string) => `
  <circle cx="${x}" cy="${y}" r="${r}" fill="${body}" stroke="${rim}" stroke-width="${(r * 0.42).toFixed(2)}"
    stroke-dasharray="${(r * 0.32).toFixed(2)} ${(r * 0.2).toFixed(2)}"/>
  <circle cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(2)}" fill="${heart}" opacity="0.9"/>
  <circle cx="${x}" cy="${y}" r="${(r * 0.26).toFixed(2)}" fill="#B9450B"/>`;

/* A mango leaf hanging point-down from (x, y). Symmetric about x, so one cut in
   half by the tile edge meets its other half on the next tile. */
const mangoLeaf = (x: number, y: number, h: number) => `
  <path d="M${x} ${y} C ${x + h * 0.3} ${y + h * 0.25}, ${x + h * 0.26} ${y + h * 0.7}, ${x} ${y + h}
           C ${x - h * 0.26} ${y + h * 0.7}, ${x - h * 0.3} ${y + h * 0.25}, ${x} ${y} Z" fill="#2F9E44"/>
  <path d="M${x} ${y + 1} L${x} ${y + h - 2}" stroke="#1E6E30" stroke-width="0.7"/>`;

const ORANGE = ['#E8590C', '#F76707', '#FFA94D'] as const;
const YELLOW = ['#F08C00', '#FAB005', '#FFE066'] as const;

/** One 72px tile of toran: thread, a big marigold, a hanging strand, leaves at the seams. */
export const TORAN = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="46" viewBox="0 0 72 46">
  ${mangoLeaf(0, 5, 20)}
  ${mangoLeaf(72, 5, 20)}
  <path d="M0 5 Q36 13 72 5" fill="none" stroke="#A86A1E" stroke-width="1.1"/>
  <path d="M36 9 L36 38" stroke="#A86A1E" stroke-width="0.8"/>
  ${marigold(18, 7.2, 4.4, ...YELLOW)}
  ${marigold(54, 7.2, 4.4, ...YELLOW)}
  ${marigold(36, 9.4, 5.6, ...ORANGE)}
  ${marigold(36, 20, 4.2, ...YELLOW)}
  ${marigold(36, 29, 3.6, ...ORANGE)}
  ${mangoLeaf(36, 32, 12)}
</svg>`);

/** Akash kandil — the star lantern hung outside homes for Diwali. */
export const KANDIL = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="120" viewBox="0 0 60 120">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE066"/><stop offset="0.55" stop-color="#FAB005"/><stop offset="1" stop-color="#E8590C"/>
    </linearGradient>
    <radialGradient id="c" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFF4C2"/><stop offset="1" stop-color="#FFF4C2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M30 0 L30 22" stroke="#C9A24A" stroke-width="0.9"/>
  <polygon points="30,22 36.5,38 54,40 40.5,51 45,68 30,58.5 15,68 19.5,51 6,40 23.5,38"
    fill="url(#p)" stroke="#FFEFB0" stroke-width="0.8" stroke-linejoin="round"/>
  <circle cx="30" cy="46" r="11" fill="url(#c)"/>
  <polygon points="30,32 33.5,41 43,42 35.5,48 38,57 30,52 22,57 24.5,48 17,42 26.5,41"
    fill="none" stroke="#FFF8DB" stroke-width="0.6" opacity="0.8"/>
  <path d="M22 66 L20 96 M26 63 L25.5 102 M30 59 L30 106 M34 63 L34.5 102 M38 66 L40 96"
    stroke="#C92A2A" stroke-width="1" stroke-linecap="round"/>
  <path d="M20 96 L20 100 M25.5 102 L25.5 106 M30 106 L30 111 M34.5 102 L34.5 106 M40 96 L40 100"
    stroke="#FAB005" stroke-width="1.6" stroke-linecap="round"/>
</svg>`);

/** A clay diya. The flame is a separate element so it can flicker. */
export const DIYA = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="50" height="24" viewBox="0 0 50 24">
  <defs>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D47A33"/><stop offset="0.55" stop-color="#A9521C"/><stop offset="1" stop-color="#6E2E0C"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.8" stop-color="#FFD9A0" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <path d="M3 8.5 C3 17.5 11 22.5 21.5 22.5 C31 22.5 37.5 18.5 40.5 13.5 L48.5 6.8 C45.5 6.2 42.5 6.6 39.5 8 C30 6 12 6.2 3 8.5 Z" fill="url(#d)"/>
  <path d="M3 8.5 C3 17.5 11 22.5 21.5 22.5 C31 22.5 37.5 18.5 40.5 13.5 L48.5 6.8 C45.5 6.2 42.5 6.6 39.5 8 C30 6 12 6.2 3 8.5 Z" fill="url(#s)"/>
  <ellipse cx="21" cy="8.4" rx="18" ry="2.5" fill="#2E1405"/>
  <path d="M3 8.5 C12 11.4 30 11.4 39.5 8" fill="none" stroke="#F0A75C" stroke-width="0.9"/>
  <path d="M13 8 C20 9.4 28 9.2 34 8" fill="none" stroke="#7A4A1A" stroke-width="0.6" opacity="0.7"/>
  <path d="M8 15 C16 19 28 19 36 15" fill="none" stroke="#E9A25B" stroke-width="0.7" stroke-dasharray="0.6 2.2" stroke-linecap="round" opacity="0.85"/>
  <path d="M44.5 8.2 L47.2 5.2" stroke="#2A1206" stroke-width="1.3" stroke-linecap="round"/>
</svg>`);

/** One marigold on its own, for the Dussehra greeting. */
export const MARIGOLD = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  ${marigold(14, 14, 10, ...ORANGE)}
</svg>`);

/* The Diwali string: round paper lanterns on a swagged cord, three to a tile
   so the colours walk orange → red → gold and never pair up. Each hangs on a
   different length of string, which is what stops a row of them reading as a
   pattern. */
const LANTERN_W = 225;
const LANTERNS_SPEC = [
  { x: 37.5, drop: 4, body: '#F76707', edge: '#C2410C' },
  { x: 112.5, drop: 12, body: '#E03131', edge: '#9C1C1C' },
  { x: 187.5, drop: 7, body: '#FAB005', edge: '#C77A0A' },
];
export const LANTERNS = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="${LANTERN_W}" height="66" viewBox="0 0 ${LANTERN_W} 66">
  <defs>
    ${LANTERNS_SPEC.map((l, i) => `
      <radialGradient id="l${i}" cx="0.5" cy="0.45" r="0.6">
        <stop offset="0" stop-color="#FFF3BF"/>
        <stop offset="0.45" stop-color="${l.body}"/>
        <stop offset="1" stop-color="${l.edge}"/>
      </radialGradient>
      <radialGradient id="h${i}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${l.body}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${l.body}" stop-opacity="0"/>
      </radialGradient>`).join('')}
  </defs>
  <path d="M0 3 Q37.5 13 75 3 Q112.5 13 150 3 Q187.5 13 225 3" fill="none" stroke="#8A5A1A" stroke-width="1.1"/>
  ${LANTERNS_SPEC.map((l, i) => {
    const top = 8 + l.drop;
    const cy = top + 14;
    return `
      <path d="M${l.x} 8 L${l.x} ${top}" stroke="#8A5A1A" stroke-width="0.8"/>
      <circle cx="${l.x}" cy="${cy}" r="22" fill="url(#h${i})"/>
      <rect x="${l.x - 4.5}" y="${top}" width="9" height="3" rx="0.8" fill="#C9A24A"/>
      <ellipse cx="${l.x}" cy="${cy}" rx="10" ry="11.5" fill="url(#l${i})"/>
      <ellipse cx="${l.x}" cy="${cy}" rx="5.5" ry="11.5" fill="none" stroke="${l.edge}" stroke-width="0.6" opacity="0.7"/>
      <ellipse cx="${l.x}" cy="${cy}" rx="1.6" ry="11.5" fill="none" stroke="${l.edge}" stroke-width="0.6" opacity="0.6"/>
      <rect x="${l.x - 4.5}" y="${cy + 10.5}" width="9" height="3" rx="0.8" fill="#C9A24A"/>
      <path d="M${l.x} ${cy + 13.5} L${l.x} ${cy + 22}" stroke="#E03131" stroke-width="1.6" stroke-linecap="round"/>`;
  }).join('')}
</svg>`);

/* A firecracker box: the kind every Diwali starts from. Red card with gold
   bands, the lid tipped back, four rockets standing in it. */
export const CRACKER_BOX = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bx" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#A51D1D"/><stop offset="0.55" stop-color="#D62F2F"/><stop offset="1" stop-color="#8F1717"/>
    </linearGradient>
    <linearGradient id="sd" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6E1010"/><stop offset="1" stop-color="#8F1717"/>
    </linearGradient>
  </defs>
  <path d="M14 30 L8 14 L40 10 L44 27 Z" fill="#B82525" stroke="#F2C14E" stroke-width="0.8"/>
  <path d="M22 30 L22 12 M29 30 L30 9 M36 30 L38 13 M43 30 L45 15" stroke="#D9B44A" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M22 12 L20 6 L24 6 Z" fill="#69DB7C"/>
  <path d="M30 9 L28 3 L32 3 Z" fill="#4DABF7"/>
  <path d="M38 13 L36 7 L40 7 Z" fill="#FFD43B"/>
  <path d="M45 15 L43 9 L47 9 Z" fill="#DA77F2"/>
  <path d="M12 30 L52 30 L52 58 L12 58 Z" fill="url(#bx)"/>
  <path d="M52 30 L58 26 L58 54 L52 58 Z" fill="url(#sd)"/>
  <path d="M12 30 L18 26 L58 26 L52 30 Z" fill="#E8494A"/>
  <rect x="12" y="35" width="40" height="3" fill="#F2C14E"/>
  <rect x="12" y="50" width="40" height="3" fill="#F2C14E"/>
  <path d="M52 35 L58 31 L58 34 L52 38 Z M52 50 L58 46 L58 49 L52 53 Z" fill="#C9A23A"/>
  <path d="M32 40 L33.6 43.4 L37.3 43.8 L34.5 46.2 L35.3 49.8 L32 48 L28.7 49.8 L29.5 46.2 L26.7 43.8 L30.4 43.4 Z" fill="#FFE066"/>
</svg>`);

/* ─── Christmas + New Year ─── */

const LIGHT_W = 128;
const BULBS: Array<{ x: number; color: string; set: 'a' | 'b' }> = [
  { x: 16, color: '#FFD166', set: 'a' },
  { x: 48, color: '#FF6B6B', set: 'b' },
  { x: 80, color: '#69DB7C', set: 'a' },
  { x: 112, color: '#74C0FC', set: 'b' },
];
/* Where the wire sits at x: two swags per tile, each a quadratic 3 → 13 → 3. */
const wireY = (x: number) => {
  const t = (x % 64) / 64;
  return (1 - t) * (1 - t) * 3 + 2 * t * (1 - t) * 13 + t * t * 3;
};

/** The wire and the bulb caps — never animated. */
export const LIGHTS_WIRE = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="${LIGHT_W}" height="40" viewBox="0 0 ${LIGHT_W} 40">
  <path d="M0 3 Q32 13 64 3 Q96 13 128 3" fill="none" stroke="#3D5245" stroke-width="1.3"/>
  ${BULBS.map(b => `<rect x="${b.x - 2.2}" y="${wireY(b.x) - 0.5}" width="4.4" height="4.6" rx="1" fill="#5C6F62"/>`).join('')}
</svg>`);

/** One of the two bulb sets. They twinkle out of step, so the string never blinks as one. */
export const lightsSet = (set: 'a' | 'b') => uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="${LIGHT_W}" height="40" viewBox="0 0 ${LIGHT_W} 40">
  <defs>
    ${BULBS.filter(b => b.set === set).map((b, i) => `
      <radialGradient id="g${i}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${b.color}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${b.color}" stop-opacity="0"/>
      </radialGradient>`).join('')}
  </defs>
  ${BULBS.filter(b => b.set === set).map((b, i) => {
    const y = wireY(b.x) + 9.5;
    return `
      <circle cx="${b.x}" cy="${y}" r="14" fill="url(#g${i})"/>
      <ellipse cx="${b.x}" cy="${y}" rx="3.4" ry="5" fill="${b.color}"/>
      <ellipse cx="${b.x - 1}" cy="${y - 1.6}" rx="1" ry="1.8" fill="#FFFFFF" opacity="0.7"/>`;
  }).join('')}
</svg>`);

/** A glass bauble with a cap and a single highlight. */
export const bauble = (color: string, shade: string) => uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
  <defs>
    <radialGradient id="b" cx="0.36" cy="0.34" r="0.7">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="0.18" stop-color="${color}"/>
      <stop offset="1" stop-color="${shade}"/>
    </radialGradient>
  </defs>
  <path d="M20 0 L20 10" stroke="#C9B37E" stroke-width="0.9"/>
  <circle cx="20" cy="10" r="2.2" fill="none" stroke="#D9C38E" stroke-width="1"/>
  <rect x="15" y="11" width="10" height="6" rx="1.2" fill="#D9B44A"/>
  <path d="M15 13.5 H25" stroke="#A8862E" stroke-width="0.6"/>
  <circle cx="20" cy="33" r="17" fill="url(#b)"/>
  <path d="M5 33 Q20 38 35 33" fill="none" stroke="#FFFFFF" stroke-width="0.7" opacity="0.35"/>
</svg>`);

/** A soft drift of snow along the bottom edge. */
export const SNOWBANK = (fill: string, edge: string) => uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="34" viewBox="0 0 480 34" preserveAspectRatio="none">
  <path d="M0 18 C 40 8, 80 8, 120 15 S 200 26, 250 14 S 340 4, 390 13 S 450 22, 480 18 L480 34 L0 34 Z"
    fill="${fill}" stroke="${edge}" stroke-width="1"/>
</svg>`);
