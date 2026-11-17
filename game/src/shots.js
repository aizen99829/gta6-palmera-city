// Screenshot scenes behind ?shot=start|street|mission|chase (with &seed=N).
// Each one stages the real game — the real city, traffic, pedestrians, police
// and missions — then lets it run forward a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. No scene is composited or drawn by hand.
import { createCar, syncCarMesh } from './vehicles.js';
import { stepTraffic, nearestCar } from './traffic.js';
import { stepPedestrians } from './pedestrians.js';
import { stepPolice } from './police.js';

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

export function stageShot(name, ctx) {
  const { state, player } = ctx;
  state.screen = 'play';
  state.message = '';
  state.messageTimer = 0;
  if (name === 'start') {
    state.screen = 'start';
    player.pos.x = 0;
    player.pos.z = 200;
    player.camYaw = 0; // look south: sand, palms and the sea behind the menu
    player.camPitch = 0.22;
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 2);
    return { screen: 'start', announce: 'Palmera City. Press Space or click to start.' };
  }
  if (name === 'street') {
    player.pos.x = -20;
    player.pos.z = 0; // stand on Coral Row itself, looking east down the road
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.3;
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 3);
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  if (name === 'mission') {
    ctx.missions.index = 0;
    ctx.missions.step = 1; // drive to the marina waypoint
    putPlayerInCar(ctx, 100, 112, Math.PI / 2); // on the road, heading east toward the waypoint
    player.camYaw = Math.PI / 2;
    advanceWorld(ctx, 1.5);
    state.message = 'Drive to the marina waypoint';
    state.messageTimer = 99;
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  // chase (cover): driving fast with three cruisers on the tail, 3 stars.
  ctx.missions.index = 2;
  ctx.missions.step = 1; // evade — lose the cops
  state.heat = 65;
  const car = putPlayerInCar(ctx, 0, -56, 0);
  car.speed = 26;
  player.camYaw = 0;
  const target = {
    x: car.pos.x, z: car.pos.z, inCar: true,
    onRam: () => {},
  };
  for (let i = 0; i < 3; i += 1) {
    // Two cruisers ahead coming head-on, one on the tail: the chase reads
    // from the driving camera, which looks where the car is going.
    const ahead = i < 2;
    const cz = ahead ? -56 + 50 + i * 9 : -56 - 16;
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
  state.message = 'Lose the cops — break line of sight!';
  state.messageTimer = 99;
  return { screen: 'play', announce: 'Playing Palmera City.' };
}
