// Combat: fists and a pistol. Punch (F) knocks down the nearest pedestrian in
// reach and lifts a little cash; shooting (click) is a hitscan shot toward the
// camera's aim — the nearest pedestrian or police cruiser in the cone takes the
// hit. Both raise the wanted heat; the HUD ammo counter reads from here.
import { nearestPed } from './pedestrians.js';
import { MONEY, WANTED } from './config.js';

export function createCombat() {
  return { ammo: 12, magSize: 12, reloadTimer: 0, flash: 0, lastShot: '', tracerFrom: null, tracerTo: null };
}

export function tryPunch(combat, player, peds, state) {
  if (player.punchTimer > 0) return;
  player.punchTimer = 0.35;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const ped = nearestPed(peds, player.pos.x + fx * 1.5, player.pos.z + fz * 1.5, 2.6);
  if (!ped) return;
  ped.down = 4;
  ped.mesh.rotation.x = -Math.PI / 2 + 0.2;
  state.money += MONEY.punchLoot;
  state.heat = Math.min(100, state.heat + WANTED.punch);
  state.message = `+$${MONEY.punchLoot} lifted`;
  state.messageTimer = 2;
}

export function tryShoot(combat, origin, dir, peds, policeCars, state) {
  if (combat.reloadTimer > 0 || combat.ammo <= 0) return;
  combat.ammo -= 1;
  combat.flash = 0.12;
  let best = null;
  let bestD = 45;
  let bestKind = '';
  for (const ped of peds) {
    if (ped.down > 0) continue;
    const dx = ped.pos.x - origin.x;
    const dz = ped.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && d > 0.5) {
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot > 0.92) { best = ped; bestD = d; bestKind = 'ped'; }
    }
  }
  for (const car of policeCars) {
    const dx = car.pos.x - origin.x;
    const dz = car.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && d > 0.5) {
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot > 0.9) { best = car; bestD = d; bestKind = 'police'; }
    }
  }
  if (bestKind === 'ped') {
    best.down = 6;
    best.mesh.rotation.x = -Math.PI / 2 + 0.2;
    state.heat = Math.min(100, state.heat + WANTED.shoot);
    state.message = 'Shot fired — the PD heard that';
    state.messageTimer = 2;
  } else if (bestKind === 'police') {
    best.speed *= 0.4;
    state.heat = Math.min(100, state.heat + WANTED.shoot);
    state.message = 'You hit a cruiser!';
    state.messageTimer = 2;
  } else {
    state.heat = Math.min(100, state.heat + 4);
  }
  // Tracer: muzzle to the hit (or 30 m downrange on a miss), so the shot
  // reads in a still frame, not just while the flash is up.
  combat.tracerFrom = { x: origin.x + dir.x * 1.2, y: 1.4, z: origin.z + dir.z * 1.2 };
  combat.tracerTo = best
    ? { x: best.pos.x, y: 1.2, z: best.pos.z }
    : { x: origin.x + dir.x * 30, y: 1.2, z: origin.z + dir.z * 30 };
  if (combat.ammo === 0) {
    combat.reloadTimer = 1.4;
    combat.ammo = combat.magSize;
  }
}

export function stepCombat(combat, dt) {
  combat.flash = Math.max(0, combat.flash - dt);
  if (combat.reloadTimer > 0) {
    combat.reloadTimer -= dt;
    if (combat.reloadTimer <= 0) combat.ammo = combat.magSize;
  }
}
