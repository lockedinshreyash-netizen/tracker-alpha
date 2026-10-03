/**
 * The machine: a drum the length of a year, a comb of 24 tines, and a red
 * line where now is.
 *
 * Nothing on the drum is pre-written. A day's pins rise out of the steel in
 * the moment before the comb reaches them — the day is made by being lived —
 * and once plucked they stay lit, so the year you have built is the light
 * the machine runs by.
 *
 * Built once, then updated imperatively from a FrameState. No clock of its
 * own: every value here is a function of the frame.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../score/random';
import { LANES, TIMELINE, lastPluckPerLane, type PluckNote } from '../../score/timeline';
import { ACCENT, DAY_ANGLE, DRUM_LEN, R, SUBJECT_HEX, laneX } from '../look';
import type { FrameState } from '../state';
import { auroraMaterial } from './aurora';
import { curtainTexture, drumSurfaceTexture, softSprite } from './textures';

const { notes } = TIMELINE;

/** Tine geometry, in its own frame: pivot at the base, pointing down −z. */
export const TINE_Y = R + 0.42;
export const TINE_BASE_Z = 1.6;
const TINE_LEN = 1.6;
const TOOTH = 0.32;

const linear = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
const SUBJECT_LIN = {
  Physics: linear(SUBJECT_HEX.Physics),
  Chemistry: linear(SUBJECT_HEX.Chemistry),
  Maths: linear(SUBJECT_HEX.Maths),
};
const GREY = new THREE.Color(0.22, 0.22, 0.24);

const drumGeometry = (segments = 720): THREE.BufferGeometry => {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const y = Math.cos(a);
    const z = -Math.sin(a);
    for (let j = 0; j <= 1; j++) {
      pos.push(-DRUM_LEN / 2 + j * DRUM_LEN, R * y, R * z);
      nor.push(0, y, z);
      uv.push(i / segments, j);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Machine {
  scene = new THREE.Scene();
  private drum = new THREE.Group();
  private pins: THREE.InstancedMesh;
  private tines: THREE.InstancedMesh;
  private tips: THREE.InstancedMesh;
  private metals: THREE.MeshStandardMaterial[] = [];
  private key: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  private pluckLight: THREE.PointLight;
  private redLight: THREE.PointLight;
  private nowLine: THREE.Mesh;
  private nowGlow: THREE.Mesh;
  private gate = new THREE.Group();
  private gateMats: THREE.MeshBasicMaterial[] = [];
  private curtainMat: THREE.MeshBasicMaterial;
  private dust: THREE.Points;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private col = new THREE.Color();
  private ax = new THREE.Vector3(1, 0, 0);

  constructor(renderer: THREE.WebGLRenderer) {
    const scene = this.scene;
    scene.background = new THREE.Color(0x020203);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    /* Sky first: the 30-day reward, invisible until earned. */
    this.skyMat = auroraMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 96, 48), this.skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    {
      const rnd = mulberry32(20260809);
      const n = 1600;
      const p = new Float32Array(n * 3);
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const az = (rnd() - 0.5) * Math.PI * 2;
        const el = Math.asin(0.03 + rnd() * 0.97);
        const r = 140;
        p[i * 3] = r * Math.cos(el) * Math.sin(az);
        p[i * 3 + 1] = r * Math.sin(el);
        p[i * 3 + 2] = -r * Math.cos(el) * Math.cos(az);
        const b = Math.pow(rnd(), 3) * 0.9 + 0.1;
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      this.stars = new THREE.Points(
        g,
        new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }),
      );
      this.stars.renderOrder = -9;
      scene.add(this.stars);
    }

    /* Drum. */
    const surface = drumSurfaceTexture();
    surface.flipY = false;
    const steel = (color: number, roughness: number, metalness = 0.92) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.metals.push(m);
      return m;
    };
    const drumMat = steel(0x1b1c21, 0.36);
    drumMat.roughnessMap = surface;
    drumMat.bumpMap = surface;
    drumMat.bumpScale = 0.6;
    this.drum.add(new THREE.Mesh(drumGeometry(), drumMat));
    const capMat = steel(0x0e0f12, 0.5);
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 256), capMat);
      cap.rotation.y = (side * Math.PI) / 2;
      cap.position.x = (side * DRUM_LEN) / 2;
      this.drum.add(cap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 10, 256), steel(0x6b6e75, 0.25));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = (side * DRUM_LEN) / 2;
      this.drum.add(ring);
    }
    scene.add(this.drum);

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, DRUM_LEN + 2.4, 48), steel(0x8a8d94, 0.3, 1));
    axle.rotation.z = Math.PI / 2;
    scene.add(axle);
    for (const side of [-1, 1]) {
      const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.34, 2.4, 1.5, 4, 0.08), steel(0x111216, 0.45));
      bracket.position.set(side * (DRUM_LEN / 2 + 0.75), -0.7, 0);
      scene.add(bracket);
    }

    /* Pins: one per note, coloured by subject, unlit — they are light. */
    const pinGeo = new THREE.CylinderGeometry(0.028, 0.04, 1, 12, 1);
    pinGeo.translate(0, 0.5, 0);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.pins = new THREE.InstancedMesh(pinGeo, pinMat, notes.length);
    this.pins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(notes.length * 3), 3);
    this.pins.frustumCulled = false;
    this.drum.add(this.pins);

    /* Comb. */
    const comb = new THREE.Mesh(new RoundedBoxGeometry(DRUM_LEN - 0.2, 0.34, 0.8, 4, 0.06), steel(0x15161a, 0.32));
    comb.position.set(0, TINE_Y + 0.12, TINE_BASE_Z + 0.32);
    scene.add(comb);
    const blade = new THREE.BoxGeometry(0.17, 0.026, TINE_LEN);
    blade.translate(0, 0, -TINE_LEN / 2);
    const tooth = new THREE.BoxGeometry(0.17, TOOTH, 0.03);
    tooth.translate(0, -TOOTH / 2, -TINE_LEN + 0.015);
    const tineGeo = mergeGeometries([blade, tooth])!;
    this.tines = new THREE.InstancedMesh(tineGeo, steel(0xc4c7ce, 0.2, 1), LANES);
    this.tines.frustumCulled = false;
    scene.add(this.tines);
    const tipGeo = new THREE.BoxGeometry(0.175, 0.03, 0.04);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.tips = new THREE.InstancedMesh(tipGeo, tipMat, LANES);
    this.tips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LANES * 3), 3);
    this.tips.frustumCulled = false;
    scene.add(this.tips);

    /* Now. */
    const red = linear(ACCENT);
    this.nowLine = new THREE.Mesh(
      new THREE.PlaneGeometry(DRUM_LEN + 0.1, 0.016),
      new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(5), toneMapped: false }),
    );
    this.nowLine.rotation.x = -Math.PI / 2;
    this.nowLine.position.set(0, R + 0.004, 0);
    scene.add(this.nowLine);
    this.nowGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(DRUM_LEN + 1.2, 0.6),
      new THREE.MeshBasicMaterial({ map: softSprite(), color: red.clone().multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.nowGlow.rotation.x = -Math.PI / 2;
    this.nowGlow.position.set(0, R + 0.003, 0);
    scene.add(this.nowGlow);
    this.redLight = new THREE.PointLight(red, 1, 3, 2);
    this.redLight.position.set(0, R + 0.12, 0.05);
    scene.add(this.redLight);

    /* The ghost: your best, standing on the day that would beat it. */
    const ghostMat = () => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this.gateMats.push(m);
      return m;
    };
    const H = 1.15;
    const W = DRUM_LEN + 0.9;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, 0.02), ghostMat());
    bar.position.y = R + H;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.025), ghostMat());
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = R + 0.006;
    this.gate.add(bar, floor);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, 0.02), ghostMat());
      post.position.set((side * W) / 2, R + H / 2, 0);
      this.gate.add(post);
    }
    this.curtainMat = new THREE.MeshBasicMaterial({ map: curtainTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.curtainMat);
    curtain.position.y = R + H / 2;
    this.gate.add(curtain);
    this.drum.add(this.gate);

    /* Dust: open errors, hanging in the light. */
    {
      const rnd = mulberry32(5);
      const n = 2600;
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        p[i * 3] = (rnd() - 0.5) * 12;
        p[i * 3 + 1] = R - 0.6 + rnd() * 4.5;
        p[i * 3 + 2] = (rnd() - 0.5) * 14 - 1;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.dust = new THREE.Points(
        g,
        new THREE.PointsMaterial({ size: 0.028, map: softSprite(), color: 0xfff1dc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      scene.add(this.dust);
    }

    /* Light. */
    this.fill = new THREE.HemisphereLight(0x9aa4b8, 0x050505, 0.05);
    scene.add(this.fill);
    this.key = new THREE.DirectionalLight(0xfff2e2, 1);
    this.key.position.set(-6, 12, 9);
    scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0xc4d8ff, 1);
    this.rim.position.set(3, 5, -14);
    scene.add(this.rim);
    this.pluckLight = new THREE.PointLight(0xffffff, 0, 5, 2);
    this.pluckLight.position.set(0, R + 0.7, 0.3);
    scene.add(this.pluckLight);
  }

  update(s: FrameState) {
    const f = s.sceneFrame;
    const fade = s.endFade;
    const dayPos = s.dayPos;
    this.drum.rotation.x = dayPos * DAY_ANGLE;

    /* Pins. */
    const pins = this.pins;
    const colors = pins.instanceColor!.array as Float32Array;
    for (let i = 0; i < notes.length; i++) {
      const n: PluckNote = notes[i];
      const ahead = n.pos - dayPos; // days until the comb
      let rise = 1;
      if (ahead > 0) rise = smooth(0.85, 0.08, ahead);
      const h = (0.12 + 0.045 * Math.min(3.6, n.hours)) * rise;
      const a = n.pos * DAY_ANGLE;
      if (rise <= 0.001) {
        this.m4.makeScale(0, 0, 0);
        pins.setMatrixAt(i, this.m4);
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      this.q.setFromAxisAngle(this.ax, -a);
      this.v.set(laneX(n.lane), R * Math.cos(a), -R * Math.sin(a));
      this.sc.set(1, h, 1);
      this.m4.compose(this.v, this.q, this.sc);
      pins.setMatrixAt(i, this.m4);

      const since = f - n.frame;
      let k: number;
      if (since < 0) k = 0.35 + 0.6 * rise;
      else k = (n.muted ? 0.22 : 0.55 + 0.6 * n.bright) + 6 * Math.exp(-since / 7);
      const base = n.muted ? GREY : SUBJECT_LIN[n.subject];
      this.col.copy(base).multiplyScalar(k * (0.35 + 0.65 * fade));
      colors[i * 3] = this.col.r;
      colors[i * 3 + 1] = this.col.g;
      colors[i * 3 + 2] = this.col.b;
    }
    pins.instanceMatrix.needsUpdate = true;
    pins.instanceColor!.needsUpdate = true;

    /* Tines: lifted by an arriving pin, ringing after it lets go. */
    const last = lastPluckPerLane(f);
    const tipColors = this.tips.instanceColor!.array as Float32Array;
    const upcoming: (PluckNote | null)[] = new Array(LANES).fill(null);
    for (const n of notes) {
      const ahead = n.pos - dayPos;
      if (ahead > 0 && ahead < 0.32 && !upcoming[n.lane]) upcoming[n.lane] = n;
    }
    let pr = 0;
    let pg = 0;
    let pb = 0;
    for (let lane = 0; lane < LANES; lane++) {
      let angle = 0;
      const n = last[lane];
      let glow = 0;
      if (n) {
        const dt = (f - n.frame) / 60;
        if (dt < 2) {
          angle += 0.075 * n.vel * Math.exp(-dt / 0.32) * Math.cos(Math.PI * 2 * 7.5 * dt);
          glow = Math.exp(-dt / 0.12) * (n.muted ? 0.3 : 1);
          const c = n.muted ? GREY : SUBJECT_LIN[n.subject];
          const w = Math.exp(-dt / 0.2) * n.vel;
          pr += c.r * w;
          pg += c.g * w;
          pb += c.b * w;
          this.col.copy(c).multiplyScalar(glow * 5);
        }
      }
      const up = upcoming[lane];
      if (up) {
        const ahead = up.pos - dayPos;
        const h = 0.12 + 0.045 * Math.min(3.6, up.hours);
        angle += ((h - 0.1) / TINE_LEN) * 0.9 * smooth(0.32, 0, ahead);
      }
      this.q.setFromAxisAngle(this.ax, angle);
      this.v.set(laneX(lane), TINE_Y, TINE_BASE_Z);
      this.sc.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.sc);
      this.tines.setMatrixAt(lane, this.m4);
      // The tooth's lowest point, carried by the same rotation.
      const ty = -TOOTH;
      const tz = -TINE_LEN + 0.015;
      this.v.set(laneX(lane), TINE_Y + ty * Math.cos(angle) - tz * Math.sin(angle), TINE_BASE_Z + ty * Math.sin(angle) + tz * Math.cos(angle));
      this.m4.compose(this.v, this.q, this.sc);
      this.tips.setMatrixAt(lane, this.m4);
      if (glow <= 0) this.col.setRGB(0, 0, 0);
      tipColors[lane * 3] = this.col.r * fade;
      tipColors[lane * 3 + 1] = this.col.g * fade;
      tipColors[lane * 3 + 2] = this.col.b * fade;
    }
    this.tines.instanceMatrix.needsUpdate = true;
    this.tips.instanceMatrix.needsUpdate = true;
    this.tips.instanceColor!.needsUpdate = true;

    /* Light. */
    const L = s.light * fade;
    this.key.intensity = 0.12 + 2.4 * L;
    this.rim.intensity = 0.2 + 2.6 * L + 0.8 * s.aurora * fade;
    this.fill.intensity = 0.03 + 0.35 * L;
    for (const m of this.metals) m.envMapIntensity = 0.06 + 0.85 * L;
    const pe = Math.min(2.2, s.energy);
    const sum = pr + pg + pb;
    if (sum > 0) this.pluckLight.color.setRGB(pr / sum * 3, pg / sum * 3, pb / sum * 3);
    this.pluckLight.intensity = 14 * pe * fade;
    const nowK = fade * (0.85 + 0.15 * Math.sin(f * 0.05));
    (this.nowLine.material as THREE.MeshBasicMaterial).opacity = 1;
    this.nowLine.visible = fade > 0.02;
    this.nowLine.scale.set(1, 1, 1);
    ((this.nowLine.material as THREE.MeshBasicMaterial).color as THREE.Color).copy(linear(ACCENT)).multiplyScalar(5 * nowK);
    ((this.nowGlow.material as THREE.MeshBasicMaterial).color as THREE.Color).copy(linear(ACCENT)).multiplyScalar(0.9 * nowK);
    this.redLight.intensity = 1.2 * nowK;

    /* Ghost gate. */
    let best = s.gates[0];
    for (const g of s.gates) if (g.opacity > best.opacity || g.flare > best.flare) best = g;
    const o = best ? Math.max(best.opacity, best.flare) : 0;
    this.gate.visible = o > 0.001;
    if (best) {
      this.gate.rotation.x = -(best.gate.d + 0.5) * DAY_ANGLE;
      const k = (0.9 + 2.5 * best.flare) * o;
      for (const m of this.gateMats) m.opacity = Math.min(1, k);
      this.curtainMat.opacity = Math.min(1, 0.22 * o + 0.8 * best.flare);
    }

    /* Dust. */
    const err = s.step.errors;
    (this.dust.material as THREE.PointsMaterial).opacity = Math.min(1, err / 100) * (0.2 + 0.8 * Math.min(1, s.light)) * 0.85 * fade;
    this.dust.rotation.y = f * 0.00022;
    this.dust.position.y = Math.sin(f * 0.0035) * 0.12;

    /* Sky. */
    this.skyMat.uniforms.uTime.value = f / 60;
    this.skyMat.uniforms.uAmount.value = s.aurora * fade;
    this.sky.visible = s.aurora > 0;
    (this.stars.material as THREE.PointsMaterial).opacity = 0.9 * s.aurora * fade;
    this.stars.visible = s.aurora > 0;
  }
}
