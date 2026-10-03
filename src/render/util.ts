// @ts-nocheck
import { C, FONT_H, TAU, ctx } from '../core';
import { LIGHTS } from '../world';

// =====================================================================
//  RENDERING
// =====================================================================
export function txt(s, x, y, col, al = 'left', size = 8, font = FONT_H) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = al;
  ctx.textBaseline = 'top';
  ctx.fillStyle = col;
  ctx.fillText(s, x | 0, y | 0);
}
export function poly(c, p) {
  c.beginPath();
  c.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
  c.closePath();
  c.fill();
}
export const GLOWC = {};
export function glowSpr(col) {
  let s = GLOWC[col];
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const x = s.getContext('2d'),
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${col},1)`);
  g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return GLOWC[col] = s;
}
export function glow(x, y, r, col, a) {
  if (r <= 0 || a <= 0) return;
  const p = ctx.globalAlpha;
  ctx.globalAlpha = p * Math.min(1, a);
  ctx.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = p;
}
export function drawSkull(c, x, y, s, red) {
  c.fillStyle = C.bone;
  c.beginPath();
  c.arc(x, y - s * .15, s, 0, TAU);
  c.fill();
  c.fillRect(x - s * .55, y + s * .4, s * 1.1, s * .6);
  c.fillStyle = '#b3a88f';
  c.beginPath();
  c.arc(x + s * .15, y, s * .85, .3, Math.PI * .85);
  c.fill();
  c.fillStyle = '#100505';
  c.beginPath();
  c.arc(x - s * .38, y - s * .12, s * .3, 0, TAU);
  c.arc(x + s * .38, y - s * .12, s * .3, 0, TAU);
  c.fill();
  c.fillRect(x - s * .1, y + s * .22, s * .2, s * .26);
  for (let k = -1; k <= 1; k++) c.fillRect(x + k * s * .3 - .25, y + s * .55, .6, s * .42);
  if (red) {
    c.fillStyle = '#ff2a1a';
    c.fillRect(x - s * .38 - .5, y - s * .12 - .5, 1, 1);
    c.fillRect(x + s * .38 - .5, y - s * .12 - .5, 1, 1);
  }
}
export function invCross(c, x, yT, h, w, col) {
  c.fillStyle = col;
  c.fillRect(x - w / 2, yT, w, h);
  c.fillRect(x - h * .3, yT + h * .7 - w / 2, h * .6, w);
}
export function drawChain(c, x1, y1, x2, y2, lw = 1.4) {
  const dx = x2 - x1,
    dy = y2 - y1,
    L = Math.hypot(dx, dy),
    an = Math.atan2(dy, dx),
    n = Math.max(1, L / 4 | 0);
  c.lineWidth = lw;
  for (let i = 0; i < n; i++) {
    const f = (i + .5) / n;
    c.save();
    c.translate(x1 + dx * f, y1 + dy * f);
    c.rotate(an);
    c.strokeStyle = i % 2 ? '#6b7682' : '#2e353d';
    c.beginPath();
    if (i % 2) c.ellipse(0, 0, 2.6, 1.4, 0, 0, TAU);else c.ellipse(0, 0, 2.6, .5, 0, 0, TAU);
    c.stroke();
    c.restore();
  }
}
export function drawHookTip(c, x, y, a, s = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  c.strokeStyle = '#9aa8b6';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 3);
  c.arc(2.2, 3, 2.2, Math.PI, Math.PI * 2.1, true);
  c.stroke();
  c.fillStyle = '#9aa8b6';
  poly(c, [[4.3, 2.4], [5.3, .6], [3.6, 1.6]]);
  c.restore();
}
export function light(x, y, r, a = 1) {
  if (LIGHTS.length < 70) LIGHTS.push({
    x,
    y,
    r,
    a
  });
}

// ---------------- realistic eyeballs (pre-rendered, drawn on the hi-res layer) ----------------
