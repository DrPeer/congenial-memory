/**
 * KittyEngine — the WEB host for the shared game core.
 *
 * All rules live in sim.ts and all painting in render.ts; this file only owns
 * the DOM canvas, the requestAnimationFrame loop, pointer→world mapping and the
 * browser-side juice (WebAudio sfx + navigator.vibrate). The native app runs the
 * very same sim/render through Skia instead.
 */
import { CATS } from "./cats";
import { renderScene } from "./render";
import { sfx } from "./sound";
import { webSprites } from "./spritesWeb";
import { KittySim, WORLD_H, WORLD_W, type MergeEvent, type ModeDef, type SimCallbacks } from "./sim";
import type { LevelDef } from "./levels";
import type { CupSkin, Trail } from "./shop";
import { activeTheme } from "../plugins/registry";

export type EngineCallbacks = SimCallbacks;
export type { MergeEvent };
export { WORLD_W, WORLD_H };

export class KittyEngine {
  private sim: KittySim;
  private raf = 0;
  private running = false;

  private scale = 1;
  private offX = 0;
  private offY = 0;
  private dpr = 1;
  private ctx: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    cb: EngineCallbacks & { onWin?: () => void },
    level?: LevelDef,
    mode?: ModeDef,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    this.ctx = ctx;

    this.sim = new KittySim({
      onScore: cb.onScore,
      onNext: cb.onNext,
      onDanger: cb.onDanger,
      onDiscover: cb.onDiscover,
      onWin: () => cb.onWin?.(),
      onGameOver: (s, biggest) => {
        sfx.sad();
        cb.onGameOver(s, biggest);
      },
      onMerge: (e: MergeEvent) => {
        if (e.mega) {
          sfx.fanfare();
        } else if (e.newTier !== null) {
          sfx.meow(CATS[e.newTier].meowPitch, 0.18 + e.newTier * 0.012);
        }
        if (e.combo > 1) sfx.chime(e.combo);
        if (navigator.vibrate) {
          try {
            navigator.vibrate(e.mega ? [40, 30, 60] : 12 + e.tier * 2);
          } catch {
            /* ignore */
          }
        }
        cb.onMerge(e);
      },
    }, level, mode);
  }

  get paused() {
    return this.sim.paused;
  }
  set paused(v: boolean) {
    this.sim.paused = v;
  }
  get over() {
    return this.sim.over;
  }
  get score() {
    return this.sim.score;
  }
  get combo() {
    return this.sim.combo;
  }
  get cupLift() {
    return this.sim.cupLift;
  }
  get raiseLeft() {
    return this.sim.raiseLeft;
  }

  /** equipped cosmetics: basket paint + merge trail */
  setLook(look: { cupSkin?: CupSkin; trail?: Trail }) {
    this.look = look;
    this.sim.setFx(look.trail?.sprites ?? null);
  }
  private look: { cupSkin?: CupSkin; trail?: Trail } = {};
  get coinsEarned() {
    return this.sim.coinsEarned;
  }

  /** ad/coin revive: clears the stack top and continues the run */
  revive(): boolean {
    return this.sim.revive();
  }
  get won() {
    return this.sim.won;
  }
  get level() {
    return this.sim.level;
  }

  /** coin booster: shoot the topmost kitty out of the cup (auto-aim fallback) */
  shootCat(): boolean {
    return this.fire(this.sim.shootTopCat());
  }

  /* -------- scope mode: player picks WHICH kitty to shoot -------- */

  get aiming(): boolean {
    return this.sim.aiming;
  }
  beginAim() {
    this.sim.beginAim();
  }
  cancelAim() {
    this.sim.cancelAim();
  }
  setAim(clientX: number, clientY: number) {
    const w = this.toWorld(clientX, clientY);
    this.sim.setAim(w.x, w.y);
  }
  shootAtAim(): boolean {
    return this.fire(this.sim.shootAtAim());
  }
  private fire(ok: boolean): boolean {
    if (ok) {
      sfx.shoot();
      try {
        navigator.vibrate?.(20);
      } catch {
        /* ignore */
      }
    }
    return ok;
  }

  /** coin booster: stretch the cup taller */
  boostRaiseCup(): boolean {
    const ok = this.sim.raiseCup();
    if (ok) {
      sfx.raiseCup();
      try {
        navigator.vibrate?.([15, 20, 15]);
      } catch {
        /* ignore */
      }
    }
    return ok;
  }

  /* ---------- lifecycle ---------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.sim.prime(performance.now());
    const loop = (t: number) => {
      if (!this.running) return;
      this.sim.step(t);
      this.render(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.sim.destroy();
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    this.offX = (cssW - WORLD_W * this.scale) / 2;
    this.offY = (cssH - WORLD_H * this.scale) / 2;
  }

  toWorldX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return (clientX - rect.left - this.offX) / this.scale;
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offX) / this.scale,
      y: (clientY - rect.top - this.offY) / this.scale,
    };
  }

  /* ---------- input ---------- */

  setPointer(clientX: number) {
    this.sim.setPointerWorldX(this.toWorldX(clientX));
  }

  drop() {
    const tier = this.sim.currentTier;
    if (this.sim.drop()) sfx.pop(1.2 - tier * 0.08);
  }

  /* ---------- rendering ---------- */

  private render(now: number) {
    const ctx = this.ctx;
    const { dpr, scale, offX, offY } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);
    const base = activeTheme();
    const theme = this.look.cupSkin ? { ...base, ...this.look.cupSkin.paint } : base;
    renderScene(ctx, this.sim, now, { theme, sprites: webSprites });
  }

  /* ---------- passthroughs kept for compatibility ---------- */

  getBiggest() {
    return this.sim.getBiggest();
  }
  getDropCount() {
    return this.sim.getDropCount();
  }
  getCatDef(tier: number) {
    return CATS[tier];
  }
}
