/* ── The wax seal ──
   The landing page's seal (landing/Hero.tsx), drawn here too so the Gate's
   chunk does not pull the landing page in. Same formula, so the two are the
   same object: a circle with a slow wobble, the α pressed in. */

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

const Seal = ({ size = 64, className, gid }: { size?: number; className?: string; gid: string }) => (
  <svg className={`ax-seal${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id={gid} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#e2261b" />
        <stop offset="0.55" stopColor="#a90d07" />
        <stop offset="1" stopColor="#5c0603" />
      </radialGradient>
    </defs>
    <path d={SEAL_PATH} fill={`url(#${gid})`} />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,190,170,0.22)" strokeWidth="0.8" transform="translate(-0.7 -0.7)" />
    <text x="50.9" y="64.9" textAnchor="middle" className="ax-seal-a ax-seal-hi">α</text>
    <text x="50" y="64" textAnchor="middle" className="ax-seal-a">α</text>
  </svg>
);

export default Seal;
