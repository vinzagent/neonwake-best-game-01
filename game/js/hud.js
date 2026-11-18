// hud.js — everything that is not a game entity: the starfield/grid
// backdrop, the in-game HUD (score, wave, hull/shield bars, dash meter,
// boss health), wave banners, and the full-screen states — title, pause,
// game over and victory. All text is drawn on the canvas, no DOM overlays.

import { PLAYER_MAX_HULL, PLAYER_MAX_SHIELD } from './player.js';

export function drawBackground(ctx, width, height, stars, time) {
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, width, height);

  // Perspective-feel floor grid.
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 140, 180, 0.13)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 0; y <= height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.20)';
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.restore();

  // Twinkling starfield (positions pre-generated with the run's seed).
  ctx.save();
  for (const star of stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.twinkle + star.phase));
    ctx.globalAlpha = tw * star.alpha;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function makeStars(rng, width, height, count = 130) {
  const stars = [];
  const colors = ['#bfefff', '#ffffff', '#7fd8ff', '#ffd7f4'];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng.range(0, width),
      y: rng.range(0, height),
      size: rng.range(1, 2.4),
      alpha: rng.range(0.3, 0.95),
      twinkle: rng.range(0.4, 1.8),
      phase: rng.range(0, Math.PI * 2),
      color: rng.pick(colors),
    });
  }
  return stars;
}

export function drawHud(ctx, game) {
  const player = game.player;
  ctx.save();
  ctx.textBaseline = 'top';

  // Score block, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 24px Verdana, sans-serif';
  ctx.fillText(String(game.score).padStart(7, '0'), 18, 14);
  ctx.fillStyle = '#5d89a0';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(`BEST ${String(game.bestScore).padStart(7, '0')}`, 19, 43);
  ctx.fillText(`KILLS ${game.kills}`, 19, 59);

  // Wave block, top-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8feff';
  ctx.font = 'bold 22px Verdana, sans-serif';
  ctx.fillText(game.endless ? `WAVE ${game.wave} · ENDLESS` : `WAVE ${game.wave} / 10`, 640, 14);
  ctx.fillStyle = '#5d89a0';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(`HOSTILES LEFT ${game.hostilesLeft()}`, 640, 42);

  // Time, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8feff';
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillText(formatTime(game.elapsed), 1262, 15);
  if (player.rapidActive) {
    ctx.fillStyle = '#ffcf3f';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillText('RAPID FIRE', 1262, 42);
  }

  // Hull + shield bars, bottom-left.
  bar(ctx, 18, 668, 230, 15, player.hull / PLAYER_MAX_HULL, '#3dff7c', '#ff4747', 'HULL');
  if (player.shield > 0) {
    bar(ctx, 18, 642, 230, 10, player.shield / PLAYER_MAX_SHIELD, '#37f2ff', '#37f2ff', '');
  }

  // Dash meter, bottom-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = player.dashReady ? '#00e5ff' : '#33566b';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillText(player.dashReady ? 'DASH READY [SHIFT]' : 'DASH CHARGING', 1262, 676);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(1082, 696, 180, 6);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(1082, 696, 180 * game.dashChargeRatio(), 6);

  ctx.restore();

  // Boss health bar, top-centre under the wave label.
  const boss = game.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,71,71,0.2)';
    ctx.fillRect(440, 66, 400, 10);
    ctx.fillStyle = '#ff4747';
    ctx.fillRect(440, 66, 400 * Math.max(0, boss.hp / boss.maxHp), 10);
    ctx.strokeStyle = '#ff4747';
    ctx.strokeRect(440, 66, 400, 10);
    ctx.fillStyle = '#ffb3b3';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DREADNOUGHT', 640, 80);
    ctx.restore();
  }

  // Centre wave banner.
  if (game.bannerTimer > 0 && game.bannerText) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.bannerTimer / 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8feff';
    ctx.font = 'bold 44px Verdana, sans-serif';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 24;
    ctx.fillText(game.bannerText, 640, 150);
    if (game.bannerSub) {
      ctx.font = '16px Verdana, sans-serif';
      ctx.fillStyle = '#7fd8ff';
      ctx.shadowBlur = 0;
      ctx.fillText(game.bannerSub, 640, 204);
    }
    ctx.restore();
  }
}

function bar(ctx, x, y, w, h, ratio, fullColor, lowColor, label) {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ratio <= 0.3 ? lowColor : fullColor;
  ctx.fillRect(x, y, w * clamped, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x, y, w, h);
  if (label) {
    ctx.fillStyle = '#04121a';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 5, y + 2);
  }
  ctx.restore();
}

function overlay(ctx, width, height, alpha = 0.62) {
  ctx.fillStyle = `rgba(3, 3, 14, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

function centreText(ctx, text, y, font, color, glow = 0) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillText(text, 640, y);
  ctx.restore();
}

export function drawTitleScreen(ctx, width, height, time, bestScore, forcePrompt = false) {
  overlay(ctx, width, height, 0.45);
  const pulse = 1 + Math.sin(time * 2.2) * 0.02;
  ctx.save();
  ctx.translate(640, 218);
  ctx.scale(pulse, pulse);
  ctx.font = 'bold 96px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#e8feff';
  ctx.fillText('NEONWAKE', 0, 0);
  ctx.shadowColor = '#ff2bd6';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff2bd6';
  ctx.font = 'bold 22px Verdana, sans-serif';
  ctx.fillText('YOUR LIGHT IS A WEAPON', 0, 66);
  ctx.restore();

  centreText(ctx, 'Ride the arena. Your wake burns anything that crosses it.', 348, '17px Verdana, sans-serif', '#9be8ff');
  centreText(ctx, 'WASD / ARROWS  move      MOUSE  aim      CLICK / SPACE  fire      SHIFT  dash', 392, 'bold 15px Verdana, sans-serif', '#e8feff');
  centreText(ctx, 'Survive 10 waves. Dreadnoughts rise every 5.', 424, '15px Verdana, sans-serif', '#9be8ff');
  if (bestScore > 0) {
    centreText(ctx, `BEST SCORE  ${bestScore}`, 470, 'bold 16px Verdana, sans-serif', '#ffcf3f');
  }
  // Screenshot scenes pass forcePrompt so the launch prompt is always in
  // frame instead of depending on where the blink cycle happens to land.
  const blink = forcePrompt || Math.sin(time * 4) > -0.2;
  if (blink) {
    centreText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 548, 'bold 22px Verdana, sans-serif', '#3dff7c', 16);
  }
}

export function drawPauseScreen(ctx, width, height) {
  overlay(ctx, width, height, 0.66);
  centreText(ctx, 'PAUSED', 300, 'bold 54px Verdana, sans-serif', '#e8feff', 20);
  centreText(ctx, 'Press P or ESC to resume', 366, '17px Verdana, sans-serif', '#9be8ff');
}

export function drawGameOverScreen(ctx, width, height, stats) {
  overlay(ctx, width, height, 0.72);
  centreText(ctx, 'SKIFF DOWN', 208, 'bold 64px Verdana, sans-serif', '#ff4747', 26);
  centreText(ctx, `You survived to wave ${stats.wave}`, 272, '19px Verdana, sans-serif', '#9be8ff');
  drawStatsBlock(ctx, stats);
  centreText(ctx, 'Press R to restart', 540, 'bold 22px Verdana, sans-serif', '#3dff7c', 14);
  centreText(ctx, 'or click to fly again', 574, '14px Verdana, sans-serif', '#5d89a0');
}

export function drawVictoryScreen(ctx, width, height, stats) {
  overlay(ctx, width, height, 0.66);
  centreText(ctx, 'ARENA CLEARED!', 208, 'bold 58px Verdana, sans-serif', '#3dff7c', 26);
  centreText(ctx, 'All 10 waves survived. The neon is yours.', 272, '19px Verdana, sans-serif', '#9be8ff');
  drawStatsBlock(ctx, stats);
  centreText(ctx, 'Press ENTER for ENDLESS mode', 540, 'bold 22px Verdana, sans-serif', '#ffcf3f', 14);
  centreText(ctx, 'Waves keep coming. How long can you last?', 574, '14px Verdana, sans-serif', '#5d89a0');
}

function drawStatsBlock(ctx, stats) {
  const rows = [
    ['SCORE', String(stats.score)],
    ['BEST', String(stats.bestScore)],
    ['WAVE REACHED', String(stats.wave)],
    ['KILLS', String(stats.kills)],
    ['TIME SURVIVED', formatTime(stats.elapsed)],
  ];
  ctx.save();
  ctx.font = 'bold 18px Verdana, sans-serif';
  ctx.textBaseline = 'middle';
  rows.forEach(([label, value], i) => {
    const y = 330 + i * 36;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5d89a0';
    ctx.fillText(label, 622, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8feff';
    ctx.fillText(value, 658, y);
  });
  ctx.restore();
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
