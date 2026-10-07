// @ts-nocheck
// Ship form: a flat "form descriptor" (part key -> level) built from pods, grafts, perks and contraptions.
// drawShip diffs it frame to frame: a key that went up SPROUTS (scale-from-zero with overshoot + gore/sparks/shake),
// a key that went down WITHERS (falls off as gibs). No hooks into the upgrade code needed.
import { $ } from './state';
import { TAU, pick, rr } from './core';
import { drop, flash, gib, pop, spark } from './fx/spawn';

/** local (ship-space) anchor of each part, for sprout / wither fx */
export const ANCH = {
  thr: [-16, 0], mis: [-5, 8], dbl: [7, -8], las: [20, 0], pyre: [-9, 0], opt: [-13, 0], ward: [3, -6], tier: [0, 0],
  'g:rapid': [-5, -9], 'g:pierce': [6, 0], 'g:seek': [-1, -13], 'g:tail': [-18, 0], 'g:ripple': [-4, -13], 'g:chain': [1, 11],
  'g:serr': [0, -7], 'g:over': [8, 5], 'g:cal': [16, 0], 'g:regrow': [-6, 5], 'g:spore': [-9, -6],
  'r:saw': [14, 0], 'r:gut': [6, 7], 'r:leech': [-2, -8], 'r:spine': [-6, -7], 'r:hook': [2, 8], 'r:furnace': [-14, 0], 'r:choir': [0, -12],
};
const TIER_N = ['', 'ARMORED', 'BLOATED', 'ABOMINATION'];

const prev = {};
const sp = {};
let based = false, lastP = null, lastT = -99, lx = 0, ly = 0;

/** scale multiplier for a part (1 when settled; 0 -> overshoot -> 1 while sprouting) */
export function growK(key) {
  const t0 = sp[key];
  if (t0 == null) return 1;
  const t = ($.T - t0) / 24;
  if (t >= 1 || t < 0) {
    delete sp[key];
    return 1;
  }
  const u = t - 1;
  return 1 + 2.9 * u * u * u + 1.9 * u * u;
}
/** 0..1 white-hot flash while a part is sprouting */
export function growF(key) {
  const t0 = sp[key];
  if (t0 == null) return 0;
  const t = ($.T - t0) / 24;
  return t < 0 || t > 1 ? 0 : 1 - t;
}

function wpos(key, s) {
  const a = ANCH[key] || [0, 0];
  return [lx + a[0] * s, ly + a[1] * s];
}
function sproutFX(key, s, big) {
  const [x, y] = wpos(key, s), n = big ? 22 : 12;
  flash(x, y, big ? 16 : 10, big ? 9 : 6, '255,110,70');
  for (let k = 0; k < n; k++) {
    const a = rr(0, TAU), v = rr(1, big ? 4 : 3);
    spark(x, y, Math.cos(a) * v, Math.sin(a) * v, rr(10, 24) | 0, pick(['#ffe2b0', '#ff7a3a', '#d8c8a4', '#ff3020']));
  }
  for (let k = 0; k < n; k++) {
    const a = rr(0, TAU), v = rr(.6, 2.6);
    drop(x, y, Math.cos(a) * v, Math.sin(a) * v - .8, rr(1, 2), 0, rr(40, 90) | 0);
  }
  gib(x, y, rr(-1.5, 1.5), rr(-2.5, -.5), 'chunk', rr(1.6, 2.6));
  if (big) gib(x, y, rr(-1.5, 1.5), rr(-2.5, -.5), 'bone', rr(2.5, 4));
  if ($.G) $.G.shake = Math.max($.G.shake || 0, big ? 7 : 4);
}
function witherFX(key, s, n = 2) {
  const [x, y] = wpos(key, s);
  for (let k = 0; k < n; k++) gib(x + rr(-2, 2), y + rr(-2, 2), rr(-2.2, .6), rr(-2, .5), k % 2 ? 'bone' : 'chunk', rr(1.8, 3.2));
  for (let k = 0; k < 8; k++) drop(x, y, rr(-1.5, 1.5), rr(-1.5, .5), rr(1, 1.8), 0, 60);
  spark(x, y, 0, -.5, 14, '#8a5a40');
}

/** diff the form; call once per frame for the real player ship only */
export function trackForm(f, x, y, s) {
  lx = x;
  ly = y;
  const reb = !based || $.P !== lastP || $.T - lastT > 20 || $.T < lastT;
  lastP = $.P;
  lastT = $.T;
  if (reb) {
    for (const k in prev) delete prev[k];
    Object.assign(prev, f);
    based = true;
    return;
  }
  for (const k in f) {
    const nv = f[k], ov = prev[k] || 0;
    if (nv > ov) {
      sp[k] = $.T;
      sproutFX(k, s, k === 'tier' || k[0] === 'r' || nv >= 3);
      if (k === 'tier') pop(x, y + 20, 'THE HULL MUTATES: ' + TIER_N[nv], '#ff8a6a', 8, 70);
    } else if (nv < ov && k !== 'tier') witherFX(k, s);
    prev[k] = nv;
  }
  for (const k in prev) if (!(k in f)) {
    if (prev[k] > 0) witherFX(k, s);
    delete prev[k];
  }
}

/** death: every grown part tears off the hull as meat and bone. One-line hook in flow.ts killPlayer. */
export function shipShed(x, y) {
  if (!based) return;
  lx = x;
  ly = y;
  let n = 0;
  for (const k in prev) {
    if (!(prev[k] > 0) || k === 'tier' || n > 18) continue;
    const [px, py] = wpos(k, 1), a = Math.atan2(py - y, px - x);
    const v = rr(1.5, 3.5);
    gib(px, py, Math.cos(a) * v, Math.sin(a) * v - 1, k[0] === 'r' ? 'metal' : n % 3 ? 'chunk' : 'bone', rr(2.4, 4.2) + (k[0] === 'r' ? 1.5 : 0));
    n++;
  }
  based = false;
}

// debug hook for the probe scripts (sets meta.rig / meta.cl / meta.lv for contraption screenshots)
if (typeof window !== 'undefined') window.__shipS = $;
