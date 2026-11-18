// shots.js — projectiles for both sides: the player's blaster bolts and
// enemy plasma orbs. One pooled list, owner flag decides who it can hit.

export const PLAYER_BOLT_SPEED = 760;
export const ENEMY_ORB_SPEED = 235;

export class ShotField {
  constructor() {
    this.shots = []; // { x, y, vx, vy, radius, damage, fromPlayer, color, life }
  }

  reset() { this.shots.length = 0; }

  firePlayerBolt(x, y, angle) {
    this.shots.push({
      x, y,
      vx: Math.cos(angle) * PLAYER_BOLT_SPEED,
      vy: Math.sin(angle) * PLAYER_BOLT_SPEED,
      radius: 4, damage: 13, fromPlayer: true, color: '#aefcff', life: 1.1,
    });
  }

  fireEnemyOrb(x, y, angle, speed = ENEMY_ORB_SPEED, damage = 10) {
    this.shots.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 6, damage, fromPlayer: false, color: '#ff5df2', life: 4.5,
    });
  }

  // Advance shots; `bounds` culls anything that leaves the arena.
  update(dt, bounds) {
    const list = this.shots;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < -20 || s.y < -20 ||
          s.x > bounds.width + 20 || s.y > bounds.height + 20) {
        list.splice(i, 1);
      }
    }
  }

  removeAt(index) { this.shots.splice(index, 1); }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shots) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.fromPlayer ? 3 : 2;
      if (s.fromPlayer) {
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius + 2.5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius - 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
