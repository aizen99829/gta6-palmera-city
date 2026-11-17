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
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const key = MOVE[event.code];
    if (key) held[key] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
    dragging = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragX = 0;
    dragY = 0;
    if (event.button === 0) actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.movementX || 0;
    dragY += event.movementY || 0;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  return {
    held,
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
