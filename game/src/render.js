// VAULTBREAK — drawing only: the world's state and the current screen in,
// pixels out. The playfield is 1280x800 logical, drawn on a 2560x1600 backing
// store (2x supersampling) so screenshots stay sharp. Warm amber lamp pools
// against near-black shadow, amber guard cones that turn red on alarm, a small
// glowing cyan thief. Cone edges are plain lines — never dashed. Patrol routes
// are dotted lines, shown only while the sonar pulse lasts.
import { FIELD, FONT, FONT_DISPLAY, GUARD, CAMERA, PALETTE, TILE, TOOLS, hash2 } from './config.js';
import { HEISTS, solidAt, tileCenter } from './heists.js';
import { cameraFacing } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_BOMB = 'bomb';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_CAMPAIGN = 'campaign';

const SS = 2;
// Layout, like the reference games: a full-width top bar (heist, objective,
// time), a tool bar under it with the three tools as 3D boxes, the arena on
// the left, a sidebar on the right with detection, loot and legend, and a
// shortcut bar along the bottom. The arena is 1280x800 logical, fitted into
// the 1010x642 area between the tool bar and the bottom bar.
const TOPBAR_H = 64;
const TOOLBAR_H = 58;
const BOTTOMBAR_H = 36;
const SIDEBAR_X = 1010;
const FIELD_SCALE = Math.min((SIDEBAR_X) / FIELD.width, (FIELD.height - TOPBAR_H - TOOLBAR_H - BOTTOMBAR_H) / FIELD.height);
const FIELD_Y = TOPBAR_H + TOOLBAR_H + ((FIELD.height - TOPBAR_H - TOOLBAR_H - BOTTOMBAR_H) - FIELD.height * FIELD_SCALE) / 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const field = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * SS);
    canvas.height = Math.round(h * SS);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
    field.scale = view.scale * FIELD_SCALE;
    field.x = view.x;
    field.y = view.y + FIELD_Y * view.scale;
  }

  // The arena's rectangle in CSS pixels, for click-to-move conversion.
  function fieldRect() {
    return { x: field.x / SS, y: field.y / SS, scale: field.scale / SS };
  }

  // A hex colour with an alpha channel, so lamp pools and glows can be
  // tinted with each heist's own accent colour — neon light, per building.
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // Glass: a frosted panel fill, tinted with the theme's accent colour at
  // the top and fading to dark at the bottom. The tint is deliberately
  // faint — the gold outline stays the strongest line on the box, so the
  // glass never outshines the frame. One tint per heist, never one flat
  // colour: the bank is gold glass, the gallery blue, the casino green,
  // the museum red, the vault gold again.
  function glassFill(x, y, w, h, accent) {
    const g = context.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hexA(accent, 0.16));
    g.addColorStop(0.45, hexA(accent, 0.06));
    g.addColorStop(1, 'rgba(10,10,16,0.88)');
    context.fillStyle = g;
    context.fillRect(x, y, w, h);
  }

  // A rounded-rectangle path, for pills and key chips.
  function rr(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // Corner brackets on a box — the thin gold corners the reference games
  // put on every panel, so a flat box reads as a framed plaque.
  function corners(x, y, w, h, color) {
    const len = 12;
    context.strokeStyle = color || PALETTE.gold;
    context.lineWidth = 2;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      context.beginPath();
      context.moveTo(cx + dx * len, cy);
      context.lineTo(cx, cy);
      context.lineTo(cx, cy + dy * len);
      context.stroke();
    }
  }

  // Big display text in the gold gradient the title screens use.
  function goldText(value, x, y, size, align) {
    const grad = context.createLinearGradient(0, y - size, 0, y + 6);
    grad.addColorStop(0, '#ffe9a3');
    grad.addColorStop(0.5, '#f2c94c');
    grad.addColorStop(1, '#a87f1f');
    context.font = 'bold ' + size + 'px ' + FONT_DISPLAY;
    context.fillStyle = grad;
    context.textAlign = align || 'center';
    context.shadowColor = 'rgba(242,201,76,0.7)';
    context.shadowBlur = 22;
    context.fillText(value, x, y);
    context.shadowBlur = 0;
  }

  function text(value, x, y, size, color, align, weight, font) {
    const face = font || FONT;
    const key = size + (weight || '') + face;
    if (!fonts.has(key)) fonts.set(key, (weight || '') + ' ' + size + 'px ' + face);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  // A vision cone as a pool of light, not a flat wedge: the gradient is
  // brightest at the watcher and fades to nothing at the edge, so the cone
  // reads as light spilling across the floor. Edge is a plain line, never
  // dashed.
  function cone(x, y, facing, halfAngle, range, inner, edge) {
    const grad = context.createRadialGradient(x, y, 4, x, y, range);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, facing - halfAngle, facing + halfAngle);
    context.closePath();
    context.fillStyle = grad;
    context.fill();
    context.beginPath();
    context.arc(x, y, range, facing - halfAngle, facing + halfAngle);
    context.strokeStyle = edge;
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(facing - halfAngle) * range, y + Math.sin(facing - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(facing + halfAngle) * range, y + Math.sin(facing + halfAngle) * range);
    context.stroke();
  }

  function drawGrass(heistDef, pal) {
    for (const h of heistDef.hides) {
      context.fillStyle = pal.hide;
      context.fillRect(h[0] * TILE, h[1] * TILE, h[2] * TILE, h[3] * TILE);
      for (let ty = h[1]; ty < h[1] + h[3]; ty += 1) {
        for (let tx = h[0]; tx < h[0] + h[2]; tx += 1) {
          for (let b = 0; b < 21; b += 1) {
            const hx = hash2(tx * 31 + b, ty * 17 + 3);
            const hy = hash2(tx * 13 + 7, ty * 29 + b);
            const bx = tx * TILE + 3 + hx * (TILE - 6);
            const by = ty * TILE + TILE - 2 - hy * 10;
            const len = 14 + hash2(b, tx + ty * 7) * 16;
            const lean = (hash2(tx + b, ty) - 0.5) * 10;
            const shade = b % 3 === 0 ? pal.hideBlade : b % 3 === 1 ? pal.hideBlade2 : pal.hideBlade3;
            context.fillStyle = shade;
            context.beginPath();
            context.moveTo(bx - 2.5, by);
            context.lineTo(bx + lean, by - len);
            context.lineTo(bx + 2.5, by);
            context.closePath();
            context.fill();
          }
        }
      }
    }
  }

  function drawFloor(state) {
    const def = HEISTS[state.heistIndex];
    const pal = def.palette;
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        if (solidAt(def, col, row)) continue;
        const alt = hash2(col, row) > 0.5;
        context.fillStyle = alt ? pal.floorAlt : pal.floor;
        context.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
    // Carpet runner down the middle corridor of each building.
    context.fillStyle = pal.carpet;
    context.globalAlpha = 0.5;
    context.fillRect(0, 380, FIELD.width, 40);
    context.globalAlpha = 1;
    // Rugs: flat floor colour that varies the room — a darker carpet rect
    // with a thin gold inner border and a diamond at each corner.
    for (const r of (def.rugs || [])) {
      const rx = r[0] * TILE, ry = r[1] * TILE, rw = r[2] * TILE, rh = r[3] * TILE;
      context.fillStyle = pal.carpet;
      context.globalAlpha = 0.6;
      context.fillRect(rx, ry, rw, rh);
      context.globalAlpha = 1;
      context.strokeStyle = 'rgba(242,201,76,0.4)';
      context.lineWidth = 2;
      context.strokeRect(rx + 6, ry + 6, rw - 12, rh - 12);
      context.fillStyle = 'rgba(242,201,76,0.55)';
      for (const [dx, dy] of [[14, 14], [rw - 14, 14], [14, rh - 14], [rw - 14, rh - 14]]) {
        context.beginPath();
        context.moveTo(rx + dx, ry + dy - 4);
        context.lineTo(rx + dx + 4, ry + dy);
        context.lineTo(rx + dx, ry + dy + 4);
        context.lineTo(rx + dx - 4, ry + dy);
        context.closePath();
        context.fill();
      }
    }
    // Walls with a lit top edge, thick enough to read as a fortification.
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        if (!solidAt(def, col, row)) continue;
        context.fillStyle = pal.wall;
        context.fillRect(col * TILE, row * TILE, TILE, TILE);
        context.fillStyle = pal.wallEdge;
        context.fillRect(col * TILE, row * TILE, TILE, 6);
        context.fillStyle = 'rgba(0,0,0,0.35)';
        context.fillRect(col * TILE, row * TILE + TILE - 5, TILE, 5);
      }
    }
    // Framed pictures hung on the walls: a gold frame and a coloured
    // canvas, so the walls are not bare stone.
    for (const [fx, fy, color] of (def.frames || [])) {
      const px = fx * TILE + 6, py = fy * TILE + 6;
      context.fillStyle = PALETTE.gold;
      context.fillRect(px, py, 28, 28);
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, 22, 22);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(px + 3, py + 3, 22, 6);
    }
    drawGrass(def, pal);
    // Room labels, painted on the floor like the reference games: small
    // serif caps in the heist's accent colour, with a dark pass behind them
    // so they read over any tile.
    context.font = 'bold 13px ' + FONT_DISPLAY;
    context.textAlign = 'center';
    for (const [lx, ly, label] of (def.labels || [])) {
      const [cx, cy] = tileCenter(lx, ly);
      try { context.letterSpacing = '3px'; } catch (e) { /* older canvas */ }
      context.fillStyle = 'rgba(0,0,0,0.65)';
      context.fillText(label, cx + 1, cy + 1);
      context.globalAlpha = 0.75;
      context.fillStyle = pal.accent;
      context.fillText(label, cx, cy);
      context.globalAlpha = 1;
      try { context.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    }
    context.textAlign = 'left';
    // Lamp pools: neon light in the heist's own accent colour on the floor,
    // solid edge, no dashed ring.
    for (const [lx, ly] of def.lamps) {
      const [px, py] = tileCenter(lx, ly);
      const grad = context.createRadialGradient(px, py, 8, px, py, 150);
      grad.addColorStop(0, hexA(pal.accent, 0.38));
      grad.addColorStop(1, hexA(pal.accent, 0));
      context.fillStyle = grad;
      context.beginPath();
      context.arc(px, py, 150, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = pal.lamp;
      context.beginPath();
      context.arc(px, py, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = hexA(pal.accent, 0.55);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(px, py, 26, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawLoot(state) {
    const def = HEISTS[state.heistIndex];
    const pal = def.palette;
    for (const coin of state.coinsLeft) {
      if (coin.taken) continue;
      const [cx, cy] = tileCenter(coin.x, coin.y);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(cx + 3, cy + 6, 10, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(cx, cy, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5c00';
      text('$', cx, cy + 5, 13, '#7a5c00', 'center', 'bold');
    }
    for (const vault of state.vaultsLeft) {
      if (vault.taken) continue;
      const [vx, vy] = tileCenter(vault.x, vault.y);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.beginPath();
      context.ellipse(vx + 4, vy + 17, 20, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a2c00';
      context.fillRect(vx - 18, vy - 18, 36, 36);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.strokeRect(vx - 18, vy - 18, 36, 36);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(vx, vy - 11);
      context.lineTo(vx + 9, vy);
      context.lineTo(vx, vy + 11);
      context.lineTo(vx - 9, vy);
      context.closePath();
      context.fill();
    }
    // Bombs on the floor: a black ball with a lit fuse and a pulsing red
    // ring. Step on one and the night ends — this is not a vault, it is a
    // warning the player can see from across the room.
    for (const [bc, br] of (def.bombs || [])) {
      const [bx, by] = tileCenter(bc, br);
      context.strokeStyle = 'rgba(255,77,77,' + (0.5 + 0.3 * Math.sin(state.time * 5)).toFixed(3) + ')';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(bx, by, 15 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#16161c';
      context.beginPath();
      context.arc(bx, by, 11, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#8a93a3';
      context.lineWidth = 1.5;
      context.stroke();
      context.strokeStyle = '#c9a227';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bx, by - 11);
      context.lineTo(bx + 4, by - 17);
      context.stroke();
      context.fillStyle = Math.sin(state.time * 6) > 0 ? '#ffe066' : '#ff4d4d';
      context.beginPath();
      context.arc(bx + 4, by - 17, 3, 0, Math.PI * 2);
      context.fill();
    }
    const [ex, ey] = tileCenter(def.exit[0], def.exit[1]);
    context.fillStyle = state.exitOpen ? '#2fae5f' : '#3a3f4a';
    context.fillRect(ex - 18, ey - 18, 36, 36);
    context.strokeStyle = state.exitOpen ? '#7dffb0' : '#6a7080';
    context.lineWidth = 3;
    context.strokeRect(ex - 18, ey - 18, 36, 36);
    text('EXIT', ex, ey + 5, 11, state.exitOpen ? '#d8ffe6' : '#9aa0b0', 'center', 'bold');
  }

  function drawWatchers(state) {
    const def = HEISTS[state.heistIndex];
    for (const cam of state.cameras) {
      const facing = cameraFacing(cam, state.time);
      const blind = cam.blind > 0;
      cone(cam.x, cam.y, facing, CAMERA.halfAngle, CAMERA.range,
        blind ? 'rgba(120,120,120,0.14)' : 'rgba(255,179,71,0.30)',
        blind ? 'rgba(160,160,160,0.6)' : 'rgba(255,179,71,0.75)');
      context.fillStyle = blind ? '#777' : '#c8c8d0';
      context.fillRect(cam.x - 9, cam.y - 9, 18, 18);
      context.fillStyle = blind ? '#444' : '#ff4d4d';
      context.beginPath();
      context.arc(cam.x, cam.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const g of state.guards) {
      const alerted = g.mode === 'chase';
      const blind = g.blind > 0;
      cone(g.x, g.y, g.facing, GUARD.coneHalfAngle, GUARD.coneRange,
        blind ? 'rgba(120,120,120,0.14)' : alerted ? 'rgba(255,77,77,0.38)' : 'rgba(255,179,71,0.32)',
        blind ? 'rgba(160,160,160,0.6)' : alerted ? 'rgba(255,77,77,0.9)' : 'rgba(255,179,71,0.8)');
      // Dotted patrol route — only while the sonar pulse is live.
      if (state.sonarT > 0) {
        context.setLineDash([2, 7]);
        context.strokeStyle = 'rgba(55,230,214,0.8)';
        context.lineWidth = 2;
        context.beginPath();
        g.path.forEach(([px, py], i) => {
          const [wx, wy] = tileCenter(px, py);
          if (i === 0) context.moveTo(wx, wy); else context.lineTo(wx, wy);
        });
        context.closePath();
        context.stroke();
        context.setLineDash([]);
      }
      // Soft shadow under the guard, drawn before the body so it sits on
      // the floor, not on the guard.
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(g.x + 3, g.y + 15, 14, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = alerted ? '#ff4d4d' : '#2b2f3a';
      context.beginPath();
      context.arc(g.x, g.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = alerted ? '#ffd2d2' : '#8a93a3';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = alerted ? '#fff' : PALETTE.amber;
      context.beginPath();
      context.arc(g.x + Math.cos(g.facing) * 5, g.y + Math.sin(g.facing) * 5, 4, 0, Math.PI * 2);
      context.fill();
      // The name tag: every guard has a name and a state, like the
      // reference games' watch rosters.
      const gState = blind ? 'BLIND' : alerted ? 'HUNT!' : 'PATROL';
      const gColor = blind ? '#8a93a3' : alerted ? '#ff4d4d' : PALETTE.text;
      const tag = (g.name || 'GUARD') + ' · ' + gState;
      context.font = 'bold 11px ' + FONT;
      const tagW = context.measureText(tag).width + 12;
      context.fillStyle = 'rgba(10,10,16,0.88)';
      context.fillRect(g.x - tagW / 2, g.y - 34, tagW, 16);
      context.strokeStyle = 'rgba(242,201,76,0.5)';
      context.lineWidth = 1;
      context.strokeRect(g.x - tagW / 2, g.y - 34, tagW, 16);
      text(tag, g.x, g.y - 22, 11, gColor, 'center', 'bold');
      // A thought bubble when the guard is suspicious or hunting: '?' while
      // the alarm is warm, '!' once the chase is on.
      if (alerted || state.alarm >= 25) {
        context.fillStyle = alerted ? '#ff4d4d' : '#ffb347';
        context.beginPath();
        context.arc(g.x + tagW / 2 + 12, g.y - 40, 9, 0, Math.PI * 2);
        context.fill();
        text(alerted ? '!' : '?', g.x + tagW / 2 + 12, g.y - 36, 12, '#0a0a10', 'center', 'bold');
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.sonarT > 0) {
      // The sonar pulse rings neon: a pink outer ring over the cyan one.
      context.strokeStyle = 'rgba(255,110,199,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 66 + (5 - state.sonarT) * 40, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = 'rgba(55,230,214,0.7)';
      context.beginPath();
      context.arc(p.x, p.y, 60 + (5 - state.sonarT) * 40, 0, Math.PI * 2);
      context.stroke();
    }
    if (state.smokeT > 0) {
      context.fillStyle = 'rgba(200,200,210,0.35)';
      for (let i = 0; i < 7; i += 1) {
        const a = hash2(i, 5) * Math.PI * 2;
        const r = hash2(i, 9) * 60;
        context.beginPath();
        context.arc(state.smokeX + Math.cos(a) * r, state.smokeY + Math.sin(a) * r, 34, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (state.decoy) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(state.decoy.x, state.decoy.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(242,201,76,0.8)';
      context.beginPath();
      context.arc(state.decoy.x, state.decoy.y, 14 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
      context.stroke();
    }
    const glow = context.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
    glow.addColorStop(0, 'rgba(55,230,214,0.55)');
    glow.addColorStop(1, 'rgba(55,230,214,0)');
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.beginPath();
    context.ellipse(p.x + 3, p.y + 14, 13, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = glow;
    context.beginPath();
    context.arc(p.x, p.y, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.cyan;
    context.beginPath();
    context.arc(p.x, p.y, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0a3a36';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = '#08312e';
    context.beginPath();
    context.arc(p.x + Math.cos(p.facing) * 6, p.y + Math.sin(p.facing) * 6, 3.5, 0, Math.PI * 2);
    context.fill();
    if (state.status === 'HIDDEN') {
      context.strokeStyle = 'rgba(55,230,214,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 20, 0, Math.PI * 2);
      context.stroke();
    }
  }

  // One small picture per game object, used by the FIELD GUIDE legend and by
  // the HUD tool bar, so a tool is never just a line of text: the player sees
  // what it looks like before they ever press the key.
  function drawIcon(kind, x, y, s) {
    // A scale below 1 draws the same picture smaller, centred on its 24px
    // box — the sidebar legend uses 0.8 so five rows fit with the level
    // list underneath.
    s = s || 1;
    if (s !== 1) {
      context.save();
      context.translate(x + 12, y + 12);
      context.scale(s, s);
      context.translate(-(x + 12), -(y + 12));
    }
    if (kind === 'coin') {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(x + 12, y + 12, 10, 0, Math.PI * 2);
      context.fill();
      text('$', x + 12, y + 17, 13, '#7a5c00', 'center', 'bold');
    } else if (kind === 'vault') {
      context.fillStyle = '#3a2c00';
      context.fillRect(x, y, 24, 24);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.strokeRect(x, y, 24, 24);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(x + 12, y + 4);
      context.lineTo(x + 19, y + 12);
      context.lineTo(x + 12, y + 20);
      context.lineTo(x + 5, y + 12);
      context.closePath();
      context.fill();
    } else if (kind === 'exit') {
      context.fillStyle = '#2fae5f';
      context.fillRect(x, y, 24, 24);
      context.strokeStyle = '#7dffb0';
      context.lineWidth = 2;
      context.strokeRect(x, y, 24, 24);
      text('EXIT', x + 12, y + 16, 7, '#d8ffe6', 'center', 'bold');
    } else if (kind === 'smoke') {
      context.fillStyle = 'rgba(200,200,210,0.85)';
      context.beginPath();
      context.arc(x + 8, y + 15, 7, 0, Math.PI * 2);
      context.arc(x + 15, y + 10, 8, 0, Math.PI * 2);
      context.arc(x + 20, y + 16, 6, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'decoy') {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(x + 12, y + 12, 8, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(242,201,76,0.9)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(x + 12, y + 12, 12, 0, Math.PI * 2);
      context.stroke();
    } else if (kind === 'sonar') {
      context.strokeStyle = PALETTE.cyan;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x + 12, y + 12, 11, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(x + 12, y + 12, 6, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.cyan;
      context.beginPath();
      context.arc(x + 12, y + 12, 3, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'dash') {
      // A lightning bolt: the fast burst forward, gold on cyan.
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(x + 14, y + 1);
      context.lineTo(x + 6, y + 14);
      context.lineTo(x + 11, y + 14);
      context.lineTo(x + 9, y + 23);
      context.lineTo(x + 18, y + 10);
      context.lineTo(x + 13, y + 10);
      context.closePath();
      context.fill();
    } else if (kind === 'bomb') {
      // A round black bomb with a lit fuse — the thing never to step on.
      context.fillStyle = '#16161c';
      context.beginPath();
      context.arc(x + 11, y + 14, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#8a93a3';
      context.lineWidth = 1.5;
      context.stroke();
      context.strokeStyle = '#c9a227';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 11, y + 5);
      context.lineTo(x + 15, y + 1);
      context.stroke();
      context.fillStyle = '#ff4d4d';
      context.beginPath();
      context.arc(x + 15, y + 1, 2.5, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'grass') {
      context.fillStyle = '#2c4a26';
      context.fillRect(x, y + 10, 24, 14);
      context.fillStyle = '#4d7a35';
      for (let b = 0; b < 5; b += 1) {
        const bx = x + 3 + b * 4.5;
        context.beginPath();
        context.moveTo(bx - 2, y + 22);
        context.lineTo(bx + (b % 2 === 0 ? 2 : -2), y + 4);
        context.lineTo(bx + 2, y + 22);
        context.closePath();
        context.fill();
      }
    } else if (kind === 'lamp') {
      const grad = context.createRadialGradient(x + 12, y + 12, 2, x + 12, y + 12, 13);
      grad.addColorStop(0, 'rgba(255,179,71,0.5)');
      grad.addColorStop(1, 'rgba(255,179,71,0)');
      context.fillStyle = grad;
      context.beginPath();
      context.arc(x + 12, y + 12, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffb347';
      context.beginPath();
      context.arc(x + 12, y + 12, 4, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'cone') {
      context.fillStyle = 'rgba(255,179,71,0.45)';
      context.beginPath();
      context.moveTo(x + 2, y + 12);
      context.lineTo(x + 23, y + 3);
      context.lineTo(x + 23, y + 21);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(255,179,71,0.9)';
      context.lineWidth = 1.5;
      context.stroke();
    } else if (kind === 'camera') {
      context.fillStyle = '#c8c8d0';
      context.fillRect(x + 2, y + 4, 14, 14);
      context.fillStyle = '#ff4d4d';
      context.beginPath();
      context.arc(x + 9, y + 11, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,179,71,0.4)';
      context.beginPath();
      context.moveTo(x + 14, y + 11);
      context.lineTo(x + 24, y + 4);
      context.lineTo(x + 24, y + 18);
      context.closePath();
      context.fill();
    } else if (kind === 'guard') {
      context.fillStyle = '#2b2f3a';
      context.beginPath();
      context.arc(x + 12, y + 12, 10, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#8a93a3';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = PALETTE.amber;
      context.beginPath();
      context.arc(x + 15, y + 12, 3, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'bank') {
      // A bank: pediment roof on three columns, gold on dark.
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(x + 2, y + 10);
      context.lineTo(x + 12, y + 2);
      context.lineTo(x + 22, y + 10);
      context.closePath();
      context.fill();
      context.fillRect(x + 4, y + 11, 3, 10);
      context.fillRect(x + 10, y + 11, 3, 10);
      context.fillRect(x + 17, y + 11, 3, 10);
      context.fillRect(x + 2, y + 21, 20, 2);
    } else if (kind === 'gallery') {
      // A framed painting: gold frame, blue canvas, a little hill in it.
      context.fillStyle = PALETTE.gold;
      context.fillRect(x + 2, y + 4, 20, 16);
      context.fillStyle = '#2f5aa8';
      context.fillRect(x + 4, y + 6, 16, 12);
      context.fillStyle = '#7fb2e5';
      context.beginPath();
      context.moveTo(x + 4, y + 18);
      context.lineTo(x + 11, y + 9);
      context.lineTo(x + 20, y + 18);
      context.closePath();
      context.fill();
    } else if (kind === 'casino') {
      // A poker chip: green disc with white edge notches and a gold $.
      context.fillStyle = '#2fae5f';
      context.beginPath();
      context.arc(x + 12, y + 12, 10, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#e8e8f0';
      context.lineWidth = 2;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.arc(x + 12, y + 12, 8, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      text('$', x + 12, y + 17, 13, '#d8ffe6', 'center', 'bold');
    } else if (kind === 'museum') {
      // A museum facade: dome on top, arched door below, crimson accent.
      context.fillStyle = '#c0392b';
      context.beginPath();
      context.arc(x + 12, y + 10, 8, Math.PI, 0);
      context.fill();
      context.fillRect(x + 4, y + 10, 16, 11);
      context.fillStyle = '#0a0a10';
      context.beginPath();
      context.moveTo(x + 9, y + 21);
      context.lineTo(x + 9, y + 15);
      context.arc(x + 12, y + 15, 3, Math.PI, 0);
      context.lineTo(x + 15, y + 21);
      context.closePath();
      context.fill();
    }
    if (s !== 1) context.restore();
  }

  // The FIELD GUIDE: a box of pictures with one line each, saying what every
  // object and tool in the game is for. Two columns, six entries each.
  const GUIDE = [
    ['coin', 'Gold coin — $50, grab it on the way'],
    ['vault', 'Vault — crack EVERY vault to open EXIT'],
    ['exit', 'EXIT — the getaway, run here when green'],
    ['smoke', 'click [1] Smoke $150 — blinds guards + cameras'],
    ['decoy', 'click [2] Decoy $100 — a guard walks over to look'],
    ['dash', 'click [3] Dash $100 — a fast burst forward'],
    ['sonar', 'click [4] Sonar x2 — reveals patrols, guards hear it'],
    ['bomb', 'Bomb — step on it and the night ends in pieces'],
    ['grass', 'Tall grass — hides you unless a guard is close'],
    ['lamp', 'Lamp light — standing in it exposes you'],
    ['cone', 'Guard cone — amber sees you, red is chasing'],
    ['camera', 'Camera — its sweeping cone sees you too'],
  ];

  function drawLegendBox(x, y, w) {
    const rows = 6;
    const rowH = 30;
    const h = 44 + rows * rowH;
    glassFill(x, y, w, h, PALETTE.gold);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3.5;
    context.strokeRect(x, y, w, h);
    corners(x, y, w, h);
    text('FIELD GUIDE — WHAT EVERYTHING DOES', x + w / 2, y + 26, 17, PALETTE.gold, 'center', 'bold', FONT_DISPLAY);
    for (let i = 0; i < GUIDE.length; i += 1) {
      const col = i < rows ? 0 : 1;
      const row = i % rows;
      const ix = x + 16 + col * (w / 2);
      const iy = y + 40 + row * rowH;
      drawIcon(GUIDE[i][0], ix, iy);
      text(GUIDE[i][1], ix + 32, iy + 17, 14, PALETTE.text, 'left');
    }
    return h;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Full-width top bar, drawn in full-canvas coordinates: heist number and
  // name, the objective in the middle, the clock on the right.
  function drawTopBar(state, best) {
    const def = HEISTS[state.heistIndex];
    context.fillStyle = 'rgba(10,10,16,0.95)';
    context.fillRect(0, 0, FIELD.width, TOPBAR_H);
    context.fillStyle = def.palette.accent;
    context.fillRect(0, TOPBAR_H, FIELD.width, 4);
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(28, 32, 17, 0, Math.PI * 2);
    context.fill();
    text(String(state.heistIndex + 1), 28, 39, 20, '#0a0a10', 'center', 'bold');
    context.shadowColor = hexA(def.palette.accent, 0.8);
    context.shadowBlur = 10;
    text(def.name, 54, 30, 22, PALETTE.text, 'left', 'bold', FONT_DISPLAY);
    context.shadowBlur = 0;
    text(def.sub, 54, 52, 13, PALETTE.muted, 'left');
    const objective = state.exitOpen
      ? 'OBJECTIVE: reach the EXIT unseen'
      : 'OBJECTIVE: crack every vault, then reach the EXIT';
    // The objective sits in its own outlined pill, so the player always
    // knows what to do next at a glance.
    context.font = 'bold 15px ' + FONT;
    const objW = context.measureText(objective).width + 30;
    context.fillStyle = 'rgba(10,10,16,0.65)';
    rr(FIELD.width / 2 - objW / 2, 23, objW, 30, 15);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.stroke();
    text(objective, FIELD.width / 2, 43, 15, state.exitOpen ? '#7dffb0' : PALETTE.gold, 'center', 'bold');
    text('TIME ' + formatTime(state.time), FIELD.width - 20, 30, 20, PALETTE.text, 'right', 'bold');
    text('HEIST ' + (state.heistIndex + 1) + '/5', FIELD.width - 20, 52, 13, PALETTE.muted, 'right');
  }

  // The tool bar under the top bar, like the reference games' bottom tool
  // row: each tool is a 3D box — a thick gold outline, a lit top edge, a
  // dark drop under it — with its picture, its name, what it does, and its
  // key and price. All four tools fit in one row.
  function drawToolBar(state) {
    const def = HEISTS[state.heistIndex];
    const y = TOPBAR_H + 6;
    const h = TOOLBAR_H - 12;
    context.fillStyle = 'rgba(10,10,16,0.95)';
    context.fillRect(0, TOPBAR_H, FIELD.width, TOOLBAR_H);
    const tools = [
      ['smoke', 'SMOKE PELLET', 'Blinds guards + cameras', '[1]  $150', state.loot >= TOOLS.smoke.cost],
      ['decoy', 'DECOY COIN', 'A guard walks over to look', '[2]  $100', state.loot >= TOOLS.decoy.cost],
      ['dash', 'DASH', 'A fast burst forward', '[3]  $100', state.loot >= TOOLS.dash.cost],
      ['sonar', 'SONAR PULSE', 'Reveals patrols — guards hear it', '[4]  x' + state.sonarCharges, true],
    ];
    tools.forEach(([kind, name, func, price, afford], i) => {
      const x = 16 + i * 315;
      const w = 303;
      // Drop shadow under the box, then the glass box itself.
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(x + 3, y + h - 2, w, 4);
      glassFill(x, y, w, h, def.palette.accent);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.strokeRect(x, y, w, h);
      corners(x, y, w, h);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(x + 3, y + 3, w - 6, 2);
      drawIcon(kind, x + 10, y + 11);
      const col = afford ? PALETTE.text : PALETTE.muted;
      text(name, x + 44, y + 20, 13, col, 'left', 'bold', FONT_DISPLAY);
      text(func, x + 44, y + 39, 11, PALETTE.muted, 'left');
      text(price, x + w - 12, y + 20, 13, afford ? PALETTE.gold : PALETTE.muted, 'right', 'bold');
    });
  }

  // The shortcut bar along the bottom, like the reference games: every key
  // the player needs, in one line. The controls used to live in the sidebar
  // — they live here now.
  function drawBottomBar() {
    const y = FIELD.height - BOTTOMBAR_H;
    context.fillStyle = 'rgba(10,10,16,0.95)';
    context.fillRect(0, y, FIELD.width, BOTTOMBAR_H);
    context.fillStyle = PALETTE.gold;
    context.fillRect(0, y, FIELD.width, 2);
    const parts = [
      ['WASD / arrows', ' move'], ['click', ' to walk'], ['[1]', ' smoke'],
      ['[2]', ' decoy'], ['[3]', ' dash'], ['[4]', ' sonar'], ['P', ' pause'], ['R', ' retry'], ['M', ' menu'],
    ];
    let total = 0;
    context.font = '13px ' + FONT;
    for (const [key, label] of parts) {
      total += context.measureText(key).width + context.measureText(label).width + 34;
    }
    let x = (FIELD.width - total) / 2 + 17;
    for (const [key, label] of parts) {
      context.font = 'bold 13px ' + FONT;
      const kw = context.measureText(key).width;
      text(key, x, y + 23, 13, PALETTE.gold, 'left', 'bold');
      x += kw;
      context.font = '13px ' + FONT;
      const lw = context.measureText(label).width;
      text(label, x, y + 23, 13, PALETTE.muted, 'left');
      x += lw + 34;
    }
  }

  // The right sidebar, drawn in full-canvas coordinates: detection in three
  // stages with the WATCH roster, loot, and the legend. Every section sits
  // in its own outlined box with a thick border, and the LEGEND box
  // stretches to the bottom, its rows spread evenly to fill it. There is no
  // TOOLS section any more — the tools live in the tool bar under the top
  // bar — and no CONTROLS section; the controls live in the bottom bar.
  function drawSidebar(state, best) {
    const def = HEISTS[state.heistIndex];
    const x = SIDEBAR_X;
    const w = FIELD.width - SIDEBAR_X;
    const bx = x + 8, bw = w - 16;
    const BOTTOM = FIELD.height - BOTTOMBAR_H - 12;
    context.fillStyle = 'rgba(13,12,20,0.96)';
    context.fillRect(x, TOPBAR_H + TOOLBAR_H, w, FIELD.height - TOPBAR_H - TOOLBAR_H);
    context.fillStyle = def.palette.accent;
    context.fillRect(x, TOPBAR_H + TOOLBAR_H, 3, FIELD.height - TOPBAR_H - TOOLBAR_H);
    let y = TOPBAR_H + TOOLBAR_H + 12;

    function box(yTop, h, title) {
      glassFill(bx, yTop, bw, h, def.palette.accent);
      context.strokeStyle = '#4a4a55';
      context.lineWidth = 2.5;
      context.strokeRect(bx, yTop, bw, h);
      corners(bx, yTop, bw, h);
      text(title, bx + 12, yTop + 20, 12, PALETTE.gold, 'left', 'bold', FONT_DISPLAY);
      return yTop + 38;
    }
    const ix = bx + 12;
    const rx = bx + bw - 12;

    // DETECTION — CLEAR green, SUSPICIOUS amber with a ?, HUNTED red.
    // Below the gauge, the WATCH roster: every guard by name and state,
    // like the reference games.
    let cy = box(y, 240, 'DETECTION');
    const det = state.detection;
    const detColor = det === 'CLEAR' ? '#2fae5f' : det === 'SUSPICIOUS' ? '#ffb347' : '#ff4d4d';
    const detMark = det === 'CLEAR' ? '✓' : det === 'SUSPICIOUS' ? '?' : '!';
    context.fillStyle = detColor;
    context.fillRect(ix, cy, bw - 24, 40);
    text(det, ix + 12, cy + 28, 22, '#0a0a10', 'left', 'bold');
    text(detMark, ix + bw - 36, cy + 30, 24, '#0a0a10', 'center', 'bold');
    cy += 50;
    const detLine = det === 'CLEAR' ? 'Nobody suspects a thing.'
      : det === 'SUSPICIOUS' ? 'Something caught an eye. Freeze.' : "They know you're here — RUN!";
    text(detLine, ix, cy, 12, PALETTE.text, 'left');
    cy += 20;
    text('ALARM', ix, cy, 12, PALETTE.muted, 'left', 'bold');
    text(state.alarm >= 70 ? 'HOT' : state.alarm >= 25 ? 'WARM' : 'QUIET', rx, cy, 12, detColor, 'right', 'bold');
    cy += 6;
    context.fillStyle = '#2a2a33';
    context.fillRect(ix, cy, bw - 24, 12);
    context.fillStyle = state.alarm > 60 ? '#ff4d4d' : state.alarm > 25 ? '#ffb347' : '#f2c94c';
    context.fillRect(ix, cy, (bw - 24) * (state.alarm / 100), 12);
    cy += 24;
    text('VISIBILITY', ix, cy, 12, PALETTE.muted, 'left', 'bold');
    const visColor = state.status === 'SEEN' ? '#ff4d4d' : state.status === 'HIDDEN' ? PALETTE.cyan : state.status === 'SHADOW' ? '#9a917e' : '#ffb347';
    text(state.status === 'SEEN' ? 'SEEN!' : state.status === 'HIDDEN' ? 'HIDDEN' : state.status === 'SHADOW' ? 'IN SHADOW' : 'EXPOSED', rx, cy, 12, visColor, 'right', 'bold');
    cy += 18;
    text('SPOTTED', ix, cy, 12, PALETTE.muted, 'left', 'bold');
    text(String(state.timesSpotted), rx, cy, 12, PALETTE.text, 'right', 'bold');
    cy += 24;
    text('WATCH', ix, cy, 11, PALETTE.gold, 'left', 'bold');
    cy += 16;
    state.guards.forEach((g, i) => {
      const wx = ix + (i % 2) * 115;
      const wy = cy + Math.floor(i / 2) * 14;
      const ws = g.blind > 0 ? 'BLIND' : g.mode === 'chase' ? 'HUNT!' : 'PATROL';
      const wc = g.blind > 0 ? '#8a93a3' : g.mode === 'chase' ? '#ff4d4d' : PALETTE.text;
      text((g.name || 'GUARD') + '  ' + ws, wx, wy + 11, 11, wc, 'left', 'bold');
    });
    y += 240 + 10;

    // LOOT — counts are derived from what is actually taken, so staged
    // scenes and live play always agree with the dollar total.
    cy = box(y, 76, 'LOOT');
    const vaultsGot = def.vaults.length - state.vaultsLeft.filter((v) => !v.taken).length;
    const coinsGot = def.coins.length - state.coinsLeft.filter((c) => !c.taken).length;
    text('VAULTS  ' + vaultsGot + '/' + def.vaults.length, ix, cy, 14, PALETTE.text, 'left', 'bold');
    text('$' + state.loot, rx, cy, 14, PALETTE.gold, 'right', 'bold');
    cy += 24;
    text('COINS  ' + coinsGot + '/' + def.coins.length, ix, cy, 14, PALETTE.text, 'left', 'bold');
    y += 76 + 10;

    // LEGEND — five essentials, icons drawn smaller so the level list
    // underneath fits. The full guide lives on the title screen.
    const LEVELS_H = 38 + HEISTS.length * 16;
    const legendH = BOTTOM - y - LEVELS_H - 10;
    cy = box(y, legendH, 'LEGEND');
    const legend = [
      ['guard', 'Guard + vision cone'],
      ['camera', 'Camera sweeps'],
      ['grass', 'Low cover: hide here'],
      ['lamp', 'Lamp light: you are seen'],
      ['vault', 'Objective vault'],
    ];
    const rowH = (legendH - 46) / legend.length;
    for (let i = 0; i < legend.length; i += 1) {
      const iy = cy + i * rowH;
      drawIcon(legend[i][0], ix, iy, 0.8);
      text(legend[i][1], ix + 30, iy + 17, 12, PALETTE.muted, 'left');
    }
    y += legendH + 10;

    // LEVELS — the night's five heists: the one being played is gold, the
    // escaped ones show their best time, the rest are locked and grey.
    cy = box(y, LEVELS_H, 'LEVELS');
    HEISTS.forEach((h, i) => {
      const done = state.results[i];
      const current = i === state.heistIndex;
      const locked = !done && i > state.heistIndex;
      const ly = cy + i * 16;
      if (current) {
        context.fillStyle = 'rgba(242,201,76,0.14)';
        context.fillRect(bx + 2, ly - 12, bw - 4, 16);
      }
      const lcol = current ? PALETTE.gold : locked ? '#55555f' : PALETTE.text;
      text((i + 1) + '. ' + h.name, ix, ly, 12, lcol, 'left', 'bold', current ? FONT_DISPLAY : undefined);
      const rcol = current ? PALETTE.gold : PALETTE.muted;
      text(done ? '✓ ' + formatTime(done.time) : current ? '▶ NOW' : '—', rx, ly, 12, rcol, 'right', 'bold');
    });
  }

  function drawHud(state, best) {
    drawTopBar(state, best);
    drawToolBar(state);
    drawSidebar(state, best);
    drawBottomBar();
  }

  function drawPanel(title, lines, prompt, accent) {
    // The panel grows to fit its title: measure the title first, widen the
    // box past it with room to spare, and shrink the type only if the title
    // would still not fit inside the playfield.
    let titleSize = 42;
    context.font = 'bold ' + titleSize + 'px ' + FONT;
    let titleWidth = context.measureText(title).width;
    const maxWidth = FIELD.width - 80;
    while (titleWidth > maxWidth - 90 && titleSize > 24) {
      titleSize -= 2;
      context.font = 'bold ' + titleSize + 'px ' + FONT;
      titleWidth = context.measureText(title).width;
    }
    const width = Math.max(680, Math.min(maxWidth, titleWidth + 90));
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10,10,16,0.88)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glassFill(x, y, width, height, accent || PALETTE.gold);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 4;
    context.strokeRect(x, y, width, height);
    corners(x, y, width, height);
    context.textBaseline = 'alphabetic';
    context.font = 'bold ' + titleSize + 'px ' + FONT_DISPLAY;
    context.fillStyle = PALETTE.text;
    context.textAlign = 'center';
    context.shadowColor = accent === '#ff4d4d' ? 'rgba(255,77,77,0.6)' : 'rgba(242,201,76,0.6)';
    context.shadowBlur = 16;
    context.fillText(title, FIELD.width / 2, y + 62);
    context.shadowBlur = 0;
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 108 + i * 32, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.gold, 'center', 'bold');
  }

  function drawTitle(state, best) {
    const def = HEISTS[0];
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // A faint blueprint of the first heist behind the title, like the
    // reference's map, and gold dust in the dark.
    context.fillStyle = 'rgba(242,201,76,0.06)';
    for (const w of def.walls) context.fillRect(w[0] * TILE, w[1] * TILE, w[2] * TILE, w[3] * TILE);
    for (let i = 0; i < 40; i += 1) {
      const x = hash2(i, 1) * FIELD.width;
      const y = 120 + hash2(i, 2) * 560;
      context.fillStyle = 'rgba(255,179,71,0.5)';
      context.beginPath();
      context.arc(x, y, 3 + hash2(i, 3) * 5, 0, Math.PI * 2);
      context.fill();
    }
    // The title: small caps over a huge gold serif wordmark, glowing.
    context.font = 'bold 16px ' + FONT_DISPLAY;
    context.textAlign = 'center';
    try { context.letterSpacing = '6px'; } catch (e) { /* older canvas */ }
    context.fillStyle = PALETTE.gold;
    context.fillText('A  N I G H T  I N  T H E  C I T Y', FIELD.width / 2, 108);
    try { context.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    context.fillStyle = PALETTE.neon;
    context.fillText('◆', FIELD.width / 2 - 300, 108);
    context.fillText('◆', FIELD.width / 2 + 300, 108);
    goldText('VAULTBREAK', FIELD.width / 2, 200, 92);
    context.font = 'italic 18px ' + FONT_DISPLAY;
    context.fillStyle = PALETTE.text;
    context.textAlign = 'center';
    context.fillText('Five heists. One night. No second chances.', FIELD.width / 2, 240);
    // Two panels side by side: the night's heists, and the hands.
    const LEVEL_ICONS = ['bank', 'gallery', 'casino', 'museum', 'vault'];
    const panelY = 272, panelH = 180;
    for (const [px, title] of [[90, "THE NIGHT'S HEISTS"], [650, 'THE HANDS']]) {
      glassFill(px, panelY, 540, panelH, PALETTE.gold);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2.5;
      context.strokeRect(px, panelY, 540, panelH);
      corners(px, panelY, 540, panelH);
      text(title, px + 16, panelY + 28, 14, PALETTE.gold, 'left', 'bold', FONT_DISPLAY);
    }
    HEISTS.forEach((h, i) => {
      const ry = panelY + 56 + i * 24;
      drawIcon(LEVEL_ICONS[i], 90 + 14, ry - 2, 0.67);
      text((i + 1) + '. ' + h.name, 90 + 42, ry + 12, 13, PALETTE.text, 'left', 'bold', FONT_DISPLAY);
      text('stealth · par ' + formatTime(h.par), 90 + 540 - 16, ry + 12, 12, PALETTE.muted, 'right');
    });
    const HANDS = [
      ['WASD / arrows', 'move'],
      ['Mouse + click', 'walk there'],
      ['1  ·  2  ·  3  ·  4', 'smoke · decoy · dash · sonar'],
      ['P  ·  R  ·  M', 'pause · retry · menu'],
      ['SPACE', 'start the night'],
    ];
    HANDS.forEach(([key, label], i) => {
      const ry = panelY + 56 + i * 24;
      context.font = 'bold 11px ' + FONT;
      const kw = context.measureText(key).width + 14;
      context.fillStyle = 'rgba(10,10,16,0.9)';
      rr(650 + 16, ry - 2, kw, 20, 4);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 1.5;
      context.stroke();
      text(key, 650 + 16 + kw / 2, ry + 12, 11, PALETTE.gold, 'center', 'bold');
      text(label, 650 + 16 + kw + 10, ry + 12, 13, PALETTE.muted, 'left');
    });
    drawLegendBox(90, 460, FIELD.width - 180);
    text('Press SPACE or click to start the first heist', FIELD.width / 2, 710, 22, PALETTE.gold, 'center', 'bold');
    if (best > 0) text('Best night: $' + best, FIELD.width / 2, 742, 17, PALETTE.text, 'center');
    else text('5 heists · 17 guards · 11 vaults · 33 coins · one way out, through the green EXIT', FIELD.width / 2, 742, 15, PALETTE.muted, 'center');
  }

  // The route map on the ESCAPED card: the heist as a small building plan —
  // walls, vaults, the exit, the bombs, and the line the thief took from
  // the spawn to the getaway. The map keeps the arena's aspect (1280x800),
  // so a 240x150 box draws the rooms without squashing them.
  function drawRouteMap(state, mx, my, mw, mh) {
    const def = HEISTS[state.heistIndex];
    const pal = def.palette;
    context.fillStyle = 'rgba(10,10,16,0.9)';
    context.fillRect(mx, my, mw, mh);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(mx, my, mw, mh);
    const sx = mw / FIELD.width, sy = mh / FIELD.height;
    context.fillStyle = pal.wall;
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        if (!solidAt(def, col, row)) continue;
        context.fillRect(mx + col * TILE * sx, my + row * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
      }
    }
    const trail = state.trail || [];
    if (trail.length > 1) {
      context.lineJoin = 'round';
      context.beginPath();
      trail.forEach(([tc, tr], i) => {
        const x = mx + (tc + 0.5) * TILE * sx, y = my + (tr + 0.5) * TILE * sy;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.stroke();
      context.strokeStyle = PALETTE.cyan;
      context.lineWidth = 1.5;
      context.stroke();
    }
    // Spawn, vaults, bombs, exit.
    const [sc, sr] = def.spawn;
    context.fillStyle = PALETTE.cyan;
    context.beginPath();
    context.arc(mx + (sc + 0.5) * TILE * sx, my + (sr + 0.5) * TILE * sy, 4, 0, Math.PI * 2);
    context.fill();
    for (const [vc, vr] of def.vaults) {
      const x = mx + (vc + 0.5) * TILE * sx, y = my + (vr + 0.5) * TILE * sy;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(x, y - 4);
      context.lineTo(x + 4, y);
      context.lineTo(x, y + 4);
      context.lineTo(x - 4, y);
      context.closePath();
      context.fill();
    }
    for (const [bc, br] of (def.bombs || [])) {
      context.fillStyle = '#ff4d4d';
      context.beginPath();
      context.arc(mx + (bc + 0.5) * TILE * sx, my + (br + 0.5) * TILE * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const [ec, er] = def.exit;
    context.fillStyle = '#2fae5f';
    context.fillRect(mx + (ec + 0.5) * TILE * sx - 4, my + (er + 0.5) * TILE * sy - 4, 8, 8);
  }

  // The ESCAPED report card, like the reference games: a big panel with the
  // rank, stars, the time against par, times spotted and loot — plus the
  // campaign list on the right, so the player sees where the night stands.
  function drawComplete(state, best) {
    const def = HEISTS[state.heistIndex];
    const res = state.results[state.heistIndex] || { time: state.time, spotted: state.timesSpotted, loot: state.loot, coins: state.coinsGot, coinsTotal: def.coins.length, vaults: state.vaultsGot, vaultsTotal: def.vaults.length, rank: 'GHOST' };
    const stars = 1 + (res.coins === res.coinsTotal ? 1 : 0) + (res.rank === 'GHOST' ? 1 : 0);
    // Opaque backdrop: the report card covers the sidebar entirely, so no
    // sidebar text shows through the campaign list.
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Left panel.
    const px = 60, py = 90, pw = 560, ph = 620;
    glassFill(px, py, pw, ph, def.palette.accent);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(px, py, pw, ph);
    corners(px, py, pw, ph);
    text('NIGHT ' + (state.heistIndex + 1) + ' · ' + def.name, px + pw / 2, py + 34, 15, PALETTE.gold, 'center', 'bold', FONT_DISPLAY);
    const escGrad = context.createLinearGradient(0, py + 50, 0, py + 110);
    escGrad.addColorStop(0, '#d8ffe6');
    escGrad.addColorStop(0.5, '#7dffb0');
    escGrad.addColorStop(1, '#2fae5f');
    context.font = 'bold 64px ' + FONT_DISPLAY;
    context.fillStyle = escGrad;
    context.textAlign = 'center';
    context.shadowColor = 'rgba(125,255,176,0.7)';
    context.shadowBlur = 20;
    context.fillText('ESCAPED', px + pw / 2, py + 108);
    context.shadowBlur = 0;
    const rankColor = res.rank === 'GHOST' ? PALETTE.cyan : res.rank === 'SHADOW' ? '#9a917e' : '#ff4d4d';
    context.font = 'bold 46px ' + FONT_DISPLAY;
    context.fillStyle = rankColor;
    context.shadowColor = rankColor;
    context.shadowBlur = 14;
    context.fillText(res.rank, px + pw / 2, py + 168);
    context.shadowBlur = 0;
    const flavor = res.rank === 'GHOST' ? 'Never spotted. They will not even know you came.'
      : res.rank === 'SHADOW' ? 'Seen, but never caught. The crew slips away.'
      : 'Loud, but rich. The alarm will remember you.';
    text(flavor, px + pw / 2, py + 200, 14, PALETTE.muted, 'center');
    let starLine = '';
    for (let i = 0; i < 3; i += 1) starLine += i < stars ? '★ ' : '☆ ';
    text(starLine.trim(), px + pw / 2, py + 256, 34, PALETTE.gold, 'center');
    const row = (label, value, y) => {
      text(label, px + 60, y, 16, PALETTE.muted, 'left', 'bold');
      text(value, px + pw - 60, y, 16, PALETTE.text, 'right', 'bold');
    };
    row('TIME', formatTime(res.time) + '  (par ' + formatTime(def.par) + ')', py + 300);
    row('TIMES SPOTTED', String(res.spotted), py + 328);
    row('LOOT', res.vaults + '/' + res.vaultsTotal + ' vaults · ' + res.coins + '/' + res.coinsTotal + ' coins', py + 356);
    row('TAKE', '$' + res.loot + '  ·  night $' + state.totalLoot, py + 384);
    // The route map: the night as a little building plan — the walls, the
    // vaults, the exit, and the gold-and-cyan line the thief actually took.
    text('YOUR ROUTE', px + pw / 2, py + 416, 13, PALETTE.gold, 'center', 'bold', FONT_DISPLAY);
    drawRouteMap(state, px + (pw - 240) / 2, py + 424, 240, 150);
    text('SPACE next night   ·   R retry   ·   M menu', px + pw / 2, py + 600, 15, PALETTE.gold, 'center', 'bold');
    // Right column: campaign level select.
    const cx = 660, cw = 560;
    text('CAMPAIGN · LEVEL SELECT', cx + cw / 2, py + 34, 15, PALETTE.gold, 'center', 'bold', FONT_DISPLAY);
    HEISTS.forEach((h, i) => {
      const y = py + 60 + i * 96;
      const done = state.results[i];
      const current = i === state.heistIndex;
      const locked = !done && i > state.heistIndex;
      context.fillStyle = current ? 'rgba(242,201,76,0.12)' : 'rgba(16,24,46,0.85)';
      context.fillRect(cx, y, cw, 80);
      context.strokeStyle = current ? PALETTE.gold : '#3a3a44';
      context.lineWidth = current ? 2 : 1;
      context.strokeRect(cx, y, cw, 80);
      if (current) corners(cx, y, cw, 80);
      text(String(i + 1), cx + 24, y + 50, 22, done ? PALETTE.gold : PALETTE.muted, 'left', 'bold');
      text(h.name, cx + 56, y + 32, 16, locked ? PALETTE.muted : PALETTE.text, 'left', 'bold', FONT_DISPLAY);
      if (done) {
        text('Best ' + formatTime(done.time) + '  ·  ' + done.rank, cx + 56, y + 58, 13, PALETTE.muted, 'left');
        text('★'.repeat(1 + (done.coins === done.coinsTotal ? 1 : 0) + (done.rank === 'GHOST' ? 1 : 0)), cx + cw - 20, y + 46, 16, PALETTE.gold, 'right');
      } else if (locked) {
        text('Escape the level before to open', cx + 56, y + 58, 13, PALETTE.muted, 'left');
      } else {
        text('Not yet escaped', cx + 56, y + 58, 13, PALETTE.muted, 'left');
      }
    });
    const next = state.heistIndex + 1 < HEISTS.length ? HEISTS[state.heistIndex + 1] : null;
    text(next ? 'Next: ' + next.name : 'That was the last vault in the city.', cx + cw / 2, py + 60 + 5 * 96 + 20, 14, PALETTE.muted, 'center');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    // The arena is fitted into the left area under the top bar; the margin
    // around the whole 1280x800 canvas keeps the heist's floor colour.
    const marginFill = screen === SCREEN_TITLE
      ? PALETTE.backdrop
      : HEISTS[state.heistIndex].palette.floor;
    context.fillStyle = marginFill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'alphabetic';
    if (screen === SCREEN_TITLE) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      drawTitle(state, best);
      return;
    }
    // Arena, in its own fitted transform.
    context.setTransform(field.scale, 0, 0, field.scale, field.x, field.y);
    drawFloor(state);
    drawLoot(state);
    drawWatchers(state);
    drawPlayer(state);
    // Vignette: the room's edges fall into darkness, like the reference
    // games — the lamp pools and the cones are the light that matters.
    const vig = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 380, FIELD.width / 2, FIELD.height / 2, 780);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    context.fillStyle = vig;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (state.message) text(state.message, FIELD.width / 2, 756, 15, PALETTE.gold, 'center');
    if (!state.exitOpen) {
      const left = state.vaultsLeft.filter((v) => !v.taken).length;
      text('VAULTS LEFT: ' + left + '  —  crack every vault to open the EXIT', FIELD.width / 2, 780, 15, PALETTE.text, 'center', 'bold');
    } else {
      text('EXIT IS OPEN — RUN FOR THE GREEN DOOR!', FIELD.width / 2, 780, 16, '#7dffb0', 'center', 'bold');
    }
    context.strokeStyle = HEISTS[state.heistIndex].palette.accent;
    context.globalAlpha = 0.55;
    context.lineWidth = 4;
    context.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
    context.globalAlpha = 1;
    // Top bar and sidebar, in full-canvas coordinates.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards wait. Your plan does not expire.'], 'Press P to resume', PALETTE.cyan);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('BUSTED', [
        'The alarm hit ' + Math.round(state.alarm) + ' — the crew scattered.',
        'Loot kept so far this heist: $' + state.loot + '. The vaults are still there.',
        'Read the cones. Use the grass. Spend the smoke.',
      ], 'Press SPACE to retry this heist', '#ff4d4d');
    } else if (screen === SCREEN_BOMB) {
      drawPanel('BLOWN UP', [
        'You stepped on a bomb. The night ends in pieces.',
        'Loot kept so far this heist: $' + state.loot + '. The vaults are still there.',
        'Watch the floor, not just the cones — the red ring means run around.',
      ], 'Press SPACE to retry this heist', '#ff4d4d');
    } else if (screen === SCREEN_COMPLETE) {
      drawComplete(state, best);
    } else if (screen === SCREEN_CAMPAIGN) {
      drawPanel('THE NIGHT IS YOURS', [
        'All five heists complete. Total loot: $' + state.totalLoot,
        'Total time: ' + formatTime(state.totalTime) + '   ·   Best night: $' + best,
        'Five buildings, five getaways, one crew.',
      ], 'Press SPACE to run it all again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, fieldRect };
}
