// VAULTBREAK — seeing. A guard or a camera sees the thief only when three
// things are true at once: the thief is inside the cone (angle and range), a
// straight line from watcher to thief crosses no wall, and the thief is not
// hidden — inside tall grass or a shadow patch a watcher cannot see them
// unless it is very close (48 px). A dotted patrol route is drawn, never a
// dashed cone outline: the cone edge is a plain line.
import { CAMERA, GUARD, PLAYER, TILE } from './config.js';
import { solidAt } from './heists.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Step along the segment in half-tile steps; any solid tile blocks the view.
export function lineOfSight(heistDef, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 2)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const col = Math.floor((x0 + (x1 - x0) * t) / TILE);
    const row = Math.floor((y0 + (y1 - y0) * t) / TILE);
    if (solidAt(heistDef, col, row)) return false;
  }
  return true;
}

export function inHidePatch(heistDef, x, y) {
  for (const h of heistDef.hides) {
    if (x >= h[0] * TILE && x < (h[0] + h[2]) * TILE && y >= h[1] * TILE && y < (h[1] + h[3]) * TILE) return true;
  }
  return false;
}

// Hidden unless a watcher is within the close radius — the Lampblack rule.
export function isHidden(heistDef, x, y, watcherX, watcherY) {
  if (!inHidePatch(heistDef, x, y)) return false;
  return Math.hypot(x - watcherX, y - watcherY) > PLAYER.hideRadius;
}

export function inCone(wx, wy, facing, halfAngle, range, px, py) {
  const dx = px - wx, dy = py - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 12) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= halfAngle;
}

export function guardSeesGuard(heistDef, guard, px, py) {
  if (guard.blind > 0) return false;
  if (isHidden(heistDef, px, py, guard.x, guard.y)) return false;
  if (!inCone(guard.x, guard.y, guard.facing, GUARD.coneHalfAngle, GUARD.coneRange, px, py)) return false;
  return lineOfSight(heistDef, guard.x, guard.y, px, py);
}

export function cameraSeesCamera(heistDef, camera, px, py, time) {
  if (camera.blind > 0) return false;
  const facing = camera.base + Math.sin(time * CAMERA.sweepSpeed) * camera.sweep;
  if (isHidden(heistDef, px, py, camera.x, camera.y)) return false;
  if (!inCone(camera.x, camera.y, facing, CAMERA.halfAngle, CAMERA.range, px, py)) return false;
  return lineOfSight(heistDef, camera.x, camera.y, px, py);
}

export function guardFacing(guard) { return guard.facing; }
export function cameraFacing(camera, time) {
  return camera.base + Math.sin(time * CAMERA.sweepSpeed) * camera.sweep;
}
