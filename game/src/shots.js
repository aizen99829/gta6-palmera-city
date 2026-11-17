// Screenshot scenes behind ?shot=start|street|mission|chase (with &seed=N).
// Each one stages the real game — the real city, traffic, pedestrians, police
// and missions — then lets it run forward a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. No scene is composited or drawn by hand.
//
// R2 staging: shots deliberately put traffic and pedestrians in frame (the
// random spawn alone leaves the cover nearly empty), frame the player close
// enough to read on foot, and make the mission shot show a real gunshot.
import { createCar, syncCarMesh } from './vehicles.js';
import { stepTraffic, nearestCar, spawnTrafficCar } from './traffic.js';
import { stepPedestrians, spawnPed } from './pedestrians.js';
import { stepPolice } from './police.js';
import { tryShoot } from './combat.js';

function advanceWorld(ctx, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    stepTraffic(ctx.traffic, 1 / 60, ctx.world, ctx.player.inCar);
    stepPedestrians(ctx.peds, 1 / 60, ctx.rng, ctx.world, null);
  }
}

function putPlayerInCar(ctx, x, z, heading) {
  const car = nearestCar(ctx.traffic.all, x, z, 60) || createCar(ctx.render.scene, x, z, heading, 0xc0392b, false);
  car.driver = 'player';
  car.parked = false;
  car.pos.x = x;
  car.pos.z = z;
  car.heading = heading;
  car.speed = 14;
  syncCarMesh(car);
  ctx.player.inCar = car;
  ctx.player.pos.x = x;
  ctx.player.pos.z = z;
  return car;
}

// One extra traffic car on a named road, in frame. Colours cycle the fleet
// palette so the street reads as busy, not cloned.
const STAGE_COLORS = [0x2e86c1, 0xf1c40f, 0x27ae60, 0xe67e22, 0x16a085];

function stageCar(ctx, n, x, z, heading, speed = 9) {
  return spawnTrafficCar(ctx.render.scene, ctx.traffic, x, z, heading, STAGE_COLORS[n % STAGE_COLORS.length], speed);
}

function stagePed(ctx, x, z, heading) {
  const ped = spawnPed(ctx.render.scene, ctx.rng, x, z, heading);
  ctx.peds.push(ped);
  return ped;
}

export function stageShot(name, ctx) {
  const { state, player } = ctx;
  state.screen = 'play';
  state.message = '';
  state.messageTimer = 0;
  state.shotCam = null;
  if (name === 'start') {
    state.screen = 'start';
    // R3: the old spot (sand at z=190) left the bottom half of the frame as
    // empty sand. Stand at the southern intersection (0,168) instead: road,
    // dashes and kerbs fill the foreground, with parked cars and locals in
    // frame and the skyline still behind the panel.
    player.pos.x = 0;
    player.pos.z = 168;
    player.camYaw = Math.PI + 0.08; // face the city from the beach road, slightly angled
    player.camPitch = 0.34;
    state.shotCam = { dist: 8, pitch: 0.34 };
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 2);
    // Parked cars at both kerbs of this road + locals on the sidewalks.
    // Staged fresh in saturated fleet colours (repositioned random parked
    // cars came out pale and unreadable here): yellow west kerb, blue east.
    stageCar(ctx, 1, -5.5, 160, Math.PI / 2, 0);
    stageCar(ctx, 0, 5.5, 156, -Math.PI / 2, 0);
    stageCar(ctx, 0, -2.2, 148, Math.PI, 9); // traffic rolling away up the avenue
    stagePed(ctx, -8, 158.5, 0);
    stagePed(ctx, 7, 177.5, Math.PI);
    stagePed(ctx, 12, 158.5, -Math.PI / 2);
    return { screen: 'start', announce: 'Palmera City. Press Space or click to start.' };
  }
  if (name === 'street') {
    player.pos.x = -18;
    player.pos.z = -2; // north lane of Coral Row: the centre dashes and the
    // south-side palms both sit off-axis, out of the foreground
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.3;
    state.shotCam = { dist: 4.5, pitch: 0.3 }; // close: Luz reads as a person, not a dot
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 3);
    // Traffic on this same road, ahead of the player, plus a parked car at
    // the kerb she can steal.
    stageCar(ctx, 0, 6, -2.2, Math.PI / 2, 9);
    stageCar(ctx, 1, 32, 2.2, Math.PI / 2, 8);
    const parked = nearestCar(ctx.traffic.all, -4, 5.5, 60);
    if (parked) {
      parked.pos.x = -4;
      parked.pos.z = 5.5;
      parked.heading = Math.PI / 2;
      syncCarMesh(parked);
    }
    // A cluster of locals on both sidewalks, right around the player.
    stagePed(ctx, -14, 9.5, Math.PI / 2);
    stagePed(ctx, -8, 9.5, Math.PI / 2);
    stagePed(ctx, -22, -9.5, -Math.PI / 2);
    stagePed(ctx, -12, -9.5, Math.PI / 2);
    stagePed(ctx, -4, -9.5, -Math.PI / 2);
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  if (name === 'mission') {
    // Combat, visible: Luz on foot beside the car she just took, firing at
    // a cruiser rolling in — muzzle flash + tracer + a hit, not just ammo text.
    ctx.missions.index = 0;
    ctx.missions.step = 1; // drive to the marina waypoint (beacon stays up)
    player.pos.x = 100;
    player.pos.z = 112;
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.28;
    state.shotCam = { dist: 5.5, pitch: 0.3 };
    advanceWorld(ctx, 1);
    // The stolen car sits beside Luz, not in her firing lane: the tracer
    // runs clean from muzzle to cruiser.
    const car = nearestCar(ctx.traffic.all, 104, 115.5, 60) || createCar(ctx.render.scene, 104, 115.5, Math.PI / 2, 0xc0392b, false);
    car.pos.x = 104.5;
    car.pos.z = 115.5;
    car.heading = Math.PI / 2;
    car.parked = true;
    syncCarMesh(car);
    const cruiser = createCar(ctx.render.scene, 118, 112, -Math.PI / 2, 0xf2f2f2, true);
    cruiser.driver = 'police';
    cruiser.speed = 12;
    ctx.police.cars.push(cruiser);
    stageCar(ctx, 2, 140, 109.8, Math.PI / 2, 9);
    stagePed(ctx, 108, 121.5, Math.PI);
    stagePed(ctx, 112, 102.5, 0);
    // The shot itself: hits the cruiser, so the message, the heat and the
    // tracer all say combat happened. Flash/tracer persist for the paints —
    // the shot loop never steps combat in shot mode. R3: pre-heat to 25 so
    // the +30 from the hit lands on ★★, and the step text in config now
    // reads "Fight past the PD…" — the on-foot shootout matches the
    // objective instead of contradicting a "drive the car" line.
    state.heat = 25;
    tryShoot(ctx.combat, { x: player.pos.x, z: player.pos.z }, { x: 1, z: 0 }, ctx.peds, ctx.police.cars, state);
    state.message = 'You hit a cruiser!';
    state.messageTimer = 99;
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  // chase (cover): driving fast with three cruisers on the tail, 3 stars.
  // R3: staged on the southern avenue (z≈110, driving south) instead of
  // z=−56, so the beach road, palms and the sea sit in the frame ahead
  // instead of a thin strip at the horizon.
  ctx.missions.index = 2;
  ctx.missions.step = 1; // evade — lose the cops
  state.heat = 65;
  const car = putPlayerInCar(ctx, 0, 110, 0);
  car.speed = 26;
  player.camYaw = 0;
  // Higher and further back than v1, slightly offset: the flanking walls
  // stop filling the frame, the road ahead opens up.
  state.shotCam = { dist: 14.5, pitch: 0.4, offset: 2.5 };
  const target = {
    x: car.pos.x, z: car.pos.z, inCar: true,
    onRam: () => {},
  };
  for (let i = 0; i < 3; i += 1) {
    // Two cruisers ahead coming head-on, one on the tail: the chase reads
    // from the driving camera, which looks where the car is going.
    const ahead = i < 2;
    const cz = ahead ? 110 + 50 + i * 9 : 110 - 16;
    const cruiser = createCar(ctx.render.scene, -4 + i * 5, cz, ahead ? Math.PI : 0, 0xf2f2f2, true);
    cruiser.driver = 'police';
    cruiser.speed = 22;
    ctx.police.cars.push(cruiser);
  }
  for (let i = 0; i < 45; i += 1) {
    stepPolice(ctx.police, 1 / 60, ctx.render.scene, ctx.rng, target, 3, ctx.world);
    stepTraffic(ctx.traffic, 1 / 60, ctx.world, car);
    car.pos.z += Math.cos(car.heading) * car.speed * (1 / 60);
    car.pos.x += Math.sin(car.heading) * car.speed * (1 / 60);
    syncCarMesh(car);
    target.x = car.pos.x;
    target.z = car.pos.z;
  }
  // Staged after the chase settles, so they sit exactly in frame: traffic
  // on this same road ahead, one cruiser tight on the player's right flank,
  // and locals on the sidewalks the chase passes.
  stageCar(ctx, 0, -2.2, car.pos.z + 18, 0, 10);
  stageCar(ctx, 1, 2.2, car.pos.z + 30, 0, 9);
  stageCar(ctx, 2, -2.2, car.pos.z + 44, Math.PI, 10);
  const flank = createCar(ctx.render.scene, 5.5, car.pos.z + 4, 0, 0xf2f2f2, true);
  flank.driver = 'police';
  flank.speed = 24;
  ctx.police.cars.push(flank);
  stagePed(ctx, -9.5, car.pos.z + 20, 0);
  stagePed(ctx, 9.5, car.pos.z + 28, Math.PI);
  stagePed(ctx, -9.5, car.pos.z + 36, 0);
  state.message = 'Lose the cops — break line of sight!';
  state.messageTimer = 99;
  return { screen: 'play', announce: 'Playing Palmera City.' };
}
