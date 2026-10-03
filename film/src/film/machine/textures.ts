import * as THREE from 'three';
import { mulberry32 } from '../../score/random';
import { DRUM_LEN, laneX } from '../look';

/**
 * The drum's surface: a calendar engraved in steel. One fine line per day,
 * a deeper one per week, a groove for every tine. Used as a roughness and
 * bump map so the engraving only shows where light catches it.
 */
export const drumSurfaceTexture = (): THREE.CanvasTexture => {
  const W = 8192;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(31);

  g.fillStyle = 'rgb(120,120,120)';
  g.fillRect(0, 0, W, H);
  // Brushed grain along the direction of travel.
  for (let i = 0; i < 9000; i++) {
    const y = rnd() * H;
    const v = 100 + rnd() * 40;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(rnd() * W, y, 40 + rnd() * 400, 1);
  }
  // Days.
  for (let d = 0; d < 365; d++) {
    const x = (d / 365) * W;
    const week = d % 7 === 0;
    const month = Math.round(d % 30.42) === 0;
    g.fillStyle = month ? 'rgb(235,235,235)' : week ? 'rgb(205,205,205)' : 'rgb(170,170,170)';
    g.fillRect(x - (month ? 1.5 : 0.75), 0, month ? 3 : 1.5, H);
  }
  // Tine grooves.
  for (let lane = 0; lane < 24; lane++) {
    const v = (laneX(lane) + DRUM_LEN / 2) / DRUM_LEN;
    g.fillStyle = 'rgb(190,190,190)';
    g.fillRect(0, v * H - 1, W, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
};

/** A soft round sprite for dust and glows. */
export const softSprite = (): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
};

/** Vertical falloff for the ghost gate's light curtain: bright at the floor. */
export const curtainTexture = (): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
};
