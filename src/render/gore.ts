// @ts-nocheck
import { $ } from '../state';
import { C, DC, TAU, W, ctx } from '../core';
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
  let baked = false, la = -1;
  for (const q of gibs) {
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
  ctx.fillStyle = sp ? sp[2] : '#6a0509';
  for (const d of decals) {
    if (d.side > 0 || d.r < 1.6) continue;
    const x = d.wx - sc;
    if (x < -5 || x > W + 5) continue;
    const len = Math.min(d.r * 4, ($.T - d.t) * .05);
    ctx.fillRect(x - .5, d.y, 1, len);
    ctx.fillRect(x - 1, d.y + len - 1, 2, 2);
  }
}

// --- terrain & backgrounds ---
