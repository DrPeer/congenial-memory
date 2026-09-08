/**
 * renderScene — the whole Kitty Drop picture, drawn through the Ctx2D interface.
 *
 * Identical on web (DOM canvas) and native (Skia adapter). Visuals come from the
 * active Theme + SpriteBank (custom generated stickers); when a sprite isn't
 * loaded yet we fall back to the original emoji glyphs. Geometry, motion and
 * timings are exactly the v1 game — themes repaint, they never re-rule.
 */
import { CATS } from "./cats";
import type { Ctx2D } from "./ctx2d";
import { drawCat } from "./drawCat";
import { DECOR_SPRITES, GLYPH_SPRITE, type SpriteBank } from "./sprites";
import {
  CUP_FLOOR,
  CUP_LEFT_TOP,
  CUP_RIGHT_TOP,
  DANGER_FUSE_MS,
  DROP_Y,
  WORLD_H,
  WORLD_W,
  easeOutBack,
  type KittySim,
} from "./sim";
import type { Theme } from "./theme";

export interface RenderOpts {
  theme?: Theme;
  sprites?: SpriteBank | null;
}

export function renderScene(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts = {}) {
  drawBackground(ctx, now, opts);
  drawCup(ctx, sim, opts);

  for (const c of sim.catViews()) {
    const def = CATS[c.tier];
    const age = now - c.born;
    const grow = age < 260 ? easeOutBack(age / 260) : 1;
    const s = Math.max(0.05, grow);
    const sq = Math.max(-0.35, Math.min(0.35, c.squish));
    drawCat(ctx, c.x, c.y, c.r, def, s * (1 + sq), s * (1 - sq), c.angle);
  }

  drawShots(ctx, sim, now);
  drawDropper(ctx, sim, now);
  drawDeadLine(ctx, sim, now);
  drawParticles(ctx, sim, now, opts);
  drawPopups(ctx, sim, now);
}

/* ------------------------------------------------------------ helpers */

function drawSpriteOr(
  ctx: Ctx2D,
  opts: RenderOpts,
  id: string,
  x: number,
  y: number,
  size: number,
  rot: number,
  fallbackGlyph: string,
) {
  const bank = opts.sprites ?? null;
  const spriteId = GLYPH_SPRITE[id] ?? GLYPH_SPRITE[fallbackGlyph];
  const img = bank && spriteId ? (bank.get(spriteId) as unknown) : null;
  if (img) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ layers */

function drawBackground(ctx: Ctx2D, now: number, opts: RenderOpts) {
  const theme = opts.theme;
  const bank = opts.sprites ?? null;

  // backdrop texture
  const pattern = bank?.get("pattern") ?? null;
  if (pattern && theme) {
    ctx.save();
    ctx.globalAlpha = theme.patternAlpha;
    ctx.drawImage(pattern, 0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  // floating decor — same slots & drift as v1, sticker art instead of emoji
  ctx.save();
  ctx.globalAlpha = theme ? theme.decorAlpha : 0.12;
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  const glyphs = ["🐾", "💗", "🐾", "🧶", "🐾", "💗", "🐟", "🐾"];
  for (let i = 0; i < DECOR_SPRITES.length; i++) {
    const x = (i * 137 + 40) % WORLD_W;
    const y = ((i * 211 + now * 0.01) % (WORLD_H + 60)) - 30;
    const drawn = drawSpriteOr(ctx, opts, DECOR_SPRITES[i], x, y, 34, 0, glyphs[i]);
    if (!drawn) ctx.fillText(glyphs[i], x, y);
  }
  ctx.restore();
}

function drawCup(ctx: Ctx2D, sim: KittySim, opts: RenderOpts) {
  const t = opts.theme;
  const top = sim.cupTop;
  // shadow
  ctx.save();
  ctx.fillStyle = t ? t.cupShadow : "rgba(180,90,120,0.18)";
  ctx.beginPath();
  ctx.ellipse(WORLD_W / 2, CUP_FLOOR + 10, 170, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // body
  ctx.beginPath();
  ctx.moveTo(CUP_LEFT_TOP - 6, top - 6);
  ctx.lineTo(CUP_RIGHT_TOP + 6, top - 6);
  ctx.lineTo(348 + 6, CUP_FLOOR + 8);
  ctx.quadraticCurveTo(WORLD_W / 2, CUP_FLOOR + 22, 52 - 6, CUP_FLOOR + 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, CUP_FLOOR);
  g.addColorStop(0, t ? t.cupFillTop : "#fff9fb");
  g.addColorStop(1, t ? t.cupFillBottom : "#ffeaf2");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = t ? t.cupStroke : "#f2a5c2";
  ctx.lineJoin = "round";
  ctx.stroke();

  // inner rim
  ctx.strokeStyle = t ? t.cupRim : "rgba(242,165,194,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CUP_LEFT_TOP + 6, top + 14);
  ctx.lineTo(CUP_RIGHT_TOP - 6, top + 14);
  ctx.stroke();

  // fish motif (sticker when available)
  ctx.save();
  ctx.globalAlpha = t ? t.fishAlpha : 0.25;
  const drawn = drawSpriteOr(ctx, opts, "fish", WORLD_W / 2, CUP_FLOOR - 74, 60, 0, "");
  if (!drawn) {
    ctx.font = "44px serif";
    ctx.textAlign = "center";
    ctx.fillText("🐟", WORLD_W / 2, CUP_FLOOR - 60);
  }
  ctx.restore();
}

function drawDeadLine(ctx: Ctx2D, sim: KittySim, now: number) {
  const DEAD_LINE_Y = sim.deadLineY;
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
    // overfull countdown: shrinking ring + seconds left until game over
    const left = sim.dangerLeft;
    const secs = Math.max(1, Math.ceil(left / 1000));
    const frac = Math.max(0, Math.min(1, left / DANGER_FUSE_MS));
    const cx = WORLD_W / 2;
    const cy = DEAD_LINE_Y - 54;
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ff3d6e";
    ctx.beginPath();
    ctx.arc(cx, cy, 25, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    const pulse = 1 + 0.1 * Math.sin(now * 0.02);
    ctx.font = `700 ${Math.round(30 * pulse)}px Fredoka, sans-serif`;
    ctx.fillStyle = "#ff3d6e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(secs), cx, cy + 1);
    ctx.font = "bold 14px Fredoka, sans-serif";
    ctx.fillText("⚠️ TOO FULL! ⚠️", WORLD_W / 2, DEAD_LINE_Y - 10);
  }
  ctx.restore();
}

/** kitties launched out by the shoot booster: spin up & fade */
function drawShots(ctx: Ctx2D, sim: KittySim, now: number) {
  for (const sh of sim.shots) {
    const k = Math.min(1, (now - sh.t0) / 700);
    const ease = 1 - Math.pow(1 - k, 3);
    const def = CATS[sh.tier];
    const sc = 1 + 0.25 * k;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    drawCat(ctx, sh.x, sh.y - ease * 300, def.radius * 0.95, def, sc, sc, k * 5);
    ctx.restore();
  }
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

function drawParticles(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts) {
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
    const drawn = drawSpriteOr(ctx, opts, p.glyph, p.x, p.y, p.size * 1.7, p.rot, p.glyph);
    if (!drawn) {
      ctx.font = `${p.size}px serif`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillText(p.glyph, 0, 0);
      ctx.restore();
    }
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
