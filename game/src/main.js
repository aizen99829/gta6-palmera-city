// Palmera City — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there. Screens:
// start, play, paused, busted. ?shot=chase|street|mission|start (with &seed=N)
// stages that scene from the real game instead of running the loop, paints it
// a few times and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CITY, CLOCK_START, MISSIONS, MONEY, NAMES, PLAYER, RADIO, SAVE_KEY, STEP, WANTED, WEAPONS, districtOf } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer, stepPlayer } from './player.js';
import { attachPlayerStreak, createCar, detachPlayerStreak, driveCar, carSpeedKmh } from './vehicles.js';
import { createTraffic, stepTraffic, nearestCar } from './traffic.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { createPolice, stepPolice } from './police.js';
import { createMissions, currentMission, currentStep, dialogFor, missionText, nextStepText, stepMissions, waypointOf } from './missions.js';
import { policeStatus } from './police.js';
import { createCombat, switchWeapon, tryPunch, tryShoot, stepCombat } from './combat.js';
import { createHud } from './hud.js';
import { createHeli, stepHeli } from './heli.js';
import { createAudio } from './audio.js';
import { createRender } from './render.js';
import { setMaxAnisotropy } from './textures.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, ACTION_SHOOT, ACTION_WEAPON_PISTOL, ACTION_WEAPON_SMG, createInput } from './input.js';
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
setMaxAnisotropy(render.renderer.capabilities.getMaxAnisotropy()); // v5.2: before any texture is built
const world = createWorld(render.scene, rng);
const hud = createHud(world); // v5: the minimap pre-renders from world data
const audio = createAudio();
const input = createInput(canvas);
const player = createPlayer(render.scene);
const traffic = createTraffic(render.scene, rng, world);
const peds = createPedestrians(render.scene, rng, world);
const police = createPolice(render.scene);
const heli = createHeli(render.scene); // v5: visual-only air unit (f1–f3)
const missions = createMissions();
const combat = createCombat();

const state = {
  screen: 'start',
  money: MONEY.start,
  health: PLAYER.maxHealth,
  heat: 0,
  clockMin: CLOCK_START, // v5: the day opens inside the sunset window (a6)
  day: 1,
  message: '',
  messageTimer: 0,
  crashTimer: 0, // crash damage at most once per half second: a pinned car
  // scraping a wall must not bleed out in a second of taps
  saveTimer: 0,
  time: 0,
  // v5 (g5): the dialog bar's current line + how long it stays up, and the
  // mission index that already showed Rosa's first-3★ line.
  dialog: null,
  dialogTimer: 0,
  dialogHeatMission: -1,
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
    if (typeof s.mission === 'number') missions.index = Math.min(s.mission, MISSIONS.length);
    if (missions.index >= MISSIONS.length) missions.done = true; // a finished campaign stays finished (v5.1: CH5 exists now)
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
  player.mesh.visible = false; // she is in the seat, not standing at the door
  attachPlayerStreak(car); // v5 (b3): pink road streak + headlight beam
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
  detachPlayerStreak(car);
  car.driver = null;
  car.parked = true;
  if (!traffic.all.includes(car)) traffic.all.push(car);
  player.inCar = null;
  const sx = Math.cos(car.heading) * 2.5;
  const sz = -Math.sin(car.heading) * 2.5;
  let placed = false;
  for (const s of [1, -1]) {
    if (!world.hitsBuilding(car.pos.x + sx * s, car.pos.z + sz * s, PLAYER.radius)) {
      player.pos.x = car.pos.x + sx * s;
      player.pos.z = car.pos.z + sz * s;
      placed = true;
      break;
    }
  }
  if (!placed) {
    const fixed = world.collide(car.pos.x + sx, car.pos.z + sz, PLAYER.radius);
    player.pos.x = fixed.x;
    player.pos.z = fixed.z;
  }
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

function showDialog(entry) {
  if (!entry) return;
  state.dialog = entry;
  state.dialogTimer = 5;
}

function startGame() {
  state.screen = 'play';
  audio.unlock();
  hud.showScreen('play');
  announce('Playing Palmera City.');
  showDialog(dialogFor(missions, 'start'));
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
  // v5.1 (P6): `seen` is the HUD badge's rule — a cruiser within 45 m
  // while wanted. The CH5 sneak drop reads it.
  let nearestCop = Infinity;
  for (const c of police.cars) nearestCop = Math.min(nearestCop, Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z));
  const starCount = stars();
  return {
    x: pos.x, z: pos.z, inCar,
    stars: starCount,
    seen: starCount > 0 && nearestCop <= 45,
    heatStepArmed: missions.index === 2 && missions.step === 1,
    money: state.money,
    time: state.time,
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
    player.pos.x = player.inCar.pos.x;
    player.pos.z = player.inCar.pos.z;
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
    heading: player.inCar ? player.inCar.heading : player.heading, // v5.1 (P3): roadblocks aim ahead of this
    inCar: !!player.inCar,
    onRam: () => {
      state.health = Math.max(0, state.health - 8);
      if (player.inCar) {
        player.inCar.speed *= 0.5;
        // v5 (g7): a ram dents the condition readout (−4, display only).
        player.inCar.condition = Math.max(5, (player.inCar.condition ?? 100) - 4);
      }
      state.message = 'Cruiser rammed you!';
      state.messageTimer = 1.5;
    },
  };
  const caught = stepPolice(police, dt, render.scene, rng, target, stars(), world);
  // v5 heli: follows the same target the police chase; purely visual.
  stepHeli(heli, dt, target, stars());
  // v5 (d4): palm crowns sway via a whisper of texture offset — zero draw
  // calls, deterministic in state.time.
  if (world.palmCrownMat) world.palmCrownMat.map.offset.x = Math.sin(state.time * 0.8) * 0.01;
  if (caught) {
    bust();
    return;
  }
  // Missions.
  const ctx = missionContext();
  const result = stepMissions(missions, ctx, dt);
  state.money = ctx.money;
  if (result) {
    audio.mission();
    state.message = missions.message;
    state.messageTimer = 3;
    // v5 (g5): story dialog follows mission events.
    if (result === 'mission') showDialog(dialogFor(missions, 'mission'));
    else if (result === 'all') showDialog(dialogFor(missions, 'all'));
    save();
  }
  // v5 (g5): Rosa's line the first time Luz hits 3 stars during mission 3.
  if (missions.index === 2 && state.dialogHeatMission !== 2 && stars() >= 3) {
    state.dialogHeatMission = 2;
    showDialog(dialogFor(missions, 'heat3'));
  }
  // v5.1 (P5): when CH3 opens, Rosa's SMG becomes Luz's — announced once.
  if (!combat.smgUnlocked && missions.index >= 2) {
    combat.smgUnlocked = true;
    state.message = 'Rosa left you La Ráfaga — press 3 for the SMG';
    state.messageTimer = 4;
  }
  state.dialogTimer = Math.max(0, state.dialogTimer - dt);
  if (state.dialogTimer <= 0) state.dialog = null;
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
    const target = { x: player.pos.x, y: 1.6, z: player.pos.z };
    render.updateCamera(target, player.camYaw, cam.pitch ?? player.camPitch, cam.dist ?? 7.5, dt, cam.offset ?? 0);
  }
}

function hudData() {
  const waypoint = waypointOf(missions);
  const m = currentMission(missions);
  const targetPos = player.inCar ? player.inCar.pos : player.pos;
  const targetHeading = player.inCar ? player.inCar.heading : player.heading;
  let nearestCop = Infinity;
  for (const c of police.cars) nearestCop = Math.min(nearestCop, Math.hypot(c.pos.x - targetPos.x, c.pos.z - targetPos.z));
  const starCount = stars();
  // v5 (g7): gear is derived from signed speed only — R / N / 1..5.
  let gear = 'N';
  if (player.inCar) {
    const s = player.inCar.speed;
    const kmh = carSpeedKmh(player.inCar);
    gear = s < -0.5 ? 'R' : Math.abs(s) < 0.5 ? 'N' : String(1 + Math.min(4, Math.floor(kmh / 32)));
  }
  return {
    money: state.money,
    stars: starCount,
    health: Math.round(state.health),
    clockMin: state.clockMin,
    speedKmh: player.inCar ? carSpeedKmh(player.inCar) : 0,
    inCar: !!player.inCar,
    ammo: combat.ammo,
    magSize: combat.magSize,
    // v5.1 (P5): per-weapon slot readouts — the HUD shows both guns' real
    // ammunition, not just the active one's.
    weapon: combat.weapon,
    smgUnlocked: combat.smgUnlocked,
    pistolAmmo: combat.weapon === 'pistol' ? combat.ammo : combat.stash.pistol,
    pistolMag: WEAPONS.pistol.magSize,
    smgAmmo: combat.weapon === 'smg' ? combat.ammo : combat.stash.smg,
    smgMag: WEAPONS.smg.magSize,
    missionTitle: `${m.title} — ${m.giver}`,
    objective: missionText(missions),
    message: state.message,
    messageTimer: state.messageTimer,
    player: { x: player.pos.x, z: player.pos.z, heading: player.inCar ? player.inCar.heading : player.heading },
    police: police.cars.map((c) => ({
      x: c.pos.x, z: c.pos.z,
      callsign: c.callsign || '—',
      dist: Math.round(Math.hypot(c.pos.x - targetPos.x, c.pos.z - targetPos.z)),
      status: policeStatus(c, targetPos, targetHeading),
    })),
    traffic: traffic.cars.slice(0, 12).map((c) => ({ x: c.pos.x, z: c.pos.z })),
    waypoint,
    // --- v5 HUD contract additions (PLAN §2-g) ---
    day: state.day,
    // IN SIGHT is a plain range read (nearest cruiser ≤45 m), nothing more.
    seen: starCount > 0 && nearestCop <= 45,
    chapter: Math.min(missions.index + 1, MISSIONS.length),
    stepIndex: missions.step,
    stepCount: m.steps.length,
    nextText: nextStepText(missions),
    // Display countdown from the mission's reference budget; zero changes
    // nothing (PLAN §5.3) — see missions.js stepStartedAt.
    missionTimerSec: missions.done || !m.timerSec ? null : Math.max(0, Math.ceil(m.timerSec - (state.time - missions.stepStartedAt))),
    distToWaypoint: waypoint ? Math.round(Math.hypot(waypoint.x - targetPos.x, waypoint.z - targetPos.z)) : null,
    heliActive: heli.active,
    district: districtOf(targetPos.x, targetPos.z),
    stamina: Math.round(player.stamina ?? 100),
    respect: missions.index * 3 + (missions.done ? 4 : 0) + Math.floor(state.money / 500),
    carModel: player.inCar ? (NAMES.cars[player.inCar.police ? 'police' : player.inCar.kind] || NAMES.cars.sedan) : '',
    carCondition: player.inCar ? Math.round(player.inCar.condition ?? 100) : 0,
    gear,
    dialog: state.dialog,
    radio: {
      songIndex: Math.floor(state.time / RADIO.songSec) % RADIO.songs.length,
      progress: (state.time % RADIO.songSec) / RADIO.songSec,
    },
    // Minimap search-zone inputs (g3): centre follows the player.
    searchR: starCount > 0 ? 55 + starCount * 15 : 0,
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
  if (actions & ACTION_WEAPON_PISTOL) switchWeapon(combat, 'pistol');
  if (actions & ACTION_WEAPON_SMG) switchWeapon(combat, 'smg');
  if (actions & ACTION_SHOOT) fireOnce();
  // v5.1 (P5): the SMG is automatic — it keeps firing while the mouse
  // trigger is held (the pistol stays one round per click). The combat
  // fire-rate gate paces the shots; a silent attempt makes no sound.
  if (input.isShootHeld() && combat.weapon === 'smg' && !player.inCar) fireOnce();
  if (actions & ACTION_RELOAD) {
    combat.reloadTimer = 1.4;
    combat.ammo = combat.magSize;
  }
}

function fireOnce() {
  const origin = { x: player.pos.x, z: player.pos.z };
  const dir = { x: Math.sin(player.camYaw), z: Math.cos(player.camYaw) };
  if (tryShoot(combat, origin, dir, peds, police.cars, state)) audio.shoot();
}

// Test hooks: the headless play-test drives the game through these.
window.__game = {
  state, player, missions, police, traffic, peds, combat, world, heli,
  stars, enterCar, exitCar, startGame, bust,
  shotReady: false,
};

function runShot(name) {
  const scene = stageShot(name, { state, player, traffic, peds, police, missions, combat, world, render, rng, heli });
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.inCar ? player.inCar.heading : player.heading;
  player.mesh.visible = name !== 'start' && !player.inCar;
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
  combat.smgUnlocked = missions.index >= 2; // v5.1 (P5): a restored CH3+ save keeps Rosa's SMG
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
