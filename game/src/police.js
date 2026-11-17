// The Palmera PD: cruisers spawn at the city edge when the wanted level rises,
// chase the player's car (or the player on foot), ram to stop them, and back
// off when the heat fades. Busted happens when a cruiser pins the player on
// foot at high wanted, or the player's health hits zero.
import { createCar, syncCarMesh } from './vehicles.js';
import { CITY } from './config.js';

export function createPolice(scene) {
  return { cars: [], spawnTimer: 0 };
}

function spawnCruiser(police, scene, rng, near) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = 55;
  const x = near.x + Math.sin(angle) * dist;
  const z = near.z + Math.cos(angle) * dist;
  const car = createCar(scene, x, z, Math.atan2(near.x - x, near.z - z), 0xf2f2f2, true);
  car.driver = 'police';
  car.speed = 0;
  car.cruise = 20;
  police.cars.push(car);
  return car;
}

export function stepPolice(police, dt, scene, rng, target, wanted, world) {
  // Wanted count of cruisers on the street (cap 5).
  const want = Math.min(wanted, 5);
  police.spawnTimer -= dt;
  if (police.cars.length < want && police.spawnTimer <= 0) {
    spawnCruiser(police, scene, rng, target);
    police.spawnTimer = 2.5;
  }
  let busted = false;
  for (const car of police.cars) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const cruise = wanted > 0 ? 24 + wanted * 1.5 : 0;
    const targetSpeed = dist > 90 ? cruise : cruise * 0.8;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    let nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    if (world.hitsBuilding(nx, nz, 2.2)) {
      car.heading += Math.PI / 3;
      car.speed *= 0.5;
    } else {
      const fixed = world.collide(nx, nz, 2.2);
      car.pos.x = fixed.x;
      car.pos.z = fixed.z;
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
