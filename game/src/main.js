// main.js — bootstrap and the one owner of game state. Builds every
// module, runs the fixed-step loop, moves money/heat/health only here,
// handles enter/exit car, busts, dialogs, autosave and the HUD data
// contract. Also exposes the test/staging hooks window.__game and
// window.__palmera.
import { CITY, CLOCK_START, CRIME_HEAT, DIALOG, HEAT_DECAY, HEAT_MAX,
  HEAT_PER_STAR, KINDS, MISSIONS, RADIO, SAVE_KEY, SPAWN, STAR_MAX,
  START_MONEY, BUST_FINE, WEAPONS, districtOf } from './config.js';
import { makeRng, seedFromUrl, clamp } from './random.js';
import { createRender, createBeacon } from './render.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPlayer, stepPlayer, syncPlayerToCar } from './player.js';
import { driveCar } from './vehicles.js';
import { createPolice, policeStatus } from './police.js';
import { createHeli } from './heli.js';
import { createPeds } from './pedestrians.js';
import { createCombat } from './combat.js';
import { createMissions, dialogKeyForChapter } from './missions.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { readShotParam, stageShot } from './shots.js';

const seed = seedFromUrl();
const rng = makeRng(seed);
const app = document.getElementById('app');
const render = createRender(app);
render.canvas.classList.add('webgl');
const world = createWorld(render.scene, rng);
const traffic = createTraffic(render.scene, world, rng);
const peds = createPeds(render.scene, world, rng);
const police = createPolice(render.scene, world);
const heli = createHeli(render.scene);
const player = createPlayer(render.scene);
const combat = createCombat(render.scene);
const missions = createMissions();
const beacon = createBeacon(render.scene);
const hud = createHud(world);
const input = createInput(render.canvas);
const audio = createAudio();

const state = {
  screen: 'start', time: 0, money: START_MONEY, health: 100, heat: 0,
  day: 1, clockMin: CLOCK_START, message: '', messageTimer: 0,
  dialog: null, dialogTimer: 0, busts: 0, bustTimer: 0, shotCam: null,
  chapterTime: 0, lastDamageAt: -99, ramCd: 0, saveTimer: 0, started: false,
};
const stars = () => (state.heat <= 0 ? 0 : Math.min(STAR_MAX, Math.ceil(state.heat / HEAT_PER_STAR)));
const seen = () => stars() > 0 && police.cars.some((c) =>
  Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 45);
function addHeat(n) { state.heat = clamp(state.heat + n, 0, HEAT_MAX); }
function setDialog(d, secs = 6) { state.dialog = d; state.dialogTimer = secs; }
function setMessage(t, secs = 2.6) { state.message = t; state.messageTimer = secs; }

// ---------- save / load ----------
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: Math.round(player.pos.x * 10) / 10, z: Math.round(player.pos.z * 10) / 10,
      money: state.money, missionIndex: missions.index, done: missions.done,
      smg: combat.unlockedSmg, respect: respect(),
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.money === 'number') state.money = s.money;
    if (typeof s.missionIndex === 'number') {
      missions.index = clamp(s.missionIndex, 0, MISSIONS.length);
      missions.done = !!s.done || missions.index >= MISSIONS.length;
      missions.step = 0;
    }
    if (typeof s.x === 'number' && typeof s.z === 'number') {
      player.pos.x = s.x; player.pos.z = s.z;
    }
    combat.unlockedSmg = !!s.smg || missions.index >= 2;
  } catch { /* a corrupt save must never block the game */ }
}
function respect() {
  return missions.index * 3 + (missions.done ? 4 : 0) + Math.floor(state.money / 500);
}

// ---------- car entry / exit ----------
function nearestCar() {
  let best = null; let bd = 4.5;
  for (const c of traffic.all) {
    if (c.playerDriven) continue;
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(car) {
  if (!car || player.inCar) return;
  player.inCar = car;
  car.playerDriven = true; car.parked = false;
  player.mesh.visible = false;
  if (!car.stolen) { car.stolen = true; addHeat(CRIME_HEAT.steal); }
  syncPlayerToCar(player, car);
  audio.ensure();
  save();
}
function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const px = Math.cos(car.heading); const pz = -Math.sin(car.heading); // perpendicular
  let placed = false;
  for (const side of [1, -1]) {
    const cand = { x: car.pos.x + px * 2.5 * side, z: car.pos.z + pz * 2.5 * side };
    if (!world.hitsBuilding(cand, player.radius)) { player.pos.x = cand.x; player.pos.z = cand.z; placed = true; break; }
  }
  if (!placed) {
    player.pos.x = car.pos.x + px * 2.5; player.pos.z = car.pos.z + pz * 2.5;
    world.collide(player.pos, player.radius);
  }
  player.heading = car.heading;
  player.mesh.visible = true;
  car.playerDriven = false; car.parked = true; car.speed = 0;
  player.inCar = null;
}

// ---------- flow ----------
function startGame() {
  if (state.screen === 'play') return;
  state.screen = 'play'; state.started = true;
  hud.showScreen(null);
  input.setTouchVisible(true);
  audio.ensure(); audio.ui();
  if (missions.index === 0 && missions.step === 0 && state.time < 1) setDialog(DIALOG.m1_start, 7);
}
function bust(kind) {
  if (state.screen !== 'play') return;
  state.screen = 'busted';
  state.busts += 1;
  state.money = Math.max(0, state.money - BUST_FINE);
  state.heat = 0; state.bustTimer = 0;
  if (player.inCar) { const c = player.inCar; c.playerDriven = false; c.parked = true; c.speed = 0; player.inCar = null; player.mesh.visible = true; }
  state.health = 100;
  hud.showScreen('busted', kind === 'wasted'
    ? { title: 'WASTED', sub: 'Kamu tumbang di jalanan Palmera. Biaya medis $100.' }
    : { title: 'BUSTED', sub: 'Palmera PD menahanmu. Denda $100.' });
  input.setTouchVisible(false);
  save();
}
function resumeFromBusted() {
  state.screen = 'play';
  hud.showScreen(null);
  input.setTouchVisible(true);
}

// ---------- per-step update ----------
function step(dt) {
  const camDelta = input.takeCam();
  if (state.screen === 'start') {
    if (input.take('confirm')) startGame();
    return;
  }
  if (state.screen === 'busted') {
    if (input.take('confirm')) resumeFromBusted();
    return;
  }
  if (state.screen === 'pause') {
    if (input.take('pause') || input.take('confirm')) { state.screen = 'play'; hud.showScreen(null); input.setTouchVisible(true); }
    return;
  }
  // screen === 'play'
  state.time += dt;
  state.chapterTime += dt;
  state.clockMin = CLOCK_START + Math.floor(state.time * 0.5);
  state.day = 1 + Math.floor((state.clockMin - CLOCK_START) / 1440);
  if (input.take('pause')) { state.screen = 'pause'; hud.showScreen('pause'); input.setTouchVisible(false); return; }
  player.camYaw -= camDelta.dx * 0.004;
  player.camPitch = clamp(player.camPitch + camDelta.dy * 0.002, 0.08, 0.9);
  const car = player.inCar;
  state.ramCd = Math.max(0, state.ramCd - dt);
  if (car) {
    const hitHard = driveCar(car, input.held, dt, world);
    syncPlayerToCar(player, car);
    if (hitHard) {
      audio.crash(true);
      const cop = police.cars.find((c) => Math.hypot(c.pos.x - car.pos.x, c.pos.z - car.pos.z) < 3.4);
      if (cop && state.ramCd <= 0) { addHeat(CRIME_HEAT.cruiserRam); state.ramCd = 1.2; }
    }
    audio.setEngine(true, Math.abs(car.speed) / 38);
  } else {
    audio.setEngine(false, 0);
    stepPlayer(player, input.held, dt, world);
    if (input.aim.down) player.heading = player.camYaw;
    if (input.take('punch')) {
      const ped = peds.list.find((p) => p.fallTimer <= 0 &&
        Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 2.4);
      if (ped) {
        ped.fall(); state.money += 15; addHeat(CRIME_HEAT.punch);
        audio.punch(); setMessage('Took $15 off a pedestrian');
      }
    }
  }
  if (input.take('enter')) {
    if (player.inCar) exitCar();
    else { const c = nearestCar(); if (c) enterCar(c); }
  }
  // weapons
  if (input.take('weapon1')) combat.switchTo('pistol');
  if (input.take('weapon2')) combat.switchTo('smg');
  if (input.take('reload')) { combat.startReload(); audio.reload(); }
  const firing = !player.inCar && input.aim.down;
  const targets = [];
  for (const c of police.cars) targets.push({ pos: c.pos, radius: 1.8, car: c, police: true });
  for (const c of traffic.all) if (!c.playerDriven) targets.push({ pos: c.pos, radius: 1.8, car: c });
  for (const p of peds.list) targets.push({ pos: p.pos, radius: 0.7, ped: p });
  const shot = combat.update(dt, firing, { origin: player.pos, aimYaw: player.camYaw, targets });
  if (shot) {
    if (shot.type === 'dry') audio.dryFire();
    else {
      audio.shot(combat.weapon === 'smg');
      if (shot.type === 'hit') {
        addHeat(CRIME_HEAT.shotHit);
        if (shot.target.ped) shot.target.ped.fall();
        if (shot.target.police) setMessage('You hit a cruiser!');
      }
    }
  }
  // wanted decay + police + heli
  state.heat = Math.max(0, state.heat - HEAT_DECAY * dt);
  const spd = player.inCar ? player.inCar.speed : 0;
  police.step(dt, {
    target: player.pos,
    targetHeading: player.inCar ? player.inCar.heading : player.heading,
    targetSpeed: spd, stars: stars(), time: state.time,
    onRam: () => {
      state.health -= 8; state.lastDamageAt = state.time;
      if (player.inCar) { player.inCar.speed *= 0.55; player.inCar.condition = Math.max(5, player.inCar.condition - 4); }
      audio.crash(false);
    },
  });
  heli.step(dt, player.pos, stars(), state.time);
  traffic.step(dt, player.pos, state.time);
  const threat = (stars() > 0 || combat.tracerTimer > 0) ? player.pos : null;
  peds.step(dt, threat);
  // bust / wasted
  if (state.health <= 0) { bust('wasted'); return; }
  if (stars() >= 1) {
    const near = police.cars.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 4.5);
    if (near && Math.abs(spd) < 1.5) state.bustTimer += dt; else state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    if (state.bustTimer > 2.5) { bust('busted'); return; }
  } else state.bustTimer = 0;
  if (state.time - state.lastDamageAt > 4) state.health = Math.min(100, state.health + 1.5 * dt);
  // missions
  const events = missions.update(dt, { pos: player.pos, inCar: !!player.inCar, stars: stars(), seen: seen() });
  for (const ev of events) {
    if (ev.type === 'chapterDone') {
      state.money += ev.reward;
      audio.cash();
      if (ev.index === MISSIONS.length - 1) { setMessage(`Paper Trail complete — +$${ev.reward}`); setDialog(DIALOG.all_done, 7); }
      else if (ev.index === 3) { setMessage(`Debt paid! ${ev.title} complete — +$${ev.reward}`); setDialog(DIALOG.mission_done, 6); }
      else setMessage(`${ev.title} complete — +$${ev.reward}`);
      state.chapterTime = 0;
      save();
    } else if (ev.type === 'chapterStart') {
      state.chapterTime = 0;
      const key = dialogKeyForChapter(ev.index);
      if (ev.index === 2) { // Rosa's gift arrives as CH3 opens
        combat.unlockedSmg = true;
        setDialog(DIALOG.m5_gift, 7);
      } else if (key) setDialog(DIALOG[key], 6);
    } else if (ev.type === 'stepDone') {
      setMessage('Step complete');
      if (ev.index === 2 && ev.step === 1) setDialog(DIALOG.m3_heat, 6);
    }
  }
  // beacon, dialog & message timers, autosave
  const wp = missions.waypoint();
  beacon.set(wp ? wp.x : 0, wp ? wp.z : 0, !!wp);
  beacon.step(state.time);
  if (state.dialogTimer > 0) { state.dialogTimer -= dt; if (state.dialogTimer <= 0) state.dialog = null; }
  if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) state.message = ''; }
  state.saveTimer += dt;
  if (state.saveTimer > 5) { state.saveTimer = 0; save(); }
  audio.setSiren(stars() > 0 && police.cars.length > 0,
    police.cars.length ? clamp(Math.hypot(police.cars[0].pos.x - player.pos.x, police.cars[0].pos.z - player.pos.z) / 90, 0, 1) : 1);
  audio.stepRadio(dt, !!player.inCar);
}

// ---------- HUD data ----------
function hudData() {
  const s = stars();
  const c = missions.current();
  const stepDef = missions.currentStep();
  const wp = missions.waypoint();
  const car = player.inCar;
  const kmh = car ? Math.abs(car.speed) * 3.6 : 0;
  return {
    money: state.money, stars: s, seen: seen(), health: Math.round(state.health),
    armor: car ? Math.round(car.condition) : null,
    stamina: Math.round(player.stamina), respect: respect(),
    clockMin: state.clockMin, day: state.day, time: state.time,
    mission: {
      chapter: missions.index + 1, title: missions.done ? 'Free Roam' : (c ? c.title : 'Free Roam'),
      objective: missions.done ? 'Palmera is yours — the debt is settled.' : (stepDef ? stepDef.text : ''),
      sub: wp ? `· ${Math.round(Math.hypot(wp.x - player.pos.x, wp.z - player.pos.z))} m` :
        (stepDef && stepDef.type === 'evade' ? 'Break line of sight until the stars fade' : ''),
      nextText: missions.nextStepText(),
      stepIndex: missions.step, stepCount: c ? c.steps.length : 1,
      timerSec: c ? Math.max(0, c.timerSec - state.chapterTime) : null, done: missions.done,
    },
    police: police.cars.map((pc) => ({
      callsign: pc.callsign || 'UNIT',
      dist: Math.round(Math.hypot(pc.pos.x - player.pos.x, pc.pos.z - player.pos.z)),
      status: policeStatus(pc, player.pos),
    })).sort((a, b) => (a.status === 'ROADBLOCK' ? 0 : 1) - (b.status === 'ROADBLOCK' ? 0 : 1)),
    heliActive: heli.active,
    dialog: state.dialog, inCar: !!car,
    carModel: car ? KINDS[car.kind].name : '', carCondition: car ? Math.round(car.condition) : 100,
    speedKmh: kmh, gear: !car ? 'N' : car.speed < -0.5 ? 'R' : Math.abs(car.speed) < 0.5 ? 'N' : String(1 + Math.min(4, Math.floor(kmh / 32))),
    weapon: { slot: WEAPONS[combat.weapon].slot, label: WEAPONS[combat.weapon].label, ammo: combat.ammo },
    smgUnlocked: combat.unlockedSmg,
    radio: { songIndex: ((Math.floor(state.time / RADIO.songSec) % RADIO.songs.length) + RADIO.songs.length) % RADIO.songs.length, progress: (state.time % RADIO.songSec) / RADIO.songSec },
    player: { x: player.pos.x, z: player.pos.z, heading: car ? car.heading : player.heading },
    policePos: police.cars.map((pc) => ({ x: pc.pos.x, z: pc.pos.z })),
    trafficPos: traffic.all.slice(0, 16).map((tc) => ({ x: tc.pos.x, z: tc.pos.z })),
    waypoint: wp, searchR: 55 + s * 15,
    district: districtOf(player.pos.x, player.pos.z),
    message: state.message,
  };
}

// ---------- boot, staging hooks, loop ----------
const shotInfo = readShotParam();
if (!shotInfo.shot) load();
const gameApi = {
  state, player, missions, police, traffic, peds, combat, world, heli,
  stars, enterCar, exitCar, startGame, bust: () => bust('busted'),
};
window.__game = gameApi;
window.__palmera = {
  money: () => state.money,
  speed: () => (player.inCar ? player.inCar.speed : 0),
  chapter: () => missions.index,
  stars, heat: () => state.heat,
  busts: () => state.busts,
  pos: () => ({ x: player.pos.x, z: player.pos.z }),
  screen: () => state.screen,
};
if (shotInfo.shot) {
  stageShot(gameApi, shotInfo.shot);
  if (shotInfo.shot === 'start') hud.showScreen('start');
} else if (shotInfo.play) startGame();
else { hud.showScreen('start'); setDialogSafe(); }
function setDialogSafe() { if (missions.index === 0) { state.dialog = DIALOG.m1_start; state.dialogTimer = 999; } }
input.setTouchVisible(false);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play') {
    state.screen = 'pause'; hud.showScreen('pause'); input.setTouchVisible(false);
  }
});

let last = performance.now();
let framesRendered = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - last; last = now;
  render.adapt(dtMs);
  // Sub-stepped variable dt: the FULL frame time is simulated (in
  // <= 1/30 s slices) so game time tracks wall time even when the
  // renderer crawls — wanted decay and timers are wall-clock contracts.
  const dt = Math.min(1.2, Math.max(0, dtMs / 1000)); // rAF timestamps can predate module-eval time on frame one
  const n = Math.max(1, Math.ceil(dt / 0.0333));
  const h = dt / n;
  for (let i = 0; i < n; i += 1) step(h);
  // camera
  if (state.screen === 'start' && !shotInfo.shot) {
    render.orbit(state.time + performance.now() / 1000, 0, 150, 64, 25);
  } else if (player.inCar) {
    const sc = state.shotCam || { dist: 9.5, pitch: 0.24 };
    render.follow(dt, { pos: { x: player.inCar.pos.x, z: player.inCar.pos.z, y: 0.6 }, heading: player.inCar.heading, dist: sc.dist, pitch: sc.pitch, inCar: true, lookAhead: 8 });
  } else {
    const sc = state.shotCam || { dist: 7, pitch: player.camPitch };
    render.follow(dt, { pos: { x: player.pos.x, z: player.pos.z, y: 0.9 }, heading: player.camYaw, dist: sc.dist, pitch: sc.pitch, inCar: false, lookAhead: 7 });
  }
  hud.update(hudData());
  render.render();
  framesRendered += 1;
  if (shotInfo.shot && framesRendered >= 6) window.__shotReady = true;
}
requestAnimationFrame(frame);
export { CITY };
