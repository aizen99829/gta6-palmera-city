// Pedestrians: Palmera locals strolling the sidewalks, chatting in pairs at
// corners, and fleeing when the player throws a punch or fires a shot nearby.
// A knocked-down pedestrian drops a few dollars and gets back up after a while.
import * as THREE from 'three';
import { CITY } from './config.js';
import { roadCentres } from './world.js';

const SHIRTS = [0x4a90d9, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12, 0xecf0f1, 0x34495e, 0xe74c3c];
const SKINS = [0xc98a5e, 0x8a5a3b, 0xe8b98a];
const PANTS = [0x2e3a4a, 0x5a4632, 0x707a84, 0x384048, 0x7a3b2e];
const HAIR = [0x1a1210, 0x3a2415, 0x6a4a2a, 0xb8b0a4];
const BODY_GEO = new THREE.BoxGeometry(0.6, 0.9, 0.35);
const HEAD_GEO = new THREE.SphereGeometry(0.24, 10, 8);
const LEG_GEO = new THREE.BoxGeometry(0.22, 0.7, 0.26);
const ARM_GEO = new THREE.BoxGeometry(0.18, 0.65, 0.22);
const HAIR_GEO = new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);

// Stage one pedestrian at an exact spot (used by shots.js to cluster locals
// near the player). Deterministic: shirt/skin come from the caller's rng.
export function spawnPed(scene, rng, x, z, heading) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const torso = new THREE.Mesh(BODY_GEO, shirt);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(HEAD_GEO, new THREE.MeshLambertMaterial({ color: rng.pick(SKINS) }));
  head.position.y = 1.7;
  group.add(head);
  // v2: most locals get hair (the player figure has it too) — a bare sphere
  // head on every ped read as a peg at contact-sheet scale.
  if (rng.next() < 0.7) {
    const hair = new THREE.Mesh(HAIR_GEO, new THREE.MeshLambertMaterial({ color: rng.pick(HAIR) }));
    hair.position.y = 1.73;
    group.add(hair);
  }
  const pantsMat = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const legL = new THREE.Mesh(LEG_GEO, pantsMat);
  legL.position.set(-0.15, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(LEG_GEO, pantsMat);
  legR.position.set(0.15, 0.35, 0);
  group.add(legR);
  // v2: arms that swing against the legs (the player figure already had
  // them; armless peds were the "capsule" read the R3 review flagged).
  const armL = new THREE.Mesh(ARM_GEO, shirt);
  armL.position.set(-0.42, 1.12, 0);
  group.add(armL);
  const armR = new THREE.Mesh(ARM_GEO, shirt);
  armR.position.set(0.42, 1.12, 0);
  group.add(armR);
  // v2: locals are not all the same height.
  group.scale.setScalar(rng.range(0.92, 1.08));
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  // R3 blob shadow, kept out of the group: the group tips over (rotation.x)
  // when a ped is knocked down, which would stand the blob upright. The
  // blob lives in the scene and is synced in stepPedestrians.
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(x, 0.12, z);
  scene.add(blob);
  return {
    mesh: group, legL, legR, armL, armR, blob,
    pos: { x, z },
    heading,
    speed: rng.range(0.8, 1.6),
    target: null,
    down: 0,
    flee: 0,
    phase: rng.range(0, 6),
    horizontal: true,
  };
}

export function createPedestrians(scene, rng, world) {
  const centres = roadCentres();
  const peds = [];
  for (let i = 0; i < 22; i += 1) {
    // Sidewalk spot: just off a road centreline.
    const horizontal = rng.next() < 0.5;
    const road = rng.pick(centres);
    const along = rng.range(-world.half, world.half);
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = horizontal ? along : road + side * (CITY.roadHalf + 2.5);
    const z = horizontal ? road + side * (CITY.roadHalf + 2.5) : along;
    const ped = spawnPed(scene, rng, x, z, rng.range(0, Math.PI * 2));
    ped.horizontal = horizontal;
    peds.push(ped);
  }
  return peds;
}

function pickTarget(ped, rng, world) {
  const centres = roadCentres();
  const road = rng.pick(centres);
  const along = rng.range(-world.half, world.half);
  const side = rng.next() < 0.5 ? -1 : 1;
  if (ped.horizontal) return { x: along, z: road + side * (CITY.roadHalf + 2.5) };
  return { x: road + side * (CITY.roadHalf + 2.5), z: along };
}

export function stepPedestrians(peds, dt, rng, world, threat) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = ped.down > 0 ? -Math.PI / 2 + 0.2 : 0;
      if (ped.down <= 0) ped.mesh.rotation.x = 0;
      continue;
    }
    let speed = ped.speed;
    if (threat) {
      const d = Math.hypot(threat.x - ped.pos.x, threat.z - ped.pos.z);
      if (d < 14) {
        ped.flee = 2.5;
        ped.target = { x: ped.pos.x + (ped.pos.x - threat.x) * 2, z: ped.pos.z + (ped.pos.z - threat.z) * 2 };
        speed = 4.5;
      }
    }
    if (ped.flee > 0) ped.flee -= dt;
    else if (!ped.target || Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 2) {
      ped.target = pickTarget(ped, rng, world);
    }
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      ped.heading = Math.atan2(dx / dist, dz / dist);
      const fixed = world.collide(ped.pos.x + (dx / dist) * speed * dt, ped.pos.z + (dz / dist) * speed * dt, 0.5);
      ped.pos.x = fixed.x;
      ped.pos.z = fixed.z;
      ped.phase += dt * speed * 3;
    }
    ped.legL.rotation.x = Math.sin(ped.phase) * 0.5;
    ped.legR.rotation.x = -Math.sin(ped.phase) * 0.5;
    if (ped.armL && ped.armR) {
      ped.armL.rotation.x = -Math.sin(ped.phase) * 0.45;
      ped.armR.rotation.x = Math.sin(ped.phase) * 0.45;
    }
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
    ped.mesh.rotation.y = ped.heading;
    if (ped.blob) ped.blob.position.set(ped.pos.x, 0.12, ped.pos.z);
  }
}

export function nearestPed(peds, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of peds) {
    if (ped.down > 0) continue;
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
