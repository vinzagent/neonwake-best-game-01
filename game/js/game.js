// game.js — NEONWAKE orchestration: states (title demo, playing, paused,
// game over, victory, endless), wave spawning, collisions, scoring, and
// the deterministic ?shot= scene setups used for screenshots.

import { Player, PLAYER_RADIUS, DASH_COOLDOWN } from './player.js';
import { Wake } from './wake.js';
import { ParticleField } from './particles.js';
import { ShotField } from './shots.js';
import { PickupField, PICKUP_KINDS } from './pickups.js';
import { createEnemy, spawnPosition, updateEnemy, drawEnemy } from './enemies.js';
import {
  drawBackground, makeStars, drawHud,
  drawTitleScreen, drawPauseScreen, drawGameOverScreen, drawVictoryScreen,
} from './hud.js';

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;
export const FINAL_WAVE = 10;
const BEST_SCORE_KEY = 'neonwake-best-score';
const STEP = 1 / 60;

export class Game {
  constructor(ctx, input, sound, rng) {
    this.ctx = ctx;
    this.input = input;
    this.sound = sound;
    this.rng = rng;
    this.bounds = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
    this.state = 'title';
    this.bestScore = loadBestScore();
    this.time = 0;
    this.shake = 0;
    this.resetWorld();
    this.beginDemoWorld();
  }

  // ---- world setup -------------------------------------------------------

  resetWorld() {
    this.player = new Player(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    this.wake = new Wake();
    this.particles = new ParticleField(this.rng);
    this.shots = new ShotField();
    this.pickups = new PickupField(this.rng);
    this.enemies = [];
    this.stars = makeStars(this.rng, ARENA_WIDTH, ARENA_HEIGHT);
    this.score = 0;
    this.kills = 0;
    this.wave = 1;
    this.elapsed = 0;
    this.endless = false;
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.waveBreakTimer = 0;
    this.bannerText = '';
    this.bannerSub = '';
    this.bannerTimer = 0;
    this.shake = 0;
  }

  beginDemoWorld() {
    const kinds = ['chaser', 'shooter', 'splitter', 'chaser', 'chaser', 'shooter', 'mini'];
    for (const kind of kinds) {
      const pos = spawnPosition(this.rng, this.bounds, this.player);
      this.enemies.push(createEnemy(kind, pos.x, pos.y, 1, this.rng));
    }
  }

  startRun() {
    this.resetWorld();
    this.state = 'playing';
    this.startWave(1);
    if (this.sound) this.sound.startBassLoop();
  }

  continueEndless() {
    this.endless = true;
    this.state = 'playing';
    this.player.dead = false;
    this.player.hull = Math.max(this.player.hull, 60);
    this.startWave(this.wave + 1);
    if (this.sound) this.sound.startBassLoop();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      if (this.sound) this.sound.stopBassLoop();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      if (this.sound) this.sound.startBassLoop();
    }
  }

  handleConfirm() {
    if (this.state === 'title') this.startRun();
    else if (this.state === 'victory') this.continueEndless();
  }

  handlePress() {
    if (this.state === 'title') this.startRun();
    else if (this.state === 'over') this.startRun();
    else if (this.state === 'victory') this.continueEndless();
  }

  handleRestart() {
    if (this.state === 'over' || this.state === 'paused' || this.state === 'victory') {
      this.startRun();
    }
  }

  // ---- waves ---------------------------------------------------------------

  startWave(n) {
    this.wave = n;
    this.pendingSpawns = waveComposition(n, this.rng);
    this.spawnTimer = 0.4;
    this.bannerText = n % 5 === 0 ? `WAVE ${n} — DREADNOUGHT` : `WAVE ${n}`;
    this.bannerSub = n === 1 ? 'Keep moving. Your wake is a weapon.' :
      n === FINAL_WAVE && !this.endless ? 'Final wave. Hold the line!' : '';
    this.bannerTimer = 2.2;
  }

  hostilesLeft() {
    return this.pendingSpawns.length + this.enemies.length;
  }

  dashChargeRatio() {
    return this.player.dashReady ? 1 : 1 - this.player.dashCooldown / DASH_COOLDOWN;
  }

  runStats() {
    return {
      score: this.score,
      bestScore: this.bestScore,
      wave: this.wave,
      kills: this.kills,
      elapsed: this.elapsed,
    };
  }

  // ---- main update -----------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    if (this.state === 'title') {
      this.updateWorld(dt, true);
    } else if (this.state === 'playing') {
      this.elapsed += dt;
      this.updateWorld(dt, false);
    } else if (this.state === 'over' || this.state === 'victory') {
      this.particles.update(dt);
      this.wake.update(dt);
    }
    // 'paused' freezes the world completely.
  }

  updateWorld(dt, demo) {
    const player = this.player;

    // --- control: human input or the title-screen demo pilot.
    let move;
    let aimX;
    let aimY;
    let firing;
    let dashing;
    if (demo) {
      const ai = demoPilot(this, dt);
      move = ai.move; aimX = ai.aimX; aimY = ai.aimY; firing = ai.firing; dashing = ai.dashing;
    } else {
      move = this.input.moveVector();
      aimX = this.input.mouseX;
      aimY = this.input.mouseY;
      firing = this.input.firing;
      dashing = this.input.dashing;
    }
    const event = player.update(dt, move, aimX, aimY, dashing, this.bounds);
    if (event === 'dash' && this.sound) this.sound.dash();
    if (Math.hypot(player.vx, player.vy) > 40) {
      this.particles.spray(player.x - Math.cos(player.angle) * 14,
        player.y - Math.sin(player.angle) * 14, player.angle + Math.PI, '#1d7f99');
    }

    // --- wake.
    this.wake.record(player.x, player.y);
    this.wake.update(dt);

    // --- firing.
    if (firing && player.canFire()) {
      player.markFired();
      const muzzle = player.muzzlePosition();
      this.shots.firePlayerBolt(muzzle.x, muzzle.y, player.aimAngle);
      if (this.sound && !demo) this.sound.shoot();
    }

    // --- spawning.
    if (!demo) this.updateSpawning(dt);
    else this.updateDemoSpawning();

    // --- enemies.
    const outbox = [];
    for (const enemy of this.enemies) updateEnemy(enemy, dt, player, this.time, outbox);
    for (const req of outbox) {
      if (req.type === 'orb') {
        this.shots.fireEnemyOrb(req.x, req.y, req.angle, req.speed || undefined);
        if (this.sound && !demo) this.sound.enemyShoot();
      } else if (req.type === 'radial') {
        for (let i = 0; i < req.count; i++) {
          this.shots.fireEnemyOrb(req.x, req.y, (i / req.count) * Math.PI * 2, 190);
        }
      }
    }
    separateEnemies(this.enemies);

    // --- wake damage (the twist: your trail is a weapon).
    for (const enemy of this.enemies) {
      const dps = this.wake.damageAt(enemy.x, enemy.y, enemy.radius);
      enemy.touchWake = dps > 0;
      if (dps > 0) hurtEnemy(this, enemy, dps * dt, true);
    }
    reapDeadEnemies(this, demo);

    // --- shots & collisions.
    this.shots.update(dt, this.bounds);
    this.collideShots(demo);

    // --- contact damage.
    if (!demo && player.alive) {
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist < enemy.radius + PLAYER_RADIUS && enemy.contactCooldown <= 0) {
          enemy.contactCooldown = 0.8;
          this.damagePlayer(enemy.contactDamage);
        }
      }
    }

    // --- pickups.
    this.pickups.update(dt);
    if (!demo) {
      for (let i = this.pickups.items.length - 1; i >= 0; i--) {
        const item = this.pickups.items[i];
        if (Math.hypot(item.x - player.x, item.y - player.y) < PLAYER_RADIUS + 18) {
          this.applyPickup(item.kind);
          this.pickups.removeAt(i);
        }
      }
    }

    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 26);

    // --- wave flow.
    if (!demo && this.state === 'playing') {
      if (this.waveBreakTimer > 0) {
        this.waveBreakTimer -= dt;
        if (this.waveBreakTimer <= 0) this.startWave(this.wave + 1);
      } else if (this.hostilesLeft() === 0 && player.alive) {
        this.onWaveCleared();
      }
    }
  }

  updateSpawning(dt) {
    if (this.pendingSpawns.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.pendingSpawns[0] === 'boss' ? 0.1 : 0.65;
    const kind = this.pendingSpawns.shift();
    const pos = kind === 'boss'
      ? { x: ARENA_WIDTH / 2, y: 110 }
      : spawnPosition(this.rng, this.bounds, this.player);
    this.enemies.push(createEnemy(kind, pos.x, pos.y, this.wave, this.rng));
    this.particles.glint(pos.x, pos.y, '#ff2bd6');
  }

  updateDemoSpawning() {
    if (this.enemies.length >= 7) return;
    const kinds = ['chaser', 'shooter', 'splitter', 'mini'];
    const pos = spawnPosition(this.rng, this.bounds, this.player);
    this.enemies.push(createEnemy(this.rng.pick(kinds), pos.x, pos.y, 1, this.rng));
  }

  onWaveCleared() {
    if (this.sound) this.sound.waveClear();
    this.score += 250 + this.wave * 50;
    if (this.wave === FINAL_WAVE && !this.endless) {
      this.state = 'victory';
      this.commitBestScore();
      if (this.sound) this.sound.stopBassLoop();
      return;
    }
    this.bannerText = `WAVE ${this.wave} CLEAR`;
    this.bannerSub = 'Hull +10';
    this.bannerTimer = 1.8;
    this.player.hull = Math.min(100, this.player.hull + 10);
    this.waveBreakTimer = 2.0;
  }

  collideShots(demo) {
    const player = this.player;
    for (let i = this.shots.shots.length - 1; i >= 0; i--) {
      const shot = this.shots.shots[i];
      if (shot.fromPlayer) {
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0) continue;
          if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < shot.radius + enemy.radius) {
            hurtEnemy(this, enemy, shot.damage, false);
            this.particles.spray(shot.x, shot.y, Math.atan2(shot.vy, shot.vx), enemy.color);
            this.shots.removeAt(i);
            break;
          }
        }
      } else if (!demo && player.alive) {
        if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.radius + PLAYER_RADIUS) {
          this.damagePlayer(shot.damage);
          this.shots.removeAt(i);
        }
      }
    }
    reapDeadEnemies(this, demo);
  }

  applyPickup(kind) {
    if (kind === 'shield') this.player.grantShield();
    if (kind === 'rapid') this.player.grantRapid();
    this.particles.glint(this.player.x, this.player.y, PICKUP_KINDS[kind].color);
    this.bannerSub = `${PICKUP_KINDS[kind].name}!`;
    this.bannerTimer = Math.max(this.bannerTimer, 0.9);
    if (this.sound) this.sound.pickup();
  }

  damagePlayer(amount) {
    const hullHit = this.player.takeDamage(amount);
    if (hullHit) {
      this.shake = Math.min(14, this.shake + 7);
      this.particles.explosion(this.player.x, this.player.y, '#ff4747', 10, 180);
      if (this.sound) this.sound.playerHurt();
    } else if (this.player.shield > 0 || amount > 0) {
      this.particles.spray(this.player.x, this.player.y, this.rng.angle(), '#37f2ff');
    }
    if (this.player.dead) this.onPlayerDeath();
  }

  onPlayerDeath() {
    this.state = 'over';
    this.shake = 18;
    this.particles.explosion(this.player.x, this.player.y, '#00e5ff', 46, 340);
    this.particles.explosion(this.player.x, this.player.y, '#ff2bd6', 30, 240);
    this.commitBestScore();
    if (this.sound) {
      this.sound.explosion(true);
      this.sound.gameOver();
      this.sound.stopBassLoop();
    }
  }

  commitBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveBestScore(this.bestScore);
    }
  }

  // ---- rendering -------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(this.rng.range(-this.shake, this.shake) * 0.5,
        this.rng.range(-this.shake, this.shake) * 0.5);
    }
    drawBackground(ctx, ARENA_WIDTH, ARENA_HEIGHT, this.stars, this.time);
    this.pickups.draw(ctx, this.time);
    this.wake.draw(ctx);
    for (const enemy of this.enemies) drawEnemy(ctx, enemy, this.time);
    this.player.draw(ctx, this.time);
    this.shots.draw(ctx);
    this.particles.draw(ctx);
    ctx.restore();

    if (this.state === 'title') {
      drawTitleScreen(ctx, ARENA_WIDTH, ARENA_HEIGHT, this.time, this.bestScore);
    } else if (this.state === 'playing' || this.state === 'paused') {
      drawHud(ctx, this);
      if (this.state === 'paused') drawPauseScreen(ctx, ARENA_WIDTH, ARENA_HEIGHT);
    } else if (this.state === 'over') {
      drawHud(ctx, this);
      drawGameOverScreen(ctx, ARENA_WIDTH, ARENA_HEIGHT, this.runStats());
    } else if (this.state === 'victory') {
      drawVictoryScreen(ctx, ARENA_WIDTH, ARENA_HEIGHT, this.runStats());
    }
  }

  // ---- deterministic screenshot scenes ---------------------------------------
  // Sets up an exact scene from the seed, advances a fixed number of fixed
  // steps (never wall-clock), renders one frame. main.js then flags
  // window.__shotReady. No audio is touched here.

  setupShotScene(scene) {
    const scripted = {
      moveVector: () => ({ x: 0.94, y: 0.34 }),
      mouseX: 980, mouseY: 300, firing: true, dashing: false,
    };

    if (scene === 'title') {
      this.state = 'title';
      for (let i = 0; i < 170; i++) this.update(STEP);
      this.render();
      return;
    }

    if (scene === 'play' || scene === 'boss') {
      this.resetWorld();
      this.state = 'playing';
      this.input = scripted;
      this.wave = scene === 'boss' ? 5 : 4;
      this.score = scene === 'boss' ? 21400 : 12850;
      this.kills = scene === 'boss' ? 58 : 37;
      this.elapsed = scene === 'boss' ? 152 : 96;
      this.player.x = 400;
      this.player.y = 430;
      this.player.hull = scene === 'boss' ? 84 : 72;
      this.player.shield = 25;
      this.bannerText = '';
      this.bannerTimer = 0;
      if (scene === 'boss') {
        const boss = createEnemy('boss', 890, 290, 5, this.rng);
        boss.hp = Math.round(boss.maxHp * 0.58);
        this.enemies.push(boss);
        this.enemies.push(createEnemy('chaser', 1010, 520, 5, this.rng));
        this.enemies.push(createEnemy('chaser', 760, 140, 5, this.rng));
        this.enemies.push(createEnemy('mini', 1060, 180, 5, this.rng));
      } else {
        this.enemies.push(createEnemy('chaser', 830, 230, 4, this.rng));
        this.enemies.push(createEnemy('chaser', 950, 430, 4, this.rng));
        this.enemies.push(createEnemy('shooter', 1020, 170, 4, this.rng));
        this.enemies.push(createEnemy('splitter', 880, 560, 4, this.rng));
        this.enemies.push(createEnemy('mini', 720, 150, 4, this.rng));
        this.pickups.drop(620, 250, 'rapid');
      }
      for (let i = 0; i < 26; i++) this.update(STEP);
      // Guaranteed set dressing: one fresh explosion and crossing orbs.
      const foe = this.enemies[0];
      if (foe) this.particles.explosion(foe.x + 60, foe.y - 40, foe.color, 20, 250);
      this.shots.fireEnemyOrb(1050, 560, Math.PI * 0.92);
      this.shots.fireEnemyOrb(240, 160, Math.PI * 0.08);
      this.particles.update(STEP);
      this.render();
      return;
    }

    // 'over': a finished run — skiff wrecked on wave 7.
    this.resetWorld();
    this.state = 'playing';
    this.wave = 7;
    this.score = 23450;
    this.kills = 83;
    this.elapsed = 214;
    this.player.x = 620;
    this.player.y = 400;
    this.enemies.push(createEnemy('chaser', 850, 300, 7, this.rng));
    this.enemies.push(createEnemy('shooter', 380, 220, 7, this.rng));
    this.enemies.push(createEnemy('splitter', 920, 520, 7, this.rng));
    // Display-only best (never persisted from a screenshot scene).
    this.bestScore = Math.max(this.bestScore, this.score);
    this.player.hull = 0;
    this.player.dead = true;
    this.state = 'over';
    this.particles.explosion(this.player.x, this.player.y, '#00e5ff', 44, 330);
    this.particles.explosion(this.player.x, this.player.y, '#ff2bd6', 26, 220);
    for (let i = 0; i < 3; i++) this.particles.update(STEP);
    this.render();
  }
}

// ---- helpers -----------------------------------------------------------------

function hurtEnemy(game, enemy, damage, byWake) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  if (!byWake) {
    enemy.flashTimer = 0.07;
    if (game.sound) game.sound.hit();
  }
}

function reapDeadEnemies(game, demo) {
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (enemy.hp > 0) continue;
    game.enemies.splice(i, 1);
    game.kills += demo ? 0 : 1;
    game.score += demo ? 0 : enemy.score;
    const big = enemy.kind === 'boss';
    game.particles.explosion(enemy.x, enemy.y, enemy.color, big ? 70 : 24, big ? 380 : 260);
    if (big) game.shake = 16;
    else game.shake = Math.min(10, game.shake + 2.5);
    if (game.sound && !demo) game.sound.explosion(big);
    if (enemy.kind === 'splitter') {
      for (const off of [[-18, 0], [18, 0]]) {
        game.enemies.push(createEnemy('mini', enemy.x + off[0], enemy.y + off[1], game.wave, game.rng));
      }
    }
    if (!demo && game.rng.chance(big ? 1 : 0.16)) {
      game.pickups.drop(enemy.x, enemy.y, big ? 'shield' : undefined);
    }
  }
}

function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 2;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
  }
}

function waveComposition(wave, rng) {
  const list = [];
  if (wave % 5 === 0) list.push('boss');
  const chasers = 4 + wave + (wave % 5 === 0 ? 2 : 0);
  const shooters = wave >= 2 ? 1 + Math.floor(wave / 2) : 0;
  const splitters = wave >= 3 ? 1 + Math.floor((wave - 2) / 2) : 0;
  for (let i = 0; i < chasers; i++) list.push('chaser');
  for (let i = 0; i < shooters; i++) list.push('shooter');
  for (let i = 0; i < splitters; i++) list.push('splitter');
  // Seeded shuffle, boss stays first.
  const head = list.length && list[0] === 'boss' ? [list.shift()] : [];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return head.concat(list);
}

// Title-screen autopilot: orbit the arena, kite the nearest hostile and
// fire at it — the attract mode behind the title art.
function demoPilot(game, dt) {
  const player = game.player;
  const t = game.time;
  let moveX = Math.cos(t * 0.45) * 0.8;
  let moveY = Math.sin(t * 0.7) * 0.8;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of game.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestDist) { nearestDist = d; nearest = enemy; }
  }
  let aimX = player.x + Math.cos(t * 0.9) * 200;
  let aimY = player.y + Math.sin(t * 0.9) * 200;
  let firing = false;
  if (nearest) {
    aimX = nearest.x;
    aimY = nearest.y;
    firing = nearestDist < 500;
    const away = Math.atan2(player.y - nearest.y, player.x - nearest.x);
    if (nearestDist < 210) { moveX = Math.cos(away); moveY = Math.sin(away); }
    else if (nearestDist > 330) {
      moveX = -Math.cos(away); moveY = -Math.sin(away);
    } else {
      moveX = Math.cos(away + Math.PI / 2) * Math.sin(t * 0.8);
      moveY = Math.sin(away + Math.PI / 2) * Math.sin(t * 0.8);
    }
  }
  const len = Math.hypot(moveX, moveY) || 1;
  return {
    move: { x: moveX / len, y: moveY / len },
    aimX, aimY, firing,
    dashing: nearestDist < 90,
  };
}

function loadBestScore() {
  try {
    return parseInt(window.localStorage.getItem(BEST_SCORE_KEY), 10) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch (err) {
    // Storage unavailable (private mode etc.) — best score just won't persist.
  }
}
