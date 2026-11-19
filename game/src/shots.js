// shots.js — deterministic staging for screenshots and automated
// tests. ?shot=start|chase|street|mission (with ?seed=) arranges one
// readable scene per name; ?play=1 skips the start screen. Staging only
// positions actors and state — every system then runs normally.
import { DIALOG } from './config.js';

export function readShotParam() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot'), play: q.get('play') === '1' };
}

function putPlayerInSportCar(g, x, z, heading, speed) {
  let car = g.traffic.all.find((c) => c.kind === 'sport');
  if (!car) car = g.traffic.all[0];
  car.pos.x = x; car.pos.z = z; car.heading = heading; car.speed = speed;
  g.player.pos.x = x; g.player.pos.z = z;
  g.enterCar(car);
  return car;
}
function placeCruisers(g, spots) {
  // Spawn by raising heat through the normal police step in main; here
  // we only guarantee the count by staging heat and letting main run.
  void spots;
}

export function stageShot(g, name) {
  const { state, player, missions } = g;
  if (name === 'start') {
    // Key-art foreground: the hero car parked by the beach road, Luz
    // standing beside it, start overlay on top of the living city.
    const car = g.traffic.all.find((c) => c.kind === 'sport');
    if (car) { car.pos.x = 10; car.pos.z = 172; car.heading = Math.PI / 2; }
    player.pos.x = 4; player.pos.z = 178; player.camYaw = Math.PI;
    state.dialog = DIALOG.m1_start; state.dialogTimer = 999;
    return;
  }
  g.startGame();
  if (name === 'chase') {
    missions.index = 2; missions.step = 1; // CH3 evade, mid-pursuit
    const car = putPlayerInSportCar(g, 0, 108, 0, 33);
    void car;
    state.heat = 51; // 3 stars
    state.dialog = DIALOG.m3_heat; state.dialogTimer = 999;
    state.shotCam = { dist: 9.5, pitch: 0.22 };
  } else if (name === 'street') {
    player.pos.x = -24; player.pos.z = 6;
    player.heading = Math.PI / 2; player.camYaw = Math.PI / 2;
    state.dialog = DIALOG.m1_start; state.dialogTimer = 999;
    state.shotCam = { dist: 4.5, pitch: 0.3 };
  } else if (name === 'mission') {
    missions.index = 0; missions.step = 1; // CH1 delivery leg, beacon lit
    putPlayerInSportCar(g, 96, 120, Math.PI / 4, 12);
    state.heat = 34; // 2 stars: PD panel visible alongside the mission card
    state.dialog = DIALOG.m1_start; state.dialogTimer = 999;
    state.shotCam = { dist: 9.5, pitch: 0.26 };
  }
  placeCruisers(g);
}
