// VAULTBREAK — the screenshot scenes behind ?shot=cover|alarm|hide|vault.
// Each one loads a real heist, places the thief and the guards by hand, then
// plays the real rules forward a few steps, so the frame is what the game
// really looks like at that moment and the same seed always gives the same
// frame. The cover is the casino mid-heist with the sonar pulse live, so one
// frame shows the room, the cones, a camera, the loot and the alarm meter.
import { STEP } from './config.js';
import { tileCenter } from './heists.js';
import { SCREEN_CAUGHT, SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function placePlayer(world, col, row, facing) {
  const [x, y] = tileCenter(col, row);
  world.state.player.x = x;
  world.state.player.y = y;
  world.state.player.facing = facing ?? 0;
}

function placeGuard(world, index, col, row, facing) {
  const [x, y] = tileCenter(col, row);
  const g = world.state.guards[index];
  g.x = x; g.y = y; g.facing = facing ?? 0; g.mode = 'patrol';
}

function settle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, null, null);
}

export function stageShot(name, world) {
  if (name === 'title') return stageTitleShot(world);
  if (name === 'escaped') {
    world.loadHeist(0);
    world.state.loot = 650;
    world.state.totalLoot = 650;
    world.state.totalTime = 42;
    world.state.heistsDone = 1;
    world.state.timesSpotted = 0;
    world.state.coinsGot = 4;
    world.state.vaultsGot = 1;
    world.state.complete = true;
    world.state.results[0] = {
      time: 42, spotted: 0, loot: 650, coins: 4, coinsTotal: 4,
      vaults: 1, vaultsTotal: 1, rank: 'GHOST',
    };
    return { screen: SCREEN_COMPLETE, best: 2450 };
  }
  if (name === 'smoke') {
    // Level 4, the Crimson Museum, mid-smoke: the thief stands in their own
    // smoke cloud while a guard stares at it — alarm 40, SUSPICIOUS.
    // Loot matches what is taken: 1 vault ($500) + 4 coins ($200) = $700.
    world.loadHeist(3);
    placePlayer(world, 20, 10, -1.5708);
    world.state.loot = 700;
    world.state.vaultsLeft[0].taken = true;
    world.state.coinsLeft[0].taken = true;
    world.state.coinsLeft[1].taken = true;
    world.state.coinsLeft[2].taken = true;
    world.state.coinsLeft[3].taken = true;
    const [sx, sy] = tileCenter(20, 10);
    world.state.smokeT = 5;
    world.state.smokeX = sx;
    world.state.smokeY = sy;
    world.state.alarm = 40;
    placeGuard(world, 1, 20, 12, -1.5708);
    placeGuard(world, 0, 12, 5, 0.4);
    settle(world, 0.5);
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'hide5') {
    // Level 5, the Obsidian Vault: the thief flat in the tall grass while a
    // guard patrols past — alarm 8, CLEAR, status HIDDEN.
    world.loadHeist(4);
    placePlayer(world, 4, 4, 0.8);
    world.state.loot = 100;
    world.state.coinsLeft[0].taken = true;
    world.state.coinsLeft[1].taken = true;
    world.state.alarm = 8;
    placeGuard(world, 0, 10, 5, 3.1416);
    placeGuard(world, 1, 18, 12, 0);
    settle(world, 0.6);
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'escaped4') {
    // The ESCAPED report card after level 4: levels 1–3 already escaped, so
    // the campaign list shows four done nights and level 5 still locked.
    world.loadHeist(3);
    world.state.loot = 1800;
    world.state.totalLoot = 5050;
    world.state.totalTime = 166;
    world.state.heistsDone = 4;
    world.state.timesSpotted = 0;
    world.state.coinsGot = 6;
    world.state.vaultsGot = 3;
    world.state.complete = true;
    world.state.results[0] = { time: 30, spotted: 0, loot: 700, coins: 4, coinsTotal: 4, vaults: 1, vaultsTotal: 1, rank: 'GHOST' };
    world.state.results[1] = { time: 32, spotted: 0, loot: 1250, coins: 5, coinsTotal: 5, vaults: 2, vaultsTotal: 2, rank: 'GHOST' };
    world.state.results[2] = { time: 46, spotted: 1, loot: 1300, coins: 6, coinsTotal: 6, vaults: 2, vaultsTotal: 2, rank: 'SHADOW' };
    world.state.results[3] = { time: 58, spotted: 0, loot: 1800, coins: 6, coinsTotal: 6, vaults: 3, vaultsTotal: 3, rank: 'GHOST' };
    return { screen: SCREEN_COMPLETE, best: 5050 };
  }
  if (name === 'alarm') {
    world.loadHeist(3);
    placePlayer(world, 26, 15, -0.6);
    world.state.loot = 1300;
    world.state.coinsLeft.forEach((c) => { c.taken = true; });
    world.state.vaultsLeft[0].taken = true;
    world.state.vaultsLeft[1].taken = true;
    placeGuard(world, 0, 24, 13, 2.2);
    placeGuard(world, 1, 20, 16, -0.4);
    world.state.guards[0].mode = 'chase';
    world.state.guards[0].chaseT = 3;
    world.state.guards[0].lastX = world.state.player.x;
    world.state.guards[0].lastY = world.state.player.y;
    world.state.alarm = 78;
    settle(world, 0.4);
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'hide') {
    world.loadHeist(0);
    placePlayer(world, 4, 3, 0.8);
    placeGuard(world, 0, 12, 4, 3.1416);
    placeGuard(world, 1, 24, 14, 3.1416);
    world.state.alarm = 12;
    world.state.loot = 150;
    world.state.coinsLeft[0].taken = true;
    world.state.coinsLeft[1].taken = true;
    world.state.coinsLeft[2].taken = true;
    settle(world, 0.6);
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'vault') {
    world.loadHeist(4);
    placePlayer(world, 28, 6, 3.1416);
    world.state.loot = 1500;
    world.state.vaultsLeft.forEach((v) => { v.taken = true; });
    world.state.exitOpen = true;
    placeGuard(world, 0, 11, 4, 0.3);
    placeGuard(world, 2, 25, 4, 2.6);
    placeGuard(world, 4, 13, 16, -1.2);
    world.state.alarm = 22;
    settle(world, 0.3);
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  // cover: the casino, sonar live, dotted patrol routes on show.
  // Loot matches what is taken: 1 vault ($500) + 4 coins ($200) = $700.
  world.loadHeist(2);
  placePlayer(world, 20, 11, 0.4);
  world.state.loot = 700;
  world.state.vaultsLeft[1].taken = true;
  world.state.coinsLeft[0].taken = true;
  world.state.coinsLeft[2].taken = true;
  world.state.coinsLeft[3].taken = true;
  world.state.coinsLeft[4].taken = true;
  world.state.sonarT = 4.2;
  world.state.sonarCharges = 1;
  world.state.alarm = 34;
  placeGuard(world, 0, 13, 5, 1.2);
  placeGuard(world, 1, 22, 12, -2.0);
  placeGuard(world, 2, 6, 11, 0.5);
  settle(world, 0.5);
  return { screen: SCREEN_PLAY, best: 2450 };
}

export function stageTitleShot(world) {
  world.loadHeist(0);
  settle(world, 2);
  return { screen: SCREEN_TITLE, best: 2450 };
}
export { SCREEN_CAUGHT, SCREEN_COMPLETE };
