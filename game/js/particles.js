// particles.js — pooled particle bursts: explosion sparks, dash ghosts,
// pickup glints and engine spray. Particles are plain data updated in one
// pass and drawn as additive neon strokes/dots.

const MAX_PARTICLES = 900;

export class ParticleField {
  constructor(rng) {
    this.rng = rng;
    this.particles = [];
  }

  reset() { this.particles.length = 0; }

  spawn(x, y, vx, vy, life, size, color, drag = 2.2) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, drag });
  }

  explosion(x, y, color, count = 22, power = 260) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.angle();
      const speed = this.rng.range(power * 0.2, power);
      this.spawn(
        x, y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        this.rng.range(0.3, 0.85), this.rng.range(1.5, 3.5), color,
      );
    }
    // A few slow embers for body.
    for (let i = 0; i < Math.floor(count / 3); i++) {
      const a = this.rng.angle();
      const speed = this.rng.range(20, 80);
      this.spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed,
        this.rng.range(0.6, 1.2), this.rng.range(3, 5), color, 1.2);
    }
  }

  spray(x, y, angle, color) {
    const a = angle + this.rng.range(-0.3, 0.3);
    const speed = this.rng.range(60, 140);
    this.spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed,
      this.rng.range(0.15, 0.35), this.rng.range(1, 2.2), color, 3);
  }

  glint(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.spawn(x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.35, 2, color, 2.5);
    }
  }

  update(dt) {
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
