// VAULTBREAK — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between six
// screens: title, play, paused, caught, heist complete and campaign complete.
//
// ?seed=N fixes nothing random (the game is fully deterministic) but is kept
// for the shot URLs. ?shot=cover|alarm|hide|vault (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_BOMB, EVENT_CAUGHT, EVENT_COMPLETE } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_DECOY, ACTION_MENU, ACTION_PAUSE, ACTION_RESTART, ACTION_SMOKE, ACTION_SONAR,
  createInput,
} from './input.js';
import {
  createRenderer, SCREEN_BOMB, SCREEN_CAUGHT, SCREEN_CAMPAIGN, SCREEN_COMPLETE, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';
import { createAutopilot } from './autopilot.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autoplayHeist = Number.parseInt(params.get('autoplay') ?? '', 10);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best night then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const pilot = Number.isInteger(autoplayHeist) ? createAutopilot(world) : null;
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startHeist(index) {
    world.loadHeist(index);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Heist ' + (index + 1) + ' of 5. Crack every vault, then run for the exit.');
  }

  function retryHeist() {
    startHeist(world.state.heistIndex);
  }

  function afterComplete() {
    if (world.state.totalLoot > best) {
      best = world.state.totalLoot;
      saveBest(best);
    }
    if (world.nextHeist()) {
      screen = SCREEN_PLAY;
      announce('Next heist.');
    } else {
      screen = SCREEN_CAMPAIGN;
      announce('The night is yours. Total loot $' + world.state.totalLoot + '.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & 64) startHeist(0);
      else if (actions & 128) startHeist(1);
      else if (actions & 256) startHeist(2);
      else if (actions & 512) startHeist(3);
      else if (actions & 1024) startHeist(4);
      else if (actions & ACTION_CONFIRM) startHeist(0);
      return;
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT || screen === SCREEN_BOMB)) {
      retryHeist();
      return;
    }
    if ((screen === SCREEN_CAUGHT || screen === SCREEN_BOMB) && (actions & ACTION_CONFIRM)) { retryHeist(); return; }
    if (screen === SCREEN_COMPLETE && (actions & ACTION_RESTART)) { retryHeist(); return; }
    if (screen === SCREEN_COMPLETE && (actions & ACTION_CONFIRM)) { afterComplete(); return; }
    if ((screen === SCREEN_COMPLETE || screen === SCREEN_CAMPAIGN) && (actions & ACTION_MENU)) {
      screen = SCREEN_TITLE;
      announce('Vaultbreak. Five heists, one night. Press Space or click to start.');
      return;
    }
    if (screen === SCREEN_CAMPAIGN && (actions & ACTION_CONFIRM)) {
      world.resetAll();
      screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function toolFrom(actions) {
    if (actions & ACTION_SMOKE) return 'smoke';
    if (actions & ACTION_DECOY) return 'decoy';
    if (actions & ACTION_DASH) return 'dash';
    if (actions & ACTION_SONAR) return 'sonar';
    return null;
  }

  function step(actions) {
    const tool = toolFrom(actions);
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      return;
    }
    if (actions & ACTION_RESTART) {
      retryHeist();
      return;
    }
    // Autoplay (verification only, ?autoplay=N): the autopilot drives and the
    // result lands on window.__autoplayDone for the test harness to read.
    if (pilot) {
      const decision = pilot.decide(world.state, STEP);
      if (decision) {
        const events = world.step(STEP, decision.move, decision.tool);
        if (events & EVENT_CAUGHT) {
          screen = SCREEN_CAUGHT;
          window.__autoplayDone = { heist: autoplayHeist + 1, result: 'caught', time: Math.round(world.state.time), loot: world.state.loot, alarm: Math.round(world.state.alarm) };
        } else if (events & EVENT_BOMB) {
          screen = SCREEN_BOMB;
          window.__autoplayDone = { heist: autoplayHeist + 1, result: 'bombed', time: Math.round(world.state.time), loot: world.state.loot, alarm: Math.round(world.state.alarm) };
        } else if (events & EVENT_COMPLETE) {
          screen = SCREEN_COMPLETE;
          window.__autoplayDone = { heist: autoplayHeist + 1, result: 'complete', time: Math.round(world.state.time), loot: world.state.loot, alarm: Math.round(world.state.alarm) };
        } else if (world.state.time > 240) {
          window.__autoplayDone = { heist: autoplayHeist + 1, result: 'timeout', time: Math.round(world.state.time), loot: world.state.loot, alarm: Math.round(world.state.alarm) };
        }
        return;
      }
    }
    const click = input.takeClickTarget();
    if (click) {
      // The arena is fitted into the left area under the top bar, so a click
      // is converted through the arena's own rectangle, not the whole window.
      const rect = renderer.fieldRect();
      world.setClickGoal({ x: (click.x - rect.x) / rect.scale, y: (click.y - rect.y) / rect.scale });
    }
    const events = world.step(STEP, input.keys(), tool);
    if (events & EVENT_CAUGHT) {
      screen = SCREEN_CAUGHT;
      announce('Busted. The alarm hit 100 or a guard caught you. Press Space to retry.');
    } else if (events & EVENT_BOMB) {
      screen = SCREEN_BOMB;
      announce('Blown up. You stepped on a bomb. Press Space to retry.');
    } else if (events & EVENT_COMPLETE) {
      screen = SCREEN_COMPLETE;
      announce('Heist complete. Loot $' + world.state.loot + '. Press Space to continue.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Title-screen heist keys and confirm are handled here so a tap between
    // frames is never lost; play-screen actions are taken once per frame and
    // handed to the first step, so restart and pause cannot be eaten by a step.
    if (screen !== SCREEN_PLAY) handleActions();
    if (screen === SCREEN_PLAY) {
      const actions = input.takeActions();
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vaultbreak. Five heists, one night. Press Space or click to start.');
  if (pilot) startHeist(autoplayHeist);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
