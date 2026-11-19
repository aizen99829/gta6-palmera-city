// pedestrians.js — citizens strolling the sidewalks. They walk along a
// road edge, turn around at block ends, sprint away from nearby danger
// (gunfire, a chase, a car mounting the pavement) and fall down for a
// few seconds when punched before getting back up.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp, headingTo } from './random.js';

const COATS = [0xff9f43, 0x53d8e8, 0xf5f6fa, 0x10ac84, 0xe879f9, 0xee5253, 0xffd76a];
export function createPeds(scene, world, rng) {
  const list = [];
  for (let i = 0; i < 14; i += 1) {
    const g = new THREE.Group();
    const coat = new THREE.MeshLambertMaterial({ color: rng.pick(COATS) });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 3, 8), coat);
    torso.position.y = 1.0; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8),
      new THREE.MeshLambertMaterial({ color: rng.pick([0xc98a5e, 0x8a5a3a, 0xe8b088]) }));
    head.position.y = 1.68; g.add(head);
    const legs = [];
    for (const x of [-0.13, 0.13]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.6, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 3, 6),
        new THREE.MeshLambertMaterial({ color: 0x2c3040 }));
      leg.position.y = -0.3; pivot.add(leg); g.add(pivot); legs.push(pivot);
    }
    scene.add(g);
    const vertical = rng.chance(0.5);
    const line = rng.pick(CITY.roadCentres) + (rng.chance(0.5) ? 8.4 : -8.4);
    list.push({
      pos: { x: vertical ? line : rng.range(-180, 180), z: vertical ? rng.range(-180, 180) : line },
      heading: rng.range(0, Math.PI * 2), vertical, line,
      speed: rng.range(1.1, 1.7), dir: rng.chance(0.5) ? 1 : -1,
      fallTimer: 0, fleeTimer: 0, cycle: rng.range(0, 6), mesh: g, legs,
      fall() { this.fallTimer = 3.2; },
    });
  }
  function step(dt, threat) {
    for (const p of list) {
      if (p.fallTimer > 0) {
        p.fallTimer -= dt;
        p.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (3.2 - p.fallTimer) * 4 + 0.2);
        p.mesh.position.set(p.pos.x, 0.25, p.pos.z);
        continue;
      }
      p.mesh.rotation.x = 0;
      let speed = p.speed;
      let dirX = 0; let dirZ = 0;
      if (threat && Math.hypot(threat.x - p.pos.x, threat.z - p.pos.z) < 16) p.fleeTimer = 1.6;
      if (p.fleeTimer > 0 && threat) { // run directly away from the danger
        p.fleeTimer -= dt;
        const a = headingTo(threat.x, threat.z, p.pos.x, p.pos.z);
        dirX = Math.sin(a); dirZ = Math.cos(a); speed = 5.2;
        p.heading = a;
      } else if (p.vertical) {
        dirZ = p.dir;
        if (p.pos.z > 188 || p.pos.z < -188) p.dir *= -1;
        p.heading = p.dir > 0 ? 0 : Math.PI;
      } else {
        dirX = p.dir;
        if (p.pos.x > 188 || p.pos.x < -188) p.dir *= -1;
        p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      p.pos.x = clamp(p.pos.x + dirX * speed * dt, -195, 195);
      p.pos.z = clamp(p.pos.z + dirZ * speed * dt, -195, 218);
      world.collide(p.pos, 0.4);
      p.cycle += dt * speed * 3.4;
      const swing = Math.sin(p.cycle) * 0.5;
      p.legs[0].rotation.x = swing; p.legs[1].rotation.x = -swing;
      p.mesh.position.set(p.pos.x, 0, p.pos.z);
      p.mesh.rotation.y = p.heading;
    }
  }
  return { list, step };
}
