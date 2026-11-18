// main.js — NEONWAKE bootstrap.
// Normal mode: wire input + sound + game and run the render loop.
// Screenshot mode (?shot=title|play|boss|over&seed=<n>): build one exact
// deterministic scene with a seeded RNG and fixed simulation steps, draw a
// single frame, then set window.__shotReady = true. No audio, no timers,
// no wall-clock anywhere in that path.

import { Game } from './game.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { createRng, hashSeed } from './rng.js';

const SHOT_SCENES = ['title', 'play', 'boss', 'over'];
const DEFAULT_SEED = 20261118;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot');

function seedFromParam(raw) {
  if (raw === null || raw === '') return DEFAULT_SEED;
  const asNumber = Number(raw);
  return Number.isNaN(asNumber) ? hashSeed(raw) : asNumber >>> 0;
}

if (shotScene) {
  // The page hint strip sits below the canvas and lands half-clipped at
  // the bottom edge of screenshot captures; hide it in shot mode. The
  // title screen already lists the controls mid-canvas.
  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';
  const scene = SHOT_SCENES.includes(shotScene) ? shotScene : 'title';
  const game = new Game(ctx, null, null, createRng(seedFromParam(params.get('seed'))));
  game.setupShotScene(scene);
  window.__shotReady = true;
} else {
  const sound = new SoundEngine();
  let game = null;
  const input = new Input(canvas, {
    onPress: () => sound.unlock(),
    onClick: () => {
      sound.unlock();
      if (game) game.handlePress();
    },
    onPause: () => { if (game) game.togglePause(); },
    onRestart: () => { if (game) game.handleRestart(); },
    onConfirm: () => {
      sound.unlock();
      if (game) game.handleConfirm();
    },
  });
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  game = new Game(ctx, input, sound, createRng(seed));

  let lastTimestamp = performance.now();
  function frame(timestamp) {
    requestAnimationFrame(frame);
    let dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    if (dt > 0.1) dt = 0.1; // tab-switch clamp; gameplay uses dt throughout
    if (dt > 0) {
      game.update(dt);
      game.render();
    }
  }
  requestAnimationFrame(frame);
}
