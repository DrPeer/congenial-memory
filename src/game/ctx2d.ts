/**
 * The minimal slice of the Canvas2D API the Kitty Drop renderer uses.
 *
 * The web build passes a real `CanvasRenderingContext2D`; the native build
 * passes a Skia-backed adapter (mobile/src/native/skiaCtx.ts). Because both
 * satisfy this interface, ONE renderer (render.ts + drawCat.ts) draws the game
 * everywhere and the two platforms can never drift apart visually.
 */
export interface Ctx2DGradient {
  addColorStop(offset: number, color: string): void;
}

export interface Ctx2D {
  /* state */
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  clip(): void;

  /* style (kept as plain strings so a real CanvasRenderingContext2D satisfies this) */
  fillStyle: string | Ctx2DGradient | object;
  strokeStyle: string | Ctx2DGradient | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;

  /* paths */
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ): void;

  /* draw */
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  /** image handle is platform-opaque: HTMLImageElement on web, SkImage on native */
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;

  /* extras used by the renderer */
  setLineDash(segments: number[]): void;
  lineDashOffset: number;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Ctx2DGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): Ctx2DGradient;
}

/** Parse "700 24px Fredoka, sans-serif" / "26px serif" into parts the adapters need. */
export function parseFont(font: string): { size: number; weight: number; family: string } {
  const m = font.match(/(?:(\d+)\s+)?([\d.]+)px\s+(.*)/i);
  if (!m) return { size: 16, weight: 400, family: "sans-serif" };
  return {
    weight: m[1] ? Number(m[1]) : 400,
    size: Number(m[2]),
    family: m[3] || "sans-serif",
  };
}
