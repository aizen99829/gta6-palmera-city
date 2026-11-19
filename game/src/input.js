// input.js — one unified input state for keyboard, mouse and touch.
// The HUD touch controls (built here, styled by hud.js CSS) feed the very
// same `held` flags as WASD, so driving/walking code never cares which
// device produced the input. One-shot actions queue up and are consumed
// with take().
export function createInput(canvas) {
  const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const held = { forward: false, back: false, left: false, right: false, run: false, brake: false };
  const queue = new Set();
  const cam = { dx: 0, dy: 0 };
  const aim = { down: false };
  const KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'brake',
  };
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) { held[k] = true; if (e.code === 'Space') queue.add('confirm'); e.preventDefault(); }
    if (e.code === 'KeyE') queue.add('enter');
    if (e.code === 'KeyR') queue.add('reload');
    if (e.code === 'KeyF') queue.add('punch');
    if (e.code === 'Digit1') queue.add('weapon1');
    if (e.code === 'Digit2') queue.add('weapon2');
    if (e.code === 'Digit3') queue.add('weapon2');
    if (e.code === 'Escape') queue.add('pause');
    if (e.code === 'Enter') queue.add('confirm');
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) held[k] = false;
  });
  // Mouse: drag rotates the camera, holding the button aims & fires.
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; aim.down = true; }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; aim.down = false; });
  window.addEventListener('mousemove', (e) => {
    if (mouseDown) { cam.dx += e.movementX || 0; cam.dy += e.movementY || 0; }
  });
  // Any press on a menu overlay counts as "confirm" (click / tap to start).
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('[id^="screen-"]')) queue.add('confirm');
  });
  // Touch camera drag on the bare canvas: client deltas, never a shot.
  let camTouch = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    camTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!camTouch) return;
    for (const t of e.changedTouches) {
      if (t.identifier === camTouch.id) {
        cam.dx += (t.clientX - camTouch.x);
        cam.dy += (t.clientY - camTouch.y);
        camTouch.x = t.clientX; camTouch.y = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (camTouch && t.identifier === camTouch.id) camTouch = null;
  });
  // ---- touch control layer (coarse pointers only) ----
  let touchRoot = null;
  if (coarse) {
    touchRoot = document.createElement('div');
    touchRoot.id = 'touch';
    touchRoot.innerHTML =
      '<div id="stick"><div id="stickKnob"></div></div>' +
      '<div id="btnGas" class="tbtn">GAS</div>' +
      '<div id="btnBrk" class="tbtn">BRK</div>' +
      '<div id="btnAct" class="tbtn">E</div>';
    document.body.appendChild(touchRoot);
    const stick = touchRoot.querySelector('#stick');
    const knob = touchRoot.querySelector('#stickKnob');
    let stickId = null;
    const setStick = (dx, dy) => {
      held.left = dx < -12; held.right = dx > 12;
      held.forward = dy < -12; held.back = dy > 12;
      held.run = Math.hypot(dx, dy) > 38;
      knob.style.transform = `translate(${dx * 0.55}px, ${dy * 0.55}px)`;
    };
    const stickPoint = (t) => {
      const r = stick.getBoundingClientRect();
      return { dx: t.clientX - (r.left + r.width / 2), dy: t.clientY - (r.top + r.height / 2) };
    };
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; stickId = t.identifier;
      const p = stickPoint(t); setStick(p.dx, p.dy); e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === stickId) { const p = stickPoint(t); setStick(p.dx, p.dy); }
      e.preventDefault();
    }, { passive: false });
    const stickEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === stickId) {
        stickId = null; held.left = held.right = held.forward = held.back = held.run = false;
        knob.style.transform = 'translate(0px, 0px)';
      }
    };
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);
    const bindHold = (sel, on, off) => {
      const el = touchRoot.querySelector(sel);
      el.addEventListener('touchstart', (e) => { on(); e.preventDefault(); }, { passive: false });
      const end = (e) => { off(); e.preventDefault(); };
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
    };
    bindHold('#btnGas', () => { held.forward = true; }, () => { held.forward = false; });
    bindHold('#btnBrk', () => { held.back = true; }, () => { held.back = false; });
    bindHold('#btnAct', () => { queue.add('enter'); }, () => {});
  }
  return {
    held, aim, coarse,
    take(name) { const had = queue.has(name); queue.delete(name); return had; },
    takeCam() { const d = { dx: cam.dx, dy: cam.dy }; cam.dx = 0; cam.dy = 0; return d; },
    setTouchVisible(v) { if (touchRoot) touchRoot.style.display = v ? 'block' : 'none'; },
  };
}
