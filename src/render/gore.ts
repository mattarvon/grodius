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

// --- gibs & gore ---
const ROPE_GUT = [[4, '#3e0c16'], [2.6, '#b0465a'], [1, '#ec95a3']], ROPE_CHAIN = [[3.2, '#14181d'], [2, '#59646f'], [.8, '#b7c3cf']];
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
  let baked = false;
  for (const q of gibs) {
    const age = (q.ml || q.l) - q.l,
      a = Math.min(1, q.l / 50) * (q.stuck ? 1 : Math.max(.45, 1 - Math.max(0, age - 45) / 160));
    ctx.globalAlpha = a;
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
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    drawHalf(q);
    ctx.restore();
  }
  if (baked) { ctx.imageSmoothingEnabled = false; ctx.setTransform(m); }
  ctx.globalAlpha = 1;
}
/** a split corpse: its body clipped along the jagged tear, then the wet edge. The body is live art, so it can't bake */
function drawHalf(q) {
  const e = q.e;
  ctx.save();
  ctx.beginPath();
  const J = q.jag,
    side = q.side,
    R2 = e.r * 2.4;
  ctx.moveTo(-R2, 0);
  for (const [x, y] of J) ctx.lineTo(x * e.r / 12, y);
  ctx.lineTo(R2, 0);
  ctx.lineTo(R2, side * R2);
  ctx.lineTo(-R2, side * R2);
  ctx.closePath();
  ctx.clip();
  ctx.translate(0, -side * 3);
  $.EYE_LOW = 1;
  if (e.host && isCross(e)) { const T = HOST_TINT[e.host]; drawMidCross(ctx, e, DRAW[e.k], T.rgb, T.a); } // a crossover's halves keep its host tint
  else DRAW[e.k](ctx, e);
  $.EYE_LOW = 0;
  ctx.restore();
  ctx.strokeStyle = '#5a050a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(J[0][0] * e.r / 12, J[0][1]);
  for (const [x, y] of J) ctx.lineTo(x * e.r / 12, y);
  ctx.stroke();
  ctx.strokeStyle = C.bloodL;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.bone;
  ctx.fillRect(-1, -.5, 2, 1);
}
export function drawDrops() {
  ctx.lineCap = 'butt';
  for (let c = 0; c < DC.length; c++) for (const big of [0, 1]) {
    ctx.strokeStyle = DC[c];
    ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath();
    let any = false;
    for (const d of drops) {
      if (d.c !== c || d.s >= 1.6 !== !!big) continue;
      any = true;
      ctx.moveTo(d.px, d.py);
      ctx.lineTo(d.x + .5, d.y + .5);
    }
    if (any) ctx.stroke();
  }
}
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
