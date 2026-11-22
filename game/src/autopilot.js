// VAULTBREAK — the autopilot that play-tests every heist and steers the
// screenshot scenes. It replans a breadth-first route to the nearest loot,
// then to the exit, charging a high cost to tiles inside a guard or camera
// cone right now, so it prefers the shadows and the tall grass. It throws
// smoke when the alarm climbs and it has the loot to pay for it.
import { CAMERA, GUARD, TILE, TOOLS } from './config.js';
import { HEISTS, solidAt, tileCenter } from './heists.js';
import { cameraFacing, inCone } from './vision.js';

function tileOf(x, y) {
  return [Math.floor(x / TILE), Math.floor(y / TILE)];
}

function coneDanger(def, state, col, row) {
  const [cx, cy] = tileCenter(col, row);
  for (const g of state.guards) {
    if (inCone(g.x, g.y, g.facing, GUARD.coneHalfAngle, GUARD.coneRange, cx, cy)) return 6;
  }
  for (const c of state.cameras) {
    const facing = cameraFacing(c, state.time);
    if (inCone(c.x, c.y, facing, CAMERA.halfAngle, CAMERA.range, cx, cy)) return 6;
  }
  return 0;
}

function guardProximity(state, col, row) {
  const [cx, cy] = tileCenter(col, row);
  let cost = 0;
  for (const g of state.guards) {
    const d = Math.hypot(cx - g.x, cy - g.y);
    if (d < 90) cost += 14;
    else if (d < 170) cost += 5;
  }
  return cost;
}

function hideBonus(def, col, row) {
  for (const h of def.hides) {
    if (col >= h[0] && col < h[0] + h[2] && row >= h[1] && row < h[1] + h[3]) return -0.4;
  }
  return 0;
}

// Dijkstra over tiles from `from` to `to`; null when no route exists.
export function findRoute(def, state, from, to) {
  const startKey = from[0] + ',' + from[1];
  const goalKey = to[0] + ',' + to[1];
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [[0, from]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, cur] = open.shift();
    const curKey = cur[0] + ',' + cur[1];
    if (curKey === goalKey) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur[0] + dx, ny = cur[1] + dy;
      if (solidAt(def, nx, ny)) continue;
      const key = nx + ',' + ny;
      const cost = dist.get(curKey) + 1 + coneDanger(def, state, nx, ny) + guardProximity(state, nx, ny) + hideBonus(def, nx, ny);
      if (cost < (dist.get(key) ?? Infinity)) {
        dist.set(key, cost);
        prev.set(key, cur);
        open.push([cost, [nx, ny]]);
      }
    }
  }
  if (!dist.has(goalKey)) return null;
  const path = [];
  let cur = to;
  while (cur[0] + ',' + cur[1] !== startKey) {
    path.unshift(cur);
    cur = prev.get(cur[0] + ',' + cur[1]);
    if (!cur) return null;
  }
  return path;
}

export function createAutopilot(world) {
  let route = null;
  let replanIn = 0;
  let targetKind = 'loot';

  function nearestTarget(state, def) {
    const vault = state.vaultsLeft.find((v) => !v.taken);
    if (vault) return { tile: [vault.x, vault.y], kind: 'vault' };
    const coin = state.coinsLeft.find((c) => !c.taken);
    if (coin) return { tile: [coin.x, coin.y], kind: 'coin' };
    return { tile: [def.exit[0], def.exit[1]], kind: 'exit' };
  }

  // Returns {move, tool} for one step, or null when the heist is over.
  function decide(state, dt) {
    if (state.caught || state.complete) return null;
    const def = HEISTS[state.heistIndex];
    // A guard right on top of us: back away from it, or freeze in the grass
    // until it walks on. Walking into a patrol is how bots get caught.
    let nearest = null, nearestD = Infinity;
    for (const g of state.guards) {
      const d = Math.hypot(g.x - state.player.x, g.y - state.player.y);
      if (d < nearestD) { nearestD = d; nearest = g; }
    }
    if (nearest && nearestD < 75) {
      let inHide = false;
      for (const h of def.hides) {
        if (state.player.x >= h[0] * TILE && state.player.x < (h[0] + h[2]) * TILE &&
            state.player.y >= h[1] * TILE && state.player.y < (h[1] + h[3]) * TILE) inHide = true;
      }
      if (inHide && !state.seenNow) return { move: null, tool: null };
      const dx = state.player.x - nearest.x, dy = state.player.y - nearest.y;
      const d = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / d, y: dy / d }, tool: null };
    }
    replanIn -= dt;
    const target = nearestTarget(state, def);
    if (target.kind !== targetKind) { targetKind = target.kind; replanIn = 0; }
    if (replanIn <= 0 || !route || route.length === 0) {
      route = findRoute(def, state, tileOf(state.player.x, state.player.y), target.tile);
      replanIn = 0.4;
      if (!route) return { move: null, tool: null };
    }
    let tool = null;
    if (state.loot >= TOOLS.smoke.cost && state.smokeT === 0 &&
        ((state.seenNow && nearestD < 130) || state.alarm > 45)) tool = 'smoke';
    const next = route[0];
    const [tx, ty] = tileCenter(next[0], next[1]);
    const dx = tx - state.player.x, dy = ty - state.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) { route.shift(); return { move: null, tool }; }
    return { move: { x: dx / d, y: dy / d }, tool };
  }

  return { decide };
}
