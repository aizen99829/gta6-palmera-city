// Missions and the Luz Vega story: four chained jobs from MISSIONS in config.
// Each step completes by its own rule (steal a car, reach a waypoint, raise the
// heat, lose the heat, deliver). Rewards pay out per mission; the HUD tracker
// and the minimap blip read the current step from here.
import { DIALOG, MISSIONS, MONEY } from './config.js';

export function createMissions() {
  // stepStartedAt (game-time seconds) feeds the HUD mission timer — a
  // DISPLAY countdown only; hitting zero never fails a mission (§5.3).
  return { index: 0, step: 0, done: false, flash: 0, message: '', stepStartedAt: 0 };
}

// v5 (g1): the NEXT ▸ line of the mission panel.
export function nextStepText(missions) {
  if (missions.done) return '—';
  const m = currentMission(missions);
  const next = m.steps[missions.step + 1];
  return next ? next.text : '—';
}

const START_KEYS = ['m1_start', 'm2_start', 'm3_start', 'm4_start', 'm5_start'];

// v5 (g5): which dialog line a story moment shows, or null for none.
export function dialogFor(missions, event) {
  if (event === 'start') return DIALOG[START_KEYS[Math.min(missions.index, START_KEYS.length - 1)]] || null;
  if (event === 'heat3') return DIALOG.m3_heat;
  if (event === 'mission') return DIALOG.mission_done;
  if (event === 'all') return DIALOG.all_done;
  return null;
}

export function currentMission(missions) {
  return MISSIONS[Math.min(missions.index, MISSIONS.length - 1)];
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m.steps[Math.min(missions.step, m.steps.length - 1)];
}

export function waypointOf(missions) {
  const step = currentStep(missions);
  if (missions.done) return null;
  if ((step.type === 'goto' || step.type === 'sneak') && step.pos) return { x: step.pos[0], z: step.pos[1], radius: step.radius || 9 };
  return null;
}

export function missionText(missions) {
  if (missions.done) return 'Debt paid. Palmera City is yours — free roam!';
  const m = currentMission(missions);
  const step = currentStep(missions);
  return `${m.title}: ${step.text}`;
}

// Advance one tick. `ctx` carries the live game facts missions need.
// Returns 'step' | 'mission' | 'all' | null.
export function stepMissions(missions, ctx, dt) {
  if (missions.done) return null;
  missions.flash = Math.max(0, missions.flash - dt);
  const m = currentMission(missions);
  const step = currentStep(missions);
  let complete = false;
  if (step.type === 'steal') complete = !!ctx.inCar;
  else if (step.type === 'goto' && step.pos) {
    const d = Math.hypot(ctx.x - step.pos[0], ctx.z - step.pos[1]);
    complete = d < (step.radius || 9) && (!step.needsCar || ctx.inCar);
  } else if (step.type === 'sneak' && step.pos) {
    // v5.1 (P6): the drop counts only while unseen — arrive spotted and
    // nothing happens until line of sight is broken (ctx.seen is the
    // same rule the HUD's IN SIGHT / HIDDEN badge shows).
    const d = Math.hypot(ctx.x - step.pos[0], ctx.z - step.pos[1]);
    complete = d < (step.radius || 9) && !ctx.seen;
  } else if (step.type === 'heat') complete = ctx.stars >= (step.stars || 3);
  else if (step.type === 'evade') complete = ctx.stars === 0 && ctx.heatStepArmed;
  if (!complete) return null;
  missions.step += 1;
  missions.stepStartedAt = ctx.time ?? missions.stepStartedAt;
  missions.flash = 2;
  if (missions.step >= m.steps.length) {
    const reward = MONEY.missionReward[missions.index] || 500;
    ctx.money += reward;
    missions.message = `${m.title} complete — +$${reward}`;
    missions.index += 1;
    missions.step = 0;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      // v5.1 (P6): the debt itself was settled at CH4; the campaign close
      // no longer re-announces it over the CH5 bonus payout.
      missions.message = `All jobs done — Palmera is yours — +$${reward}`;
      return 'all';
    }
    return 'mission';
  }
  missions.message = 'Objective updated';
  return 'step';
}
