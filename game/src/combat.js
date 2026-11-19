// combat.js — Luz's two real guns. The pistol "La Chica" is hers from
// the start (12-round mag, semi-auto feel via a 0.28 s gate). The SMG
// "La Ráfaga" is Rosa's gift when CH3 opens: 32-round mag, full-auto at
// ~12 rounds a second. Each weapon keeps its own magazine across
// switches; an empty mag auto-reloads. Hits are hitscan along the aim
// direction and slow cruisers by the weapon's factor.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export function createCombat(scene) {
  const mags = { pistol: WEAPONS.pistol.mag, smg: WEAPONS.smg.mag };
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  flash.visible = false; scene.add(flash);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false; scene.add(tracer);
  const combat = {
    weapon: 'pistol', ammo: mags.pistol, reloadTimer: 0, fireTimer: 0,
    unlockedSmg: false, tracerTimer: 0, lastShotHit: false,
    switchTo(name) {
      if (name === combat.weapon) return false;
      if (name === 'smg' && !combat.unlockedSmg) return false;
      mags[combat.weapon] = combat.ammo;
      combat.weapon = name;
      combat.ammo = mags[name];
      combat.fireTimer = Math.max(combat.fireTimer, 0.25); // swap pause
      combat.reloadTimer = 0;
      return true;
    },
    startReload() {
      const W = WEAPONS[combat.weapon];
      if (combat.reloadTimer <= 0 && combat.ammo < W.mag) combat.reloadTimer = W.reload;
    },
    // ctx: { origin {x,z}, aimYaw, targets: [{pos, radius, car?}], onEvent }
    update(dt, firing, ctx) {
      combat.fireTimer = Math.max(0, combat.fireTimer - dt);
      combat.tracerTimer = Math.max(0, combat.tracerTimer - dt);
      if (combat.tracerTimer <= 0) { tracer.visible = false; flash.visible = false; }
      if (combat.reloadTimer > 0) {
        combat.reloadTimer = Math.max(0, combat.reloadTimer - dt);
        if (combat.reloadTimer <= 0) {
          combat.ammo = WEAPONS[combat.weapon].mag;
          mags[combat.weapon] = combat.ammo;
        }
        return null;
      }
      if (!firing || combat.fireTimer > 0) return null;
      const W = WEAPONS[combat.weapon];
      if (combat.ammo <= 0) { // empty click, then the auto-reload kicks in
        combat.startReload();
        return { type: 'dry' };
      }
      combat.ammo -= 1; mags[combat.weapon] = combat.ammo;
      combat.fireTimer = W.rate;
      combat.tracerTimer = 0.05;
      // Hitscan: nearest target inside a narrow cone along the aim.
      const ox = ctx.origin.x; const oz = ctx.origin.z;
      const fx = Math.sin(ctx.aimYaw); const fz = Math.cos(ctx.aimYaw);
      let best = null; let bestT = 70;
      for (const t of ctx.targets) {
        const dx = t.pos.x - ox; const dz = t.pos.z - oz;
        const along = dx * fx + dz * fz;
        if (along < 1 || along > bestT) continue;
        const perp = Math.abs(dx * fz - dz * fx);
        if (perp < (t.radius || 1.6)) { best = t; bestT = along; }
      }
      const endX = ox + fx * bestT; const endZ = oz + fz * bestT;
      const pts = [new THREE.Vector3(ox, 1.45, oz), new THREE.Vector3(endX, 1.1, endZ)];
      tracer.geometry.setFromPoints(pts); tracer.visible = true;
      flash.position.set(ox + fx * 0.7, 1.45, oz + fz * 0.7); flash.visible = true;
      if (combat.ammo <= 0) combat.startReload();
      if (best) {
        if (best.car) best.car.speed *= W.slow;
        return { type: 'hit', target: best, dist: bestT };
      }
      return { type: 'shot' };
    },
  };
  return combat;
}
export const combatClamp = clamp;
