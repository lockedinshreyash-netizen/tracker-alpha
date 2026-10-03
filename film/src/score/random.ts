/** Seeded PRNG. Every random choice in the film goes through one of these, so
 *  a render on Tuesday is byte-identical to a render on Friday. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stateless hash → [0, 1). For per-element jitter that must not depend on
 *  the order things were asked for. */
export const hash01 = (n: number, salt = 0): number => {
  let h = (n * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
