// @ts-nocheck
import { $ } from '../state';
import { C, FONT_D, PH, TAU, W, clamp, ctx, rr, sstep } from '../core';
import { drawChain, poly, txt } from '../render/util';
import { drawEShots } from '../render/hud';

// --- hype man: SGT. RAMROD SLAB ---
export function drawSlab(c, jaw, t) {
  const sk = '#b97648',
    skD = '#7e4a2a',
    skL = '#dba070';
  // torso + traps
  c.fillStyle = skD;
  poly(c, [[-56, 2], [-48, -38], [-20, -52], [20, -52], [48, -38], [56, 2]]);
  c.fillStyle = sk;
  poly(c, [[-52, 2], [-45, -37], [-19, -49], [19, -49], [45, -37], [50, 2]]);
  c.strokeStyle = skD;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-30, -26);
  c.quadraticCurveTo(-12, -14, 0, -26);
  c.quadraticCurveTo(12, -14, 30, -26);
  c.moveTo(0, -26);
  c.lineTo(0, -2);
  for (let k = 0; k < 3; k++) {
    c.moveTo(-8, -8 + k * -0);
    c.moveTo(-9, -10 + k * 5);
    c.lineTo(-2, -10 + k * 5);
    c.moveTo(2, -10 + k * 5);
    c.lineTo(9, -10 + k * 5);
  }
  c.stroke();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(-20, -36, 8, 3, -.3, 0, TAU);
  c.ellipse(18, -36, 8, 3, .3, 0, TAU);
  c.fill();
  // spiked leather pad + chain bandolier
  c.fillStyle = '#161112';
  c.beginPath();
  c.ellipse(-40, -40, 18, 11, -.35, 0, TAU);
  c.fill();
  c.fillStyle = '#3a2e2c';
  c.beginPath();
  c.ellipse(-42, -43, 13, 5, -.35, 0, TAU);
  c.fill();
  c.fillStyle = '#cfd8e0';
  for (let k = 0; k < 4; k++) {
    const x = -54 + k * 8,
      y = -46 - k * 2.5;
    poly(c, [[x - 2.2, y + 3], [x, y - 6], [x + 2.2, y + 3]]);
  }
  drawChain(c, -40, -30, 34, 4, 1.6);
  // flexed right arm
  c.strokeStyle = skD;
  c.lineCap = 'round';
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(38, -40);
  c.lineTo(58, -46);
  c.lineTo(52, -82);
  c.stroke();
  c.strokeStyle = sk;
  c.lineWidth = 13;
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = sk;
  c.beginPath();
  c.ellipse(49, -52, 11, 9, -.3, 0, TAU);
  c.fill();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(46, -56, 5, 3, -.3, 0, TAU);
  c.fill();
  c.strokeStyle = '#5a7090';
  c.lineWidth = .8;
  c.beginPath();
  c.moveTo(42, -50);
  c.quadraticCurveTo(48, -47, 55, -53);
  c.stroke();
  c.fillStyle = '#c3121c';
  c.fillRect(46, -78, 13, 5);
  c.fillStyle = '#ffd23a';
  c.fillRect(46, -78, 13, 1);
  c.fillStyle = sk;
  c.beginPath();
  c.arc(52, -87, 8, 0, TAU);
  c.fill();
  c.strokeStyle = skD;
  c.lineWidth = 1;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    c.moveTo(46 + k * 3.5, -92);
    c.lineTo(46 + k * 3.5, -86);
  }
  c.stroke();
  // neck
  c.fillStyle = sk;
  c.fillRect(-14, -66, 28, 18);
  c.strokeStyle = '#8a4a30';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-8, -64);
  c.lineTo(-10, -50);
  c.moveTo(8, -64);
  c.lineTo(11, -50);
  c.stroke();
  // head
  c.fillStyle = sk;
  c.beginPath();
  c.ellipse(0, -82, 17, 20, 0, 0, TAU);
  c.fill();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(-6, -96, 7, 4, -.3, 0, TAU);
  c.fill();
  c.strokeStyle = '#5a2a1a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(4, -100);
  c.lineTo(13, -89);
  for (let k = 0; k < 4; k++) {
    const f = k / 3,
      x = 4 + 9 * f,
      y = -100 + 11 * f;
    c.moveTo(x - 2, y + 1.5);
    c.lineTo(x + 2, y - 1.5);
  }
  c.stroke();
  // mutton chops
  c.fillStyle = '#2e1a10';
  poly(c, [[-17, -86], [-12, -84], [-9, -68], [-14, -62], [-18, -72]]);
  poly(c, [[17, -86], [12, -84], [9, -68], [14, -62], [18, -72]]);
  // chrome visor
  c.fillStyle = '#0d0f12';
  c.fillRect(-19, -91, 38, 9);
  const g = c.createLinearGradient(-16, -90, 16, -83);
  g.addColorStop(0, '#5fd0ff');
  g.addColorStop(.5, '#e8f6ff');
  g.addColorStop(1, '#2a6cff');
  c.fillStyle = g;
  c.fillRect(-15, -89.5, 13, 6);
  c.fillRect(2, -89.5, 13, 6);
  const gl = t * .08 % 3 - 1;
  c.fillStyle = 'rgba(255,255,255,.9)';
  c.fillRect(-15 + gl * 14, -89.5, 2, 6);
  c.fillRect(2 + gl * 14, -89.5, 2, 6);
  // yelling mouth
  const mh = 4 + jaw * 6;
  c.fillStyle = '#2a0606';
  c.beginPath();
  c.ellipse(0, -69, 8, mh, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.bone;
  c.fillRect(-6, -69 - mh + 1, 12, 2.2);
  c.fillRect(-5, -69 + mh - 2.6, 10, 1.8);
  c.fillStyle = '#b83a3a';
  c.beginPath();
  c.ellipse(0, -69 + mh * .45, 4.5, mh * .35, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = '#2e1a10';
  for (let k = -3; k <= 3; k++) c.fillRect(k * 2.4 - .5, -69 + mh + 1.5, 1, 1.2);
}
export function drawBabe() {
  const b = $.G.babe;
  if (!b) return;
  const age = b.ml - b.t,
    x = -40 + age * (W + 80) / b.ml,
    y = b.y + Math.sin(age * .07) * 4,
    wave = Math.sin(age * .3);
  ctx.save();
  ctx.globalAlpha = .92 * Math.min(1, b.t / 20, age / 10);
  // 80s neon trail
  ctx.globalCompositeOperation = 'lighter';
  for (const [c, o] of [['255,60,170', -2], ['60,220,255', 1], ['255,200,60', 4]]) {
    ctx.fillStyle = `rgba(${c},.55)`;
    ctx.fillRect(x - 60, y + o, 52, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(x, y);
  // surfboard
  ctx.fillStyle = '#ff3fa4';
  ctx.beginPath();
  ctx.ellipse(0, 1, 15, 2.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-12, .6, 24, .8);
  ctx.fillStyle = '#3cdcff';
  ctx.fillRect(-4, -.2, 8, .6);
  const sk = '#e39a62',
    skD = '#b46a3a';
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = skD;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-1, -14);
  ctx.lineTo(-4, -1);
  ctx.moveTo(1, -14);
  ctx.lineTo(4, -1);
  ctx.stroke();
  ctx.strokeStyle = sk;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // torso
  ctx.fillStyle = sk;
  ctx.beginPath();
  ctx.ellipse(0, -19, 3, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skD;
  ctx.fillRect(1.6, -23, 1, 8);
  // bikini (full top + bottoms)
  ctx.fillStyle = '#ff2a6a';
  poly(ctx, [[-3, -15.5], [3, -15.5], [1.5, -13], [-1.5, -13]]);
  ctx.fillRect(-3, -21.5, 6, 2.2);
  ctx.fillStyle = '#ff8ab8';
  ctx.fillRect(-2.5, -21.5, 5, .6);
  // arms: one on hip, one waving
  ctx.strokeStyle = sk;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2.5, -23);
  ctx.lineTo(-5, -18);
  ctx.lineTo(-2.6, -15.5);
  ctx.moveTo(2.5, -23);
  ctx.lineTo(6, -27);
  ctx.lineTo(7 + wave * 1.5, -32);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // head, shades, big blonde hair blowing back
  ctx.fillStyle = '#ffe060';
  poly(ctx, [[-2, -31], [-11, -27 + wave * .6], [-9, -24], [-3, -25], [0, -28]]);
  ctx.beginPath();
  ctx.arc(0, -28.5, 3.4, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = sk;
  ctx.beginPath();
  ctx.arc(.6, -27.5, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(.4, -28.6, 3.4, 1.2);
  ctx.fillStyle = '#d0205a';
  ctx.fillRect(2, -25.8, 1.2, .7);
  ctx.fillStyle = '#fff3a0';
  ctx.fillRect(-1, -31.5, 2, .8);
  ctx.restore();
  // speech bubble
  if (age > 20 && b.t > 15) {
    const bx = clamp(x + 10, 6, W - 112),
      by = y - 46;
    ctx.save();
    ctx.globalAlpha = .92;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, 104, 12);
    ctx.fillStyle = '#ff2a6a';
    ctx.fillRect(bx, by, 104, 1);
    ctx.fillRect(bx, by + 11, 104, 1);
    poly(ctx, [[clamp(x + 6, bx + 4, bx + 100), by + 12], [clamp(x + 2, bx, bx + 96), by + 18], [clamp(x + 12, bx + 8, bx + 104), by + 12]]);
    txt('EXCELLENT WORK, BABY!', bx + 52, by + 3, '#d0205a', 'center', 7);
    ctx.restore();
  }
  // bullets stay on top
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 70, y - 50, 190, 62);
  ctx.clip();
  ctx.translate($.G.shx || 0, $.G.shy || 0);
  drawEShots();
  ctx.restore();
}
export function drawHype() {
  const h = $.G.hype;
  if (!h) return;
  const age = h.ml - h.t,
    inT = sstep(0, 12, age),
    outT = sstep(0, 16, h.t),
    off = (1 - inT) * 150 + (1 - outT) * 150;
  const px = W - 70 + off,
    py = PH,
    pw = 128,
    ph = 112;
  const shake = age < 40 ? rr(-1.5, 1.5) : 0,
    jaw = age < 70 ? .6 + .4 * Math.abs(Math.sin(age * .35)) : .2;
  // whole splash shrunk to a small top-right corner badge so it never hides the playfield
  const HS = .38;
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.translate(W - 2, 16);
  ctx.scale(HS, HS);
  ctx.translate(-W, -(PH - ph - 8));
  // panel with rays
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px - pw / 2 + 10, py - ph);
  ctx.lineTo(px + pw / 2, py - ph - 6);
  ctx.lineTo(px + pw / 2, py);
  ctx.lineTo(px - pw / 2, py);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#4e0307';
  ctx.fillRect(px - pw / 2, py - ph - 8, pw, ph + 8);
  ctx.save();
  ctx.translate(px, py - 48);
  ctx.rotate($.T * .015);
  for (let k = 0; k < 16; k++) {
    ctx.fillStyle = k % 2 ? '#ffb000' : '#c3121c';
    const a = k / 16 * TAU,
      b2 = (k + 1) / 16 * TAU;
    poly(ctx, [[0, 0], [Math.cos(a) * 150, Math.sin(a) * 150], [Math.cos(b2) * 150, Math.sin(b2) * 150]]);
  }
  ctx.restore();
  ctx.translate(px + shake, py + shake * .5);
  drawSlab(ctx, jaw, $.T);
  ctx.restore();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(px - pw / 2 + 10, py - ph);
  ctx.lineTo(px + pw / 2, py - ph - 6);
  ctx.lineTo(px + pw / 2, py);
  ctx.lineTo(px - pw / 2, py);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.fillRect(px - pw / 2 + 8, py - 12, 78, 10);
  txt('SGT. RAMROD SLAB', px - pw / 2 + 12, py - 10, '#ffd23a', 'left', 7);
  // burst bubble
  const pop = 1 + (1 - sstep(0, 8, age)) * .7,
    cx = px - pw / 2 - 74 + off * .3,
    cy = py - ph + 28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.rotate(-.05);
  ctx.globalAlpha = .9 * outT;
  const pts = [];
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * TAU,
      r = k % 2 ? 1 : 1.22;
    pts.push([Math.cos(a) * 76 * r, Math.sin(a) * 30 * r]);
  }
  ctx.fillStyle = '#000';
  ctx.save();
  ctx.translate(3, 3);
  poly(ctx, pts);
  ctx.restore();
  ctx.fillStyle = '#fff3c4';
  poly(ctx, pts);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts) ctx.lineTo(q[0], q[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#fff3c4';
  poly(ctx, [[52, 14], [86, 30], [58, 4]]);
  ctx.beginPath();
  ctx.moveTo(52, 14);
  ctx.lineTo(86, 30);
  ctx.lineTo(58, 4);
  ctx.stroke();
  const fit = (str, sz) => {
    ctx.font = `${sz}px ${FONT_D}`;
    const w = ctx.measureText(str).width;
    return w > 132 ? sz * 132 / w : sz;
  };
  const s1 = fit(h.L[0], 20),
    s2 = fit(h.L[1], 22);
  txt(h.L[0], 1, -22, '#1a0003', 'center', s1, FONT_D);
  txt(h.L[1], 2, -1, '#000', 'center', s2, FONT_D);
  txt(h.L[1], 1, -2, '#c3121c', 'center', s2, FONT_D);
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = 1;
  // enemy fire always wins: redraw bullets over the badge
  ctx.save();
  ctx.beginPath();
  ctx.rect(W - 130, 12, 130, 60);
  ctx.clip();
  ctx.translate($.G.shx || 0, $.G.shy || 0);
  drawEShots();
  ctx.restore();
}

// --- HUD ---
