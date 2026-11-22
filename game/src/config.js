// VAULTBREAK — every tuning number and colour in one place.
// The playfield is a fixed 1280x800 logical area; the renderer draws it at 2x
// supersampling (2560x1600 backing store) so screenshots stay sharp. No rule
// below depends on the screen size, and nothing here uses Math.random: every
// fine detail is a hash of its tile, so two runs of main.ts stay byte-identical.

export const FIELD = { width: 1280, height: 800 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const STEP = 1 / 60;
export const BEST_KEY = 'vaultbreak.best';

// The thief: a small glowing cyan dot, radius 13, fast enough to cross a room
// between two sweeps of a vision cone, slow enough that a cone reads as danger.
export const PLAYER = { radius: 13, speed: 235, hideRadius: 48 };

// Guards walk their patrol; when they see the thief they chase the last seen
// spot for a few seconds, then return to patrol. Cameras never move, they sweep.
export const GUARD = {
  speed: 62,
  chaseSpeed: 128,
  coneRange: 225,
  coneHalfAngle: 0.62,
  spotPerSecond: 46,
  touchRadius: 24,
  chaseSeconds: 3.2,
  returnSpeed: 78,
};
export const CAMERA = {
  range: 205,
  halfAngle: 0.46,
  spotPerSecond: 34,
  sweepSpeed: 0.55,
};

// Alarm 0..100. Seen fills it, hidden drains it. At 100 the crew is busted.
export const ALARM = { max: 100, decayPerSecond: 13, caughtAt: 100 };

// Tools cost loot dollars. Every tool is bought with what the crew already
// stole, so spending is a real decision, not a free button.
export const TOOLS = {
  smoke: { key: 'Digit1', cost: 150, seconds: 4.5, radius: 135, name: 'SMOKE PELLET' },
  decoy: { key: 'Digit2', cost: 100, seconds: 6, name: 'DECOY COIN' },
  sonar: { key: 'Digit3', cost: 0, charges: 2, seconds: 5, hearRadius: 150, name: 'SONAR PULSE' },
};
export const LOOT = { coin: 50, vault: 500, timeBonusPerSecond: 8 };
export const LIVES = 3;

export const PALETTE = {
  backdrop: '#0a0a10',
  text: '#f2ead8',
  muted: '#9a917e',
  gold: '#f2c94c',
  cyan: '#37e6d6',
  red: '#ff4d4d',
  amber: '#ffb347',
  panel: '#17161f',
};

// Deterministic hash of two integers in [0,1): floor speckle, tile shade, blade
// lean — never Math.random, so the dossier never changes between runs.
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
