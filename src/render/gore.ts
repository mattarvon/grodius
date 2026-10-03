// @ts-nocheck
import { $ } from '../state';
import { C, DC, TAU, W, ctx } from '../core';
import { decals, drops, gibs, mists } from '../world';
import { drawSkull, poly } from '../render/util';
import { eye } from '../render/eyes';
import { DRAW } from '../render/enemies';

// --- gibs & gore ---
export function drawGibs() {
  for (const q of gibs) {
    const age = (q.ml || q.l) - q.l,
      a = Math.min(1, q.l / 50) * (q.stuck ? 1 : Math.max(.45, 1 - Math.max(0, age - 45) / 160));
    ctx.globalAlpha = a;
    if (q.k === 'rope') {
      const p = q.pts;
      ctx.lineJoin = 'round';
      for (const [w, c] of q.chain ? [[3.2, '#14181d'], [2, '#59646f'], [.8, '#b7c3cf']] : [[4, '#3e0c16'], [2.6, '#b0465a'], [1, '#ec95a3']]) {
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
    }
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    switch (q.k) {
      case 'chunk':
      case 'skin':
      case 'metal':
        ctx.fillStyle = q.k === 'skin' ? '#d29d8f' : q.col;
        poly(ctx, q.pts);
        if (q.k !== 'metal') {
          ctx.fillStyle = 'rgba(30,0,0,.35)';
          ctx.fillRect(-q.s * .5, q.s * .1, q.s, q.s * .4);
          ctx.fillStyle = 'rgba(255,180,160,.35)';
          ctx.fillRect(-q.s * .4, -q.s * .5, q.s * .4, 1);
        } else {
          ctx.fillStyle = '#9aa8b6';
          ctx.fillRect(-q.s * .5, -q.s * .4, q.s * .7, .8);
        }
        if (q.fat) {
          ctx.fillStyle = C.fat;
          ctx.beginPath();
          ctx.arc(q.s * .4, -q.s * .2, q.s * .35, 0, TAU);
          ctx.fill();
        }
        if (q.bn) {
          ctx.fillStyle = C.bone;
          ctx.fillRect(-q.s * .2, -.6, q.s * 1.3, 1.2);
        }
        break;
      case 'skull':
        drawSkull(ctx, 0, 0, q.s, 0);
        ctx.fillStyle = C.blood;
        ctx.fillRect(-q.s * .3, -q.s * 1.1, q.s * .5, q.s * .7);
        ctx.fillRect(q.s * .2, q.s * .3, .8, q.s * .8);
        break;
      case 'limb':
        {
          const L = q.s * 2.4;
          ctx.fillStyle = q.arm ? C.suit : '#2c3743';
          ctx.fillRect(-L / 2, -1.3, L, 2.6);
          ctx.fillStyle = '#55657a';
          ctx.fillRect(-L / 2, -1.3, L, .6);
          ctx.fillStyle = C.bloodD;
          ctx.fillRect(-L / 2 - 1.4, -1.6, 1.8, 3.2);
          ctx.fillStyle = C.blood;
          ctx.fillRect(-L / 2 - 1.1, -1.2, 1.2, 2.4);
          ctx.fillStyle = C.bone;
          ctx.fillRect(-L / 2 - 3.2, -.45, 2.4, .9);
          ctx.beginPath();
          ctx.arc(-L / 2 - 3.2, 0, .8, 0, TAU);
          ctx.fill();
          if (q.arm) {
            ctx.fillStyle = C.skin;
            ctx.fillRect(L / 2, -1.4, 2, 2.8);
            for (let k = 0; k < 3; k++) ctx.fillRect(L / 2 + 2, -1.3 + k * 1, 1.4, .7);
            ctx.fillRect(L / 2 + .4, -2.2, 1.2, .9);
          } else {
            ctx.fillStyle = q.boot ? '#14181d' : C.skin;
            ctx.fillRect(L / 2 - 1, -1.4, 2.4, 2.8);
            ctx.fillRect(L / 2 + .6, -1.4, 1.2, 4.4);
          }
          break;
        }
      case 'bone':
        ctx.fillStyle = C.bone;
        ctx.fillRect(-q.s, -.7, q.s * 2, 1.4);
        ctx.beginPath();
        ctx.arc(-q.s, -.6, 1, 0, TAU);
        ctx.arc(-q.s, .6, 1, 0, TAU);
        ctx.arc(q.s, 0, 1.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.blood;
        ctx.fillRect(q.s - 1.5, -.7, 1.5, 1.4);
        break;
      case 'tooth':
        ctx.fillStyle = C.bone;
        poly(ctx, [[-1, -1.4], [1, -1.4], [.4, 1.6], [-.4, 1.6]]);
        ctx.fillStyle = C.blood;
        ctx.fillRect(-1, -1.6, 2, .6);
        break;
      case 'eye':
        eye(ctx, 0, 0, q.s, {
          ang: q.rot,
          m: .6,
          iris: q.iris,
          bs: 2,
          fire: q.burning > 0,
          dil: 1.4
        });
        break;
      case 'half':
        {
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
          DRAW[e.k](ctx, e);
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
          break;
        }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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
  for (const m of mists) {
    ctx.fillStyle = `rgba(95,4,9,${.45 * m.l / m.ml})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
  }
}
export function drawDecals() {
  const sc = $.G.scroll;
  ctx.fillStyle = '#3a0306';
  ctx.beginPath();
  for (const d of decals) {
    const x = d.wx - sc;
    if (x < -20 || x > W + 20) continue;
    ctx.moveTo(x + d.r * 1.8, d.y);
    ctx.ellipse(x, d.y, d.r * 1.8, d.r * .6, 0, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = '#7d0a10';
  ctx.beginPath();
  for (const d of decals) {
    const x = d.wx - sc;
    if (x < -20 || x > W + 20) continue;
    ctx.moveTo(x + d.r, d.y - d.side * .3);
    ctx.ellipse(x - .4, d.y - d.side * .3, d.r * 1.05, d.r * .3, 0, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = '#6a0509';
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
