import { boomX, clamp, edgeX } from "./wash";

/**
 * The water for the spray wash: a steel boom with a nozzle per row, tapered jets that break up as they
 * travel, splash and mist where they hit, a glossy wet film on the front, and little rivulets that run
 * down the screen behind it. Everything is drawn on one viewport-sized canvas.
 */

type Drop = { x: number; y: number; vx: number; vy: number; age: number; ttl: number; r: number; maxX?: number };
type Puff = { x: number; y: number; vx: number; vy: number; age: number; ttl: number; s: number };
type Riv = { x: number; y0: number; head: number; vel: number; travel: number; len: number; w: number; alpha: number; dead: boolean };

const WATER = "236,248,252";

let cache: { mist: HTMLCanvasElement; dark: HTMLCanvasElement } | null = null;

function makeSprites() {
  if (cache) return cache;
  const mk = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  // soft round puff of mist
  const mist = mk(64, 64);
  {
    const g = mist.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgba(${WATER},0.9)`);
    r.addColorStop(0.35, `rgba(${WATER},0.4)`);
    r.addColorStop(1, `rgba(${WATER},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  // darkening of the screen just behind the front (the surface is wet)
  const dark = mk(256, 1);
  {
    const g = dark.getContext("2d")!;
    const l = g.createLinearGradient(0, 0, 256, 0);
    l.addColorStop(0, "rgba(4,22,26,0)");
    l.addColorStop(0.55, "rgba(4,22,26,0.06)");
    l.addColorStop(0.88, "rgba(4,22,26,0.16)");
    l.addColorStop(1, "rgba(4,22,26,0.26)");
    g.fillStyle = l;
    g.fillRect(0, 0, 256, 1);
  }
  cache = { mist, dark };
  return cache;
}

export class WaterFx {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private CH = 0;
  private dpr = 1;
  private xs = new Float32Array(0);
  private drops: Drop[] = [];
  private puffs: Puff[] = [];
  private rivs: Riv[] = [];
  private lastP = -1;
  private spawnAcc = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  setSize(W: number, CH: number, dpr = 1) {
    this.W = W;
    this.CH = CH;
    this.dpr = dpr;
    this.xs = new Float32Array(Math.ceil(CH / 4) + 2);
  }

  /** anything still falling or running? */
  get busy() {
    return this.drops.length > 0 || this.puffs.length > 0 || this.rivs.length > 0;
  }

  reset() {
    this.drops.length = 0;
    this.puffs.length = 0;
    this.rivs.length = 0;
    this.lastP = -1;
    this.spawnAcc = 0;
    // wipe the whole backing store, then go back to CSS-pixel units (dropping the dpr scale here
    // made every later frame draw at 1/dpr size on high-density screens)
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param live  true while the boom is on screen; false afterwards (only drips and run-off remain)
   */
  draw(p: number, t: number, dt: number, rowH: number, live: boolean) {
    const { ctx, W, CH } = this;
    const sp = makeSprites();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, CH);

    const rows = Math.ceil(CH / rowH);
    const bx = boomX(p) * W;
    const step = 4;
    const n = Math.ceil(CH / step) + 1;
    const xs = this.xs;
    if (live) for (let k = 0; k < n; k++) xs[k] = edgeX(k * step, p, W, rowH, t);

    // ── 1. the wet surface behind the front ──
    if (live) {
      for (let k = 0; k < n - 1; k++) {
        const e = xs[k];
        if (e <= 2) continue;
        const y = k * step;
        ctx.drawImage(sp.dark, 0, 0, 256, 1, e - 240, y, 240, step);
      }
    }

    // ── 2. rivulets running down the wet screen ──
    if (live) {
      if (this.lastP >= 0) {
        this.spawnAcc += (Math.abs(p - this.lastP) * W * 1.22) / 46;
        while (this.spawnAcc >= 1) {
          this.spawnAcc -= 1;
          if (this.rivs.length > 54) break;
          const y = Math.random() * CH * 0.92;
          const e = edgeX(y, p, W, rowH, t);
          if (e < 30) continue;
          this.rivs.push({
            x: e - 10 - Math.random() * 38,
            y0: y,
            head: y,
            vel: 18 + Math.random() * 40,
            travel: 70 + Math.random() * 200,
            len: 26 + Math.random() * 70,
            w: 0.9 + Math.random() * 1.5,
            alpha: 1,
            dead: false,
          });
        }
      }
      this.lastP = p;
    }
    ctx.save();
    if (live) {
      const clip = new Path2D();
      clip.moveTo(0, 0);
      for (let k = 0; k < n; k++) clip.lineTo(Math.max(0, xs[k]), k * step);
      clip.lineTo(0, CH);
      clip.closePath();
      ctx.clip(clip);
    }
    ctx.lineCap = "round";
    for (let i = this.rivs.length - 1; i >= 0; i--) {
      const r = this.rivs[i];
      if (!r.dead) {
        r.vel = Math.min(230, r.vel + 95 * dt);
        r.head += r.vel * dt;
        if (r.head - r.y0 >= r.travel) {
          r.head = r.y0 + r.travel;
          r.dead = true;
        }
      } else {
        r.alpha -= dt * 0.55;
      }
      const tail = Math.max(r.y0, r.head - r.len - (r.dead ? (1 - r.alpha) * 140 : 0));
      if (r.alpha <= 0 || tail >= CH) {
        this.rivs.splice(i, 1);
        continue;
      }
      const a = Math.max(0, r.alpha);
      const grad = ctx.createLinearGradient(0, tail, 0, r.head);
      grad.addColorStop(0, `rgba(${WATER},0)`);
      grad.addColorStop(1, `rgba(${WATER},${0.5 * a})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.moveTo(r.x, tail);
      ctx.lineTo(r.x, r.head);
      ctx.stroke();
      // a faint shadow beside it so the water reads on pale and dark colours alike
      ctx.strokeStyle = `rgba(6,36,44,${0.16 * a})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.9, Math.max(tail, r.head - r.len * 0.7));
      ctx.lineTo(r.x + r.w * 0.9, r.head);
      ctx.stroke();
      // bead at the head
      ctx.fillStyle = `rgba(${WATER},${0.75 * a})`;
      ctx.beginPath();
      ctx.arc(r.x, r.head, r.w * 1.15 + 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(r.x - 0.4, r.head - 0.5, r.w * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── 3. glossy rim of the water front ──
    if (live) {
      const edge = new Path2D();
      edge.moveTo(Math.max(0, xs[0]), 0);
      for (let k = 1; k < n; k++) edge.lineTo(Math.max(0, xs[k]), k * step);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.save();
      ctx.translate(2.4, 0);
      ctx.strokeStyle = "rgba(6,40,50,0.26)";
      ctx.lineWidth = 1.3;
      ctx.stroke(edge);
      ctx.restore();
      ctx.strokeStyle = `rgba(${WATER},0.07)`;
      ctx.lineWidth = 9;
      ctx.stroke(edge);
      ctx.strokeStyle = `rgba(${WATER},0.16)`;
      ctx.lineWidth = 3.6;
      ctx.stroke(edge);
      ctx.save();
      ctx.translate(-1, 0);
      ctx.strokeStyle = `rgba(255,255,255,0.5)`;
      ctx.lineWidth = 1.1;
      ctx.stroke(edge);
      ctx.restore();
    }

    // ── 4. mist puffs, foam at the impacts, and the jets ──
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const q = this.puffs[i];
      q.age += dt;
      if (q.age >= q.ttl) {
        this.puffs.splice(i, 1);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = q.age / q.ttl;
      const s = q.s * (0.6 + k * 1.2);
      ctx.globalAlpha = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 1.2;
      ctx.drawImage(sp.mist, q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (live) {
      for (let i = 0; i < rows; i++) {
        const cy = (i + 0.5) * rowH;
        const ex = edgeX(cy, p, W, rowH, t) - 3;
        const nx = bx + 15;
        if (nx > W + 20 || ex < 0) continue;
        const len = ex - nx;
        if (len < 12) continue;
        const droop = Math.min(20, 3 + len * 0.05);
        const ey = cy + droop;

        // soft cone of fine mist around the stream
        for (let k = 0; k < 5; k++) {
          const u = 0.22 + k * 0.19;
          const mx = nx + len * u;
          const my = cy + droop * u * u;
          const s = 18 + 76 * u;
          ctx.globalAlpha = 0.07 + 0.025 * Math.sin(t * 9 + i * 2 + k);
          ctx.drawImage(sp.mist, mx - s / 2, my - s / 2, s, s);
        }
        ctx.globalAlpha = 1;

        // the stream itself: thin at the nozzle, fanning out and thinning as it breaks up
        const N = 14;
        const topY: number[] = [];
        const botY: number[] = [];
        const px: number[] = [];
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          const x = nx + len * u;
          const c = cy + droop * u * u + Math.sin(u * 11 - t * 36 + i * 2.3) * 0.9 * u;
          const hw = 0.9 + 4.4 * Math.pow(u, 1.35) + Math.sin(u * 17 - t * 41 + i) * 0.5 * u;
          px.push(x);
          topY.push(c - hw);
          botY.push(c + hw);
        }
        const g = ctx.createLinearGradient(nx, 0, ex, 0);
        g.addColorStop(0, `rgba(${WATER},0.95)`);
        g.addColorStop(0.5, `rgba(${WATER},0.5)`);
        g.addColorStop(0.9, `rgba(${WATER},0.1)`);
        g.addColorStop(1, `rgba(${WATER},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(px[0], topY[0]);
        for (let k = 1; k <= N; k++) ctx.lineTo(px[k], topY[k]);
        for (let k = N; k >= 0; k--) ctx.lineTo(px[k], botY[k]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(6,40,50,0.14)";
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // a streak racing along the stream
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([9, 19]);
        ctx.lineDashOffset = -(t * 640 + i * 31);
        ctx.beginPath();
        ctx.moveTo(px[0], (topY[0] + botY[0]) / 2);
        for (let k = 1; k <= N - 3; k++) ctx.lineTo(px[k], (topY[k] + botY[k]) / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // foam where it lands
        for (let k = 0; k < 3; k++) {
          const s = 22 + k * 9 + Math.sin(t * 8 + i + k * 2) * 4;
          ctx.globalAlpha = 0.3 - k * 0.07;
          ctx.drawImage(sp.mist, ex - 10 - k * 7 - s / 2, ey - 2 + Math.sin(t * 6 + i * 3 + k) * 6 - s / 2, s, s);
        }
        ctx.globalAlpha = 1;

        // spawn: splash at the impact, droplets shed by the stream, and the odd puff of mist
        if (Math.random() < 30 * dt && this.drops.length < 420) {
          const sp2 = 50 + Math.random() * 260;
          const ang = Math.PI + (Math.random() - 0.5) * 2.2;
          this.drops.push({
            x: ex,
            y: ey + (Math.random() - 0.5) * rowH * 0.5,
            vx: Math.cos(ang) * sp2 * 0.8 + 40,
            vy: Math.sin(ang) * sp2 - 60,
            age: 0,
            ttl: 0.35 + Math.random() * 0.55,
            r: 0.8 + Math.random() * 1.9,
          });
        }
        if (Math.random() < 11 * dt && this.drops.length < 420) {
          const u = 0.3 + Math.random() * 0.7;
          this.drops.push({
            x: nx + len * u,
            y: cy + droop * u * u + (Math.random() - 0.5) * 5 * u,
            vx: 380 + Math.random() * 240,
            vy: (Math.random() - 0.5) * 110 * u,
            age: 0,
            ttl: 0.1 + Math.random() * 0.16,
            r: 0.7 + Math.random() * 1.1,
            maxX: ex + 4,
          });
        }
        if (Math.random() < 4.5 * dt && this.puffs.length < 36) {
          this.puffs.push({
            x: ex - 8,
            y: ey + (Math.random() - 0.5) * rowH * 0.6,
            vx: -10 - Math.random() * 50,
            vy: -8 - Math.random() * 34,
            age: 0,
            ttl: 0.9 + Math.random() * 0.8,
            s: 36 + Math.random() * 44,
          });
        }
      }
    }

    // ── 5. droplets ──
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age >= d.ttl || d.y > CH + 20 || (d.maxX !== undefined && d.x > d.maxX)) {
        this.drops.splice(i, 1);
        continue;
      }
      d.vy += 720 * dt;
      d.vx *= 1 - 1.2 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const a = clamp(1 - d.age / d.ttl, 0, 1);
      const spd = Math.hypot(d.vx, d.vy);
      if (spd > 240) {
        // fast drops are smeared along their path, like a camera would see them
        const k = Math.min(0.02, 8 / spd);
        ctx.strokeStyle = `rgba(${WATER},${0.6 * a})`;
        ctx.lineWidth = d.r * 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.vx * k, d.y - d.vy * k);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${WATER},${0.8 * a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(6,40,50,${0.28 * a})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
        ctx.beginPath();
        ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── 6. the boom (in front of everything) ──
    if (live && bx > -40 && bx < W + 40) {
      // shadow on the screen
      const sg = ctx.createLinearGradient(bx + 6, 0, bx + 40, 0);
      sg.addColorStop(0, "rgba(0,0,0,0.22)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(bx + 6, 0, 34, CH);

      // pipe: brushed steel, lit from the left
      const pg = ctx.createLinearGradient(bx - 7, 0, bx + 7, 0);
      pg.addColorStop(0, "#0e1918");
      pg.addColorStop(0.2, "#37504f");
      pg.addColorStop(0.45, "#a8c0c0");
      pg.addColorStop(0.58, "#eaf4f3");
      pg.addColorStop(0.8, "#5f7b7c");
      pg.addColorStop(1, "#111e1d");
      ctx.fillStyle = pg;
      ctx.fillRect(bx - 7, 0, 14, CH);

      for (let i = 0; i < rows; i++) {
        const cy = (i + 0.5) * rowH;
        // clamp collar
        ctx.fillStyle = "#142120";
        ctx.fillRect(bx - 9, cy - rowH / 2 - 2.5, 18, 5);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(bx - 9, cy - rowH / 2 - 2.5, 18, 1);
        // feed hose + nozzle body
        ctx.fillStyle = "#1a2a29";
        ctx.fillRect(bx + 5, cy - 3, 6, 6);
        const ng = ctx.createLinearGradient(0, cy - 6, 0, cy + 6);
        ng.addColorStop(0, "#d3dfde");
        ng.addColorStop(0.45, "#7e9697");
        ng.addColorStop(1, "#2e4242");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.roundRect(bx + 8, cy - 6, 12, 12, 2);
        ctx.fill();
        // brass tip
        const tg = ctx.createLinearGradient(0, cy - 3.5, 0, cy + 3.5);
        tg.addColorStop(0, "#f3d28b");
        tg.addColorStop(1, "#a9772a");
        ctx.fillStyle = tg;
        ctx.fillRect(bx + 19, cy - 3.5, 5, 7);
        ctx.fillStyle = "#0b1413";
        ctx.fillRect(bx + 23, cy - 1.2, 1.6, 2.4);
      }
    }
  }
}
