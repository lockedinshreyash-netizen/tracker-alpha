import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { mulberry32 } from '../score/random';

/** Film grain from four pre-baked tiles, chosen and offset per frame. */
const TILE = 256;
const makeTiles = (): string[] => {
  const rnd = mulberry32(4242);
  return [0, 1, 2, 3].map(() => {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d')!;
    const img = g.createImageData(TILE, TILE);
    for (let i = 0; i < TILE * TILE; i++) {
      const v = Math.floor(128 + (rnd() + rnd() + rnd() - 1.5) * 120);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
};

export const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const tiles = useMemo(makeTiles, []);
  const ox = Math.floor(((frame * 7919) % 997) / 997 * TILE);
  const oy = Math.floor(((frame * 104729) % 991) / 991 * TILE);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tiles[frame % 4]})`,
        backgroundSize: `${TILE * 1.5}px ${TILE * 1.5}px`,
        backgroundPosition: `${ox}px ${oy}px`,
        mixBlendMode: 'overlay',
        opacity: 0.11,
        pointerEvents: 'none',
      }}
    />
  );
};
