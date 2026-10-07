// @ts-nocheck
// Player weapon rendering. Every upgrade has to READ on screen: rounds get longer, fatter, hotter (blue -> gold -> crimson),
// SPLIT fans needles, ARC is a crackling piercing beam, MISSILES are chunky with smoke, PYRE lobs burning eyes.
// Player rounds stay out of the toxic-green band so enemy bullets always read. No ctx.filter, no per-pixel work.
import { $ } from '../state';
import { TAU, clamp, ctx, lerp, rr } from '../core';
import { LIGHTS, arcs, shots } from '../world';
import { SMOKE, RINGS } from '../fx/gunfx';
import { glow, light, poly } from './util';
import { eye } from './eyes';

/** rgb triplets by heat */
const COLD = '120,190,255', WARM = '255,200,110', HOT = '255,80,60';
function boltCol(s) {
  if (s.mirror) return '200,215,235';
  if (s.spore) return '255,170,200';
  if (s.rib) return '240,226,192';
  if (s.serr) return '255,70,70';
  if (s.seek) return '190,130,255';
  return s.dmg >= 1.8 ? HOT : s.dmg >= 1.2 ? WARM : COLD;
}
/** one bullet (called in the 'lighter' pass) */
export function boltDraw(s) {
  const cal = s.cal || 0,
    heat = clamp((s.dmg || 1) - 1, 0, 2),
    k = (s.fan ? .9 : 1) * (1 + heat * .3 + cal * .15),
    L = 8 * k + (s.fan ? 2 : 0),
    th = (s.fan ? 2 : 2.4) * (1 + heat * .2 + cal * .18),
    a = Math.atan2(s.vy, s.vx),
    col = boltCol(s);
  if (s.rip) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,140,170,.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, s.r * .35), s.r, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,245,.9)';
    ctx.lineWidth = .5;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.glob) {
    glow(s.x, s.y, 9, '240,215,150', .5);
    ctx.fillStyle = 'rgba(245,230,180,.9)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * .8, 0, TAU);
    ctx.fill();
    return;
  }
  // halo: grows with damage so a powered gun lights up the screen
  glow(s.x, s.y, 3 + th * 1.3, col, .3 + heat * .08);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(a);
  // trail: three fading slabs behind the round (longer for hotter rounds)
  const tl = L * (1 + heat * .6);
  ctx.fillStyle = `rgba(${col},.14)`;
  ctx.fillRect(-L / 2 - tl, -th * .35, tl, th * .7);
  ctx.fillStyle = `rgba(${col},.28)`;
  ctx.fillRect(-L / 2 - tl * .5, -th * .45, tl * .5, th * .9);
  // body
  ctx.fillStyle = `rgba(${col},.75)`;
  ctx.fillRect(-L / 2, -th / 2, L, th);
  ctx.fillStyle = '#fff6f0';
  ctx.fillRect(-L / 2 + 1, -Math.max(.5, th * .18), L - 2, Math.max(1, th * .36));
  // heavy rounds get a slug head
  if (cal >= 2 || heat >= .9) {
    ctx.fillStyle = `rgba(${col},.9)`;
    ctx.beginPath();
    ctx.arc(L / 2, 0, th * .5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(L / 2 - 1, -.5, 2, 1);
  }
  // FLAYED EDGE: barbs along the round
  if (s.serr) {
    ctx.fillStyle = 'rgba(255,200,190,.9)';
    for (let j = 0; j < 2 + s.serr; j++) {
      const bx = -L / 2 + 2 + j * (L - 3) / (1.5 + s.serr);
      poly(ctx, [[bx, -th / 2], [bx - 2.5, -th / 2 - 2], [bx + 1, -th / 2]]);
      poly(ctx, [[bx, th / 2], [bx - 2.5, th / 2 + 2], [bx + 1, th / 2]]);
    }
  }
  if (s.pierce) {
    ctx.fillStyle = '#f0e2c0';
    poly(ctx, [[L / 2, -th / 2], [L / 2 + 3 + cal, 0], [L / 2, th / 2]]);
  }
  ctx.restore();
  if (heat >= .9 && LIGHTS.length < 48) light(s.x, s.y, 14 + th * 2, .35);
}

/** ARC: a jagged crackling beam with a white-hot core; thicker with damage, flickers every frame */
function laserDraw(s) {
  const w = s.w || 1, x0 = s.x, x1 = s.x + s.len, y = s.y;
  ctx.fillStyle = `rgba(80,170,255,${.3 + .1 * w})`;
  ctx.fillRect(x0, y - 2.4 * w, s.len, 4.8 * w);
  // crackle: two jittered polylines
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? 'rgba(235,248,255,.95)' : 'rgba(120,200,255,.85)';
    ctx.lineWidth = pass ? .7 : 1.4 * w;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    const n = 6;
    for (let j = 1; j < n; j++) ctx.lineTo(lerp(x0, x1, j / n), y + rr(-2.2, 2.2) * w);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  // a stray fork now and then
  if (Math.random() < .35) {
    const fx = rr(x0, x1), fy = y + rr(-1, 1);
    ctx.strokeStyle = 'rgba(170,220,255,.7)';
    ctx.lineWidth = .6;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + rr(3, 7), fy + rr(-6, 6));
    ctx.stroke();
  }
  ctx.fillStyle = '#e6f6ff';
  ctx.fillRect(x0, y - .6 * w, s.len, 1.2 * w);
  glow(x1, y, 7 + 3 * w, '140,210,255', .7);
  if (LIGHTS.length < 50) light(x0 + s.len / 2, y, 26 + 6 * w, .5);
}

/** shot layer of drawWorld: smoke (under), glow pass, pyre eyes, missile bodies, rings */
export function drawShots() {
  // smoke under everything (normal blend)
  for (const p of SMOKE) {
    const f = p.l / p.ml;
    ctx.fillStyle = p.c ? `rgba(46,38,36,${.45 * f})` : `rgba(120,124,130,${.32 * f})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of shots) {
    if (s.k === 'laser') laserDraw(s);
    else if (s.k === 'missile') {
      // exhaust flame
      const fl = (s.lv > 1 ? 1.25 : 1) * rr(.8, 1.2), a = s.g ? (s.dir > 0 ? 0 : 0) : Math.atan2(s.vy, s.vx);
      const bx = s.x - Math.cos(a) * 6, by = s.y - Math.sin(a) * 6;
      glow(bx, by, 8 * fl, '255,140,40', .7);
      glow(bx, by, 3.5 * fl, '255,240,200', .9);
      if (LIGHTS.length < 50) light(s.x, s.y, 22, .5);
    } else if (s.k === 'pyre') {
      const big = s.lv > 1 ? 1.3 : 1;
      glow(s.x - 3, s.y, 15 * big, '255,90,20', .55);
      glow(s.x, s.y, 9 * big, '255,200,120', .7);
      light(s.x, s.y, 34 * big, .9);
    } else boltDraw(s);
  }
  for (const a of arcs) {
    const k = a.l / 9;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(255,230,220,${k})` : `rgba(255,90,70,${k})`;
      ctx.lineWidth = pass ? .5 : 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      for (let j = 1; j < 6; j++) {
        const f = j / 6;
        ctx.lineTo(lerp(a.x1, a.x2, f) + rr(-3, 3), lerp(a.y1, a.y2, f) + rr(-3, 3));
      }
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
    }
    glow(a.x2, a.y2, 6, '255,120,90', .6 * k);
    light(a.x2, a.y2, 20, .6 * k);
  }
  for (const r of RINGS) {
    const f = 1 - r.l / r.ml, rad = lerp(r.r0, r.r1, 1 - (1 - f) * (1 - f));
    ctx.strokeStyle = `rgba(${r.col},${.75 * (1 - f)})`;
    ctx.lineWidth = r.w * (1 - f * .6);
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const s of shots) if (s.k === 'pyre') {
    const big = s.lv > 1 ? 1.3 : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(255,120,30,.85)';
    for (let k = 0; k < 3 + (big > 1 ? 2 : 0); k++) {
      const fy = rr(-2.5, 2.5) * big;
      poly(ctx, [[-2, fy - 1.6], [(-9 - rr(0, 5)) * big, fy], [-2, fy + 1.6]]);
    }
    eye(ctx, 0, 0, 3.6 * big, {
      ang: s.rot,
      m: .9,
      iris: '#ff3a10',
      fire: 1,
      bs: 2.4,
      dil: .7
    });
    ctx.restore();
  }
  for (const s of shots) if (s.k === 'missile') {
    const m2 = s.lv > 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.g ? (s.dir > 0 ? 0 : 0) : Math.atan2(s.vy, s.vx));
    if (m2) ctx.scale(1.2, 1.2);
    // fins
    ctx.fillStyle = '#3a434d';
    poly(ctx, [[-5, -1.4], [-7.5, -3.6], [-3, -1.4]]);
    poly(ctx, [[-5, 1.4], [-7.5, 3.6], [-3, 1.4]]);
    // hull
    ctx.fillStyle = '#8a96a3';
    ctx.fillRect(-5, -1.6, 8, 3.2);
    ctx.fillStyle = '#c4ccd4';
    ctx.fillRect(-4, -1.6, 6, 1);
    // warhead: a red blood-cap nose
    ctx.fillStyle = '#c0121b';
    poly(ctx, [[3, -1.6], [6, 0], [3, 1.6]]);
    ctx.fillStyle = '#ff5050';
    ctx.fillRect(3, -.6, 1.4, 1.2);
    ctx.restore();
  }
}
