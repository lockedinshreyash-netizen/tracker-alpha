import { useFrame, useThree } from '@react-three/fiber';
import {
  BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass,
  ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CameraState } from './edit';
import { Machine } from './machine/Machine';
import type { FrameState } from './state';

/**
 * Renders the machine through one lens and one post chain. R3F's own render
 * is replaced (useFrame priority 1) — not to animate anything, only so the
 * frame goes through the composer. All state arrives as props.
 */
export const Scene: React.FC<{ s: FrameState; cam: CameraState; width: number; height: number }> = ({ s, cam, width, height }) => {
  const { gl, camera } = useThree();
  const machine = useMemo(() => new Machine(gl), [gl]);

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    composer.addPass(new RenderPass(machine.scene, camera));
    const dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 1, worldFocusRange: 0.5, bokehScale: 3.2 });
    const dofPass = new EffectPass(camera, dof);
    composer.addPass(dofPass);
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.25, luminanceThreshold: 0.62, luminanceSmoothing: 0.25, radius: 0.78 });
    const vignette = new VignetteEffect({ darkness: 0.62, offset: 0.28 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    composer.addPass(new EffectPass(camera, bloom, vignette, tone));
    const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.15 });
    const caPass = new EffectPass(camera, ca);
    composer.addPass(caPass);
    composer.setSize(width, height);
    return { composer, dof, dofPass, bloom, ca, caPass };
  }, [gl, camera, machine, width, height]);

  useEffect(() => () => fx.composer.dispose(), [fx]);

  useLayoutEffect(() => {
    machine.update(s);
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...cam.pos);
    c.up.set(...cam.up);
    c.lookAt(...cam.target);
    c.fov = cam.fov;
    c.near = 0.03;
    c.far = 400;
    c.aspect = width / height;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();

    fx.dofPass.enabled = cam.focus > 0;
    if (cam.focus > 0) {
      fx.dof.cocMaterial.worldFocusDistance = cam.focus;
      fx.dof.cocMaterial.worldFocusRange = cam.focus * 0.35;
    }
    fx.bloom.intensity = 1.1 + 0.9 * s.impact + 0.25 * Math.min(1.5, s.energy);
    const split = 0.0012 * s.step.gear * (s.step.logged ? 1 : 0) + 0.012 * s.shock + 0.006 * s.impact;
    fx.ca.offset.set(split, split * 0.4);
    fx.caPass.enabled = split > 0.0002;
  }, [s, cam, machine, camera, fx, width, height]);

  useFrame(() => {
    fx.composer.render();
  }, 1);

  return null;
};
