// @ts-nocheck
// =====================================================================
//  BAKED GIB SHAPES (S2-K1 fix 1, D30). The solid gib kinds used to cost a save, a rotate, a polygon and up to six
//  rects and arcs each, per gib, per frame, and a big kill leaves hundreds on screen. Here each shape is painted once
//  into one atlas; a gib then costs one drawImage. Render-only: the paint is seeded locally and the variant comes from
//  a hash of the gib's own spawn fields, so neither RNG stream moves. Ropes, eye tails and split halves change shape
//  every frame and stay vector (render/gore.ts).
//  Palettes: only C.blood and C.bloodD vary per palette (applyPalette in biomes.ts); they get a cell set each, matched by
//  blood[0]. Any other gib colour a biome recolours (bone, flesh, fat) needs its own palette axis here, or it won't show.
// =====================================================================
import { C, TAU } from '../core';
import { drawSkull, poly } from './util';
import { BIOMES, C0 } from '../biomes';
import { GIB_FLESH, GIB_METAL } from '../fx/gibcols';

/** atlas pixels per game pixel. Drawn with smoothing at 1/SS or less, which stands in for the vector path's edge AA */
const SS = 2;
/** chunk, skin and metal size buckets, about 1.3x apart: a gib draws from the smallest that holds it, scaled down at
 *  most that step, so an edge never softens by more than the bucket gap. Largest chunk measured from the call sites:
 *  3.4 + 0.5 x gore size 5 = 5.9 (metal 5.5); 7.4 is headroom, and anything past it is drawn upscaled (softer) */
const BUCKETS = [2, 2.6, 3.4, 4.4, 5.7, 7.4];
/** polygon shapes per colour, flags and size. gib() rolls a fresh polygon each time; four keep a burst from reading as stamps */
const VARIANTS = 4;
/** skulls roll 3 to 4.2 (gore()): two bakes keep a spinning skull's 0.6 px teeth above half-scale sampling */
const SKULLS = [3.4, 4.2];
const ATLAS_W = 1024;

const FLESH = GIB_FLESH; // gib() in fx/spawn.ts rolls these plus C.blood, which is per palette
const METAL = GIB_METAL;
const SKIN = '#d29d8f';

const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** a gib() polygon at size s: same vertex count and jitter ranges, drawn from a hash instead of a stream */
function shape(s, seed) {
  const n = 5 + Math.floor(hash(seed) * 3), pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + (hash(seed + i * 2.3 + 1) * .6 - .3), r = s * (.6 + hash(seed + i * 3.7 + 2) * .55);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}
function paintFlesh(x, s, seed, col, fat, bn) {
  x.fillStyle = col;
  poly(x, shape(s, seed));
  x.fillStyle = 'rgba(30,0,0,.35)';
  x.fillRect(-s * .5, s * .1, s, s * .4);
  x.fillStyle = 'rgba(255,180,160,.35)';
  x.fillRect(-s * .4, -s * .5, s * .4, 1);
  if (fat) { x.fillStyle = C.fat; x.beginPath(); x.arc(s * .4, -s * .2, s * .35, 0, TAU); x.fill(); }
  if (bn) { x.fillStyle = C.bone; x.fillRect(-s * .2, -.6, s * 1.3, 1.2); }
}
function paintMetal(x, s, seed, col) {
  x.fillStyle = col;
  poly(x, shape(s, seed));
  x.fillStyle = '#9aa8b6';
  x.fillRect(-s * .5, -s * .4, s * .7, .8);
}
function paintSkull(x, s, B) {
  drawSkull(x, 0, 0, s, 0);
  x.fillStyle = B[0];
  x.fillRect(-s * .3, -s * 1.1, s * .5, s * .7);
  x.fillRect(s * .2, s * .3, .8, s * .8);
}
function paintLimb(x, s, arm, boot, B) {
  const L = s * 2.4;
  x.fillStyle = arm ? C.suit : '#2c3743';
  x.fillRect(-L / 2, -1.3, L, 2.6);
  x.fillStyle = '#55657a';
  x.fillRect(-L / 2, -1.3, L, .6);
  x.fillStyle = B[1];
  x.fillRect(-L / 2 - 1.4, -1.6, 1.8, 3.2);
  x.fillStyle = B[0];
  x.fillRect(-L / 2 - 1.1, -1.2, 1.2, 2.4);
  x.fillStyle = C.bone;
  x.fillRect(-L / 2 - 3.2, -.45, 2.4, .9);
  x.beginPath();
  x.arc(-L / 2 - 3.2, 0, .8, 0, TAU);
  x.fill();
  if (arm) {
    x.fillStyle = C.skin;
    x.fillRect(L / 2, -1.4, 2, 2.8);
    for (let k = 0; k < 3; k++) x.fillRect(L / 2 + 2, -1.3 + k * 1, 1.4, .7);
    x.fillRect(L / 2 + .4, -2.2, 1.2, .9);
  } else {
    x.fillStyle = boot ? '#14181d' : C.skin;
    x.fillRect(L / 2 - 1, -1.4, 2.4, 2.8);
    x.fillRect(L / 2 + .6, -1.4, 1.2, 4.4);
  }
}
function paintBone(x, s, B) {
  x.fillStyle = C.bone;
  x.fillRect(-s, -.7, s * 2, 1.4);
  x.beginPath();
  x.arc(-s, -.6, 1, 0, TAU);
  x.arc(-s, .6, 1, 0, TAU);
  x.arc(s, 0, 1.1, 0, TAU);
  x.fill();
  x.fillStyle = B[0];
  x.fillRect(s - 1.5, -.7, 1.5, 1.4);
}
function paintTooth(x, B) {
  x.fillStyle = C.bone;
  poly(x, [[-1, -1.4], [1, -1.4], [.4, 1.6], [-.4, 1.6]]);
  x.fillStyle = B[0];
  x.fillRect(-1, -1.6, 2, .6);
}

// every cell, by key. A cell: { x, y, h: half size in atlas px, r: the size it was painted at (0: drawn 1:1), paint }
const CELLS = new Map();
const add = (key, ext, r, paint) => CELLS.set(key, { x: 0, y: 0, h: Math.ceil(ext * SS) + 1, r, paint });
const half = (s) => Math.round(s * 2) / 2; // bone and limb details are fixed-size, so those bake per half pixel of length
// the gore palettes: biomes rewrite C.blood and C.bloodD (applyBiomeGore). Chunks take C.blood at spawn, and the old draw
// read it live for bone, skull, limb and tooth details, so a stuck gib recolours as the biome fades. Both are kept
let PALS = [];
/** the palette in force now: an index into PALS */
export function gibPal() { for (let i = 1; i < PALS.length; i++) if (PALS[i][0] === C.blood) return i; return 0; }
function tables() {
  PALS = [[C0.blood, C0.bloodD], ...Object.values(BIOMES).map((b) => b.blood)];
  const flesh = [...FLESH, ...PALS.map((B) => B[0])];
  for (const R of BUCKETS) for (let v = 0; v < VARIANTS; v++) {
    const seed = R * 13.7 + v * 5.1, ext = R * 1.3 + 2;
    flesh.forEach((col, ci) => { for (let f = 0; f < 4; f++) add(`c${col}.${f}.${R}.${v}`, ext, R, (x) => paintFlesh(x, R, seed + ci, col, f & 1, f & 2)); });
    METAL.forEach((col, ci) => add(`m${col}.${R}.${v}`, ext, R, (x) => paintMetal(x, R, seed + ci, col)));
    add(`s.${R}.${v}`, ext, R, (x) => paintFlesh(x, R, seed, SKIN, 0, 0));
  }
  PALS.forEach((B, p) => {
    for (const [i, s] of SKULLS.entries()) add(`k${p}.${i}`, s * 1.5 + 1, s, (x) => paintSkull(x, s, B));
    add(`t${p}`, 3, 0, (x) => paintTooth(x, B));
    for (let s = 1.5; s <= 5.5; s += .5) add(`b${p}.${s}`, s + 2.2, 0, (x) => paintBone(x, s, B));
    for (let s = 3; s <= 5; s += .5) for (const [t, arm, boot] of [['a', 1, 0], ['l', 0, 0], ['o', 0, 1]]) add(`${t}${p}.${s}`, s * 1.2 + 5.5, 0, (x) => paintLimb(x, s, arm, boot, B));
  });
}

let ATLAS = null;
/** paint the atlas (once, on an idle slot from startWarm; a gib that beats it there builds it on first draw) */
export function gibAtlas() {
  if (ATLAS) return ATLAS;
  tables(); // here, not at import: BIOMES sits in the boot module cycle
  const cells = [...CELLS.values()].sort((a, b) => b.h - a.h);
  let cx = 0, cy = 0, row = 0;
  for (const c of cells) { // shelf packing, tallest first
    const d = c.h * 2 + 2;
    if (cx + d > ATLAS_W) { cx = 0; cy += row; row = 0; }
    c.x = cx + 1; c.y = cy + 1; cx += d; row = Math.max(row, d);
  }
  const cv = document.createElement('canvas');
  cv.width = ATLAS_W; cv.height = cy + row;
  const x = cv.getContext('2d');
  for (const c of cells) {
    x.setTransform(SS, 0, 0, SS, c.x + c.h, c.y + c.h);
    c.paint(x);
  }
  return (ATLAS = cv);
}

const bucket = (s) => { for (const R of BUCKETS) if (s <= R) return R; return BUCKETS[BUCKETS.length - 1]; };
const clampHalf = (s, a, b) => Math.min(b, Math.max(a, half(s)));
/** the atlas cell for a solid gib under palette p (gibPal). Reads spawn fields only: gore.ts caches it per palette */
export function gibCell(q, p) {
  switch (q.k) {
    case 'skull': return CELLS.get(`k${p}.${q.s > 3.6 ? 1 : 0}`);
    case 'tooth': return CELLS.get(`t${p}`);
    case 'bone': return CELLS.get(`b${p}.${clampHalf(q.s, 1.5, 5.5)}`);
    case 'limb': return CELLS.get(`${q.arm ? 'a' : q.boot ? 'o' : 'l'}${p}.${clampHalf(q.s, 3, 5)}`);
  }
  const R = bucket(q.s), v = Math.floor(hash(q.pts[0][0] * 7.3 + q.pts[1][1] * 3.1) * VARIANTS);
  if (q.k === 'skin') return CELLS.get(`s.${R}.${v}`);
  if (q.k === 'metal') return CELLS.get(`m${q.col}.${R}.${v}`) || CELLS.get(`m${METAL[0]}.${R}.${v}`);
  const f = (q.fat ? 1 : 0) + (q.bn ? 2 : 0);
  return CELLS.get(`c${q.col}.${f}.${R}.${v}`) || CELLS.get(`c${FLESH[0]}.${f}.${R}.${v}`); // a colour nobody baked draws as flesh, not a crash
}
export const GIB_SS = SS;
/** every baked cell (tests: the packing must not overlap) */
export const gibCells = () => [...CELLS.values()];
