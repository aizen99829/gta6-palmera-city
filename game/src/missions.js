// Missions and the Luz Vega story: four chained jobs from MISSIONS in config.
// Each step completes by its own rule (steal a car, reach a waypoint, raise the
// heat, lose the heat, deliver). Rewards pay out per mission; the HUD tracker
// and the minimap blip read the current step from here.
import { MISSIONS, MONEY } from './config.js';

export function createMissions() {
  return { index: 0, step: 0, done: false, flash: 0, message: '' };
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
  if (step.type === 'goto' && step.pos) return { x: step.pos[0], z: step.pos[1], radius: step.radius || 9 };
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
  } else if (step.type === 'heat') complete = ctx.stars >= (step.stars || 3);
  else if (step.type === 'evade') complete = ctx.stars === 0 && ctx.heatStepArmed;
  if (!complete) return null;
  missions.step += 1;
  missions.flash = 2;
  if (missions.step >= m.steps.length) {
    const reward = MONEY.missionReward[missions.index] || 500;
    ctx.money += reward;
    missions.message = `${m.title} complete — +$${reward}`;
    missions.index += 1;
    missions.step = 0;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      missions.message = `Debt paid! All jobs done — +$${reward}`;
      return 'all';
    }
    return 'mission';
  }
  missions.message = 'Objective updated';
  return 'step';
}
