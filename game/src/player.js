// player.js — Luz on foot: a simple articulated figure (capsule torso,
// swinging arms/legs, dark-pink hair, gold hoop earring, white sneakers)
// plus her movement model. Movement is camera-relative; the camera yaw
// is hers to drag. Stamina is a real meter (drains while sprinting,
// refills at rest) shown on the HUD; it never gates her speed.
import * as THREE from 'three';
import { clamp } from './random.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const top = new THREE.MeshLambertMaterial({ color: 0xd81b60 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x23283a });
  const hairM = new THREE.MeshLambertMaterial({ color: 0x4a1030 });
  const shoeM = new THREE.MeshLambertMaterial({ color: 0xf5f6fa });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffcf4d });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.55, 3, 10), top);
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.78; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), hairM);
  hair.position.set(0, 1.86, -0.04); hair.scale.set(1, 0.82, 1); g.add(hair);
  const earring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 12), gold);
  earring.position.set(0.22, 1.7, 0); g.add(earring);
  const limbs = [];
  for (const [x, y, len, mat] of [[-0.42, 1.32, 0.62, top], [0.42, 1.32, 0.62, top],
                                 [-0.16, 0.62, 0.66, pants], [0.16, 0.62, 0.66, pants]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, len, 3, 8), mat);
    limb.position.y = -len / 2; pivot.add(limb);
    if (y < 1) { const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.3), shoeM); shoe.position.set(0, -len - 0.04, 0.05); pivot.add(shoe); }
    g.add(pivot); limbs.push(pivot);
  }
  scene.add(g);
  return {
    pos: { x: 4, z: 178 }, heading: 0, camYaw: 0, camPitch: 0.32,
    radius: 0.55, stamina: 100, inCar: null, mesh: g, limbs, walkCycle: 0, moving: false,
  };
}

export function stepPlayer(player, input, dt, world) {
  let mx = 0; let mz = 0;
  if (input.forward) mz += 1;
  if (input.back) mz -= 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const mag = Math.hypot(mx, mz);
  player.moving = mag > 0;
  if (mag > 0) {
    mx /= mag; mz /= mag;
    const sin = Math.sin(player.camYaw); const cos = Math.cos(player.camYaw);
    const wx = mx * cos + mz * sin;
    const wz = -mx * sin + mz * cos;
    const running = input.run;
    const speed = running ? 6.8 : 3.4;
    player.pos.x += wx * speed * dt;
    player.pos.z += wz * speed * dt;
    player.heading = Math.atan2(wx, wz);
    player.walkCycle += dt * (running ? 11 : 7.5);
    if (running) player.stamina = Math.max(0, player.stamina - 22 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 16 * dt);
  }
  world.collide(player.pos, player.radius);
  const swing = player.moving ? Math.sin(player.walkCycle) * 0.55 : 0;
  player.limbs[0].rotation.x = swing;
  player.limbs[1].rotation.x = -swing;
  player.limbs[2].rotation.x = -swing;
  player.limbs[3].rotation.x = swing;
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  return player.moving;
}
export function syncPlayerToCar(player, car) {
  player.pos.x = car.pos.x; player.pos.z = car.pos.z;
  player.heading = car.heading;
}
