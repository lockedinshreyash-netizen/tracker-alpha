import { useFrame, useThree } from '@react-three/fiber';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../../../onboarding/arena';
import { buildCity, HERO } from './city';

/**
 * One continuous shot. The camera starts a hand's width from a single lit
 * window and pulls back on a logarithmic curve (each second covers several
 * times the distance of the last) until the window is one point in a city of
 * them. It ends looking down at the city with the hero window at the exact
 * centre of the frame, because the app takes that point over as the red full
 * stop of "LOCK IN."
 */

const FOV = 40;
const D0 = 0.32;
const D1 = 190;
const PULL_END = 7.6;

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Shot {
  t: number;
  dist: number;
  pos: THREE.Vector3;
}

export const shotAt = (t: number): Shot => {
  const u = easeInOut(Math.min(1, t / PULL_END));
  const dist = Math.exp(lerp(Math.log(D0), Math.log(D1), u));
  // Ends low enough that the city runs out to a hazy horizon at the top of
  // the frame: a field seen from straight above is just texture.
  const pitch = THREE.MathUtils.degToRad(lerp(4, 19, Math.pow(u, 0.8)));
  const yaw = THREE.MathUtils.degToRad(lerp(-32, 12, u));
  const pos = new THREE.Vector3(
    HERO.x + dist * Math.cos(pitch) * Math.sin(yaw),
    HERO.y + dist * Math.sin(pitch),
    HERO.z + dist * Math.cos(pitch) * Math.cos(yaw),
  );
  return { t, dist, pos };
};

const VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aOn;
  attribute float aSeed;
  uniform float uTime;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uScale;
  uniform float uFade;
  uniform float uFog;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 0.001);
    float air = exp(-depth / uFog);
    float on = smoothstep(aOn, aOn + 0.4, uTime);
    // No per-light twinkle: every pixel changing every frame is the one thing
    // a video codec cannot compress, and it tripled the file for a shimmer
    // nobody could see.
    float flick = 1.0;
    float sharp = max(aSize * uScale / depth, 1.15);
    float coc = uAperture * abs(depth - uFocus) / depth * uScale;
    float d = sharp + coc;
    gl_PointSize = min(d, 220.0);
    // The light a defocused point carries is spread over a bigger disc, so it
    // dims as it grows: bokeh, not a balloon.
    float energy = (sharp * sharp) / (d * d);
    vAlpha = on * flick * uFade * clamp(energy * 1.35, 0.015, 1.0) * (0.25 + 0.75 * air);
    vSoft = clamp(coc / max(d, 1.0), 0.0, 1.0);
    // Through more air, light goes warmer.
    vColor = mix(aColor * vec3(1.0, 0.72, 0.5), aColor, air);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    // In focus: a soft gaussian dot. Out of focus: a flat disc with a bright rim.
    float dotShape = exp(-r * r * 5.0);
    float disc = smoothstep(1.0, 0.86, r) * (0.82 + 0.18 * smoothstep(0.55, 0.95, r));
    float shape = mix(dotShape, disc, vSoft);
    if (shape < 0.003) discard;
    gl_FragColor = vec4(vColor * vAlpha * shape, 1.0);
  }
`;

const RED = new THREE.Color('#ff1a0d');

export const ArenaScene: React.FC<{ t: number; width: number; height: number }> = ({ t, width, height }) => {
  const { gl, camera } = useThree();

  const world = useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020203');
    const city = buildCity();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(city.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(city.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(city.sizes, 1));
    geo.setAttribute('aOn', new THREE.BufferAttribute(city.onAt, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(city.seeds, 1));
    const uniforms = {
      uTime: { value: 0 },
      uFocus: { value: 1 },
      uAperture: { value: 0.02 },
      uScale: { value: 1 },
      uFade: { value: 1 },
      uFog: { value: 400 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // The hero window: its own point so it can outlive the fade and turn red.
    const heroGeo = new THREE.BufferGeometry();
    heroGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([HERO.x, HERO.y, HERO.z]), 3));
    heroGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([1, 0.78, 0.5]), 3));
    heroGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([0.07]), 1));
    heroGeo.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array([-1]), 1));
    heroGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array([0.5]), 1));
    const heroUniforms = {
      uTime: { value: 0 },
      uFocus: { value: 1 },
      uAperture: { value: 0 },
      uScale: { value: 1 },
      uFade: { value: 1 },
      uFog: { value: 1e6 },
    };
    const heroMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: heroUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const hero = new THREE.Points(heroGeo, heroMat);
    hero.frustumCulled = false;
    scene.add(hero);

    // The sky: black overhead, a faint warm haze at the horizon.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uHaze: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir; uniform float uHaze;
        void main(){
          float e = vDir.y;
          // Above the horizon a glow; below it the same glow, so the farthest
          // lights fade into haze rather than ending against a band of black.
          float glow = exp(-abs(e) * (e > 0.0 ? 14.0 : 22.0));
          vec3 c = vec3(0.16, 0.075, 0.035) * glow * uHaze + vec3(0.006, 0.007, 0.012);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat);
    scene.add(sky);

    // The shockwave: a ring on the ground around the hero window.
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uR: { value: 0 }, uW: { value: 1 }, uA: { value: 0 }, uGlowR: { value: 1 }, uGlow: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uR; uniform float uW; uniform float uA; uniform float uGlowR; uniform float uGlow;
        void main(){
          float r = length(vP);
          float d = abs(r - uR);
          float ring = exp(-d * d / (uW * uW)) * uA;
          // The red light pools on the ground around it.
          float pool = exp(-r * r / (uGlowR * uGlowR)) * uGlow;
          gl_FragColor = vec4(vec3(1.0, 0.09, 0.04) * (ring + pool), 1.0);
        }`,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(HERO.x, 0.01, HERO.z);
    scene.add(ring);

    return { scene, uniforms, heroUniforms, heroGeo, ringMat, skyMat, sky };
  }, []);

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(world.scene, camera));
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.6, luminanceThreshold: 0.35, luminanceSmoothing: 0.3, radius: 0.72 });
    const vignette = new VignetteEffect({ darkness: 0.7, offset: 0.24 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    composer.addPass(new EffectPass(camera, bloom, vignette, tone));
    composer.setSize(width, height);
    return { composer, bloom };
  }, [gl, camera, world, width, height]);

  useEffect(() => () => fx.composer.dispose(), [fx]);

  useLayoutEffect(() => {
    const shot = shotAt(t);
    const c = camera as THREE.PerspectiveCamera;
    c.position.copy(shot.pos);
    c.up.set(0, 1, 0);
    c.lookAt(HERO.x, HERO.y, HERO.z);
    // A phone's frame is tall: widen the lens so the city, not the sky and the
    // foreground, still fills it.
    c.fov = height > width ? 58 : FOV;
    c.near = 0.01;
    c.far = 2000;
    c.aspect = width / height;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();

    const scale = height / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));
    const u = world.uniforms;
    u.uTime.value = t;
    u.uFocus.value = shot.dist;
    // Shallow focus close up, deep focus once the city is the subject.
    u.uAperture.value = lerp(0.034, 0.0035, smooth(0, 5.2, t));
    u.uScale.value = scale;
    const fade = 1 - smooth(BEATS.out, BEATS.out + 0.65, t);
    u.uFade.value = fade;
    u.uFog.value = Math.max(60, shot.dist * 2.4);
    world.sky.position.copy(shot.pos);
    world.skyMat.uniforms.uHaze.value = smooth(3.0, 5.5, t) * fade;

    // The hero: warm until "you", then red, then a heartbeat, then alone.
    const h = world.heroUniforms;
    h.uTime.value = t;
    h.uFocus.value = shot.dist;
    h.uScale.value = scale;
    const red = smooth(BEATS.you - 0.05, BEATS.you + 0.25, t);
    const warm = new THREE.Color(1, 0.78, 0.5);
    const col = warm.clone().lerp(RED, red);
    const pulse = 1 + 1.6 * Math.exp(-Math.max(0, t - BEATS.you) * 4.5) * red;
    const heroBright = (0.6 + 3.2 * smooth(0.15, 0.9, t)) * (red > 0 ? lerp(1, 2.4, red) : 1) * pulse;
    const ca = world.heroGeo.getAttribute('aColor') as THREE.BufferAttribute;
    ca.setXYZ(0, col.r * heroBright, col.g * heroBright, col.b * heroBright);
    ca.needsUpdate = true;
    // Stays a readable dot however far the camera goes: its on-screen size is
    // held, not left to shrink with distance like the rest of the city.
    const sa = world.heroGeo.getAttribute('aSize') as THREE.BufferAttribute;
    sa.setX(0, Math.max(0.07, shot.dist * 0.0125 * (1 + 0.9 * red)));
    sa.needsUpdate = true;

    const since = t - BEATS.you;
    const ring = world.ringMat.uniforms;
    // One thin, fast wave, gone before the words land: a pulse, not a target.
    ring.uR.value = since > 0 ? shot.dist * 0.6 * (1 - Math.exp(-since * 3.2)) : 0;
    ring.uW.value = Math.max(0.25, shot.dist * 0.0035);
    ring.uA.value = since > 0 ? 0.9 * Math.exp(-since * 3.0) : 0;
    ring.uGlowR.value = Math.max(0.5, shot.dist * 0.05);
    // Fades with the city: the last frame is the red light alone on black,
    // because the app's own red dot takes over from exactly that.
    ring.uGlow.value = red * (0.3 + 0.5 * Math.exp(-Math.max(0, since) * 3)) * fade;

    fx.bloom.intensity = 1.5 + 1.2 * red * Math.exp(-Math.max(0, since) * 2);
  }, [t, camera, world, fx, width, height]);

  useFrame(() => {
    fx.composer.render();
  }, 1);

  return null;
};
