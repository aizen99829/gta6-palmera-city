// traffic.js — ambient cars that follow the road grid, plus the parked
// cars the player can steal. Moving cars pick a random turn at each
// intersection, slow down behind the car ahead, and recycle around the
// player so the streets near Luz are never empty for long.
import { CITY, CAR_COLORS } from './config.js';
import { createCar, driveCar, syncCarMesh } from './vehicles.js';
import { clamp, headingTo } from './random.js';

const PARKED_SPOTS = [];
export function createTraffic(scene, world, rng) {
  const all = [];
  // One Alisio GT hero car parked by the spawn, then a spread of parked
  // cars along the road edges all over the city.
  const hero = createCar(scene, 'sport', 0xd81b60, 16, 168, Math.PI / 2, { static: true });
  hero.parked = true; all.push(hero);
  const kinds = ['sedan', 'hatch', 'van', 'taxi'];
  let placed = 0; let guard = 0;
  while (placed < 21 && guard < 300) {
    guard += 1;
    const c = rng.pick(CITY.roadCentres);
    const t = rng.range(-185, 185);
    const vertical = rng.chance(0.5);
    const side = rng.chance(0.5) ? 5.4 : -5.4;
    const x = vertical ? c + side : t;
    const z = vertical ? t : c + side;
    if (Math.hypot(x - 4, z - 178) < 16) continue;
    if (all.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 9)) continue;
    const car = createCar(scene, rng.pick(kinds), rng.pick(CAR_COLORS), x, z,
      vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2), { static: true });
    car.parked = true; all.push(car); placed += 1;
  }
  // Moving traffic.
  for (let i = 0; i < 10; i += 1) {
    const vertical = i % 2 === 0;
    const c = rng.pick(CITY.roadCentres);
    const car = createCar(scene, rng.pick(kinds), rng.pick(CAR_COLORS),
      vertical ? c : rng.range(-180, 180), vertical ? rng.range(-180, 180) : c,
      vertical ? 0 : Math.PI / 2);
    car.route = { vertical, line: c, dir: 1 };
    car.cruise = rng.range(10, 14);
    all.push(car);
  }
  function step(dt, playerPos, time) {
    for (const car of all) {
      if (car.playerDriven) { syncCarMesh(car, time); continue; }
      if (car.parked) { syncCarMesh(car, time); continue; }
      const r = car.route;
      // Recycle cars that drift too far from the player.
      const dPlayer = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (dPlayer > 280) {
        const c = CITY.roadCentres[Math.floor(Math.random() * CITY.roadCentres.length)];
        r.vertical = Math.random() < 0.5; r.line = c; r.dir = 1;
        car.pos.x = r.vertical ? c : playerPos.x + (Math.random() < 0.5 ? -120 : 120);
        car.pos.z = r.vertical ? playerPos.z + (Math.random() < 0.5 ? -120 : 120) : c;
        car.speed = 0;
      }
      // Target point: far ahead along the current road line.
      const ahead = 60;
      const targetX = r.vertical ? r.line : car.pos.x + Math.sin(car.heading) * ahead;
      const targetZ = r.vertical ? car.pos.z + Math.cos(car.heading) * ahead : r.line;
      const desired = headingTo(car.pos.x, car.pos.z, targetX, targetZ);
      let err = desired - car.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      // Slow down if another car is close ahead.
      let blocked = false;
      for (const o of all) {
        if (o === car) continue;
        const d = Math.hypot(o.pos.x - car.pos.x, o.pos.z - car.pos.z);
        if (d < 7) {
          const a = headingTo(car.pos.x, car.pos.z, o.pos.x, o.pos.z);
          if (Math.abs(((a - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.6) blocked = true;
        }
      }
      const input = {
        forward: !blocked && car.speed < car.cruise,
        back: blocked && car.speed > 1,
        left: err > 0.12, right: err < -0.12, brake: false,
      };
      // At an intersection, sometimes turn onto the crossing road.
      const nearCross = CITY.roadCentres.some((c) => Math.abs((r.vertical ? car.pos.z : car.pos.x) - c) < 2.2);
      driveCar(car, input, dt, world);
      if (nearCross && Math.random() < 0.008) {
        const cross = r.vertical ? car.pos.z : car.pos.x;
        const snapped = CITY.roadCentres.reduce((best, c) => (Math.abs(c - cross) < Math.abs(best - cross) ? c : best), CITY.roadCentres[0]);
        r.vertical = !r.vertical; r.line = snapped;
      }
      if (car.pos.x > CITY.extent + 30 || car.pos.x < -CITY.extent - 30 ||
          car.pos.z > CITY.extent + 40 || car.pos.z < -CITY.extent - 30) {
        r.dir = -r.dir; car.heading += Math.PI;
      }
      syncCarMesh(car, time);
    }
  }
  return { all, step };
}
export { PARKED_SPOTS };
export const trafficClamp = clamp;
