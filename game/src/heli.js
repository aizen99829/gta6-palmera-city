// heli.js — the Palmera PD air unit. Pure presence: at 3 stars or more
// it slides in, orbits the target at roughly 33 m with its searchlight
// cone and ground pool locked on, and leaves when the heat dies. It
// never adds heat, damage or a bust by itself.
import * as THREE from 'three';
import { radialGlowTexture } from './textures.js';

export function createHeli(scene) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f3f5 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23262e });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2266cc });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 4.6), white);
  body.position.y = 0; group.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 4.2), dark);
  belly.position.y = -0.95; group.add(belly);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.34, 4.0), blue);
  stripe.position.y = 0.25; group.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.2),
    new THREE.MeshPhongMaterial({ color: 0x2a3a4d, shininess: 120, specular: 0xffffff }));
  glass.position.set(0, 0.35, 2.2); group.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), white);
  boom.position.set(0, 0.3, -4.4); group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.7), blue);
  fin.position.set(0, 0.8, -6.6); group.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.18), dark);
  tailRotor.position.set(0.2, 0.8, -6.6); group.add(tailRotor);
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skid.position.set(sx, -1.5, 0); group.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), dark);
    strut.position.set(sx, -1.2, 0.6); group.add(strut);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), dark);
  mast.position.y = 1.15; group.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.55;
  for (const rz of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.5), dark);
    blade.rotation.y = rz; rotor.add(blade);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  group.add(rotor);
  const strobe = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture('rgba(255,80,80,1)'), color: 0xff4040, transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  strobe.position.set(0, 0.9, -6.6); strobe.scale.setScalar(1.6); group.add(strobe);
  group.visible = false;
  scene.add(group);
  // Searchlight: an additive cone from the belly to the ground plus a
  // bright pool that tracks the target. No real light is added.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 38, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.visible = false; scene.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6.4, 22),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.14; pool.visible = false; scene.add(pool);

  const heli = {
    group, cone, pool, active: false, angle: 0.6, leaveTimer: 0, rotorSpin: 0,
    step(dt, target, stars, time) {
      const want = stars >= 3;
      if (want) { heli.active = true; heli.leaveTimer = 0; }
      else if (heli.active) {
        heli.leaveTimer += dt;
        if (heli.leaveTimer > 4) heli.active = false;
      }
      group.visible = heli.active;
      const lit = heli.active && stars >= 3;
      cone.visible = lit; pool.visible = lit;
      if (!heli.active) return;
      heli.angle += dt * 0.22;
      heli.rotorSpin += dt * 28;
      rotor.rotation.y = heli.rotorSpin;
      tailRotor.rotation.x = heli.rotorSpin * 1.7;
      strobe.material.opacity = (Math.floor(time * 2.4) % 2 === 0) ? 0.95 : 0.15;
      const R = 33;
      const hx = target.x + Math.sin(heli.angle) * R;
      const hz = target.z + Math.cos(heli.angle) * R;
      const k = Math.min(1, dt * 2.2);
      group.position.x += (hx - group.position.x) * k;
      group.position.z += (hz - group.position.z) * k;
      group.position.y = 36;
      group.lookAt(target.x, 0, target.z);
      if (lit) { // aim the cone from the belly down to the target
        cone.position.set((group.position.x + target.x) / 2, 18, (group.position.z + target.z) / 2);
        cone.lookAt(target.x, 0, target.z);
        cone.rotateX(-Math.PI / 2);
        pool.position.set(target.x, 0.14, target.z);
      }
    },
  };
  group.position.set(0, 36, 240);
  return heli;
}
