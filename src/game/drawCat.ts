import type { Ctx2D } from "./ctx2d";
import type { CatDef } from "./cats";

function fluffPath(ctx: Ctx2D, r: number) {
  const bumps = Math.max(14, Math.min(44, Math.round(r / 3.2)));
  const amp = r * 0.055;
  ctx.beginPath();
  let pcx = 0;
  let pcy = 0;
  for (let i = 0; i <= bumps; i++) {
    const a0 = (i / bumps) * Math.PI * 2;
    const a1 = ((i + 0.5) / bumps) * Math.PI * 2;
    const x0 = Math.cos(a0) * (r - amp);
    const y0 = Math.sin(a0) * (r - amp);
    if (i === 0) ctx.moveTo(x0, y0);
    else ctx.quadraticCurveTo(pcx, pcy, x0, y0);
    // control point for the next bump
    pcx = Math.cos(a1) * (r + amp * 1.6);
    pcy = Math.sin(a1) * (r + amp * 1.6);
  }
  ctx.closePath();
}

function drawEar(
  ctx: Ctx2D,
  r: number,
  side: -1 | 1,
  def: CatDef,
  style: "normal" | "fin" | "tuft" = "normal",
) {
  const ex = side * r * 0.62;
  const ey = -r * 0.62;
  const s = r * 0.42;

  if (style === "fin") {
    // sea-kitty: rounded fin ear with rib lines
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(side * 0.25);
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, s * 0.6);
    ctx.quadraticCurveTo(-s * 0.7, -s * 0.9, 0, -s * 0.95);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.9, s * 0.8, s * 0.6);
    ctx.closePath();
    ctx.fillStyle = def.shade;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.strokeStyle = def.outline;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = def.body;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineCap = "round";
    for (const k of [-0.35, 0, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(k * s, s * 0.35);
      ctx.quadraticCurveTo(k * s * 1.2, -s * 0.2, k * s * 0.6, -s * 0.55);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (style === "tuft") {
    // forest-kitty: taller lynx ear with tip tufts
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(side * 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, s * 0.6);
    ctx.quadraticCurveTo(-s * 0.5, -s * 1.05, side * s * 0.05, -s * 1.3);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.7, s * 0.85, s * 0.6);
    ctx.closePath();
    ctx.fillStyle = def.body;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.strokeStyle = def.outline;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.35);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, side * s * 0.02, -s * 0.75);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.3, s * 0.4, s * 0.35);
    ctx.closePath();
    ctx.fillStyle = def.shade;
    ctx.fill();
    // tuft hairs at the tip
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.lineCap = "round";
    for (const k of [-0.18, 0, 0.18]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.05 + k * s, -s * 1.28);
      ctx.lineTo(side * s * 0.05 + k * s * 1.8, -s * 1.62);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(side * 0.35);
  // outer ear
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, s * 0.55);
  ctx.quadraticCurveTo(-s * 0.35, -s * 0.9, side * s * 0.1, -s * 1.05);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.5, s * 0.85, s * 0.55);
  ctx.closePath();
  ctx.fillStyle = def.body;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.strokeStyle = def.outline;
  ctx.stroke();
  // inner ear
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.45);
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.35, side * s * 0.08, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.15, s * 0.45, s * 0.45);
  ctx.closePath();
  ctx.fillStyle = def.ear;
  ctx.fill();
  ctx.restore();
}

function eyeOpen(ctx: Ctx2D, x: number, y: number, r: number, scale = 1) {
  ctx.fillStyle = "#2b2233";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.11 * scale, r * 0.14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - r * 0.035 * scale, y - r * 0.05 * scale, r * 0.045 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.03 * scale, y + r * 0.04 * scale, r * 0.02 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function eyeHappy(ctx: Ctx2D, x: number, y: number, r: number) {
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.04, r * 0.11, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

function eyeSleepy(ctx: Ctx2D, x: number, y: number, r: number) {
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r * 0.11, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function eyeSmug(ctx: Ctx2D, x: number, y: number, r: number, def: CatDef) {
  eyeOpen(ctx, x, y, r);
  ctx.fillStyle = def.body;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.09, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y - r * 0.02);
  ctx.lineTo(x + r * 0.12, y - r * 0.02);
  ctx.stroke();
}

function eyeHeart(ctx: Ctx2D, x: number, y: number, r: number) {
  const s = r * 0.13;
  ctx.fillStyle = "#ff5c8a";
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s);
  ctx.fill();
}

/** map markings: wave stripes on the crown, or forest spots on the flanks */
function drawPattern(ctx: Ctx2D, r: number, def: CatDef, kind: "stripes" | "spots") {
  ctx.save();
  ctx.strokeStyle = def.shade;
  ctx.fillStyle = def.shade;
  ctx.lineCap = "round";
  if (kind === "stripes") {
    ctx.lineWidth = Math.max(1.4, r * 0.07);
    for (const [ox, w] of [[-r * 0.28, r * 0.2], [0, r * 0.24], [r * 0.28, r * 0.2]] as const) {
      ctx.beginPath();
      ctx.moveTo(ox - w / 2, -r * 0.62);
      ctx.quadraticCurveTo(ox, -r * 0.82, ox + w / 2, -r * 0.62);
      ctx.stroke();
    }
  } else {
    for (const [px, py, pr] of [
      [-r * 0.55, r * 0.3, r * 0.09],
      [-r * 0.38, r * 0.52, r * 0.06],
      [r * 0.52, r * 0.34, r * 0.08],
      [r * 0.36, r * 0.56, r * 0.055],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.8, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** map trinket: shell pendant at the neck, or clover behind the ear */
function drawMapTrinket(ctx: Ctx2D, r: number, kind: "shell" | "clover") {
  ctx.save();
  if (kind === "shell") {
    ctx.translate(0, r * 0.82);
    ctx.fillStyle = "#ffeef5";
    ctx.strokeStyle = "#ff8fb0";
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.12);
    ctx.quadraticCurveTo(-r * 0.22, r * 0.02, -r * 0.18, -r * 0.12);
    ctx.quadraticCurveTo(-r * 0.08, -r * 0.2, 0, -r * 0.18);
    ctx.quadraticCurveTo(r * 0.08, -r * 0.2, r * 0.18, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.22, r * 0.02, 0, r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const k of [-0.09, 0, 0.09]) {
      ctx.moveTo(0, r * 0.1);
      ctx.lineTo(k * r, -r * 0.14);
    }
    ctx.stroke();
  } else {
    ctx.translate(-r * 0.66, -r * 0.98);
    ctx.fillStyle = "#7cb86a";
    ctx.strokeStyle = "#4e8a3e";
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    for (const [cx2, cy2] of [[-r * 0.09, -r * 0.05], [r * 0.09, -r * 0.05], [0, r * 0.1]] as const) {
      ctx.beginPath();
      ctx.arc(cx2, cy2, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "#4e8a3e";
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.12);
    ctx.quadraticCurveTo(r * 0.06, r * 0.24, r * 0.02, r * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(ctx: Ctx2D, r: number, def: CatDef, blink = false) {
  const ey = -r * 0.08;
  const ex = r * 0.3;
  const exp = def.expression;

  // mid-blink: soft closed lids override the expression for a few frames
  if (blink && exp !== "cool") {
    eyeSleepy(ctx, -ex, ey, r);
    eyeSleepy(ctx, ex, ey, r);
  } else switch (exp) {
    case "open":
      eyeOpen(ctx, -ex, ey, r);
      eyeOpen(ctx, ex, ey, r);
      break;
    case "happy":
      eyeHappy(ctx, -ex, ey, r);
      eyeHappy(ctx, ex, ey, r);
      break;
    case "wink":
      eyeOpen(ctx, -ex, ey, r);
      eyeHappy(ctx, ex, ey, r);
      break;
    case "sleepy":
      eyeSleepy(ctx, -ex, ey, r);
      eyeSleepy(ctx, ex, ey, r);
      break;
    case "smug":
      eyeSmug(ctx, -ex, ey, r, def);
      eyeSmug(ctx, ex, ey, r, def);
      break;
    case "love":
      eyeHeart(ctx, -ex, ey, r);
      eyeHeart(ctx, ex, ey, r);
      break;
    case "surprised":
      eyeOpen(ctx, -ex, ey, r, 1.35);
      eyeOpen(ctx, ex, ey, r, 1.35);
      break;
    case "derp":
      eyeOpen(ctx, -ex, ey - r * 0.03, r, 1.2);
      eyeOpen(ctx, ex, ey + r * 0.03, r, 0.85);
      break;
    case "cool":
      // glasses drawn as accessory; eyes hidden
      break;
  }

  // blush
  ctx.fillStyle = "rgba(255,120,150,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.5, r * 0.14, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.5, r * 0.14, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // nose
  const ny = r * 0.12;
  ctx.fillStyle = "#ff8fb0";
  ctx.beginPath();
  ctx.moveTo(-r * 0.06, ny - r * 0.02);
  ctx.lineTo(r * 0.06, ny - r * 0.02);
  ctx.lineTo(0, ny + r * 0.05);
  ctx.closePath();
  ctx.fill();

  // mouth
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = Math.max(1, r * 0.032);
  ctx.lineCap = "round";
  if (exp === "surprised") {
    ctx.fillStyle = "#3a2230";
    ctx.beginPath();
    ctx.ellipse(0, ny + r * 0.17, r * 0.07, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-r * 0.07, ny + r * 0.07, r * 0.07, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.07, ny + r * 0.07, r * 0.07, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    if (exp === "derp") {
      ctx.fillStyle = "#ff7fa3";
      ctx.beginPath();
      ctx.ellipse(r * 0.05, ny + r * 0.19, r * 0.06, r * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // whiskers
  ctx.strokeStyle = "rgba(60,40,50,0.55)";
  ctx.lineWidth = Math.max(0.8, r * 0.022);
  for (const s of [-1, 1] as const) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.38, ny + i * r * 0.09);
      ctx.lineTo(s * r * 0.78, ny + i * r * 0.16 - r * 0.02);
      ctx.stroke();
    }
  }
}

function drawAccessory(ctx: Ctx2D, r: number, def: CatDef) {
  switch (def.accessory) {
    case "bow": {
      ctx.save();
      ctx.translate(r * 0.55, -r * 0.78);
      ctx.rotate(0.3);
      ctx.fillStyle = "#ff5c8a";
      const s = r * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 1.3, -s * 0.8);
      ctx.lineTo(-s * 1.3, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 1.3, -s * 0.8);
      ctx.lineTo(s * 1.3, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff8fb0";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "collar": {
      ctx.strokeStyle = "#ff3d6e";
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.arc(0, r * 0.18, r * 0.68, Math.PI * 0.25, Math.PI * 0.75);
      ctx.stroke();
      ctx.fillStyle = "#ffd447";
      ctx.beginPath();
      ctx.arc(0, r * 0.84, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "crown": {
      ctx.save();
      ctx.translate(0, -r * 0.98);
      const w = r * 0.42;
      const h = r * 0.3;
      ctx.fillStyle = "#ffcc33";
      ctx.strokeStyle = "#d69a12";
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.4);
      ctx.lineTo(-w, -h * 0.4);
      ctx.lineTo(-w * 0.5, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(w * 0.5, 0);
      ctx.lineTo(w, -h * 0.4);
      ctx.lineTo(w, h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff5c8a";
      ctx.beginPath();
      ctx.arc(0, h * 0.05, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#57c6ff";
      ctx.beginPath();
      ctx.arc(-w * 0.55, h * 0.12, r * 0.045, 0, Math.PI * 2);
      ctx.arc(w * 0.55, h * 0.12, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "flower": {
      ctx.save();
      ctx.translate(-r * 0.6, -r * 0.7);
      ctx.fillStyle = "#ffd7e8";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffd447";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "glasses": {
      const ey = -r * 0.08;
      const ex = r * 0.3;
      ctx.fillStyle = "#23202b";
      ctx.beginPath();
      ctx.ellipse(-ex, ey, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
      ctx.ellipse(ex, ey, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#23202b";
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(-ex + r * 0.2, ey);
      ctx.lineTo(ex - r * 0.2, ey);
      ctx.moveTo(-ex - r * 0.2, ey);
      ctx.lineTo(-r * 0.85, ey - r * 0.06);
      ctx.moveTo(ex + r * 0.2, ey);
      ctx.lineTo(r * 0.85, ey - r * 0.06);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-ex - r * 0.06, ey - r * 0.05, r * 0.06, r * 0.03, -0.5, 0, Math.PI * 2);
      ctx.ellipse(ex - r * 0.06, ey - r * 0.05, r * 0.06, r * 0.03, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pirate":
      drawPirate(ctx, r);
      break;
    case "tiara":
      drawTiara(ctx, r);
      break;
    case "star": {
      ctx.save();
      ctx.translate(r * 0.62, -r * 0.72);
      ctx.rotate(0.2);
      ctx.fillStyle = "#ffd447";
      ctx.beginPath();
      const s = r * 0.16;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? s : s * 0.45;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

/**
 * Draws a fluffy cat ball centered at (x,y).
 * sx/sy allow squash & stretch, angle rotates the whole cat.
 */
function drawPirate(ctx: Ctx2D, r: number) {
  // tricorn hat
  ctx.save();
  ctx.translate(0, -r * 0.82);
  ctx.rotate(-0.08);
  ctx.fillStyle = "#3b3350";
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.1);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.42, 0, -r * 0.34);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.42, r * 0.62, r * 0.1);
  ctx.quadraticCurveTo(0, r * 0.26, -r * 0.62, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffd447";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  // skull emblem
  ctx.fillStyle = "#f6f1ff";
  ctx.beginPath();
  ctx.arc(0, -r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b3350";
  ctx.beginPath();
  ctx.arc(-r * 0.03, -r * 0.13, r * 0.022, 0, Math.PI * 2);
  ctx.arc(r * 0.03, -r * 0.13, r * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // eyepatch strap + patch
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.28);
  ctx.lineTo(r * 0.72, -r * 0.16);
  ctx.stroke();
  ctx.fillStyle = "#2b2233";
  ctx.beginPath();
  ctx.ellipse(r * 0.3, -r * 0.12, r * 0.13, r * 0.11, 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawTiara(ctx: Ctx2D, r: number) {
  ctx.save();
  ctx.translate(0, -r * 0.92);
  ctx.fillStyle = "#ffd447";
  ctx.strokeStyle = "#d69a12";
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.1);
  ctx.lineTo(-r * 0.22, -r * 0.14);
  ctx.lineTo(-r * 0.1, -r * 0.02);
  ctx.lineTo(0, -r * 0.22);
  ctx.lineTo(r * 0.1, -r * 0.02);
  ctx.lineTo(r * 0.22, -r * 0.14);
  ctx.lineTo(r * 0.3, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [px, py, pr] of [[-r * 0.22, -r * 0.16, r * 0.035], [0, -r * 0.24, r * 0.045], [r * 0.22, -r * 0.16, r * 0.035]] as const) {
    ctx.fillStyle = "#ff8fb0";
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** per-map restyle (levels.ts catLook): repaint + ears + pattern + accessory */
export interface CatLookOpts {
  body?: string;
  shade?: string;
  pattern?: "none" | "stripes" | "spots";
  accessory?: "none" | "shell" | "clover";
  ears?: "normal" | "fin" | "tuft";
}

export interface DrawCatOpts {
  /** draw closed lids this frame (idle blink cycle) */
  blink?: boolean;
  look?: CatLookOpts;
}

export function drawCat(
  ctx: Ctx2D,
  x: number,
  y: number,
  r: number,
  defIn: CatDef,
  sx = 1,
  sy = 1,
  angle = 0,
  opts: DrawCatOpts = {},
) {
  const look = opts.look;
  const def: CatDef =
    look?.body || look?.shade
      ? { ...defIn, body: look.body ?? defIn.body, shade: look.shade ?? defIn.shade }
      : defIn;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(sx, sy);

  // tail peeks behind (hand-drawn curl)
  ctx.save();
  ctx.strokeStyle = def.shade;
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(r * 0.72, r * 0.55);
  ctx.quadraticCurveTo(r * 1.12, r * 0.42, r * 1.02, r * 0.06);
  ctx.quadraticCurveTo(r * 0.96, -r * 0.12, r * 0.8, -r * 0.06);
  ctx.stroke();
  ctx.strokeStyle = def.body;
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.moveTo(r * 0.98, r * 0.14);
  ctx.quadraticCurveTo(r * 0.96, -r * 0.06, r * 0.82, -r * 0.04);
  ctx.stroke();
  ctx.restore();

  // ears first (behind body) — style comes from the map look
  drawEar(ctx, r, -1, def, look?.ears ?? "normal");
  drawEar(ctx, r, 1, def, look?.ears ?? "normal");

  // body
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  grad.addColorStop(0, def.body);
  grad.addColorStop(0.7, def.body);
  grad.addColorStop(1, def.shade);
  fluffPath(ctx, r);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.strokeStyle = def.outline;
  ctx.lineJoin = "round";
  ctx.stroke();

  // map markings on the fur
  if (look?.pattern && look.pattern !== "none") drawPattern(ctx, r, def, look.pattern);

  // clip subsequent markings to body
  ctx.save();
  fluffPath(ctx, r);
  ctx.clip();

  // stripes (tabby)
  if (def.stripes) {
    ctx.strokeStyle = def.stripes;
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.22, -r * 0.95);
      ctx.lineTo(i * r * 0.16, -r * 0.55);
      ctx.stroke();
    }
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.98, -r * 0.1);
      ctx.lineTo(s * r * 0.72, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * r * 0.98, r * 0.2);
      ctx.lineTo(s * r * 0.75, r * 0.28);
      ctx.stroke();
    }
  }

  // color patch (calico)
  if (def.patch) {
    ctx.fillStyle = def.patch;
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, -r * 0.45, r * 0.42, r * 0.36, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.7, r * 0.55, r * 0.35, r * 0.28, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // muzzle / belly
  ctx.fillStyle = def.belly;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.24, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // handmade fur tufts along the cheeks & crown (short curved strokes)
  ctx.strokeStyle = def.shade;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(0.8, r * 0.025);
  ctx.lineCap = "round";
  for (const sgn of [-1, 1] as const) {
    for (let i = 0; i < 4; i++) {
      const ay = -r * 0.15 + i * r * 0.17;
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.86, ay);
      ctx.quadraticCurveTo(sgn * r * 0.72, ay + r * 0.05, sgn * r * 0.66, ay + r * 0.12);
      ctx.stroke();
    }
  }
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.3, -r * 0.86);
    ctx.quadraticCurveTo(i * r * 0.26, -r * 0.74, i * r * 0.32, -r * 0.66);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // whisker pores
  ctx.fillStyle = "rgba(60,40,50,0.35)";
  for (const sgn of [-1, 1] as const) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(sgn * (r * 0.2 + (i % 2) * r * 0.06), r * 0.16 + i * r * 0.06, Math.max(0.5, r * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // little front paws with toe seams
  for (const sgn of [-1, 1] as const) {
    ctx.fillStyle = def.belly;
    ctx.beginPath();
    ctx.ellipse(sgn * r * 0.24, r * 0.82, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = Math.max(0.7, r * 0.018);
    for (let t = -1; t <= 1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.24 + t * r * 0.05, r * 0.76);
      ctx.lineTo(sgn * r * 0.24 + t * r * 0.05, r * 0.86);
      ctx.stroke();
    }
  }

  ctx.restore();

  // soft highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, r, def, opts.blink);

  // map trinket (drawn last so it sits on top of the fur)
  if (look?.accessory && look.accessory !== "none") drawMapTrinket(ctx, r, look.accessory);
  drawAccessory(ctx, r, def);

  // plushie stitch seam — the "handmade" signature
  ctx.save();
  ctx.strokeStyle = def.outline;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.setLineDash([r * 0.07, r * 0.06]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.restore();
}
