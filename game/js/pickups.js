// pickups.js — floating power-ups dropped by destroyed enemies.
// 'shield' refills the player's shield cell; 'rapid' doubles the blaster
// rate for eight seconds. They bob, pulse, and expire after 12 seconds.

export const PICKUP_KINDS = {
  shield: { color: '#37f2ff', label: 'S', name: 'SHIELD' },
  rapid: { color: '#ffcf3f', label: 'R', name: 'RAPID FIRE' },
};
const PICKUP_LIFETIME = 12;

export class PickupField {
  constructor(rng) {
    this.rng = rng;
    this.items = []; // { x, y, kind, age }
  }

  reset() { this.items.length = 0; }

  drop(x, y, kind) {
    this.items.push({ x, y, kind: kind || (this.rng.chance(0.5) ? 'shield' : 'rapid'), age: 0 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].age += dt;
      if (this.items[i].age > PICKUP_LIFETIME) this.items.splice(i, 1);
    }
  }

  removeAt(index) { this.items.splice(index, 1); }

  draw(ctx, time) {
    for (const item of this.items) {
      const spec = PICKUP_KINDS[item.kind];
      const bob = Math.sin(time * 3 + item.x * 0.05) * 3;
      const blink = item.age > PICKUP_LIFETIME - 3 && Math.sin(time * 10) > 0;
      if (blink) continue;
      const y = item.y + bob;
      ctx.save();
      ctx.translate(item.x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = spec.color;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = spec.color;
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.label, item.x, y + 1);
      ctx.restore();
    }
  }
}
