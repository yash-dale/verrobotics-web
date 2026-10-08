/**
 * Geometry for the "spray wash" section transition.
 *
 * A vertical boom of spray nozzles sweeps left → right as the progress `p` goes 0 → 1.
 * The water front in front of it is a smooth, living curve: every jet pushes the front
 * forward a little further than the gaps between jets, and the whole thing ripples.
 * The same function drives the clip-path that reveals the new section and the canvas
 * that draws the water, so the two always agree.
 */

/** The wash starts when the section's track is this far (in viewport heights) below the top of the screen … */
export const WASH_TOP = 0.25;
/** … and takes this many viewport heights of scrolling to finish */
export const WASH_SPAN = 0.8;

/** How far the boom starts off-screen to the left (fraction of the screen width) */
const START = 0.18;

/** How far in front of the boom the water front sits between jets */
const LEAD = 0.065;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const hash = (n: number) => {
  const s = Math.sin(n * 91.7 + 17.3) * 12345.678;
  return s - Math.floor(s);
};

/** Deterministic jet reach per nozzle row: 0.07 – 0.16 of screen width */
export function reach(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return 0.07 + (s - Math.floor(s)) * 0.09;
}

/** Boom position for progress p (starts off-screen left, ends off-screen right) */
export function boomX(p: number): number {
  return -START + p * (1 + START + 0.04);
}

/** Row height in px for a given viewport height */
export function rowPx(vh: number): number {
  return clamp(vh / 12, 56, 84);
}

/** Progress of the wash for a section track whose top edge is `trackTop` px from the top of the viewport */
export function washProgress(trackTop: number, vh: number): number {
  return clamp((vh * WASH_TOP - trackTop) / (vh * WASH_SPAN), 0, 1);
}

/** Scroll range (absolute page y) over which a track's wash plays */
export function washZone(trackTopAbs: number, vh: number): [number, number] {
  const a = trackTopAbs - vh * WASH_TOP;
  return [a, a + vh * WASH_SPAN];
}

/**
 * x position (px) of the water front at height y.
 * `rowH` is the nozzle spacing, `W` the screen width, `t` time in seconds (for the ripple).
 */
export function edgeX(y: number, p: number, W: number, rowH: number, t: number): number {
  const bx = boomX(p);
  const row = Math.floor(y / rowH);
  let push = 0;
  // each nearby jet adds a smooth, slightly different bump, so the front fingers forward where a jet hits
  for (let i = Math.max(0, row - 1); i <= row + 1; i++) {
    const cy = (i + 0.5 + (hash(i + 5) - 0.5) * 0.36) * rowH;
    const sig = rowH * (0.24 + 0.14 * hash(i + 11));
    const d = (y - cy) / sig;
    const flutter = 0.8 + 0.2 * Math.sin(t * 5.3 + i * 1.7);
    push += (reach(i) - 0.07) * 1.35 * flutter * Math.exp(-d * d);
  }
  // slow swell across the whole front + fine ripple on top
  const swell = 0.026 * Math.sin(y * 0.0042 + t * 0.9 + p * 3.1) + 0.012 * Math.sin(y * 0.0113 - t * 1.3 + 2.0);
  const ripple = 0.004 * Math.sin(y * 0.037 - t * 3.1) + 0.0025 * Math.sin(y * 0.09 + t * 4.7);
  return (bx + LEAD + push + swell + ripple) * W;
}

/** clip-path polygon (px) that reveals everything behind the water front */
export function washPolygon(p: number, W: number, H: number, rowH: number, t: number): string {
  const step = 8;
  const pts: string[] = ["0px 0px"];
  for (let y = 0; y < H; y += step) {
    pts.push(`${Math.max(0, edgeX(y, p, W, rowH, t)).toFixed(1)}px ${y}px`);
  }
  pts.push(`${Math.max(0, edgeX(H, p, W, rowH, t)).toFixed(1)}px ${H}px`);
  pts.push(`0px ${H}px`);
  return `polygon(${pts.join(",")})`;
}
