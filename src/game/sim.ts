/**
 * KittySim — the platform-neutral heart of Kitty Drop.
 *
 * Pure TypeScript: matter-js physics + all game rules (merges, combos, scoring,
 * danger line, discovery, game over) + transient fx state (popups, particles).
 * No DOM, no canvas, no audio: rendering lives in render.ts (draws through the
 * Ctx2D interface) and sound/haptics are the host's job, driven by the callbacks.
 *
 * The web build wraps this in src/game/engine.ts (DOM canvas + WebAudio);
 * the native build wraps it in mobile/src/native/* (Skia + expo-audio/haptics).
 */
import Matter from "matter-js";
import { CATS, MAX_TIER, MEGA_MERGE_BONUS, randomDropTier } from "./cats";

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

export const WORLD_W = 400;
export const WORLD_H = 640;
export const CUP_TOP = 150;
export const CUP_FLOOR = 620;
export const CUP_LEFT_TOP = 22;
export const CUP_RIGHT_TOP = 378;
export const CUP_LEFT_BOT = 52;
export const CUP_RIGHT_BOT = 348;
export const DROP_Y = 82;
export const DEAD_LINE_Y = 168;

/* booster economy + limits (shared by web & native hosts) */
export const BOOST_SHOOT_COST = 8;
export const BOOST_RAISE_COST = 12;
export const MAX_CUP_LIFT = 120;
export const CUP_LIFT_STEP = 60;
/** how long an overfull cup survives before game over (the countdown) */
export const DANGER_FUSE_MS = 1800;

export interface CatView {
  x: number;
  y: number;
  r: number;
  angle: number;
  tier: number;
  squish: number;
  born: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t0: number;
  life: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  glyph: string;
  size: number;
  rot: number;
  vr: number;
}

export interface MergeEvent {
  tier: number;
  /** tier created by the merge (null for the MEGA merge) */
  newTier: number | null;
  points: number;
  combo: number;
  mega: boolean;
  /** coins this merge minted for the player's wallet */
  coins: number;
}

export interface Shot {
  x: number;
  y: number;
  tier: number;
  t0: number;
}

export interface SimCallbacks {
  onScore: (score: number) => void;
  onNext: (current: number, next: number) => void;
  onMerge: (e: MergeEvent) => void;
  onDanger: (danger: boolean) => void;
  onGameOver: (score: number, biggest: number) => void;
  onDiscover: (tier: number) => void;
}

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class KittySim {
  private engine = Engine.create({ enableSleeping: false });
  private cats = new Map<number, { tier: number; squish: number; squishV: number; born: number }>();
  private mergeQueue: Array<{ a: Matter.Body; b: Matter.Body }> = [];
  private lastTime = 0;
  private acc = 0;

  popups: Popup[] = [];
  particles: Particle[] = [];

  paused = false;
  over = false;
  score = 0;
  combo = 0;
  private lastMergeAt = 0;
  private biggest = 0;
  private discovered = new Set<number>();

  currentTier = randomDropTier();
  nextTier = randomDropTier();
  pointerX = WORLD_W / 2;
  canDrop = true;
  dropReadyAt = 0;
  danger = false;
  private dangerSince: number | null = null;
  /** ms left on the overfull countdown while `danger` is true */
  dangerLeft = 0;
  dropCount = 0;
  /** cup stretch bought via the raise booster (raises rim + danger line) */
  cupLift = 0;
  /** kitties launched out by the shoot booster (renderer animates them) */
  shots: Shot[] = [];
  /** coins minted this run */
  coinsEarned = 0;

  get cupTop(): number {
    return CUP_TOP - this.cupLift;
  }
  get deadLineY(): number {
    return DEAD_LINE_Y - this.cupLift;
  }

  constructor(private cb: SimCallbacks) {
    this.engine.gravity.y = 1.05;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;
    this.buildWalls();

    Events.on(this.engine, "collisionStart", (ev) => {
      for (const pair of ev.pairs) {
        const da = this.cats.get(pair.bodyA.id);
        const db = this.cats.get(pair.bodyB.id);
        const rel = Math.hypot(
          pair.bodyA.velocity.x - pair.bodyB.velocity.x,
          pair.bodyA.velocity.y - pair.bodyB.velocity.y,
        );
        const impact = Math.min(0.32, rel * 0.035);
        if (da) da.squishV += impact;
        if (db) db.squishV += impact;
        if (da && db && da.tier === db.tier) {
          this.mergeQueue.push({ a: pair.bodyA, b: pair.bodyB });
        }
      }
    });

    this.cb.onNext(this.currentTier, this.nextTier);
    this.cb.onScore(0);
  }

  private buildWalls() {
    const thick = 40;
    // walls are born MAX_CUP_LIFT taller so the raise booster needs no rebuild
    const wallLen = Math.hypot(CUP_LEFT_BOT - CUP_LEFT_TOP, CUP_FLOOR - CUP_TOP) + 60 + MAX_CUP_LIFT;
    const ang = Math.atan((CUP_LEFT_BOT - CUP_LEFT_TOP) / (CUP_FLOOR - CUP_TOP));
    const opts = { isStatic: true, friction: 0.4, restitution: 0.1, label: "wall" };
    const left = Bodies.rectangle(
      (CUP_LEFT_TOP + CUP_LEFT_BOT) / 2 - thick / 2,
      (CUP_TOP - MAX_CUP_LIFT + CUP_FLOOR) / 2 - 30,
      thick,
      wallLen,
      { ...opts, angle: -ang },
    );
    const right = Bodies.rectangle(
      (CUP_RIGHT_TOP + CUP_RIGHT_BOT) / 2 + thick / 2,
      (CUP_TOP - MAX_CUP_LIFT + CUP_FLOOR) / 2 - 30,
      thick,
      wallLen,
      { ...opts, angle: ang },
    );
    const floor = Bodies.rectangle(WORLD_W / 2, CUP_FLOOR + thick / 2, WORLD_W + 200, thick, opts);
    World.add(this.engine.world, [left, right, floor]);
  }

  destroy() {
    Events.off(this.engine, "collisionStart");
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.cats.clear();
    this.popups = [];
    this.particles = [];
  }

  /* ------------------------------------------------------------ input */

  clampX(x: number, tier: number): number {
    const r = CATS[tier].radius;
    return Math.max(CUP_LEFT_TOP + r + 4, Math.min(CUP_RIGHT_TOP - r - 4, x));
  }

  setPointerWorldX(x: number) {
    this.pointerX = this.clampX(x, this.currentTier);
  }

  drop(): boolean {
    const now = performance.now();
    if (!this.canDrop || this.paused || this.over) return false;
    const tier = this.currentTier;
    const x = this.clampX(this.pointerX, tier);
    this.spawn(x, DROP_Y, tier, 1);
    this.dropCount++;
    this.canDrop = false;
    this.dropReadyAt = now + 550;

    this.currentTier = this.nextTier;
    this.nextTier = randomDropTier();
    this.cb.onNext(this.currentTier, this.nextTier);
    this.pointerX = this.clampX(this.pointerX, this.currentTier);
    return true;
  }

  /* ------------------------------------------------------------ world */

  private spawn(x: number, y: number, tier: number, bornScale: number): Matter.Body {
    const def = CATS[tier];
    const body = Bodies.circle(x, y, def.radius, {
      restitution: 0.18,
      friction: 0.25,
      frictionStatic: 0.6,
      frictionAir: 0.004,
      density: 0.0012 + tier * 0.0002,
      label: "cat",
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
    this.cats.set(body.id, {
      tier,
      squish: 0,
      squishV: bornScale < 1 ? 0.25 : 0,
      born: performance.now(),
    });
    World.add(this.engine.world, body);
    if (!this.discovered.has(tier)) {
      this.discovered.add(tier);
      if (tier > 4) this.cb.onDiscover(tier);
    }
    return body;
  }

  private removeBody(body: Matter.Body) {
    this.cats.delete(body.id);
    World.remove(this.engine.world, body);
  }

  private processMerges() {
    if (this.mergeQueue.length === 0) return;
    const used = new Set<number>();
    const queue = this.mergeQueue;
    this.mergeQueue = [];
    for (const { a, b } of queue) {
      if (used.has(a.id) || used.has(b.id)) continue;
      const da = this.cats.get(a.id);
      const db = this.cats.get(b.id);
      if (!da || !db || da.tier !== db.tier) continue;
      used.add(a.id);
      used.add(b.id);

      const tier = da.tier;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;
      const now = performance.now();

      this.combo = now - this.lastMergeAt < 1400 ? this.combo + 1 : 1;
      this.lastMergeAt = now;
      const mult = 1 + (this.combo - 1) * 0.5;

      this.removeBody(a);
      this.removeBody(b);

      let points: number;
      let mega = false;
      let newTier: number | null = null;
      if (tier >= MAX_TIER) {
        mega = true;
        points = MEGA_MERGE_BONUS * this.combo;
        this.burst(mx, my, 40, ["👑", "✨", "⭐", "💖"]);
        this.addPopup(mx, my - 40, "MEGA MEOW!", "#ff3d6e", 34, 1800);
      } else {
        newTier = tier + 1;
        points = Math.round(CATS[newTier].points * mult);
        const nb = this.spawn(mx, my, newTier, 0.4);
        Body.setVelocity(nb, {
          x: (a.velocity.x + b.velocity.x) / 2,
          y: Math.min((a.velocity.y + b.velocity.y) / 2, 0) - 1.2,
        });
        this.biggest = Math.max(this.biggest, newTier);
        this.burst(mx, my, 6 + newTier * 2, ["💕", "✨", "🐾"]);
        // nudge neighbours slightly (soft poof)
        for (const body of Composite.allBodies(this.engine.world)) {
          if (body.label !== "cat" || body.id === nb.id) continue;
          const dx = body.position.x - mx;
          const dy = body.position.y - my;
          const d = Math.hypot(dx, dy);
          if (d < CATS[newTier].radius * 2 && d > 0.01) {
            const f = 0.0008 * body.mass;
            Body.applyForce(body, body.position, { x: (dx / d) * f, y: (dy / d) * f * 0.3 });
          }
        }
      }

      const coins = mega ? 10 : newTier!;
      this.coinsEarned += coins;
      this.score += points;
      this.addPopup(mx, my - 10, `+${points}`, mega ? "#ffb300" : "#ff5c8a", 20 + Math.min(this.combo, 6) * 2, 1100);
      if (this.combo > 1) {
        this.addPopup(mx, my - 40, `x${this.combo} COMBO`, "#8b5cf6", 16 + this.combo * 1.5, 1200);
      }
      this.cb.onScore(this.score);
      this.cb.onMerge({ tier, newTier, points, combo: this.combo, mega, coins });
    }
  }

  addPopup(x: number, y: number, text: string, color: string, size: number, life: number) {
    this.popups.push({ x, y, text, color, size, t0: performance.now(), life, vy: -0.045 });
  }

  burst(x: number, y: number, n: number, glyphs: string[]) {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.08 + Math.random() * 0.22;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.1,
        t0: now,
        life: 700 + Math.random() * 500,
        glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
        size: 10 + Math.random() * 10,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.01,
      });
    }
  }

  /* ------------------------------------------------------------ boosters */

  /** Coin booster: stretch the cup upward (rim + danger line rise). */
  raiseCup(): boolean {
    if (this.over || this.cupLift >= MAX_CUP_LIFT) return false;
    this.cupLift += CUP_LIFT_STEP;
    this.addPopup(WORLD_W / 2, this.cupTop - 10, "CUP UP!", "#2fb78a", 26, 1400);
    this.burst(WORLD_W / 2, this.cupTop + 10, 18, ["✨", "⭐", "✨"]);
    return true;
  }

  /** Coin booster: shoot the topmost kitty clean out of the cup. */
  shootTopCat(): boolean {
    if (this.over) return false;
    const now = performance.now();
    let top: Matter.Body | null = null;
    let topY = Infinity;
    for (const body of Composite.allBodies(this.engine.world)) {
      if (body.label !== "cat") continue;
      const d = this.cats.get(body.id);
      if (!d || now - d.born < 500) continue;
      if (body.position.y < topY) {
        topY = body.position.y;
        top = body;
      }
    }
    if (!top) return false;
    const d = this.cats.get(top.id)!;
    this.shots.push({ x: top.position.x, y: topY, tier: d.tier, t0: now });
    this.removeBody(top);
    this.burst(top.position.x, topY, 14, ["💨", "✨", "⭐"]);
    this.addPopup(top.position.x, topY - 30, "BYE-KITTY!", "#5aa7e8", 22, 1200);
    return true;
  }

  /* ------------------------------------------------------------ game over */

  private checkDanger(now: number) {
    let anyAbove = false;
    for (const body of Composite.allBodies(this.engine.world)) {
      if (body.label !== "cat") continue;
      const d = this.cats.get(body.id);
      if (!d) continue;
      const r = body.circleRadius ?? 0;
      const age = now - d.born;
      if (age < 900) continue;
      const slow = Math.hypot(body.velocity.x, body.velocity.y) < 2.5;
      if (body.position.y - r < this.deadLineY && slow) {
        anyAbove = true;
        break;
      }
    }
    if (anyAbove) {
      if (this.dangerSince === null) this.dangerSince = now;
      if (!this.danger) {
        this.danger = true;
        this.cb.onDanger(true);
      }
      this.dangerLeft = Math.max(0, DANGER_FUSE_MS - (now - this.dangerSince));
      if (now - this.dangerSince > DANGER_FUSE_MS) this.endGame();
    } else {
      this.dangerSince = null;
      this.dangerLeft = 0;
      if (this.danger) {
        this.danger = false;
        this.cb.onDanger(false);
      }
    }
  }

  private endGame() {
    if (this.over) return;
    this.over = true;
    this.cb.onGameOver(this.score, this.biggest);
  }

  /* ------------------------------------------------------------ stepping */

  /** Advance the simulation. `t` is the frame clock (ms), same contract as the web RAF loop. */
  step(t: number) {
    const dt = Math.min(50, t - this.lastTime);
    this.lastTime = t;

    if (!this.paused && !this.over) {
      this.acc += dt;
      const stepMs = 1000 / 60;
      let n = 0;
      while (this.acc >= stepMs && n < 4) {
        Engine.update(this.engine, stepMs);
        this.processMerges();
        this.acc -= stepMs;
        n++;
      }
      if (n === 4) this.acc = 0;
      if (!this.canDrop && t >= this.dropReadyAt) this.canDrop = true;
      this.checkDanger(t);
    }

    this.shots = this.shots.filter((sh) => t - sh.t0 < 700);

    // jelly spring update
    for (const d of this.cats.values()) {
      const k = 0.22;
      const damp = 0.82;
      d.squishV += -k * d.squish;
      d.squishV *= damp;
      d.squish += d.squishV;
    }
  }

  /** Prime the frame clock so the first step doesn't see a huge dt. */
  prime(t: number) {
    this.lastTime = t;
  }

  /* ------------------------------------------------------------ views for the renderer */

  catViews(): CatView[] {
    const out: CatView[] = [];
    for (const body of Composite.allBodies(this.engine.world)) {
      if (body.label !== "cat") continue;
      const d = this.cats.get(body.id);
      if (!d) continue;
      out.push({
        x: body.position.x,
        y: body.position.y,
        r: body.circleRadius ?? CATS[d.tier].radius,
        angle: body.angle,
        tier: d.tier,
        squish: d.squish,
        born: d.born,
      });
    }
    return out;
  }

  getBiggest() {
    return this.biggest;
  }
  getDropCount() {
    return this.dropCount;
  }
}
