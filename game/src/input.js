// Keyboard + mouse input. Held keys are polled every frame; one-shot presses
// (enter car, punch, pause, confirm) are queued as flags and taken once, so a
// press between two frames is never lost or counted twice. The camera turns by
// dragging the mouse (pointer lock is avoided: it fails silently headless).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_SHOOT = 32;
export const ACTION_WEAPON_PISTOL = 64; // v5.1 (P5): key 2
export const ACTION_WEAPON_SMG = 128; // v5.1 (P5): key 3

const MOVE = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { forward: false, back: false, left: false, right: false, run: false };
  let actions = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;

  window.addEventListener('keydown', (event) => {
    const key = MOVE[event.code];
    if (key) {
      held[key] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'Digit2') actions |= ACTION_WEAPON_PISTOL;
    else if (event.code === 'Digit3') actions |= ACTION_WEAPON_SMG;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const key = MOVE[event.code];
    if (key) held[key] = false;
  });
  // Tapping a menu overlay (start / paused / busted) confirms it — this is
  // what "click to start" always promised, and the only way in on touch.
  window.addEventListener('pointerdown', (event) => {
    if (event.target.closest && event.target.closest('[id^="screen-"]')) actions |= ACTION_CONFIRM;
  });
  // v5.1 (P5): is the mouse trigger currently HELD? The pistol fires per
  // click (ACTION_SHOOT); the SMG keeps firing while this stays true.
  let shootHeld = false;
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
    dragging = false;
    shootHeld = false;
  });
  let lastPX = 0;
  let lastPY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragX = 0;
    dragY = 0;
    lastPX = event.clientX;
    lastPY = event.clientY;
    // A touch drag is a camera move, not a shot: only the mouse shoots.
    if (event.button === 0 && event.pointerType !== 'touch') {
      actions |= ACTION_SHOOT;
      shootHeld = true;
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    if (event.pointerType === 'touch') {
      dragX += event.clientX - lastPX;
      dragY += event.clientY - lastPY;
      lastPX = event.clientX;
      lastPY = event.clientY;
    } else {
      dragX += event.movementX || 0;
      dragY += event.movementY || 0;
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    shootHeld = false;
  });

  // Touch controls (coarse pointers only; desktop input is untouched): a
  // left stick feeds the same held flags as WASD (push it to the rim to
  // run), GAS/BRK buttons hold forward/back, E fires enter/exit, and a
  // drag anywhere else on the canvas turns the camera.
  if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
    const css = document.createElement('style');
    css.textContent = '#touch{position:fixed;inset:0;z-index:6;pointer-events:none;display:none}'
      + 'body.playing #touch{display:block}'
      + '.tc{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;background:rgba(10,12,26,.55);border:2px solid rgba(255,255,255,.4);color:#fff;font:700 13px system-ui;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none}'
      + '#stick{left:16px;bottom:16px;width:118px;height:118px}'
      + '#knob{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.35);pointer-events:none}'
      + '#btnGas{right:16px;bottom:100px;width:64px;height:64px;background:rgba(46,160,80,.55)}'
      + '#btnBrk{right:92px;bottom:16px;width:64px;height:64px;background:rgba(200,60,60,.55)}'
      + '#btnAct{right:16px;bottom:16px;width:64px;height:64px;background:rgba(58,134,255,.55)}'
      + '@media (max-height:500px){#stick{left:124px}}';
    document.head.appendChild(css);
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = '<div class="tc" id="stick"><div id="knob"></div></div><div class="tc" id="btnGas">GAS</div><div class="tc" id="btnBrk">BRK</div><div class="tc" id="btnAct">E</div>';
    document.body.appendChild(root);
    const stick = root.querySelector('#stick');
    const knob = root.querySelector('#knob');
    const stickMove = (t) => {
      const r = stick.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > 40) { dx = dx / d * 40; dy = dy / d * 40; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      held.forward = dy < -12;
      held.back = dy > 12;
      held.left = dx < -12;
      held.right = dx > 12;
      held.run = d > 38;
    };
    const stickEnd = () => {
      knob.style.transform = '';
      held.forward = held.back = held.left = held.right = held.run = false;
    };
    stick.addEventListener('touchstart', (e) => { e.preventDefault(); stickMove(e.touches[0]); }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); stickMove(e.touches[0]); }, { passive: false });
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);
    const bindBtn = (sel, key) => {
      const b = root.querySelector(sel);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); held[key] = true; }, { passive: false });
      const off = (e) => { e.preventDefault(); held[key] = false; };
      b.addEventListener('touchend', off);
      b.addEventListener('touchcancel', off);
    };
    bindBtn('#btnGas', 'forward');
    bindBtn('#btnBrk', 'back');
    root.querySelector('#btnAct').addEventListener('touchstart', (e) => {
      e.preventDefault();
      actions |= ACTION_ENTER_CAR;
    }, { passive: false });
  }

  return {
    held,
    isShootHeld() {
      return shootHeld;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeDrag() {
      const d = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return d;
    },
    // Test / autopilot hook: pretend keys are held without a real keyboard.
    press(code) {
      const key = MOVE[code];
      if (key) held[key] = true;
      else if (code === 'KeyE') actions |= ACTION_ENTER_CAR;
      else if (code === 'KeyF') actions |= ACTION_PUNCH;
    },
    release(code) {
      const key = MOVE[code];
      if (key) held[key] = false;
    },
  };
}
