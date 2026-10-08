import { C } from "./palette";

/**
 * FIELD RUN: a tiny landscape lane-runner. Drive the Versor rover down the crop rows, change lanes to
 * dodge weeds, rocks, stumps and hay bales, scoop up seeds. Hit anything and you crash.
 * Pure canvas 2D, smooth vector drawing (no pixel art).
 */

export type Phase = "ready" | "playing" | "crashed" | "paused";
export interface Hud {
  score: number;
  best: number;
  /** 0..1 how fast we are going (for the speed bar) */
  speed: number;
  seeds: number;
}
export interface Callbacks {
  onPhase(p: Phase): void;
  onHud(h: Hud): void;
}

export const GAME_W = 960;
export const GAME_H = 540;
const LANES = 4;
const LANE_Y = [274, 346, 418, 490];
const ROVER_X = 214;
const BEST_KEY = "versor-field-run-best";
const PX_PER_M = 30;

type ObKind = "weed" | "rock" | "stump" | "bale";
type Ob = { kind: ObKind; lane: number; x: number; w: number; seed: number };
type Pick = { kind: "seed" | "gold"; lane: number; x: number; ph: number };
type Part = {
  kind: "mist" | "dust" | "smoke" | "spark" | "text";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  r: number;
  text?: string;
  rot?: number;
};

const OB_W: Record<ObKind, number> = { weed: 52, rock: 68, stump: 52, bale: 80 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class FieldRun {
  phase: Phase = "ready";

  private ctx: CanvasRenderingContext2D;
  private k = 1; // canvas px per logical px
  private font: string;

  private dist = 0;
  private elapsed = 0;
  private speed = 0;
  private mul = 1;
  private boost: -1 | 0 | 1 = 0;
  private lane = 2;
  private laneF = 2;
  private wheel = 0;
  private time = 0;

  private obs: Ob[] = [];
  private picks: Pick[] = [];
  private parts: Part[] = [];
  private lastSpawn = 0;
  private emit = { mist: 0, dust: 0 };

  private meters = 0;
  private bonus = 0;
  private seeds = 0;
  private best = 0;
  private hudT = 0;

  private shake = 0;
  private crashAge = 0;
  private crashAt = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: Callbacks,
  ) {
    this.ctx = canvas.getContext("2d")!;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    this.font = css || "system-ui, sans-serif";
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
    this.pushHud();
  }

  /** call whenever the canvas element changes size */
  resize(cssWidth: number, dpr: number) {
    const w = Math.max(320, Math.round(cssWidth * dpr));
    this.canvas.width = w;
    this.canvas.height = Math.round((w * GAME_H) / GAME_W);
    this.k = w / GAME_W;
  }

  // ── controls ──
  /** Enter / the big button: start, restart or resume */
  primary() {
    if (this.phase === "playing") return;
    if (this.phase === "paused") {
      this.setPhase("playing");
      return;
    }
    this.reset();
    this.setPhase("playing");
  }
  pause() {
    if (this.phase === "playing") this.setPhase("paused");
  }
  changeLane(d: -1 | 1) {
    if (this.phase !== "playing") return;
    this.lane = clamp(this.lane + d, 0, LANES - 1);
  }
  setBoost(b: -1 | 0 | 1) {
    this.boost = b;
  }

  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.cb.onPhase(p);
  }

  private reset() {
    this.dist = 0;
    this.elapsed = 0;
    this.speed = 340;
    this.mul = 1;
    this.boost = 0;
    this.lane = 2;
    this.laneF = 2;
    this.obs = [];
    this.picks = [];
    this.parts = [];
    this.lastSpawn = -400;
    this.meters = 0;
    this.bonus = 0;
    this.seeds = 0;
    this.shake = 0;
    this.crashAge = 0;
    this.pushHud();
  }

  private get score() {
    return Math.floor(this.meters) + this.bonus;
  }

  private pushHud() {
    this.cb.onHud({ score: this.score, best: this.best, speed: clamp((this.speed - 300) / 560, 0, 1), seeds: this.seeds });
  }

  // ── update ──
  frame(dt: number) {
    this.time += dt;
    if (this.phase !== "paused") this.update(dt);
    this.draw();
    this.hudT += dt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      this.pushHud();
    }
  }

  private update(dt: number) {
    const playing = this.phase === "playing";

    if (playing) {
      this.elapsed += dt;
      const base = Math.min(340 + this.elapsed * 11, 860);
      const wantMul = this.boost > 0 ? 1.28 : this.boost < 0 ? 0.7 : 1;
      this.mul += (wantMul - this.mul) * Math.min(1, dt * 5);
      this.speed = base * this.mul;
    } else if (this.phase === "ready") {
      this.speed += (150 - this.speed) * Math.min(1, dt * 3);
    } else if (this.phase === "crashed") {
      this.speed *= Math.exp(-dt * 5);
      if (this.speed < 2) this.speed = 0;
      this.crashAge += dt;
    }

    this.dist += this.speed * dt;
    this.wheel += (this.speed / 21) * dt;

    // lane tween
    this.laneF += (this.lane - this.laneF) * (1 - Math.exp(-dt * 17));
    if (Math.abs(this.lane - this.laneF) < 0.002) this.laneF = this.lane;

    if (playing) {
      this.meters += (this.speed * dt) / PX_PER_M;

      // spawn a wave when enough ground has gone by
      const gap = clamp(this.speed * 1.25, 430, 980);
      if (this.dist - this.lastSpawn >= gap) {
        this.lastSpawn = this.dist;
        this.spawnWave();
      }

      // move + collide
      for (const o of this.obs) o.x -= this.speed * dt;
      for (const p of this.picks) p.x -= this.speed * dt;
      this.obs = this.obs.filter((o) => o.x > -120);
      this.picks = this.picks.filter((p) => p.x > -60);

      const ry = this.roverY();
      for (const o of this.obs) {
        if (Math.abs(o.lane - this.laneF) < 0.5 && Math.abs(o.x - ROVER_X) < o.w / 2 + 38) {
          this.crash(o.x, ry);
          break;
        }
      }
      if (this.phase === "playing") {
        for (let i = this.picks.length - 1; i >= 0; i--) {
          const p = this.picks[i];
          if (Math.abs(p.lane - this.laneF) < 0.6 && Math.abs(p.x - ROVER_X) < 48) {
            this.picks.splice(i, 1);
            const pts = p.kind === "gold" ? 50 : 10;
            this.bonus += pts;
            this.seeds += 1;
            this.parts.push({ kind: "text", x: p.x, y: LANE_Y[p.lane] - 46, vx: 0, vy: -70, age: 0, ttl: 0.8, r: 0, text: `+${pts}` });
            for (let s = 0; s < 8; s++) {
              const a = rnd(0, Math.PI * 2);
              this.parts.push({ kind: "spark", x: p.x, y: LANE_Y[p.lane] - 20, vx: Math.cos(a) * rnd(60, 190), vy: Math.sin(a) * rnd(60, 190), age: 0, ttl: rnd(0.25, 0.5), r: rnd(1.5, 3) });
            }
          }
        }
      }
    }

    // spray mist off the mast + dust off the wheels
    if (this.phase !== "crashed" && this.phase !== "paused") {
      const k = this.laneScale(this.laneF);
      const gy = this.roverY();
      this.emit.mist += dt * 80;
      while (this.emit.mist >= 1) {
        this.emit.mist -= 1;
        const ny = [14, 24.5, 35, 45.5, 56][(Math.random() * 5) | 0];
        this.parts.push({
          kind: "mist",
          x: ROVER_X + rnd(-2, 12) * k,
          y: gy + (ny - 71.5) * k + rnd(-3, 3),
          vx: -this.speed * 0.35 + rnd(-30, 40),
          vy: rnd(-26, 10),
          age: 0,
          ttl: rnd(0.35, 0.7),
          r: rnd(1.2, 2.8),
        });
      }
      this.emit.dust += dt * (this.speed / 12);
      while (this.emit.dust >= 1) {
        this.emit.dust -= 1;
        this.parts.push({
          kind: "dust",
          x: ROVER_X - 44 * k,
          y: gy - 2 * k,
          vx: -this.speed * 0.5 + rnd(-30, 10),
          vy: rnd(-40, -5),
          age: 0,
          ttl: rnd(0.3, 0.6),
          r: rnd(3, 7),
        });
      }
    }

    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.age += dt;
      if (q.age >= q.ttl) {
        this.parts.splice(i, 1);
        continue;
      }
      if (q.kind === "spark") q.vy += 520 * dt;
      if (q.kind === "mist") q.vy += 110 * dt;
      if (q.kind === "smoke") q.vy -= 20 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind !== "text") q.vx *= 1 - 1.2 * dt;
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);

    this.shake = Math.max(0, this.shake - dt * 2.2);

    if (this.phase === "crashed" && this.crashAge < 1.6 && Math.random() < dt * 14) {
      this.parts.push({ kind: "smoke", x: this.crashAt.x + rnd(-30, 20), y: this.crashAt.y - 26, vx: rnd(-30, 10), vy: rnd(-50, -20), age: 0, ttl: rnd(0.8, 1.5), r: rnd(12, 24) });
    }
  }

  private spawnWave() {
    const r = Math.random();
    const n = r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const kinds: ObKind[] = ["weed", "weed", "rock", "rock", "stump", "bale"];
    const x0 = GAME_W + 90;
    for (let i = 0; i < n; i++) {
      const kind = kinds[(Math.random() * kinds.length) | 0];
      this.obs.push({ kind, lane: lanes[i], x: x0 + rnd(0, 36), w: OB_W[kind], seed: Math.random() * 100 });
    }
    // something to collect in a lane left clear
    if (Math.random() < 0.78) {
      const lane = lanes[n + ((Math.random() * (LANES - n)) | 0)];
      if (Math.random() < 0.1) {
        this.picks.push({ kind: "gold", lane, x: x0 + 20, ph: Math.random() * 6 });
      } else {
        for (let i = 0; i < 3; i++) this.picks.push({ kind: "seed", lane, x: x0 + i * 66, ph: i * 0.8 });
      }
    }
  }

  private crash(x: number, y: number) {
    this.crashAt = { x: Math.min(x, ROVER_X + 60), y };
    this.crashAge = 0;
    this.shake = 1;
    for (let i = 0; i < 26; i++) {
      const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rnd(120, 420);
      this.parts.push({ kind: "spark", x: ROVER_X + 52, y: y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, ttl: rnd(0.4, 0.9), r: rnd(2, 4.5) });
    }
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* private mode: the best score just will not persist */
      }
    }
    this.pushHud();
    this.setPhase("crashed");
  }

  private laneScale(l: number) {
    return 0.9 + 0.07 * l;
  }
  private roverY() {
    const a = Math.floor(this.laneF);
    const b = Math.min(LANES - 1, a + 1);
    return LANE_Y[a] + (LANE_Y[b] - LANE_Y[a]) * (this.laneF - a) + 30;
  }

  // ── drawing ──
  private draw() {
    const { ctx } = this;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate(rnd(-1, 1) * this.shake * 7, rnd(-1, 1) * this.shake * 5);

    this.drawSky();
    this.drawField();

    // objects and the rover, back to front
    const roverLane = Math.round(this.laneF);
    for (let l = 0; l < LANES; l++) {
      const k = this.laneScale(l);
      const gy = LANE_Y[l] + 30;
      for (const p of this.picks) if (p.lane === l) this.drawPickup(p, gy, k);
      for (const o of this.obs) if (o.lane === l) this.drawOb(o, gy, k);
      if (l === roverLane) this.drawRover();
    }

    this.drawParts();
    this.drawCrashBurst();
    ctx.restore();

    // soft vignette + speed streaks
    const v = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.45, GAME_W / 2, GAME_H / 2, GAME_W * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10,20,18,0.38)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }

  private drawSky() {
    const { ctx } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, 214);
    sky.addColorStop(0, "#f7e3b8");
    sky.addColorStop(0.55, "#f4cd82");
    sky.addColorStop(1, "#f0b95a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_W, 230);

    // retro striped sun
    const sx = 690;
    const sy = 172;
    const sr = 84;
    const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sg.addColorStop(0, "#f7c864");
    sg.addColorStop(1, C.tomato);
    ctx.fillStyle = sg;
    const slices = [
      [sy - sr, 36],
      [sy - sr + 40, 22],
      [sy - sr + 66, 16],
      [sy - sr + 86, 12],
      [sy - sr + 102, 9],
      [sy - sr + 115, 7],
      [sy - sr + 126, 5],
      [sy - sr + 135, 4],
    ];
    for (const [y0, h] of slices) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx - sr, y0, sr * 2, h);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // a few lazy clouds
    ctx.fillStyle = "rgba(255,248,232,0.7)";
    for (let i = 0; i < 4; i++) {
      const cx = ((((i * 340 + 120 - this.dist * 0.03) % 1500) + 1500) % 1500) - 200;
      const cy = 52 + (i % 2) * 38 + i * 6;
      ctx.beginPath();
      ctx.roundRect(cx, cy, 110, 14, 7);
      ctx.roundRect(cx + 26, cy - 10, 62, 16, 8);
      ctx.fill();
    }

    // hills (three layers, each scrolls at its own pace)
    this.hills(0.05, 200, 30, "#b2bc73", 11);
    this.hills(0.11, 214, 34, C.sprout, 7);
    this.farmProps(0.11, 214);
    this.hills(0.2, 230, 22, C.sproutDark, 3);
    // hedge at the field edge
    const hedge = this.ctx.createLinearGradient(0, 226, 0, 244);
    hedge.addColorStop(0, "#2d4f3f");
    hedge.addColorStop(1, "#1f3a30");
    this.ctx.fillStyle = hedge;
    this.ctx.fillRect(0, 226, GAME_W, 18);
  }

  private hills(par: number, base: number, amp: number, color: string, seed: number) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 260);
    const off = this.dist * par;
    for (let x = 0; x <= GAME_W + 20; x += 20) {
      const u = (x + off) * 0.011;
      const h = Math.sin(u + seed) * 0.5 + Math.sin(u * 2.3 + seed * 2) * 0.3 + Math.sin(u * 0.4 + seed) * 0.4;
      ctx.lineTo(x, base - amp * (0.5 + h * 0.5));
    }
    ctx.lineTo(GAME_W + 20, 260);
    ctx.closePath();
    ctx.fill();
  }

  private farmProps(par: number, base: number) {
    const { ctx } = this;
    const spacing = 1700;
    const off = this.dist * par;
    ctx.lineJoin = "round";
    for (let i = 0; i < 2; i++) {
      const x = ((((i * spacing) / 2 + 420 - off) % spacing) + spacing) % spacing - 140;
      if (x > GAME_W + 140) continue;
      const y = base - 6;
      ctx.strokeStyle = C.ink;
      if (i === 0) {
        // barn + silo
        ctx.lineWidth = 2;
        ctx.fillStyle = C.tomato;
        ctx.beginPath();
        ctx.moveTo(x - 30, y);
        ctx.lineTo(x - 30, y - 24);
        ctx.lineTo(x - 18, y - 36);
        ctx.lineTo(x + 18, y - 36);
        ctx.lineTo(x + 30, y - 24);
        ctx.lineTo(x + 30, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = C.cream;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x - 11, y - 20, 22, 20);
        ctx.beginPath();
        ctx.moveTo(x - 11, y - 20);
        ctx.lineTo(x + 11, y);
        ctx.moveTo(x + 11, y - 20);
        ctx.lineTo(x - 11, y);
        ctx.stroke();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.fillStyle = C.cream;
        ctx.beginPath();
        ctx.roundRect(x + 36, y - 40, 14, 40, [7, 7, 0, 0]);
        ctx.fill();
        ctx.stroke();
      } else {
        // windmill
        ctx.lineWidth = 2;
        ctx.fillStyle = C.cream;
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.lineTo(x - 5, y - 46);
        ctx.lineTo(x + 5, y - 46);
        ctx.lineTo(x + 9, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.translate(x, y - 48);
        ctx.rotate(this.time * 0.9);
        ctx.fillStyle = C.amber;
        for (let b = 0; b < 4; b++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.rect(2, -3, 30, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(x, y - 48, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawField() {
    const { ctx } = this;
    const soil = ctx.createLinearGradient(0, 244, 0, GAME_H);
    soil.addColorStop(0, "#7d5b39");
    soil.addColorStop(1, "#4f3623");
    ctx.fillStyle = soil;
    ctx.fillRect(0, 244, GAME_W, GAME_H - 244);

    // dirt tracks the rover drives on
    for (let l = 0; l < LANES; l++) {
      const y = LANE_Y[l] + 30;
      const k = this.laneScale(l);
      const g = ctx.createLinearGradient(0, y - 40 * k, 0, y + 6 * k);
      g.addColorStop(0, "rgba(190,150,98,0.05)");
      g.addColorStop(0.55, "rgba(190,150,98,0.34)");
      g.addColorStop(1, "rgba(190,150,98,0.1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40 * k, GAME_W, 48 * k);
      // tyre marks racing past
      ctx.fillStyle = "rgba(60,40,24,0.28)";
      const spacing = 84;
      const o = this.dist % spacing;
      for (let x = -o - spacing; x < GAME_W + spacing; x += spacing) {
        ctx.fillRect(x, y - 8 * k, 34 * k, 2.2 * k);
        ctx.fillRect(x + 20, y - 24 * k, 28 * k, 2.2 * k);
      }
    }

    // crop rows between the tracks
    for (let j = 0; j <= LANES; j++) {
      const by = LANE_Y[0] - 6 + j * 72;
      const depth = 0.84 + j * 0.07;
      const h = 22 * depth;
      const g = ctx.createLinearGradient(0, by - h / 2, 0, by + h / 2);
      g.addColorStop(0, "#5f8a3f");
      g.addColorStop(1, "#406a2c");
      ctx.fillStyle = g;
      ctx.fillRect(0, by - h / 2, GAME_W, h);
      ctx.fillStyle = "rgba(10,30,20,0.25)";
      ctx.fillRect(0, by + h / 2 - 3, GAME_W, 3);
      const sp = 58;
      const o = this.dist % sp;
      for (let x = -o - sp; x < GAME_W + sp; x += sp) {
        this.sprout(x + (j % 2) * 29, by + h / 2 - 1, depth);
      }
    }
  }

  private sprout(x: number, y: number, s: number) {
    const { ctx } = this;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c3a26";
    ctx.lineWidth = 1.4;
    ctx.fillStyle = "#8cc15f";
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9 * s);
      ctx.quadraticCurveTo(x + d * 12 * s, y - 20 * s, x + d * 15 * s, y - 11 * s);
      ctx.quadraticCurveTo(x + d * 6 * s, y - 8 * s, x, y - 9 * s);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 12 * s);
    ctx.stroke();
  }

  // ── the rover ──
  private drawRover() {
    const { ctx } = this;
    const k = this.laneScale(this.laneF);
    const gy = this.roverY();
    const crashed = this.phase === "crashed";
    const bob = crashed ? 0 : Math.sin(this.time * 17) * 0.9 * Math.min(1, this.speed / 300) * k;
    const lean = crashed ? -0.28 : clamp((this.lane - this.laneF) * -0.11, -0.12, 0.12);

    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(ROVER_X, gy - 1, 66 * k, 7.5 * k, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ROVER_X + (crashed ? 14 : 0), gy + bob);
    ctx.rotate(lean);
    ctx.scale(k * 1.3, k * 1.3);
    ctx.translate(-60, -71.5);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const ink = C.ink;
    const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, lw = 0) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (lw) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    const dot = (x: number, y: number, r: number, fill: string, lw = 0) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (lw) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };

    // far wheels
    for (const cx of [31, 83]) dot(cx, 55, 10.5, "#0b1413");
    // antenna + beacon
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(82, 15);
    ctx.lineTo(82, 6);
    ctx.stroke();
    dot(82, 5, 3.3, Math.sin(this.time * 7) > 0 ? C.amber : "#b88a3a", 2);
    // roof tank
    rr(24, 4, 32, 12, 6, C.sprout, 3);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(33, 5);
    ctx.lineTo(33, 15);
    ctx.moveTo(47, 5);
    ctx.lineTo(47, 15);
    ctx.stroke();
    // body, lid, belt, skirt
    rr(14, 21, 86, 33, 9, C.tomato, 3.5);
    rr(18, 14, 78, 10, 4.5, C.cream, 3);
    rr(17, 43, 80, 5, 2.5, C.amber);
    rr(19, 49, 76, 3, 1.5, C.tomatoDark);
    // face + tail lamp
    rr(93, 26, 9, 17, 3.5, ink);
    dot(97.5, 31, 2.2, C.cream);
    dot(97.5, 38, 2.2, C.cream);
    rr(11, 27, 4, 6, 1.5, "#ff6a45", 1.6);
    // spray mast with five nozzles
    rr(53, 22, 14, 5, 2, ink);
    rr(53, 43, 14, 5, 2, ink);
    rr(56.5, 9, 7, 52, 3.5, C.steel, 2.4);
    for (const cy of [14, 24.5, 35, 45.5, 56]) {
      dot(60, cy, 3.8, C.amber, 1.8);
      dot(60, cy, 1.2, ink);
    }
    // near wheels, spinning
    for (const cx of [36, 86]) {
      dot(cx, 59, 12.5, ink);
      ctx.save();
      ctx.translate(cx, 59);
      ctx.rotate(this.wheel);
      dot(0, 0, 7, C.steel);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(0, 6.5);
      ctx.moveTo(-6.5, 0);
      ctx.lineTo(6.5, 0);
      ctx.stroke();
      dot(0, 0, 2, C.amber);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── obstacles ──
  private drawOb(o: Ob, gy: number, k: number) {
    const { ctx } = this;
    const x = o.x;
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(k * 1.14, k * 1.14);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = C.ink;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w * 0.56, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (o.kind === "weed") {
      const sway = Math.sin(this.time * 3 + o.seed) * 2.2;
      ctx.lineWidth = 2;
      const blades = [
        [-20, -34, "#5f8244"],
        [-12, -46, "#7a9e5a"],
        [-4, -58, "#5f8244"],
        [5, -52, "#8cc15f"],
        [13, -42, "#5f8244"],
        [21, -32, "#7a9e5a"],
      ] as const;
      for (const [bx, h, col] of blades) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(bx * 0.35 - 4, 0);
        ctx.quadraticCurveTo(bx * 0.8 - 3 + sway * 0.3, h * 0.55, bx + sway, h);
        ctx.quadraticCurveTo(bx * 0.8 + 5 + sway * 0.3, h * 0.5, bx * 0.35 + 4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // thistle bud
      ctx.fillStyle = C.tomato;
      ctx.beginPath();
      ctx.arc(-4 + sway, -60, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (o.kind === "rock") {
      ctx.lineWidth = 2.6;
      const pts: [number, number][] = [[-31, 0], [-27, -17], [-13, -31], [8, -36], [27, -22], [32, 0]];
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      const rg = ctx.createLinearGradient(-30, -36, 30, 0);
      rg.addColorStop(0, "#a9b6b9");
      rg.addColorStop(1, "#5d6d71");
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(19,31,29,0.55)";
      ctx.beginPath();
      ctx.moveTo(-13, -31);
      ctx.lineTo(-4, -14);
      ctx.lineTo(8, -36);
      ctx.moveTo(-4, -14);
      ctx.lineTo(4, 0);
      ctx.stroke();
      // pebble
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.fillStyle = "#8b999c";
      ctx.beginPath();
      ctx.ellipse(-38, -4, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (o.kind === "stump") {
      ctx.lineWidth = 2.6;
      ctx.fillStyle = "#7a5130";
      ctx.beginPath();
      ctx.moveTo(-23, 0);
      ctx.quadraticCurveTo(-27, -16, -21, -38);
      ctx.lineTo(21, -38);
      ctx.quadraticCurveTo(27, -16, 23, 0);
      ctx.quadraticCurveTo(0, 8, -23, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e0b472";
      ctx.beginPath();
      ctx.ellipse(0, -38, 21, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(107,74,47,0.8)";
      ctx.beginPath();
      ctx.ellipse(0, -38, 12, 4.6, 0, 0, Math.PI * 2);
      ctx.moveTo(4, -38);
      ctx.ellipse(0, -38, 4, 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // hay bale
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(-35, -46, 70, 46, 7);
      const bg = ctx.createLinearGradient(0, -46, 0, 0);
      bg.addColorStop(0, "#f0c466");
      bg.addColorStop(1, "#d39a35");
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = C.ink;
      for (const sx of [-17, 17]) {
        ctx.beginPath();
        ctx.moveTo(sx, -46);
        ctx.lineTo(sx, 0);
        ctx.stroke();
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(120,80,20,0.5)";
      for (let i = 0; i < 6; i++) {
        const yy = -8 - i * 7;
        ctx.beginPath();
        ctx.moveTo(-31, yy);
        ctx.lineTo(-22, yy + 2);
        ctx.moveTo(-10, yy);
        ctx.lineTo(10, yy + 2);
        ctx.moveTo(22, yy);
        ctx.lineTo(31, yy + 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPickup(p: Pick, gy: number, k: number) {
    const { ctx } = this;
    const bob = Math.sin(this.time * 4 + p.ph) * 4;
    const y = gy - 38 * k + bob;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale(k * 1.2, k * 1.2);
    ctx.lineJoin = "round";
    // soft glow
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    g.addColorStop(0, "rgba(255,226,140,0.5)");
    g.addColorStop(1, "rgba(255,226,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, 60, 60);
    // shadow on the ground
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 32 - bob, 11, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const spin = Math.cos(this.time * 4.4 + p.ph);
    ctx.scale(Math.max(0.18, Math.abs(spin)), 1);
    if (p.kind === "seed") {
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // sprout icon
      ctx.fillStyle = C.sprout;
      ctx.lineWidth = 1.6;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.quadraticCurveTo(d * 9, -3, d * 9, -8);
        ctx.quadraticCurveTo(d * 2, -6, 0, 4);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // golden sprout: a star
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = "#ffd25e";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 11 : 21;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.tomato;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParts() {
    const { ctx } = this;
    for (const q of this.parts) {
      const a = 1 - q.age / q.ttl;
      if (q.kind === "mist") {
        ctx.fillStyle = `rgba(236,248,252,${0.75 * a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (q.kind === "dust") {
        ctx.fillStyle = `rgba(205,170,115,${0.4 * a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * (1.4 - a * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (q.kind === "smoke") {
        ctx.fillStyle = `rgba(60,72,70,${0.5 * a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (q.kind === "spark") {
        ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,214,102,${a})` : `rgba(255,120,70,${a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * a + 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (q.kind === "text" && q.text) {
        ctx.save();
        ctx.font = `900 24px ${this.font}`;
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(19,31,29,${a})`;
        ctx.strokeText(q.text, q.x, q.y);
        ctx.fillStyle = `rgba(255,226,140,${a})`;
        ctx.fillText(q.text, q.x, q.y);
        ctx.restore();
      }
    }
  }

  private drawCrashBurst() {
    if (this.phase !== "crashed") return;
    const { ctx } = this;
    const t = Math.min(1, this.crashAge / 0.18);
    const s = 0.2 + 0.8 * (1 - Math.pow(1 - t, 3)) + Math.sin(this.crashAge * 14) * 0.03;
    ctx.save();
    ctx.translate(this.crashAt.x + 30, this.crashAt.y - 56);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    const star = (r1: number, r2: number, n: number, fill: string, lw: number) => {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + 0.2;
        const r = i % 2 ? r1 : r2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (lw) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    star(34, 66, 10, C.amber, 4);
    star(20, 40, 10, C.tomato, 0);
    ctx.restore();
  }
}
