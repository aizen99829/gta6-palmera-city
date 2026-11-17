// Palmera City — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there. Screens:
// start, play, paused, busted. ?shot=chase|street|mission|start (with &seed=N)
// stages that scene from the real game instead of running the loop, paints it
// a few times and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CITY, MONEY, PLAYER, SAVE_KEY, STEP, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer, stepPlayer } from './player.js';
import { createCar, driveCar, carSpeedKmh } from './vehicles.js';
import { createTraffic, stepTraffic, nearestCar } from './traffic.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { createPolice, stepPolice } from './police.js';
import { createHeli, stepHeli } from './heli.js';
import { createMissions, currentMission, currentStep, missionText, stepMissions, waypointOf } from './missions.js';
import { createCombat, tryPunch, tryShoot, stepCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createRender } from './render.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, ACTION_SHOOT, createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const render = createRender(canvas);
const world = createWorld(render.scene, rng);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
const player = createPlayer(render.scene);
const traffic = createTraffic(render.scene, rng, world);
const peds = createPedestrians(render.scene, rng, world);
const police = createPolice(render.scene);
const heli = createHeli(render.scene); // v3 R2: visual-only PD helicopter (wanted >= 3)
const missions = createMissions();
const combat = createCombat();

const state = {
  screen: 'start',
  money: MONEY.start,
  health: PLAYER.maxHealth,
  heat: 0,
  clockMin: 16 * 60 + 30,
  message: '',
  messageTimer: 0,
  crashTimer: 0, // crash damage at most once per half second: a pinned car
  // scraping a wall must not bleed out in a second of taps
  saveTimer: 0,
  time: 0,
};
const SPAWN = { x: 0, z: 170 };
player.pos.x = SPAWN.x;
player.pos.z = SPAWN.z;
player.camYaw = Math.PI; // face the city from the beach

function stars() {
  return Math.max(0, Math.min(WANTED.max, Math.floor(state.heat / WANTED.heatPerStar)));
}

function save() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, health: state.health,
      mission: missions.index, step: missions.step,
      x: player.pos.x, z: player.pos.z,
    }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}

function load() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.money === 'number') state.money = s.money;
    if (typeof s.health === 'number') state.health = s.health > 0 ? s.health : PLAYER.maxHealth; // a save written at 0 health (busted) must not insta-bust the next visit
    if (typeof s.mission === 'number') missions.index = Math.min(s.mission, 3);
    if (typeof s.step === 'number') missions.step = s.step;
    if (typeof s.x === 'number' && typeof s.z === 'number') {
      player.pos.x = s.x;
      player.pos.z = s.z;
    }
  } catch {
    // A corrupt save is ignored, not fatal.
  }
}

function announce(message) {
  status.textContent = message;
}

function enterCar() {
  const cars = [...traffic.all, ...police.cars];
  const car = nearestCar(cars, player.pos.x, player.pos.z, 4.5);
  if (!car || car.driver === 'police') {
    audio.denied();
    return;
  }
  if (car.driver === 'traffic') {
    const i = traffic.cars.indexOf(car);
    if (i >= 0) traffic.cars.splice(i, 1);
  }
  car.driver = 'player';
  car.parked = false;
  player.inCar = car;
  if (!car.stolen) {
    car.stolen = true;
    state.heat = Math.min(100, state.heat + WANTED.stealCar);
    state.message = 'Car stolen — the PD is watching';
    state.messageTimer = 3;
  }
  audio.pickup();
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  if (!traffic.all.includes(car)) traffic.all.push(car);
  player.inCar = null;
  player.pos.x = car.pos.x + Math.cos(car.heading) * 2.5;
  player.pos.z = car.pos.z - Math.sin(car.heading) * 2.5;
  const fixed = world.collide(player.pos.x, player.pos.z, PLAYER.radius);
  player.pos.x = fixed.x;
  player.pos.z = fixed.z;
  player.camYaw = car.heading;
}

function bust() {
  if (state.screen !== 'play') return;
  state.screen = 'busted';
  audio.busted();
  audio.setEngine(0, false);
  audio.setSiren(false, 0);
  state.money = Math.max(0, state.money - 100);
  announce('Busted. The Palmera PD caught Luz.');
  hud.showScreen('busted');
  save();
}

function startGame() {
  state.screen = 'play';
  audio.unlock();
  hud.showScreen('play');
  announce('Playing Palmera City.');
}

function restart() {
  state.health = PLAYER.maxHealth;
  state.heat = 0;
  player.pos.x = SPAWN.x;
  player.pos.z = SPAWN.z;
  player.camYaw = Math.PI;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  for (const car of police.cars) render.scene.remove(car.mesh);
  police.cars.length = 0;
  state.screen = 'play';
  hud.showScreen('play');
  announce('Playing Palmera City.');
}

function missionContext() {
  const inCar = !!player.inCar;
  const pos = inCar ? player.inCar.pos : player.pos;
  return {
    x: pos.x, z: pos.z, inCar,
    stars: stars(),
    heatStepArmed: missions.index === 2 && missions.step === 1,
    money: state.money,
  };
}

function step(dt) {
  state.time += dt;
  state.clockMin += dt * 2;
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.crashTimer = Math.max(0, state.crashTimer - dt);
  // Wanted heat fades while the player stays out of trouble.
  state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
  // Player on foot or driving.
  if (player.inCar) {
    const hit = driveCar(player.inCar, input, dt, world);
    if (hit && state.crashTimer <= 0) {
      state.health = Math.max(0, state.health - 2);
      state.message = 'Crash!';
      state.messageTimer = 1;
      state.crashTimer = 0.5;
    }
  } else {
    stepPlayer(player, input, dt, world);
  }
  // Traffic, pedestrians, police.
  stepTraffic(traffic, dt, world, player.inCar);
  const threat = combat.flash > 0 || player.punchTimer > 0
    ? { x: player.pos.x, z: player.pos.z } : null;
  stepPedestrians(peds, dt, rng, world, threat);
  const target = {
    x: player.inCar ? player.inCar.pos.x : player.pos.x,
    z: player.inCar ? player.inCar.pos.z : player.pos.z,
    heading: player.inCar ? player.inCar.heading : player.heading,
    inCar: !!player.inCar,
    onRam: () => {
      state.health = Math.max(0, state.health - 8);
      if (player.inCar) player.inCar.speed *= 0.5;
      state.message = 'Cruiser rammed you!';
      state.messageTimer = 1.5;
    },
  };
  const caught = stepPolice(police, dt, render.scene, rng, target, stars(), world);
  if (caught) {
    bust();
    return;
  }
  // The helicopter only shadows the player (searchlight theatre at 3+
  // stars); it never touches heat, busts or damage.
  stepHeli(heli, dt, target, stars());
  // Missions.
  const ctx = missionContext();
  const result = stepMissions(missions, ctx, dt);
  state.money = ctx.money;
  if (result) {
    audio.mission();
    state.message = missions.message;
    state.messageTimer = 3;
    save();
  }
  // Combat timers and health regen.
  stepCombat(combat, dt);
  if (state.health > 0 && state.health < PLAYER.maxHealth) state.health = Math.min(PLAYER.maxHealth, state.health + dt * 1.5);
  if (state.health <= 0) {
    bust();
    return;
  }
  // Audio follows the action.
  const speed01 = player.inCar ? Math.abs(player.inCar.speed) / 38 : player.moving ? 0.25 : 0;
  audio.setEngine(speed01, !!player.inCar || player.moving);
  audio.setSiren(stars() > 0, state.time);
  // Sea shimmer + lighthouse pulse.
  world.sea.position.y = 0.02 + Math.sin(state.time * 0.7) * 0.08;
  world.lamp.material.color.setHex(Math.floor(state.time * 2) % 2 === 0 ? 0xffe9a8 : 0xfffbe0);
  // Autosave.
  state.saveTimer += dt;
  if (state.saveTimer > 5) {
    state.saveTimer = 0;
    save();
  }
}

function updateCamera(dt) {
  const waypoint = waypointOf(missions);
  render.setBeacon(waypoint);
  render.setFlash(combat.flash > 0
    ? { x: player.pos.x + Math.sin(player.camYaw) * 2, y: 1.5, z: player.pos.z + Math.cos(player.camYaw) * 2 }
    : null);
  render.setTracer(combat.flash > 0 ? combat.tracerFrom : null, combat.flash > 0 ? combat.tracerTo : null);
  // Shots stage their own framing (closer on foot, higher/further in a chase);
  // live play always uses the defaults.
  const cam = state.shotCam || {};
  if (player.inCar) {
    const car = player.inCar;
    const target = { x: car.pos.x, y: 1.6, z: car.pos.z };
    render.updateCamera(target, car.heading, cam.pitch ?? 0.28, cam.dist ?? 10.5, dt, cam.offset ?? 0);
  } else {
    // A shot may override the look-at point (tx/tz) to compose the player
    // off-centre — the start key art needs Luz clear of the title panel,
    // and lookAt(player) would pin her to the exact centre forever.
    const target = { x: cam.tx ?? player.pos.x, y: 1.6, z: cam.tz ?? player.pos.z };
    render.updateCamera(target, player.camYaw, cam.pitch ?? player.camPitch, cam.dist ?? 7.5, dt, cam.offset ?? 0);
  }
}

function hudData() {
  const waypoint = waypointOf(missions);
  return {
    money: state.money,
    stars: stars(),
    health: Math.round(state.health),
    clockMin: state.clockMin,
    speedKmh: player.inCar ? carSpeedKmh(player.inCar) : 0,
    inCar: !!player.inCar,
    carName: player.inCar ? (player.inCar.police ? 'Cruiser' : player.inCar.kind === 'sport' ? 'Sport coupe' : 'Street car') : '',
    ammo: combat.ammo,
    magSize: combat.magSize,
    missionChip: missions.done ? 'FREE ROAM' : `MISSION ${missions.index + 1}/4 · ${currentMission(missions).giver}`,
    missionTitle: currentMission(missions).title,
    missionProgress: missions.done ? 1 : missions.step / currentMission(missions).steps.length,
    objective: missions.done ? missionText(missions) : currentStep(missions).text,
    message: state.message,
    messageTimer: state.messageTimer,
    player: { x: player.pos.x, z: player.pos.z, heading: player.inCar ? player.inCar.heading : player.heading },
    police: police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
    traffic: traffic.cars.slice(0, 12).map((c) => ({ x: c.pos.x, z: c.pos.z })),
    waypoint,
  };
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_CONFIRM) {
    if (state.screen === 'start') startGame();
    else if (state.screen === 'busted') restart();
    else if (state.screen === 'paused') {
      state.screen = 'play';
      hud.showScreen('play');
    }
  }
  if (actions & ACTION_PAUSE) {
    if (state.screen === 'play') {
      state.screen = 'paused';
      hud.showScreen('paused');
      announce('Paused.');
    } else if (state.screen === 'paused') {
      state.screen = 'play';
      hud.showScreen('play');
    }
  }
  if (state.screen !== 'play') return;
  if (actions & ACTION_ENTER_CAR) {
    if (player.inCar) exitCar();
    else enterCar();
  }
  if (actions & ACTION_PUNCH && !player.inCar) {
    audio.punch();
    tryPunch(combat, player, peds, state);
  }
  if (actions & ACTION_SHOOT) {
    audio.shoot();
    const origin = { x: player.pos.x, z: player.pos.z };
    const dir = { x: Math.sin(player.camYaw), z: Math.cos(player.camYaw) };
    tryShoot(combat, origin, dir, peds, police.cars, state);
  }
  if (actions & ACTION_RELOAD) {
    combat.reloadTimer = 1.4;
    combat.ammo = combat.magSize;
  }
}

// Test hooks: the headless play-test drives the game through these.
window.__game = {
  state, player, missions, police, traffic, peds, combat, world, heli,
  stars, enterCar, exitCar, startGame, bust,
  shotReady: false,
};

function runShot(name) {
  const scene = stageShot(name, { state, player, traffic, peds, police, missions, combat, world, render, rng, heli });
  // Shots stage positions directly, so sync the player figure by hand: on
  // foot it stands where the camera looks, in a car it is hidden. v3 R2:
  // the start shot is key art now — Luz stands beside her sport car, so
  // the figure stays visible there too.
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.inCar ? player.inCar.heading : player.heading;
  player.mesh.visible = !player.inCar;
  updateCamera(1); // snap the chase camera to its target: a shot gets 4 paints, not 400 frames to converge
  let painted = 0;
  function paint() {
    updateCamera(1 / 60);
    hud.update(hudData());
    render.draw();
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__game.shotReady = true;
    }
  }
  hud.showScreen(scene.screen);
  announce(scene.announce);
  requestAnimationFrame(paint);
}

function runGame() {
  load();
  hud.showScreen('start');
  announce('Palmera City. Press Space or click to start.');
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (state.screen === 'play') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
        if (state.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
      if (state.screen === 'start') {
        // Idle attract mode: slow orbit around the beach spawn.
        const t = performance.now() / 1000;
        player.camYaw = Math.PI + Math.sin(t * 0.1) * 0.4;
      }
    }
    updateCamera(1 / 60);
    hud.update(hudData());
    render.draw();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      hud.showScreen('paused');
    }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
