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
import { DECOR_SPRITES, GLYPH_SPRITE, type SpriteBank, type SpriteId as SpriteIdLike } from "./sprites";
import {
  CUP_FLOOR,
  CUP_LEFT_TOP,
  CUP_RIGHT_TOP,
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
  drawBackground(ctx, sim, now, opts);
  drawCup(ctx, sim, now, opts);
  drawObstacles(ctx, sim);

  for (const c of sim.catViews()) {
    const def = CATS[c.tier];
    const age = now - c.born;
    const grow = age < 260 ? easeOutBack(age / 260) : 1;
    const s = Math.max(0.05, grow);
    const sq = Math.max(-0.35, Math.min(0.35, c.squish));
    // idle breathing (subtle, deterministic per cat)
    const br = 1 + Math.sin(now * 0.0025 + c.born * 0.013) * 0.022;

    // soft grounding shadow
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#5a2a40";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + c.r * 0.82, c.r * 0.78 * s, c.r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // rare kitties (tier 9+) get a golden aura + orbiting sparkles
    if (c.tier >= 9) {
      ctx.save();
      const glow = ctx.createRadialGradient(c.x, c.y, c.r * 0.4, c.x, c.y, c.r * 1.7);
      glow.addColorStop(0, "rgba(255, 215, 106, 0.35)");
      glow.addColorStop(1, "rgba(255, 215, 106, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      const drawn = (() => {
        for (let i = 0; i < 2; i++) {
          const a = now * 0.0022 + i * Math.PI + c.born;
          const sx = c.x + Math.cos(a) * c.r * 1.25;
          const sy = c.y + Math.sin(a) * c.r * 1.25;
          const tw = 4 + 2.5 * Math.sin(now * 0.008 + i * 2);
          if (!drawSpriteOr(ctx, opts, "✨", sx, sy, tw * 2, a, "✨")) {
            ctx.fillStyle = "rgba(255,236,170,0.9)";
            ctx.beginPath();
            ctx.arc(sx, sy, tw * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        return true;
      })();
      void drawn;
      ctx.restore();
    }

    // blink cycle: quick close every ~4.2s, staggered by birth time
    const blink = ((now + c.born * 7) % 4200) < 150;
    drawCat(ctx, c.x, c.y, c.r, def, s * (1 + sq) * (2 - br), s * (1 - sq) * br, c.angle, { blink });
  }

  drawShots(ctx, sim, now);
  drawDropper(ctx, sim, now);
  drawDeadLine(ctx, sim, now, opts);
  drawParticles(ctx, sim, now, opts);
  drawPopups(ctx, sim, now);
  drawScope(ctx, sim, now, opts);
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
  spriteOverride?: SpriteIdLike,
) {
  const bank = opts.sprites ?? null;
  const spriteId = spriteOverride ?? GLYPH_SPRITE[id] ?? GLYPH_SPRITE[fallbackGlyph];
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

function drawBackground(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts) {
  const theme = opts.theme;
  const bank = opts.sprites ?? null;

  // layered gradient sky (host colours come from the active theme)
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, theme ? theme.hostBg : "#ffd6e7");
  sky.addColorStop(0.55, theme ? theme.hostBgMid : "#ffe3ef");
  sky.addColorStop(1, theme ? theme.hostBgEnd : "#fff3f8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // ambient glow behind the jar
  const glow = ctx.createRadialGradient(WORLD_W / 2, (sim.cupTop + CUP_FLOOR) / 2, 40, WORLD_W / 2, (sim.cupTop + CUP_FLOOR) / 2, 290);
  glow.addColorStop(0, "rgba(255,255,255,0.4)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // drifting dust motes inside the jar (depth without parallax bodies)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 12; i++) {
    const seed = i * 97.3;
    const x = CUP_LEFT_TOP + 20 + ((seed * 3.7) % (CUP_RIGHT_TOP - CUP_LEFT_TOP - 40));
    const y = CUP_FLOOR - 10 - (((seed * 5.1 + now * (0.008 + (i % 4) * 0.004))) % (CUP_FLOOR - sim.cupTop - 20));
    const r = 1.2 + (i % 3) * 0.8;
    ctx.globalAlpha = 0.18 + 0.16 * Math.sin(now * 0.002 + seed);
    ctx.beginPath();
    ctx.arc(x + Math.sin(now * 0.001 + seed) * 6, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

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

function drawCup(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts) {
  const t = opts.theme;
  const top = sim.cupTop;
  const L = sim.wallLeft;
  const R = sim.wallRight;
  const cx = (L + R) / 2;

  // grounded shadow: wide soft pool + darker contact line
  ctx.save();
  ctx.fillStyle = t ? t.cupShadow : "rgba(180,90,120,0.18)";
  ctx.beginPath();
  ctx.ellipse(WORLD_W / 2, CUP_FLOOR + 12, 178, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(WORLD_W / 2, CUP_FLOOR + 8, 140, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // glass body (same silhouette as the physics walls — visuals never re-rule)
  ctx.beginPath();
  ctx.moveTo(L - 6, top - 6);
  ctx.lineTo(R + 6, top - 6);
  ctx.lineTo(348 + 6, CUP_FLOOR + 8);
  ctx.quadraticCurveTo(WORLD_W / 2, CUP_FLOOR + 22, 52 - 6, CUP_FLOOR + 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, CUP_FLOOR);
  g.addColorStop(0, t ? t.cupFillTop : "#fff9fb");
  g.addColorStop(1, t ? t.cupFillBottom : "#ffeaf2");
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = t ? t.cupStroke : "#f2a5c2";
  ctx.lineJoin = "round";
  ctx.stroke();

  // glass sheen: broad left highlight + thin right reflection (clipped to jar)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(L - 6, top - 6);
  ctx.lineTo(R + 6, top - 6);
  ctx.lineTo(348 + 6, CUP_FLOOR + 8);
  ctx.quadraticCurveTo(WORLD_W / 2, CUP_FLOOR + 22, 52 - 6, CUP_FLOOR + 8);
  ctx.closePath();
  ctx.clip();
  const sheen = ctx.createLinearGradient(L, 0, L + 92, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.42)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(L - 6, top, 98, CUP_FLOOR - top);
  const sheen2 = ctx.createLinearGradient(R - 34, 0, R + 6, 0);
  sheen2.addColorStop(0, "rgba(255,255,255,0)");
  sheen2.addColorStop(1, "rgba(255,255,255,0.28)");
  ctx.fillStyle = sheen2;
  ctx.fillRect(R - 34, top, 40, CUP_FLOOR - top);
  // slow-moving gleam band
  const gleamX = L + ((now * 0.012) % (R - L + 200)) - 60;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(gleamX, top);
  ctx.lineTo(gleamX + 26, top);
  ctx.lineTo(gleamX + 6, CUP_FLOOR);
  ctx.lineTo(gleamX - 20, CUP_FLOOR);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // decorative golden rim band with side handles (the jar's "lid" jewellery)
  ctx.save();
  const band = ctx.createLinearGradient(0, top - 14, 0, top + 4);
  band.addColorStop(0, "#ffe9a8");
  band.addColorStop(0.5, "#f6c65c");
  band.addColorStop(1, "#d69a12");
  ctx.fillStyle = band;
  ctx.strokeStyle = "rgba(140, 96, 10, 0.55)";
  ctx.lineWidth = 2;
  const bw = R - L + 30;
  const bx = cx - bw / 2, by = top - 13, bh = 15, br = 7;
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // rivets
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  for (const rx of [-bw / 2 + 12, -18, 18, bw / 2 - 12]) {
    ctx.beginPath();
    ctx.arc(cx + rx, top - 5.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // handles
  ctx.strokeStyle = "#e8b64c";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx - bw / 2 - 6, top + 16, 13, -Math.PI * 0.35, Math.PI * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + bw / 2 + 6, top + 16, 13, Math.PI * 0.65, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();

  // inner rim
  ctx.strokeStyle = t ? t.cupRim : "rgba(242,165,194,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L + 6, top + 14);
  ctx.lineTo(R - 6, top + 14);
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

function drawDeadLine(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts) {
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
    const frac = Math.max(0, Math.min(1, left / sim.fuseMs));
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
    ctx.fillText("TOO FULL!", WORLD_W / 2 + 12, DEAD_LINE_Y - 10);
    const alertImg = opts.sprites?.get("alert") ?? null;
    if (alertImg) {
      ctx.drawImage(alertImg, WORLD_W / 2 - 34, DEAD_LINE_Y - 20, 20, 20);
      ctx.drawImage(alertImg, WORLD_W / 2 + 26, DEAD_LINE_Y - 20, 20, 20);
    }
  }
  ctx.restore();
}

/** level obstacles: reef rocks (beach) / mossy boulders (hills) */
function drawObstacles(ctx: Ctx2D, sim: KittySim) {
  for (const o of sim.level.obstacles) {
    ctx.save();
    ctx.translate(o.x, o.y);
    const reef = o.kind === "reef";
    const g = ctx.createRadialGradient(-o.r * 0.3, -o.r * 0.35, o.r * 0.1, 0, 0, o.r * 1.05);
    g.addColorStop(0, reef ? "#f2b3a2" : "#b3bfa8");
    g.addColorStop(1, reef ? "#d98873" : "#8a977e");
    ctx.fillStyle = g;
    ctx.beginPath();
    // lumpy rock silhouette
    ctx.moveTo(-o.r, o.r * 0.15);
    ctx.quadraticCurveTo(-o.r * 0.9, -o.r * 0.8, -o.r * 0.2, -o.r * 0.92);
    ctx.quadraticCurveTo(o.r * 0.55, -o.r * 1.0, o.r * 0.92, -o.r * 0.25);
    ctx.quadraticCurveTo(o.r * 1.05, o.r * 0.5, o.r * 0.3, o.r * 0.9);
    ctx.quadraticCurveTo(-o.r * 0.45, o.r * 1.0, -o.r, o.r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = reef ? "#b96a58" : "#6d7c62";
    ctx.lineJoin = "round";
    ctx.stroke();
    // speckles
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (const [px, py, pr] of [[-0.3, -0.25, 0.09], [0.25, 0.1, 0.07], [-0.05, 0.4, 0.06]] as const) {
      ctx.beginPath();
      ctx.arc(px * o.r, py * o.r, pr * o.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (reef) {
      // little starfish hitchhiker
      ctx.fillStyle = "#ff8fb0";
      ctx.save();
      ctx.translate(o.r * 0.35, -o.r * 0.45);
      ctx.rotate(0.4);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * o.r * 0.28, Math.sin(a) * o.r * 0.28);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a2) * o.r * 0.12, Math.sin(a2) * o.r * 0.12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // moss cap
      ctx.fillStyle = "#7cb86a";
      ctx.beginPath();
      ctx.ellipse(-o.r * 0.15, -o.r * 0.78, o.r * 0.5, o.r * 0.2, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** scope overlay while the shoot booster is armed: crosshair + target ring */
function drawScope(ctx: Ctx2D, sim: KittySim, now: number, opts: RenderOpts) {
  if (!sim.aiming) return;
  const { x, y } = sim.aim;
  const target = sim.catAtAim();
  ctx.save();

  // gentle dim so the crosshair pops
  ctx.fillStyle = "rgba(43,34,51,0.14)";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // target highlight
  if (target) {
    ctx.strokeStyle = "rgba(90,222,160,0.95)";
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -(now * 0.05) % 16;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // crosshair reticle
  const rot = now * 0.0012;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = target ? "#5ade9e" : "#ffffff";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 9]);
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2.5;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(dx * 14, dy * 14);
    ctx.lineTo(dx * 40, dy * 40);
    ctx.stroke();
  }
  ctx.rotate(-rot);
  ctx.fillStyle = target ? "#5ade9e" : "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // hint
  ctx.save();
  ctx.font = "700 15px Fredoka, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText(target ? "TAP TO LAUNCH!" : "AIM AT A KITTY…", WORLD_W / 2, Math.max(46, sim.cupTop - 46));
  ctx.fillStyle = target ? "#2fb78a" : "#ff5c8a";
  ctx.fillText(target ? "TAP TO LAUNCH!" : "AIM AT A KITTY…", WORLD_W / 2, Math.max(46, sim.cupTop - 46));
  ctx.restore();
  void opts;
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
    const drawn = drawSpriteOr(ctx, opts, p.glyph, p.x, p.y, p.size * 1.7, p.rot, p.glyph, p.sprite);
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
