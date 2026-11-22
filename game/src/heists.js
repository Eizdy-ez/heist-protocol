// VAULTBREAK — the five heists. Each heist is one building on one night: its
// own palette, its own wall plan with several routes through every room, its
// own guards, cameras, hiding spots, lamps and loot. Walls are tile rects
// [col, row, width, height]; everything else is a tile position. Nothing here
// is read from the network and nothing is random: the same file always builds
// the same five buildings.
import { COLS, ROWS } from './config.js';

function heist(def) {
  return def;
}

// Tile helpers keep the layouts readable: a wall rect, a guard patrol loop,
// a camera that sweeps around one base angle.
function wall(x, y, w, h) { return [x, y, w, h]; }
function guard(path, speed) { return { path, speed: speed ?? 62 }; }
function camera(x, y, base, sweep) { return { x, y, base, sweep }; }

export const HEISTS = [
  heist({
    id: 1, par: 50, name: 'THE CORNER BANK', sub: 'Heist 1 of 5 — the easy front door',
    brief: 'One vault, one sleepy camera. Learn the cones, grab the gold, walk out the front.',
    palette: {
      floor: '#221d15', floorAlt: '#251f17', wall: '#3a2f1e', wallEdge: '#6b5636',
      accent: '#f2c94c', lamp: '#ffb347', hide: '#2c4a26', hideBlade: '#4d7a35',
      hideBlade2: '#6fa055', hideBlade3: '#33592c', carpet: '#4a2c1e',
    },
    spawn: [2, 17], exit: [29, 2],
    walls: [
      wall(0, 0, 32, 1), wall(0, 19, 32, 1), wall(0, 0, 1, 20), wall(31, 0, 1, 20),
      wall(9, 1, 1, 6), wall(9, 9, 1, 5),
      wall(20, 6, 1, 7),
      wall(2, 10, 6, 1), wall(23, 10, 6, 1),
      wall(23, 4, 6, 1),
      wall(13, 14, 6, 1),
      wall(5, 15, 1, 3), wall(25, 4, 1, 3),
      wall(21, 9, 2, 1), wall(9, 7, 2, 1),
      wall(8, 10, 6, 1), wall(16, 10, 7, 1),
    ],
    bombs: [[30, 18], [1, 1]],
    hides: [[3, 3, 3, 2], [24, 14, 3, 2], [13, 16, 3, 2], [16, 2, 2, 2]],
    lamps: [[5, 5], [16, 8], [26, 5], [12, 15], [28, 15], [10, 12]],
    names: ['DOYLE', 'MARSH'],
    labels: [[4, 6, 'TELLER HALL'], [24, 12, 'VAULT HALL'], [4, 14, 'LOBBY']],
    rugs: [[4, 12, 4, 2], [22, 13, 4, 2], [14, 3, 4, 2]],
    frames: [[9, 3, '#c9a227'], [20, 8, '#2f5aa8'], [20, 10, '#2f8a5f']],
    coins: [[5, 2], [27, 2], [4, 17], [27, 17], [15, 17]],
    vaults: [[28, 8]],
    guards: [
      guard([[12, 4], [18, 4], [18, 8], [12, 8]]),
      guard([[22, 13], [28, 13], [28, 17], [22, 17]], 56),
    ],
    cameras: [camera(16, 1, 1.5708, 0.9)],
  }),
  heist({
    id: 2, par: 70, name: 'THE SAPPHIRE GALLERY', sub: 'Heist 2 of 5 — blue glass, sharp eyes',
    brief: 'Two vaults behind the sculpture hall. The cameras sweep the long gallery — time them.',
    palette: {
      floor: '#141c28', floorAlt: '#16202e', wall: '#24344a', wallEdge: '#4a6a94',
      accent: '#5aa9ff', lamp: '#ffd28a', hide: '#1d3a2e', hideBlade: '#2f6a4a',
      hideBlade2: '#4a9a6a', hideBlade3: '#244d38', carpet: '#1d2f52',
    },
    spawn: [2, 17], exit: [29, 17],
    walls: [
      wall(0, 0, 32, 1), wall(0, 19, 32, 1), wall(0, 0, 1, 20), wall(31, 0, 1, 20),
      wall(7, 1, 1, 6), wall(7, 9, 1, 5),
      wall(15, 5, 1, 7), wall(15, 14, 1, 4),
      wall(23, 1, 1, 6), wall(23, 9, 1, 5),
      wall(2, 9, 4, 1), wall(10, 13, 4, 1), wall(18, 9, 4, 1), wall(26, 13, 4, 1),
      wall(13, 10, 1, 3), wall(25, 15, 2, 1),
      wall(7, 7, 2, 1), wall(23, 7, 2, 1),
      wall(6, 9, 5, 1), wall(13, 9, 5, 1),
    ],
    bombs: [[1, 18], [30, 1]],
    hides: [[3, 3, 3, 2], [11, 16, 3, 2], [19, 3, 3, 2], [27, 5, 2, 2], [10, 6, 2, 2]],
    lamps: [[4, 8], [11, 3], [19, 12], [27, 8], [11, 16], [24, 16], [18, 10]],
    names: ['VEGA', 'ORLO', 'PIKE'],
    labels: [[11, 6, 'SCULPTURE HALL'], [19, 4, 'BLUE GALLERY'], [11, 16, 'LONG GALLERY']],
    rugs: [[10, 3, 4, 2], [20, 15, 4, 2], [24, 16, 4, 2]],
    frames: [[7, 3, '#2f5aa8'], [15, 8, '#2f8a5f'], [23, 11, '#c0392b'], [7, 11, '#c9a227']],
    coins: [[4, 2], [28, 2], [11, 11], [20, 16], [28, 15], [16, 2]],
    vaults: [[4, 15], [29, 4]],
    guards: [
      guard([[9, 3], [13, 3], [13, 7], [9, 7]]),
      guard([[17, 12], [21, 12], [21, 16], [17, 16]], 58),
      guard([[25, 3], [29, 3], [29, 7], [25, 7]], 66),
    ],
    cameras: [camera(11, 1, 1.5708, 1.0), camera(21, 18, -1.5708, 1.0)],
  }),
  heist({
    id: 3, par: 85, name: 'THE EMERALD CASINO', sub: 'Heist 3 of 5 — the floor never sleeps',
    brief: 'Chips and vaults under the green felt lights. Three cameras, three guards, one long night.',
    palette: {
      floor: '#12241a', floorAlt: '#142a1e', wall: '#1f4430', wallEdge: '#3f7a52',
      accent: '#4ade80', lamp: '#ffe08a', hide: '#1e4028', hideBlade: '#2f7a3e',
      hideBlade2: '#55a85a', hideBlade3: '#265c31', carpet: '#3d1e2e',
    },
    spawn: [2, 2], exit: [29, 17],
    walls: [
      wall(0, 0, 32, 1), wall(0, 19, 32, 1), wall(0, 0, 1, 20), wall(31, 0, 1, 20),
      wall(10, 2, 1, 5), wall(10, 9, 1, 5),
      wall(18, 5, 1, 6), wall(18, 13, 1, 4),
      wall(25, 2, 1, 5), wall(25, 9, 1, 5),
      wall(3, 7, 5, 1), wall(12, 15, 6, 1), wall(21, 7, 3, 1), wall(27, 13, 3, 1),
      wall(5, 12, 1, 5),
      wall(2, 14, 1, 3), wall(26, 11, 1, 3),
      wall(10, 7, 2, 1), wall(25, 7, 2, 1),
      wall(8, 8, 6, 1), wall(16, 8, 8, 1),
    ],
    bombs: [[1, 18], [30, 1]],
    hides: [[4, 4, 3, 2], [13, 3, 3, 2], [21, 15, 3, 2], [28, 5, 2, 2], [7, 16, 3, 2], [15, 9, 2, 2]],
    lamps: [[7, 2], [15, 4], [22, 11], [28, 10], [8, 14], [20, 17], [13, 9]],
    names: ['RENO', 'SLATE', 'MOSS'],
    labels: [[5, 4, 'SLOTS'], [20, 5, 'HIGH ROLLERS'], [8, 16, 'CASINO FLOOR']],
    rugs: [[4, 12, 4, 2], [20, 16, 4, 2], [14, 6, 4, 2]],
    frames: [[18, 8, '#2f8a5f'], [25, 5, '#c9a227'], [18, 14, '#c0392b']],
    coins: [[5, 17], [29, 3], [13, 12], [22, 3], [8, 9], [27, 16], [17, 16]],
    vaults: [[29, 5], [3, 16]],
    guards: [
      guard([[12, 3], [16, 3], [16, 7], [12, 7]]),
      guard([[20, 10], [24, 10], [24, 15], [20, 15]], 60),
      guard([[5, 9], [8, 9], [8, 11], [5, 11]], 68),
    ],
    cameras: [camera(14, 1, 1.5708, 1.1), camera(22, 18, -1.5708, 1.0), camera(1, 10, 0, 0.8)],
  }),
  heist({
    id: 4, par: 95, name: 'THE CRIMSON MUSEUM', sub: 'Heist 4 of 5 — red velvet, four guards',
    brief: 'Three crown vaults in the long hall. The patrols overlap — read both cones before you move.',
    palette: {
      floor: '#26151a', floorAlt: '#2b181d', wall: '#4a2430', wallEdge: '#8a3a4a',
      accent: '#ff6b6b', lamp: '#ffc46b', hide: '#2e2a1a', hideBlade: '#6a6a2a',
      hideBlade2: '#9a9a3a', hideBlade3: '#4a4a20', carpet: '#5a1e28',
    },
    spawn: [2, 17], exit: [29, 2],
    walls: [
      wall(0, 0, 32, 1), wall(0, 19, 32, 1), wall(0, 0, 1, 20), wall(31, 0, 1, 20),
      wall(8, 1, 1, 6), wall(8, 9, 1, 6),
      wall(16, 4, 1, 6), wall(16, 12, 1, 5),
      wall(24, 1, 1, 6), wall(24, 9, 1, 6),
      wall(2, 8, 4, 1), wall(11, 14, 4, 1), wall(19, 8, 4, 1), wall(27, 14, 3, 1),
      wall(12, 2, 3, 1),
      wall(10, 10, 1, 3), wall(21, 2, 1, 3),
      wall(8, 7, 2, 1), wall(24, 7, 2, 1),
      wall(6, 9, 6, 1), wall(14, 9, 9, 1),
    ],
    bombs: [[1, 1], [30, 18]],
    hides: [[3, 4, 3, 2], [11, 6, 2, 2], [19, 16, 3, 2], [27, 4, 2, 2], [5, 12, 3, 2], [21, 11, 2, 2]],
    lamps: [[5, 6], [12, 10], [20, 4], [27, 10], [12, 17], [22, 16], [10, 16]],
    names: ['BRAM', 'SABLE', 'ORIN', 'FLETCH'],
    labels: [[5, 5, 'MARBLE HALL'], [20, 5, 'CRIMSON WING'], [8, 16, 'RELIC VAULT']],
    rugs: [[4, 12, 4, 2], [20, 16, 4, 2], [5, 6, 3, 2]],
    frames: [[16, 6, '#c0392b'], [24, 11, '#c9a227'], [12, 2, '#2f5aa8'], [8, 5, '#2f8a5f']],
    coins: [[4, 2], [28, 16], [13, 5], [20, 12], [6, 16], [28, 8], [18, 8]],
    vaults: [[4, 14], [14, 17], [29, 5]],
    guards: [
      guard([[10, 3], [14, 3], [14, 7], [10, 7]], 66),
      guard([[18, 12], [22, 12], [22, 16], [18, 16]], 62),
      guard([[26, 3], [29, 3], [29, 7], [26, 7]], 70),
      guard([[4, 10], [6, 10], [6, 13], [4, 13]], 58),
    ],
    cameras: [camera(12, 1, 1.5708, 1.0), camera(20, 18, -1.5708, 1.1), camera(30, 10, 3.1416, 0.9)],
  }),
  heist({
    id: 5, par: 120, name: 'THE OBSIDIAN VAULT', sub: 'Heist 5 of 5 — the duke keeps everything here',
    brief: 'The final job. Five guards, four cameras, three vaults. Plan every step — then run.',
    palette: {
      floor: '#1a1426', floorAlt: '#1e182c', wall: '#33254a', wallEdge: '#6a4a9a',
      accent: '#c9a227', lamp: '#ffd28a', hide: '#1c2e22', hideBlade: '#2f6a44',
      hideBlade2: '#4a9a62', hideBlade3: '#244d33', carpet: '#2e1e4a',
    },
    spawn: [2, 2], exit: [29, 17],
    walls: [
      wall(0, 0, 32, 1), wall(0, 19, 32, 1), wall(0, 0, 1, 20), wall(31, 0, 1, 20),
      wall(8, 1, 1, 6), wall(8, 9, 1, 6),
      wall(15, 4, 1, 6), wall(15, 12, 1, 5),
      wall(22, 1, 1, 6), wall(22, 9, 1, 6),
      wall(28, 5, 1, 5), wall(28, 12, 1, 5),
      wall(2, 8, 4, 1), wall(10, 14, 4, 1), wall(17, 8, 4, 1), wall(24, 14, 3, 1),
      wall(11, 2, 3, 1), wall(18, 16, 3, 1),
      wall(28, 10, 1, 2), wall(8, 7, 2, 1),
      wall(6, 9, 5, 1), wall(13, 9, 9, 1),
    ],
    bombs: [[1, 18], [30, 1]],
    hides: [[3, 4, 3, 2], [11, 6, 2, 2], [18, 10, 2, 2], [25, 4, 2, 2], [5, 12, 3, 2], [12, 16, 3, 2], [24, 17, 3, 1]],
    lamps: [[5, 6], [12, 10], [19, 4], [25, 10], [8, 16], [20, 13], [27, 7]],
    names: ['VANCE', 'ORLA', 'DUSK', 'KESS', 'MIRA'],
    labels: [[4, 5, 'OBSIDIAN HALL'], [18, 5, "THE DUKE'S WING"], [12, 16, 'DEEP VAULT']],
    rugs: [[4, 12, 4, 2], [24, 16, 4, 2], [14, 17, 4, 2]],
    frames: [[8, 3, '#6a4a9a'], [15, 6, '#c9a227'], [22, 11, '#2f8a7a'], [15, 8, '#2f5aa8']],
    coins: [[4, 17], [29, 3], [12, 5], [19, 12], [6, 15], [26, 16], [10, 10], [22, 16]],
    vaults: [[4, 15], [17, 2], [29, 6]],
    guards: [
      guard([[10, 3], [13, 3], [13, 7], [10, 7]], 64),
      guard([[17, 10], [20, 10], [20, 14], [17, 14]], 64),
      guard([[24, 3], [27, 3], [27, 6], [24, 6]], 66),
      guard([[4, 10], [6, 10], [6, 13], [4, 13]], 60),
      guard([[12, 15], [14, 15], [14, 18], [12, 18]], 66),
    ],
    cameras: [
      camera(11, 1, 1.5708, 1.0), camera(19, 18, -1.5708, 1.0),
      camera(1, 10, 0, 0.9), camera(30, 9, 3.1416, 0.9),
    ],
  }),
];

// A tile is solid when it is outside the building or inside any wall rect.
export function solidAt(heistDef, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  for (const w of heistDef.walls) {
    if (col >= w[0] && col < w[0] + w[2] && row >= w[1] && row < w[1] + w[3]) return true;
  }
  return false;
}

// Breadth-first walkable check: spawn must reach every vault, every coin and
// the exit, or the heist is unplayable. The verifier runs this on all five.
export function reachable(heistDef) {
  const start = heistDef.spawn;
  const seen = new Set([start[0] + ',' + start[1]]);
  const queue = [start];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, key = nx + ',' + ny;
      if (!seen.has(key) && !solidAt(heistDef, nx, ny)) { seen.add(key); queue.push([nx, ny]); }
    }
  }
  const targets = [...heistDef.vaults, ...heistDef.coins, heistDef.exit];
  return targets.every(([tx, ty]) => seen.has(tx + ',' + ty));
}

export function tileCenter(col, row) {
  return [(col + 0.5) * 40, (row + 0.5) * 40];
}
