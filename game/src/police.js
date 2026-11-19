// police.js — Palmera PD. Cruisers spawn on the road grid while the
// player is wanted, in numbers set by UNITS_PER_STAR. Most units run a
// pursuit steer toward the target; at 3 stars or more the two nearest
// units take a ROADBLOCK role: they race to a point ~52 m ahead of the
// target's heading, snap it to that road's centre line and park across
// the lanes, perpendicular, with a third unit waiting behind them.
// Contact at speed rams the target (reported through ctx.onRam).
import { UNITS_PER_STAR, CALLSIGNS, CITY } from './config.js';
import { createCar, driveCar, syncCarMesh } from './vehicles.js';
import { clamp, headingTo, wrapAngle } from './random.js';

export function policeStatus(car, targetPos) {
  if (car.role === 'block') return 'ROADBLOCK';
  const d = Math.hypot(car.pos.x - targetPos.x, car.pos.z - targetPos.z);
  return d < 12 ? 'RAMMING' : 'PURSUIT';
}

export function createPolice(scene, world) {
  const cars = [];
  let spawnTimer = 0;
  let callsignIdx = 0;
  let blockPoint = null;
  let blockTimer = 0;

  function spawnPos(target) {
    // Nearest road point roughly 60 m from the target, behind them if possible.
    const c = CITY.roadCentres;
    const nx = c.reduce((b, v) => (Math.abs(v - target.x) < Math.abs(b - target.x) ? v : b), c[0]);
    const nz = c.reduce((b, v) => (Math.abs(v - target.z) < Math.abs(b - target.z) ? v : b), c[0]);
    const spots = [
      { x: nx, z: target.z - 62 }, { x: nx, z: target.z + 62 },
      { x: target.x - 62, z: nz }, { x: target.x + 62, z: nz },
    ];
    for (const s of spots) {
      s.x = clamp(s.x, -190, 190); s.z = clamp(s.z, -190, 210);
      if (!world.hitsBuilding(s, 2.2)) return s;
    }
    return { x: nx, z: clamp(target.z - 62, -190, 210) };
  }
  function spawn(target) {
    const p = spawnPos(target);
    const car = createCar(scene, 'police', 0xffffff, p.x, p.z, headingTo(p.x, p.z, target.x, target.z));
    car.callsign = CALLSIGNS[callsignIdx % CALLSIGNS.length]; callsignIdx += 1;
    car.maxSpeed = 36.5;
    cars.push(car);
  }
  function despawn(car) {
    scene.remove(car.mesh);
    cars.splice(cars.indexOf(car), 1);
  }

  function step(dt, ctx) {
    const { target, targetHeading, stars, time } = ctx;
    const want = UNITS_PER_STAR[clamp(stars, 0, 5)] || 0;
    if (stars > 0 && cars.length > want) { // heat dropped: surplus units peel off
      const sorted = cars.slice().sort((a, b) =>
        Math.hypot(b.pos.x - target.x, b.pos.z - target.z) - Math.hypot(a.pos.x - target.x, a.pos.z - target.z));
      while (cars.length > want && sorted.length) despawn(sorted.shift());
    }
    spawnTimer -= dt;
    if (stars > 0 && cars.length < want && spawnTimer <= 0) {
      spawn(target);
      spawnTimer = 0.45;
    }
    if (stars === 0) { // heat gone: units peel off and despawn when far
      blockPoint = null;
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        car.role = 'leave';
        driveCar(car, { forward: car.speed < 16, back: false, left: false, right: false, brake: false }, dt, world);
        syncCarMesh(car, time);
        if (Math.hypot(car.pos.x - target.x, car.pos.z - target.z) > 90) despawn(car);
      }
      return;
    }
    // ---- roadblock assignment (3 stars and up) ----
    blockTimer -= dt;
    if (stars >= 3 && blockTimer <= 0) {
      const fx = Math.sin(targetHeading); const fz = Math.cos(targetHeading);
      let px = target.x + fx * 52; let pz = target.z + fz * 52;
      // Snap to the centre line of the road the target is travelling on.
      if (Math.abs(fx) > Math.abs(fz)) {
        pz = CITY.roadCentres.reduce((b, v) => (Math.abs(v - pz) < Math.abs(b - pz) ? v : b), CITY.roadCentres[0]);
      } else {
        px = CITY.roadCentres.reduce((b, v) => (Math.abs(v - px) < Math.abs(b - px) ? v : b), CITY.roadCentres[0]);
      }
      const passed = blockPoint && ((blockPoint.x - target.x) * fx + (blockPoint.z - target.z) * fz) < -6;
      if (!blockPoint || passed || Math.hypot(blockPoint.x - px, blockPoint.z - pz) > 26) {
        blockPoint = { x: clamp(px, -190, 190), z: clamp(pz, -190, 214) };
        blockTimer = 2.5;
        const sorted = cars.slice().sort((a, b) =>
          Math.hypot(a.pos.x - blockPoint.x, a.pos.z - blockPoint.z) -
          Math.hypot(b.pos.x - blockPoint.x, b.pos.z - blockPoint.z));
        cars.forEach((c) => { if (c.role === 'block') c.role = 'chase'; });
        sorted.slice(0, Math.min(2, sorted.length)).forEach((c, i) => {
          c.role = 'block'; c.blockSlot = i;
        });
      }
    }
    if (stars < 3) { blockPoint = null; cars.forEach((c) => { c.role = 'chase'; }); }
    // ---- per-unit driving ----
    for (const car of cars) {
      car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
      let input; let arriveAt = null;
      if (car.role === 'block' && blockPoint) {
        // Park end-to-end across the lane: slots offset along the target's axis.
        const fx = Math.sin(targetHeading); const fz = Math.cos(targetHeading);
        const slotOff = (car.blockSlot === 0 ? -2.2 : 2.2);
        arriveAt = { x: blockPoint.x + fx * slotOff, z: blockPoint.z + fz * slotOff, heading: wrapAngle(targetHeading + Math.PI / 2) };
        const d = Math.hypot(arriveAt.x - car.pos.x, arriveAt.z - car.pos.z);
        if (d < 2.4) { // parked: hold position, nose perpendicular
          car.speed = 0;
          car.heading = arriveAt.heading;
          car.mesh.position.set(car.pos.x, 0, car.pos.z);
          car.mesh.rotation.y = car.heading;
          syncCarMesh(car, time);
          continue;
        }
        const desired = headingTo(car.pos.x, car.pos.z, arriveAt.x, arriveAt.z);
        const err = wrapAngle(desired - car.heading);
        input = {
          forward: Math.abs(err) < 1.2 && car.speed < (d > 26 ? 30 : d > 10 ? 16 : 7),
          back: Math.abs(err) >= 1.2 && car.speed > 2,
          left: err > 0.1, right: err < -0.1, brake: false,
        };
      } else {
        // Pursuit: aim at a short prediction of the target's position.
        const lead = clamp(Math.hypot(target.x - car.pos.x, target.z - car.pos.z) * 0.04, 0, 0.5);
        const px = target.x + Math.sin(targetHeading) * (ctx.targetSpeed || 0) * lead;
        const pz = target.z + Math.cos(targetHeading) * (ctx.targetSpeed || 0) * lead;
        const desired = headingTo(car.pos.x, car.pos.z, px, pz);
        const err = wrapAngle(desired - car.heading);
        input = {
          forward: Math.abs(err) < 1.25,
          back: Math.abs(err) >= 1.25 && car.speed > 2,
          left: err > 0.09, right: err < -0.09, brake: false,
        };
      }
      const before = car.speed;
      driveCar(car, input, dt, world);
      if (car.speed > (car.maxSpeed || 36.5)) car.speed = car.maxSpeed || 36.5;
      void before;
      // Ram contact with the target.
      const dT = Math.hypot(car.pos.x - target.x, car.pos.z - target.z);
      if (dT < 3.1 && car.hitCooldown <= 0 && Math.abs(car.speed) > 3) {
        car.hitCooldown = 0.9;
        ctx.onRam(car);
      }
      syncCarMesh(car, time);
    }
  }
  return { cars, step };
}
