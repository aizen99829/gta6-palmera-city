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
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 1.78;
  group.add(hair);
  const legGeo = new THREE.BoxGeometry(0.26, 0.75, 0.3);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.18, 0.38, 0);
  group.add(legR);
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
  };
}

export function stepPlayer(player, input, dt, world) {
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
