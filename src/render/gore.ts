// @ts-nocheck
import { $ } from '../state';
import { C, DC, H, TAU, W, ctx } from '../core';
import { decals, drops, gibs, mists } from '../world';
import { eye } from '../render/eyes';
import { DRAW } from '../render/enemies';
import { drawMidCross } from './gross/midbosses';
import { HOST_TINT, isCross } from '../enemies/midhost';
import { biomeMist, splatCols } from '../biomes';
import { drawBooms } from '../fx/fxsprites';
import { GIB_SS, gibAtlas, gibCell, gibPal } from './gibart';
import { woundDC } from './wounds';
import { sprReady } from '../sprites';

// --- gibs & gore ---
const ROPE_GUT = [[4, '#22050a'], [2.6, '#6a1014'], [1, '#a8322a']], ROPE_CHAIN = [[3.2, '#14181d'], [2, '#59646f'], [.8, '#b7c3cf']];
export function drawGibs() {
  // death explosions go under the gore, then the death mist over them (drawMists leaves the ov ones for here)
  drawBooms(0);
  mistPass(1);
  drawBooms(1);
  // solid gibs are one atlas draw each (render/gibart.ts); only what changes shape per frame stays vector. The atlas
  // wants smoothing and the shake-translated world layer doesn't, so both are flipped only when the kind of draw changes
  // m is the world layer's shake translate (screens.ts render). Only a, d, e, f are used: a camera roll or skew there
  // would misplace every gib, so the matrix below must be rebuilt in full if that ever changes
  const A = gibAtlas(), pal = gibPal(), m = ctx.getTransform(), ma = m.a / GIB_SS, md = m.d / GIB_SS;
  const lay = stuckSync(A, pal); // the stuck gibs' world layer (below): one blit for all of them, under the rest
  let baked = false, la = -1;
  for (const q of gibs) {
    if (lay && q._G === RING.gg) continue; // in the stuck layer, drawn above
    const age = (q.ml || q.l) - q.l,
      a = Math.min(1, q.l / 50) * (q.stuck ? 1 : Math.max(.45, 1 - Math.max(0, age - 45) / 160));
    if (a !== la) { ctx.globalAlpha = la = a; } // r4-perf: most gibs sit at 1; every path below leaves globalAlpha as it found it
    if (q.k !== 'rope' && q.k !== 'eye' && q.k !== 'half') {
      if (!baked) { baked = true; ctx.imageSmoothingEnabled = true; }
      if (q.cp !== pal) { q.cp = pal; q.cell = gibCell(q, pal); }
      const c = q.cell, k = c.r ? q.s / c.r : 1, cs = Math.cos(q.rot) * k, sn = Math.sin(q.rot) * k, d = c.h * 2;
      ctx.setTransform(ma * cs, md * sn, -ma * sn, md * cs, m.a * q.x + m.e, m.d * q.y + m.f);
      ctx.drawImage(A, c.x, c.y, d, d, -c.h, -c.h, d, d);
      continue;
    }
    if (baked) { baked = false; ctx.imageSmoothingEnabled = false; ctx.setTransform(m); }
    if (q.k === 'rope') {
      const p = q.pts;
      ctx.lineJoin = 'round';
      for (const [w, c] of q.chain ? ROPE_CHAIN : ROPE_GUT) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y + (w === 1 ? -.6 : 0));
        ctx.stroke();
      }
      continue;
    }
    if (q.k === 'eye') {
      const p = q.pts;
      ctx.strokeStyle = '#8e2a36';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
      eye(ctx, q.x, q.y, q.s, { ang: q.rot, m: .6, iris: q.iris, bs: 2, fire: q.burning > 0, dil: 1.4 }); // the queue only reads the position and scale, so no save/rotate
      continue;
    }
    const bk = halfBake(q);
    if (bk >= 0) { // a baked half (halfBake): one draw from the halves' atlas, like an atlas gib
      if (!baked) { baked = true; ctx.imageSmoothingEnabled = true; }
      const cs = Math.cos(q.rot), sn = Math.sin(q.rot), d = HB.px, hh = d / 2;
      ctx.setTransform(ma * cs, md * sn, -ma * sn, md * cs, m.a * q.x + m.e, m.d * q.y + m.f);
      ctx.drawImage(HB.cv, (bk % HB.cols) * d, Math.floor(bk / HB.cols) * d, d, d, -hh, -hh, d, d);
      continue;
    }
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    drawHalf(ctx, q);
    ctx.restore();
  }
  if (baked) { ctx.imageSmoothingEnabled = false; ctx.setTransform(m); }
  ctx.globalAlpha = 1;
  // the halves gone since the last frame give their atlas cells back
  for (let i = HB.live.length - 1; i >= 0; i--) {
    const q = HB.live[i];
    if (q.bk >= 0 && q.bkF === HB.f) continue;
    if (q.bk >= 0) { HB.free.push(q.bk); q.bk = -1; }
    HB.live[i] = HB.live[HB.live.length - 1]; HB.live.pop();
  }
  HB.f++;
}
// r4-perf (T3): BAKED HALVES. A split crew body (a corpse, a crew knot, a clump) was its whole body drawn again under a
// clip every frame, twice per kill: in the Open Orbit knots ~30 halves are up at once, ~3,000 canvas calls a frame (the
// knot is 5 bodies and 20 chain links). Those kinds draw only through the context they are handed and hold still once
// dead (the sprite frame, the twitch and the blood string are frozen with the body), so each half is painted once, at
// the gib atlas's scale (GIB_SS), into a cell of one shared canvas (no canvas made mid-fight), and drawn as one image
// with the gib atlas's smoothing. A capsule carrier (its blinking cap), a crossover (host tint), every other kind and a
// half past the atlas's last free cell stay live, as before
const HALF_BAKE = { corpse: 1, knot: 1, clump: 1 };
/** the halves' atlas: CELLS cells of 2 x H game px (H: the half-size of a cell; a knot's half reaches ~35: its bodies
 *  on an 11 px ring, the tear's wet edge 32 px out each side) */
const HB = { H: 40, cols: 7, rows: 7, px: 0, cv: null, free: [], live: [], f: 0 };
function halfBake(q) {
  const e = q.e;
  if (!HALF_BAKE[e.k] || e.cap || (e.host && isCross(e)) || !sprReady('corpse')) return -1;
  if (q.bk >= 0 && q.bkC !== C.bloodL) { HB.free.push(q.bk); q.bk = -1; } // a biome's palette came in: repaint (the tear's edge reads C.bloodL)
  if (q.bk >= 0) { q.bkF = HB.f; return q.bk; }
  if (!HB.cv) { // once, at the first half
    HB.px = HB.H * 2 * GIB_SS;
    HB.cv = document.createElement('canvas');
    HB.cv.width = HB.cols * HB.px; HB.cv.height = HB.rows * HB.px;
    for (let i = HB.cols * HB.rows - 1; i >= 0; i--) HB.free.push(i);
  }
  if (!HB.free.length) return -1; // every cell taken: this one draws live
  const i = HB.free.pop(), d = HB.px, cx = (i % HB.cols) * d, cy = Math.floor(i / HB.cols) * d, x = HB.cv.getContext('2d');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(cx, cy, d, d);
  x.beginPath();
  x.rect(cx, cy, d, d);
  x.clip(); // nothing a half draws may reach a neighbour's cell
  x.setTransform(GIB_SS, 0, 0, GIB_SS, cx + d / 2, cy + d / 2);
  x.globalAlpha = 1;
  x.imageSmoothingEnabled = false; // the world layer's setting, which the live draw had
  drawHalf(x, q);
  x.restore();
  q.bk = i; q.bkF = HB.f; q.bkC = C.bloodL;
  HB.live.push(q);
  return i;
}
/** a split corpse on c, at its local origin: its body clipped along the jagged tear, then the wet edge */
function drawHalf(c, q) {
  const e = q.e;
  c.save();
  c.beginPath();
  const J = q.jag,
    side = q.side,
    R2 = e.r * 2.4;
  c.moveTo(-R2, 0);
  for (const [x, y] of J) c.lineTo(x * e.r / 12, y);
  c.lineTo(R2, 0);
  c.lineTo(R2, side * R2);
  c.lineTo(-R2, side * R2);
  c.closePath();
  c.clip();
  c.translate(0, -side * 3);
  $.EYE_LOW = 1;
  if (e.host && isCross(e)) { const T = HOST_TINT[e.host]; drawMidCross(c, e, DRAW[e.k], T.rgb, T.a); } // a crossover's halves keep its host tint
  else DRAW[e.k](c, e);
  $.EYE_LOW = 0;
  c.restore();
  c.strokeStyle = '#5a050a';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(J[0][0] * e.r / 12, J[0][1]);
  for (const [x, y] of J) c.lineTo(x * e.r / 12, y);
  c.stroke();
  c.strokeStyle = C.bloodL;
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = C.bone;
  c.fillRect(-1, -.5, 2, 1);
}
export function drawDrops() {
  ctx.lineCap = 'butt';
  const dc = woundDC() || DC; // a remix visit's drop colours (render/wounds.ts), at draw time only: the sim's DC is untouched
  // r4-perf (T3): one pass sorts the drops into their 12 strokes (it walked every drop 12 times: up to 4,800 drops, 57k
  // tests a frame in the knots). Each bucket keeps the drops' order, and each stroke is one opaque colour, so the paths
  // and the pixels are the same as before
  const nb = DC.length * 2;
  for (let b = 0; b < nb; b++) (DROP_B[b] ||= []).length = 0;
  for (const d of drops) { const b = DROP_B[d.c * 2 + (d.s >= 1.6 ? 1 : 0)]; if (b) b.push(d); }
  for (let c = 0; c < DC.length; c++) for (let big = 0; big < 2; big++) {
    const B = DROP_B[c * 2 + big];
    if (!B.length) continue;
    ctx.strokeStyle = dc[c];
    ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath();
    for (const d of B) {
      ctx.moveTo(d.px, d.py);
      ctx.lineTo(d.x + .5, d.y + .5);
    }
    ctx.stroke();
  }
  for (let b = 0; b < nb; b++) DROP_B[b].length = 0; // let go of the drops: the buckets must not keep dead ones alive
}
/** drawDrops' buckets, one per colour x width (index c * 2 + big), kept across frames: no allocation per frame */
const DROP_B = [];
export function drawMists() {
  mistPass(0);
}
function mistPass(ov) {
  const mc = biomeMist() || '95,4,9';
  for (const m of mists) {
    if ((m.ov || 0) !== ov) continue;
    ctx.fillStyle = `rgba(${mc},${.45 * m.l / m.ml})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
  }
}
export function drawDecals() {
  const sc = $.G.scroll, sp = splatCols();
  if (ringTick(sc) && decalSync(sc, sp)) { RING.sf = RING.f; decalLive(sc, sp, true); return; }
  decalLive(sc, sp, false);
}
/** the decals drawn straight onto the world layer (the old path, every frame): used while the scroll moves by a
 *  fraction of a pixel (it eases in and out of a fight), when a layer's pixel grid wouldn't line up. dripsOnly: the
 *  layers hold the rest, and only the drips still growing are drawn here */
function decalLive(sc, sp, dripsOnly) {
  if (!dripsOnly) {
    ctx.fillStyle = sp ? sp[0] : '#3a0306';
    ctx.beginPath();
    for (const d of decals) {
      const x = d.wx - sc;
      if (x < -20 || x > W + 20) continue;
      ctx.moveTo(x + d.r * 1.8, d.y);
      ctx.ellipse(x, d.y, d.r * 1.8, d.r * .6, 0, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = sp ? sp[1] : '#7d0a10';
    ctx.beginPath();
    for (const d of decals) {
      const x = d.wx - sc;
      if (x < -20 || x > W + 20) continue;
      ctx.moveTo(x + d.r, d.y - d.side * .3);
      ctx.ellipse(x - .4, d.y - d.side * .3, d.r * 1.05, d.r * .3, 0, 0, TAU);
    }
    ctx.fill();
  }
  ctx.fillStyle = sp ? sp[2] : '#6a0509';
  for (const d of decals) {
    if (d.side > 0 || d.r < 1.6) continue;
    if (dripsOnly && d._D === RING.dg) continue; // a full-length drip, in the drip layer
    const x = d.wx - sc;
    if (x < -5 || x > W + 5) continue;
    const len = Math.min(d.r * 4, ($.T - d.t) * .05);
    ctx.fillRect(x - .5, d.y, 1, len);
    ctx.fillRect(x - 1, d.y + len - 1, 2, 2);
  }
}

// r4-perf (T3): WORLD LAYERS. Decals (up to 1,800, ~1,000 in the breach) and stuck gibs (hundreds after a knot fight)
// sit still in the world: they only move with the scroll. Each was redrawn every frame (two ellipses a decal, an atlas
// draw a gib). Here they are painted once into ring canvases LW px wide that wrap in world x, and each layer is one
// blit a frame (two at the wrap). The ring's pixel grid is the screen's: a layer is used only while the scroll's
// fraction of a pixel holds still (RING.ph: scrolling 1 px a frame, or held for a fight), so a blit lands on the pixels
// the direct draw did. While the scroll eases (a fight's start and end) everything is drawn the old way.
// Decals keep their two same-colour unions (dark, then light, then the drips) as three layers, so overlaps stack as
// before; a drip still growing is drawn live. A stuck gib leaves its layer (erased there, the neighbours it covered
// painted back) when it starts to fade (l < 50), comes unstuck, or goes; the flying gibs draw over the layer.
// Render-only: no srnd(), no sim field written (the _D/_G/_L/_s marks sit on fx objects nothing else reads)
const LW = 1024;
const RING = { on: false, ph: 0, lastPh: -1, sc: 0, R: 0, K: 0, f: 0, sf: -1, dg: 1, gg: 1, key: null, pal: -1, n: 0, L: null, LD: [], LG: [] };
const mod = (v, n) => ((v % n) + n) % n;
function ringMake() {
  const mk = () => { const cv = document.createElement('canvas'); cv.width = LW; cv.height = H; return { cv, x: cv.getContext('2d') }; };
  RING.L = { dark: mk(), light: mk(), drip: mk(), gib: mk() };
}
/** layer columns for world x [w0, w1), cleared (every layer, or `only`) */
function ringClear(w0, w1, only = null) {
  const n = Math.ceil(w1 - w0) + 2;
  for (const k of only || ['dark', 'light', 'drip', 'gib']) {
    const x = RING.L[k].x;
    if (n >= LW) { x.clearRect(0, 0, LW, H); continue; }
    const u = mod(Math.floor(w0 - RING.ph) - 1, LW);
    x.clearRect(u, 0, Math.min(n, LW - u), H);
    if (u + n > LW) x.clearRect(0, 0, u + n - LW, H);
  }
}
/** the frame's ring: false = draw everything live this frame (the scroll is easing). A first frame, a scroll that
 *  jumped or ran back, or a new fraction of a pixel that holds still repaints the layers from the live lists */
function ringTick(sc) {
  const ph = sc - Math.floor(sc), cd = (a, b) => { const v = Math.abs(a - b); return Math.min(v, 1 - v); };
  const moving = cd(ph, RING.lastPh) > .005;
  RING.lastPh = ph;
  RING.f++;
  if (!RING.on || cd(ph, RING.ph) > .02 || sc < RING.sc - .5 || sc - RING.sc > LW) {
    if (moving) { RING.on = false; return false; }
    if (!RING.L) ringMake();
    RING.on = true; RING.ph = ph; RING.dg++; RING.gg++; RING.LD.length = 0; RING.LG.length = 0; RING.key = null; RING.pal = -1;
    for (const k in RING.L) RING.L[k].x.clearRect(0, 0, LW, H);
    RING.R = sc + W + 48;
  }
  const R2 = sc + W + 48;
  if (R2 > RING.R) { ringClear(RING.R - 2, R2 + 32); RING.R = R2 + 32; } // 32 columns at a time: a layer written every frame is flushed every frame
  RING.sc = sc;
  RING.K = Math.round(sc - RING.ph);
  return true;
}
/** one layer onto the world layer at the screen's pixels (the world layer's shake translate is whole pixels) */
function ringBlit(k) {
  const cv = RING.L[k].cv, kk = mod(RING.K, LW), w1 = Math.min(W, LW - kk);
  ctx.drawImage(cv, kk, 0, w1, H, 0, 0, w1, H);
  if (w1 < W) ctx.drawImage(cv, 0, 0, W - w1, H, w1, 0, W - w1, H);
}
/** draw(lx) at world x wx's layer column, and again across the wrap where ext reaches it */
function ringAt(wx, ext, draw) {
  const lx = mod(wx - RING.ph, LW);
  draw(lx);
  if (lx - ext < 0) draw(lx + LW);
  if (lx + ext > LW) draw(lx - LW);
}
/** bring the decal layers up to date (new decals, grown ones, a visible one gone) and blit them */
function decalSync(sc, sp) {
  const key = sp ? sp.join() : '';
  if (key !== RING.key) { // a biome's splat colours (or a repaint): the decal layers start over
    RING.key = key; RING.dg++; RING.LD.length = 0; ringClear(0, LW, ['dark', 'light', 'drip']);
  }
  const f = RING.f, dg = RING.dg, Ld = RING.L.dark.x, Ll = RING.L.light.x, Lr = RING.L.drip.x;
  let redo = false, any = false;
  Ld.fillStyle = sp ? sp[0] : '#3a0306'; Ll.fillStyle = sp ? sp[1] : '#7d0a10'; Lr.fillStyle = sp ? sp[2] : '#6a0509';
  Ld.beginPath(); Ll.beginPath();
  for (const d of decals) {
    d._s = f;
    if (d._L === dg && d._r === d.r) { // in the layers as it is
      if (d._D !== dg && d.side <= 0 && d.r >= 1.6 && ($.T - d.t) * .05 >= d.r * 4) { // its drip stopped growing: into the drip layer
        ringAt(d.wx, 2, (lx) => { Lr.fillRect(lx - .5, d.y, 1, d.r * 4); Lr.fillRect(lx - 1, d.y + d.r * 4 - 1, 2, 2); });
        d._D = dg;
      }
      continue;
    }
    const x = d.wx - sc;
    if (x < -20 || x > W + 20) continue; // the old cull: a decal off the right edge goes in as it comes on
    if (d._D === dg) redo = true; // a full drip whose decal grew (a merge): the drip is longer now
    ringAt(d.wx, 14, (lx) => {
      Ld.moveTo(lx + d.r * 1.8, d.y); Ld.ellipse(lx, d.y, d.r * 1.8, d.r * .6, 0, 0, TAU);
      Ll.moveTo(lx + d.r, d.y - d.side * .3); Ll.ellipse(lx - .4, d.y - d.side * .3, d.r * 1.05, d.r * .3, 0, 0, TAU);
    });
    any = true;
    if (d._L !== dg) RING.LD.push(d);
    d._L = dg; d._r = d.r;
  }
  if (any) { Ld.fill(); Ll.fill(); }
  if (decals.length < RING.n || RING.LD.length > decals.length) { // the sim culls decals 30 px off the left edge, and the oldest 240 past 1,800
    const LD = RING.LD;
    for (let i = LD.length - 1; i >= 0; i--) if (LD[i]._s !== f) { if (LD[i].wx - sc > -16) redo = true; LD[i] = LD[LD.length - 1]; LD.pop(); }
  }
  RING.n = decals.length;
  if (redo) { RING.key = null; return decalSync(sc, sp); } // one on screen went or a full drip grew: repaint from the live list (rare)
  ringBlit('dark'); ringBlit('light'); ringBlit('drip');
  return true;
}
/** the stuck-gib layer, brought up to date and blitted; true = the gib loop skips the gibs it holds (q._G === RING.gg) */
function stuckSync(A, pal) {
  if (!RING.L) return false;
  if (!RING.on || RING.sf !== RING.f) { // drawDecals drew live this frame (or didn't run): the layer goes stale
    if (RING.LG.length) { RING.gg++; RING.LG.length = 0; RING.L.gib.x.clearRect(0, 0, LW, H); }
    return false;
  }
  const sc = RING.sc, f = RING.f, G = RING.L.gib.x, LG = RING.LG;
  if (pal !== RING.pal) { RING.pal = pal; RING.gg++; LG.length = 0; G.clearRect(0, 0, LW, H); }
  const gg = RING.gg, out = [];
  for (const q of gibs) {
    q._s = f;
    const el = q.stuck && q.l >= 50 && q.k !== 'rope' && q.k !== 'eye' && q.k !== 'half';
    if (q._G === gg) { if (!el) q._G = 0; continue; }
    if (!el || q.x < -20 || q.x > W + 30) continue;
    if (q.cp !== pal) { q.cp = pal; q.cell = gibCell(q, pal); }
    const c = q.cell, k = c.r ? q.s / c.r : 1;
    q._wx = q.x + sc; q._gr = c.h * k / GIB_SS * 1.42 + 1;
    gibInto(G, A, q);
    q._G = gg; LG.push(q);
  }
  for (let i = LG.length - 1; i >= 0; i--) { const q = LG[i]; if (q._G !== gg || q._s !== f) { q._G = 0; out.push(q); LG[i] = LG[LG.length - 1]; LG.pop(); } }
  for (const q of out) { // erase a gib that left, where it shows, and paint back the neighbours it covered
    if (q._wx - sc + q._gr < -2) continue;
    const x0 = q._wx - q._gr - 1, n = Math.ceil(q._gr * 2 + 3), y0 = Math.floor(q.y - q._gr - 1), h = Math.ceil(q._gr * 2 + 3);
    const u0 = Math.floor(mod(x0 - RING.ph, LW));
    for (const a of [u0, u0 - LW]) {
      if (a + n < 0) continue;
      G.save();
      G.beginPath(); G.rect(a, y0, n, h); G.clip();
      G.clearRect(a, y0, n, h);
      for (const o of LG) if (Math.abs(o._wx - q._wx) < o._gr + q._gr + 3 && Math.abs(o.y - q.y) < o._gr + q._gr + 3) gibInto(G, A, o);
      G.restore();
    }
  }
  ctx.globalAlpha = 1;
  ringBlit('gib');
  return true;
}
/** one atlas gib into the stuck layer at its world x, drawn as the gib loop draws it (alpha 1: it is stuck and l >= 50) */
function gibInto(G, A, q) {
  const c = q.cell, k = c.r ? q.s / c.r : 1, cs = Math.cos(q.rot) * k / GIB_SS, sn = Math.sin(q.rot) * k / GIB_SS, d = c.h * 2;
  G.imageSmoothingEnabled = true;
  const t = G.getTransform();
  ringAt(q._wx, q._gr, (lx) => {
    G.setTransform(cs, sn, -sn, cs, lx, q.y);
    G.drawImage(A, c.x, c.y, d, d, -c.h, -c.h, d, d);
  });
  G.setTransform(t);
}

// --- terrain & backgrounds ---
