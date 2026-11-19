// Lucia "Luz" Vega on foot: a low-poly figure whose legs swing as she walks, a
// third-person camera that trails behind her heading, and simple on-foot rules:
// run with Shift, collide with buildings, and step into a nearby car with E.
import * as THREE from 'three';
import { PALETTE, PLAYER } from './config.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.playerShirt });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.75;
  group.add(head);
  // v5.1 (P4): her hair is the dark pink of her HUD portrait (was plain
  // black), plus the portrait's gold hoop earring and white sneakers —
  // cheap focal detail on the one character the camera lives behind.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a1030 }));
  hair.position.y = 1.78;
  group.add(hair);
  const earring = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd94a }));
  earring.position.set(0.29, 1.62, 0);
  group.add(earring);
  const legGeo = new THREE.BoxGeometry(0.26, 0.75, 0.3);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.18, 0.38, 0);
  group.add(legR);
  // v5.1 (P4): white sneakers ride the legs so they follow the walk swing.
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf2ede4 });
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.42), shoeMat);
    shoe.position.set(0, -0.36, 0.05);
    leg.add(shoe);
  }
  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.24);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.48, 1.15, 0);
  group.add(armR);
  // R3 blob shadow: grounds Luz on the street (same cheap approach as cars).
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.12;
  group.add(blob);
  scene.add(group);
  return {
    mesh: group,
    legL,
    legR,
    armL,
    armR,
    pos: { x: 0, z: 0 },
    heading: 0,
    camYaw: 0,
    camPitch: 0.32,
    walkPhase: 0,
    moving: false,
    inCar: null,
    punchTimer: 0,
    // v5 (g4): stamina is a real, local display state — it drains while
    // sprinting and refills at rest, but running out NEVER slows Luz in
    // v5 (recorded design debt in PLAN §2-g4, not a bug).
    stamina: 100,
  };
}

export function stepPlayer(player, input, dt, world) {
  // v5 (g4): stamina bookkeeping (display only — see createPlayer note).
  if (input.held.run && player.moving) player.stamina = Math.max(0, player.stamina - 22 * dt);
  else player.stamina = Math.min(100, player.stamina + 16 * dt);
  const drag = input.takeDrag();
  player.camYaw -= drag.x * 0.004;
  player.camPitch = Math.max(-0.1, Math.min(1.1, player.camPitch + drag.y * 0.003));
  const fwd = (input.held.forward ? 1 : 0) - (input.held.back ? 1 : 0);
  const strafe = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  const mx = sin * fwd + cos * strafe;
  const mz = cos * fwd - sin * strafe;
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    const nx = player.pos.x + (mx / len) * speed * dt;
    const nz = player.pos.z + (mz / len) * speed * dt;
    const fixed = world.collide(nx, nz, PLAYER.radius);
    player.pos.x = fixed.x;
    player.pos.z = fixed.z;
    player.heading = Math.atan2(mx / len, mz / len);
    player.walkPhase += dt * speed * 1.6;
  }
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.6 : 0;
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.8;
  player.armR.rotation.x = swing * 0.8;
  if (player.punchTimer > 0) {
    player.punchTimer -= dt;
    player.armR.rotation.x = -1.6 * Math.max(0, player.punchTimer / 0.25);
  }
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  player.mesh.visible = !player.inCar;
}

export function playerCameraTarget(player) {
  return { x: player.pos.x, y: 1.6, z: player.pos.z };
}
