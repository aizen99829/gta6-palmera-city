// Traffic: AI cars that cruise the road grid, turn at intersections, and slow
// for the car ahead. Parked cars line the kerbs for the player to steal. Each
// traffic car owns a car object from vehicles.js and a simple route state.
import { createCar, syncCarMesh } from './vehicles.js';
import { CITY, PALETTE, SUNSET } from './config.js';
import { roadCentres, isOnRoad } from './world.js';

// v2: pick a body style for ambient traffic (shots stage their own kinds).
function pickKind(rng) {
  const r = rng.next();
  return r < 0.55 ? 'sedan' : r < 0.8 ? 'hatch' : 'van';
}

// Stage one moving traffic car at an exact spot (used by shots.js to put
// traffic in frame). Deterministic: colour/speed come from the caller.
export function spawnTrafficCar(scene, traffic, x, z, heading, color, speed, kind = 'sedan') {
  const car = createCar(scene, x, z, heading, color, false, kind);
  car.driver = 'traffic';
  car.speed = speed;
  car.cruise = speed;
  car.horizontal = Math.abs(Math.sin(heading)) > 0.7;
  car.road = car.horizontal ? z : x;
  car.dir = 1;
  traffic.cars.push(car);
  traffic.all.push(car);
  return car;
}

export function createTraffic(scene, rng, world) {
  const centres = roadCentres();
  const cars = [];
  const half = world.half;
  // Moving traffic: pick a road, a direction, a lane offset.
  for (let i = 0; i < 12; i += 1) {
    const horizontal = rng.next() < 0.5;
    const road = rng.pick(centres);
    const along = rng.range(-half, half);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = rng.next() < 0.5 ? -2.2 : 2.2;
    const x = horizontal ? along : road + lane;
    const z = horizontal ? road + lane : along;
    const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    const car = createCar(scene, x, z, heading, rng.pick(PALETTE.carColors), false, pickKind(rng));
    car.driver = 'traffic';
    car.speed = rng.range(7, 12);
    car.cruise = car.speed;
    car.horizontal = horizontal;
    car.road = road;
    car.dir = dir;
    cars.push(car);
  }
  // Parked cars along kerbs, free for the taking.
  const parked = [];
  for (let i = 0; i < 10; i += 1) {
    const horizontal = rng.next() < 0.5;
    const road = rng.pick(centres);
    const along = rng.range(-half + 20, half - 20);
    const side = rng.next() < 0.5 ? -1 : 1;
    const x = horizontal ? along : road + side * (CITY.roadHalf - 1.5);
    const z = horizontal ? road + side * (CITY.roadHalf - 1.5) : along;
    const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
    // v5 (c3): the FIRST parked car is always the hero sport, parked by the
    // spawn kerb in Rosa Neón — stealable like any other car; the sport kind
    // exists nowhere else in free play (PLAN Lampiran A.5).
    const isHero = i === 0;
    const car = createCar(scene, x, z, heading, isHero ? SUNSET.heroColor : rng.pick(PALETTE.carColors), false, isHero ? 'sport' : pickKind(rng));
    if (isHero) {
      car.pos.x = 5.6;
      car.pos.z = 178;
      car.heading = Math.PI;
      syncCarMesh(car);
    }
    car.parked = true;
    car.driver = null;
    parked.push(car);
  }
  return { cars, parked, all: [...cars, ...parked] };
}

export function stepTraffic(traffic, dt, world, playerCar) {
  const centres = roadCentres();
  const half = world.half;
  for (const car of traffic.cars) {
    // Slow for the car ahead (any car within 10 m in front).
    let ahead = false;
    for (const other of traffic.all) {
      if (other === car || other.driver === null) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 11) {
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        if (dx * fx + dz * fz > 0) ahead = true;
      }
    }
    if (playerCar && Math.hypot(playerCar.pos.x - car.pos.x, playerCar.pos.z - car.pos.z) < 9) {
      const dx = playerCar.pos.x - car.pos.x;
      const dz = playerCar.pos.z - car.pos.z;
      if (dx * Math.sin(car.heading) + dz * Math.cos(car.heading) > 0) ahead = true;
    }
    const target = ahead ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    let nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const nearCentre = centres.some((c) => Math.abs((car.horizontal ? nz : nx) - c) < 1.2);
    if (nearCentre && car.speed > 1 && Math.random() < 0.002) {
      car.horizontal = !car.horizontal;
      car.road = car.horizontal ? nz : nx;
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
    // Wrap around the city edge instead of driving into the sea.
    if (nx > half + 20 || nx < -half - 20 || nz > half + 20 || nz < -half - 20) {
      car.heading += Math.PI;
      nx = car.pos.x;
      nz = car.pos.z;
    }
    const fixed = world.collide(nx, nz, 2.0);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    syncCarMesh(car);
  }
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function isOnRoadAt(x, z) {
  return isOnRoad(x, z);
}
