// wake.js — the signature mechanic: the skiff's fading energy wake.
// Every frame the player's recent positions form a ribbon of segments.
// Each segment lives a few seconds, shrinking and dimming as it ages, and
// any enemy touching a live segment takes damage — kite the horde through
// your own light trail and it melts.

export const WAKE_LIFETIME = 3.6;      // seconds a segment stays dangerous
export const WAKE_WIDTH = 20;          // ribbon width in px
export const WAKE_DAMAGE_PER_SECOND = 60;
const MAX_POINTS = 260;

export class Wake {
  constructor() {
    this.points = []; // { x, y, age } oldest first
  }

  reset() { this.points.length = 0; }

  record(x, y) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 7) return;
    this.points.push({ x, y, age: 0 });
    if (this.points.length > MAX_POINTS) this.points.shift();
  }

  update(dt) {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[0].age > WAKE_LIFETIME) this.points.shift();
  }

  // Damage an enemy standing on the ribbon; returns damage dealt this tick.
  damageAt(x, y, radius) {
    const reach = radius + WAKE_WIDTH / 2;
    let hot = false;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      if (Math.max(a.age, b.age) > WAKE_LIFETIME) continue;
      if (distanceToSegment(x, y, a, b) < reach) { hot = true; break; }
    }
    return hot ? WAKE_DAMAGE_PER_SECOND : 0;
  }

  draw(ctx) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Drawn oldest-to-newest in three passes: wide faint glow, core, spark.
    for (const pass of [
      { width: WAKE_WIDTH, alpha: 0.10, color: '0, 229, 255' },
      { width: WAKE_WIDTH * 0.5, alpha: 0.22, color: '0, 229, 255' },
      { width: 3, alpha: 0.55, color: '160, 250, 255' },
    ]) {
      for (let i = 1; i < this.points.length; i++) {
        const a = this.points[i - 1];
        const b = this.points[i];
        const life = 1 - Math.max(a.age, b.age) / WAKE_LIFETIME;
        if (life <= 0) continue;
        ctx.strokeStyle = `rgba(${pass.color}, ${(pass.alpha * life).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, pass.width * (0.35 + 0.65 * life));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}
