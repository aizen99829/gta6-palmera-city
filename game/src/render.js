// render.js — the three.js renderer, the sunset grade, the follow
// camera and the mission beacon. Resolution is adaptive on fine
// pointers: start at pixelRatio 2.0 and walk a ladder
// 2.0 → 1.75 → 1.5 → 1.25 following an EMA of frame time (back up when
// frames get light again). EVERY pixelRatio change is followed by a
// setSize call — without it three.js never resizes the drawing buffer
// (a real bug in an earlier build). Coarse pointers stay at a fixed 1.5.
import * as THREE from 'three';
import { setMaxAnisotropy, radialGlowTexture } from './textures.js';
import { clamp, lerp, wrapAngle } from './random.js';

export function createRender(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1600);
  camera.position.set(0, 30, 240);
  setMaxAnisotropy(Math.min(2, renderer.capabilities.getMaxAnisotropy()));

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const LADDER = [1.25, 1.5, 1.75, 2.0];
  let rung = LADDER.length - 1;
  let emaMs = 16; let framesSinceEval = 0; let lightStreak = 0;
  function applySize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const pr = coarse ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, LADDER[rung]);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  applySize();
  window.addEventListener('resize', applySize);

  let camHeading = 0; let camPos = new THREE.Vector3(0, 26, 250);
  return {
    renderer, scene, camera, canvas: renderer.domElement,
    // dtMs: real milliseconds of the last rAF frame.
    adapt(dtMs) {
      if (coarse) return;
      emaMs = emaMs * 0.92 + dtMs * 0.08;
      framesSinceEval += 1;
      if (framesSinceEval < 45) return;
      framesSinceEval = 0;
      if (emaMs > 24 && rung > 0) { rung -= 1; lightStreak = 0; applySize(); }
      else if (emaMs < 13) {
        lightStreak += 1;
        if (lightStreak >= 3 && rung < LADDER.length - 1) { rung += 1; lightStreak = 0; applySize(); }
      } else lightStreak = 0;
    },
    // Follow camera. opts: { pos, heading (movement facing), dist, pitch, lookAhead }
    follow(dt, opts) {
      const targetHeading = opts.heading;
      const turn = clamp(dt * (opts.inCar ? 3.2 : 6), 0, 1);
      camHeading += wrapAngle(targetHeading - camHeading) * turn;
      const dist = opts.dist || 8;
      const height = Math.sin(opts.pitch || 0.32) * dist + 1.6;
      const back = Math.cos(opts.pitch || 0.32) * dist;
      const tx = opts.pos.x - Math.sin(camHeading) * back;
      const tz = opts.pos.z - Math.cos(camHeading) * back;
      const k = Math.min(1, dt * (opts.snap ? 30 : 7));
      camPos.x += (tx - camPos.x) * k;
      camPos.z += (tz - camPos.z) * k;
      camPos.y += ((opts.pos.y || 0) + height - camPos.y) * k;
      camera.position.copy(camPos);
      const ahead = opts.lookAhead || 7;
      camera.lookAt(opts.pos.x + Math.sin(camHeading) * ahead,
        (opts.pos.y || 0) + 1.4, opts.pos.z + Math.cos(camHeading) * ahead);
    },
    orbit(t, cx, cz, r, hgt) { // slow scenic orbit for the start screen
      camera.position.set(cx + Math.sin(t * 0.05) * r, hgt, cz + Math.cos(t * 0.05) * r);
      camera.lookAt(cx, 4, cz);
    },
    render() { renderer.render(scene, camera); },
  };
}

// The mission beacon: a pillar of sunset-gold light with a pulsing
// ground ring, visible through the dusk from streets away.
export function createBeacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  pillar.position.y = 21; group.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 7.6, 36),
    new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; group.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture('rgba(255,190,90,1)'), color: 0xffb347, transparent: true,
    opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(13); glow.position.y = 2.2; group.add(glow);
  group.visible = false;
  scene.add(group);
  return {
    group,
    set(x, z, visible) { group.position.set(x, 0, z); group.visible = visible; },
    step(t) {
      ring.scale.setScalar(1 + Math.sin(t * 2.6) * 0.08);
      pillar.material.opacity = 0.26 + Math.sin(t * 2.6) * 0.07;
    },
  };
}
export const renderLerp = lerp;
