// @ts-nocheck
// Sprite FX layered over the code-drawn gore: hit-spark bursts (Clint Bellanger's Sparks, blood / fire / ice, tinted
// acid + snot for those biomes) and death explosions (Daniel Cook's Tyrian frames, graded to a sick bloody fire) that
// play UNDER the gibs. Strips are cut by tools/prep_fx.py.
// RULE: render-only. Everything random here is srnd(), never the gameplay R(): the regression harness seeds
// Math.random, so one extra R() call would shift every later spawn. Pools are preallocated rings (no per-hit allocation).
import { $ } from '../state';
import { W, ctx } from '../core';
import { SPR, srnd } from '../sprites';
import { biomeK } from '../biomes';

const HSETS = ['hit_blood', 'hit_fire', 'hit_ice', 'hit_acid', 'hit_snot'];
const HN = 48, HITS = Array.from({ length: HN }, () => ({ on: 0, x: 0, y: 0, t: 0, set: 0, v: 0, s: 1, fx: 1, fy: 1, dir: 1 }));
let hi = 0, hitT = -1, hitN = 0, bT = -1, bSet = 0;

/** spark set for the biome under the camera (cached per frame: biomeK allocates) */
function biomeSet() {
  if (bT === $.T) return bSet;
  bT = $.T;
  const G = $.G, [b, k] = G ? biomeK(G.scroll + W / 2) : [null, 0];
  bSet = k < .5 ? 0 : b === 'fire' ? 1 : b === 'ice' ? 2 : b === 'acid' ? 3 : b === 'snot' ? 4 : 0;
  return bSet;
}
/** a sprite spark burst where a player round hit. d = damage, crit > 1 on a crit, burning = target is on fire */
export function hitBurst(x, y, dir, d, crit = 1, burning = false) {
  if (hitT !== $.T) { hitT = $.T; hitN = 0; }
  if (++hitN > 6) return; // a full-power hose lands a dozen hits a frame: six bursts already read as a spray
  const h = HITS[hi];
  hi = (hi + 1) % HN;
  h.on = 1;
  h.x = x; h.y = y; h.t = 0; h.dir = dir || 1;
  h.set = burning ? 1 : biomeSet();
  h.v = srnd() < .5 ? 0 : 4;
  h.s = Math.min(1.25, .55 + d * .14) * (crit > 1 ? 1.3 : 1);
  h.fx = srnd() < .5 ? 1 : -1;
  h.fy = srnd() < .5 ? 1 : -1;
}
const HDUR = 4; // game frames per sprite frame (4 frames -> 16 frames of life)
export function stepHits() {
  const ss = ($.G && $.G.scrollSpeed) || 0;
  for (let i = 0; i < HN; i++) {
    const h = HITS[i];
    if (!h.on) continue;
    h.x -= ss * .5 + h.dir * .25; // drifts back toward the gun, like the blood spray
    if (++h.t >= HDUR * 4) h.on = 0;
  }
}
/** drawn on top of the shots (render/bullets.ts drawShots) */
export function drawHits() {
  let m = null;
  for (let i = 0; i < HN; i++) {
    const h = HITS[i];
    if (!h.on) continue;
    const S = SPR[HSETS[h.set]];
    if (!S || !S.fw) continue;
    if (!m) m = ctx.getTransform(); // the world layer is shake-translated: build on it
    const f = h.v + Math.min(3, (h.t / HDUR) | 0), glowy = h.set === 1 || h.set === 2;
    ctx.globalCompositeOperation = glowy ? 'lighter' : 'source-over';
    ctx.globalAlpha = 1;
    // the burst is round: stretch it along the shot's back-spray and push its centre back toward the shooter
    const sx = h.s * 1.25 * h.fx, sy = h.s * .85 * h.fy, w = S.fw, hh = S.fh;
    ctx.setTransform(sx * m.a, 0, 0, sy * m.d, m.a * ((h.x - h.dir * 3 * h.s) | 0) + m.e, m.d * (h.y | 0) + m.f);
    ctx.drawImage(S.img, f * w, 0, w, hh, -w / 2, -hh / 2, w, hh);
  }
  if (m) ctx.setTransform(m);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ---------------- death explosions ----------------
// kinds: 0 small pop (boom_s: 3 variants x 10 frames), 1 fireball (boom_m: 10), 2 fire ring (boom_ring: 7)
const BK = ['boom_s', 'boom_m', 'boom_ring'], BF = [10, 10, 7], BD = [2.5, 3, 3.4]; // frames, game frames per frame
const BN = 40, BOOMS = Array.from({ length: BN }, () => ({ on: 0, x: 0, y: 0, t: 0, k: 0, v: 0, s: 1, fx: 1, fy: 1 }));
let bi = 0;
function addBoom(x, y, k, s, delay) {
  const b = BOOMS[bi];
  bi = (bi + 1) % BN;
  b.on = 1;
  b.x = x; b.y = y; b.k = k; b.s = s; b.t = -delay;
  b.v = k === 0 ? (srnd() * 3) | 0 : 0;
  b.fx = srnd() < .5 ? 1 : -1;
  b.fy = srnd() < .5 ? 1 : -1;
}
/** fireball under the gibs, scaled by gore size: pops for drones, staggered blooms + a fire ring for big things */
export function boom(x, y, sz) {
  if (sz < .55) return; // crit spatter, small contraption pops: the sparks already cover those
  if (sz < 1.3) {
    addBoom(x, y, 0, .9 + (sz - .55) * .6, 0);
    if (srnd() < .5) addBoom(x + (srnd() - .5) * 8, y + (srnd() - .5) * 6, 0, .7, 3 + srnd() * 3);
    return;
  }
  if (sz < 3) {
    addBoom(x, y, 1, .75 + sz * .18, 0);
    const n = 1 + (sz > 2 ? 1 : 0) + (srnd() < .5 ? 1 : 0);
    for (let k = 0; k < n; k++) addBoom(x + (srnd() - .5) * 8 * sz, y + (srnd() - .5) * 6 * sz, 0, .9 + srnd() * .4, 2 + srnd() * 8);
    return;
  }
  // big enemies and bosses: a bloom of fireballs going off in sequence around a fire ring
  addBoom(x, y, 2, 1 + sz * .3, 2);
  addBoom(x, y, 1, 1.3 + sz * .08, 0);
  const n = 3 + Math.min(4, sz | 0), R0 = 5 + sz * 3;
  for (let k = 0; k < n; k++) {
    const a = srnd() * 6.283, r = R0 * (.4 + srnd() * .6);
    addBoom(x + Math.cos(a) * r, y + Math.sin(a) * r * .8, 1, .8 + srnd() * .5, 3 + k * 3 + srnd() * 4);
  }
  for (let k = 0; k < 4; k++) addBoom(x + (srnd() - .5) * R0 * 2.4, y + (srnd() - .5) * R0 * 1.8, 0, 1 + srnd() * .5, 6 + srnd() * 16);
}
export function stepBooms() {
  const ss = ($.G && $.G.scrollSpeed) || 0;
  for (let i = 0; i < BN; i++) {
    const b = BOOMS[i];
    if (!b.on) continue;
    b.x -= ss * .5;
    if (++b.t >= BF[b.k] * BD[b.k]) b.on = 0;
  }
}
/** drawn at the start of the gibs layer (render/gore.ts), over terrain and corpses and under the gibs and blood.
 *  glow 0: the fireball itself (under the death mist); glow 1: an additive pass after the mist, so the fire shines
 *  through the blood haze instead of being smothered by it */
export function drawBooms(glow = 0) {
  let m = null;
  for (let i = 0; i < BN; i++) {
    const b = BOOMS[i];
    if (!b.on || b.t < 0) continue;
    const S = SPR[BK[b.k]];
    if (!S || !S.fw) continue;
    const f = (b.t / BD[b.k]) | 0, life = f / BF[b.k];
    if (glow) {
      if (life > .6) continue;
      ctx.globalAlpha = .7 * (1 - life / .6);
    }
    if (!m) {
      m = ctx.getTransform();
      ctx.globalCompositeOperation = glow ? 'lighter' : 'source-over';
      if (!glow) ctx.globalAlpha = 1;
    }
    const fr = b.v * BF[b.k] + f, w = S.fw, h = S.fh;
    ctx.setTransform(b.s * b.fx * m.a, 0, 0, b.s * b.fy * m.d, m.a * (b.x | 0) + m.e, m.d * (b.y | 0) + m.f);
    ctx.drawImage(S.img, fr * w, 0, w, h, -w / 2, -h / 2, w, h);
  }
  if (!m) return;
  ctx.setTransform(m);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
/** wipe both pools (new game / screenshots) */
export function clearFxSprites() {
  for (const h of HITS) h.on = 0;
  for (const b of BOOMS) b.on = 0;
}
