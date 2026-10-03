// @ts-nocheck
import { $ } from '../state';
import { C, TAU, W, ctx, rr } from '../core';
import { tentPts } from '../boss/update';
import { glow, light, poly } from '../render/util';
import { eye } from '../render/eyes';
import { drawCorpse } from '../render/enemies';

// --- boss ---
export function drawBoss(b) {
  const t = b.t;
  for (const tn of b.tent) {
    const pts = tentPts(b, tn);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        q = pts[i + 1],
        mx = (a.x + q.x) / 2,
        my = (a.y + q.y) / 2,
        an = Math.atan2(q.y - a.y, q.x - a.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(an);
      ctx.strokeStyle = i % 2 ? '#59646f' : '#2a3038';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (i % 2) ctx.ellipse(0, 0, 4.6, 2.4, 0, 0, TAU);else ctx.ellipse(0, 0, 4.6, .8, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const tip = pts[16],
      pr = pts[15],
      an = Math.atan2(tip.y - pr.y, tip.x - pr.x);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(an);
    ctx.strokeStyle = '#8c9aa8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(4, 3, 5, -Math.PI / 2, Math.PI * .7);
    ctx.stroke();
    ctx.fillStyle = '#8c9aa8';
    poly(ctx, [[1, 5.5], [-1.5, 2.5], [2, 3.5]]);
    ctx.fillStyle = '#8e3a32';
    ctx.beginPath();
    ctx.ellipse(6, 7, 3, 2, .4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.blood;
    ctx.fillRect(5, 6, 2, 4);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  const pulse = .5 + .5 * Math.sin(t * .06);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, 110, b.phase === 2 ? '200,10,20' : '120,10,20', .35 + pulse * .15);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.rotate(b.ra);
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#1a1f25';
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#64717e';
  ctx.beginPath();
  ctx.arc(0, 0, 62.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#07090b';
  ctx.beginPath();
  ctx.arc(0, 0, 53.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#3a444f';
  ctx.beginPath();
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * TAU;
    ctx.moveTo(Math.cos(a) * 55, Math.sin(a) * 55);
    ctx.lineTo(Math.cos(a) * (k % 4 ? 57 : 61), Math.sin(a) * (k % 4 ? 57 : 61));
  }
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    ctx.save();
    ctx.rotate(k * TAU / 8);
    ctx.fillStyle = '#262d35';
    poly(ctx, [[61, -6], [61, 6], [88, 0]]);
    ctx.strokeStyle = '#8c9aa8';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(61, -6);
    ctx.lineTo(88, 0);
    ctx.stroke();
    ctx.fillStyle = '#6a0a10';
    poly(ctx, [[78, -2.2], [88, 0], [78, 2.2]]);
    ctx.fillStyle = C.blood;
    ctx.fillRect(74, 1, 1, 4);
    if (k % 3 === 0) {
      ctx.save();
      ctx.translate(72, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(.55, .55);
      drawCorpse(ctx, {
        twitch: 0,
        noLeg: k === 3,
        noArm: 0,
        cap: 0
      });
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(b.rb);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#232a32';
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#5b6773';
  ctx.beginPath();
  ctx.arc(0, 0, 44.5, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.rotate(k * TAU / 4);
    ctx.fillStyle = '#14181d';
    ctx.fillRect(25, -3, 22, 6);
    ctx.fillStyle = '#4e5965';
    ctx.fillRect(25, -3, 22, 1);
    ctx.fillStyle = '#9aa8b6';
    ctx.fillRect(30, 0, 1, 1);
    ctx.fillRect(40, 0, 1, 1);
    ctx.restore();
  }
  ctx.restore();
  // core: black liquid
  const g = ctx.createRadialGradient(-7, -7, 1, 0, 0, 26);
  g.addColorStop(0, '#3a4654');
  g.addColorStop(.35, '#0c1015');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,180,210,.18)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(t * .03 + k) * 2, Math.cos(t * .025 + k) * 2, 6 + k * 4.5 + Math.sin(t * .07 + k) * 1.4, 5 + k * 4.2, t * .004 * k, 0, TAU);
    ctx.stroke();
  }
  if (b.fl) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, TAU);
    ctx.fill();
  }
  if (b.eye > .02) {
    const op = b.eye,
      a = Math.atan2($.P.y - b.y, $.P.x - b.x);
    eye(ctx, 0, 0, 16, {
      ang: a,
      m: .7,
      iris: b.phase === 2 ? '#ff2a1a' : '#b0101a',
      bs: 2.2,
      slit: 1,
      dil: b.laser && b.laser.tel > 0 ? .55 : 1.1,
      blink: 1 - op,
      lid: '#3a0a0c',
      fire: b.phase === 2
    });
    ctx.strokeStyle = '#6e2b26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 13 * op, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  for (const p of b.plates) {
    if (p.hp <= 0) continue;
    const px = b.x + Math.cos(p.a) * 42,
      py = b.y + Math.sin(p.a) * 42;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.a);
    if (p.f) ctx.filter = 'brightness(2.4)';
    ctx.fillStyle = '#3a0f0c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9a4335';
    ctx.beginPath();
    ctx.ellipse(-.5, 0, 6.5, 13.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.fat;
    ctx.beginPath();
    ctx.ellipse(2, -4, 2, 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9aa8b6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(-3, k * 5);
      ctx.lineTo(3, k * 5);
    }
    ctx.stroke();
    const dmg = 1 - p.hp / p.max;
    if (dmg > .3) {
      ctx.fillStyle = C.blood;
      ctx.fillRect(-3, -8, 3, 6);
    }
    if (dmg > .6) {
      ctx.fillStyle = C.bone;
      ctx.fillRect(-1, 2, 4, 1);
      ctx.fillStyle = C.bloodL;
      ctx.fillRect(-4, 4, 2, 5);
    }
    ctx.restore();
  }
  light(b.x, b.y, 120, .8);
  if (b.laser) {
    const L = b.laser,
      ca = Math.cos(L.ang),
      sa = Math.sin(L.ang),
      ex = b.x + ca * 600,
      ey = b.y + sa * 600;
    if (L.tel > 0) {
      ctx.strokeStyle = `rgba(255,40,40,${.3 + .5 * (($.T >> 1) % 2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,30,30,.45)';
      ctx.lineWidth = 14 + rr(-2, 2);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,190,.95)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'butt';
      for (let i = 0; i < 40; i += 8) light(b.x + ca * i * 12, b.y + sa * i * 12, 40, .9);
    }
  }
  if (!b.dying) {
    const w = 180;
    ctx.fillStyle = '#1a0204';
    ctx.fillRect(W / 2 - w / 2, 16, w, 3);
    const pl = b.plates.reduce((s, p) => s + Math.max(0, p.hp), 0),
      pm = b.plates.reduce((s, p) => s + p.max, 0);
    ctx.fillStyle = C.bloodL;
    ctx.fillRect(W / 2 - w / 2, 16, w * Math.max(0, b.hp / b.max), 3);
    if (pl > 0) {
      ctx.fillStyle = '#9fb0c2';
      ctx.fillRect(W / 2 - w / 2, 20, w * pl / pm, 1);
    }
  }
}

// --- gibs & gore ---
