import * as THREE from 'three';

/**
 * The 30-day reward, as a sky.
 *
 * Ported from the app's Aurora wallpaper (rewards/wallpapers.ts): the same
 * near-fluorescent greens, the same idea of curtains made of hairline rays
 * over a luminous sheet, with a soft spill so the light falls off instead of
 * stopping at the edge. In the app those are masked DOM elements animated by
 * CSS; here they are a dome shader driven by the frame, because nothing in a
 * render may animate itself.
 */
export const auroraMaterial = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAmount;
      varying vec3 vDir;

      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(float x) { float i = floor(x); float f = fract(x); f = f*f*(3.0-2.0*f); return mix(hash(i), hash(i+1.0), f); }

      // One curtain: azimuth centre, width, skew, height, phase.
      vec3 curtain(float az, float el, float centre, float width, float skew, float height, float phase, float t) {
        float x = (az - centre - skew * (el - 0.1)) / width;
        float sway = 0.18 * sin(t * 0.21 + phase) + 0.08 * sin(t * 0.47 + phase * 2.3);
        x += sway * (0.4 + el);
        float band = smoothstep(1.0, 0.55, abs(x));
        float base = 0.06 + 0.05 * sin(az * 3.0 + phase + t * 0.1);
        float top = base + height * (0.75 + 0.25 * sin(t * 0.13 + phase));
        float v = smoothstep(base - 0.01, base + 0.03, el) * smoothstep(top, base + 0.02, el);
        float edge = smoothstep(base + 0.07, base, el) * smoothstep(base - 0.015, base + 0.01, el);
        float rays = 0.55 + 0.45 * noise(az * 260.0 + phase * 30.0 + t * 0.35) * noise(az * 61.0 - t * 0.12 + phase);
        float shimmer = 0.75 + 0.25 * sin(t * 1.3 + az * 40.0 + phase);
        float sheet = band * v;
        vec3 green = vec3(0.0, 0.94, 0.59);
        vec3 ray = vec3(0.0, 1.0, 0.63);
        vec3 edgeC = vec3(0.70, 1.0, 0.86);
        return green * sheet * 0.35 + ray * sheet * rays * shimmer * 0.65 + edgeC * band * edge * 0.6;
      }

      void main() {
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0));
        float az = atan(d.x, -d.z);
        float t = uTime;
        vec3 col = vec3(0.0);
        col += curtain(az, el, -0.95, 0.42, -0.30, 0.42, 0.0, t);
        col += curtain(az, el, -0.45, 0.30, -0.14, 0.36, 1.7, t);
        col += curtain(az, el, 0.05, 0.40, 0.12, 0.52, 3.1, t);
        col += curtain(az, el, 0.48, 0.28, 0.24, 0.33, 4.4, t);
        col += curtain(az, el, 0.92, 0.42, -0.19, 0.46, 5.8, t);
        col += curtain(az, el, 1.45, 0.36, 0.16, 0.38, 7.2, t);
        // Ambient spill: the light falls off across the sky.
        float spill = exp(-pow((el - 0.16) / 0.22, 2.0)) * (0.5 + 0.5 * cos(az * 1.2));
        col += vec3(0.0, 0.35, 0.22) * spill * 0.22;
        float horizon = smoothstep(-0.02, 0.04, el);
        gl_FragColor = vec4(col * uAmount * horizon * 1.25, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
  });
