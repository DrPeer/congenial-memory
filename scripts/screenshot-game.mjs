#!/usr/bin/env node
/**
 * screenshot-game.mjs — headless gameplay frames, rendered by the REAL renderer.
 *
 *   node scripts/screenshot-game.mjs            -> screenshots/frame-sweet-berry.png (+ one per theme)
 *
 * How: bundles src/game/render.ts + sim.ts + plugin registry, plays a
 * deterministic headless match until the scene looks alive (cats stacked +
 * a merge popup), then paints that exact frame through SvgCtx2D (a Ctx2D
 * adapter that emits SVG) with the REAL sprite PNGs embedded, and rasterizes
 * with sharp. No browser, no device — useful for AI agents to eyeball render
 * changes and for docs. HUD/menus are DOM overlays and are not part of the
 * canvas frame.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = (() => {
  try {
    return require("sharp");
  } catch {
    return require("/tmp/iconwork/node_modules/sharp"); // dev convenience fallback
  }
})();

/* ------------------------------------------------ bundle the real game code */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kittyshot-"));
const entry = path.join(tmp, "entry.ts");
fs.writeFileSync(
  entry,
  `export * from "${ROOT}/src/game/render";
export * from "${ROOT}/src/game/sim";
export * from "${ROOT}/src/plugins/registry";
export { SPRITE_IDS } from "${ROOT}/src/game/sprites";
`,
);
const bundle = path.join(tmp, "game.cjs");
execFileSync(
  path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild"),
  [entry, "--bundle", "--platform=node", "--format=cjs", `--outfile=${bundle}`, "--log-level=error"],
  { cwd: ROOT },
);
const G = require(bundle);

/* ------------------------------------------------ SvgCtx2D: Ctx2D -> SVG */
const DEG = 180 / Math.PI;
class SvgGradient {
  constructor(kind, coords) {
    this.kind = kind;
    this.coords = coords;
    this.stops = [];
  }
  addColorStop(offset, color) {
    this.stops.push({ offset, color });
  }
}

class SvgCtx2D {
  constructor() {
    this.defs = [];
    this.out = [];
    this.reset();
  }
  reset() {
    this.tf = "";
    this.alpha = 1;
    this.fillStyle = "#000";
    this.strokeStyle = "#000";
    this.lineWidth = 1;
    this.lineCap = "butt";
    this.lineJoin = "miter";
    this.font = "10px sans-serif";
    this.textAlign = "start";
    this.textBaseline = "alphabetic";
    this.dash = [];
    this.lineDashOffset = 0;
    this.stack = [];
    this.d = "";
  }
  /* state */
  save() {
    this.stack.push([this.tf, this.alpha, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin, this.font, this.textAlign, this.textBaseline, this.dash, this.lineDashOffset]);
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    [this.tf, this.alpha, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin, this.font, this.textAlign, this.textBaseline, this.dash, this.lineDashOffset] = s;
  }
  translate(x, y) { this.tf += `translate(${x} ${y}) `; }
  rotate(rad) { this.tf += `rotate(${(rad * DEG).toFixed(3)}) `; }
  scale(x, y) { this.tf += `scale(${x} ${y}) `; }
  clip() { /* not used by the renderer */ }
  /* paths */
  beginPath() { this.d = ""; }
  closePath() { this.d += "Z "; }
  moveTo(x, y) { this.d += `M ${x} ${y} `; }
  lineTo(x, y) { this.d += `L ${x} ${y} `; }
  quadraticCurveTo(cx, cy, x, y) { this.d += `Q ${cx} ${cy} ${x} ${y} `; }
  bezierCurveTo(a, b, c, e, x, y) { this.d += `C ${a} ${b} ${c} ${e} ${x} ${y} `; }
  arc(x, y, r, start, end) {
    let delta = end - start;
    if (delta >= Math.PI * 2 - 1e-6) {
      this.d += `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} `;
      return;
    }
    const sx = x + r * Math.cos(start), sy = y + r * Math.sin(start);
    const ex = x + r * Math.cos(end), ey = y + r * Math.sin(end);
    const large = delta > Math.PI ? 1 : 0;
    this.d += `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} `;
  }
  ellipse(x, y, rx, ry, rot, start, end) {
    const rd = (rot * DEG).toFixed(2);
    if (end - start >= Math.PI * 2 - 1e-6) {
      this.d += `M ${x - rx} ${y} A ${rx} ${ry} ${rd} 1 0 ${x + rx} ${y} A ${rx} ${ry} ${rd} 1 0 ${x - rx} ${y} `;
      return;
    }
    const c = Math.cos(rot), s = Math.sin(rot);
    const pt = (a) => [x + rx * Math.cos(a) * c - ry * Math.sin(a) * s, y + rx * Math.cos(a) * s + ry * Math.sin(a) * c];
    const [sx, sy] = pt(start);
    const [ex, ey] = pt(end);
    const large = end - start > Math.PI ? 1 : 0;
    this.d += `M ${sx} ${sy} A ${rx} ${ry} ${rd} ${large} 1 ${ex} ${ey} `;
  }
  /* styles -> svg attrs */
  _paint(style) {
    if (style instanceof SvgGradient) {
      const id = `g${this.defs.length}`;
      if (style.kind === "linear") {
        const [x0, y0, x1, y1] = style.coords;
        this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}">${style.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("")}</linearGradient>`);
      } else {
        const [x0, y0, r0, x1, y1, r1] = style.coords;
        this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" fx="${x0}" fy="${y0}" fr="${r0}" cx="${x1}" cy="${y1}" r="${r1}">${style.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("")}</radialGradient>`);
      }
      return `url(#${id})`;
    }
    return String(style);
  }
  _common() {
    return `${this.tf ? ` transform="${this.tf.trim()}"` : ""}${this.alpha < 1 ? ` opacity="${this.alpha}"` : ""}`;
  }
  fill() {
    if (!this.d) return;
    this.out.push(`<path d="${this.d}" fill="${this._paint(this.fillStyle)}"${this._common()}/>`);
  }
  stroke() {
    if (!this.d) return;
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.join(" ")}" stroke-dashoffset="${this.lineDashOffset}"` : "";
    this.out.push(`<path d="${this.d}" fill="none" stroke="${this._paint(this.strokeStyle)}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${dash}${this._common()}/>`);
  }
  _textEl(text, x, y, kind) {
    const m = this.font.match(/(?:(\d+)\s+)?([\d.]+)px\s+(.*)/i) || [, , "16", "sans-serif"];
    const anchor = this.textAlign === "center" ? "middle" : this.textAlign === "right" ? "end" : "start";
    const baseline = this.textBaseline === "middle" ? "central" : this.textBaseline === "bottom" ? "text-after-edge" : this.textBaseline === "top" ? "text-before-edge" : "auto";
    const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paint = kind === "fill" ? `fill="${this._paint(this.fillStyle)}"` : `fill="none" stroke="${this._paint(this.strokeStyle)}" stroke-width="${this.lineWidth}" stroke-linejoin="round"`;
    this.out.push(`<text x="${x}" y="${y}" font-family="${(m[3] || "sans-serif").split(",")[0]}, sans-serif" font-size="${m[2]}" font-weight="${m[1] || 400}" text-anchor="${anchor}" dominant-baseline="${baseline}" ${paint}${this._common()}>${esc}</text>`);
  }
  fillText(text, x, y) { this._textEl(text, x, y, "fill"); }
  strokeText(text, x, y) { this._textEl(text, x, y, "stroke"); }
  drawImage(image, x, y, w, h) {
    const img = image;
    if (!img || !img.__dataUrl) return;
    this.out.push(`<image href="${img.__dataUrl}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${this._common()}/>`);
  }
  setLineDash(seg) { this.dash = seg; }
  createLinearGradient(x0, y0, x1, y1) { return new SvgGradient("linear", [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new SvgGradient("radial", [x0, y0, r0, x1, y1, r1]); }
  svg(bg, w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><defs>${this.defs.join("")}</defs>${this.out.join("")}</svg>`;
  }
}

/* ------------------------------------------------ sprite bank from disk */
const bank = {
  get(id) {
    const f = path.join(ROOT, "src", "assets", "sprites", `${id}.png`);
    if (!fs.existsSync(f)) return null;
    return { __dataUrl: `data:image/png;base64,${fs.readFileSync(f).toString("base64")}` };
  },
};

/* ------------------------------------------------ play + capture */
const W = 400, H = 640;
const outDir = path.join(ROOT, "screenshots");
fs.mkdirSync(outDir, { recursive: true });

async function main() {
for (const theme of G.getThemes()) {
  G.setActiveThemeId(theme.id);
  const sim = new G.KittySim({
    onScore: () => {}, onNext: () => {}, onMerge: () => {}, onDanger: () => {},
    onGameOver: () => {}, onDiscover: () => {},
  });
  let t = 0;
  sim.prime(t);
  let drops = 0;
  let captured = false;
  for (let f = 0; f < 60 * 90 && !captured; f++) {
    t += 1000 / 60;
    sim.step(t);
    if (f % 34 === 0 && sim.canDrop) {
      sim.setPointerWorldX(70 + ((drops * 53) % (W - 140)));
      if (sim.drop()) drops++;
    }
    const cats = sim.catViews().length;
    if (cats >= 6 && (sim.popups.length > 0 || sim.particles.length > 2)) {
      const ctx = new SvgCtx2D();
      G.renderScene(ctx, sim, t, { theme, sprites: bank });
      const file = path.join(outDir, `frame-${theme.id}.png`);
      // eslint-disable-next-line no-await-in-loop
      // eslint-disable-next-line no-await-in-loop
      await sharp(Buffer.from(ctx.svg(theme.hostBg, W, H))).png().toFile(file);
      console.log("✔", path.relative(ROOT, file));
      captured = true;
    }
  }
  if (!captured) console.error(`✖ no good frame for ${theme.id}`);
}

  /* ------------------------------------------------ danger countdown frame */
  {
    const theme = G.getThemes()[0];
    G.setActiveThemeId(theme.id);
    const sim = new G.KittySim({
      onScore: () => {}, onNext: () => {}, onMerge: () => {}, onDanger: () => {},
      onGameOver: () => {}, onDiscover: () => {},
    });
    let t = 0;
    sim.prime(t);
    let drops = 0;
    let raised = false;
    let done = false;
    for (let f = 0; f < 60 * 240 && !done; f++) {
      t += 1000 / 60;
      sim.step(t);
      if (f % 30 === 0 && sim.canDrop) {
        sim.setPointerWorldX(200 + ((drops % 3) - 1) * 34);
        if (sim.drop()) drops++;
      }
      if (!raised && sim.catViews().length >= 9) {
        sim.raiseCup(); // show the stretched cup in the shot
        raised = true;
      }
      if (sim.danger && sim.dangerLeft < 1500 && sim.dangerLeft > 300) {
        const ctx = new SvgCtx2D();
        G.renderScene(ctx, sim, t, { theme, sprites: bank });
        const file = path.join(outDir, "frame-danger.png");
        // eslint-disable-next-line no-await-in-loop
        await sharp(Buffer.from(ctx.svg(theme.hostBg, W, H))).png().toFile(file);
        console.log("✔", path.relative(ROOT, file));
        done = true;
      }
      if (sim.over) break;
    }
    if (!done) console.error("✖ no danger frame captured");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
