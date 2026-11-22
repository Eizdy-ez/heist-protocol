// VAULTBREAK — keyboard and mouse input. Held keys steer; one-shot presses
// (start, pause, tools, heist select) are queued as bit flags and taken once by
// the loop, so a quick tap that lands between two frames is never lost and
// never counted twice. Mouse click sets a move target the thief walks toward.
import { TOOLS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_DECOY = 8;
export const ACTION_SONAR = 16;
export const ACTION_RESTART = 32;
export const ACTION_MENU = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let clickTarget = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (event.code === TOOLS.smoke.key) { if (!event.repeat) actions |= ACTION_SMOKE; }
    else if (event.code === TOOLS.decoy.key) { if (!event.repeat) actions |= ACTION_DECOY; }
    else if (event.code === TOOLS.sonar.key) { if (!event.repeat) actions |= ACTION_SONAR; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MENU; }
    else if (event.code === 'Digit4') { if (!event.repeat) actions |= 64; }
    else if (event.code === 'Digit5') { if (!event.repeat) actions |= 128; }
    else if (event.code === 'Digit6') { if (!event.repeat) actions |= 256; }
    else if (event.code === 'Digit7') { if (!event.repeat) actions |= 512; }
    else if (event.code === 'Digit8') { if (!event.repeat) actions |= 1024; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    clickTarget = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    actions |= ACTION_CONFIRM;
  });

  return {
    // Normalised steering from held keys, or null when no key is held.
    keys() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return null;
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    takeClickTarget() {
      const t = clickTarget;
      clickTarget = null;
      return t;
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
