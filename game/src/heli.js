// v5 helicopter (f1–f3): a purely VISUAL Palmera PD air unit. It appears at
// 3+ stars, orbits behind/above the player, and paints a searchlight cone +
// ground pool. It has no heat, damage or bust of its own — police.js is
// untouched. Rotor spin runs on an accumulated dt clock (heli.t), never
// performance.now(), so screenshot frames stay deterministic.
import * as THREE from 'three';

export function createHeli(scene) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2456c8 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x22303c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 4.6), white);
  group.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 4.2), dark);
  belly.position.y = -0.85;
  group.add(belly);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.32, 4.0), blue);
  stripe.position.y = 0.05;
  group.add(stripe);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 1.3), glass);
  cockpit.position.set(0, 0.28, 1.95);
  cockpit.rotation.x = -0.15;
  group.add(cockpit);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), white);
  boom.position.set(0, 0.35, -4.3);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.9), blue);
  fin.position.set(0, 0.85, -6.5);
  group.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.2), dark);
  tailRotor.position.set(0.3, 0.85, -6.5);
  group.add(tailRotor);
  for (const sx of [-0.95, 0.95]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skid.position.set(sx, -1.5, 0);
    group.add(skid);
    for (const sz of [-1.1, 1.1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), dark);
      strut.position.set(sx, -1.15, sz);
      group.add(strut);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 8), dark);
  mast.position.y = 0.95;
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.25;
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.06, 0.5), dark);
  rotor.add(bladeA);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 7.8), dark);
  rotor.add(bladeB);
  group.add(rotor);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.27;
  group.add(disc);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3040 }));
  strobe.position.set(0, 1.6, -6.5);
  group.add(strobe);
  // Searchlight cone (f3): apex at the belly, base radius 6.5 m on the
  // ground 37 m below cruise height. Additive, no real light.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(5, 37, 20, 1, true),
    // FrontSide + low opacity: DoubleSide at 0.10 stacked into a solid grey
    // lampshade in the first staged chase frame (Tahap 4 QA).
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide }),
  );
  cone.position.y = -18.5;
  cone.visible = false;
  group.add(cone);
  group.visible = false;
  scene.add(group);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.14;
  pool.visible = false;
  scene.add(pool);
  return {
    group, rotor, tailRotor, cone, pool,
    t: 0, angle: 0, active: false, awayTimer: 0, wasActive: false,
  };
}

export function stepHeli(heli, dt, target, stars) {
  heli.t += dt;
  const want = stars >= 3;
  if (want) {
    heli.active = true;
    heli.awayTimer = 0;
  } else if (heli.active) {
    // Lingers 4 s after the heat drops below 3 stars, then leaves (f2).
    heli.awayTimer += dt;
    if (heli.awayTimer > 4) heli.active = false;
  }
  heli.group.visible = heli.active;
  const lit = heli.active && stars >= 3;
  heli.cone.visible = lit;
  heli.pool.visible = lit;
  if (!heli.active) {
    heli.wasActive = false;
    return;
  }
  if (!heli.wasActive) {
    // Arrive already on station behind the player instead of flying in
    // from the world origin.
    heli.group.position.set(target.x - 20, 36, target.z - 26);
    heli.wasActive = true;
  }
  heli.angle += dt * 0.45;
  const R = 34;
  const tx = target.x + Math.sin(heli.angle) * R;
  const tz = target.z + Math.cos(heli.angle) * R;
  const ty = 36 + Math.sin(heli.t * 0.7) * 1.5;
  const k = Math.min(1, dt * 2.5);
  heli.group.position.x += (tx - heli.group.position.x) * k;
  heli.group.position.y += (ty - heli.group.position.y) * k;
  heli.group.position.z += (tz - heli.group.position.z) * k;
  heli.group.rotation.y = Math.atan2(target.x - heli.group.position.x, target.z - heli.group.position.z);
  heli.rotor.rotation.y += dt * 28;
  heli.tailRotor.rotation.x += dt * 40;
  heli.pool.position.x = target.x;
  heli.pool.position.z = target.z;
}
