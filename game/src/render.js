// Rendering: the WebGL renderer, the third-person chase camera, and the
// waypoint beacon (a pulsing golden pillar + floating diamond). The camera
// trails behind the player's view direction on foot and behind the car while
// driving, with a smooth lerp so turns never snap.
import * as THREE from 'three';
import { CITY, SUNSET } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // v5.2 (sharpness): fine-pointer (desktop) displays render up to DPR
  // 1.75 — the old 1.5 cap made the browser upscale every retina frame.
  // A full 2.0 cap was measured and rejected: in the software-rendered
  // A/B harness its drive FPS fell 45% (fill-bound at +78% pixels),
  // while 1.75 keeps most of the sharpness gain (+36% pixels over 1.5).
  // Coarse-pointer (mobile) keeps the 1.5 cap exactly: touch performance
  // was audited against it and must not move.
  const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  // v5.3 (adaptive resolution): a static 2.0 cap failed the FPS gate
  // (-45% in the software-rendered harness), but a static 1.75 leaves
  // real GPUs under-used. Fine pointers now START at 2.0 and step down
  // only if the measured frame time says the device cannot hold it:
  // an EMA of rAF deltas is sampled every 45 frames; above 24 ms it
  // steps down one rung (2.0 → 1.75 → 1.5 → 1.25), below 13 ms for
  // three consecutive samples it steps back up (never above the start
  // rung). Coarse pointers keep the audited static 1.5 exactly.
  const DPR_RUNGS = [1.25, 1.5, 1.75, 2.0];
  let dprRung = coarsePointer ? 1 : DPR_RUNGS.length - 1; // index: coarse=1.5 static, fine=start 2.0
  const dprCap = () => (coarsePointer ? 1.5 : DPR_RUNGS[dprRung]);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
  // setPixelRatio alone does not resize the drawing buffer in three.js —
  // it applies on the next setSize, so a rung change must re-apply size.
  function applyDpr() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  let emaMs = 16.7;
  let lastT = 0;
  let sampleFrames = 0;
  let lightStreak = 0;
  function adaptResolution(now) {
    if (coarsePointer) return;
    if (lastT > 0) {
      const dt = now - lastT;
      if (dt > 0 && dt < 2000) emaMs = emaMs * 0.92 + dt * 0.08;
    }
    lastT = now;
    sampleFrames += 1;
    if (sampleFrames < 45) return;
    sampleFrames = 0;
    if (emaMs > 24 && dprRung > 0) {
      dprRung -= 1;
      lightStreak = 0;
      applyDpr();
    } else if (emaMs < 13 && dprRung < DPR_RUNGS.length - 1) {
      lightStreak += 1;
      if (lightStreak >= 3) {
        dprRung += 1;
        lightStreak = 0;
        applyDpr();
      }
    } else {
      lightStreak = 0;
    }
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: SUNSET.beacon, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.2),
    new THREE.MeshBasicMaterial({ color: SUNSET.beacon }),
  );
  diamond.position.y = 14;
  beacon.add(diamond);
  beacon.visible = false;
  scene.add(beacon);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  );
  flash.visible = false;
  scene.add(flash);
  // Tracer: a bright line from the muzzle to the shot's impact point, shown
  // while the muzzle flash is up so a gunshot reads in a still frame.
  const tracer = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 1),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  tracer.visible = false;
  scene.add(tracer);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let camPos = new THREE.Vector3(0, 8, -12);
  return {
    renderer,
    scene,
    camera,
    getPixelRatio: () => renderer.getPixelRatio(),
    // offset shifts the camera sideways (perpendicular to the view) so a
    // shot can favour one side of the street and dodge a flanking wall.
    updateCamera(target, yaw, pitch, dist, dt, offset = 0) {
      const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist + Math.cos(yaw) * offset;
      const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist - Math.sin(yaw) * offset;
      const cy = target.y + Math.sin(pitch) * dist + 1.2;
      const want = new THREE.Vector3(cx, Math.max(1.2, cy), cz);
      camPos.lerp(want, Math.min(1, dt * 6));
      camera.position.copy(camPos);
      camera.lookAt(target.x, target.y + 0.6, target.z);
    },
    setBeacon(pos) {
      if (!pos) {
        beacon.visible = false;
        return;
      }
      beacon.visible = true;
      beacon.position.set(pos.x, 0, pos.z);
      const t = performance.now() / 1000;
      diamond.position.y = 14 + Math.sin(t * 2.5) * 1.2;
      diamond.rotation.y = t;
      pillar.material.opacity = 0.22 + Math.sin(t * 3) * 0.08;
    },
    setFlash(pos) {
      if (!pos) {
        flash.visible = false;
        return;
      }
      flash.visible = true;
      flash.position.set(pos.x, pos.y, pos.z);
    },
    setTracer(from, to) {
      if (!from || !to) {
        tracer.visible = false;
        return;
      }
      tracer.visible = true;
      const dx = to.x - from.x;
      const dy = (to.y ?? 1.2) - (from.y ?? 1.4);
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dy, dz);
      tracer.position.set((from.x + to.x) / 2, ((from.y ?? 1.4) + (to.y ?? 1.2)) / 2, (from.z + to.z) / 2);
      tracer.lookAt(to.x, to.y ?? 1.2, to.z);
      tracer.scale.set(1, 1, Math.max(0.1, len));
    },
    draw(now) {
      adaptResolution(now || performance.now());
      renderer.render(scene, camera);
    },
  };
}
