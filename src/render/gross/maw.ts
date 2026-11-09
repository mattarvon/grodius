// @ts-nocheck
// =====================================================================
//  THE MAW (Open Orbit), THE DISSOLVED MAW (acid), THE MUCUS MAW (snot): Matt's pick c1 Lamprey Disc (LS2-bossart).
//  A lamprey's oral disc on a tapering, torn hull: rings of engraved teeth (cut from a CC0 plate) seated in the gums, gill
//  pores along the flank, a torn dorsal fin. Art: tools/bossart/maw/bake.py -> sprites/boss/maw_<variant>.png, one atlas
//  per variant so a route loads only its own. The variants differ in anatomy: acid eaten (bitten rim, bare roots, ulcers,
//  bleached), snot buried (a hagfish slime sheet, glazed teeth, ropes across the mouth).
//  Render-only. Hitbox, HP, timing, bullets and spawns live in enemies/update.ts and are untouched: this reads e.t, e.jaw,
//  e.hp, e.flash, e.wounded, e.eyesP and e.biome. Render RNG only (midbosses rnd, srnd through fx/spawn), never R().
// =====================================================================
import { $ } from '../../state';
import { TAU, W, ctx, hash } from '../../core';
import { floorAt } from '../../world';
import { sample } from '../../audio';
import { srr, srnd } from '../../srnd';
import { gib, mist } from '../../fx/spawn';
import { glowC, fxs, emit, spray, stepParts, drawParts, bubble, snd, rnd, rn } from './midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, breath, dieAge, pour } from './baked';

/** kept for render/enemies.ts: 0 falls back to the original vector Maw there */
export const GROSS = 1;

const VK = (e) => (e.biome === 'acid' || e.biome === 'snot' ? e.biome : 'orbit');
const AK = { orbit: 'maw_orbit', acid: 'maw_acid', snot: 'maw_snot' };
/** 0 whole, 1 the 50% tear (update.ts opens it and its geyser at (+6,-14)), 2 ruined below 22% */
const stage = (e) => (!e.wounded ? 0 : e.hp / e.max > .22 ? 1 : 2);
const NOSE = [[-11, -19.5], [-4.5, -22]];

// what hangs off the underside, boss-local: [x, y, len, width, period]. Threads taper and shed real drops (no ball on a string)
const DRIP = {
  orbit: [[-5, 22, 9, 1.3, 70], [3, 22, 13, 1.1, 96], [10, 20, 8, 1.2, 61], [17, 17, 11, .9, 83], [-17, 19, 12, 1.0, 77]],
  acid: [[-3, 20, 6, .7, 54], [6, 19, 9, .6, 71], [13, 17, 5, .7, 47], [20, 14, 8, .6, 66], [-17, 18, 7, .7, 58]],
  snot: [[-4, 27, 18, 1.6, 130], [4, 28, 24, 1.8, 160], [12, 26, 16, 1.5, 118], [20, 23, 20, 1.3, 145], [-17, 21, 22, 1.6, 150]],
};
const DCOL = {
  orbit: ['rgba(70,6,12,.92)', '#6a0a12'], acid: ['rgba(150,120,112,.8)', '#a87c74'], snot: ['rgba(150,140,110,.72)', '#a89c78'],
};
// blood from the open wounds by stage: [x, y, len, width, period]
const BLEED = [[8, -8, 9, 1.2, 44], [11, -9, 6, .9, 31], [13, 8, 10, 1.1, 52], [24, 2, 8, 1.0, 39]];
// the death, per variant: pour() options (module constants: no allocation in the draw)
const POUR = {
  orbit: { w: 20, h: 18, jets: 8, len: 90, meat: 22, rope: 6 },
  acid: { w: 20, h: 18, jets: 5, len: 80, meat: 26, rope: 3 },
  snot: { w: 22, h: 20, jets: 6, len: 90, meat: 18, rope: 7 },
};

/** a thread hanging from (x, y): thick at the root, thin below, a drop stretching off the end that lets go every P frames */
function thread(c, s, e, id, x, y, len, w, col, tip, P, sway = 1.2) {
  const tt = e.t + hash(id) * P, f = (tt % P) / P, cyc = Math.floor(tt / P), key = 'm' + id;
  const L = len * (.25 + .75 * f * f), sw = Math.sin(e.t * .045 + id) * sway * (L / len);
  if (s.sc[key] !== undefined && s.sc[key] !== cyc) emit(s, e.x + x + sw, e.y + y + L, sw * .03, .4, tip, w * .9 + .3, 0, 90);
  s.sc[key] = cyc;
  c.strokeStyle = col;
  c.lineCap = 'round';
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + sw * .15, y + L * .3, x + sw * .4, y + L * .5);
  c.stroke();
  c.lineWidth = w * .45;
  c.beginPath();
  c.moveTo(x + sw * .4, y + L * .5);
  c.quadraticCurveTo(x + sw * .7, y + L * .8, x + sw, y + L);
  c.stroke();
  c.lineCap = 'butt';
  const bw = w * .3 + f * w * .25, bh = bw * (1.5 + f * 1.5); // a teardrop that lengthens as it lets go
  c.fillStyle = tip;
  c.beginPath();
  c.ellipse(x + sw, y + L + bh * .6, bw, bh, 0, 0, TAU);
  c.fill();
}

/** THE MUCUS MAW: ropes of slime spanning the mouth, stretching thin with e.jaw and snapping, then hanging in halves */
const ROPES = [[-18.5, -1.5, .62], [-16.5, .8, .74], [-14.5, -.4, .86]]; // x, sag offset, snap point in e.jaw
function ropes(c, s, e) {
  const j = e.jaw, rt = 5.4 + 6.6 * j;
  for (let i = 0; i < ROPES.length; i++) {
    const r = ROPES[i], x = r[0] + j * .6, y0 = -rt * .92, y1 = rt * .92, key = 'rp' + i, snapped = j > r[2];
    if (snapped && !s.sc[key]) { spray(s, e.x + x, e.y, 5, '#a89c78', .9, .8, .2); s.sc[key] = 1; }
    if (!snapped && j < .05) s.sc[key] = 0; // grown back while the mouth was shut
    const wd = Math.max(.35, 1.7 - j * 1.6) * (1 - i * .12);
    c.lineCap = 'round';
    if (!snapped) {
      const sag = r[1] + (1 - j) * 1.5;
      for (let k = 0; k < 2; k++) {
        c.strokeStyle = k ? 'rgba(232,226,196,.55)' : 'rgba(158,148,116,.78)';
        c.lineWidth = k ? wd * .35 : wd;
        c.beginPath();
        c.moveTo(x - k * .3, y0);
        c.quadraticCurveTo(x + sag - k * .3, 0, x + .6 - k * .3, y1);
        c.stroke();
      }
    } else if (s.sc[key] && j > .05) { // the snapped halves curl back toward each lip, shrinking
      const L = Math.max(1, (1 - (j - r[2]) * 3) * rt * .6) + Math.sin(e.t * .2 + i) * .6;
      c.strokeStyle = 'rgba(158,148,116,.78)';
      c.lineWidth = Math.max(.6, wd);
      c.beginPath();
      c.moveTo(x, y0);
      c.quadraticCurveTo(x - .8, y0 + L * .5, x - .4, y0 + L);
      c.moveTo(x + .6, y1);
      c.quadraticCurveTo(x + 1, y1 - L * .3, x + 1.6, y1 + L * .4); // the lower half hangs out of the lip
      c.stroke();
    }
    c.lineCap = 'butt';
  }
}

const live = new Set(); // Maws drawn alive (to catch the kill)
export function drawGrossMaw(c, e) {
  const v = VK(e), k = AK[v], s = fxs(e), t = e.t;
  if (e.dead || e.hp <= 0) { // a split corpse (gore.ts 'half'): each half plays the death frames as it tumbles
    if (!bf(c, k, 'die', Math.min(7, (dieAge(e) / 7) | 0))) bakedFallback(c, e.r);
    return;
  }
  live.add(e);
  stepParts(s);
  const w = stage(e), cyc = t % 130, tel = cyc >= 78 && cyc < 100 ? (cyc - 78) / 22 : 0;
  const spew = cyc >= 100 && cyc < 114 && e.x < W - 20;
  // the retch: a shudder that grows to the heave (render-only: the hitbox does not move)
  const sh = tel * tel * 1.2;
  c.save();
  if (sh) c.translate(Math.round((hash(t * 1.7) - .5) * sh * 2) * .5, Math.round((hash(t * 2.3 + 5) - .5) * sh * 2) * .5);
  let ok;
  if (e.flash) ok = bf(c, k, 'hurt' + w);
  else if (spew) ok = bf(c, k, 'spew' + w, cyc - 100 < 7 ? 1 : 0);
  else if (e.jaw > .1) ok = bf(c, k, 'jaw' + w, Math.max(0, Math.min(4, Math.round(e.jaw * 5) - 1)));
  else ok = bf(c, k, 'idle' + w, breath(t, 5, 92 - w * 16, 7));
  if (!ok) bakedFallback(c, e.r);
  // ---- live wet over the baked body ----
  const D = DRIP[v], col = DCOL[v];
  for (let i = 0; i < D.length; i++) { const d = D[i]; thread(c, s, e, 40 + i, d[0], d[1], d[2], d[3], col[0], col[1], d[4], v === 'snot' ? 2.2 : 1.2); }
  for (let i = 0; i < w * 2 && i < BLEED.length; i++) { const d = BLEED[i]; thread(c, s, e, 60 + i, d[0], d[1], d[2] * (1 + .3 * w), d[3], 'rgba(110,6,14,.95)', '#8a0c14', d[4] - w * 8, .6); }
  if (v === 'snot') {
    ropes(c, s, e);
    for (let i = 0; i < 2; i++) bubble(c, s, e, 80 + i, NOSE[i][0] - 1, NOSE[i][1] - 1.5, 3.2 + i, 120 + i * 37, 'rgba(176,166,130,.32)', 'rgba(226,220,186,.8)', '#b0a47c', 5);
  } else if (v === 'acid' && rnd() < .25 * s.dt) { // tissue fizzing off the ulcers
    emit(s, e.x + rn(-6, 24), e.y + rn(-16, 16), rn(-.2, .2), rn(-.5, -.1), 'rgba(214,208,196,.8)', rn(.5, .9), 0, 24, -.01);
  }
  // hits: the body sprays from where it is open, more as it tears
  if (e.flash && rnd() < .6) emit(s, e.x + rn(-20, 22), e.y + rn(-16, 18), rn(-1.6, 1), rn(-1.8, .3), v === 'acid' ? '#7a1418' : '#6a0810', rn(.8, 1.6), 0, 60);
  // the throat flushes and throws light through the retch: the honest tell for the 7-glob fan at cycle 100
  if (tel > 0 || spew) {
    const g = spew ? 1 - (cyc - 100) / 14 : tel;
    c.globalCompositeOperation = 'lighter';
    glowC(c, -14, 0, 6 + g * 9, '255,70,40', .14 + g * .4);
    c.globalCompositeOperation = 'source-over';
    if (tel > .3 && rnd() < tel * .4 * s.dt) emit(s, e.x - 14 + rn(-3, 3), e.y + rn(-4, 4), rn(-.9, -.2), rn(-.6, .4), '#5a0610', rn(.7, 1.3), 0, 40);
  }
  if (spew && s.sc.sp !== Math.floor(t / 130)) { // the heave: blood and bile thrown along the shot (the globs are the bullets)
    s.sc.sp = Math.floor(t / 130);
    const a = Math.atan2($.P.y - e.y, $.P.x - (e.x - 14));
    for (let i = 0; i < 18; i++) { const aa = a + rn(-.5, .5), sp = rn(.9, 2.6); emit(s, e.x - 18, e.y + rn(-3, 3), Math.cos(aa) * sp, Math.sin(aa) * sp, i % 3 ? '#4a0408' : v === 'snot' ? '#9a8c62' : '#7a1010', rn(.8, 1.8), 0, 50, .05); }
    snd('splat_m', .35, .2);
  }
  // ---- the eyes: seated round the disc at the exact points the aimed shots leave from (update.ts eyesP) ----
  const P = $.P;
  for (let i = 0; i < e.eyesP.length; i++) {
    const ep = e.eyesP[i], x = -Math.cos(ep.a) * ep.r, y = Math.sin(ep.a) * ep.r;
    const a = Math.atan2(P.y - e.y - y, P.x - e.x - x), g = ((Math.round(a / (TAU / 8)) % 8) + 8) % 8;
    bf(c, k, ep.s < 2.07 ? 'eye0' : ep.s < 2.54 ? 'eye1' : 'eye2', ep.b > 0 ? 8 : g, Math.round(x), Math.round(y));
  }
  drawParts(c, s, e);
  c.restore();
}

// ---------------- the death: ticked once per render from hud.ts (after the enemies) ----------------
// The split halves play the baked 'die' list (disc ripped off, the flank split along the gill pores, gut sliding out). Here:
// the torn disc falls turning, its teeth scatter, the eyes pop, and pour() empties the body (arterial pulses, gut ropes, meat).
const RUP = [];
const PT = []; // loose teeth: { x, y, vx, vy, f, k, l, st }
let lastT = -1, lastG = null;
function rupture(e) {
  const v = VK(e);
  RUP.push({ x: e.x, y: e.y, k: AK[v], v, age: 0, dx: 0, dy: 0, vx: -.5, vy: -1.6 });
  for (let i = 0; i < 16; i++) if (PT.length < 60) PT.push({ x: e.x - 17 + srr(-4, 4), y: e.y + srr(-14, 14), vx: srr(-2.6, .8), vy: srr(-3, .5), f: (srnd() * 4) | 0, k: AK[v], l: srr(70, 120), st: 0 });
  for (let i = 0; i < e.eyesP.length; i += 2) { const ep = e.eyesP[i]; gib(e.x - Math.cos(ep.a) * ep.r, e.y + Math.sin(ep.a) * ep.r, srr(-2.4, .6), srr(-3, -.5), 'eye', 2 + ep.s * .4); }
  mist(e.x - 4, e.y, 40, 60, 1);
  if ($.state === 'play') {
    try {
      sample('splat_l', { vol: .95, rate: .75, prio: true });
      sample('gross_slosh', { vol: .8, rate: .55, spread: .05, at: .2, prio: true }); // the hull emptying
    } catch (err) {}
  }
}
/** the Maws' death and loose teeth; call once per render after the enemies are drawn */
export function drawMawFx() {
  const c = ctx;
  if (lastG !== $.G) { lastG = $.G; RUP.length = 0; PT.length = 0; live.clear(); lastT = $.T; }
  const dt = Math.max(0, Math.min(4, $.T - lastT));
  lastT = $.T;
  for (const e of live) {
    if (!e.dead) continue;
    live.delete(e);
    if (e.hp <= 0 && e.x < W + 40) rupture(e); // an escape leaves off the right edge alive
  }
  const sc = ($.G && $.G.scroll) || 0;
  for (let i = RUP.length - 1; i >= 0; i--) {
    const r = RUP[i];
    for (let s = 0; s < dt; s++) {
      r.age++;
      r.vy += .11;
      r.dx += r.vx;
      r.dy += r.vy;
      pour(r.x + 6, r.y + 4, r.age, POUR[r.v]);
      // the disc tore off with the gullet: it bleeds from its stump as it falls
      if (r.age < 70 && r.age % 3 === 0) gib(r.x - 17 + r.dx + srr(-3, 3), r.y + r.dy + srr(-6, 6), srr(-.6, .6), srr(-.4, .6), 'chunk', srr(1, 1.8));
    }
    if (r.age > 110) { RUP[i] = RUP[RUP.length - 1]; RUP.pop(); continue; }
    c.save();
    c.globalAlpha = r.age > 86 ? (110 - r.age) / 24 : 1;
    bf(c, r.k, 'disc', (r.age / 5) | 0, Math.round(r.x - 17 + r.dx), Math.round(r.y + r.dy));
    c.restore();
  }
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i];
    for (let s = 0; s < dt; s++) {
      p.l--;
      if (p.st) continue;
      p.vy += .13;
      p.x += p.vx;
      p.y += p.vy;
      const fy = floorAt(p.x + sc) - 1;
      if (p.vy > 0 && p.y > fy) { p.y = fy; p.st = 1; }
    }
    if (p.l <= 0) { PT[i] = PT[PT.length - 1]; PT.pop(); continue; }
    c.globalAlpha = Math.min(1, p.l / 30);
    bf(c, p.k, 'tooth', p.st ? p.f & 2 : p.f + (((p.l / 4) | 0) & 1), Math.round(p.x), Math.round(p.y));
  }
  c.globalAlpha = 1;
}

/** for debugging / probes */
(globalThis as any).__mawFx = () => ({ pt: PT.length, rup: RUP.length, live: live.size });

/** start loading variant v's atlas (per-route warm-up, render/warmup.ts); false: nothing left to build */
export function warmMawVariant(v) { bakedWarm(AK[v] || AK.orbit); return false; }
export const mawVariantBuilt = (v) => bakedBuilt(AK[v] || AK.orbit);
/** free variant v's atlas; its next draw loads it again */
export function dropMawVariant(v) { bakedDrop(AK[v] || AK.orbit); }
