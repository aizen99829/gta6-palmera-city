// Rendering: the WebGL renderer, the third-person chase camera, and the
// waypoint beacon (a pulsing golden pillar + floating diamond). The camera
// trails behind the player's view direction on foot and behind the car while
// driving, with a smooth lerp so turns never snap.
import * as THREE from 'three';
import { CITY } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.2),
    new THREE.MeshBasicMaterial({ color: 0xffd94a }),
  );
  diamond.position.y = 14;
  beacon.add(diamond);
  beacon.visible = false;
  scene.add(beacon);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  );
  flash.visible = false;
  scene.add(flash);

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
    updateCamera(target, yaw, pitch, dist, dt) {
      const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
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
    draw() {
      renderer.render(scene, camera);
    },
  };
}
