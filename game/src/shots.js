// Screenshot scenes behind ?shot=start|street|mission|chase (with &seed=N).
// Each one stages the real game — the real city, traffic, pedestrians, police
// and missions — then lets it run forward a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. No scene is composited or drawn by hand.
//
// v3 R2 staging (hero subjects): the cover is a low, close chase behind
// Luz's red sport coupe — flanking cruisers with their glow kit lit, the PD
// helicopter's searchlight on her car, the road opening to the sea and the
// sunset. Street frames Luz large among clustered locals; the mission moves
// to a building-walled Coral Row block; the start is key art — Luz beside
// the angled red sport car at the southern intersection.
import { createCar, syncCarMesh } from './vehicles.js';
import { stepTraffic, nearestCar, spawnTrafficCar } from './traffic.js';
import { stepPedestrians, spawnPed } from './pedestrians.js';
import { placeHeli } from './heli.js';
import { tryShoot } from './combat.js';

function advanceWorld(ctx, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    stepTraffic(ctx.traffic, 1 / 60, ctx.world, ctx.player.inCar);
    stepPedestrians(ctx.peds, 1 / 60, ctx.rng, ctx.world, null);
  }
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

// A cruiser staged at an exact spot with its glow phase frozen at a chosen
// point of the pulse (t in seconds on the car's simulation clock).
function stageCruiser(ctx, x, z, heading, speed, t) {
  const cruiser = createCar(ctx.render.scene, x, z, heading, 0xf2f2f2, true);
  cruiser.driver = 'police';
  cruiser.speed = speed;
  cruiser.t = t;
  syncCarMesh(cruiser);
  ctx.police.cars.push(cruiser);
  return cruiser;
}

const HERO_RED = 0xd92626; // saturated hero red — R1's 0xc0392b went brick-brown under the grade

export function stageShot(name, ctx) {
  const { state, player } = ctx;
  state.screen = 'play';
  state.message = '';
  state.messageTimer = 0;
  state.shotCam = null;
  if (name === 'start') {
    state.screen = 'start';
    // v3 R2 key art: Luz stands beside her red sport coupe, parked at an
    // angle at the southern intersection (0,168) — road, dashes and kerbs
    // fill the foreground, skyline + sunset behind, palms only at the
    // frame edges. The camera sits lower than R1 (pitch 0.22), further
    // back, and shifted sideways: the pair stands west of the avenue
    // centreline and the offset pushes them left of the title panel
    // (centred at dist 9, Luz hid behind the panel and the car filled
    // the bottom-right corner cropped).
    player.pos.x = -9.5;
    player.pos.z = 169;
    player.heading = Math.PI * 0.88; // mostly back to camera, slight turn
    player.camYaw = Math.PI + 0.08; // face the city from the beach road
    player.camPitch = 0.22;
    // tx/tz move the look-at point east of Luz, so she and the car compose
    // into the left third, clear of the centred title panel (the panel
    // spans the middle ~50% of the frame; a first attempt at tx 0.5 still
    // left Luz peeking from behind its left edge).
    state.shotCam = { dist: 11.5, pitch: 0.22, offset: -1.5, tx: 2.0, tz: 171 };
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 2);
    const hero = createCar(ctx.render.scene, -6.0, 171.8, 0.65, HERO_RED, false, 'sport');
    hero.parked = true;
    hero.t = 0.9;
    syncCarMesh(hero);
    // Supporting parked cars at the far kerbs + locals at the edges.
    stageCar(ctx, 1, -5.5, 160, Math.PI / 2, 0, 'hatch');
    stageCar(ctx, 0, 5.5, 158, -Math.PI / 2, 0);
    stagePed(ctx, -8, 158.5, 0);
    stagePed(ctx, 7.5, 177.5, Math.PI);
    // No third ped: anywhere on the west sidewalk it either looms beside
    // the camera or crowds the Luz + car pair.
    return { screen: 'start', announce: 'Palmera City. Press Space or click to start.' };
  }
  if (name === 'street') {
    player.pos.x = -18;
    player.pos.z = -2; // north lane of Coral Row: the centre dashes and the
    // south-side palms both sit off-axis, out of the foreground
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.24;
    state.shotCam = { dist: 4, pitch: 0.24 }; // v3 R2: closer — Luz reads as a person, large in frame
    ctx.missions.index = 0;
    ctx.missions.step = 0;
    advanceWorld(ctx, 3);
    // Traffic on this same road, ahead of the player, plus parked cars at
    // both kerbs she can steal.
    stageCar(ctx, 0, 6, -2.2, Math.PI / 2, 9, 'van');
    stageCar(ctx, 1, 32, 2.2, Math.PI / 2, 8, 'hatch');
    const parked = nearestCar(ctx.traffic.parked, -4, 5.5, 60); // parked list only: traffic.all could hand back a moving car
    if (parked) {
      parked.pos.x = -4;
      parked.pos.z = 5.5;
      parked.heading = Math.PI / 2;
      syncCarMesh(parked);
    }
    stageCar(ctx, 3, 14, 5.5, Math.PI / 2, 0, 'sedan'); // second parked car, east kerb
    // Locals clustered in groups on both sidewalks, right around the
    // player — v3 R2 raises the density so the street reads lived-in.
    stagePed(ctx, -14, 9.5, Math.PI / 2);
    stagePed(ctx, -10.5, 9.5, -Math.PI / 2);
    stagePed(ctx, -8, 9.5, Math.PI / 2);
    stagePed(ctx, -22, -9.5, -Math.PI / 2);
    stagePed(ctx, -16, -9.5, Math.PI / 2);
    stagePed(ctx, -12, -9.5, Math.PI / 2);
    stagePed(ctx, -4, -9.5, -Math.PI / 2);
    stagePed(ctx, -2, 9.5, Math.PI / 2);
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  if (name === 'mission') {
    // Combat, visible — v3 R2 moves the shootout from the empty marina
    // junction to a building-walled Coral Row block (road z=0, Luz at
    // z=-2, mid-block x=28 so facades wall both sides): Luz on foot beside
    // the sport coupe she just took, firing at a cruiser 14 m ahead —
    // thickened tracer + enlarged muzzle glow, not just ammo text.
    ctx.missions.index = 0;
    ctx.missions.step = 1; // drive to the marina waypoint (beacon stays up)
    player.pos.x = 28;
    player.pos.z = -2;
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.26;
    state.shotCam = { dist: 5.5, pitch: 0.26 };
    advanceWorld(ctx, 1);
    // The stolen sport coupe sits beside Luz, south lane, out of her
    // firing line: the tracer runs clean from muzzle to cruiser. Staged a
    // few metres ahead of her so the whole car stays in frame (flush
    // beside her it was cropped by the frame edge and the minimap).
    const car = createCar(ctx.render.scene, 32.5, 3.0, Math.PI / 2, HERO_RED, false, 'sport');
    car.parked = true;
    car.t = 0.9;
    syncCarMesh(car);
    stageCruiser(ctx, 42, -2, -Math.PI / 2, 6, 0.05); // target cruiser, ~14 m ahead, rolling at her
    stageCar(ctx, 1, 54, -16, 0, 9, 'hatch'); // traffic crossing the next intersection, behind the cruiser
    stagePed(ctx, 36, -9.5, 0);
    stagePed(ctx, 22, 9.5, Math.PI);
    stagePed(ctx, 46, 9.5, 0);
    // The shot itself: hits the cruiser, so the message, the heat and the
    // tracer all say combat happened. Flash/tracer persist for the paints —
    // the shot loop never steps combat in shot mode. Pre-heat to 25 so
    // the +30 from the hit lands on ★★.
    state.heat = 25;
    tryShoot(ctx.combat, { x: player.pos.x, z: player.pos.z }, { x: 1, z: 0 }, ctx.peds, ctx.police.cars, state);
    state.message = 'You hit a cruiser!';
    state.messageTimer = 99;
    return { screen: 'play', announce: 'Playing Palmera City.' };
  }
  // chase (cover): v3 R2 — low and close behind the red sport coupe on the
  // southern avenue (driving south, toward beach + sea + sunset), two
  // cruisers flanking tight with the glow kit lit, the PD helicopter above
  // the road ahead with its searchlight on the hero car, one sport traffic
  // car in front. No foreground palm may cover the subject: the avenue
  // centreline is clear and the camera offset favours the open lane.
  ctx.missions.index = 2;
  ctx.missions.step = 1; // evade — lose the cops
  state.heat = 65;
  const car = createCar(ctx.render.scene, 0, 110, 0, HERO_RED, false, 'sport');
  car.driver = 'player';
  car.parked = false;
  car.speed = 26;
  ctx.player.inCar = car;
  ctx.player.pos.x = car.pos.x;
  ctx.player.pos.z = car.pos.z;
  player.camYaw = 0;
  state.shotCam = { dist: 10.5, pitch: 0.20, offset: 1.6 };
  // Settle the chase for 0.75 s of fixed steps: traffic and peds move, the
  // hero car runs south at speed. Cruisers/heli are staged after, at exact
  // offsets from wherever the car ends up — the frame is composed, not
  // whatever the pursuit AI happened to produce.
  for (let i = 0; i < 45; i += 1) {
    stepTraffic(ctx.traffic, 1 / 60, ctx.world, car);
    stepPedestrians(ctx.peds, 1 / 60, ctx.rng, ctx.world, null);
    car.pos.z += Math.cos(car.heading) * car.speed * (1 / 60);
    car.pos.x += Math.sin(car.heading) * car.speed * (1 / 60);
    car.t = (car.t || 0) + 1 / 60;
    syncCarMesh(car);
    ctx.player.pos.x = car.pos.x;
    ctx.player.pos.z = car.pos.z;
  }
  // Two cruisers flanking close, glow phases frozen on opposite beats so
  // one blazes red and the other blue in the still frame.
  stageCruiser(ctx, car.pos.x - 3.6, car.pos.z + 2, 0, 24, 0.05);
  stageCruiser(ctx, car.pos.x + 3.6, car.pos.z - 5, 0, 24, 0.33);
  // One sport traffic car ahead in the hero's lane, one hatch oncoming.
  stageCar(ctx, 0, -2.2, car.pos.z + 24, 0, 10, 'sport');
  stageCar(ctx, 2, 2.2, car.pos.z + 40, Math.PI, 10, 'hatch');
  // The helicopter, staged deterministically above the road ahead, nose
  // toward the camera, searchlight cone on the hero car. Altitude/offset
  // are tuned to the cover camera (pitch 0.20, dist 10.5): at alt 15 /
  // +18 m the airframe sat just above the top edge of the frame and only
  // its cone was visible — 10.5 / +14 puts the body inside the frame.
  placeHeli(ctx.heli, car.pos.x + 5.5, 9.5, car.pos.z + 13.5, Math.PI, car.pos.x, car.pos.z, 0.7);
  stagePed(ctx, -9.5, car.pos.z + 20, 0);
  stagePed(ctx, 9.5, car.pos.z + 28, Math.PI);
  stagePed(ctx, -9.5, car.pos.z + 36, 0);
  state.message = 'Lose the cops — break line of sight!';
  state.messageTimer = 99;
  return { screen: 'play', announce: 'Playing Palmera City.' };
}
