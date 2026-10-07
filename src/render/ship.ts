// @ts-nocheck
import { $ } from '../state';
import { boltDraw } from './bullets';
import { TAU, ctx, dist2 } from '../core';
import { lv } from '../save';
import { enemies } from '../world';
import { spark } from '../fx/spawn';
import { gmL } from '../mutations';
import { glow, light, poly } from '../render/util';
import { eye } from '../render/eyes';

// --- player ship & helpers ---
export function shipLoad() {
  let tier = 0;
  for (const k in $.meta.lv) tier += $.meta.lv[k] || 0;
  if ($.P && $.P.missile != null && ($.state === 'play' || $.state === 'pause' || $.state === 'over')) return {
    spd: $.P.speed,
    mis: $.P.missile,
    dbl: $.P.double,
    las: $.P.laser,
    pyre: $.P.pyre,
    shd: $.P.shield > 0,
    tier,
    game: 1
  };
  return {
    spd: 0,
    mis: 0,
    dbl: 0,
    las: 0,
    pyre: 0,
    shd: false,
    tier,
    game: 0
  };
}
export const IRIS_T = ['#c0141c', '#e05a10', '#e8b818', '#b23cff'];
export function drawShip(c, x, y, bank, s = 1, eng = 1, ld) {
  ld = ld || shipLoad();
  const tier = ld.tier,
    mini = s < .6,
    beat = Math.pow(Math.max(0, Math.sin($.T * .16)), 6),
    fire = ld.game && $.P && $.P.cd > 3;
  let look = Math.sin($.T * .021) * .5;
  if (ld.game && !mini) {
    let bd = 1e9;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, x, y);
      if (d < bd && e.x > x - 20) {
        bd = d;
        look = Math.atan2(e.y - y, e.x - x);
      }
    }
  }
  const irisC = IRIS_T[Math.min(3, tier / 5 | 0)];
  c.save();
  c.translate(x, y);
  c.scale(s, s * (1 - Math.abs(bank) * .07));
  // bile engine + sinew tendrils
  if (eng) {
    const f = .75 + Math.random() * .4,
      L = 1 + ld.spd * .18;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,70,30,.45)';
    c.beginPath();
    c.ellipse(-16 * L, 0, 9 * f * L, 3, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,200,140,.9)';
    c.beginPath();
    c.ellipse(-13.5, 0, 3.8 * f, 1.3, 0, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  if (!mini) {
    const n = 2 + Math.min(ld.spd, 4),
      len = 7 + ld.spd * 2.2;
    c.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const by = (k / (n - 1) - .5) * 6,
        ph = $.T * .18 + k * 1.7;
      let px = -11,
        py = by;
      for (let j = 1; j <= 4; j++) {
        const nx = -11 - j * len / 4,
          ny = by * (1 + j * .35) + Math.sin(ph - j * .9) * j * .9;
        c.strokeStyle = j < 3 ? '#3a1012' : '#6e2226';
        c.lineWidth = 2.2 - j * .45;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(nx, ny);
        c.stroke();
        px = nx;
        py = ny;
      }
    }
    c.lineCap = 'butt';
  }
  // ventral + dorsal bone spikes (grow with permanent grafts)
  const ty = x0 => -5.6 + Math.pow((x0 + 3) / 9, 2) * 2;
  const nsp = 2 + Math.min(7, tier * .42 | 0);
  for (let k = 0; k < nsp; k++) {
    const sx = -9 + k * (14 / Math.max(1, nsp - 1)),
      h = 2.6 + tier * .13 + k % 2 * 1.3 + Math.sin($.T * .05 + k) * .2,
      b = ty(sx) + .6;
    c.fillStyle = '#5e5040';
    poly(c, [[sx - 1.2, b], [sx + 1, b], [sx - 1.8 - h * .45, b - h]]);
    c.fillStyle = '#d8c8a4';
    poly(c, [[sx - 1.2, b], [sx - .1, b], [sx - 1.8 - h * .45, b - h]]);
  }
  if (tier >= 5) for (let k = 0; k < 3; k++) {
    const sx = -7 + k * 5,
      h = 1.8 + tier * .08,
      b = -ty(sx) - .6;
    c.fillStyle = '#b8a888';
    poly(c, [[sx - 1, b], [sx + 1, b], [sx - 1.6 - h * .4, b + h]]);
  }
  if (tier >= 10) {
    c.strokeStyle = '#cbb995';
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    for (const sg of [-1, 1]) {
      c.beginPath();
      c.moveTo(4, sg * 4.4);
      c.quadraticCurveTo(-2, sg * (9 + tier * .15), -9, sg * (8 + tier * .2));
      c.stroke();
    }
    c.lineCap = 'butt';
  }
  // missile egg-sacs
  for (let m = 0; m < ld.mis; m++) {
    const mx = -2 - m * 5.5,
      my = 5.4 + m * .4;
    c.strokeStyle = '#3a1012';
    c.lineWidth = .8;
    c.beginPath();
    c.moveTo(mx, 3.5);
    c.lineTo(mx, my);
    c.stroke();
    c.fillStyle = '#4e1416';
    c.beginPath();
    c.ellipse(mx, my + 1.6, 3.2, 1.9, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#8a2a24';
    c.beginPath();
    c.ellipse(mx - .4, my + 1.1, 2.2, .9, 0, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,170,60,${.5 + .5 * Math.sin($.T * .2 + m)})`;
    c.beginPath();
    c.arc(mx + 2.6, my + 1.6, .9, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  // carapace hull
  c.fillStyle = '#0a0404';
  c.beginPath();
  c.moveTo(-12.5, -3.4);
  c.quadraticCurveTo(-6, -8.2, 2, -6.6);
  c.quadraticCurveTo(9.5, -5, 15.6, -.7);
  c.lineTo(15.6, .7);
  c.quadraticCurveTo(9.5, 5.4, 2, 6);
  c.quadraticCurveTo(-6, 7, -12.5, 3.4);
  c.closePath();
  c.fill();
  c.fillStyle = '#5e4236';
  c.beginPath();
  c.moveTo(-12, -3);
  c.quadraticCurveTo(-6, -7.5, 2, -6);
  c.quadraticCurveTo(9, -4.5, 15, -.6);
  c.lineTo(15, .6);
  c.quadraticCurveTo(9, 5, 2, 5.5);
  c.quadraticCurveTo(-6, 6.5, -12, 3);
  c.closePath();
  c.fill();
  c.fillStyle = '#8c6c58';
  c.beginPath();
  c.moveTo(-11, -3);
  c.quadraticCurveTo(-5, -7, 2, -5.6);
  c.quadraticCurveTo(8, -4.3, 13.5, -1.2);
  c.quadraticCurveTo(2, -3, -11, -1);
  c.closePath();
  c.fill();
  // exposed belly meat with pulsing veins
  const mR = 110 + beat * 70 | 0;
  c.fillStyle = `rgb(${mR},${26 + beat * 14 | 0},${30})`;
  c.beginPath();
  c.moveTo(-11, 1.2);
  c.quadraticCurveTo(-2, 7, 11, 2);
  c.lineTo(13, .8);
  c.quadraticCurveTo(0, 2.6, -11, 1.2);
  c.fill();
  c.strokeStyle = `rgba(${200 + beat * 55 | 0},40,50,.8)`;
  c.lineWidth = .45;
  c.beginPath();
  c.moveTo(-9, 2);
  c.quadraticCurveTo(-5, 4.6, -1, 3.3);
  c.quadraticCurveTo(3, 4.4, 8, 2.6);
  c.moveTo(-5, 3.6);
  c.lineTo(-4, 5);
  c.moveTo(2, 3.8);
  c.lineTo(3, 5.1);
  c.stroke();
  // heart glowing through the ribs
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(255,40,30,${.35 + beat * .5})`;
  c.beginPath();
  c.ellipse(-3.5, -1.4, 3.4 + beat, 2.4 + beat * .6, 0, 0, TAU);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  // ribs
  c.strokeStyle = '#8c7b66';
  c.lineWidth = .9;
  for (let i = 0; i < 5; i++) {
    const rx = -10 + i * 3.6;
    c.beginPath();
    c.moveTo(rx, ty(rx) + .8);
    c.quadraticCurveTo(rx + 2.2, -3, rx + 1.2, .2);
    c.stroke();
  }
  c.strokeStyle = '#d8c8a4';
  c.lineWidth = .6;
  c.beginPath();
  c.moveTo(-11, -3.8);
  c.quadraticCurveTo(-4, -7, 4, -5.5);
  c.quadraticCurveTo(9, -4.2, 13, -1.6);
  c.stroke();
  // WARD: chitin armour plates
  if (ld.shd) {
    c.fillStyle = 'rgba(200,190,160,.85)';
    for (let i = 0; i < 3; i++) {
      const px = -7 + i * 5;
      c.beginPath();
      c.ellipse(px, ty(px) + 1.4, 2.8, 1.3, -.25, Math.PI, TAU);
      c.fill();
    }
  }
  // mandibles
  const op = fire ? 1.3 : .35 + .25 * Math.sin($.T * .09);
  c.fillStyle = '#d8c8a4';
  poly(c, [[11, -2.6], [19.5, -1.4 - op], [17.5, -.6], [13, -.6]]);
  poly(c, [[11, 2.6], [19, 1.2 + op], [17, .6], [13, .6]]);
  c.fillStyle = '#2a0507';
  c.fillRect(13, -.6, 5, 1.2);
  c.fillStyle = '#f0e6d0';
  for (let k = 0; k < 3; k++) {
    c.fillRect(13.5 + k * 1.6, -.6, .6, .7);
    c.fillRect(14.2 + k * 1.6, 0, .6, .6);
  }
  // SPLIT: dorsal horn cannon
  if (ld.dbl) {
    c.strokeStyle = '#cbb995';
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(3, -5.4);
    c.quadraticCurveTo(7, -7, 10.5, -10);
    c.stroke();
    c.lineCap = 'butt';
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,120,80,.9)';
    c.beginPath();
    c.arc(10.8, -10.2, 1.1 + (fire ? .8 : 0), 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  // ARC: crackling nerve spine
  if (ld.las) {
    c.fillStyle = '#cbb995';
    poly(c, [[15, -.7], [24, 0], [15, .7]]);
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(140,200,255,.9)';
    c.lineWidth = .5;
    c.beginPath();
    c.moveTo(15, 0);
    for (let k = 1; k <= 5; k++) c.lineTo(15 + k * 1.8, (Math.random() - .5) * 2.2);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  }
  // PYRE: burning eyes on tail stalks
  for (let p = 0; p < ld.pyre; p++) {
    const sg = p ? 1 : -1,
      ex = -9,
      ey = sg * 7.4;
    c.strokeStyle = '#4a1416';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-7, sg * 3.4);
    c.quadraticCurveTo(-7, sg * 6, ex, ey);
    c.stroke();
    if (!mini) for (let k = 0; k < 2; k++) {
      c.fillStyle = 'rgba(255,120,30,.8)';
      const fy = ey + (Math.random() - .5) * 2;
      poly(c, [[ex - 1, fy - 1], [ex - 5 - Math.random() * 4, fy], [ex - 1, fy + 1]]);
    }
    eye(c, ex, ey, 1.9, {
      ang: look,
      iris: '#ff3a10',
      fire: 1,
      bs: 2,
      dil: .7
    });
  }
  // clustered extra eyes (one per two permanent grafts)
  const EP = [[-1, -3.8, 1.25], [-6.5, -3, 1.1], [3, -4, 1.05], [-4, 3.6, 1], [-9.5, -1.4, .95], [1.5, 3.8, 1], [-8, 2.4, .9], [5.6, 2.6, .9], [-3, -5.6, .85]];
  const ne = Math.min(EP.length, tier / 2 | 0);
  for (let i = 0; i < ne; i++) {
    const [ex, ey, er] = EP[i],
      bl = ($.T + i * 53) % (160 + i * 17) < 5 ? 1 : 0;
    eye(c, ex, ey, er, {
      ang: look,
      iris: irisC,
      bs: 1.4,
      blink: bl,
      lid: '#4a1818'
    });
  }
  // the main eye
  const blM = ($.T + 31) % 220 < 6 ? 1 : 0;
  eye(c, 7, -1.8, 2.9, {
    ang: look,
    iris: irisC,
    bs: 1.2 + tier * .06,
    blink: blM,
    lid: '#3a1414',
    dil: fire ? .7 : 1,
    fire: tier >= 15
  });
  if (!mini) {
    c.globalCompositeOperation = 'lighter';
    const gc = tier >= 15 ? '180,60,255' : '255,60,40';
    c.fillStyle = `rgba(${gc},.18)`;
    c.beginPath();
    c.arc(7, -1.8, 4.4, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  // blood drip from a fully grafted hull
  if (tier >= 14 && !mini) {
    c.fillStyle = '#8a0610';
    for (let k = 0; k < 3; k++) {
      const dx = -6 + k * 5,
        dd = ($.T * .25 + k * 7) % 9;
      c.fillRect(dx, 4.6 + dd * .4, .8, dd * .6);
      c.beginPath();
      c.arc(dx + .4, 4.8 + dd, .6, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}
/** player round: drawing lives in render/bullets.ts (scales with damage/caliber/graft) */
export function drawBolt(s) {
  boltDraw(s);
}
export function drawWraith(x, y, i) {
  ctx.globalCompositeOperation = 'lighter';
  glow(x, y, 11, '255,110,40', .55);
  glow(x, y, 5, '255,210,150', .9);
  ctx.globalCompositeOperation = 'source-over';
  const h = $.P.hist[Math.min((i + 1) * 13 + 5, $.P.hist.length - 1)];
  if (h) {
    ctx.fillStyle = 'rgba(255,120,60,.25)';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#2b0d05';
  ctx.fillRect(x - 2, y - 1.5, 1.4, 1.6);
  ctx.fillRect(x + .8, y - 1.5, 1.4, 1.6);
  ctx.fillRect(x - .6, y + 1.2, 1.4, 1.4);
  light(x, y, 30, .6);
}

// --- enemies ---
