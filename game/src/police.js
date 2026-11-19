// The Palmera PD: cruisers spawn at the city edge when the wanted level rises,
// chase the player's car (or the player on foot), ram to stop them, and back
// off when the heat fades. Busted happens when a cruiser pins the player on
// foot at high wanted, or the player's health hits zero.
import { createCar, syncCarMesh } from './vehicles.js';
import { CITY, NAMES, WANTED } from './config.js';
import { roadCentres } from './world.js';

export function createPolice(scene) {
  return { cars: [], spawnTimer: 0, callsignIdx: 0 };
}

function spawnCruiser(police, scene, rng, near) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = 55;
  const x = near.x + Math.sin(angle) * dist;
  const z = near.z + Math.cos(angle) * dist;
  const car = createCar(scene, x, z, Math.atan2(near.x - x, near.z - z), 0xf2f2f2, true);
  car.driver = 'police';
  car.role = 'chase'; // v5.1 (P3): 'chase' | 'block' (roadblock)
  car.speed = 0;
  car.cruise = 20;
  // v5 (g2): a stable callsign from the §3.5 pool, taken in spawn order —
  // the PD response panel reads it for the cruiser's whole life.
  car.callsign = NAMES.callsigns[police.callsignIdx % NAMES.callsigns.length];
  police.callsignIdx += 1;
  police.cars.push(car);
  return car;
}

// v5 (g2): the panel status was DERIVED FROM GEOMETRY ONLY — ROADBLOCK
// meant a cruiser happened to sit ahead of the player. v5.1 (P3): there
// is a real roadblock tactic now (below), and the status tells the truth
// about behaviour: a unit assigned to block reads ROADBLOCK, contact
// range reads RAMMING, everything else is PURSUIT.
export function policeStatus(car, target, targetHeading) {
  if (car.role === 'block') return 'ROADBLOCK';
  const dx = car.pos.x - target.x;
  const dz = car.pos.z - target.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 12) return 'RAMMING';
  return 'PURSUIT';
}

// v5.1 (P3): where a blocker should park — on the road the target is
// about to use, ~52 m ahead of it, snapped to that road's centre line so
// the car sits across the traffic lanes, nose perpendicular to the flow.
// `slot` spreads two blockers end-to-end across the road's width.
function computeBlockPoint(target, slot) {
  const dirX = Math.sin(target.heading);
  const dirZ = Math.cos(target.heading);
  const ax = target.x + dirX * 52;
  const az = target.z + dirZ * 52;
  const centres = roadCentres();
  let cx = centres[0];
  let cz = centres[0];
  for (const c of centres) {
    if (Math.abs(ax - c) < Math.abs(ax - cx)) cx = c;
    if (Math.abs(az - c) < Math.abs(az - cz)) cz = c;
  }
  const off = slot === 0 ? 0 : slot === 1 ? -2.4 : 2.4;
  if (Math.abs(ax - cx) <= Math.abs(az - cz)) {
    // Vertical road (flow along z): cars face ±x, spread along x.
    return { x: cx + off, z: az, heading: Math.PI / 2 };
  }
  // Horizontal road (flow along x): cars face ±z, spread along z.
  return { x: ax, z: cz + off, heading: 0 };
}

function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

// Keep the roadblock assignments honest: at CODE 4+ the nearest chasers
// to the block point become blockers (1, or 2 once 5+ units are out);
// below CODE 4 every unit goes back to chasing.
function manageRoadblocks(police, target, wanted) {
  const hasHeading = typeof target.heading === 'number';
  const wantBlockers = wanted >= 4 && hasHeading ? (police.cars.length >= 5 ? 2 : 1) : 0;
  let blockers = police.cars.filter((c) => c.role === 'block');
  if (blockers.length > wantBlockers) {
    for (const extra of blockers.slice(wantBlockers)) {
      extra.role = 'chase';
      extra.blockPoint = null;
      extra.blockParked = false;
    }
    blockers = blockers.slice(0, wantBlockers);
  }
  if (wantBlockers > 0 && blockers.length < wantBlockers) {
    const probe = computeBlockPoint(target, 0);
    const chasers = police.cars
      .filter((c) => c.role !== 'block')
      .sort((a, b) => Math.hypot(a.pos.x - probe.x, a.pos.z - probe.z) - Math.hypot(b.pos.x - probe.x, b.pos.z - probe.z));
    for (const car of chasers.slice(0, wantBlockers - blockers.length)) {
      car.role = 'block';
      car.blockPoint = null;
      car.blockParked = false;
      blockers.push(car);
    }
  }
  // (Re)assign points: a point is stale when the target has driven past
  // it, left it far behind, or it was never set.
  blockers.forEach((car, i) => {
    const slot = blockers.length > 1 ? i + 1 : 0;
    if (!car.blockPoint) {
      car.blockPoint = computeBlockPoint(target, slot);
      return;
    }
    const bp = car.blockPoint;
    const dirX = Math.sin(target.heading);
    const dirZ = Math.cos(target.heading);
    const past = (target.x - bp.x) * dirX + (target.z - bp.z) * dirZ;
    const far = Math.hypot(target.x - bp.x, target.z - bp.z);
    if (past > 12 || far > 85) {
      car.blockPoint = computeBlockPoint(target, slot);
      car.blockParked = false;
    }
  });
}

// Shared cruiser locomotion: steer toward a point at a cruise speed,
// with the long-standing building bounce. Returns the distance to it.
function driveToward(car, dt, world, tx, tz, cruise) {
  const dx = tx - car.pos.x;
  const dz = tz - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  const diff = wrapAngle(desired - car.heading);
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const targetSpeed = dist > 90 ? cruise : cruise * 0.8;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  if (world.hitsBuilding(nx, nz, 2.2)) {
    car.heading += Math.PI / 3;
    car.speed *= 0.5;
  } else {
    const fixed = world.collide(nx, nz, 2.2);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
  }
  return dist;
}

export function stepPolice(police, dt, scene, rng, target, wanted, world) {
  // v5.1 (P3): cruisers on the street per star level (config table) —
  // 2/3/4/6/7 for 1–5 stars (was a flat min(stars, 5)).
  const want = WANTED.unitsPerStar[Math.max(0, Math.min(WANTED.max, wanted))] || 0;
  police.spawnTimer -= dt;
  if (police.cars.length < want && police.spawnTimer <= 0) {
    spawnCruiser(police, scene, rng, target);
    police.spawnTimer = 2.5;
  }
  manageRoadblocks(police, target, wanted);
  let busted = false;
  for (const car of police.cars) {
    let dist;
    if (car.role === 'block' && car.blockPoint) {
      // Roadblock: race to the point ahead of the target, then park
      // across the road and hold the line. The approach slows with
      // distance — at full cruise the 2.4 rad/s steering makes the car
      // orbit a static point forever instead of settling on it.
      const bp = car.blockPoint;
      const dPoint = Math.hypot(bp.x - car.pos.x, bp.z - car.pos.z);
      if (dPoint > 5) {
        const cruise = dPoint > 40 ? 33 : Math.max(7, dPoint * 0.8);
        driveToward(car, dt, world, bp.x, bp.z, cruise);
        car.blockParked = false;
      } else {
        car.speed += (0 - car.speed) * Math.min(1, dt * 4);
        const diff = wrapAngle(bp.heading - car.heading);
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
        const fixed = world.collide(nx, nz, 2.2);
        car.pos.x = fixed.x;
        car.pos.z = fixed.z;
        car.blockParked = Math.abs(car.speed) < 0.5;
      }
      dist = Math.hypot(target.x - car.pos.x, target.z - car.pos.z);
    } else {
      const cruise = wanted > 0 ? 24 + wanted * 1.5 : 0;
      dist = driveToward(car, dt, world, target.x, target.z, cruise);
    }
    syncCarMesh(car);
    // Ram: close contact with the target hurts and slows it.
    if (dist < 4.5) {
      car.ram = (car.ram || 0) + dt;
      if (car.ram > 0.8) {
        car.ram = 0;
        if (typeof target.onRam === 'function') target.onRam(dist);
      }
    } else {
      car.ram = 0;
    }
    // On foot at high wanted, a cruiser that parks on top of the player busts them.
    if (!target.inCar && wanted >= 3 && dist < 3.2) busted = true;
  }
  // Heat gone: cruisers peel off and despawn once far away.
  if (wanted === 0) {
    for (let i = police.cars.length - 1; i >= 0; i -= 1) {
      const car = police.cars[i];
      const d = Math.hypot(car.pos.x - target.x, car.pos.z - target.z);
      if (d > 80) {
        scene.remove(car.mesh);
        police.cars.splice(i, 1);
      }
    }
  }
  return busted;
}

export function policeCount(police) {
  return police.cars.length;
}
