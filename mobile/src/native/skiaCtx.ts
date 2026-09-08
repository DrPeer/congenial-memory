/**
 * SkiaCtx2D — implements the shared Ctx2D interface on top of React Native Skia.
 *
 * This adapter is the ONLY platform-specific drawing code in the native app:
 * src/game/render.ts + drawCat.ts run unmodified and paint through it, exactly
 * like they paint through a DOM canvas on the web.
 *
 * Mapping notes (Canvas2D -> Skia):
 *  - paths: one SkPath per beginPath(); arcs/ellipses become addArc/addOval contours
 *  - save/restore: Skia stacks matrix+clip; style state is stacked here in JS
 *  - gradients: Skia shaders built at fill/stroke time (user-space coords, same transform)
 *  - dashes: SkPathEffect.MakeDash
 *  - text: matchFont() system fonts (emoji codepoints fall back to the emoji font)
 */
import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  matchFont,
  type SkCanvas,
  type SkFont,
  type SkImage,
  type SkPaint,
  type SkPath,
} from "@shopify/react-native-skia";

import { parseFont, type Ctx2D, type Ctx2DGradient } from "../../../src/game/ctx2d";

const DEG = 180 / Math.PI;

class Gradient implements Ctx2DGradient {
  readonly stops: Array<{ o: number; c: string }> = [];
  constructor(
    readonly kind: "linear" | "radial",
    readonly args: number[],
  ) {}
  addColorStop(offset: number, color: string) {
    this.stops.push({ o: offset, c: color });
  }
}

interface StyleState {
  fillStyle: string | Ctx2DGradient | object;
  strokeStyle: string | Ctx2DGradient | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  lineDash: number[];
  lineDashOffset: number;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;

/** fold globalAlpha into rgba()/hex css colors; returns something Skia.Color() understands */
function withAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgba) {
    const a = (rgba[4] === undefined ? 1 : Number(rgba[4])) * alpha;
    return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${a})`;
  }
  // hex
  const hex = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) {
      const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
      return `#${h}${a}`;
    }
    if (h.length === 8) {
      const prev = parseInt(h.slice(6, 8), 16) / 255;
      const a = Math.round(prev * alpha * 255).toString(16).padStart(2, "0");
      return `#${h.slice(0, 6)}${a}`;
    }
  }
  return color;
}

export class SkiaCtx2D implements Ctx2D {
  /* style state (part of the Ctx2D contract) */
  fillStyle: string | Ctx2DGradient | object = "#000000";
  strokeStyle: string | Ctx2DGradient | object = "#000000";
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  globalAlpha = 1;
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  lineDashOffset = 0;

  private lineDash: number[] = [];
  private path: SkPath = Skia.Path.Make();
  private stack: StyleState[] = [];
  private fillPaint: SkPaint = Skia.Paint();
  private strokePaint: SkPaint = Skia.Paint();
  private fontCache = new Map<string, SkFont>();

  constructor(private canvas: SkCanvas) {}

  setLineDash(segments: number[]) {
    this.lineDash = segments && segments.length ? segments.slice() : [];
  }

  /* ------------------------------------------------------------ state */

  save() {
    this.canvas.save();
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      lineDash: this.lineDash.slice(),
      lineDashOffset: this.lineDashOffset,
    });
  }

  restore() {
    this.canvas.restore();
    const s = this.stack.pop();
    if (!s) return;
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap;
    this.lineJoin = s.lineJoin;
    this.globalAlpha = s.globalAlpha;
    this.font = s.font;
    this.textAlign = s.textAlign;
    this.textBaseline = s.textBaseline;
    this.lineDash = s.lineDash;
    this.lineDashOffset = s.lineDashOffset;
  }

  translate(x: number, y: number) {
    this.canvas.translate(x, y);
  }
  rotate(rad: number) {
    this.canvas.rotate(rad * DEG, 0, 0);
  }
  scale(x: number, y: number) {
    this.canvas.scale(x, y);
  }
  clip() {
    this.canvas.clipPath(this.path, ClipOp.Intersect, true);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const p = Skia.Path.Make();
    p.addRect({ x, y, width: w, height: h });
    const paint = this.fillPaint;
    paint.setStyle(PaintStyle.Fill);
    this.applyStyle(paint, this.fillStyle);
    this.canvas.drawPath(p, paint);
  }

  /* ------------------------------------------------------------ paths */

  beginPath() {
    this.path = Skia.Path.Make();
  }
  closePath() {
    this.path.close();
  }
  moveTo(x: number, y: number) {
    this.path.moveTo(x, y);
  }
  lineTo(x: number, y: number) {
    this.path.lineTo(x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.path.quadTo(cpx, cpy, x, y);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number) {
    this.path.cubicTo(a, b, c, d, x, y);
  }
  arc(x: number, y: number, r: number, start: number, end: number) {
    this.path.addArc({ x: x - r, y: y - r, width: r * 2, height: r * 2 }, start * DEG, (end - start) * DEG);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number) {
    const full = Math.abs(end - start - Math.PI * 2) < 1e-6;
    if (full && Math.abs(rotation) < 1e-6) {
      this.path.addOval({ x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 });
      return;
    }
    if (full) {
      const oval = Skia.Path.Make();
      oval.addOval({ x: -rx, y: -ry, width: rx * 2, height: ry * 2 });
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      // row-major 3x3: [c -s tx | s c ty | 0 0 1]
      oval.transform([c, -s, x, s, c, y, 0, 0, 1]);
      this.path.addPath(oval);
      return;
    }
    // partial, unrotated fallback
    this.path.addArc({ x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 }, start * DEG, (end - start) * DEG);
  }

  /* ------------------------------------------------------------ drawing */

  fill() {
    const paint = this.fillPaint;
    paint.setStyle(PaintStyle.Fill);
    this.applyStyle(paint, this.fillStyle);
    this.canvas.drawPath(this.path, paint);
  }

  stroke() {
    const paint = this.strokePaint;
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(this.lineWidth);
    paint.setStrokeCap(this.lineCap === "round" ? StrokeCap.Round : this.lineCap === "square" ? StrokeCap.Butt : StrokeCap.Butt);
    paint.setStrokeJoin(this.lineJoin === "round" ? StrokeJoin.Round : this.lineJoin === "bevel" ? StrokeJoin.Bevel : StrokeJoin.Miter);
    paint.setPathEffect(this.lineDash.length ? Skia.PathEffect.MakeDash(this.lineDash, this.lineDashOffset) : null);
    this.applyStyle(paint, this.strokeStyle);
    this.canvas.drawPath(this.path, paint);
  }

  private applyStyle(paint: SkPaint, style: string | Ctx2DGradient | object) {
    paint.setAntiAlias(true);
    paint.setAlphaf(1);
    if (style instanceof Gradient) {
      const g = style;
      const colors = g.stops.map((s) => Skia.Color(withAlpha(s.c, this.globalAlpha)));
      const pos = g.stops.map((s) => s.o);
      if (g.kind === "linear") {
        const [x0, y0, x1, y1] = g.args;
        paint.setShader(
          Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors, pos, TileMode.Clamp),
        );
      } else {
        const [x0, y0, r0, x1, , r1] = g.args;
        // approximate the inner circle by shifting the color stops
        const k = r1 > 0 ? Math.max(0, Math.min(1, r0 / r1)) : 0;
        const shifted = pos.map((p) => k + p * (1 - k));
        void x0;
        void y0;
        paint.setShader(Skia.Shader.MakeRadialGradient({ x: x1, y: g.args[4] }, r1, colors, shifted, TileMode.Clamp));
      }
      return;
    }
    paint.setShader(null);
    const css = typeof style === "string" ? style : "#000000";
    paint.setColor(Skia.Color(withAlpha(css, this.globalAlpha)));
  }

  /* ------------------------------------------------------------ text */

  private fontFor(text: string): SkFont {
    const { size, weight } = parseFont(this.font);
    const emoji = EMOJI_RE.test(text);
    const key = `${emoji ? "e" : "t"}:${Math.round(size)}:${weight}`;
    let f = this.fontCache.get(key);
    if (!f) {
      f = emoji ? matchFont({ fontSize: size }) : matchFont({ fontSize: size, fontWeight: String(weight) as never });
      this.fontCache.set(key, f);
    }
    return f;
  }

  private textPos(text: string, x: number, y: number, font: SkFont): { x: number; y: number } {
    const w = font.measureText(text).width;
    let dx = 0;
    if (this.textAlign === "center") dx = -w / 2;
    else if (this.textAlign === "right" || this.textAlign === "end") dx = -w;
    const m = font.getMetrics();
    let dy = 0;
    if (this.textBaseline === "middle") dy = -(m.ascent + m.descent) / 2;
    else if (this.textBaseline === "top") dy = -m.ascent;
    else if (this.textBaseline === "bottom") dy = -m.descent;
    return { x: x + dx, y: y + dy };
  }

  fillText(text: string, x: number, y: number) {
    const font = this.fontFor(text);
    const paint = this.fillPaint;
    paint.setStyle(PaintStyle.Fill);
    paint.setPathEffect(null);
    this.applyStyle(paint, this.fillStyle);
    const p = this.textPos(text, x, y, font);
    this.canvas.drawText(text, p.x, p.y, paint, font);
  }

  strokeText(text: string, x: number, y: number) {
    const font = this.fontFor(text);
    const paint = this.strokePaint;
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(this.lineWidth);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setPathEffect(null);
    this.applyStyle(paint, this.strokeStyle);
    const p = this.textPos(text, x, y, font);
    this.canvas.drawText(text, p.x, p.y, paint, font);
  }

  drawImage(image: unknown, x: number, y: number, w: number, h: number) {
    const img = image as SkImage | null;
    if (!img || typeof img.width !== "function") return;
    const paint = this.fillPaint;
    paint.setStyle(PaintStyle.Fill);
    paint.setShader(null);
    paint.setPathEffect(null);
    paint.setAlphaf(this.globalAlpha);
    this.canvas.drawImageRect(
      img,
      { x: 0, y: 0, width: img.width(), height: img.height() },
      { x, y, width: w, height: h },
      paint,
    );
  }

  /* ------------------------------------------------------------ gradients */

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Ctx2DGradient {
    return new Gradient("linear", [x0, y0, x1, y1]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Ctx2DGradient {
    return new Gradient("radial", [x0, y0, r0, x1, y1, r1]);
  }
}
