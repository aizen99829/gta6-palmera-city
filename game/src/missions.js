// missions.js — the five-chapter story chain. A tiny step machine:
// each chapter is a list of steps (steal / goto / heat / evade / sneak)
// and update() reports events instead of touching money or UI itself,
// so main.js stays the single owner of game state.
//   step types:
//     steal — completes the moment Luz is inside any car
//     goto  — completes inside WAYPOINT_RADIUS of the point
//     heat  — completes when the wanted level reaches 3 stars
//     evade — completes when the wanted level falls back to 0 stars
//     sneak — like goto, but only while the HUD's own seen rule says
//             HIDDEN (no star, or no cruiser within 45 m)
import { MISSIONS, WAYPOINT_RADIUS } from './config.js';

export function createMissions() {
  const m = {
    index: 0, step: 0, done: false, stepTime: 0,
    current() { return m.done ? null : MISSIONS[m.index]; },
    currentStep() {
      const c = m.current();
      return c ? c.steps[m.step] : null;
    },
    nextStepText() {
      const c = m.current();
      if (!c) return '—';
      const n = c.steps[m.step + 1];
      return n ? n.text : 'Finish the job';
    },
    waypoint() {
      const s = m.currentStep();
      return s && (s.type === 'goto' || s.type === 'sneak') ? { x: s.x, z: s.z } : null;
    },
    // ctx: { pos, inCar, stars, seen }
    update(dt, ctx) {
      const events = [];
      if (m.done) return events;
      m.stepTime += dt;
      const s = m.currentStep();
      if (!s) return events;
      let complete = false;
      if (s.type === 'steal') complete = !!ctx.inCar;
      else if (s.type === 'goto') complete = Math.hypot(s.x - ctx.pos.x, s.z - ctx.pos.z) <= WAYPOINT_RADIUS;
      else if (s.type === 'heat') complete = ctx.stars >= 3;
      else if (s.type === 'evade') complete = ctx.stars <= 0;
      else if (s.type === 'sneak') {
        complete = Math.hypot(s.x - ctx.pos.x, s.z - ctx.pos.z) <= WAYPOINT_RADIUS && !ctx.seen;
      }
      if (!complete) return events;
      const chapter = MISSIONS[m.index];
      m.step += 1; m.stepTime = 0;
      if (m.step >= chapter.steps.length) {
        events.push({ type: 'chapterDone', index: m.index, reward: chapter.reward, title: chapter.title });
        m.index += 1; m.step = 0;
        if (m.index >= MISSIONS.length) { m.done = true; events.push({ type: 'allDone' }); }
        else events.push({ type: 'chapterStart', index: m.index });
      } else {
        events.push({ type: 'stepDone', index: m.index, step: m.step });
      }
      return events;
    },
  };
  return m;
}
export function dialogKeyForChapter(index) {
  return ['m1_start', 'm2_start', 'm3_start', 'm4_start', 'm5_start'][index] || null;
}
