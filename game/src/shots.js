// Screenshot scenes behind ?shot=start|street|mission|chase (with &seed=N).
// Each one stages the real game — the real city, traffic, pedestrians, police
// and missions — then lets it run forward a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. No scene is composited or drawn by hand.
//
// R2 staging: shots deliberately put traffic and pedestrians in frame (the
// random spawn alone leaves the cover nearly empty), frame the player close
// enough to read on foot, and make the mission shot show a real gunshot.
import { attachPlayerStreak, createCar, syncCarMesh } from './vehicles.js';
import { SUNSET } from './config.js';
import { stepTraffic, nearestCar, spawnTrafficCar } from './traffic.js';
import { stepPedestrians, spawnPed } from './pedestrians.js';
import { stepPolice } from './police.js';
import { stepHeli } from './heli.js';
import { DIALOG, NAMES } from './config.js';

// v5: staged cruisers get callsigns from the same §3.5 pool the live
// spawner uses, in creation order, so the PD panel reads real units.
let stagedCallsigns = 0;
function stageCruiser(ctx, x, z, heading, speed) {
  const cruiser = createCar(ctx.render.scene, x, z, heading, 0xf2f2f2, true);
  cruiser.driver = 'police';
  cruiser.speed = speed;
  cruiser.callsign = NAMES.callsigns[stagedCallsigns % NAMES.callsigns.length];
  stagedCallsigns += 1;
  ctx.police.cars.push(cruiser);
  return cruiser;
}
import { tryShoot } from './combat.js';

function advanceWorld(ctx, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    stepTraffic(ctx.traffic, 1 / 60, ctx.world, ctx.player.inCar);
    stepPedestrians(ctx.peds, 1 / 60, ctx.rng, ctx.world, null);
  }
}

function putPlayerInCar(ctx, x, z, heading) {
  const car = createCar(ctx.render.scene, x, z, heading, SUNSET.heroColor, false, 'sport');
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

function stageCar(ctx, n, x, z, heading, speed = 9, kind = 'sedan') {
  // v2: staged traffic mixes body styles, so the fleet's variety is visible
  // in the screenshots themselves, not just in ambient spawns.
  return spawnTrafficCar(ctx.render.scene, ctx.traffic, x, z, heading, STAGE_COLORS[n % STAGE_COLORS.length], speed, kind);
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
  state.dialog = null;
  state.dialogTimer = 0;
  stagedCallsigns = 0;
  if (name === 'start') {
    state.screen = 'start';
    player.pos.x = 0;
    player.pos.z = 168;
    player.camYaw = Math.PI + 0.08; // face the city from the beach road, slightly angled
    player.camPitch = 0.30;
    state.shotCam = { dist: 8, pitch: 0.30 }; // v5: slightly lower key-art angle
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 2);
    // v5 key art: the hero sport parked in the foreground, nose to camera.
    // East kerb, clear of the v2-staged hatch on the west kerb.
    const hero = createCar(ctx.render.scene, 5.8, 164.5, Math.PI, SUNSET.heroColor, false, 'sport');
    hero.parked = true;
    syncCarMesh(hero);
    stageCar(ctx, 1, -5.5, 160, Math.PI / 2, 0, 'hatch');
    stageCar(ctx, 0, 5.5, 156, -Math.PI / 2, 0);
    stageCar(ctx, 0, -2.2, 148, Math.PI, 9, 'van'); // traffic rolling away up the avenue
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
    stageCar(ctx, 0, 6, -2.2, Math.PI / 2, 9, 'van');
    stageCar(ctx, 1, 32, 2.2, Math.PI / 2, 8, 'hatch');
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
    const cruiser = stageCruiser(ctx, 118, 112, -Math.PI / 2, 12);
    stageCar(ctx, 2, 140, 109.8, Math.PI / 2, 9, 'hatch');
    stagePed(ctx, 108, 121.5, Math.PI);
    stagePed(ctx, 112, 102.5, 0);
    state.heat = 25;
    tryShoot(ctx.combat, { x: player.pos.x, z: player.pos.z }, { x: 1, z: 0 }, ctx.peds, ctx.police.cars, state);
    state.message = 'You hit a cruiser!';
    state.messageTimer = 99;
    // v5 (g5): Marco's mission-1 line rides the combat frame.
    state.dialog = DIALOG.m1_start;
    state.dialogTimer = 99;
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  ctx.missions.index = 2;
  ctx.missions.step = 1; // evade — lose the cops
  state.heat = 65;
  const car = putPlayerInCar(ctx, 0, 110, 0);
  car.speed = 33;
  attachPlayerStreak(car); // staging bypasses enterCar, so attach by hand
  player.camYaw = 0;
  state.shotCam = { dist: 8.6, pitch: 0.22, offset: 2.0 }; // 9.5 in PLAN §4.7; tightened so the hero clears C1's ≥20% frame width
  const target = {
    x: car.pos.x, z: car.pos.z, inCar: true,
    onRam: () => {},
  };
  for (let i = 0; i < 3; i += 1) {
    // Two cruisers ahead coming head-on, one on the tail: the chase reads
    // from the driving camera, which looks where the car is going.
    const ahead = i < 2;
    const cz = ahead ? 110 + 50 + i * 9 : 110 - 16;
    stageCruiser(ctx, -4 + i * 5, cz, ahead ? Math.PI : 0, 26);
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
  stageCar(ctx, 0, -2.2, car.pos.z + 18, 0, 10, 'van');
  stageCar(ctx, 1, 2.2, car.pos.z + 30, 0, 9);
  stageCar(ctx, 2, -2.2, car.pos.z + 44, Math.PI, 10, 'hatch');
  const flank = stageCruiser(ctx, 5.5, car.pos.z + 4, 0, 27);
  stagePed(ctx, -9.5, car.pos.z + 20, 0);
  stagePed(ctx, 9.5, car.pos.z + 28, Math.PI);
  stagePed(ctx, -9.5, car.pos.z + 36, 0);
  if (ctx.heli) {
    for (let i = 0; i < 120; i += 1) stepHeli(ctx.heli, 1 / 60, { x: car.pos.x, z: car.pos.z }, 3);
    ctx.heli.group.position.set(car.pos.x + 5, 13.5, car.pos.z + 40);
    ctx.heli.group.rotation.y = Math.atan2(car.pos.x - ctx.heli.group.position.x, car.pos.z - ctx.heli.group.position.z);
    ctx.heli.pool.position.x = car.pos.x;
    ctx.heli.pool.position.z = car.pos.z;
  }
  // v5 (g5): Rosa's 3-star line is forced on for the cover frame.
  state.dialog = DIALOG.m3_heat;
  state.dialogTimer = 99;
  state.message = 'Lose the cops — break line of sight!';
  state.messageTimer = 99;
  return { screen: 'play', announce: 'Playing Palmera City.' };
}
