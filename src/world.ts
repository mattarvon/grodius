// @ts-nocheck
import { $ } from './state';
import { H, PH, TS, W, hash, lerp, sstep, vnoise } from './core';
import { BANDS, layout } from './layout';
import { laneLoss, laneWeave } from './sigs';

// ---------------- world state ----------------
$.state = 'title';
$.T = 0;
$.G = null;
$.P = null;
$.menuSel = 0;
$.menuBoxes = [];
export const shots = [],
  eshots = [],
  enemies = [],
  drops = [],
  gibs = [],
  mists = [],
  sparks = [],
  flashes = [],
  decals = [],
  geysers = [],
  splats = [],
  caps = [],
  orbs = [],
  texts = [];
export const arcs = [];
export const ALL = [shots, eshots, enemies, drops, gibs, mists, sparks, flashes, decals, geysers, splats, caps, orbs, texts, arcs];
export let LIGHTS = [];
export let CEIL = new Float32Array(10).fill(-99),
  FLOOR = new Float32Array(10).fill(H + 99);
export const floorAt = wx => {
  const f = wx / TS,
    i = Math.floor(f);
  if (i < 0) return FLOOR[0];
  if (i >= FLOOR.length - 1) return FLOOR[FLOOR.length - 1];
  return lerp(FLOOR[i], FLOOR[i + 1], f - i);
};
export const ceilAt = wx => {
  const f = wx / TS,
    i = Math.floor(f);
  if (i < 0) return CEIL[0];
  if (i >= CEIL.length - 1) return CEIL[CEIL.length - 1];
  return lerp(CEIL[i], CEIL[i + 1], f - i);
};
/** world bands by scroll x (hull plating, the MERIDIAN corridor, the drive core, open space): the layout's (src/layout.ts) */
export const AMT = BANDS;
export const grav = () => {
  if (!$.G) return .08;
  const s = $.G.scroll;
  return lerp(lerp(.035, .12, AMT.corr(s)), .075, AMT.core(s));
};
/** a 4-number layout band's weight at x: sstep up over [b0, b1], times 1 - sstep down over [b2, b3] (layout.ts bandAt) */
const band = (b, x) => sstep(b[0], b[1], x) * (1 - sstep(b[2], b[3], x));
export function buildTerrain(L) {
  const LY = layout(), T = LY.terrain, n = Math.ceil((LY.level + W * 2) / TS) + 2;
  CEIL = new Float32Array(n);
  FLOOR = new Float32Array(n);
  const o = L * 91.7;
  // the squeeze depths: short's 24 / 28; long4's deepened Drive corridor (layout kD, LVL §6.1)
  const kF = T.kD ? T.kD[0] : 24, kC = T.kD ? T.kD[1] : 28;
  for (let i = 0; i < n; i++) {
    const x = i * TS;
    // floor and ceiling close in over the hull, the corridor squeezes, the chamber opens (bands: layout().terrain)
    const fT = sstep(T.fT[0], T.fT[1], x) * (1 - sstep(T.fT[2], T.fT[3], x)),
      cT = sstep(T.cT[0], T.cT[1], x) * (1 - sstep(T.cT[2], T.cT[3], x));
    const kT = sstep(T.kT[0], T.kT[1], x) * (1 - sstep(T.kT[2], T.kT[3], x)),
      zT = sstep(T.zT[0], T.zT[1], x);
    // long4 nShift (W6): the Drive approach reads its wall noise where it read it before the Orbit stretch moved it (see layout)
    const nx = T.nShift && x >= T.nShift.x ? x - T.nShift.d : x;
    const a = vnoise(nx / 210 + o) * 2 - 1,
      b = vnoise(nx / 61 + o + 5) * 2 - 1,
      c = vnoise(nx / 19 + o + 9) * 2 - 1;
    const a2 = vnoise(nx / 190 + o + 40) * 2 - 1,
      b2 = vnoise(nx / 57 + o + 45) * 2 - 1,
      c2 = vnoise(nx / 23 + o + 49) * 2 - 1;
    let fl = PH - 30 - a * 24 - b * 8 - c * 2 - kT * (kF + a * 12);
    let ce = 24 + a2 * 20 + b2 * 8 + c2 * 2 + kT * (kC + a2 * 10);
    // long4's Orbit hull and breach (layout hT / oT, LVL §3.1). Absent on short, whose arithmetic stays as it was
    let oT = 0;
    if (T.hT) {
      const hT = band(T.hT, x);
      oT = band(T.oT, x);
      fl -= Math.max(hT, oT) * T.lift; // the hull plating lifts the floor; the breach keeps it lifted
      ce += oT * (T.flap + a2 * 10); // the flap hangs below the base ceiling, ragged with it
    }
    const blk = Math.floor(x / 360),
      bx = x % 360;
    // no hull block under the breach flap (oT > 0): a block step (34 px, or hRun's 48) on the flap's squeeze would cut the swept fit
    // gap under S1's 100 (short has no oT: unchanged)
    const hr = T.hRun && x > T.hRun.x0 && x < T.hRun.x1 && oT < .01 && fT > .99; // long4's dense hull run (layout hRun)
    if (hr && x % (T.hRun.every || 360) < 44) fl -= T.hRun.h; // every: the run's cell (360 when absent)
    else if (blk % 2 === 1 && bx < 44 && x > T.blocks[0] && x < T.blocks[1] && oT < .01) {
      // long4's Orbit hull run has no ceiling (cT = oT = 0), where a ceiling block would vanish under the -70 lerp: every
      // block there sits on the floor, so the run keeps its blocks (hRun's dense cells come first, above). short: unchanged
      if (hash(blk + L) < .5 || (T.hT && Math.max(cT, oT) < .01)) fl -= 34;else ce += 34;
    }
    fl = lerp(PH + 70, fl, fT);
    ce = lerp(-70, ce, T.hT ? Math.max(cT, oT) : cT); // the breach flap is the Orbit's only ceiling
    fl = lerp(fl, PH - 12, zT);
    ce = lerp(ce, 12, zT);
    const gap = oT > 0 ? T.oClamp : 104; // the breach's columns keep >= 108 (LVL §3.1), every other column >= 104
    if (fl - ce < gap) {
      const m = (fl + ce) / 2;
      fl = m + gap / 2;
      ce = m - gap / 2;
    }
    FLOOR[i] = fl;
    CEIL[i] = ce;
  }
  // long4 only (short has neither field: its arrays are the arithmetic above, T1)
  if (T.weave) for (const V of T.weave) weaveBands(V, o);
  if (T.pylons) for (const px of T.pylons.x) pylon(px, T.pylons);
}
/** the swept fit at column i (sigs.ts S1's 21 px footprint: a column and 3 either side), floor clamped to the screen */
const fitCol = (i) => {
  let c = -1e9, f = 1e9;
  for (let q = Math.max(0, i - 3); q <= Math.min(FLOOR.length - 1, i + 3); q++) { c = Math.max(c, CEIL[q]); f = Math.min(f, FLOOR[q], PH); }
  return f - Math.max(c, 0);
};
/** long4's lane weave over world bands (layout terrain.weave, sigs.ts laneWeave; W6 tune, L3): both walls shift together
 *  (the gap is kept), scaled to 0 where the swept fit has no room for the sweep loss (S1 >= 100), that scale eased at
 *  `ease` a px so a fade adds no cliff. Phase from the terrain offset (no RNG) */
function weaveBands(V, o) {
  const n = FLOOR.length, m = new Float32Array(n), loss = laneLoss(V), R = 6, fit = new Float32Array(n);
  for (let i = 0; i < n; i++) fit[i] = fitCol(i);
  for (let i = 0; i < n; i++) {
    const x = i * TS;
    let k = 0; for (const b of V.bands) k = Math.max(k, band(b, x));
    if (k <= 0) continue;
    let f = 1e9; for (let q = Math.max(0, i - R); q <= Math.min(n - 1, i + R); q++) f = Math.min(f, fit[q]);
    m[i] = k * Math.max(0, Math.min(1, (f - V.keep) / loss));
  }
  const e = V.ease * TS;
  for (let i = 1; i < n; i++) m[i] = Math.min(m[i], m[i - 1] + e);
  for (let i = n - 2; i >= 0; i--) m[i] = Math.min(m[i], m[i + 1] + e);
  const ph = hash(o * .37 + 3);
  for (let i = 0; i < n; i++) if (m[i] > 0) { const d = m[i] * laneWeave(i * TS, ph, V); FLOOR[i] += d; CEIL[i] += d; }
}
/** a hull girder hanging from above (layout terrain.pylons; W6 tune, L3): the Orbit hull run's only ceiling element, so a
 *  ship riding high has to come down as one passes. Its tip stops `gap` px above the lowest floor within `reach` px
 *  (floor clamped to the screen, so S1's swept fit keeps >= gap); the tip is cut `taper` px higher at its two edges */
function pylon(px, Y) {
  const i0 = Math.floor(px / TS), i1 = Math.ceil((px + Y.w) / TS), r = Math.ceil(Y.reach / TS);
  let f = 1e9; for (let q = Math.max(0, i0 - r); q <= Math.min(FLOOR.length - 1, i1 + r); q++) f = Math.min(f, FLOOR[q], PH);
  const tip = f - Y.gap;
  for (let i = i0; i <= i1 && i < CEIL.length; i++) { const u = (i - i0) / Math.max(1, i1 - i0); CEIL[i] = Math.max(CEIL[i], tip - Y.taper * Math.abs(2 * u - 1)); }
}

// ---------------- textures ----------------
