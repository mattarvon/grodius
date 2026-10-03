// @ts-nocheck
import { $ } from '../state';
import { C, R, TAU, ctx, hash, rr } from '../core';
import { ceilAt } from '../world';
import { whipPts } from '../enemies/update';
import { drawChain, drawHookTip, drawSkull, glow, light, poly } from '../render/util';
import { eye } from '../render/eyes';

// --- enemies ---
export function drawDrone(c, e) {
  const t = e.t * .2;
  c.lineWidth = 1;
  c.strokeStyle = C.fleshD;
  for (let k = -1; k <= 1; k++) {
    c.beginPath();
    c.moveTo(5, k * 2);
    c.quadraticCurveTo(10, k * 3 + Math.sin(t + k) * 2, 15, k * 4 + Math.sin(t * 1.3 + k) * 3);
    c.stroke();
  }
  c.fillStyle = '#2a0b0a';
  c.beginPath();
  c.ellipse(.5, .5, 8.2, 6.2, 0, 0, TAU);
  c.fill();
  c.fillStyle = e.cap ? '#c4313a' : C.flesh;
  c.beginPath();
  c.ellipse(-.3, -.3, 7.3, 5.3, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.fleshL;
  c.beginPath();
  c.ellipse(-2, -2.6, 3, 1.3, -.3, 0, TAU);
  c.fill();
  c.fillStyle = '#4a5560';
  c.fillRect(1, -6, 2, 12);
  c.fillStyle = '#a5b3c0';
  c.fillRect(1, -4, 1, 1);
  c.fillRect(1, 0, 1, 1);
  c.fillRect(1, 3, 1, 1);
  c.strokeStyle = '#2a0d0c';
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    c.moveTo(-5 + k * 2, 3);
    c.lineTo(-4 + k * 2, 4.6);
  }
  c.moveTo(-6, 3.8);
  c.lineTo(-1, 3.8);
  c.stroke();
  const a = Math.atan2($.P.y - e.y, $.P.x - e.x);
  eye(c, -4, -.5, 2.9, {
    ang: a,
    iris: '#8a0f12',
    bs: 1.2,
    blink: (e.t + e.x | 0) % 170 < 6 ? 1 : 0
  });
}
export function drawCorpse(c, e) {
  const tw = e.twitch > 0 ? Math.sin(e.twitch * 2) * 2 : 0;
  c.lineCap = 'round';
  c.lineWidth = 3;
  c.strokeStyle = '#2c3743';
  c.beginPath();
  c.moveTo(-1.5, 5);
  c.lineTo(-3, 12 + tw);
  c.stroke();
  if (!e.noLeg) {
    c.beginPath();
    c.moveTo(1.5, 5);
    c.lineTo(3.5, 12.5 - tw);
    c.stroke();
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(2, 6.5, 1.8, 0, TAU);
    c.fill();
    c.fillStyle = C.bone;
    c.fillRect(1.5, 7, 1, 2);
  }
  c.strokeStyle = '#33404e';
  c.beginPath();
  c.moveTo(-3.5, -3.5);
  c.lineTo(-8, 1 + tw);
  c.stroke();
  if (!e.noArm) {
    c.beginPath();
    c.moveTo(3.5, -3.5);
    c.lineTo(8.5, -6 - tw);
    c.stroke();
    c.fillStyle = C.skin;
    c.fillRect(8, -7.5 - tw, 2, 2);
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(4.4, -3.5, 1.6, 0, TAU);
    c.fill();
  }
  c.fillStyle = C.skin;
  c.fillRect(-9, 0 + tw, 2, 2);
  c.lineCap = 'butt';
  c.fillStyle = C.suit;
  c.fillRect(-4, -5, 8, 11);
  c.fillStyle = '#2a333e';
  c.fillRect(-4, 1, 8, 1);
  c.fillStyle = '#55657a';
  c.fillRect(-4, -5, 8, 1);
  c.fillStyle = '#d0a43a';
  c.fillRect(-3, -3.5, 2, 1);
  c.fillStyle = C.blood;
  c.fillRect(-1, -2, 4, 4);
  c.fillStyle = C.fleshD;
  c.fillRect(0, -1, 2, 2);
  c.fillStyle = C.bone;
  c.fillRect(-.5, -1.6, 3.5, .6);
  c.fillRect(-.5, .2, 3.5, .6);
  c.fillStyle = e.cap ? '#e01a24' : '#5a050a';
  if (e.cap) {
    c.fillRect(-3, 2.5, 3, 2);
    c.fillStyle = '#ffb0b0';
    c.fillRect(-2.5, 3, 1, 1);
  }
  c.fillStyle = C.skin;
  c.beginPath();
  c.arc(0, -8.5, 3.6, 0, TAU);
  c.fill();
  c.fillStyle = '#a8998b';
  c.beginPath();
  c.arc(.8, -7.8, 2.8, 0, Math.PI);
  c.fill();
  c.fillStyle = '#120606';
  c.fillRect(-2.3, -9.6, 1.6, 1.6);
  c.fillRect(.7, -9.6, 1.6, 1.6);
  c.beginPath();
  c.ellipse(0, -6.6, 1, 1.6 + Math.abs(tw) * .3, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.blood;
  c.fillRect(-2, -8, 1, 2.6);
  c.fillRect(1.2, -8, 1, 1.8);
}
export function drawEyeT(c, e) {
  if (e.o < 0) c.scale(1, -1);
  c.fillStyle = '#1a2027';
  poly(c, [[-13, 6], [-9, -2], [9, -2], [13, 6]]);
  c.fillStyle = '#5d6b7a';
  c.fillRect(-9, -2, 18, 1);
  c.fillStyle = '#8e9cab';
  c.fillRect(-7, 1, 1, 1);
  c.fillRect(6, 1, 1, 1);
  c.fillStyle = C.fleshD;
  c.beginPath();
  c.ellipse(0, -3, 10, 4, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.flesh;
  c.beginPath();
  c.ellipse(0, -3.6, 8.5, 2.6, 0, Math.PI, TAU);
  c.fill();
  const ey = e.y - e.o * 9;
  eye(c, 0, -9, 6.9, {
    ang: Math.atan2($.P.y - ey, $.P.x - e.x),
    iris: '#8a9a22',
    bs: 1.6,
    dil: e.cool < 20 ? 1.5 : .85,
    blink: e.blink > 0 ? 1 : 0,
    lid: '#7a2a24'
  });
}
export function drawCrawler(c, e) {
  if (e.o < 0) c.scale(1, -1);
  const t = e.t * .35;
  c.strokeStyle = C.bone;
  c.lineWidth = 1.3;
  c.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const bx = -5 + k * 5,
      ph = t + k * 2.1;
    const fx = bx + Math.sin(ph) * 3,
      fy = 7 - Math.max(0, Math.cos(ph)) * 2.5;
    c.beginPath();
    c.moveTo(bx, 0);
    c.lineTo(bx + (k - 1) * 2, -7);
    c.lineTo(fx, fy);
    c.stroke();
    const ph2 = ph + Math.PI;
    c.beginPath();
    c.moveTo(bx, 1);
    c.lineTo(bx + (k - 1) * 2 + 1, -5);
    c.lineTo(bx + Math.sin(ph2) * 3, 7 - Math.max(0, Math.cos(ph2)) * 2.5);
    c.stroke();
  }
  c.lineCap = 'butt';
  c.fillStyle = '#3e1410';
  c.beginPath();
  c.ellipse(1, 0, 10, 5.5, 0, 0, TAU);
  c.fill();
  c.fillStyle = e.cap ? '#c4313a' : '#8c3b32';
  c.beginPath();
  c.ellipse(1, -.6, 9, 4.4, 0, 0, TAU);
  c.fill();
  c.strokeStyle = C.bone;
  c.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(-3 + k * 3.5, 0, 4, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }
  c.fillStyle = C.skin;
  c.beginPath();
  c.arc(-10, -1, 4.2, 0, TAU);
  c.fill();
  c.fillStyle = '#120606';
  c.fillRect(-12.5, -3, 1.6, 1.8);
  c.fillRect(-9.8, -3, 1.6, 1.8);
  const j = e.air ? 2.5 : Math.abs(Math.sin(e.t * .12)) * 1.5;
  c.fillRect(-12, 0, 4, 1 + j);
  c.fillStyle = C.bone;
  for (let k = 0; k < 3; k++) {
    c.fillRect(-11.8 + k * 1.3, 0, .8, .8);
    c.fillRect(-11.8 + k * 1.3, .4 + j, .8, .8);
  }
  c.fillStyle = C.blood;
  c.fillRect(-11, 1.5 + j, 1, 2);
}
export function drawHatch(c, e) {
  const w = Math.sin(e.t * .4 + (e.ph || 0));
  c.strokeStyle = '#c98e86';
  c.lineWidth = 2;
  c.beginPath();
  const dir = e.fromLeft ? -1 : 1;
  c.moveTo(dir * 2, 0);
  c.quadraticCurveTo(dir * 6, w * 3, dir * 10, -w * 2);
  c.stroke();
  c.strokeStyle = '#8a1f22';
  c.lineWidth = .8;
  c.beginPath();
  c.moveTo(dir * 1, 1);
  c.quadraticCurveTo(dir * 8, 3 + w * 2, dir * 14, w * 3);
  c.stroke();
  c.fillStyle = '#d8a59a';
  c.beginPath();
  c.arc(-dir, 0, 4.2, 0, TAU);
  c.fill();
  c.fillStyle = '#efc7bb';
  c.beginPath();
  c.arc(-dir * 1.5, -1.4, 2, 0, TAU);
  c.fill();
  c.fillStyle = '#0c0405';
  c.beginPath();
  c.arc(-dir * 3, -1, 1.3, 0, TAU);
  c.arc(-dir * .6, -1.6, 1.1, 0, TAU);
  c.fill();
  c.fillStyle = '#7a0b10';
  c.fillRect(-dir * 3 - 1, 1.3, 2.4, 1);
}
export function drawWomb(c, e) {
  const s = 1 + Math.sin(e.t * .09) * .05;
  c.strokeStyle = '#5a1a1a';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, -11);
  c.quadraticCurveTo(Math.sin(e.t * .03) * 3, -e.st * .6, 0, -e.st - 4);
  c.stroke();
  c.strokeStyle = '#8c3b32';
  c.lineWidth = 1;
  c.stroke();
  c.save();
  c.scale(s, s);
  c.fillStyle = 'rgba(120,30,30,.9)';
  c.beginPath();
  c.ellipse(0, 0, 11.5, 14, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(205,110,95,.55)';
  c.beginPath();
  c.ellipse(0, 0, 10, 12.6, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(60,8,10,.85)';
  const k = Math.sin(e.t * .05);
  c.beginPath();
  c.arc(-2 + k, -4, 4, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(1, 3, 4.5, 6, .5 + k * .2, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,40,30,.6)';
  c.fillRect(-3.4 + k, -5, 1, 1);
  c.strokeStyle = 'rgba(70,5,10,.8)';
  c.lineWidth = .7;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    c.moveTo(Math.cos(a) * 10, Math.sin(a) * 12);
    c.quadraticCurveTo(Math.cos(a + .4) * 6, Math.sin(a + .4) * 7, Math.cos(a + .7) * 3, Math.sin(a + .7) * 4);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,230,210,.5)';
  c.beginPath();
  c.ellipse(-4, -6, 2.4, 1.2, -.6, 0, TAU);
  c.fill();
  c.restore();
}
export function drawMaw(c, e) {
  const t = e.t;
  c.strokeStyle = '#2a2f36';
  c.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(14, 6 + k * 5);
    c.quadraticCurveTo(26, 14 + k * 4 + Math.sin(t * .05 + k) * 4, 36, 6 + k * 9);
    c.stroke();
  }
  c.strokeStyle = '#59626d';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#3a0f0c';
  c.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * TAU,
      r = 26 + Math.sin(a * 3 + t * .05) * 1.5 + hash(i) * 3;
    i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  const g = c.createRadialGradient(-6, -8, 2, 0, 0, 26);
  g.addColorStop(0, '#cf7a64');
  g.addColorStop(.6, '#8e3a2f');
  g.addColorStop(1, '#4b1410');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 23.5, 0, TAU);
  c.fill();
  c.fillStyle = '#2a3038';
  c.fillRect(2, -25, 14, 7);
  c.fillRect(4, 18, 12, 7);
  c.fillStyle = '#6e7b88';
  c.fillRect(2, -25, 14, 1);
  c.fillRect(4, 18, 12, 1);
  c.fillStyle = '#a5b3c0';
  for (const [x, y] of [[4, -22], [13, -22], [6, 21], [13, 21]]) c.fillRect(x, y, 1, 1);
  c.strokeStyle = '#2a0807';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(6, -17);
  c.quadraticCurveTo(14, -2, 8, 16);
  c.stroke();
  c.strokeStyle = '#9aa8b6';
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const y = -14 + k * 5.4,
      x = 6 + Math.sin(k) * 2.5 + 4;
    c.moveTo(x - 2, y);
    c.lineTo(x + 2, y);
  }
  c.stroke();
  for (const ep of e.eyesP) {
    const x = Math.cos(ep.a + Math.PI) * ep.r * .9 + 4,
      y = Math.sin(ep.a) * ep.r;
    eye(c, x, y, ep.s, {
      ang: Math.atan2($.P.y - e.y - y, $.P.x - e.x - x),
      iris: '#b01018',
      bs: 1.5,
      blink: ep.b > 0 ? 1 : 0,
      lid: '#6e2b26'
    });
  }
  const j = e.jaw * 13 + 2;
  c.fillStyle = '#160203';
  c.beginPath();
  c.ellipse(-14, 0, 6 + e.jaw * 2, j, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7a1418';
  c.beginPath();
  c.ellipse(-13, j * .4, 4, j * .5, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = C.bone;
  for (let k = -4; k <= 4; k++) {
    const y = k * (j / 4.6);
    c.beginPath();
    c.moveTo(-20, y);
    c.lineTo(-16, y + 1.2);
    c.lineTo(-20, y + 2.2);
    c.fill();
    c.beginPath();
    c.moveTo(-8, y);
    c.lineTo(-12, y + 1.2);
    c.lineTo(-8, y + 2.2);
    c.fill();
  }
  if (e.jaw > .3) {
    c.fillStyle = '#e0242c';
    c.fillRect(-15, -j * .8, 1, j * 1.6);
  }
}
export function drawCross(c, e) {
  // local: center of body at 0,0; cross bottom (screen) at +22, top at -22. Always inverted in screen space.
  const yB = 22,
    yT = -22,
    fl = e.o > 0;
  c.fillStyle = '#0b0d10';
  c.fillRect(-2.5, yT, 5, 44);
  c.fillRect(-13, 6, 26, 5);
  c.fillStyle = '#1f262e';
  c.fillRect(-1.8, yT, 3.6, 44);
  c.fillRect(-12.2, 6.7, 24.4, 3.6);
  c.fillStyle = '#56616d';
  c.fillRect(-1.8, yT, 1, 44);
  c.fillRect(-12.2, 6.7, 24.4, 1);
  c.fillStyle = '#4e0307';
  for (let k = 0; k < 5; k++) c.fillRect(-1 + k % 2, yT + 4 + k * 8, 1, 4 + hash(k + e.x * .01) * 4);
  // body: upside down, feet nailed at top, hands on crossbar, head hanging below
  c.lineCap = 'round';
  c.lineWidth = 2.6;
  c.strokeStyle = C.suit;
  const tw = e.flash ? 1 : Math.sin(e.t * .3) * (R() < .02 ? 2 : 0);
  c.beginPath();
  c.moveTo(-1.4, -5);
  c.lineTo(-1.6, -19 + tw);
  c.stroke();
  if (!e.noLeg) {
    c.beginPath();
    c.moveTo(1.4, -5);
    c.lineTo(1.6, -19);
    c.stroke();
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(1.6, -6.5, 1.7, 0, TAU);
    c.fill();
    c.fillStyle = C.bone;
    c.fillRect(1.1, -9.5, 1, 3);
  }
  c.strokeStyle = C.skin;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-3, 7);
  c.lineTo(-10.5, 8.5);
  c.moveTo(3, 7);
  c.lineTo(10.5, 8.5);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = C.suit;
  c.fillRect(-3.5, -6, 7, 14);
  c.fillStyle = '#55657a';
  c.fillRect(-3.5, 7, 7, 1);
  // opened torso, ribs splayed
  c.fillStyle = C.bloodD;
  c.fillRect(-2.2, -4, 4.4, 9);
  c.fillStyle = C.blood;
  c.fillRect(-1.6, -3, 3.2, 7);
  c.fillStyle = C.fleshD;
  c.fillRect(-.8, -1, 1.6, 3);
  c.fillStyle = C.bone;
  for (let k = 0; k < 3; k++) {
    c.fillRect(-3.2, -2.6 + k * 2.2, 1.6, .6);
    c.fillRect(1.6, -2.6 + k * 2.2, 1.6, .6);
  }
  // nails
  c.fillStyle = '#c9d3dc';
  c.fillRect(-2.2, -20 + tw, 1.4, 1.4);
  c.fillRect(.9, -20, 1.4, 1.4);
  c.fillRect(-10.8, 7.8, 1.4, 1.4);
  c.fillRect(9.4, 7.8, 1.4, 1.4);
  c.fillStyle = C.blood;
  c.fillRect(-10.4, 9, 1, 2.5 + e.t * .03 % 4);
  c.fillRect(9.8, 9, 1, 3 + e.t * .025 % 4);
  // head hanging below the bar
  c.fillStyle = C.skin;
  c.beginPath();
  c.arc(0, 13.6, 3.4, 0, TAU);
  c.fill();
  c.fillStyle = '#120606';
  c.fillRect(-2.1, 14.2, 1.5, 1.5);
  c.fillRect(.6, 14.2, 1.5, 1.5);
  c.beginPath();
  c.ellipse(0, 11.6, 1, 1.4, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#ff2a1a';
  c.fillRect(-1.6, 14.6, .8, .8);
  c.fillRect(1.1, 14.6, .8, .8);
  c.fillStyle = C.blood;
  c.fillRect(-.6, 15.8, 1.2, 2 + e.t * .04 % 5);
  if (fl) {
    drawSkull(c, -7, yB - 3.4, 3, 0);
    drawSkull(c, 6, yB - 2.8, 2.6, 0);
    c.fillStyle = C.bone;
    c.fillRect(-2, yB - 1.4, 7, 1.2);
  } else {
    drawChain(c, -12, yT - 8, -12, 6.5, 1.1);
    drawChain(c, 12, yT - 8, 12, 6.5, 1.1);
  }
  if (e.cap) {
    c.fillStyle = '#e01a24';
    c.fillRect(-1, 1, 2, 2);
  }
}
export function drawHook(c, e) {
  drawCorpse(c, e);
  c.fillStyle = C.blood;
  c.fillRect(-2.6, 11.5, 1.6, 2);
  if (!e.noLeg) c.fillRect(2.8, 11.8, 1.6, 2);
  if (e.cut) {
    c.fillStyle = C.bloodD;
    c.fillRect(-1, -6, 2, 10);
    c.fillStyle = C.blood;
    c.fillRect(-.6, -5, 1.2, 8);
  }
}
export function drawFlayer(c, e) {
  const t = e.t;
  c.strokeStyle = C.bone;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(4, 6);
  for (let i = 1; i < 7; i++) c.lineTo(4 + i * 2.2 + Math.sin(t * .1 + i) * 1.6, 6 + i * 2.4);
  c.stroke();
  c.fillStyle = C.bone;
  for (let i = 1; i < 7; i++) c.fillRect(3.4 + i * 2.2 + Math.sin(t * .1 + i) * 1.6, 5.4 + i * 2.4, 1.6, 1.2);
  // hooks in the back with chains pulling skin flaps
  for (const s of [-1, 1]) {
    const hx = 5 + s * 2,
      hy = -6 + s * 2;
    c.fillStyle = '#d29d8f';
    poly(c, [[2, hy + 1], [hx + 5, hy - 3 + s], [hx + 5, hy - 1 + s], [3, hy + 3]]);
    drawHookTip(c, hx + 5, hy - 2 + s, -.8, .7);
    drawChain(c, hx + 6, hy - 3 + s, hx + 14, hy - 14 + s * 3, 1);
  }
  c.fillStyle = '#3a0f0c';
  c.beginPath();
  c.ellipse(1, 0, 7, 8.5, .25, 0, TAU);
  c.fill();
  c.fillStyle = e.cap ? '#c4313a' : '#9a4335';
  c.beginPath();
  c.ellipse(.5, -.3, 6, 7.6, .25, 0, TAU);
  c.fill();
  c.strokeStyle = '#5e1a1a';
  c.lineWidth = .7;
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    c.moveTo(-4 + k * 2, -6);
    c.quadraticCurveTo(-3 + k * 2, 0, -4.5 + k * 2.2, 6);
  }
  c.stroke();
  c.strokeStyle = C.bone;
  c.lineWidth = .9;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(1, -3 + k * 2.6, 4.2, Math.PI * 1.15, Math.PI * 1.8);
    c.stroke();
  }
  drawChain(c, -6, -6, 6, 5, 1);
  drawChain(c, -5, 4, 5, -7, 1);
  const sh = e.ws === 'tel' ? Math.min(1, e.wt / 10) : 0;
  c.strokeStyle = C.flesh;
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-3, -3);
  c.lineTo(-7 + sh * 4, 1 - sh * 3);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = C.skin;
  c.fillRect(-8.4 + sh * 4, 0 - sh * 3, 2.4, 2.4);
  const jaw = e.ws === 'strike' ? 2.5 : Math.abs(Math.sin(t * .07)) * 1.2;
  drawSkull(c, -2.5, -11 - jaw * .2, 4.4, 1);
  c.fillStyle = C.bone;
  c.fillRect(-5, -7.2 + jaw, 5, 1.4);
  c.fillStyle = C.blood;
  c.fillRect(-4.4, -7.8 + jaw * .5, 1, jaw + 1.4);
}
export function drawWhip(e) {
  const pts = whipPts(e);
  ctx.lineJoin = 'round';
  for (const [w, col] of [[2.6, '#1a0e0b'], [1.3, '#7a5a48']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.fillStyle = C.bone;
  for (let i = 2; i < pts.length; i += 2) {
    const a = pts[i - 1],
      b = pts[i],
      an = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    poly(ctx, [[b.x, b.y], [b.x + Math.cos(an) * 2.4 - Math.cos(an - Math.PI / 2) * 1.2, b.y + Math.sin(an) * 2.4 - Math.sin(an - Math.PI / 2) * 1.2], [a.x, a.y]]);
  }
  const tip = pts[pts.length - 1],
    pr = pts[pts.length - 2];
  drawHookTip(ctx, tip.x, tip.y, Math.atan2(tip.y - pr.y, tip.x - pr.x) - Math.PI / 2, 1);
  if (e.ws === 'tel') {
    const k = e.wt / 34;
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.lineDashOffset = -$.T;
    ctx.strokeStyle = `rgba(255,40,40,${.25 + k * .6})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x - 7, e.y + 1);
    ctx.lineTo(e.x - 7 + Math.cos(e.ang) * 122, e.y + 1 + Math.sin(e.ang) * 122);
    ctx.stroke();
    ctx.restore();
  }
  if (e.ws === 'tel' && ($.T >> 2) % 2) {
    ctx.globalCompositeOperation = 'lighter';
    glow(tip.x, tip.y, 8, '255,40,40', .8);
    ctx.globalCompositeOperation = 'source-over';
  }
}
export const DRAW = {
  nailbar: drawNailbar,
  crux: drawCrux,
  butcher: drawButcher,
  cross: drawCross,
  hook: drawHook,
  flayer: drawFlayer,
  drone: drawDrone,
  corpse: drawCorpse,
  eye: drawEyeT,
  crawler: drawCrawler,
  hatch: drawHatch,
  womb: drawWomb,
  maw: drawMaw
};
export function drawEnemy(e) {
  if (e.k === 'hook') {
    const fx = e.x - 12 * Math.sin(e.rot),
      fy = e.y + 12 * Math.cos(e.rot);
    drawChain(ctx, e.ax, e.ay, fx, fy - 2);
    drawHookTip(ctx, fx, fy - 3, -e.rot + Math.PI, 1.1);
  }
  if (e.k === 'flayer') drawWhip(e);
  if (e.k === 'butcher') {
    const cy = Math.max(-8, ceilAt(e.x + $.G.scroll));
    drawChain(ctx, e.x - 14, e.y - 30, e.x - 14 - (e.cut ? 0 : 6), cy, 1.6);
    if (!e.cut) drawChain(ctx, e.x + 14, e.y - 30, e.x + 20, cy, 1.6);else {
      drawChain(ctx, e.x + 14, e.y - 30, e.x + 30, e.y - 12 + Math.sin($.T * .1) * 4, 1.4);
    }
    const sx = e.x - 10,
      sy = e.y - 10;
    if (e.st === 'ctel') {
      const k = e.wt / 48;
      ctx.fillStyle = `rgba(255,30,30,${.08 + .22 * k * (($.T >> 2) % 2 ? 1 : .6)})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 100, 2.3, 3.99);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,60,60,${.4 + .5 * k})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, 100, 2.3, 3.99);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.st === 'cut' && e.wt <= 12) {
      let cur = e.ba;
      if (cur < 0) cur += TAU;
      ctx.fillStyle = 'rgba(255,230,220,.35)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 100, cur, 3.99);
      ctx.closePath();
      ctx.fill();
    }
    if (e.st === 'htel') {
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.lineDashOffset = -$.T;
      ctx.strokeStyle = `rgba(255,40,40,${.3 + .6 * e.wt / 40})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x + 10, e.y - 8);
      ctx.lineTo(e.x + 10 + Math.cos(e.ha) * 230, e.y - 8 + Math.sin(e.ha) * 230);
      ctx.stroke();
      ctx.restore();
    }
    if (e.hk) {
      const tx = e.x + 10 + Math.cos(e.ha) * e.hk.d,
        ty = e.y - 8 + Math.sin(e.ha) * e.hk.d;
      drawChain(ctx, e.x + 10, e.y - 8, tx, ty, 1.4);
      drawHookTip(ctx, tx, ty, e.ha - Math.PI / 2, 1.4);
    }
  }
  if (e.burn > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, e.r + 10, '255,110,30', .3 + .2 * R());
    ctx.globalCompositeOperation = 'source-over';
    light(e.x, e.y, 30, .8);
  }
  const ga = ctx.globalAlpha;
  if (e.ghost > 0) ctx.globalAlpha = ga * (.35 + .25 * Math.sin($.T * .5));
  ctx.save();
  ctx.translate(e.x + (e.flash ? rr(-1, 1) : 0), e.y);
  if (e.k === 'corpse' || e.k === 'hook') ctx.rotate(e.rot);
  if (e.flash) ctx.filter = 'brightness(2.6) saturate(.4)';
  DRAW[e.k](ctx, e);
  ctx.restore();
  ctx.globalAlpha = ga;
  if (e.cap && e.k !== 'corpse') {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, e.r + 6, '255,30,40', .18 + .1 * Math.sin($.T * .2));
    ctx.globalCompositeOperation = 'source-over';
  }
  if (e.k === 'flayer') light(e.x - 2, e.y - 11, 22, .6);else if (e.k === 'cross') light(e.x, e.y + 14, 22, .5);else if (e.k === 'eye') light(e.x, e.y - e.o * 9, 24, .7);else if (e.k === 'womb') light(e.x, e.y, 30, .6);else if (e.k === 'maw') light(e.x, e.y, 60, .7);else if (e.k === 'crux') {
    light(e.x, e.y, 80, .9);
  } else if (e.k === 'butcher') {
    light(e.x, e.y - 10, 80, .9);
  }
  if (e.big && !e.mini && e.hp < e.max) {
    ctx.fillStyle = '#2a0507';
    ctx.fillRect(e.x - 20, e.y - 34, 40, 2);
    ctx.fillStyle = C.bloodL;
    ctx.fillRect(e.x - 20, e.y - 34, 40 * e.hp / e.max, 2);
  }
}
export function drawNailbar(c, e) {
  c.fillStyle = '#14171b';
  c.fillRect(-3.5, -15, 7, 30);
  c.fillStyle = '#3e454e';
  c.fillRect(-2.5, -14, 5, 28);
  c.fillStyle = '#7d8996';
  c.fillRect(-2.5, -14, 1, 28);
  c.fillStyle = '#b8c4d0';
  for (let k = 0; k < 5; k++) {
    const y = -12 + k * 6;
    poly(c, [[-2.5, y - 1.6], [-9, y], [-2.5, y + 1.6]]);
  }
  c.fillStyle = C.blood;
  c.fillRect(-1, -6, 2, 9);
  c.fillRect(-8, -.4, 4, .8);
  c.fillStyle = '#a5b3c0';
  c.fillRect(1, -13, 1, 1);
  c.fillRect(1, 12, 1, 1);
}
export function drawCrux(c, e) {
  const t = e.t,
    beat = Math.pow(Math.max(0, Math.sin(t * .12)), 5);
  // inverted cross: long beam, crossbar low
  c.fillStyle = '#0d0907';
  c.fillRect(-7, -64, 14, 124);
  c.fillRect(-46, 22, 92, 13);
  c.fillStyle = '#5a3a26';
  c.fillRect(-6, -63, 12, 122);
  c.fillRect(-45, 23, 90, 11);
  c.fillStyle = '#7a5434';
  c.fillRect(-6, -63, 2, 122);
  c.fillRect(-45, 23, 90, 2);
  c.fillStyle = '#3a2416';
  for (let k = 0; k < 8; k++) c.fillRect(-6, -60 + k * 15, 12, 1);
  c.fillStyle = '#8a96a3';
  for (const [x, y] of [[-40, 28], [40, 28], [0, -58], [0, 52]]) c.fillRect(x - 1, y - 1, 2, 2);
  // flayed body, upside down
  c.lineCap = 'round';
  c.strokeStyle = C.fleshD;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(-3, -22);
  c.lineTo(-5, -56);
  c.moveTo(3, -22);
  c.lineTo(5, -56);
  c.stroke();
  c.strokeStyle = C.flesh;
  c.lineWidth = 4;
  c.stroke();
  c.strokeStyle = C.fleshD;
  c.lineWidth = 4.5;
  c.beginPath();
  c.moveTo(-8, 12);
  c.quadraticCurveTo(-24, 20, -38, 28);
  c.moveTo(8, 12);
  c.quadraticCurveTo(24, 20, 38, 28);
  c.stroke();
  c.strokeStyle = C.flesh;
  c.lineWidth = 3;
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#6e2b26';
  c.beginPath();
  c.ellipse(0, -4, 12, 20, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#a3473c';
  c.beginPath();
  c.ellipse(-1, -5, 10, 18, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#5a1a18';
  c.lineWidth = .7;
  c.beginPath();
  for (let k = 0; k < 7; k++) {
    c.moveTo(-8, -18 + k * 5);
    c.quadraticCurveTo(0, -16 + k * 5, 8, -18 + k * 5);
  }
  c.stroke();
  // open ribcage + heart
  c.fillStyle = '#1a0305';
  c.beginPath();
  c.ellipse(-2, -4, 6, 9, 0, 0, TAU);
  c.fill();
  const hr = 4 + beat * 1.5;
  c.globalCompositeOperation = 'lighter';
  glow(-2, -4, 14 + beat * 6, e.shielded ? '120,10,20' : '255,30,30', .5 + beat * .4);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = e.shielded ? '#6a0a10' : '#d0101a';
  c.beginPath();
  c.arc(-3, -4, hr, 0, TAU);
  c.arc(-1, -6, hr * .8, 0, TAU);
  c.fill();
  c.fillStyle = '#ff9a9a';
  c.fillRect(-5, -8, 1.5, 1.5);
  c.strokeStyle = C.bone;
  c.lineWidth = 1.3;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.moveTo(-9, -14 + k * 5);
    c.quadraticCurveTo(-4, -12 + k * 5, -3, -9 + k * 5);
    c.moveTo(7, -14 + k * 5);
    c.quadraticCurveTo(3, -12 + k * 5, 1, -9 + k * 5);
    c.stroke();
  }
  // upside-down head
  drawSkull(c, 0, 24, 6.5, 0);
  c.fillStyle = '#8e3a32';
  c.beginPath();
  c.ellipse(0, 23, 6, 5, 0, 0, Math.PI);
  c.fill();
  eye(c, -2.6, 26, 1.9, {
    ang: Math.atan2($.P.y - e.y - 26, $.P.x - e.x),
    iris: '#b01018',
    bs: 2
  });
  eye(c, 2.6, 26, 1.9, {
    ang: Math.atan2($.P.y - e.y - 26, $.P.x - e.x),
    iris: '#b01018',
    bs: 2
  });
  c.fillStyle = '#160203';
  c.beginPath();
  c.ellipse(0, 19.5, 2.6, 1.8 + Math.sin(t * .2) * .8, 0, 0, TAU);
  c.fill();
  // nails + blood streams
  c.fillStyle = '#b8c4d0';
  for (const [x, y] of [[-38, 28], [38, 28], [0, -50], [0, -30]]) {
    c.fillRect(x - 1, y - 4, 2, 8);
    c.fillRect(x - 2.2, y - 4, 4.4, 1.4);
  }
  c.fillStyle = C.blood;
  for (const [x, y, l] of [[-38, 32, 8 + Math.sin(t * .05) * 3], [38, 32, 10], [0, 30, 14], [-3, -28, 6]]) c.fillRect(x - .6, y, 1.2, l);
  if (!e.shielded) {
    c.fillStyle = 'rgba(255,40,40,.5)';
    c.fillRect(-30, -2, 4, 1);
  }
}
export function drawButcher(c, e) {
  const t = e.t;
  // hook arm (right) and torso carcass hung on shoulder hooks
  c.fillStyle = '#3a0f0c';
  c.beginPath();
  c.ellipse(1, 4, 23, 31, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#8e3a32';
  c.beginPath();
  c.ellipse(0, 3, 21, 29, 0, 0, TAU);
  c.fill();
  c.strokeStyle = C.fat;
  c.lineWidth = 1.4;
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.moveTo(-17, -14 + k * 8);
    c.quadraticCurveTo(-4, -10 + k * 8 + Math.sin(k) * 2, 16, -15 + k * 8);
    c.stroke();
  }
  c.strokeStyle = C.bone;
  c.lineWidth = 1.6;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.moveTo(4, -16 + k * 6);
    c.quadraticCurveTo(14, -14 + k * 6, 17, -8 + k * 6);
    c.stroke();
  }
  // apron
  c.fillStyle = '#22160f';
  poly(c, [[-17, 6], [17, 6], [19, 34], [-19, 34]]);
  c.fillStyle = '#3a2618';
  c.fillRect(-17, 6, 34, 2);
  c.fillStyle = 'rgba(161,13,20,.85)';
  c.beginPath();
  c.ellipse(-4, 18, 6, 9, .3, 0, TAU);
  c.ellipse(8, 26, 4, 6, -.2, 0, TAU);
  c.fill();
  c.fillRect(-6, 26, 1.4, 10);
  c.fillRect(5, 30, 1.2, 8);
  drawChain(c, -16, 6, 16, -20, 1.2);
  // shoulder hooks
  for (const sx of [-14, 14]) drawHookTip(c, sx, -30, Math.PI, 1.2);
  // sack hood with a cluster of real eyes
  c.fillStyle = '#4a3a26';
  c.beginPath();
  c.ellipse(-6, -34, 12, 11, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#6b5a40';
  c.beginPath();
  c.ellipse(-6, -35, 11, 10, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#2a1f12';
  c.lineWidth = .6;
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    c.moveTo(-14 + k * 3, -27);
    c.lineTo(-13 + k * 3, -24);
  }
  c.moveTo(-15, -25.5);
  c.lineTo(0, -25.5);
  c.stroke();
  const la = Math.atan2($.P.y - e.y + 34, $.P.x - e.x + 6);
  for (const [ex, ey, er] of [[-10, -37, 2.6], [-3, -39, 2.1], [-7, -31, 1.6], [0, -33, 1.4], [-13, -31, 1.3]]) {
    c.fillStyle = '#1a0f08';
    c.beginPath();
    c.arc(ex, ey, er + .8, 0, TAU);
    c.fill();
    eye(c, ex, ey, er, {
      ang: la,
      iris: '#e8b818',
      bs: 2,
      blink: (t + ex * 7) % 150 < 5 ? 1 : 0,
      lid: '#4a3a26'
    });
  }
  // cleaver arm
  const ba = e.ba,
    ax = -10,
    ay = -10,
    L = 34;
  c.strokeStyle = C.fleshD;
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(ax + Math.cos(ba) * 18, ay + Math.sin(ba) * 18);
  c.stroke();
  c.strokeStyle = C.flesh;
  c.lineWidth = 4;
  c.stroke();
  c.lineCap = 'butt';
  c.save();
  c.translate(ax + Math.cos(ba) * 18, ay + Math.sin(ba) * 18);
  c.rotate(ba);
  c.fillStyle = '#2a1f12';
  c.fillRect(-2, -2, 8, 4);
  c.fillStyle = '#5d6b7a';
  c.fillRect(6, -9, L - 8, 13);
  c.fillStyle = '#b7c3cf';
  c.fillRect(6, -9, L - 8, 2);
  c.fillStyle = '#8a96a3';
  c.fillRect(6, 2, L - 8, 2);
  c.fillStyle = C.blood;
  c.fillRect(L - 10, -9, 4, 11);
  c.fillRect(14, -9, 2, 6);
  c.fillStyle = '#0b0e11';
  c.beginPath();
  c.arc(L - 4, -5, 1.6, 0, TAU);
  c.fill();
  c.restore();
}
// --- boss ---
