// player.js — the player's light-skiff: movement, dash, hull and shield,
// blaster timing, and the neon arrow-ship rendering. The skiff records its
// path into the Wake every frame (see wake.js).

export const PLAYER_RADIUS = 14;
export const PLAYER_MAX_HULL = 100;
export const PLAYER_MAX_SHIELD = 50;
const PLAYER_SPEED = 315;
const DASH_SPEED = 880;
const DASH_TIME = 0.16;
export const DASH_COOLDOWN = 1.4;
const BASE_FIRE_INTERVAL = 0.145;
const RAPID_FIRE_INTERVAL = 0.07;
const RAPID_DURATION = 8;

export class Player {
  constructor(x, y) {
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // nose direction (movement facing)
    this.aimAngle = -Math.PI / 2;
    this.hull = PLAYER_MAX_HULL;
    this.shield = 0;
    this.fireTimer = 0;
    this.rapidTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this.invulnTimer = 0;
    this.dead = false;
  }

  get alive() { return !this.dead; }
  get rapidActive() { return this.rapidTimer > 0; }
  get fireInterval() { return this.rapidActive ? RAPID_FIRE_INTERVAL : BASE_FIRE_INTERVAL; }
  get dashReady() { return this.dashCooldown <= 0; }

  grantShield() { this.shield = PLAYER_MAX_SHIELD; }
  grantRapid() { this.rapidTimer = RAPID_DURATION; }

  // Returns 'dash' when a dash starts so game.js can play the sound.
  update(dt, move, aimX, aimY, wantDash, bounds) {
    this.aimAngle = Math.atan2(aimY - this.y, aimX - this.x);
    this.fireTimer -= dt;
    this.rapidTimer = Math.max(0, this.rapidTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    let event = null;
    if (wantDash && this.dashReady && (move.x !== 0 || move.y !== 0)) {
      this.dashTimer = DASH_TIME;
      this.dashCooldown = DASH_COOLDOWN;
      this.dashDirX = move.x;
      this.dashDirY = move.y;
      event = 'dash';
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * DASH_SPEED;
      this.vy = this.dashDirY * DASH_SPEED;
    } else {
      const accel = 2400;
      this.vx += move.x * accel * dt;
      this.vy += move.y * accel * dt;
      const damp = Math.pow(0.0015, dt); // strong glide damping
      this.vx *= damp;
      this.vy *= damp;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > PLAYER_SPEED) {
        this.vx = (this.vx / speed) * PLAYER_SPEED;
        this.vy = (this.vy / speed) * PLAYER_SPEED;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(PLAYER_RADIUS, Math.min(bounds.width - PLAYER_RADIUS, this.x));
    this.y = Math.max(PLAYER_RADIUS, Math.min(bounds.height - PLAYER_RADIUS, this.y));

    if (Math.hypot(this.vx, this.vy) > 30) {
      this.angle = Math.atan2(this.vy, this.vx);
    }
    return event;
  }

  canFire() { return this.fireTimer <= 0 && this.alive; }

  markFired() { this.fireTimer = this.fireInterval; }

  muzzlePosition() {
    return {
      x: this.x + Math.cos(this.aimAngle) * (PLAYER_RADIUS + 6),
      y: this.y + Math.sin(this.aimAngle) * (PLAYER_RADIUS + 6),
    };
  }

  // Damage soaks into the shield first. Returns true if the hull was hit.
  takeDamage(amount) {
    if (this.invulnTimer > 0 || this.dead) return false;
    let hullHit = false;
    if (this.shield > 0) {
      const soaked = Math.min(this.shield, amount);
      this.shield -= soaked;
      amount -= soaked;
    }
    if (amount > 0) {
      this.hull -= amount;
      hullHit = true;
      this.invulnTimer = 0.45;
      if (this.hull <= 0) {
        this.hull = 0;
        this.dead = true;
      }
    }
    return hullHit;
  }

  draw(ctx, time) {
    if (this.dead) return;
    const flicker = this.invulnTimer > 0 && Math.sin(time * 40) > 0;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 5);
      ctx.strokeStyle = '#37f2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(this.aimAngle);
    ctx.globalAlpha = flicker ? 0.35 : 1;
    // Blaster barrel.
    ctx.strokeStyle = '#aefcff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(PLAYER_RADIUS + 7, 0);
    ctx.stroke();
    // Hull: sleek neon arrow.
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fillStyle = '#0b2b3d';
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Cockpit spark.
    ctx.fillStyle = '#e8feff';
    ctx.beginPath();
    ctx.arc(3, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
