// enemies.js — the geometric horde. Three regular kinds plus the boss:
//   chaser   — magenta triangle that hunts the player and bites on contact
//   shooter  — violet orb that keeps its distance and fires plasma orbs
//   splitter — green blob that bursts into two fast mini-chasers on death
//   boss     — a huge rotating octagon every 5 waves: radial orb bursts,
//              aimed spreads and chaser escorts; big health bar in the HUD.

export const ENEMY_STATS = {
  chaser: { hp: 30, speed: 132, radius: 15, score: 100, contactDamage: 12, color: '#ff2e88' },
  mini: { hp: 14, speed: 205, radius: 10, score: 50, contactDamage: 8, color: '#ff7ab8' },
  shooter: { hp: 42, speed: 96, radius: 16, score: 150, contactDamage: 10, color: '#b26bff' },
  splitter: { hp: 64, speed: 62, radius: 21, score: 200, contactDamage: 14, color: '#3dff7c' },
  boss: { hp: 900, speed: 44, radius: 64, score: 2000, contactDamage: 25, color: '#ff4747' },
};

let nextEnemyId = 1;

export function createEnemy(kind, x, y, wave, rng) {
  const stats = ENEMY_STATS[kind];
  const hpScale = 1 + (wave - 1) * 0.12;
  return {
    id: nextEnemyId++,
    kind, x, y,
    vx: 0, vy: 0,
    hp: Math.round(stats.hp * (kind === 'boss' ? 1 + (wave / 5 - 1) * 0.6 : hpScale)),
    maxHp: Math.round(stats.hp * (kind === 'boss' ? 1 + (wave / 5 - 1) * 0.6 : hpScale)),
    speed: stats.speed * rng.range(0.9, 1.1),
    radius: stats.radius,
    score: stats.score,
    contactDamage: stats.contactDamage,
    color: stats.color,
    angle: rng.angle(),
    spin: rng.range(-1.4, 1.4),
    fireTimer: rng.range(1.2, 2.6),
    burstTimer: rng.range(2.0, 3.2),
    strafeDir: rng.chance(0.5) ? 1 : -1,
    wobbleSeed: rng.range(0, Math.PI * 2),
    flashTimer: 0,
    contactCooldown: 0,
    touchWake: false,
  };
}

export function spawnPosition(rng, bounds, player) {
  // Spawn on an arena edge, at least 260px away from the player.
  for (let tries = 0; tries < 12; tries++) {
    const edge = rng.int(0, 3);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = rng.range(30, bounds.width - 30); y = 30; }
    if (edge === 1) { x = rng.range(30, bounds.width - 30); y = bounds.height - 30; }
    if (edge === 2) { x = 30; y = rng.range(30, bounds.height - 30); }
    if (edge === 3) { x = bounds.width - 30; y = rng.range(30, bounds.height - 30); }
    if (Math.hypot(x - player.x, y - player.y) > 260) return { x, y };
  }
  return { x: 40, y: 40 };
}

// Steer one enemy for this tick. Returns 'shoot' requests via outbox:
// { type: 'orb', x, y, angle } or { type: 'radial', x, y, count }.
export function updateEnemy(enemy, dt, player, time, outbox) {
  enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
  enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
  enemy.angle += enemy.spin * dt * (enemy.kind === 'boss' ? 0.4 : 1);
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let moveX = ux;
  let moveY = uy;

  if (enemy.kind === 'shooter') {
    // Hold a firing ring around the player and strafe sideways.
    if (dist < 220) { moveX = -ux; moveY = -uy; }
    else if (dist < 300) { moveX = 0; moveY = 0; }
    moveX += -uy * enemy.strafeDir * 0.7;
    moveY += ux * enemy.strafeDir * 0.7;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 460 && player.alive) {
      enemy.fireTimer = 2.3;
      outbox.push({ type: 'orb', x: enemy.x, y: enemy.y, angle: Math.atan2(dy, dx) });
    }
  }

  if (enemy.kind === 'splitter') {
    const wobble = Math.sin(time * 2.2 + enemy.wobbleSeed) * 0.35;
    moveX = ux * Math.cos(wobble) - uy * Math.sin(wobble);
    moveY = ux * Math.sin(wobble) + uy * Math.cos(wobble);
  }

  if (enemy.kind === 'boss') {
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && player.alive) {
      enemy.fireTimer = 1.6;
      const base = Math.atan2(dy, dx);
      for (const off of [-0.22, 0, 0.22]) {
        outbox.push({ type: 'orb', x: enemy.x, y: enemy.y, angle: base + off, speed: 265 });
      }
    }
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = 3.4;
      outbox.push({ type: 'radial', x: enemy.x, y: enemy.y, count: 14 });
    }
  }

  const len = Math.hypot(moveX, moveY) || 1;
  enemy.vx = (moveX / len) * enemy.speed;
  enemy.vy = (moveY / len) * enemy.speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.max(enemy.radius, Math.min(1280 - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(720 - enemy.radius, enemy.y));
}

export function drawEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const flash = enemy.flashTimer > 0;
  const stroke = flash ? '#ffffff' : enemy.color;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = flash ? 'rgba(255,255,255,0.5)' : hexToRgba(enemy.color, 0.16);
  ctx.lineWidth = 2;

  if (enemy.kind === 'chaser' || enemy.kind === 'mini') {
    ctx.rotate(enemy.angle);
    const r = enemy.radius;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, -r * 0.75);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.8, r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (enemy.kind === 'shooter') {
    const pulse = 1 + Math.sin(time * 4 + enemy.wobbleSeed) * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    const squish = 1 + Math.sin(time * 3 + enemy.wobbleSeed) * 0.1;
    ctx.scale(squish, 1 / squish);
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-6, -4, 4, 0, Math.PI * 2);
    ctx.arc(7, 5, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (enemy.kind === 'boss') {
    ctx.rotate(enemy.angle);
    polygon(ctx, 8, enemy.radius);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-enemy.angle * 2.2);
    polygon(ctx, 8, enemy.radius * 0.66);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.3 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 71, 71, 0.55)';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Mini health tick for damaged non-boss enemies.
  if (enemy.kind !== 'boss' && enemy.hp < enemy.maxHp) {
    const w = enemy.radius * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 9, w, 3);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 9, w * (enemy.hp / enemy.maxHp), 3);
    ctx.restore();
  }
}

function polygon(ctx, sides, radius) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
