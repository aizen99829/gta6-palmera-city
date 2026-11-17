// Pedestrians: Palmera locals strolling the sidewalks, chatting in pairs at
// corners, and fleeing when the player throws a punch or fires a shot nearby.
// A knocked-down pedestrian drops a few dollars and gets back up after a while.
import * as THREE from 'three';
import { CITY } from './config.js';
import { roadCentres } from './world.js';

const SHIRTS = [0x4a90d9, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12, 0xecf0f1, 0x34495e, 0xe74c3c];

export function createPedestrians(scene, rng, world) {
  const centres = roadCentres();
  const peds = [];
  const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.35);
  const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.26);
  for (let i = 0; i < 22; i += 1) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    const torso = new THREE.Mesh(bodyGeo, shirt);
    torso.position.y = 1.1;
    group.add(torso);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: rng.pick([0xc98a5e, 0x8a5a3b, 0xe8b98a]) }));
    head.position.y = 1.7;
    group.add(head);
    const legL = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
    legL.position.set(-0.15, 0.35, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
    legR.position.set(0.15, 0.35, 0);
    group.add(legR);
    // Sidewalk spot: just off a road centreline.
    const horizontal = rng.next() < 0.5;
    const road = rng.pick(centres);
    const along = rng.range(-world.half, world.half);
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = horizontal ? along : road + side * (CITY.roadHalf + 2.5);
    const z = horizontal ? road + side * (CITY.roadHalf + 2.5) : along;
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      mesh: group, legL, legR,
      pos: { x, z },
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(0.8, 1.6),
      target: null,
      down: 0,
      flee: 0,
      phase: rng.range(0, 6),
      horizontal,
    });
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
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
    ped.mesh.rotation.y = ped.heading;
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
