import Matter from "matter-js";
import { CATS, MAX_TIER, MEGA_MERGE_BONUS, randomDropTier, type CatDef } from "./cats";
import { drawCat } from "./drawCat";
import { sfx } from "./sound";

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

interface CatData {
  tier: number;
  squish: number; // deformation
  squishV: number; // deformation velocity
  born: number;
  settledAt: number | null;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t0: number;
  life: number;
  vy: number;
}

interface Particle {
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
  points: number;
  combo: number;
  mega: boolean;
}

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onNext: (current: number, next: number) => void;
  onMerge: (e: MergeEvent) => void;
  onDanger: (danger: boolean) => void;
  onGameOver: (score: number, biggest: number) => void;
  onDiscover: (tier: number) => void;
}

export class KittyEngine {
  private engine = Engine.create({ enableSleeping: false });
  private cats = new Map<number, CatData>();
  private popups: Popup[] = [];
  private particles: Particle[] = [];
  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private running = false;
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
  private canDrop = true;
  private dropReadyAt = 0;
  private dangerSince: number | null = null;
  private danger = false;
  private dropCount = 0;

  private scale = 1;
  private offX = 0;
  private offY = 0;
  private dpr = 1;
  private ctx: CanvasRenderingContext2D;
  private mergeQueue: Array<{ a: Matter.Body; b: Matter.Body }> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: EngineCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    this.ctx = ctx;

    this.engine.gravity.y = 1.05;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;

    this.buildWalls();

    Events.on(this.engine, "collisionStart", (ev) => {
      for (const pair of ev.pairs) {
        const da = this.cats.get(pair.bodyA.id);
        const db = this.cats.get(pair.bodyB.id);
        // squish both
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
    const wallLen = Math.hypot(CUP_LEFT_BOT - CUP_LEFT_TOP, CUP_FLOOR - CUP_TOP) + 60;
    const ang = Math.atan((CUP_LEFT_BOT - CUP_LEFT_TOP) / (CUP_FLOOR - CUP_TOP));
    const opts = { isStatic: true, friction: 0.4, restitution: 0.1, label: "wall" };
    const left = Bodies.rectangle(
      (CUP_LEFT_TOP + CUP_LEFT_BOT) / 2 - thick / 2,
      (CUP_TOP + CUP_FLOOR) / 2 - 30,
      thick,
      wallLen,
      { ...opts, angle: -ang },
    );
    const right = Bodies.rectangle(
      (CUP_RIGHT_TOP + CUP_RIGHT_BOT) / 2 + thick / 2,
      (CUP_TOP + CUP_FLOOR) / 2 - 30,
      thick,
      wallLen,
      { ...opts, angle: ang },
    );
    const floor = Bodies.rectangle(WORLD_W / 2, CUP_FLOOR + thick / 2, WORLD_W + 200, thick, opts);
    World.add(this.engine.world, [left, right, floor]);
  }

  /* ---------- lifecycle ---------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    Events.off(this.engine, "collisionStart");
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
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

  /* ---------- input ---------- */

  setPointer(clientX: number) {
    const r = CATS[this.currentTier].radius;
    const x = this.toWorldX(clientX);
    this.pointerX = Math.max(CUP_LEFT_TOP + r + 4, Math.min(CUP_RIGHT_TOP - r - 4, x));
  }

  drop() {
    if (!this.canDrop || this.paused || this.over) return;
    const tier = this.currentTier;
    const r = CATS[tier].radius;
    const x = Math.max(CUP_LEFT_TOP + r + 4, Math.min(CUP_RIGHT_TOP - r - 4, this.pointerX));
    this.spawn(x, DROP_Y, tier, 1);
    this.dropCount++;
    sfx.pop(1.2 - tier * 0.08);
    this.canDrop = false;
    this.dropReadyAt = performance.now() + 550;

    this.currentTier = this.nextTier;
    this.nextTier = randomDropTier();
    this.cb.onNext(this.currentTier, this.nextTier);
    // re-clamp pointer for new radius
    const nr = CATS[this.currentTier].radius;
    this.pointerX = Math.max(CUP_LEFT_TOP + nr + 4, Math.min(CUP_RIGHT_TOP - nr - 4, this.pointerX));
  }

  /* ---------- world ---------- */

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
      settledAt: null,
    });
    World.add(this.engine.world, body);
    if (!this.discovered.has(tier)) {
      this.discovered.add(tier);
      if (tier > 4) this.cb.onDiscover(tier);
    }
    return body;
  }

  private removeBody(b: Matter.Body) {
    this.cats.delete(b.id);
    World.remove(this.engine.world, b);
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
      if (tier >= MAX_TIER) {
        mega = true;
        points = MEGA_MERGE_BONUS * this.combo;
        this.burst(mx, my, 40, ["👑", "✨", "⭐", "💖"]);
        this.addPopup(mx, my - 40, "MEGA MEOW!", "#ff3d6e", 34, 1800);
        sfx.fanfare();
      } else {
        const newTier = tier + 1;
        points = Math.round(CATS[newTier].points * mult);
        const nb = this.spawn(mx, my, newTier, 0.4);
        Body.setVelocity(nb, {
          x: (a.velocity.x + b.velocity.x) / 2,
          y: Math.min((a.velocity.y + b.velocity.y) / 2, 0) - 1.2,
        });
        this.biggest = Math.max(this.biggest, newTier);
        this.burst(mx, my, 6 + newTier * 2, ["💕", "✨", "🐾"]);
        sfx.meow(CATS[newTier].meowPitch, 0.18 + newTier * 0.012);
        if (this.combo > 1) sfx.chime(this.combo);
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

      this.score += points;
      this.addPopup(mx, my - 10, `+${points}`, mega ? "#ffb300" : "#ff5c8a", 20 + Math.min(this.combo, 6) * 2, 1100);
      if (this.combo > 1) {
        this.addPopup(mx, my - 40, `x${this.combo} COMBO`, "#8b5cf6", 16 + this.combo * 1.5, 1200);
      }
      if (navigator.vibrate) {
        try {
          navigator.vibrate(mega ? [40, 30, 60] : 12 + tier * 2);
        } catch {
          /* ignore */
        }
      }
      this.cb.onScore(this.score);
      this.cb.onMerge({ tier, points, combo: this.combo, mega });
    }
  }

  private addPopup(x: number, y: number, text: string, color: string, size: number, life: number) {
    this.popups.push({ x, y, text, color, size, t0: performance.now(), life, vy: -0.045 });
  }

  private burst(x: number, y: number, n: number, glyphs: string[]) {
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

  /* ---------- game over ---------- */

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
      if (body.position.y - r < DEAD_LINE_Y && slow) {
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
      if (now - this.dangerSince > 1800) this.endGame();
    } else {
      this.dangerSince = null;
      if (this.danger) {
        this.danger = false;
        this.cb.onDanger(false);
      }
    }
  }

  private endGame() {
    if (this.over) return;
    this.over = true;
    sfx.sad();
    this.cb.onGameOver(this.score, this.biggest);
  }

  /* ---------- loop ---------- */

  private frame(t: number) {
    const dt = Math.min(50, t - this.lastTime);
    this.lastTime = t;

    if (!this.paused && !this.over) {
      this.acc += dt;
      const step = 1000 / 60;
      let n = 0;
      while (this.acc >= step && n < 4) {
        Engine.update(this.engine, step);
        this.processMerges();
        this.acc -= step;
        n++;
      }
      if (n === 4) this.acc = 0;
      if (!this.canDrop && t >= this.dropReadyAt) this.canDrop = true;
      this.checkDanger(t);
    }

    // jelly spring update
    for (const d of this.cats.values()) {
      const k = 0.22;
      const damp = 0.82;
      d.squishV += -k * d.squish;
      d.squishV *= damp;
      d.squish += d.squishV;
    }

    this.render(t);
  }

  /* ---------- rendering ---------- */

  private render(now: number) {
    const ctx = this.ctx;
    const { dpr, scale, offX, offY } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);

    this.drawBackground(now);
    this.drawCup();

    // cats
    const bodies = Composite.allBodies(this.engine.world);
    for (const body of bodies) {
      if (body.label !== "cat") continue;
      const d = this.cats.get(body.id);
      if (!d) continue;
      const def = CATS[d.tier];
      const r = body.circleRadius ?? def.radius;
      const age = now - d.born;
      const grow = age < 260 ? easeOutBack(age / 260) : 1;
      const s = Math.max(0.05, grow);
      const sq = Math.max(-0.35, Math.min(0.35, d.squish));
      drawCat(ctx, body.position.x, body.position.y, r, def, s * (1 + sq), s * (1 - sq), body.angle);
    }

    this.drawDropper(now);
    this.drawDeadLine(now);
    this.drawParticles(now);
    this.drawPopups(now);
  }

  private drawBackground(now: number) {
    const ctx = this.ctx;
    // floating decorative paw prints & hearts
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.font = "26px serif";
    ctx.textAlign = "center";
    const items = ["🐾", "💗", "🐾", "🧶", "🐾", "💗", "🐟", "🐾"];
    for (let i = 0; i < items.length; i++) {
      const x = ((i * 137 + 40) % WORLD_W);
      const y = ((i * 211 + (now * 0.01)) % (WORLD_H + 60)) - 30;
      ctx.fillText(items[i], x, y);
    }
    ctx.restore();
  }

  private drawCup() {
    const ctx = this.ctx;
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
    ctx.lineTo(CUP_RIGHT_BOT + 6, CUP_FLOOR + 8);
    ctx.quadraticCurveTo(WORLD_W / 2, CUP_FLOOR + 22, CUP_LEFT_BOT - 6, CUP_FLOOR + 8);
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

  private drawDeadLine(now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -(now * 0.02) % 18;
    ctx.lineWidth = 3;
    if (this.danger) {
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
    if (this.danger) {
      ctx.font = "bold 14px Fredoka, sans-serif";
      ctx.fillStyle = "#ff3d6e";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ TOO FULL! ⚠️", WORLD_W / 2, DEAD_LINE_Y - 8);
    }
    ctx.restore();
  }

  private drawDropper(now: number) {
    if (this.over) return;
    const ctx = this.ctx;
    const def = CATS[this.currentTier];
    const r = def.radius;
    const x = Math.max(CUP_LEFT_TOP + r + 4, Math.min(CUP_RIGHT_TOP - r - 4, this.pointerX));
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

    if (!this.canDrop) {
      // ghost while reloading
      ctx.save();
      ctx.globalAlpha = 0.35;
      const p = Math.min(1, 1 - (this.dropReadyAt - now) / 550);
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

  private drawParticles(now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.particles = this.particles.filter((p) => now - p.t0 < p.life);
    for (const p of this.particles) {
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

  private drawPopups(now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.popups = this.popups.filter((p) => now - p.t0 < p.life);
    for (const p of this.popups) {
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

  /* ---------- helpers ---------- */

  getBiggest() {
    return this.biggest;
  }
  getDropCount() {
    return this.dropCount;
  }
  getCatDef(tier: number): CatDef {
    return CATS[tier];
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
