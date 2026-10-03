// @ts-nocheck
import { $ } from './state';
import { H, LEVEL, PH, TS, W, hash, lerp, sstep, vnoise } from './core';

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
export const AMT = {
  hull: s => sstep(2200, 2700, s),
  corr: s => sstep(5000, 5500, s) * (1 - sstep(8300, 8700, s)),
  core: s => sstep(8300, 8750, s),
  space: s => 1 - sstep(4800, 5400, s)
};
export const grav = () => {
  if (!$.G) return .08;
  const s = $.G.scroll;
  return lerp(lerp(.035, .12, AMT.corr(s)), .075, AMT.core(s));
};
export function buildTerrain(L) {
  const n = Math.ceil((LEVEL + W * 2) / TS) + 2;
  CEIL = new Float32Array(n);
  FLOOR = new Float32Array(n);
  const o = L * 91.7;
  for (let i = 0; i < n; i++) {
    const x = i * TS;
    const fT = sstep(2250, 2700, x) * (1 - sstep(8250, 8600, x)),
      cT = sstep(3500, 3950, x) * (1 - sstep(8250, 8600, x));
    const kT = sstep(5050, 5500, x) * (1 - sstep(8150, 8500, x)),
      zT = sstep(8300, 8700, x);
    const a = vnoise(x / 210 + o) * 2 - 1,
      b = vnoise(x / 61 + o + 5) * 2 - 1,
      c = vnoise(x / 19 + o + 9) * 2 - 1;
    const a2 = vnoise(x / 190 + o + 40) * 2 - 1,
      b2 = vnoise(x / 57 + o + 45) * 2 - 1,
      c2 = vnoise(x / 23 + o + 49) * 2 - 1;
    let fl = PH - 30 - a * 24 - b * 8 - c * 2 - kT * (24 + a * 12);
    let ce = 24 + a2 * 20 + b2 * 8 + c2 * 2 + kT * (28 + a2 * 10);
    const blk = Math.floor(x / 360),
      bx = x % 360;
    if (blk % 2 === 1 && bx < 44 && x > 2800 && x < 5000) {
      if (hash(blk + L) < .5) fl -= 34;else ce += 34;
    }
    fl = lerp(PH + 70, fl, fT);
    ce = lerp(-70, ce, cT);
    fl = lerp(fl, PH - 12, zT);
    ce = lerp(ce, 12, zT);
    if (fl - ce < 104) {
      const m = (fl + ce) / 2;
      fl = m + 52;
      ce = m - 52;
    }
    FLOOR[i] = fl;
    CEIL[i] = ce;
  }
}

// ---------------- textures ----------------
