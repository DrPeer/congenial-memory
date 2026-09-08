/**
 * renderScene — the whole Kitty Drop picture, drawn through the Ctx2D interface.
 *
 * Identical on web (DOM canvas) and native (Skia adapter): the caller applies the
 * clear + world transform, then this paints background → cup → cats → dropper →
 * dead line → particles → popups in world coordinates (400x640).
 */
import { CATS } from "./cats";
import type { Ctx2D } from "./ctx2d";
import { drawCat } from "./drawCat";
import {
  CUP_FLOOR,
  CUP_LEFT_TOP,
  CUP_RIGHT_TOP,
  CUP_TOP,
  DEAD_LINE_Y,
  DROP_Y,
  WORLD_H,
  WORLD_W,
  easeOutBack,
  type KittySim,
} from "./sim";

export function renderScene(ctx: Ctx2D, sim: KittySim, now: number) {
  drawBackground(ctx, now);
  drawCup(ctx);

  for (const c of sim.catViews()) {
    const def = CATS[c.tier];
    const age = now - c.born;
    const grow = age < 260 ? easeOutBack(age / 260) : 1;
    const s = Math.max(0.05, grow);
    const sq = Math.max(-0.35, Math.min(0.35, c.squish));
    drawCat(ctx, c.x, c.y, c.r, def, s * (1 + sq), s * (1 - sq), c.angle);
  }

  drawDropper(ctx, sim, now);
  drawDeadLine(ctx, sim, now);
  drawParticles(ctx, sim, now);
  drawPopups(ctx, sim, now);
}

function drawBackground(ctx: Ctx2D, now: number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  const items = ["🐾", "💗", "🐾", "🧶", "🐾", "💗", "🐟", "🐾"];
  for (let i = 0; i < items.length; i++) {
    const x = (i * 137 + 40) % WORLD_W;
    const y = ((i * 211 + now * 0.01) % (WORLD_H + 60)) - 30;
    ctx.fillText(items[i], x, y);
  }
  ctx.restore();
}

function drawCup(ctx: Ctx2D) {
  // shadow
  ctx.save();
  ctx.fillStyle = "rgba(180,90,120,0.18)";
  ctx.beginPath();
  ctx.ellipse(WORLD_W / 2, CUP_FLOOR + 10, 170, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // body
  ctx.beginPath();
  ctx.moveTo(CUP_LEFT_TOP - 6, CUP_TOP - 6);
  ctx.lineTo(CUP_RIGHT_TOP + 6, CUP_TOP - 6);
  ctx.lineTo(348 + 6, CUP_FLOOR + 8);
  ctx.quadraticCurveTo(WORLD_W / 2, CUP_FLOOR + 22, 52 - 6, CUP_FLOOR + 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, CUP_TOP, 0, CUP_FLOOR);
  g.addColorStop(0, "#fff9fb");
  g.addColorStop(1, "#ffeaf2");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#f2a5c2";
  ctx.lineJoin = "round";
  ctx.stroke();

  // inner rim
  ctx.strokeStyle = "rgba(242,165,194,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CUP_LEFT_TOP + 6, CUP_TOP + 14);
  ctx.lineTo(CUP_RIGHT_TOP - 6, CUP_TOP + 14);
  ctx.stroke();

  // cute fish label
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.font = "44px serif";
  ctx.textAlign = "center";
  ctx.fillText("🐟", WORLD_W / 2, CUP_FLOOR - 60);
  ctx.restore();
}

function drawDeadLine(ctx: Ctx2D, sim: KittySim, now: number) {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -((now * 0.02) % 18);
  ctx.lineWidth = 3;
  if (sim.danger) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
    ctx.strokeStyle = `rgba(255, 60, 100, ${0.55 + pulse * 0.45})`;
  } else {
    ctx.strokeStyle = "rgba(255, 120, 160, 0.45)";
  }
  ctx.beginPath();
  ctx.moveTo(CUP_LEFT_TOP - 2, DEAD_LINE_Y);
  ctx.lineTo(CUP_RIGHT_TOP + 2, DEAD_LINE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (sim.danger) {
    ctx.font = "bold 14px Fredoka, sans-serif";
    ctx.fillStyle = "#ff3d6e";
    ctx.textAlign = "center";
    ctx.fillText("⚠️ TOO FULL! ⚠️", WORLD_W / 2, DEAD_LINE_Y - 8);
  }
  ctx.restore();
}

function drawDropper(ctx: Ctx2D, sim: KittySim, now: number) {
  if (sim.over) return;
  const def = CATS[sim.currentTier];
  const r = def.radius;
  const x = sim.clampX(sim.pointerX, sim.currentTier);
  const bob = Math.sin(now * 0.004) * 3;

  // guide line
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(x, DROP_Y + r);
  ctx.lineTo(x, CUP_FLOOR - 4);
  ctx.stroke();
  ctx.restore();

  if (!sim.canDrop) {
    // ghost while reloading
    ctx.save();
    ctx.globalAlpha = 0.35;
    const p = Math.min(1, 1 - (sim.dropReadyAt - now) / 550);
    drawCat(ctx, x, DROP_Y + bob, r, def, 0.6 + 0.4 * p, 0.6 + 0.4 * p);
    ctx.restore();
    return;
  }

  // holder / claw string
  ctx.save();
  ctx.strokeStyle = "#f2a5c2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, DROP_Y + bob - r * 0.9);
  ctx.stroke();
  ctx.restore();

  drawCat(ctx, x, DROP_Y + bob, r, def, 1.03, 0.97);
}

function drawParticles(ctx: Ctx2D, sim: KittySim, now: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  sim.particles = sim.particles.filter((p) => now - p.t0 < p.life);
  for (const p of sim.particles) {
    const age = now - p.t0;
    const k = age / p.life;
    p.x += p.vx * 16;
    p.y += p.vy * 16;
    p.vy += 0.004 * 16;
    p.rot += p.vr * 16;
    ctx.globalAlpha = 1 - k;
    ctx.font = `${p.size}px serif`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillText(p.glyph, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawPopups(ctx: Ctx2D, sim: KittySim, now: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  sim.popups = sim.popups.filter((p) => now - p.t0 < p.life);
  for (const p of sim.popups) {
    const age = now - p.t0;
    const k = age / p.life;
    const y = p.y + p.vy * age;
    const s = age < 150 ? easeOutBack(age / 150) : 1;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.font = `700 ${p.size * s}px Fredoka, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineJoin = "round";
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, y);
  }
  ctx.restore();
}
