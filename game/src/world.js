// VAULTBREAK — the rules and the state, with no drawing and no browser in it:
// the thief, the guards and their patrols, the sweeping cameras, the alarm
// meter, the loot, the three paid tools and the getaway. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.
import { ALARM, CAMERA, GUARD, LOOT, PLAYER, TILE, TOOLS } from './config.js';
import { HEISTS, solidAt, tileCenter } from './heists.js';
import { cameraSeesCamera, guardSeesGuard, inHidePatch } from './vision.js';

export const EVENT_COIN = 1;
export const EVENT_VAULT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_COMPLETE = 8;
export const EVENT_TOOL = 16;
export const EVENT_SEEN = 32;

// Circle against tile: the closest point on the solid tile's rect to the
// circle centre decides the push-out. Sampling points around the circle
// snags on corridor corners; this does not.
function collideCircle(heistDef, x, y, r) {
  const minCol = Math.floor((x - r) / TILE), maxCol = Math.floor((x + r) / TILE);
  const minRow = Math.floor((y - r) / TILE), maxRow = Math.floor((y + r) / TILE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!solidAt(heistDef, col, row)) continue;
      const rx = col * TILE, ry = row * TILE;
      const cx = Math.max(rx, Math.min(x, rx + TILE));
      const cy = Math.max(ry, Math.min(y, ry + TILE));
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) { x += r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}

function moveCircle(heistDef, pos, dx, dy) {
  let p = collideCircle(heistDef, pos.x + dx, pos.y, PLAYER.radius);
  p = collideCircle(heistDef, p.x, p.y + dy, PLAYER.radius);
  return p;
}

export function createWorld() {
  const state = {
    heistIndex: 0, player: { x: 0, y: 0, facing: 0 },
    guards: [], cameras: [], coinsLeft: [], vaultsLeft: [],
    loot: 0, alarm: 0, time: 0, elapsed: 0, sonarT: 0, sonarCharges: TOOLS.sonar.charges,
    smokeT: 0, smokeX: 0, smokeY: 0, decoy: null, decoyT: 0,
    status: 'SHADOW', seenNow: false, wasSeen: false, exitOpen: false, caught: false,
    complete: false, score: 0, heistsDone: 0, totalLoot: 0, totalTime: 0, message: '',
    // Detection, in three stages the sidebar shows like a gauge: CLEAR (nobody
    // suspects a thing), SUSPICIOUS (something caught an eye — freeze), HUNTED
    // (the alarm is high and they are coming for you).
    detection: 'CLEAR', lastSeenT: -99, timesSpotted: 0, maxAlarm: 0,
    coinsGot: 0, vaultsGot: 0, results: [],
  };
  let clickGoal = null;

  function loadHeist(index) {
    const def = HEISTS[index];
    state.heistIndex = index;
    const [sx, sy] = tileCenter(def.spawn[0], def.spawn[1]);
    state.player.x = sx; state.player.y = sy; state.player.facing = 0;
    state.guards = def.guards.map((g, i) => {
      const [gx, gy] = tileCenter(g.path[0][0], g.path[0][1]);
      return {
        x: gx, y: gy, path: g.path, pathIdx: 1, dir: 1, speed: g.speed,
        facing: 0, mode: 'patrol', chaseT: 0, lastX: gx, lastY: gy, blind: 0,
        name: (def.names && def.names[i]) || ('G-' + (i + 1)),
      };
    });
    state.cameras = def.cameras.map((c) => {
      const [cx, cy] = tileCenter(c.x, c.y);
      return { x: cx, y: cy, base: c.base, sweep: c.sweep, blind: 0 };
    });
    state.coinsLeft = def.coins.map(([cx, cy]) => ({ x: cx, y: cy, taken: false }));
    state.vaultsLeft = def.vaults.map(([vx, vy]) => ({ x: vx, y: vy, taken: false }));
    state.loot = 0; state.alarm = 0; state.time = 0;
    state.sonarT = 0; state.sonarCharges = TOOLS.sonar.charges;
    state.smokeT = 0; state.decoy = null; state.decoyT = 0;
    state.status = 'SHADOW'; state.seenNow = false; state.exitOpen = false;
    state.caught = false; state.complete = false; state.message = '';
    state.detection = 'CLEAR'; state.lastSeenT = -99; state.timesSpotted = 0;
    state.maxAlarm = 0; state.coinsGot = 0; state.vaultsGot = 0;
    clickGoal = null;
  }

  function resetAll() {
    state.heistsDone = 0; state.totalLoot = 0; state.totalTime = 0; state.score = 0;
    state.results = [];
    loadHeist(0);
  }

  function nearestHideDistance() {
    return 0;
  }

  function inLampLight(def, x, y) {
    for (const [lx, ly] of def.lamps) {
      const [px, py] = tileCenter(lx, ly);
      if (Math.hypot(x - px, y - py) < 150) return true;
    }
    return false;
  }

  function useTool(kind) {
    if (state.caught || state.complete) return 0;
    if (kind === 'smoke') {
      if (state.loot < TOOLS.smoke.cost || state.smokeT > 0) return 0;
      state.loot -= TOOLS.smoke.cost;
      state.smokeT = TOOLS.smoke.seconds;
      state.smokeX = state.player.x; state.smokeY = state.player.y;
      state.message = 'Smoke out — they cannot see through it.';
      return EVENT_TOOL;
    }
    if (kind === 'decoy') {
      if (state.loot < TOOLS.decoy.cost || state.decoy) return 0;
      state.loot -= TOOLS.decoy.cost;
      const a = state.player.facing;
      state.decoy = { x: state.player.x + Math.cos(a) * 90, y: state.player.y + Math.sin(a) * 90 };
      state.decoyT = TOOLS.decoy.seconds;
      state.message = 'Decoy coin tossed — a guard goes to look.';
      return EVENT_TOOL;
    }
    if (kind === 'sonar') {
      if (state.sonarCharges <= 0 || state.sonarT > 0) return 0;
      state.sonarCharges -= 1;
      state.sonarT = TOOLS.sonar.seconds;
      const def = HEISTS[state.heistIndex];
      for (const g of state.guards) {
        if (Math.hypot(g.x - state.player.x, g.y - state.player.y) < TOOLS.sonar.hearRadius) {
          g.mode = 'chase'; g.chaseT = GUARD.chaseSeconds;
          g.lastX = state.player.x; g.lastY = state.player.y;
        }
      }
      state.message = 'Sonar pulse — patrol routes revealed, but near guards heard it.';
      return EVENT_TOOL;
    }
    return 0;
  }

  // One fixed step. `move` is a normalised {x,y} or null; `tool` is a tool name
  // or null. Returns EVENT_* flags.
  function step(dt, move, tool) {
    let events = 0;
    if (tool) events |= useTool(tool);
    if (state.caught || state.complete) return events;
    const def = HEISTS[state.heistIndex];
    state.time += dt; state.elapsed += dt;
    if (state.sonarT > 0) state.sonarT = Math.max(0, state.sonarT - dt);
    if (state.smokeT > 0) state.smokeT = Math.max(0, state.smokeT - dt);
    if (state.decoyT > 0) {
      state.decoyT = Math.max(0, state.decoyT - dt);
      if (state.decoyT === 0) state.decoy = null;
    }

    // The thief moves; click-to-move walks toward the clicked point instead.
    let mv = move;
    if (!mv && clickGoal) {
      const dx = clickGoal.x - state.player.x, dy = clickGoal.y - state.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) clickGoal = null;
      else mv = { x: dx / d, y: dy / d };
    }
    if (mv) {
      const nx = state.player.x + mv.x * PLAYER.speed * dt;
      const ny = state.player.y + mv.y * PLAYER.speed * dt;
      const p = moveCircle(def, state.player, nx - state.player.x, ny - state.player.y);
      state.player.x = p.x; state.player.y = p.y;
      state.player.facing = Math.atan2(mv.y, mv.x);
    }

    // Smoke blinds every watcher inside its cloud, guard and camera alike.
    const smoking = state.smokeT > 0;
    for (const g of state.guards) {
      g.blind = smoking && Math.hypot(g.x - state.smokeX, g.y - state.smokeY) < TOOLS.smoke.radius ? 0.2 : Math.max(0, g.blind - dt);
    }
    for (const c of state.cameras) {
      c.blind = smoking && Math.hypot(c.x - state.smokeX, c.y - state.smokeY) < TOOLS.smoke.radius ? 0.2 : Math.max(0, c.blind - dt);
    }

    // Who sees the thief right now?
    let seen = false;
    for (const g of state.guards) {
      if (guardSeesGuard(def, g, state.player.x, state.player.y)) {
        seen = true;
        g.mode = 'chase'; g.chaseT = GUARD.chaseSeconds;
        g.lastX = state.player.x; g.lastY = state.player.y;
      }
    }
    for (const c of state.cameras) {
      if (cameraSeesCamera(def, c, state.player.x, state.player.y, state.time)) seen = true;
    }
    state.seenNow = seen;
    if (seen) {
      if (!state.wasSeen) state.timesSpotted += 1;
      state.lastSeenT = state.time;
      state.alarm = Math.min(ALARM.max, state.alarm + GUARD.spotPerSecond * dt);
      events |= EVENT_SEEN;
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
    }
    state.wasSeen = seen;
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    // Three detection stages, clear at a glance in the sidebar.
    if (state.alarm >= 70) state.detection = 'HUNTED';
    else if (seen || state.time - state.lastSeenT < 2.5 || state.alarm >= 25) state.detection = 'SUSPICIOUS';
    else state.detection = 'CLEAR';
    if (inHidePatch(def, state.player.x, state.player.y)) state.status = 'HIDDEN';
    else if (seen) state.status = 'SEEN';
    else if (inLampLight(def, state.player.x, state.player.y)) state.status = 'EXPOSED';
    else state.status = 'SHADOW';

    // Guards walk: patrol loops, chase the last seen spot, decoy detour.
    for (const g of state.guards) {
      let tx, ty, speed = g.speed;
      if (state.decoy && g.mode !== 'chase') {
        tx = state.decoy.x; ty = state.decoy.y; speed = GUARD.returnSpeed;
      } else if (g.mode === 'chase') {
        tx = g.lastX; ty = g.lastY; speed = GUARD.chaseSpeed;
        g.chaseT -= dt;
        if (g.blind > 0) g.chaseT -= dt; // Smoke makes a chasing guard give up faster.
        if (g.chaseT <= 0 && !seen) g.mode = 'patrol';
      } else {
        const wp = g.path[g.pathIdx];
        [tx, ty] = tileCenter(wp[0], wp[1]);
      }
      const dx = tx - g.x, dy = ty - g.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        if (g.mode === 'patrol') {
          g.pathIdx += g.dir;
          if (g.pathIdx >= g.path.length || g.pathIdx < 0) {
            g.dir *= -1;
            g.pathIdx = Math.max(0, Math.min(g.path.length - 1, g.pathIdx + g.dir * 2));
          }
        } else if (g.mode === 'chase' && !seen) {
          g.mode = 'patrol';
        }
      } else {
        const stepLen = Math.min(d, speed * dt);
        g.x += (dx / d) * stepLen;
        g.y += (dy / d) * stepLen;
        g.facing = Math.atan2(dy, dx);
      }
      // A guard that reaches the thief catches them — the fair caught moment.
      if (Math.hypot(g.x - state.player.x, g.y - state.player.y) < GUARD.touchRadius && g.blind === 0) {
        state.caught = true;
        events |= EVENT_CAUGHT;
        return events;
      }
    }
    if (state.alarm >= ALARM.caughtAt) {
      state.caught = true;
      events |= EVENT_CAUGHT;
      return events;
    }

    // Loot: coins are quick grabs, vaults are the job. The exit opens only
    // once every vault in the building is taken.
    for (const coin of state.coinsLeft) {
      if (coin.taken) continue;
      const [cx, cy] = tileCenter(coin.x, coin.y);
      if (Math.hypot(state.player.x - cx, state.player.y - cy) < 30) {
        coin.taken = true; state.loot += LOOT.coin; state.coinsGot += 1; events |= EVENT_COIN;
      }
    }
    for (const vault of state.vaultsLeft) {
      if (vault.taken) continue;
      const [vx, vy] = tileCenter(vault.x, vault.y);
      if (Math.hypot(state.player.x - vx, state.player.y - vy) < 34) {
        vault.taken = true; state.loot += LOOT.vault; state.vaultsGot += 1; events |= EVENT_VAULT;
        state.message = 'Vault cracked — $' + LOOT.vault + ' in the bag.';
      }
    }
    state.exitOpen = state.vaultsLeft.every((v) => v.taken);
    if (state.exitOpen) {
      const [ex, ey] = tileCenter(def.exit[0], def.exit[1]);
      if (Math.hypot(state.player.x - ex, state.player.y - ey) < 30) {
        state.complete = true;
        const bonus = Math.max(0, Math.round((240 - state.time) * LOOT.timeBonusPerSecond));
        state.score = state.loot + bonus;
        state.totalLoot += state.loot;
        state.totalTime += state.time;
        state.heistsDone += 1;
        // The ESCAPED report card: rank by how quietly the job went.
        const rank = state.timesSpotted === 0 ? 'GHOST'
          : state.timesSpotted <= 2 && state.maxAlarm < 60 ? 'SHADOW' : 'LOUD';
        state.results[state.heistIndex] = {
          time: state.time, spotted: state.timesSpotted, loot: state.loot,
          coins: state.coinsGot, coinsTotal: def.coins.length,
          vaults: state.vaultsGot, vaultsTotal: def.vaults.length, rank,
        };
        events |= EVENT_COMPLETE;
      }
    }
    return events;
  }

  function nextHeist() {
    if (state.heistIndex + 1 < HEISTS.length) { loadHeist(state.heistIndex + 1); return true; }
    return false;
  }

  function setClickGoal(point) { clickGoal = point; }

  loadHeist(0);
  return { state, loadHeist, resetAll, step, nextHeist, setClickGoal, useTool, nearestHideDistance };
}
