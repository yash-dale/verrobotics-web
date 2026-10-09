/**
 * AGV spray rig simulator: physics, checks and drawing, ported 1:1 from reference/agv-spray-sim.html.
 *
 * Differences from the reference are only about living inside a page:
 *  - everything is looked up inside `root` (data-ref / data-k attributes), never by document id
 *  - class names come from the CSS module, theme tokens are read from the wrapper instead of :root
 *  - the animation loop pauses while the simulator is off screen or the tab is hidden
 *  - devicePixelRatio is capped at 1.5
 *  - mountSprayLab() returns a cleanup that stops the loop and removes every listener and observer
 */

type Css = Readonly<Record<string, string>>;
type Nozzle = "005" | "02";
type Status = "ok" | "warn" | "bad" | "info";

const DEF = {
  agvW: 0.7, agvL: 1.0, deckH: 0.4, speed: 2.5, rowSpacing: 1.5, payload: 150,
  mastX: 0.38, n: 12, pitch: 120, h1: 0.22, standoff: 0.4,
  nozzle: "005" as Nozzle, angle: 20, pressure: 3.0, pwmPitch: 50, duty: 60, valveFmax: 100, valveResp: 5,
  tankV: 100, pumpQ0: 7.5, pumpPmax: 7.0, relief: 5.0, strainerMesh: 50, filterMesh: 100,
  plantMax: 1.6, plantMin: 1.0, targetLow: 0.15, canopy: 0.3, plantSpacing: 0.5, pad: 50,
  camLead: 0.83, camH: 1.0, fov: 60, fps: 30, procLat: 110,
};
type Params = typeof DEF;
type Key = keyof Params;
type NumKey = Exclude<Key, "nozzle">;

type Item = {
  k: Key;
  label: string;
  type?: "seg";
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  dp?: number;
  note?: string;
  extra?: (v: number) => string;
};

type Calc = {
  K: number;
  qN: (Pb: number) => number;
  qPump: (Pb: number) => number;
  wf: number; pm: number; overlap: number;
  nozH: number[]; geoLow: number; geoHigh: number; on: boolean[]; nOn: number;
  bandLow: number; bandHigh: number;
  uncovered: (lo: number, hi: number) => number;
  gapInterior: number; mastTop: number; rowX: number; xAgv: number; mastWX: number;
  clrNoz: number; clrRight: number; clrLeft: number;
  tankW: number; tankL: number; tankH: number; mass: number;
  nAct: (h: number) => number; nActMax: number; nActAvg: number; nUnused: number;
  Pset: number; Ppeak: number; qNoz: number; qPeak: number;
  window: number; sprayFrac: number; qAvg: number; qPumpSet: number; bypass: number; agit: number;
  Phyd: number; amps: number; drop: string | null; orifice: number;
  filterOpen: number; strainerOpen: number; recMesh: number;
  f: number; Tp: number; onT: number; offT: number; pulses: number;
  dose: number; mlPlant: number; endur: number; rowKm: number;
  nozU: number; camU: number; camY: number; yRow: number; camLat: number; slant: number;
  footprint: number; frames: number; tTot: number; leadReq: number; leadMargin: number;
};

type Plant = {
  x0: number; jit: number; hu: number; cu: number; det: boolean; x: number; h: number; c: number;
  ws: number; we: number; shift: number; sa: number; status: "ok" | "late" | "missed";
  pitch: number; duty: number; mode: "ok" | "weak" | "stream" | "erratic";
};

type Row = { l: string; v: string; s: Status; n?: string };
type Group = { t: string; rows: Row[] };
type Hit = { i: number; y: number; x0: number; x1: number; sqx1: number; half: number };
type RearState = {
  cur?: Plant | null; inWin?: boolean; open?: boolean; lateNow?: boolean; actN?: number;
  hits?: Hit[]; fanHalf?: number; tipSX?: number;
};
type Ctx = CanvasRenderingContext2D;
type TextOpts = { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; rot?: number };

export function mountSprayLab(root: HTMLElement, css: Css): () => void {
  const c = (names: string) => names.split(" ").map((n) => css[n] ?? n).join(" ");
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const ref = <T extends HTMLElement = HTMLElement>(name: string) => $<T>(`[data-ref="${name}"]`);
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn);
    cleanups.push(() => el.removeEventListener(type, fn));
  };
  let disposed = false;

  let P: Params = Object.assign({}, DEF);
  let disabled = new Set<number>(); // nozzle indices switched off by the user

  const GROUPS: { title: string; items: Item[] }[] = [
    { title: "Vehicle & field", items: [
      { k: "speed", label: "AGV speed", min: 0.2, max: 4, step: 0.1, unit: "m/s", dp: 1, extra: (v) => " · " + (v * 3.6).toFixed(1) + " km/h" },
      { k: "agvW", label: "AGV width", min: 0.5, max: 1.2, step: 0.01, unit: "m", dp: 2 },
      { k: "agvL", label: "AGV length", min: 0.6, max: 1.6, step: 0.01, unit: "m", dp: 2 },
      { k: "deckH", label: "Deck height", min: 0.2, max: 0.8, step: 0.01, unit: "m", dp: 2 },
      { k: "rowSpacing", label: "Farm row width (row centre to centre)", min: 0.75, max: 2.5, step: 0.05, unit: "m", dp: 2 },
      { k: "payload", label: "AGV payload capacity", min: 50, max: 500, step: 10, unit: "kg", dp: 0 }] },
    { title: "Spray mast", items: [
      { k: "mastX", label: "Mast position across the AGV", min: -0.35, max: 0.45, step: 0.01, unit: "m", dp: 2, note: "0 = centreline, + = toward the crop row. Range follows the AGV width plus a 0.10 m outboard bracket." },
      { k: "n", label: "Number of nozzles", min: 1, max: 24, step: 1, unit: "", dp: 0 },
      { k: "pitch", label: "Distance between nozzles", min: 50, max: 250, step: 5, unit: "mm", dp: 0 },
      { k: "h1", label: "Lowest nozzle height (N1)", min: 0.05, max: 0.8, step: 0.01, unit: "m", dp: 2 },
      { k: "standoff", label: "Nozzle to crop row distance", min: 0.15, max: 0.8, step: 0.01, unit: "m", dp: 2 }] },
    { title: "Nozzle & PWM", items: [
      { k: "nozzle", type: "seg", label: "Nozzle tip", options: [["005", "LS 20-005"], ["02", "LS 20-02"]] },
      { k: "angle", label: "Nozzle spray angle", min: 10, max: 110, step: 1, unit: "°", dp: 0, note: "LS 20 is a 20° tip; other angles model a different tip." },
      { k: "pressure", label: "Pump operating pressure (PCV-101 set)", min: 1, max: 6, step: 0.1, unit: "bar", dp: 1 },
      { k: "pwmPitch", label: "PWM pulse pitch along the row", min: 10, max: 200, step: 5, unit: "mm", dp: 0, extra: (v) => " · " + (P.speed / (v / 1000)).toFixed(0) + " Hz" },
      { k: "duty", label: "PWM duty cycle", min: 10, max: 100, step: 5, unit: "%", dp: 0 },
      { k: "valveFmax", label: "Valve max switching frequency", min: 10, max: 200, step: 5, unit: "Hz", dp: 0, note: "Assumed; confirm with the valve datasheet." },
      { k: "valveResp", label: "Valve response time", min: 1, max: 50, step: 1, unit: "ms", dp: 0 }] },
    { title: "Tank, pump & filtration", items: [
      { k: "tankV", label: "Water tank volume (T-101)", min: 20, max: 300, step: 10, unit: "L", dp: 0 },
      { k: "pumpQ0", label: "Pump free flow at 0 bar", min: 2, max: 20, step: 0.5, unit: "L/min", dp: 1 },
      { k: "pumpPmax", label: "Pump shut-off pressure", min: 3, max: 10, step: 0.5, unit: "bar", dp: 1 },
      { k: "relief", label: "Relief valve PSV-101 set", min: 2, max: 9, step: 0.1, unit: "bar", dp: 1 },
      { k: "strainerMesh", label: "Suction strainer F-101", min: 20, max: 120, step: 5, unit: "mesh", dp: 0, extra: (v) => " · " + Math.round(15200 / v) + " µm" },
      { k: "filterMesh", label: "Pressure filter F-102 mesh", min: 30, max: 200, step: 5, unit: "mesh", dp: 0, extra: (v) => " · " + Math.round(15200 / v) + " µm" }] },
    { title: "Crop", items: [
      { k: "plantMax", label: "Height of tallest plants", min: 0.2, max: 2.5, step: 0.05, unit: "m", dp: 2 },
      { k: "plantMin", label: "Height of shortest plants", min: 0.1, max: 2.5, step: 0.05, unit: "m", dp: 2 },
      { k: "targetLow", label: "Lowest leaf to cover", min: 0, max: 0.6, step: 0.01, unit: "m", dp: 2 },
      { k: "canopy", label: "Canopy diameter", min: 0.05, max: 0.8, step: 0.01, unit: "m", dp: 2 },
      { k: "plantSpacing", label: "Plant spacing in the row", min: 0.1, max: 2, step: 0.05, unit: "m", dp: 2 },
      { k: "pad", label: "Spray pad before and after plant", min: 0, max: 150, step: 5, unit: "mm", dp: 0 }] },
    { title: "Vision & timing", items: [
      { k: "camLead", label: "Camera axis ahead of nozzle plane", min: 0.1, max: 2, step: 0.01, unit: "m", dp: 2 },
      { k: "camH", label: "Camera height", min: 0.3, max: 2, step: 0.05, unit: "m", dp: 2 },
      { k: "fov", label: "Camera field of view (along row)", min: 20, max: 120, step: 1, unit: "°", dp: 0 },
      { k: "fps", label: "Camera frame rate", min: 5, max: 120, step: 1, unit: "fps", dp: 0 },
      { k: "procLat", label: "Detection + control latency", min: 10, max: 500, step: 5, unit: "ms", dp: 0 }] },
  ];
  const ITEMS = {} as Record<Key, Item>;
  GROUPS.forEach((g) => g.items.forEach((it) => (ITEMS[it.k] = it)));
  const CROP_KEYS = new Set<Key>(["plantMax", "plantMin", "targetLow", "canopy", "plantSpacing", "pad"]);

  /* ---------- controls ---------- */
  const ctl = ref("controls");
  const input = (k: Key) => $<HTMLInputElement>(`input[data-k="${k}"]`);
  function buildControls() {
    let h = "";
    for (const g of GROUPS) {
      h += `<details class="${c("grp")}" open><summary>${g.title}</summary><div class="${c("grp-body")}">`;
      for (const it of g.items) {
        if (it.type === "seg") {
          h += `<div class="${c("ctl")}"><div class="${c("ctl-head")}"><span class="${c("ctl-label")}">${it.label}</span></div><div class="${c("seg")}" role="group" aria-label="${it.label}">` +
            it.options!.map(([v, l]) => `<button type="button" data-seg="${it.k}" data-v="${v}" aria-pressed="${P[it.k] === v}">${l}</button>`).join("") + `</div></div>`;
          continue;
        }
        // the label wraps its slider, so they are associated without document ids
        h += `<div class="${c("ctl")}"><label><span class="${c("ctl-head")}"><span class="${c("ctl-label")}">${it.label}</span><output data-out="${it.k}"></output></span>` +
          `<input type="range" data-k="${it.k}" aria-label="${it.label}" min="${it.min}" max="${it.max}" step="${it.step}" value="${P[it.k]}"></label>` +
          (it.note ? `<p class="${c("ctl-note")}">${it.note}</p>` : "") + `</div>`;
      }
      h += "</div></details>";
    }
    ctl.innerHTML = h;
  }
  function fmtVal(it: Item, v: number) {
    return v.toFixed(it.dp) + (it.unit ? (it.unit === "°" || it.unit === "%" ? "" : " ") + it.unit : "") + (it.extra ? it.extra(v) : "");
  }
  function syncControls() {
    const m = input("mastX");
    m.min = (-P.agvW / 2).toFixed(2);
    m.max = (P.agvW / 2 + 0.1).toFixed(2);
    for (const k of Object.keys(ITEMS) as Key[]) {
      const it = ITEMS[k];
      if (it.type === "seg") {
        root.querySelectorAll<HTMLElement>(`[data-seg="${k}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === P[k])));
        continue;
      }
      const inp = input(k);
      if (String(inp.value) !== String(P[k])) inp.value = String(P[k]);
      const txt = fmtVal(it, P[k] as number);
      $(`[data-out="${k}"]`).textContent = txt;
      inp.setAttribute("aria-valuetext", txt);
    }
  }
  function applyConstraints(k: Key) {
    P.mastX = Math.min(Math.max(P.mastX, -P.agvW / 2), P.agvW / 2 + 0.1);
    if (k === "plantMin" && P.plantMin > P.plantMax) P.plantMax = P.plantMin;
    if (k === "plantMax" && P.plantMax < P.plantMin) P.plantMin = P.plantMax;
    const tmax = Math.max(0, +(P.plantMin - 0.05).toFixed(2));
    if (P.targetLow > tmax) P.targetLow = tmax;
  }

  /* ---------- physics ---------- */
  const K_TIP: Record<Nozzle, number> = { "005": 0.1155, "02": 0.45 }; // L/min per √bar, fitted to the Lechler LS 20 table
  const DROPLET: Record<Nozzle, string[]> = { "005": ["C", "M", "F", "F"], "02": ["VC", "VC", "C", "C"] };
  const DROP_NAME: Record<string, string> = { C: "coarse", M: "medium", F: "fine", VC: "very coarse" };
  let calc = {} as Calc;
  function compute() {
    const p = P, r = {} as Calc;
    r.K = K_TIP[p.nozzle];
    r.qN = (Pb) => r.K * Math.sqrt(Math.max(Pb, 0));
    r.qPump = (Pb) => Math.max(0, p.pumpQ0 * (1 - Pb / p.pumpPmax));
    r.wf = 2 * p.standoff * Math.tan((p.angle * Math.PI) / 360);
    r.pm = p.pitch / 1000;
    r.overlap = (r.wf - r.pm) / r.wf;
    r.nozH = Array.from({ length: p.n }, (_, i) => p.h1 + i * r.pm);
    r.geoLow = p.h1 - r.wf / 2;
    r.geoHigh = r.nozH[p.n - 1] + r.wf / 2;
    r.on = r.nozH.map((_, i) => !disabled.has(i));
    const onZ = r.nozH.filter((_, i) => r.on[i]);
    r.nOn = onZ.length;
    r.bandLow = r.nOn ? onZ[0] - r.wf / 2 : r.geoLow;
    r.bandHigh = r.nOn ? onZ[r.nOn - 1] + r.wf / 2 : r.geoHigh;
    const uncovered = (lo: number, hi: number) => {
      if (hi <= lo) return 0;
      let gap = 0, cur = lo;
      for (const z of onZ) {
        const a = z - r.wf / 2, b = z + r.wf / 2;
        if (b <= cur) continue;
        if (a >= hi) break;
        if (a > cur) gap += a - cur;
        cur = Math.max(cur, b);
        if (cur >= hi) break;
      }
      if (cur < hi) gap += hi - cur;
      return gap;
    };
    r.uncovered = uncovered;
    r.gapInterior = r.nOn ? uncovered(Math.max(p.targetLow, r.bandLow), Math.min(p.plantMax, r.bandHigh)) : 0;
    r.mastTop = r.nozH[p.n - 1] + 0.12;
    r.rowX = p.rowSpacing / 2; // crop row, measured from lane centre
    r.xAgv = p.rowSpacing / 2 - p.standoff - p.mastX; // AGV centre in the lane
    r.mastWX = r.xAgv + p.mastX;
    r.clrNoz = p.standoff - p.canopy / 2;
    r.clrRight = r.rowX - p.canopy / 2 - (r.xAgv + p.agvW / 2);
    r.clrLeft = r.xAgv - p.agvW / 2 - (-r.rowX + p.canopy / 2);
    r.tankW = 0.857 * p.agvW;
    r.tankL = 0.7 * p.agvL;
    r.tankH = p.tankV / 1000 / (r.tankW * r.tankL);
    r.mass = p.tankV * 1.0 + (4 + 0.08 * p.tankV) + 14 + p.n * 0.35;
    r.nAct = (h) => {
      let n = 0;
      r.nozH.forEach((z, i) => {
        if (r.on[i] && z + r.wf / 2 >= p.targetLow && z - r.wf / 2 <= h) n++;
      });
      return n;
    };
    r.nActMax = r.nAct(p.plantMax);
    let s = 0;
    for (let i = 0; i <= 20; i++) s += r.nAct(p.plantMin + ((p.plantMax - p.plantMin) * i) / 20);
    r.nActAvg = s / 21;
    r.nUnused = r.nOn - r.nActMax;
    // pressure regulation
    r.Pset = Math.min(p.pressure, p.relief, p.pumpPmax); // a positive-displacement curve cannot build more than shut-off
    const solve = (N: number) => {
      if (N <= 0 || r.qPump(r.Pset) >= N * r.qN(r.Pset)) return r.Pset;
      let lo = 0, hi = r.Pset;
      for (let i = 0; i < 50; i++) {
        const m = (lo + hi) / 2;
        if (r.qPump(m) > N * r.qN(m)) lo = m;
        else hi = m;
      }
      return lo;
    };
    r.Ppeak = solve(r.nActMax);
    r.qNoz = r.qN(r.Pset);
    r.qPeak = r.nActMax * r.qN(r.Ppeak);
    r.window = p.canopy + (2 * p.pad) / 1000;
    r.sprayFrac = Math.min(1, r.window / p.plantSpacing);
    r.qAvg = ((r.nActAvg * r.qNoz * p.duty) / 100) * r.sprayFrac;
    r.qPumpSet = r.qPump(r.Pset);
    r.bypass = Math.max(0, r.qPumpSet - r.qAvg);
    r.agit = (r.bypass / p.tankV) * 100;
    r.Phyd = (r.Pset * 1e5 * r.qPumpSet) / 60000;
    r.amps = r.Phyd / 0.35 / 12;
    const pi = Math.round(r.Pset) - 2;
    r.drop = pi >= 0 && pi <= 3 ? DROPLET[p.nozzle][pi] : null;
    const Q3 = (r.K * Math.sqrt(3)) / 60000, A = Q3 / (0.8 * Math.sqrt((2 * 3e5) / 1000));
    r.orifice = Math.sqrt((4 * A) / Math.PI) * 1e6;
    r.filterOpen = 15200 / p.filterMesh;
    r.strainerOpen = 15200 / p.strainerMesh;
    r.recMesh = p.nozzle === "005" ? 80 : 60;
    // PWM
    r.f = p.speed / (p.pwmPitch / 1000);
    r.Tp = 1000 / r.f;
    r.onT = (r.Tp * p.duty) / 100;
    r.offT = r.Tp - r.onT;
    r.pulses = r.window / (p.pwmPitch / 1000);
    // application
    r.dose = (((r.qNoz / 60) * p.duty) / 100 / (p.speed * r.pm)) * 10000;
    r.mlPlant = ((((r.nActAvg * r.qNoz) / 60) * p.duty) / 100) * (r.window / p.speed) * 1000;
    r.endur = r.qAvg > 0 ? p.tankV / r.qAvg : Infinity;
    r.rowKm = (p.speed * 60 * r.endur) / 1000;
    // vision
    r.nozU = -0.05;
    r.camU = r.nozU + p.camLead;
    r.camY = -p.agvW / 2 + 0.04;
    r.yRow = p.standoff + p.mastX;
    r.camLat = r.yRow - r.camY;
    r.slant = Math.hypot(r.camLat, p.camH);
    r.footprint = 2 * r.slant * Math.tan((p.fov * Math.PI) / 360);
    r.frames = (r.footprint / p.speed) * p.fps;
    r.tTot = 1 / p.fps + p.procLat / 1000 + p.valveResp / 1000;
    r.leadReq = p.speed * r.tTot + p.pad / 1000;
    r.leadMargin = p.camLead - r.leadReq;
    calc = r;
  }

  /* ---------- checks ---------- */
  const f2 = (v: number) => v.toFixed(2), f1 = (v: number) => v.toFixed(1), f0 = (v: number) => v.toFixed(0);
  function checks(): Group[] {
    const r = calc, p = P, G: Group[] = [];
    const g1: Group = { t: "Coverage geometry", rows: [] };
    g1.rows.push({ l: "Fan width at the crop", v: f0(r.wf * 1000) + " mm", s: "info" });
    if (r.overlap < 0) g1.rows.push({ l: "Fan overlap", v: "gap " + f0((r.pm - r.wf) * 1000) + " mm", s: "bad", n: "Fans do not meet at the crop: unsprayed stripes between nozzles. Reduce pitch, increase standoff or spray angle." });
    else if (r.overlap < 0.05) g1.rows.push({ l: "Fan overlap", v: f0(r.overlap * 100) + " %", s: "warn", n: "Overlap under 5 %: any sway in the mast or a leaning plant opens a gap." });
    else if (r.overlap > 0.5) g1.rows.push({ l: "Fan overlap", v: f0(r.overlap * 100) + " %", s: "warn", n: "More than half of each fan is double-sprayed; you could use fewer nozzles or a wider pitch." });
    else g1.rows.push({ l: "Fan overlap", v: f0(r.overlap * 100) + " %", s: "ok" });
    const offIdx = [...disabled].sort((a, b) => a - b);
    g1.rows.push({ l: "Nozzles switched on", v: r.nOn + " of " + p.n, s: r.nOn === 0 ? "bad" : offIdx.length ? "warn" : "ok",
      n: r.nOn === 0 ? "Every nozzle is switched off; nothing is sprayed." : offIdx.length ? "Off: " + offIdx.map((i) => "N" + (i + 1)).join(", ") : "" });
    if (r.nOn === 0) {
      G.push(g1);
    } else {
      g1.rows.push({ l: "Covered band", v: f2(Math.max(0, r.bandLow)) + "–" + f2(r.bandHigh) + " m", s: "info" });
      if (offIdx.length) g1.rows.push(r.gapInterior > 0.005
        ? { l: "Gaps from switched-off nozzles", v: f0(r.gapInterior * 1000) + " mm", s: "bad", n: "Bands of the plant inside the covered height get no spray because a neighbouring fan cannot reach them." }
        : { l: "Gaps from switched-off nozzles", v: "none", s: "ok", n: "Neighbouring fans still overlap across the switched-off positions." });
      g1.rows.push(r.bandHigh >= p.plantMax
        ? { l: "Reaches tallest plants", v: "+" + f0((r.bandHigh - p.plantMax) * 100) + " cm", s: "ok" }
        : { l: "Reaches tallest plants", v: "−" + f0((p.plantMax - r.bandHigh) * 100) + " cm", s: "bad", n: `Top ${f0((p.plantMax - r.bandHigh) * 100)} cm of the tallest plants is not sprayed. Add nozzles or raise the pitch.` });
      g1.rows.push(r.bandLow <= p.targetLow
        ? { l: "Reaches lowest leaf", v: "ok at " + f2(p.targetLow) + " m", s: "ok" }
        : { l: "Reaches lowest leaf", v: "starts " + f2(r.bandLow) + " m", s: "bad", n: "Lower leaves are below the band. Lower N1 or switch the lowest nozzles back on." });
    }
    g1.rows.push({ l: "Switched-on nozzles above tallest plant", v: r.nUnused + " of " + r.nOn, s: r.nUnused > 1 ? "warn" : "info", n: r.nUnused > 1 ? "These valves never open for this crop; drop them to save weight and cost." : "" });
    g1.rows.push({ l: "Nozzle tip to canopy edge", v: f2(r.clrNoz) + " m", s: r.clrNoz < 0.03 ? "bad" : r.clrNoz < 0.1 ? "warn" : "ok", n: r.clrNoz < 0.03 ? "Leaves brush the nozzles." : r.clrNoz < 0.1 ? "Little room for plant lean or steering error." : "" });
    const cw = (v: number, side: string): Row => ({ l: "Wheel to canopy, " + side, v: f2(v) + " m", s: v < 0 ? "bad" : v < 0.1 ? "warn" : "ok", n: v < 0 ? "The AGV drives over the plants on this side. Change row width, AGV width, standoff or mast position." : v < 0.1 ? "Under 10 cm of steering margin." : "" });
    g1.rows.push(cw(r.clrRight, "crop side"));
    g1.rows.push(cw(r.clrLeft, "far side"));
    g1.rows.push({ l: "Mast top height", v: f2(r.mastTop) + " m", s: r.mastTop > 2.0 ? "warn" : "ok", n: r.mastTop > 2.0 ? "Tall mast: check tip-over on slopes and gate clearance." : "" });
    if (r.nOn > 0) G.push(g1);

    const g2: Group = { t: "Pump, pressure & filtration", rows: [] };
    g2.rows.push({ l: "Flow per nozzle (valve open)", v: r.qNoz.toFixed(3) + " L/min", s: "info" });
    g2.rows.push(r.Pset < 2 || r.Pset > 5
      ? { l: "Nozzle pressure", v: f1(r.Pset) + " bar", s: "warn", n: "LS 20 is rated for 2–5 bar." }
      : { l: "Nozzle pressure · droplets", v: f1(r.Pset) + " bar · " + ((r.drop && DROP_NAME[r.drop]) || "—"), s: "ok" });
    if (p.pressure > p.pumpPmax && p.relief >= p.pumpPmax) g2.rows.push({ l: "Pump reaches PCV setting", v: "no, max " + f1(p.pumpPmax) + " bar", s: "bad", n: `The pump shuts off at ${f1(p.pumpPmax)} bar, below the ${f1(p.pressure)} bar setting, so it never builds that pressure and there is no flow left for bypass or agitation.` });
    if (p.relief < p.pressure) g2.rows.push({ l: "Relief valve PSV-101", v: f1(p.relief) + " bar", s: "bad", n: "Relief is set below the working pressure, so it dumps flow and the line never reaches the PCV setting." });
    else if (p.relief < p.pressure + 0.5) g2.rows.push({ l: "Relief valve PSV-101", v: f1(p.relief) + " bar", s: "warn", n: "Within 0.5 bar of working pressure: the relief will chatter on valve-closing surges." });
    else if (p.relief >= p.pumpPmax) g2.rows.push({ l: "Relief valve PSV-101", v: f1(p.relief) + " bar", s: "warn", n: `Set above pump shut-off (${f1(p.pumpPmax)} bar), so it never opens; the pump dead-heads instead.` });
    else g2.rows.push({ l: "Relief valve PSV-101", v: f1(p.relief) + " bar", s: "ok" });
    const sag = r.Pset - r.Ppeak;
    if (r.nActMax === 0) g2.rows.push({ l: "Pressure while spraying", v: "no valve opens", s: "warn", n: "No switched-on nozzle covers this crop, so the pump only circulates." });
    else g2.rows.push(sag > 0.15
      ? { l: "Pressure with all " + r.nActMax + " valves open", v: f1(r.Ppeak) + " bar", s: "bad", n: `Pump delivers ${f1(r.qPump(r.Pset))} L/min at ${f1(r.Pset)} bar but the open nozzles need ${f1(r.nActMax * r.qNoz)} L/min. Pressure sags and the fans narrow.` }
      : { l: "Pressure with all " + r.nActMax + " valves open", v: f1(r.Ppeak) + " bar", s: "ok" });
    g2.rows.push({ l: "Peak / average spray demand", v: f2(r.nActMax * r.qNoz) + " / " + f2(r.qAvg) + " L/min", s: "info" });
    g2.rows.push({ l: "Bypass flow · tank agitation", v: f2(r.bypass) + " L/min · " + f1(r.agit) + " %/min", s: r.agit < 1 ? "bad" : r.agit < 3 ? "warn" : "ok", n: r.agit < 3 ? "Low return flow to AG-101. Aim for 3 %/min for solutions and 5 %/min or more for wettable powders." : "" });
    if (r.qPumpSet <= 0.01) g2.rows.push({ l: "Pump draw at 12 V", v: "stalled", s: "warn", n: "The pump is dead-heading at shut-off: no flow, and a diaphragm pump will cycle on its pressure switch." });
    else g2.rows.push({ l: "Pump draw at 12 V", v: f1(r.amps) + " A", s: r.amps > 15 ? "warn" : "ok", n: r.amps > 15 ? "High current for a 12 V pump circuit; check wiring and fuse." : "" });
    g2.rows.push({ l: "Equivalent orifice", v: f0(r.orifice) + " µm", s: "info" });
    const fo = r.filterOpen;
    if (fo > r.orifice / 2) g2.rows.push({ l: "Pressure filter F-102", v: p.filterMesh + " mesh · " + f0(fo) + " µm", s: "bad", n: `Openings are more than half the orifice size; tips will block. Lechler recommends ${r.recMesh} M for this tip.` });
    else if (p.filterMesh < 100) g2.rows.push({ l: "Pressure filter F-102", v: p.filterMesh + " mesh · " + f0(fo) + " µm", s: "warn", n: "The WEED-IT manual asks for at least 100 mesh to protect the PWM solenoid valves." });
    else if (p.filterMesh > 150) g2.rows.push({ l: "Pressure filter F-102", v: p.filterMesh + " mesh · " + f0(fo) + " µm", s: "warn", n: "Very fine element: fast clogging and higher pressure drop." });
    else g2.rows.push({ l: "Pressure filter F-102", v: p.filterMesh + " mesh · " + f0(fo) + " µm", s: "ok" });
    if (p.strainerMesh >= p.filterMesh) g2.rows.push({ l: "Suction strainer F-101", v: p.strainerMesh + " mesh · " + f0(r.strainerOpen) + " µm", s: "warn", n: "Finer than the pressure filter: the suction side clogs first and starves the pump." });
    else if (p.strainerMesh > 80) g2.rows.push({ l: "Suction strainer F-101", v: p.strainerMesh + " mesh · " + f0(r.strainerOpen) + " µm", s: "warn", n: "Fine suction strainers raise suction loss; 30–60 mesh is usual." });
    else g2.rows.push({ l: "Suction strainer F-101", v: p.strainerMesh + " mesh · " + f0(r.strainerOpen) + " µm", s: "ok" });
    G.push(g2);

    const g3: Group = { t: "Timing & PWM", rows: [] };
    g3.rows.push({ l: "Latency chain (frame + processing + valve)", v: f0(r.tTot * 1000) + " ms", s: "info" });
    g3.rows.push({ l: "Camera lead needed / available", v: f2(r.leadReq) + " / " + f2(p.camLead) + " m", s: r.leadMargin < 0 ? "bad" : r.leadMargin < 0.05 ? "warn" : "ok",
      n: r.leadMargin < 0 ? `Spray starts ${f0(-r.leadMargin * 1000)} mm late on each plant. Move the camera forward, slow down, or cut latency.` : r.leadMargin < 0.05 ? "Less than 5 cm of spare lead." : "" });
    g3.rows.push({ l: "Camera frames per plant", v: f1(r.frames), s: r.frames < 1.5 ? "bad" : r.frames < 3 ? "warn" : "ok", n: r.frames < 1.5 ? "Plants can pass between frames unseen." : r.frames < 3 ? "Fewer than 3 looks per plant; detection gets unreliable." : "" });
    if (r.camU > p.agvL + 0.05) g3.rows.push({ l: "Camera position", v: f2(r.camU - p.agvL) + " m ahead of bumper", s: "warn", n: "The camera needs a forward boom at this lead." });
    g3.rows.push(p.duty >= 100
      ? { l: "PWM frequency", v: "continuous (100 %)", s: "info" }
      : { l: "PWM frequency", v: f0(r.f) + " Hz", s: r.f > p.valveFmax ? "bad" : "ok", n: r.f > p.valveFmax ? `Above the valve limit of ${p.valveFmax} Hz. Use a longer pulse pitch or drive slower.` : "" });
    if (p.duty < 100) {
      const st: Status = r.onT < p.valveResp ? "bad" : r.onT < 2 * p.valveResp ? "warn" : r.offT < p.valveResp ? "warn" : "ok";
      g3.rows.push({ l: "Pulse on / off time", v: f1(r.onT) + " / " + f1(r.offT) + " ms", s: st,
        n: r.onT < p.valveResp ? "On-time is shorter than the valve response; the valve never fully opens." : r.onT < 2 * p.valveResp ? "On-time is less than twice the valve response; flow is well below nominal." : r.offT < p.valveResp ? "Off-time is shorter than the valve response; pulses merge into a stream." : "" });
    }
    g3.rows.push({ l: "Pulses per spray window", v: f1(r.pulses), s: r.pulses < 2 ? "bad" : r.pulses < 4 ? "warn" : "ok", n: r.pulses < 2 ? "One pulse or less per plant: patchy coverage." : r.pulses < 4 ? "Coarse pulse pattern on each plant." : "" });
    G.push(g3);

    const g4: Group = { t: "Application & tank", rows: [] };
    g4.rows.push({ l: "Dose on the canopy face", v: f0(r.dose) + " L/ha", s: "info" });
    g4.rows.push({ l: "Liquid per plant", v: f1(r.mlPlant) + " mL", s: "info" });
    g4.rows.push({ l: "Spray window · share of row sprayed", v: f0(r.window * 1000) + " mm · " + f0(r.sprayFrac * 100) + " %", s: r.sprayFrac >= 1 ? "warn" : "info", n: r.sprayFrac >= 1 ? "Windows touch: the row is sprayed continuously, so spot spraying saves nothing." : "" });
    g4.rows.push({ l: "Tank lasts", v: isFinite(r.endur) ? f0(r.endur) + " min · " + f1(r.rowKm) + " km of row" : "—", s: "info" });
    g4.rows.push({ l: "Tank height on a " + f2(r.tankL) + " × " + f2(r.tankW) + " m footprint", v: f2(r.tankH) + " m", s: r.tankH > 0.6 ? "warn" : "ok", n: r.tankH > 0.6 ? "A tall tank raises the centre of gravity; consider a wider footprint." : "" });
    g4.rows.push({ l: "Loaded mass vs payload", v: f0(r.mass) + " / " + f0(p.payload) + " kg", s: r.mass > p.payload * 1.1 ? "bad" : r.mass > p.payload ? "warn" : "ok", n: r.mass > p.payload ? "Liquid, tank, mast and hydraulics exceed the AGV payload rating." : "" });
    G.push(g4);
    return G;
  }
  function renderResults() {
    const G = checks();
    let html = "";
    const bad: string[] = [], warn: string[] = [];
    for (const g of G) {
      html += `<section class="${c("res-card")}"><h3>${g.t}</h3><dl>`;
      for (const r of g.rows) {
        const chip = { ok: "ok", warn: "check", bad: "fails", info: "info" }[r.s];
        html += `<div class="${c("row s-" + r.s)}"><dt>${r.l}</dt><dd><span class="${c("val")}">${r.v}</span><span class="${c("chip")}">${chip}</span></dd>${r.n ? `<p class="${c("note")}">${r.n}</p>` : ""}</div>`;
        if (r.s === "bad") bad.push(r.l);
        if (r.s === "warn") warn.push(r.l);
      }
      html += "</dl></section>";
    }
    ref("resGrid").innerHTML = html;
    let sh = `<h2>${bad.length === 0 && warn.length === 0 ? "All checks pass" : (bad.length ? bad.length + " failing" : "") + (bad.length && warn.length ? " · " : "") + (warn.length ? warn.length + " to check" : "")}</h2>`;
    if (bad.length || warn.length) sh += "<ul>" + bad.map((b) => `<li class="${c("bad")}">${b}</li>`).join("") + warn.map((w) => `<li class="${c("warn")}">${w}</li>`).join("") + "</ul>";
    ref("summary").innerHTML = sh;
  }

  /* ---------- simulation ---------- */
  function mulberry32(a: number) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32(11), simT = 0, X = 0, plants: Plant[] = [], nextX = 0;
  function plantGeom(pl: Plant) {
    pl.h = P.plantMin + (P.plantMax - P.plantMin) * pl.hu;
    pl.c = P.canopy * (0.85 + 0.3 * pl.cu);
  }
  function genPlants(upto: number) {
    while (nextX < upto) {
      const pl = { x0: nextX, jit: (rng() - 0.5) * 0.3, hu: rng(), cu: rng(), det: false } as Plant;
      pl.x = pl.x0 + pl.jit * P.plantSpacing;
      plantGeom(pl);
      plants.push(pl);
      nextX += P.plantSpacing;
    }
  }
  function step(sdt: number) {
    const r = calc, v = P.speed;
    simT += sdt;
    X += v * sdt;
    const cam = X + r.camU, noz = X + r.nozU;
    genPlants(cam + 3);
    const frame = 1 / P.fps, need = (P.procLat + P.valveResp) / 1000, pad = P.pad / 1000;
    for (const pl of plants) {
      if (pl.det) continue;
      const lead = pl.x - pl.c / 2;
      if (cam >= lead) {
        const tCross = simT - (cam - lead) / v;
        const tDet = Math.ceil(tCross / frame - 1e-9) * frame;
        const xnDet = noz - v * (simT - tDet);
        pl.ws = lead - pad;
        pl.we = pl.x + pl.c / 2 + pad;
        const avail = (pl.ws - xnDet) / v;
        pl.shift = Math.max(0, (need - avail) * v);
        pl.sa = Math.min(pl.we, pl.ws + pl.shift);
        pl.status = pl.shift <= 1e-6 ? "ok" : pl.sa >= pl.we ? "missed" : "late";
        pl.pitch = P.pwmPitch / 1000;
        pl.duty = P.duty / 100;
        // what the valve can physically do at this speed and pulse pitch
        const Tp = (pl.pitch / v) * 1000, onMs = Tp * pl.duty, off = Tp - onMs, rsp = P.valveResp;
        pl.mode = "ok";
        if (pl.duty < 1) {
          if (Tp < 2 * rsp || 1000 / Tp > P.valveFmax) pl.mode = "erratic"; // cannot complete an open-close cycle
          else if (onMs < rsp) pl.mode = "weak"; // never fully opens
          else if (off < rsp) pl.mode = "stream"; // never fully closes: pulses merge
        }
        pl.det = true;
      }
    }
    const cut = X - 2.2;
    while (plants.length && plants[0].x < cut) plants.shift();
  }
  function warmup() {
    for (let i = 0; i < 400; i++) step(2.8 / P.speed / 400);
  }
  function resetSim() {
    rng = mulberry32(11);
    simT = 0;
    X = 0;
    plants = [];
    nextX = calc.camU + 0.3;
    warmup();
  }
  function cropChanged(k: Key) {
    const noz = X + calc.nozU, pad = P.pad / 1000;
    if (k === "plantSpacing") {
      plants = plants.filter((pl) => pl.det);
      const last = plants[plants.length - 1];
      nextX = last ? last.x + P.plantSpacing : X + calc.camU + 0.2;
      nextX = Math.max(nextX, X + calc.camU + 0.05);
      for (const pl of plants) {
        if (pl.x - pl.c / 2 > noz) plantGeom(pl);
      }
    } else {
      for (const pl of plants) {
        if (pl.x - pl.c / 2 - pad <= noz && pl.det) continue;
        plantGeom(pl);
        if (pl.det) {
          pl.ws = pl.x - pl.c / 2 - pad;
          pl.we = pl.x + pl.c / 2 + pad;
          pl.sa = Math.min(pl.we, pl.ws + pl.shift);
          pl.status = pl.shift <= 1e-6 ? "ok" : pl.sa >= pl.we ? "missed" : "late";
        }
      }
    }
  }
  function pwmOn(pl: Plant, x: number) {
    if (pl.duty >= 1 || pl.mode === "stream" || pl.mode === "erratic") return true;
    const ph = (((x - pl.sa) % pl.pitch) + pl.pitch) % pl.pitch;
    return ph < pl.duty * pl.pitch;
  }

  function outcome(pl: Plant) {
    if (pl.status === "missed") return { k: "miss", lab: "missed" };
    if (calc.nAct(pl.h) === 0) return { k: "miss", lab: "unsprayed" };
    if (pl.status === "late") return { k: "miss", lab: "late" };
    if (calc.uncovered(P.targetLow, pl.h) > 0.01) return { k: "issue", lab: "partly" };
    if (pl.mode === "weak") return { k: "issue", lab: "weak" };
    if (pl.mode === "stream") return { k: "issue", lab: "stream" };
    if (pl.mode === "erratic") return { k: "issue", lab: "erratic" };
    return { k: "ok", lab: "sprayed" };
  }

  /* ---------- drawing helpers ---------- */
  const tok: Record<string, string> = {};
  function readTokens() {
    const cs = getComputedStyle(root); // the palette lives on the simulator's wrapper, not on :root
    ["d-ink", "d-muted", "d-mast", "d-fan", "d-leaf", "d-leaf-edge", "d-stem", "d-leaf-text", "d-tank", "d-tank-edge", "d-chassis", "d-chassis-edge", "d-wheel", "d-fov", "d-fov-edge", "d-cam", "d-deposit", "d-miss", "d-hatch", "d-ok", "paper", "accent", "bad", "warn", "ok", "muted", "line"].forEach((k) => (tok[k] = cs.getPropertyValue("--" + k).trim()));
  }
  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
  function prep(cv: HTMLCanvasElement) {
    const ctx = cv.getContext("2d")!, W = cv.clientWidth, H = cv.clientHeight, d = dpr();
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) {
      cv.width = Math.round(W * d);
      cv.height = Math.round(H * d);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = tok.paper;
    ctx.fillRect(0, 0, W, H);
    return { ctx, W, H };
  }
  const FONT = (sz: number, w?: number) => `${w || 400} ${sz}px Lato, "Helvetica Neue", Arial, sans-serif`;
  function text(ctx: Ctx, t: string, x: number, y: number, o: TextOpts = {}) {
    ctx.font = FONT(o.size || 11, o.weight);
    ctx.fillStyle = o.color || tok["d-ink"];
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    if (o.rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(o.rot);
      ctx.fillText(t, 0, 0);
      ctx.restore();
    } else ctx.fillText(t, x, y);
  }
  function italic(ctx: Ctx, t: string, x: number, y: number, o: TextOpts = {}) {
    ctx.font = `italic 400 ${o.size || 11}px Lato, Arial, sans-serif`;
    ctx.fillStyle = o.color || tok["d-muted"];
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t, x, y);
  }
  function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, w?: number, dash?: number[]) {
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = col;
    ctx.lineWidth = w || 1;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  type DimOpts = { color?: string; lx?: number; below?: boolean; align?: CanvasTextAlign; size?: number; right?: boolean };
  function dimH(ctx: Ctx, x1: number, x2: number, y: number, label: string, o: DimOpts = {}) {
    const col = o.color || tok["d-ink"];
    line(ctx, x1, y, x2, y, col, 1);
    line(ctx, x1, y - 5, x1, y + 5, col, 1);
    line(ctx, x2, y - 5, x2, y + 5, col, 1);
    if (label) text(ctx, label, o.lx != null ? o.lx : (x1 + x2) / 2, o.below ? y + 13 : y - 5, { align: o.align || "center", color: col, size: o.size });
  }
  function dimV(ctx: Ctx, x: number, y1: number, y2: number, label: string, o: DimOpts = {}) {
    const col = o.color || tok["d-ink"];
    line(ctx, x, y1, x, y2, col, 1);
    line(ctx, x - 5, y1, x + 5, y1, col, 1);
    line(ctx, x - 5, y2, x + 5, y2, col, 1);
    if (label) text(ctx, label, x + (o.right ? 11 : -5), (y1 + y2) / 2, { align: "center", rot: -Math.PI / 2, color: col, size: o.size });
  }
  function hexA(col: string, a: number) {
    if (col.startsWith("#")) {
      let h = col.slice(1);
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    return col;
  }

  /* ---------- canvas sizing ---------- */
  const rearC = ref<HTMLCanvasElement>("rear"), planC = ref<HTMLCanvasElement>("plan"), pumpC = ref<HTMLCanvasElement>("pump");
  function rearRange() {
    const r = calc, p = P;
    return {
      xL: Math.min(-r.rowX - p.canopy / 2, r.xAgv - p.agvW / 2) - 0.3,
      xR: Math.max(r.rowX + p.canopy / 2, r.mastWX + 0.05) + 0.62,
      yB: -0.26,
      yT: Math.max(p.plantMax + 0.06, r.geoHigh, r.mastTop, p.deckH + r.tankH) + 0.26,
    };
  }
  function planRange() {
    const r = calc, p = P;
    return { uL: -1.5, uR: Math.max(p.agvL, r.camU + 0.05) + 0.95, yB: -p.agvW / 2 - 0.3, yT: r.yRow + p.canopy * 0.575 + 0.38 };
  }
  function sizeCanvas(cv: HTMLCanvasElement, aspect: number, minH: number, maxH: number) {
    const W = cv.clientWidth || 600;
    cv.style.height = Math.round(Math.min(maxH, Math.max(minH, W * aspect))) + "px";
  }
  function layoutCanvases() {
    const a = rearRange(), b = planRange();
    sizeCanvas(rearC, (a.yT - a.yB) / (a.xR - a.xL), 320, 640);
    sizeCanvas(planC, (b.yT - b.yB) / (b.uR - b.uL), 240, 560);
    pumpC.style.height = (pumpC.clientWidth < 520 ? 240 : 260) + "px";
  }

  /* ---------- rear view ---------- */
  function drawRearPlant(ctx: Ctx, Xf: (m: number) => number, Y: (m: number) => number, s: number, x: number, h: number, canopy: number, low: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    line(ctx, Xf(x), Y(0), Xf(x), Y(h), tok["d-stem"], Math.max(2, 0.012 * s));
    let side = 1;
    const len = canopy / 2;
    for (let y = Math.max(low, 0.08); y < h - 0.07; y += 0.125) {
      ctx.save();
      ctx.translate(Xf(x + side * len * 0.5), Y(y + 0.03));
      ctx.rotate(-side * 0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, len * 0.52 * s), Math.max(2, 0.024 * s), 0, 0, Math.PI * 2);
      ctx.fillStyle = tok["d-leaf"];
      ctx.fill();
      ctx.strokeStyle = tok["d-leaf-edge"];
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      side = -side;
    }
    ctx.beginPath();
    ctx.ellipse(Xf(x), Y(h), Math.max(3, 0.03 * s), Math.max(2, 0.014 * s), 0, 0, Math.PI * 2);
    ctx.fillStyle = tok["d-ok"];
    ctx.fill();
    ctx.restore();
  }
  let rearState: RearState = {};
  function drawRear() {
    const { ctx, W, H } = prep(rearC), r = calc, p = P, rg = rearRange();
    const s = Math.min((W - 16) / (rg.xR - rg.xL), (H - 16) / (rg.yT - rg.yB));
    const ox = (W - s * (rg.xR - rg.xL)) / 2, oy = H - (H - s * (rg.yT - rg.yB)) / 2;
    const Xf = (m: number) => ox + (m - rg.xL) * s, Y = (m: number) => oy - (m - rg.yB) * s;
    // ground
    const g0 = Y(0);
    line(ctx, Xf(rg.xL), g0, Xf(rg.xR), g0, tok["d-ink"], 1.4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(Xf(rg.xL), g0, Xf(rg.xR) - Xf(rg.xL), 9);
    ctx.clip();
    for (let px = Xf(rg.xL); px < Xf(rg.xR) + 12; px += 7) line(ctx, px, g0 + 1, px - 8, g0 + 10, tok["d-hatch"], 1);
    ctx.restore();

    // current plant
    const noz = X_world() + r.nozU;
    let cur: Plant | null = null;
    for (const pl of plants) {
      if (pl.x + pl.c / 2 + P.pad / 1000 > noz - 0.005) {
        cur = pl;
        break;
      }
    }
    let inWin = false, open = false, lateNow = false, actN = 0;
    if (cur && cur.det) {
      inWin = noz >= cur.sa && noz <= cur.we;
      lateNow = noz >= cur.ws && noz < cur.sa;
      if (inWin) open = pwmOn(cur, noz);
    }
    const curH = cur ? cur.h : (p.plantMin + p.plantMax) / 2;
    const active = r.nozH.map((z, i) => r.on[i] && inWin && z + r.wf / 2 >= p.targetLow && z - r.wf / 2 <= curH);
    actN = active.filter(Boolean).length;

    // neighbour row (far side)
    drawRearPlant(ctx, Xf, Y, s, -r.rowX, (p.plantMin + p.plantMax) / 2, p.canopy, p.targetLow, 0.35);
    italic(ctx, "neighbour row", Xf(-r.rowX), Y(-0.19) + 13, { align: "center" });

    // AGV wheels + chassis + tank (drawn first: the mast and fans are behind the AGV, nearer the viewer)
    const xa = r.xAgv, hw = p.agvW / 2;
    ctx.fillStyle = tok["d-wheel"];
    [[xa - hw + 0.015], [xa + hw - 0.095]].forEach(([x]) => {
      rrect(ctx, Xf(x), Y(0.17), 0.08 * s, 0.17 * s, 3);
      ctx.fill();
    });
    rrect(ctx, Xf(xa - hw), Y(p.deckH), p.agvW * s, (p.deckH - 0.1) * s, 3);
    ctx.fillStyle = tok["d-chassis"];
    ctx.fill();
    ctx.strokeStyle = tok["d-chassis-edge"];
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = FONT(11);
    if (ctx.measureText("AGV chassis").width < p.agvW * s - 8) text(ctx, "AGV chassis", Xf(xa), Y((p.deckH + 0.1) / 2) + 4, { align: "center", color: tok["d-muted"] });
    rrect(ctx, Xf(xa - r.tankW / 2), Y(p.deckH + r.tankH), r.tankW * s, r.tankH * s, 5);
    ctx.fillStyle = tok["d-tank"];
    ctx.fill();
    ctx.strokeStyle = tok["d-tank-edge"];
    ctx.lineWidth = 1.2;
    ctx.stroke();
    {
      const t1 = `T-101 tank, ${p.tankV} L`, t2 = `T-101, ${p.tankV} L`, room = r.tankW * s - 8, tall = r.tankH * s;
      ctx.font = FONT(11, 700);
      const lab = ctx.measureText(t1).width < room ? t1 : ctx.measureText(t2).width < room ? t2 : null;
      if (lab && tall >= 14) {
        const two = tall >= 32;
        text(ctx, lab, Xf(xa), Y(p.deckH + r.tankH / 2) + (two ? -1 : 4), { align: "center", weight: 700, color: tok["d-tank-edge"] });
        if (two) text(ctx, f2(r.tankH) + " m tall", Xf(xa), Y(p.deckH + r.tankH / 2) + 12, { align: "center", size: 10, color: tok["d-muted"] });
      }
    }

    const fitR = (t: string, x: number, y: number, o: TextOpts) => {
      ctx.font = FONT(o.size || 11, o.weight);
      const w = ctx.measureText(t).width;
      if ((o.align || "left") === "left" && x + w > W - 4) x = W - 4 - w;
      text(ctx, t, x, y, o);
    };
    const tipX = r.mastWX + 0.045;
    line(ctx, Xf(tipX), Y(p.plantMin), Xf(r.rowX + 0.1), Y(p.plantMin), tok["d-muted"], 1, [4, 3]);
    fitR(f2(p.plantMin) + " m shortest", Xf(r.rowX + 0.12), Y(p.plantMin) + 4, { color: tok["d-ok"], size: 11 });
    if (p.plantMax - p.plantMin > 0.04) {
      line(ctx, Xf(tipX), Y(p.plantMax), Xf(r.rowX + 0.1), Y(p.plantMax), tok["d-muted"], 1, [2, 4]);
    }

    // fans
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, g0);
    ctx.clip();
    r.nozH.forEach((z, i) => {
      ctx.beginPath();
      ctx.moveTo(Xf(tipX), Y(z));
      ctx.lineTo(Xf(r.rowX), Y(z + r.wf / 2));
      ctx.lineTo(Xf(r.rowX), Y(z - r.wf / 2));
      ctx.closePath();
      if (!r.on[i]) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = hexA(tok["bad"], 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      ctx.fillStyle = hexA(tok["d-fan"], active[i] ? 0.25 + (0.4 * p.duty) / 100 : 0.13);
      ctx.fill();
      if (hover === i) {
        ctx.strokeStyle = tok["accent"];
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });
    ctx.restore();

    // plant on the target row
    const pa = cur ? (inWin || lateNow ? 1 : Math.max(0.35, Math.min(0.9, 1 - ((cur.ws ?? cur.x) - noz) / 0.8))) : 0.6;
    drawRearPlant(ctx, Xf, Y, s, r.rowX, curH, cur ? cur.c : p.canopy, p.targetLow, pa);

    // bracket + strut
    const mx = r.mastWX;
    if (mx > xa + hw) {
      ctx.fillStyle = tok["d-chassis-edge"];
      ctx.fillRect(Xf(xa + hw), Y(p.deckH - 0.04), Math.max(2, (mx - 0.018 - (xa + hw)) * s), 0.1 * s);
    }
    line(ctx, Xf(mx - 0.01), Y(Math.min(r.mastTop - 0.05, p.deckH + 0.42)), Xf(Math.max(xa - hw + 0.05, Math.min(mx - 0.1, xa + hw - 0.12))), Y(p.deckH), tok["d-chassis-edge"], 2.5);
    // mast
    rrect(ctx, Xf(mx - 0.018), Y(r.mastTop), 0.036 * s, (r.mastTop - 0.06) * s, 2);
    ctx.fillStyle = tok["d-mast"];
    ctx.fill();
    const hits: Hit[] = [], sq = Math.max(7, 0.03 * s), sqh = Math.max(6, 0.024 * s);
    r.nozH.forEach((z, i) => {
      const x0 = Xf(mx + 0.018), y0 = Y(z) - sqh / 2;
      if (!r.on[i]) {
        ctx.fillStyle = tok.paper;
        ctx.fillRect(x0, y0, sq, sqh);
        ctx.strokeStyle = tok["bad"];
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, sq - 1, sqh - 1);
        line(ctx, x0 + 2, y0 + 2, x0 + sq - 2, y0 + sqh - 2, tok["bad"], 1.2);
        line(ctx, x0 + sq - 2, y0 + 2, x0 + 2, y0 + sqh - 2, tok["bad"], 1.2);
      } else {
        ctx.fillStyle = active[i] && open ? tok["d-deposit"] : tok["d-mast"];
        ctx.fillRect(x0, y0, sq, sqh);
      }
      if (hover === i) {
        ctx.strokeStyle = tok["accent"];
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 - 3, y0 - 3, sq + 6, sqh + 6);
      }
      if (sel.has(i)) {
        ctx.strokeStyle = tok["accent"];
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x0 - 4, y0 - 4, sq + 8, sqh + 8);
        ctx.setLineDash([]);
      }
      text(ctx, "N" + (i + 1), Xf(mx - 0.024), Y(z) + 3.5, { align: "right", size: 9, color: r.on[i] ? tok["d-muted"] : tok["bad"], weight: r.on[i] ? 400 : 700 });
      hits.push({ i, y: Y(z), x0: x0 - 6, x1: Xf(r.rowX), sqx1: x0 + sq + 6, half: sqh / 2 + 5 });
    });

    // dims
    const topY = Y(r.mastTop + 0.1);
    dimH(ctx, Xf(tipX), Xf(r.rowX), topY, f2(p.standoff) + " m to the plants");
    text(ctx, `N${p.n} · ${f2(r.nozH[p.n - 1])} m`, Xf(tipX) + 4, topY + 14, { size: 10.5 });
    if (p.n >= 2) {
      const z1 = r.nozH[p.n - 2], z2 = r.nozH[p.n - 1], xx = Xf(mx - 0.14);
      line(ctx, xx, Y(z1), xx, Y(z2), tok["d-ink"], 1);
      line(ctx, xx - 4, Y(z1), xx + 4, Y(z1), tok["d-ink"], 1);
      line(ctx, xx - 4, Y(z2), xx + 4, Y(z2), tok["d-ink"], 1);
      text(ctx, `pitch ${p.pitch} mm`, xx - 6, Y((z1 + z2) / 2) + 4, { align: "right", size: 10.5 });
    }
    text(ctx, `N1 · ${f2(p.h1)} m`, Xf(tipX) + 6, Y(Math.max(0.03, p.h1 - r.wf / 2)) + 13, { size: 10.5 });
    const bx = Xf(r.rowX + 0.13), bl = Math.max(0, r.bandLow);
    if (r.nOn) {
      dimV(ctx, bx, Y(r.bandHigh), Y(bl), "", {});
      text(ctx, `covered band ${f2(r.bandHigh - bl)} m`, bx - 7, (Y(r.bandHigh) + Y(bl)) / 2, { align: "center", rot: -Math.PI / 2, size: 10.5 });
      fitR(f2(r.bandHigh) + " m", bx + 8, Y(r.bandHigh) + 4, { size: 10.5 });
      fitR(f2(bl) + " m", bx + 8, Y(bl) + 4, { size: 10.5 });
    }
    // overlap callout
    if (p.n >= 2) {
      const zc = r.nozH[0] + r.pm / 2, ly = Y(r.nozH[0] + r.pm * 2.4), lx = Xf(r.rowX + 0.2);
      const bad = r.overlap < 0;
      const col = bad ? tok["bad"] : tok["d-ink"];
      line(ctx, lx, ly, Xf(r.rowX - 0.005), Y(zc), col, 1);
      ctx.beginPath();
      ctx.arc(Xf(r.rowX - 0.005), Y(zc), 2.5, 0, 7);
      ctx.fillStyle = col;
      ctx.fill();
      fitR(bad ? `fans leave ${f0((r.pm - r.wf) * 1000)} mm gaps` : `fans overlap ${f0(r.overlap * 100)} %`, lx + 3, ly - 2, { color: col, size: 10.5 });
      fitR(`at ${f2(p.standoff)} m`, lx + 3, ly + 11, { color: col, size: 10.5 });
    }
    // width and deck
    dimH(ctx, Xf(xa - hw), Xf(xa + hw), Y(-0.19), f2(p.agvW) + " m wide", { below: true });
    dimV(ctx, Xf(xa - hw - 0.07), Y(p.deckH), Y(0), "deck " + f2(p.deckH) + " m");
    // wheel clearances
    const cy = Y(-0.05);
    const cl = (x1: number, x2: number, v: number) => {
      const col = v < 0 ? tok["bad"] : v < 0.1 ? tok["warn"] : tok["d-muted"];
      line(ctx, Xf(x1), cy, Xf(x2), cy, col, 1, [3, 2]);
      text(ctx, f2(v) + " m", (Xf(x1) + Xf(x2)) / 2, cy + 12, { align: "center", size: 10, color: col });
    };
    cl(xa + hw, r.rowX - p.canopy / 2, r.clrRight);
    cl(-r.rowX + p.canopy / 2, xa - hw, r.clrLeft);
    // title
    ctx.beginPath();
    ctx.arc(20, 20, 7, 0, 7);
    ctx.strokeStyle = tok["d-ink"];
    ctx.lineWidth = 1.3;
    ctx.stroke();
    line(ctx, 15, 15, 25, 25, tok["d-ink"], 1.3);
    line(ctx, 25, 15, 15, 25, tok["d-ink"], 1.3);
    text(ctx, "travel into the page", 33, 24, { size: 11 });
    italic(ctx, "Rear view, to scale", 14, 42);
    if (drag && drag.moved) {
      const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
      ctx.fillStyle = hexA(tok["accent"], 0.08);
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = tok["accent"];
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    rearState = { cur, inWin, open, lateNow, actN, hits, fanHalf: (r.wf / 2) * s, tipSX: Xf(tipX) };
  }

  /* ---------- plan view ---------- */
  function drawPlan() {
    const { ctx, W, H } = prep(planC), r = calc, p = P, rg = planRange();
    const s = Math.min((W - 16) / (rg.uR - rg.uL), (H - 16) / (rg.yT - rg.yB));
    const ox = (W - s * (rg.uR - rg.uL)) / 2, oy = H - (H - s * (rg.yT - rg.yB)) / 2;
    const U = (m: number) => ox + (m - rg.uL) * s, Yp = (m: number) => oy - (m - rg.yB) * s;
    const Xw = X_world(), noz = Xw + r.nozU;
    // distance ticks
    const by = Yp(rg.yB + 0.06);
    for (let k = Math.ceil((Xw + rg.uL) / 0.25); k * 0.25 < Xw + rg.uR; k++) {
      const u = U(k * 0.25 - Xw), major = k % 4 === 0;
      line(ctx, u, by, u, by - (major ? 7 : 4), tok["d-hatch"], 1);
    }
    line(ctx, U(rg.uL), by, U(rg.uR), by, tok["d-hatch"], 1);
    // FOV
    const yFar = r.yRow + p.canopy / 2 + 0.14, hwF = ((r.footprint / 2) * (yFar - r.camY)) / (r.yRow - r.camY);
    ctx.beginPath();
    ctx.moveTo(U(r.camU), Yp(r.camY));
    ctx.lineTo(U(r.camU - hwF), Yp(yFar));
    ctx.lineTo(U(r.camU + hwF), Yp(yFar));
    ctx.closePath();
    ctx.fillStyle = hexA(tok["d-fov"], 0.55);
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = tok["d-fov-edge"];
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(U(rg.uL), 0, U(rg.uR) - U(rg.uL), H);
    ctx.clip();
    // row line
    line(ctx, U(rg.uL), Yp(r.yRow), U(rg.uR), Yp(r.yRow), tok["d-ok"], 1, [6, 5]);
    // spray windows
    const barY = r.yRow - p.canopy / 2 - 0.07, barH = 0.04;
    for (const pl of plants) {
      if (!pl.det) continue;
      const a = pl.ws - Xw, b = pl.we - Xw;
      ctx.strokeStyle = hexA(tok["d-deposit"], 0.7);
      ctx.lineWidth = 1;
      ctx.strokeRect(U(a), Yp(barY + barH / 2), (b - a) * s, barH * s);
      const done = Math.min(pl.we, noz);
      if (pl.sa > pl.ws) {
        const e = Math.min(pl.sa, done);
        if (e > pl.ws) {
          ctx.fillStyle = hexA(tok["d-miss"], 0.75);
          ctx.fillRect(U(a), Yp(barY + barH / 2), (e - pl.ws) * s, barH * s);
        }
      }
      if (done > pl.sa && calc.nAct(pl.h) > 0) {
        const m = pl.mode;
        ctx.fillStyle = m === "weak" ? hexA(tok["d-deposit"], 0.35) : m === "erratic" ? hexA(tok["d-deposit"], 0.5) : tok["d-deposit"];
        if (pl.duty >= 1 || m === "stream" || m === "erratic") ctx.fillRect(U(pl.sa - Xw), Yp(barY + barH / 2), (done - pl.sa) * s, barH * s);
        else
          for (let x = pl.sa; x < done; x += pl.pitch) {
            const e = Math.min(x + pl.pitch * pl.duty, done, pl.we);
            if (e > x) ctx.fillRect(U(x - Xw), Yp(barY + barH / 2), Math.max(1, (e - x) * s), barH * s);
          }
        if (m !== "ok") {
          ctx.strokeStyle = tok["warn"];
          ctx.lineWidth = 1.2;
          ctx.strokeRect(U(pl.sa - Xw), Yp(barY + barH / 2), (done - pl.sa) * s, barH * s);
        }
      }
    }
    // plants
    for (const pl of plants) {
      const u = pl.x - Xw;
      if (u < rg.uL - 0.5 || u > rg.uR + 0.5) continue;
      ctx.beginPath();
      ctx.arc(U(u), Yp(r.yRow), (pl.c / 2) * s, 0, 7);
      ctx.fillStyle = hexA(tok["d-leaf"], 0.8);
      ctx.fill();
      ctx.strokeStyle = pl.det ? tok["d-fov-edge"] : tok["d-leaf-edge"];
      ctx.lineWidth = pl.det && pl.x + pl.c / 2 > noz ? 1.6 : 1;
      ctx.stroke();
      if (pl.det && pl.we < noz) {
        const o = outcome(pl);
        text(ctx, o.lab, U(u), Yp(r.yRow) + 4, { align: "center", weight: 700, size: 10, color: o.k === "ok" ? tok["d-leaf-text"] : o.k === "miss" ? tok["d-miss"] : tok["warn"] });
      }
    }
    ctx.restore();
    // live fan sheet (seen edge-on from above)
    if (rearState.inWin && rearState.actN! > 0) {
      ctx.fillStyle = hexA(tok["d-fan"], 0.35 + (0.4 * p.duty) / 100);
      ctx.fillRect(U(r.nozU) - 3, Yp(r.yRow), 6, (r.yRow - p.mastX) * s);
    }
    // nozzle plane
    line(ctx, U(r.nozU), Yp(p.mastX), U(r.nozU), Yp(r.yRow + p.canopy / 2 + 0.06), tok["d-deposit"], 1.6);
    text(ctx, "nozzle plane", U(r.nozU) - 5, Yp(r.yRow + p.canopy / 2 + 0.06) - 2, { align: "right", weight: 700, color: tok["d-deposit"], size: 10.5 });
    const dense = s < 125;
    // AGV
    const L = p.agvL, hw = p.agvW / 2;
    ctx.fillStyle = tok["d-wheel"];
    [[0.05, hw], [0.05, -hw], [L - 0.25, hw], [L - 0.25, -hw]].forEach(([u, y]) => {
      rrect(ctx, U(u), Yp(y + 0.035), 0.2 * s, 0.07 * s, 3);
      ctx.fill();
    });
    rrect(ctx, U(0), Yp(hw), L * s, p.agvW * s, 6);
    ctx.fillStyle = hexA(tok["d-chassis"], 0.92);
    ctx.fill();
    ctx.strokeStyle = tok["d-ink"];
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const boxH = p.agvW - 0.16;
    ([[0.025, "hydraulics"], [L - 0.105, "electronics"]] as [number, string][]).forEach(([u, lab]) => {
      rrect(ctx, U(u), Yp(boxH / 2), 0.08 * s, boxH * s, 3);
      ctx.fillStyle = tok["paper"];
      ctx.fill();
      ctx.strokeStyle = tok["d-chassis-edge"];
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, lab, U(u + 0.04), Yp(0), { align: "center", rot: -Math.PI / 2, size: 10, color: tok["d-muted"], base: "middle" });
    });
    const tu = (L - r.tankL) / 2;
    rrect(ctx, U(tu), Yp(r.tankW / 2), r.tankL * s, r.tankW * s, 5);
    ctx.fillStyle = tok["d-tank"];
    ctx.fill();
    ctx.strokeStyle = tok["d-tank-edge"];
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.font = FONT(11, 700);
    if (ctx.measureText("T-101 tank").width < r.tankL * s - 6) {
      text(ctx, "T-101 tank", U(L / 2), Yp(0) - 2, { align: "center", weight: 700, color: tok["d-tank-edge"] });
      text(ctx, f2(r.tankL) + " × " + f2(r.tankW) + " m", U(L / 2), Yp(0) + 12, { align: "center", size: 10, color: tok["d-tank-edge"] });
    } else text(ctx, "T-101", U(L / 2), Yp(0) + 4, { align: "center", weight: 700, size: 10, color: tok["d-tank-edge"] });
    // mast
    ctx.fillStyle = tok["d-mast"];
    ctx.fillRect(U(r.nozU) - 0.025 * s, Yp(p.mastX) - 0.025 * s, 0.05 * s, 0.05 * s);
    text(ctx, "mast", U(r.nozU) - 0.04 * s, Yp(p.mastX) + 0.03 * s + 10, { align: "right", size: 10.5 });
    // camera
    if (r.camU > L) line(ctx, U(L), Yp(r.camY), U(r.camU), Yp(r.camY), tok["d-chassis-edge"], 3);
    ctx.fillStyle = tok["d-cam"];
    ctx.fillRect(U(r.camU) - 0.025 * s, Yp(r.camY) - 0.025 * s, 0.05 * s, 0.05 * s);
    line(ctx, U(r.camU), Yp(r.camY), U(r.camU), Yp(rg.yT - 0.12), tok["d-fov-edge"], 1, [3, 3]);
    line(ctx, U(r.nozU), Yp(r.yRow + p.canopy / 2 + 0.06), U(r.nozU), Yp(rg.yT - 0.12), tok["d-muted"], 1, [3, 3]);
    dimH(ctx, U(r.nozU), U(r.camU), Yp(rg.yT - 0.12), f2(p.camLead) + " m: camera axis → nozzle plane", { size: 10.5 });
    const fit = (t: string, x: number, y: number, o: TextOpts) => {
      ctx.font = FONT(o.size || 11, o.weight);
      const w = ctx.measureText(t).width;
      if (x + w > W - 6) {
        x = W - 6;
        o.align = "right";
      }
      text(ctx, t, x, y, o);
    };
    fit(dense ? "camera" : `camera, ≈${f2(p.camH)} m high`, U(r.camU) + 0.05 * s, Yp(r.camY) + 14, { size: 10.5 });
    const ym = (r.camY + r.yRow) / 2, hwm = ((r.footprint / 2) * (ym - r.camY)) / (r.yRow - r.camY);
    fit(`field of view ${p.fov}°`, U(r.camU + hwm) + 6, Yp(ym), { size: 10.5, color: tok["d-fov-edge"] });
    if (!dense) fit(`${f2(r.footprint)} m along the row`, U(r.camU + hwm) + 6, Yp(ym) + 13, { size: 10.5, color: tok["d-fov-edge"] });
    text(ctx, "crop row", U(rg.uR) - 4, Yp(r.yRow) - 6, { align: "right", color: tok["d-ok"], size: 10.5 });
    if (!dense) text(ctx, `spray windows: plant + ${p.pad} mm pads`, U(r.nozU) + 8, Yp(barY - barH / 2) + 13, { size: 10.5 });
    // dims
    dimH(ctx, U(0), U(L), Yp(-hw - 0.15), f2(L) + " m", { below: true });
    dimV(ctx, U(-0.14), Yp(hw), Yp(-hw), f2(p.agvW) + " m");
    // travel arrow
    const ay = Yp(-hw * 0.35), ax1 = U(Math.max(L, r.camU) + 0.2), ax2 = U(rg.uR) - 10;
    if (ax2 - ax1 > 40) {
      line(ctx, ax1, ay, ax2 - 8, ay, tok["d-ink"], 2.5);
      ctx.beginPath();
      ctx.moveTo(ax2, ay);
      ctx.lineTo(ax2 - 11, ay - 6);
      ctx.lineTo(ax2 - 11, ay + 6);
      ctx.closePath();
      ctx.fillStyle = tok["d-ink"];
      ctx.fill();
      text(ctx, `travel ${f1(p.speed)} m/s`, (ax1 + ax2) / 2, ay - 8, { align: "center", weight: 700, size: 11 });
    }
    ctx.font = "italic 400 11px Lato, Arial, sans-serif";
    ctx.fillStyle = tok.paper;
    ctx.fillRect(8, H - 26, ctx.measureText("Plan view, to scale").width + 8, 18);
    italic(ctx, "Plan view, to scale", 12, H - 12);
  }

  /* ---------- pump curve ---------- */
  function drawPump() {
    const { ctx, W, H } = prep(pumpC), r = calc, p = P;
    const L = 48, R = 16, T = 38, B = 36, pw = W - L - R, ph = H - T - B;
    const xMax = Math.ceil(Math.max(p.pumpPmax, 6, p.relief) + 0.5);
    const yTop = Math.max(p.pumpQ0, r.nActMax * r.qN(xMax)) * 1.12;
    const step = yTop > 12 ? 4 : yTop > 6 ? 2 : yTop > 3 ? 1 : 0.5, yMax = Math.ceil(yTop / step) * step || 1;
    const PX = (v: number) => L + (v / xMax) * pw, QY = (v: number) => T + ph - (v / yMax) * ph;
    ctx.fillStyle = hexA(tok["d-fan"], 0.16);
    ctx.fillRect(PX(2), T, PX(5) - PX(2), ph);
    text(ctx, "LS 20 rated 2–5 bar", PX(3.5), T + 12, { align: "center", size: 10, color: tok["d-muted"] });
    for (let x = 0; x <= xMax; x++) {
      line(ctx, PX(x), T, PX(x), T + ph, tok["line"], 1);
      text(ctx, String(x), PX(x), T + ph + 14, { align: "center", size: 10, color: tok["d-muted"] });
    }
    for (let y = 0; y <= yMax + 1e-9; y += step) {
      line(ctx, L, QY(y), L + pw, QY(y), tok["line"], 1);
      text(ctx, String(+y.toFixed(1)), L - 6, QY(y) + 3, { align: "right", size: 10, color: tok["d-muted"] });
    }
    text(ctx, "pressure, bar", L + pw, T + ph + 28, { align: "right", size: 10, color: tok["d-muted"] });
    text(ctx, "flow, L/min", L - 30, T - 8, { size: 10, color: tok["d-muted"] });
    const curve = (fn: (x: number) => number, col: string, w: number, dash?: number[]) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = (xMax * i) / 120, y = Math.min(fn(x), yMax * 1.2);
        if (i) ctx.lineTo(PX(x), QY(y));
        else ctx.moveTo(PX(x), QY(y));
      }
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, pw, ph);
    ctx.clip();
    curve(r.qPump, tok["d-ink"], 2.2);
    curve((x) => r.nActMax * r.qN(x), tok["d-deposit"], 2);
    curve((x) => ((r.nActAvg * r.qN(x) * p.duty) / 100) * r.sprayFrac, tok["d-deposit"], 1.5, [5, 4]);
    line(ctx, PX(p.pressure), T, PX(p.pressure), T + ph, tok["d-ok"], 1.4, [4, 3]);
    line(ctx, PX(p.relief), T, PX(p.relief), T + ph, tok["bad"], 1.4, [2, 3]);
    ctx.restore();
    // labels at line ends
    const lab = (t: string, x: number, y: number, col: string, al?: CanvasTextAlign) => text(ctx, t, x, y, { size: 10.5, weight: 700, color: col, align: al || "left" });
    lab("pump P-101", PX(0) + 6, QY(p.pumpQ0) - 6, tok["d-ink"]);
    const xe = Math.min(xMax, p.pumpPmax + 0.6);
    lab(`${r.nActMax} valves open`, PX(xe) - 4, QY(Math.min(r.nActMax * r.qN(xe), yMax * 0.95)) - 6, tok["d-deposit"], "right");
    lab("average draw", PX(xMax) - 4, QY(((r.nActAvg * r.qN(xMax) * p.duty) / 100) * r.sprayFrac) - 6, tok["d-deposit"], "right");
    lab(`PCV ${f1(p.pressure)}`, PX(p.pressure) + 4, T + ph - 6, tok["d-ok"]);
    lab(`PSV ${f1(p.relief)}`, PX(p.relief) + 4, T + ph - 20, tok["bad"]);
    // operating point
    ctx.beginPath();
    ctx.arc(PX(r.Ppeak), QY(r.qPeak), 5, 0, 7);
    ctx.fillStyle = tok["d-deposit"];
    ctx.fill();
    ctx.strokeStyle = tok["paper"];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PX(r.Pset), QY(r.qPumpSet), 4, 0, 7);
    ctx.fillStyle = tok["d-ink"];
    ctx.fill();
    text(ctx, "Pump and nozzle curves", L, 14, { size: 12, weight: 900 });
  }

  /* ---------- live strips ---------- */
  function liveText() {
    const r = calc, p = P, st = rearState;
    let state: string, cls: Status;
    const modeTxt: Record<string, string> = { weak: "valve never fully opens", stream: "pulses merge into a stream", erratic: "valve cannot keep up with PWM" };
    if (st.lateNow) {
      state = "late: decision not ready";
      cls = "bad";
    } else if (st.inWin && st.actN === 0) {
      state = "no switched-on nozzle reaches this plant";
      cls = "bad";
    } else if (st.inWin && st.cur && st.cur.mode && st.cur.mode !== "ok") {
      state = "spraying · " + modeTxt[st.cur.mode];
      cls = "warn";
    } else if (st.inWin) {
      state = "spraying";
      cls = "ok";
    } else {
      state = "waiting for plant";
      cls = "info";
    }
    ref("liveRear").innerHTML = `<span>Plant <b>${st.cur ? f2(st.cur.h) : "—"} m</b></span><span>Valves open <b>${st.actN} / ${p.n}</b></span><span>PWM <b>${p.duty >= 100 ? "off" : f0(r.f) + " Hz · " + p.duty + " %"}</b></span><span class="${c("tag " + cls)}">${state}</span>`;
    const noz = X + r.nozU;
    let ok = 0, iss = 0, miss = 0;
    for (const pl of plants) {
      if (!pl.det || pl.we >= noz) continue;
      const o = outcome(pl);
      if (o.k === "ok") ok++;
      else if (o.k === "issue") iss++;
      else miss++;
    }
    ref("livePlan").innerHTML = `<span>Lead needed <b>${f2(r.leadReq)} m</b> of <b>${f2(p.camLead)} m</b></span><span>Frames per plant <b>${f1(r.frames)}</b></span><span>Passed plants: <b>${ok}</b> sprayed · <b>${iss}</b> with issues · <b>${miss}</b> not or late sprayed</span>`;
    ref("livePump").innerHTML = `<span>Pump at PCV <b>${f2(r.qPumpSet)} L/min</b></span><span>All needed valves open <b>${f2(r.qPeak)} L/min at ${f1(r.Ppeak)} bar</b></span><span>Bypass to tank <b>${f2(r.bypass)} L/min</b></span><span>Hydraulic power <b>${f0(r.Phyd)} W</b></span>`;
  }
  function X_world() {
    return X;
  }

  /* ---------- nozzle selection on the rear view ---------- */
  let hover = -1, sel = new Set<number>();
  let drag: { x0: number; y0: number; x1: number; y1: number; moved: boolean; id: number; type: string } | null = null;
  function ptr(e: PointerEvent) {
    const b = rearC.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }
  function hitNozzle(x: number, y: number) {
    const st = rearState;
    if (!st.hits) return -1;
    let best = -1, bd = 1e9;
    for (const h of st.hits) {
      const d = Math.abs(y - h.y);
      if (x >= h.x0 && x <= h.sqx1 && d <= h.half) {
        // on the valve
        if (d < bd) {
          bd = d;
          best = h.i;
        }
        continue;
      }
      if (x > st.tipSX! && x <= h.x1) {
        // inside its fan
        const t = (x - st.tipSX!) / (h.x1 - st.tipSX!), hh = Math.max(4, t * st.fanHalf!);
        if (d <= hh && d < bd) {
          bd = d;
          best = h.i;
        }
      }
    }
    return best;
  }
  function inBox(x0: number, y0: number, x1: number, y1: number) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1), out = new Set<number>();
    for (const h of rearState.hits || []) {
      if (h.y >= ya && h.y <= yb && xb >= h.x0 && xa <= h.x1) out.add(h.i);
    }
    return out;
  }
  function setNozzles(idx: Iterable<number>, turnOn: boolean) {
    for (const i of idx) {
      if (turnOn) disabled.delete(i);
      else disabled.add(i);
    }
    nozzlesChanged();
  }
  function nozzlesChanged() {
    for (const i of [...disabled]) if (i >= P.n) disabled.delete(i);
    compute();
    renderResults();
    drawPump();
    liveText();
    updateOffList();
    drawAll();
  }
  const offList = ref("offList"), allOn = ref<HTMLButtonElement>("allOn"), chips = ref("nozChips");
  function updateOffList() {
    const off = [...disabled].sort((a, b) => a - b);
    offList.textContent = off.length ? "Off: " + off.map((i) => "N" + (i + 1)).join(", ") : "";
    allOn.disabled = !off.length;
    const active = document.activeElement as HTMLElement | null;
    const had = active && chips.contains(active) ? active.dataset.noz : null;
    chips.innerHTML = Array.from({ length: P.n }, (_, i) => `<button type="button" data-noz="${i}" aria-pressed="${!disabled.has(i)}" title="${disabled.has(i) ? "Switch on" : "Switch off"} N${i + 1}">N${i + 1}</button>`).join("");
    if (had != null) {
      const b = chips.querySelector<HTMLElement>(`[data-noz="${had}"]`);
      if (b) b.focus();
    }
  }
  on(chips, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-noz]");
    if (!b) return;
    const i = +b.dataset.noz!;
    setNozzles([i], disabled.has(i));
  });
  on(rearC, "pointerdown", (e) => {
    if (e.button !== 0) return;
    const p = ptr(e);
    drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false, id: e.pointerId, type: e.pointerType };
    if (e.pointerType !== "touch") {
      rearC.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  on(rearC, "pointermove", (e) => {
    const p = ptr(e);
    if (drag && drag.id === e.pointerId) {
      drag.x1 = p.x;
      drag.y1 = p.y;
      if (!drag.moved && drag.type !== "touch" && Math.hypot(p.x - drag.x0, p.y - drag.y0) > 5) drag.moved = true;
      if (drag.moved) {
        sel = inBox(drag.x0, drag.y0, drag.x1, drag.y1);
        hover = -1;
      }
    } else hover = hitNozzle(p.x, p.y);
    rearC.style.cursor = drag && drag.moved ? "crosshair" : hover >= 0 ? "pointer" : "crosshair";
    if (!playing) drawRear();
  });
  on(rearC, "pointerup", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = ptr(e);
    if (drag.moved) {
      const box = inBox(drag.x0, drag.y0, p.x, p.y);
      // all boxed nozzles already off -> switch them on; otherwise switch them off
      if (box.size) setNozzles(box, [...box].every((i) => disabled.has(i)));
    } else {
      const i = hitNozzle(p.x, p.y);
      if (i >= 0) setNozzles([i], disabled.has(i));
    }
    drag = null;
    sel = new Set();
    hover = e.pointerType === "touch" ? -1 : hitNozzle(p.x, p.y);
    if (!playing) drawRear();
  });
  on(rearC, "pointercancel", () => {
    drag = null;
    sel = new Set();
    if (!playing) drawRear();
  });
  on(rearC, "pointerleave", () => {
    if (!drag) {
      hover = -1;
      if (!playing) drawRear();
    }
  });
  on(allOn, "click", () => {
    disabled.clear();
    nozzlesChanged();
  });

  /* ---------- wiring ---------- */
  buildControls();
  compute();
  syncControls();
  readTokens();
  resetSim();
  renderResults();
  layoutCanvases();
  function onChange(k: Key) {
    applyConstraints(k);
    if (k === "n") {
      for (const i of [...disabled]) if (i >= P.n) disabled.delete(i);
      updateOffList();
    }
    compute();
    syncControls();
    renderResults();
    layoutCanvases();
    if (CROP_KEYS.has(k)) cropChanged(k);
    drawPump();
    liveText();
    if (!playing) drawAll();
  }
  on(ctl, "input", (e) => {
    const k = (e.target as HTMLElement).dataset?.k as NumKey | undefined;
    if (!k) return;
    P[k] = parseFloat((e.target as HTMLInputElement).value);
    onChange(k);
  });
  on(ctl, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-seg]");
    if (!b) return;
    (P as Record<Key, unknown>)[b.dataset.seg as Key] = b.dataset.v;
    onChange(b.dataset.seg as Key);
  });
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches, timeScale = 0.25;
  const playBtn = ref<HTMLButtonElement>("play");
  playBtn.textContent = playing ? "Pause" : "Play";
  on(playBtn, "click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    last = performance.now();
  });
  on(ref("timeScale"), "input", (e) => {
    timeScale = parseFloat((e.target as HTMLInputElement).value);
    ref("timeScaleOut").textContent = timeScale.toFixed(2) + "×";
  });
  on(ref("reset"), "click", () => {
    P = Object.assign({}, DEF);
    disabled.clear();
    updateOffList();
    compute();
    syncControls();
    renderResults();
    layoutCanvases();
    resetSim();
    drawAll();
  });
  const ro = new ResizeObserver(() => {
    layoutCanvases();
    drawAll();
  });
  ro.observe(ref("views"));
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const retheme = () => {
    readTokens();
    drawAll();
  };
  mq.addEventListener("change", retheme);
  const mo = new MutationObserver(retheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  // canvas text does not make the browser fetch a web font, so ask for the faces the drawings use
  if (document.fonts) {
    Promise.all(["400 11px Lato", "700 11px Lato", "900 12px Lato", "italic 400 11px Lato"].map((f) => document.fonts.load(f)))
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(() => {
        if (!disposed) drawAll();
      });
  }

  function drawAll() {
    drawRear();
    drawPlan();
    drawPump();
    liveText();
  }
  let last = performance.now(), liveTick = 0;
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) {
      const sdt = dt * timeScale, n = Math.max(1, Math.ceil(sdt / 0.004));
      for (let i = 0; i < n; i++) step(sdt / n);
    }
    drawRear();
    drawPlan();
    if (++liveTick % 6 === 0 || !playing) liveText();
    if (running()) raf = requestAnimationFrame(frame);
  }
  drawPump();
  liveText();
  updateOffList();

  // only animate while the simulator is on screen and the tab is visible
  let raf = 0, inView = false;
  const running = () => inView && !document.hidden && !disposed;
  const kick = () => {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    kick();
  });
  io.observe(root);
  const onVisibility = () => kick();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    ro.disconnect();
    mo.disconnect();
    mq.removeEventListener("change", retheme);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const off of cleanups) off();
  };
}
