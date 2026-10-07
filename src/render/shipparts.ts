// @ts-nocheck
// Procedural parts the player ship grows: pod slots, grafts, perk tells, hull tiers, Infirmary contraptions.
// Every function draws in ship-local space (nose +x, centre 0,0). Vector only: no per-pixel work, no ctx.filter.
import { $ } from '../state';
import { TAU } from '../core';
import { glowSpr, poly } from '../render/util';
import { eye } from '../render/eyes';

const BONE = '#d8c8a4', BONED = '#5e5040', BONEM = '#a8987a', SINEW = '#3a1012', MEAT = '#6e2226', DARK = '#0a0404', METAL = '#4a525c', METALH = '#8d98a6';
export const add = (c) => (c.globalCompositeOperation = 'lighter');
export const nrm = (c) => (c.globalCompositeOperation = 'source-over');
export function ell(c, x, y, rx, ry, r = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(.05, rx), Math.max(.05, ry), r, 0, TAU);
  c.fill();
}
export function ln(c, x0, y0, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}
export function gl(c, x, y, r, col, a) {
  if (a <= 0 || r <= 0) return;
  const p = c.globalAlpha;
  c.globalAlpha = p * Math.min(1, a);
  c.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2);
  c.globalAlpha = p;
}
/** tapered quadratic limb (horn, spike, stalk, needle) */
export function taper(c, x0, y0, cx, cy, x1, y1, w0, w1, n = 6) {
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, it = 1 - t,
      x = it * it * x0 + 2 * it * t * cx + t * t * x1,
      y = it * it * y0 + 2 * it * t * cy + t * t * y1;
    let dx = 2 * it * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
    const d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    dx /= d;
    dy /= d;
    L.push([x - dy * w, y + dx * w]);
    Rr.push([x + dy * w, y - dx * w]);
  }
  poly(c, L.concat(Rr.reverse()));
}
const qpt = (t, x0, y0, cx, cy, x1, y1) => {
  const it = 1 - t;
  return [it * it * x0 + 2 * it * t * cx + t * t * x1, it * it * y0 + 2 * it * t * cy + t * t * y1];
};
/** hull top/bottom surface y at x (matches the carapace curve) */
export const hullTop = (x) => -5.6 + Math.pow((x + 3) / 9, 2) * 2;

// ============================== POD SLOTS ==============================
/** THRUST: ribbed bone nozzles (1-3), bigger at 4, sinew ram-scoops at 5 */
export function thrustParts(c, spd, eng, mini) {
  const n = Math.min(3, spd), sz = spd >= 4 ? 1.3 : 1, ys = [0, -4.2, 4.2];
  if (spd >= 5 && !mini) {
    for (const sg of [-1, 1]) {
      c.fillStyle = SINEW;
      taper(c, -1, sg * 5.5, -8, sg * 12, -20, sg * 11, 3, .3);
      c.strokeStyle = '#a04a3c';
      c.lineWidth = .35;
      c.beginPath();
      c.moveTo(-1, sg * 5.5);
      c.quadraticCurveTo(-8, sg * 11.4, -19, sg * 10.8);
      c.moveTo(-2, sg * 5.8);
      c.quadraticCurveTo(-9, sg * 12.4, -16, sg * 11.6);
      c.stroke();
    }
  }
  for (let i = 0; i < n; i++) {
    const y = ys[i], x1 = -15.5 - 2 * sz, h = 2.6 * sz;
    if (eng) {
      const f = .7 + Math.random() * .4, L = (5 + Math.min(4, spd) * 2) * f * (i ? .75 : 1);
      add(c);
      c.fillStyle = 'rgba(255,80,30,.55)';
      ell(c, x1 - L * .55, y, L * .6, h * .85);
      c.fillStyle = 'rgba(255,190,120,.85)';
      ell(c, x1 - L * .22, y, L * .3, h * .45);
      c.fillStyle = 'rgba(255,250,230,.95)';
      ell(c, x1 - 1, y, 1.6, h * .3);
      nrm(c);
    }
    c.fillStyle = BONED;
    poly(c, [[-10.5, y - 1.8], [x1, y - h], [x1 - .8, y], [x1, y + h], [-10.5, y + 1.8]]);
    c.fillStyle = BONEM;
    poly(c, [[-10.5, y - 1.8], [x1, y - h], [x1 + .6, y - h * .4], [-10.5, y - .6]]);
    c.strokeStyle = '#2a2018';
    c.lineWidth = .5;
    for (let k = 1; k <= 3; k++) {
      const xx = -10.5 + (x1 + 10.5) * k / 4, hh = 1.8 + (h - 1.8) * k / 4;
      ln(c, xx, y - hh, xx, y + hh);
    }
    c.fillStyle = '#1a0806';
    ell(c, x1, y, .9, h * .8);
    if (eng) {
      add(c);
      c.fillStyle = 'rgba(255,140,60,.8)';
      ell(c, x1, y, .6, h * .55);
      nrm(c);
    }
  }
  if (spd >= 4) {
    add(c);
    const p = .5 + .5 * Math.sin($.T * .3);
    c.strokeStyle = `rgba(255,${120 + p * 80 | 0},40,.9)`;
    c.lineWidth = .6;
    for (let k = 0; k < 3; k++) ln(c, -9 + k * 1.6, -3.2 + k * .2, -8 + k * 1.6, -1.8);
    nrm(c);
  }
}
/** MISSILE: clutches of glowing egg-sacs slung under the belly */
export function eggSacs(c, mis, rl) {
  for (let m = 0; m < mis; m++) {
    const cx = -2.5 - m * 7.5, cy = 8 + m * .5;
    c.strokeStyle = SINEW;
    c.lineWidth = 1.1;
    ln(c, cx + 1, 4.5, cx, cy - 1);
    const E = [[-2.2, 0, 2.5], [1.8, .6, 2.3], [-.2, 2.6, 2.1]];
    for (let e = 0; e < 3; e++) {
      const [ox, oy, r] = E[e], pu = .5 + .5 * Math.sin($.T * .17 + m * 2 + e * 1.3);
      c.fillStyle = '#3a0c10';
      ell(c, cx + ox, cy + oy, r + .4, r * .8 + .4);
      c.fillStyle = '#7a2420';
      ell(c, cx + ox, cy + oy, r, r * .78);
      add(c);
      c.fillStyle = `rgba(255,150,60,${.25 + .45 * pu})`;
      ell(c, cx + ox + .3, cy + oy + .2, r * .55, r * .4);
      nrm(c);
      c.fillStyle = '#1a0406';
      c.beginPath();
      c.arc(cx + ox + .3, cy + oy + .2, r * .28, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,220,200,.6)';
      ell(c, cx + ox - r * .35, cy + oy - r * .35, r * .3, r * .15, -.5);
    }
    if (rl) {
      // MISSILE GLAND: a second throat feeding the clutch
      c.fillStyle = '#8a3a30';
      ell(c, cx + 4, cy - 1.5, 1.6 + Math.sin($.T * .4) * .3, 1.1);
    }
  }
}
/** SPLIT: twin horn barrels, dorsal + ventral */
export function hornBarrels(c, fire) {
  const r = fire ? -1.2 : 0;
  for (const sg of [-1, 1]) {
    c.fillStyle = BONED;
    taper(c, -1, sg * 4.6, 7, sg * 9.6, 16 + r, sg * 8.2, 3.6, 2.4);
    c.fillStyle = BONE;
    taper(c, -1, sg * 4.2, 7, sg * 9, 16 + r, sg * 7.8, 2, 1.2);
    c.strokeStyle = BONED;
    c.lineWidth = .5;
    for (let k = 1; k < 5; k++) {
      const [px, py] = qpt(k / 5, -1, sg * 4.6, 7, sg * 9.6, 16 + r, sg * 8.2);
      ln(c, px - .3, py - 1.4, px + .3, py + 1.4);
    }
    c.fillStyle = '#140404';
    ell(c, 16 + r, sg * 8.2, .7, 1.2);
    add(c);
    gl(c, 16.5 + r, sg * 8.2, fire ? 6 : 3, '255,120,80', fire ? 1 : .6);
    nrm(c);
  }
}
/** ARC: prow nerve lance + glowing dorsal nerve cord with ganglia */
export function nerveSpine(c) {
  c.fillStyle = BONED;
  poly(c, [[13, -1.3], [28, 0], [13, 1.3]]);
  c.fillStyle = BONE;
  poly(c, [[13, -1.1], [28, 0], [13, 0]]);
  c.strokeStyle = '#1c2a44';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-12, -4.5);
  c.quadraticCurveTo(0, -9.5, 13, -1.5);
  c.stroke();
  add(c);
  c.strokeStyle = 'rgba(120,190,255,.85)';
  c.lineWidth = .55;
  c.stroke();
  const N = [];
  for (let k = 0; k < 5; k++) N.push(qpt(.1 + k * .2, -12, -4.5, 0, -9.5, 13, -1.5));
  N.push([28, 0]);
  N.forEach(([x, y], k) => {
    const p = .5 + .5 * Math.sin($.T * .35 + k * 1.3);
    gl(c, x, y, 3 + p * 2, '140,200,255', .7 + .3 * p);
  });
  c.strokeStyle = 'rgba(190,225,255,.95)';
  c.lineWidth = .45;
  for (let k = 0; k < N.length - 1; k++) {
    if (Math.random() < .45) continue;
    const [ax, ay] = N[k], [bx, by] = N[k + 1];
    c.beginPath();
    c.moveTo(ax, ay);
    for (let j = 1; j < 4; j++) c.lineTo(ax + (bx - ax) * j / 4 + (Math.random() - .5) * 2, ay + (by - ay) * j / 4 + (Math.random() - .5) * 2.4);
    c.lineTo(bx, by);
    c.stroke();
  }
  nrm(c);
  for (const [x, y] of N.slice(0, 5)) {
    c.fillStyle = '#2a3a5a';
    ell(c, x, y, 1.2, 1);
    c.fillStyle = '#b8dcff';
    ell(c, x - .3, y - .3, .5, .4);
  }
}
/** PYRE: burning eyes on long stalks */
export function pyreStalks(c, n, look, mini) {
  for (let p = 0; p < n; p++) {
    const sg = p ? 1 : -1, sw = Math.sin($.T * .07 + p * 2) * .8, ex = -11 + sw * .3, ey = sg * 10 + sw;
    c.fillStyle = '#4a1416';
    taper(c, -5, sg * 3.6, -6, sg * 8, ex, ey, 2.4, 1.2);
    if (!mini) for (let k = 0; k < 3; k++) {
      c.fillStyle = k ? 'rgba(255,170,40,.85)' : 'rgba(255,90,20,.8)';
      const fy = ey + (Math.random() - .5) * 2.4;
      poly(c, [[ex - 1, fy - 1.3], [ex - 6 - Math.random() * 5, fy], [ex - 1, fy + 1.3]]);
    }
    add(c);
    gl(c, ex, ey, 7, '255,110,30', .7);
    nrm(c);
    eye(c, ex, ey, 2.5, { ang: look, iris: '#ff3a10', fire: 1, bs: 2, dil: .7 });
  }
}
/** WRAITH umbilicals: one severed burning cord per follower */
export function umbilicals(c, n) {
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y0 = -1.6 + i * 1.6, ex = -18 - i * 2.5, ey = (i - 1) * 5 + Math.sin($.T * .1 + i * 2) * 1.5;
    c.strokeStyle = '#5a1a14';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-11, y0);
    c.quadraticCurveTo(-15, y0 + Math.sin($.T * .13 + i) * 3, ex, ey);
    c.stroke();
    add(c);
    gl(c, ex, ey, 3.5, '255,120,40', .8 + .2 * Math.sin($.T * .3 + i));
    nrm(c);
  }
  c.lineCap = 'butt';
}
/** WARD tiers: membrane caul (1), mirror scales (2), bone aegis plate (3) */
export function wardParts(c, w, on, aegis) {
  if (w >= 1) {
    const a = on ? .3 + .1 * Math.sin($.T * .15) : .1;
    c.fillStyle = `rgba(255,120,150,${a})`;
    c.beginPath();
    c.moveTo(-12, -3.5);
    c.quadraticCurveTo(-11, -9, -6, -10.5);
    c.quadraticCurveTo(0, -11.2, 6, -7);
    c.quadraticCurveTo(9, -5.2, 13, -2.2);
    c.quadraticCurveTo(4, -5.4, -4, -6.6);
    c.quadraticCurveTo(-9, -6, -12, -3.5);
    c.fill();
    c.strokeStyle = `rgba(255,170,190,${a + .25})`;
    c.lineWidth = .4;
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const x = -9 + k * 4;
      c.moveTo(x, hullTop(x) - .5);
      c.quadraticCurveTo(x - 1, hullTop(x) - 3, x - 2, hullTop(x) - 4.5 + Math.abs(x) * .12);
    }
    c.stroke();
  }
  if (w >= 2) {
    const g = ($.T * .5) % 46 - 14;
    for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) {
      const x = -9.5 + i * 3.6, y = sg < 0 ? hullTop(x) + 2 : -hullTop(x) - 2.2;
      c.fillStyle = '#56606c';
      ell(c, x, y, 2, 1.25, -.2 * sg);
      c.fillStyle = on ? '#8e9cac' : '#646c78';
      ell(c, x - .3, y - .25 * -sg, 1.6, .8, -.2 * sg);
      const k = 1 - Math.min(1, Math.abs(x - g) / 3);
      if (k > 0 && on) {
        add(c);
        gl(c, x, y, 2.5, '210,225,255', k * .6);
        nrm(c);
      }
    }
  }
  if (w >= 3) {
    c.globalAlpha = aegis > 0 ? 1 : .5;
    c.fillStyle = BONED;
    c.beginPath();
    c.moveTo(1, -6.6);
    c.quadraticCurveTo(9, -10, 15.5, -3.2);
    c.lineTo(13.5, -1.8);
    c.quadraticCurveTo(8, -6, 2, -5);
    c.closePath();
    c.fill();
    c.fillStyle = BONE;
    c.beginPath();
    c.moveTo(1.6, -6.6);
    c.quadraticCurveTo(9, -9.3, 14.6, -3.4);
    c.quadraticCurveTo(8, -7, 2.4, -5.6);
    c.closePath();
    c.fill();
    c.fillStyle = '#efe3c2';
    for (let k = 0; k < 4; k++) ell(c, 4 + k * 2.7, -7.2 + k * k * .35, .5, .5);
    c.strokeStyle = '#6a5a44';
    c.lineWidth = .35;
    c.beginPath();
    c.moveTo(6, -7.4);
    c.lineTo(7, -6.3);
    c.lineTo(6.6, -5.6);
    c.moveTo(11, -5.6);
    c.lineTo(11.6, -4.6);
    c.stroke();
    c.globalAlpha = 1;
  }
}

// ============================== GRAFTS ==============================
/** SWARM CADENCE (drones): buzzing insect wings */
export function droneWings(c, l) {
  const W = l > 1 ? [[-3, -6, 1], [-9, -5, .8]] : [[-4, -6, 1]];
  for (const [x, y, s] of W) {
    const fl = .35 + .65 * Math.abs(Math.sin($.T * 1.9 + x));
    for (const r of [-.35, -.85]) {
      c.save();
      c.translate(x, y);
      c.rotate(r - .3);
      c.scale(s, s * fl);
      c.fillStyle = 'rgba(190,210,200,.28)';
      ell(c, -7, 0, 8, 2.6);
      c.strokeStyle = 'rgba(40,30,30,.75)';
      c.lineWidth = .35;
      c.beginPath();
      c.ellipse(-7, 0, 8, 2.6, 0, 0, TAU);
      c.moveTo(0, 0);
      c.lineTo(-14, -.6);
      c.moveTo(-4, 0);
      c.lineTo(-9, 2);
      c.moveTo(-6, 0);
      c.lineTo(-11, -2);
      c.stroke();
      c.restore();
    }
    c.fillStyle = '#2a1414';
    ell(c, x, y, 1.4, 1);
  }
}
/** BONE NEEDLES (corpses): long forward-raking bone needles along the flanks */
export function boneNeedles(c, l) {
  const N = l > 1 ? [[-4, 1, 19], [-8, .7, 15], [-1, -.7, 17]] : [[-4, 1, 17]];
  for (const [x0, f, len] of N) for (const sg of [-1, 1]) {
    const y0 = sg * (f > 0 ? 4.6 : 5.2);
    c.fillStyle = BONED;
    taper(c, x0, y0, x0 + len * .5, sg * (7.2 + f), x0 + len, sg * (6.4 + f * 1.4), 1.9, .1);
    c.fillStyle = BONE;
    taper(c, x0, y0 - sg * .3, x0 + len * .5, sg * (6.9 + f), x0 + len - 1, sg * (6.2 + f * 1.4), .9, .1);
  }
}
/** OPTIC LOCK (eyes): extra eyes on swaying stalks */
export function opticStalks(c, l, look) {
  const S = [[-3, -6, -6, -15], [1, -6, 3, -13.5]];
  if (l > 1) S.push([-7, -5, -12, -12], [3, 5, 6, 12.5]);
  S.forEach(([x0, y0, x1, y1], i) => {
    const sw = Math.sin($.T * .06 + i * 1.7) * 1.4, ex = x1 + sw, ey = y1 + Math.cos($.T * .05 + i) * .6;
    c.fillStyle = '#5a1e20';
    taper(c, x0, y0, (x0 + ex) / 2 - sw, (y0 + ey) / 2, ex, ey, 1.8, .9);
    c.strokeStyle = '#8a3a34';
    c.lineWidth = .3;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + ex) / 2 - sw, (y0 + ey) / 2, ex, ey);
    c.stroke();
    add(c);
    gl(c, ex, ey, 4, '190,130,255', .3);
    nrm(c);
    const bl = ($.T + i * 41) % 190 < 5 ? 1 : 0;
    eye(c, ex, ey, 2.2, { ang: look, iris: '#9a5aff', bs: 1.6, blink: bl, lid: '#4a1818', dil: .8 });
  });
}
/** REAR MANDIBLE (crawlers): snapping pincers on the tail */
export function rearMandible(c, l, fire) {
  const s = l > 1 ? 1.35 : 1, op = .25 + .25 * Math.max(0, Math.sin($.T * (fire ? .5 : .12)));
  for (const sg of [-1, 1]) {
    c.save();
    c.translate(-11.5, sg * 2);
    c.rotate(sg * op);
    c.scale(s, s);
    c.fillStyle = BONED;
    poly(c, [[0, -1.3 * sg], [-7, sg * 1.8], [-10, sg * .2], [-9, -sg * .6], [-6, sg * .4], [0, sg * 1.2]]);
    c.fillStyle = BONE;
    poly(c, [[0, -1 * sg], [-7, sg * 1.4], [-9.6, sg * .2], [-6.5, sg * .4]]);
    c.fillStyle = '#f0e6d0';
    for (let k = 0; k < (l > 1 ? 4 : 2); k++) poly(c, [[-3 - k * 1.6, -sg * .1], [-3.8 - k * 1.6, -sg * 1.3], [-4.4 - k * 1.6, -sg * .1]]);
    c.restore();
  }
}
/** HALO RIPPLE (crosses): a tilted halo of little crosses over the back */
export function haloRipple(c, l) {
  const cx = -4, cy = -13;
  for (let r = 0; r < l; r++) {
    const rx = 7 + r * 2.4, ry = 2 + r * .6, rot = $.T * .03 * (r ? -1 : 1);
    add(c);
    c.strokeStyle = `rgba(255,140,170,${.55 + .2 * Math.sin($.T * .2 + r)})`;
    c.lineWidth = .9;
    c.beginPath();
    c.ellipse(cx, cy - r * 1.4, rx, ry, -.12, 0, TAU);
    c.stroke();
    nrm(c);
    const n = 5 + r * 2;
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * TAU, x = cx + Math.cos(a) * rx, y = cy - r * 1.4 + Math.sin(a) * ry;
      c.fillStyle = Math.sin(a) > 0 ? BONE : BONEM;
      c.fillRect(x - .35, y - 1.6, .7, 2.6);
      c.fillRect(x - .9, y - .9, 1.8, .6);
    }
  }
  c.strokeStyle = 'rgba(160,80,90,.6)';
  c.lineWidth = .4;
  ln(c, -4, -7, cx, cy + 1.8);
}
/** MEATHOOK ARC (hooks): rusted hooks swinging on chains under the belly */
export function meathooks(c, l) {
  const H = l > 1 ? [-6, 0, 6] : [-3, 4];
  H.forEach((x0, i) => {
    const y0 = -hullTop(x0) - .5, sw = Math.sin($.T * .08 + i * 1.9) * 3, L = 6 + i % 2 * 2, hx = x0 - 1.5 + sw * .5, hy = y0 + L;
    c.strokeStyle = METAL;
    c.lineWidth = .6;
    for (let k = 0; k < 4; k++) {
      const t0 = k / 4, t1 = (k + .8) / 4;
      c.beginPath();
      c.ellipse(x0 + (hx - x0) * (t0 + t1) / 2, y0 + (hy - y0) * (t0 + t1) / 2, .5, .9, Math.atan2(hy - y0, hx - x0) + Math.PI / 2, 0, TAU);
      c.stroke();
    }
    c.strokeStyle = '#7a6a5a';
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx, hy + 2.5);
    c.arc(hx + 1.6, hy + 2.5, 1.6, Math.PI, 0, true);
    c.lineTo(hx + 3.2, hy + 1.2);
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = '#8a0610';
    ell(c, hx + 2.6, hy + 3.8, .6, .9);
  });
}
/** FLAYED EDGE (flayers): bloody sawtooth fins down the dorsal and ventral line */
export function flayedEdge(c, l) {
  const n = 7 + l * 2, h = 1.8 + l * .8;
  for (const sg of [-1, 1]) {
    const P = [];
    for (let k = 0; k <= n; k++) {
      const x = -11 + k * 22 / n, b = sg < 0 ? hullTop(x) + .2 : -hullTop(x) - .4;
      P.push([x, b]);
      if (k < n) P.push([x + 22 / n * .2, b + sg * h * (1 - Math.abs(k / n - .45) * .8)]);
    }
    P.push([11, 0]);
    P.push([-11, 0]);
    c.fillStyle = '#7a1418';
    poly(c, P);
    c.fillStyle = '#c8b090';
    for (let k = 0; k < n; k++) {
      const x = -11 + k * 22 / n, b = sg < 0 ? hullTop(x) + .2 : -hullTop(x) - .4, hh = h * (1 - Math.abs(k / n - .45) * .8);
      poly(c, [[x + 22 / n * .05, b + sg * hh * .4], [x + 22 / n * .2, b + sg * hh], [x + 22 / n * .35, b + sg * hh * .4]]);
    }
    if (l > 1) {
      c.fillStyle = '#9a0612';
      for (let k = 0; k < 3; k++) {
        const x = -7 + k * 6, dd = ($.T * .3 + k * 5) % 7;
        if (sg > 0) c.fillRect(x, -hullTop(x) + h + dd * .6, .6, 1.4);
      }
    }
  }
}
/** GLUTTONY (maws): a lamprey mouth chewing on the forward belly */
export function gluttonyMaw(c, l) {
  const r = 2.6 + l * .7, op = .45 + .55 * Math.abs(Math.sin($.T * .09)), x = 7.5, y = 4.6;
  c.fillStyle = '#4e1012';
  ell(c, x, y, r + .9, r * .8 + .9);
  c.fillStyle = '#1a0204';
  ell(c, x, y, r * op, r * .8 * op);
  c.fillStyle = '#efe3c2';
  const n = 9 + l * 3;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, ox = Math.cos(a), oy = Math.sin(a) * .8;
    poly(c, [[x + ox * (r + .5) - oy * .45, y + oy * (r + .5) + ox * .36], [x + ox * r * op * .6, y + oy * r * op * .6], [x + ox * (r + .5) + oy * .45, y + oy * (r + .5) - ox * .36]]);
  }
  if (l > 1) {
    c.fillStyle = '#c0404a';
    taper(c, x, y, x + 3, y + 3 + Math.sin($.T * .2) * 2, x + 6, y + 2, 1.4, .3);
  }
}
/** CALIBER: a bone bore under the jaws that thickens per level */
export function caliberBore(c, l, fire) {
  const r = 1.3 + l * .5, x0 = 11, x1 = 16 + l * 1.6 - (fire ? 1 : 0);
  c.fillStyle = BONED;
  c.fillRect(x0, -r - .5, x1 - x0, r * 2 + 1);
  c.fillStyle = BONEM;
  c.fillRect(x0, -r - .5, x1 - x0, r * .6);
  c.fillStyle = '#2a2018';
  for (let k = 0; k <= l; k++) c.fillRect(x0 + 1 + k * (x1 - x0 - 2) / Math.max(1, l), -r - .7, .6, r * 2 + 1.4);
  c.fillStyle = '#100202';
  ell(c, x1, 0, .7, r);
  if (fire) {
    add(c);
    gl(c, x1 + 1, 0, 4 + l * 2, '255,200,140', .9);
    nrm(c);
  }
}
/** REGROWTH (wombs): a translucent womb sac with something curled inside */
export function wombSac(c, l) {
  const p = 1 + .07 * Math.sin($.T * .12), x = -6.5, y = 6.2, r = (2.8 + l * .8) * p;
  c.fillStyle = 'rgba(150,170,200,.5)';
  ell(c, x, y, r * 1.2, r);
  c.fillStyle = 'rgba(200,90,110,.75)';
  c.beginPath();
  c.arc(x + .3, y + .2, r * .5, .5, 5.2);
  c.lineTo(x + .3, y + .2);
  c.fill();
  c.fillStyle = '#2a0a10';
  ell(c, x + r * .35, y - r * .15, .4, .4);
  c.strokeStyle = 'rgba(220,235,255,.6)';
  c.lineWidth = .35;
  c.beginPath();
  c.ellipse(x, y, r * 1.2, r, 0, 3.6, 5.6);
  c.stroke();
}
/** SPORE COAT (hatchlings): pustule pods that puff spores */
export function sporePods(c, l) {
  const P = l > 1 ? [[-9, -5.2, 1.8], [-6, -6.4, 1.5], [-11.5, -3.6, 1.4], [-3, -6.8, 1.3]] : [[-9, -5.2, 1.8], [-6, -6.4, 1.4]];
  P.forEach(([x, y, r], i) => {
    const p = 1 + .15 * Math.sin($.T * .2 + i * 2);
    c.fillStyle = '#6a7a3a';
    ell(c, x, y, r * p, r * p * .85);
    c.fillStyle = '#c0d070';
    ell(c, x - .3, y - .4, r * .4, r * .3);
    c.fillStyle = '#2a3010';
    ell(c, x + .2, y - r * .6, .4, .3);
    const a = (($.T + i * 13) % 40) / 40;
    c.fillStyle = `rgba(200,230,140,${.7 * (1 - a)})`;
    for (let k = 0; k < 3; k++) c.fillRect(x - a * 8 + k, y - r - a * 6 - k * .8, .7, .7);
  });
}

// ============================== PERK TELLS ==============================
/** small tells drawn over the hull */
export function perkTells(c, p, beat) {
  if (p.dmg) {
    add(c);
    c.strokeStyle = `rgba(255,${40 + beat * 60 | 0},30,${.25 + p.dmg * .18 + beat * .2})`;
    c.lineWidth = .5;
    c.beginPath();
    c.moveTo(-10, -2.6);
    c.quadraticCurveTo(-5, -5, 0, -3.8);
    c.quadraticCurveTo(5, -3, 11, -1.6);
    c.moveTo(-6, -4.2);
    c.lineTo(-4.5, -2.2);
    c.moveTo(3, -3.6);
    c.lineTo(4, -1.8);
    if (p.dmg > 1) {
      c.moveTo(-9, 2.6);
      c.quadraticCurveTo(0, 5, 9, 2.4);
    }
    if (p.dmg > 2) {
      c.moveTo(-11, 0);
      c.lineTo(12, -.4);
    }
    c.stroke();
    nrm(c);
  }
  if (p.spd) {
    c.strokeStyle = 'rgba(230,210,190,.7)';
    c.lineWidth = .25;
    c.beginPath();
    for (let k = 0; k < p.spd + 1; k++) {
      c.moveTo(13, -1.2 + k * .5);
      c.lineTo(-13, -3 + k * 1.6);
    }
    c.stroke();
  }
  if (p.crit) {
    // HOLLOW HEART: the heart glow has a black hole in it
    c.fillStyle = '#050102';
    ell(c, -3.5, -1.4, .8 + p.crit * .45, .6 + p.crit * .3);
  }
  if (p.volatile) {
    const V = [[-8, -3.5], [2, 3.8], [-3, 4.4], [6, -3], [-10, 1.5], [9, 2]];
    for (let k = 0; k < p.volatile * 2; k++) {
      const [x, y] = V[k], q = 1 + .25 * Math.sin($.T * .25 + k * 2);
      c.fillStyle = '#7a7a20';
      ell(c, x, y, 1.1 * q, .9 * q);
      c.fillStyle = '#d8d860';
      ell(c, x - .25, y - .25, .45 * q, .35 * q);
    }
  }
  if (p.scab) {
    c.fillStyle = '#3a1608';
    const S = [[-6, -1], [4, -2.6], [-1, 2.6]];
    for (let k = 0; k < p.scab; k++) poly(c, [[S[k][0] - 1.5, S[k][1]], [S[k][0] - .4, S[k][1] - 1.1], [S[k][0] + 1.6, S[k][1] - .5], [S[k][0] + .9, S[k][1] + .9]]);
  }
  if (p.inv) {
    c.fillStyle = '#c89a70';
    ell(c, -8, 0, 1.8 + p.inv * .4, 1.2);
    c.fillStyle = '#5a3a20';
    for (let k = 0; k < 5; k++) c.fillRect(-9.2 + k * .6, -.6 + (k % 2) * .7, .35, .35);
  }
  if (p.graze) {
    c.strokeStyle = 'rgba(255,220,200,.55)';
    c.lineWidth = .25;
    c.beginPath();
    for (let k = 0; k < p.graze * 2; k++) {
      const sg = k % 2 ? 1 : -1, w = Math.sin($.T * .15 + k) * 1.5;
      c.moveTo(13, sg * 1.5);
      c.quadraticCurveTo(18, sg * (4 + k), 23, sg * (6 + k) + w);
    }
    c.stroke();
  }
  if (p.magnet) {
    c.strokeStyle = '#5a4a3a';
    c.lineWidth = .5;
    ln(c, -5, -6, -8, -13 - p.magnet * 2);
    add(c);
    gl(c, -8, -13 - p.magnet * 2, 3 + Math.sin($.T * .2), '120,255,160', .9);
    nrm(c);
  }
  if (p.frost) {
    c.fillStyle = 'rgba(200,235,255,.85)';
    for (let k = 0; k < 2 + p.frost * 2; k++) {
      const x = -8 + k * 3.6, b = hullTop(x) + .3;
      poly(c, [[x - .6, b], [x + .2, b - 2 - (k % 2) * 1.4], [x + .7, b]]);
    }
  }
  if (p.corrode) {
    c.fillStyle = 'rgba(120,230,60,.85)';
    for (let k = 0; k < 2 + p.corrode; k++) {
      const x = -6 + k * 4.5, dd = ($.T * .2 + k * 6) % 8;
      ell(c, x, 4 + dd * .6, .5, .5 + dd * .1);
    }
  }
  if (p.ignite) {
    add(c);
    for (let k = 0; k < 2 + p.ignite; k++) {
      const x = -8 + k * 5, b = hullTop(x), f = Math.random();
      c.fillStyle = 'rgba(255,120,30,.75)';
      poly(c, [[x - 1, b + .5], [x - 2.4 - f * 2, b - 2.5 - f * 2], [x + 1, b + .3]]);
    }
    nrm(c);
  }
  if (p.snot) {
    const q = 1 + .25 * Math.sin($.T * .1);
    c.fillStyle = 'rgba(160,220,90,.8)';
    ell(c, 16, 1.6, 1.4 * q, 1.1 * q);
    c.fillStyle = 'rgba(230,255,200,.8)';
    ell(c, 15.6, 1.2, .4, .3);
  }
}
/** TAPEWORM: it hangs out of the back, wriggling */
export function tapeworm(c) {
  let px = -12, py = 2.5;
  for (let k = 1; k <= 9; k++) {
    const x = -12 - k * 2, y = 2.5 + k * .6 + Math.sin($.T * .15 - k * .7) * (k * .25);
    c.strokeStyle = k % 2 ? '#e8dcc0' : '#c8b898';
    c.lineWidth = 1.6 - k * .1;
    ln(c, px, py, x, y);
    px = x;
    py = y;
  }
}
/** GLASS JAW: mandibles turn to cracked glass */
export function glassJaw(c) {
  add(c);
  c.fillStyle = 'rgba(160,210,255,.35)';
  poly(c, [[11, -2.6], [19.5, -1.8], [17.5, -.6], [13, -.6]]);
  poly(c, [[11, 2.6], [19, 1.6], [17, .6], [13, .6]]);
  nrm(c);
  c.strokeStyle = 'rgba(240,250,255,.8)';
  c.lineWidth = .25;
  c.beginPath();
  c.moveTo(13, -2);
  c.lineTo(15, -1.2);
  c.lineTo(16, -1.8);
  c.moveTo(14, 2);
  c.lineTo(16, 1.1);
  c.stroke();
}

// ============================== HULL TIERS ==============================
/** behind the hull: bloat sac (2+), dorsal crest + viscera (3) */
export function tierBack(c, t, beat) {
  if (t >= 3) {
    // raked bone crest with tattered membrane
    const C = [[-11, 9], [-7.5, 12], [-4, 13], [-0.5, 11], [3, 8]];
    c.fillStyle = 'rgba(110,30,36,.75)';
    c.beginPath();
    c.moveTo(-12, hullTop(-12));
    C.forEach(([x, h]) => c.lineTo(x - h * .5, hullTop(x) - h));
    c.lineTo(4, hullTop(4));
    c.fill();
    for (const [x, h] of C) {
      c.fillStyle = BONED;
      taper(c, x, hullTop(x) + 1, x - h * .2, hullTop(x) - h * .6, x - h * .5, hullTop(x) - h, 2.4, .2);
      c.fillStyle = BONE;
      taper(c, x - .3, hullTop(x) + 1, x - h * .2 - .3, hullTop(x) - h * .6, x - h * .5, hullTop(x) - h, 1.1, .1);
    }
    // trailing viscera
    c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.strokeStyle = k ? '#8a3a40' : '#6a2a30';
      c.lineWidth = 1.7 - k * .4;
      c.beginPath();
      c.moveTo(-8 + k * 3, 6);
      for (let j = 1; j <= 6; j++) c.lineTo(-8 + k * 3 - j * 2.6, 7 + j * 1.1 + Math.sin($.T * .09 - j * .8 + k * 2) * j * .45);
      c.stroke();
    }
    c.lineCap = 'butt';
  }
  if (t >= 2) {
    // swollen ventral bloat sac, veins pulsing
    const p = 1 + beat * .06;
    c.fillStyle = '#3a0e14';
    ell(c, -5, 5.6, 9.4 * p, 5.4 * p);
    c.fillStyle = `rgb(${120 + beat * 50 | 0},40,52)`;
    ell(c, -5, 5.4, 8.6 * p, 4.7 * p);
    c.fillStyle = 'rgba(255,160,170,.25)';
    ell(c, -7, 4, 4, 1.6);
    c.strokeStyle = '#2a0408';
    c.lineWidth = .4;
    c.beginPath();
    c.moveTo(-12, 5);
    c.quadraticCurveTo(-8, 9, -3, 8.6);
    c.quadraticCurveTo(0, 8, 3, 6.4);
    c.moveTo(-8, 8.4);
    c.lineTo(-9, 9.6);
    c.moveTo(-3, 8.6);
    c.lineTo(-2.4, 9.8);
    c.stroke();
    // outer rib cage clamped round the sac
    c.strokeStyle = '#2a1e16';
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = -11 + i * 3.4;
      c.beginPath();
      c.moveTo(x + 2, 3);
      c.quadraticCurveTo(x - 3, 7, x - 1, 10 - i * .6);
      c.stroke();
    }
    c.strokeStyle = BONEM;
    c.lineWidth = .8;
    for (let i = 0; i < 4; i++) {
      const x = -11 + i * 3.4;
      c.beginPath();
      c.moveTo(x + 2, 3);
      c.quadraticCurveTo(x - 3, 7, x - 1, 10 - i * .6);
      c.stroke();
    }
    c.lineCap = 'butt';
  }
}
/** over the hull: armour plates (1+), outer rib cage (2+) */
export function tierFront(c, t) {
  if (t >= 1) {
    for (let i = 0; i < 4; i++) {
      const x = -9.5 + i * 4.6, y = hullTop(x) + .2;
      c.fillStyle = '#3a2e22';
      c.beginPath();
      c.ellipse(x, y, 3.2, 2.1, -.22, Math.PI, TAU);
      c.fill();
      c.fillStyle = '#5a4c3c';
      c.beginPath();
      c.ellipse(x - .2, y - .2, 2.7, 1.6, -.22, Math.PI, TAU);
      c.fill();
      c.fillStyle = '#a89878';
      c.fillRect(x - 1.5, y - 1.5, 2.2, .45);
    }
    for (let i = 0; i < 3; i++) {
      const x = -7 + i * 5, y = -hullTop(x) - .2;
      c.fillStyle = '#4a3a2c';
      c.beginPath();
      c.ellipse(x, y, 2.6, 1.4, .2, 0, Math.PI);
      c.fill();
    }
  }
}
/** FLESH SCULPT (Infirmary cosmetic): brow horns, tusks, crown */
export function sculptParts(c, sc) {
  if (sc >= 1) for (const [x, y, h] of [[5, -4.5, 5], [8.6, -4, 4]]) {
    c.fillStyle = BONED;
    taper(c, x, y, x - 1, y - h * .7, x - 3.5, y - h, 1.8, .15);
    c.fillStyle = BONE;
    taper(c, x - .2, y, x - 1.2, y - h * .7, x - 3.5, y - h, .8, .1);
  }
  if (sc >= 2) {
    c.fillStyle = BONE;
    taper(c, 10, 3.6, 14, 7, 17.5, 5, 1.8, .15);
    taper(c, 10, -3.6, 14, -7.4, 17, -6.4, 1.5, .15);
  }
  if (sc >= 3) for (let k = 0; k < 5; k++) {
    const x = 3 + k * 1.6, a = -1.6 + (k - 2) * .25;
    c.fillStyle = k % 2 ? BONEM : BONE;
    taper(c, x, -4.8, x + Math.cos(a) * 2, -4.8 + Math.sin(a) * 2.5, x + Math.cos(a) * 3.5 - 1.2, -4.8 + Math.sin(a) * 4.2, 1, .1);
  }
}

// ============================== CONTRAPTIONS ==============================
const R0 = { saw: { spin: .25 }, gut: { charge: 0 }, leech: { fill: .5 }, spine: { cd: 0 }, hook: { phase: 0 }, furnace: { heat: .5 }, choir: { chg: .3 } };
const rs = (id) => ($.P && $.P.rig && $.P.rig[id]) || R0[id];
let sawA = 0, sawT = 0, gutPrev = 0, gutRecT = -99;

/** FURNACE BELLY: riveted chimneys raked up/down off the stern, grilles glowing, belching black smoke */
export function rigFurnace(c, l, mini) {
  const heat = Math.max(0, Math.min(1, rs('furnace').heat ?? .5)), len = 8 + l * 2, wd = 3.6 + l * .5;
  const ST = l >= 3 ? [[-1, .62, 1], [1, .62, 1], [-1, 1.05, .7], [1, 1.05, .7]] : [[-1, .62, 1], [1, .62, 1]];
  for (const [sg, ang, k] of ST) {
    const a = Math.PI - sg * ang, L = len * k, x0 = -12, y0 = sg * 4;
    const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(-a) * -L;
    // smoke (rises / trails back)
    if (!mini) for (let q = 0; q < 4; q++) {
      const t = (($.T * (.5 + heat * .7) + q * 10 + sg * 5) % 40) / 40, r = 1.6 + t * (4 + heat * 2.5);
      c.fillStyle = `rgba(${26 + heat * 20 | 0},18,18,${.7 * (1 - t)})`;
      ell(c, ex - t * 16, ey + sg * t * 3 - t * 5, r, r * .85);
    }
    c.save();
    c.translate(x0, y0);
    c.rotate(Math.atan2(ey - y0, ex - x0));
    c.fillStyle = '#120c0c';
    c.fillRect(-1, -wd / 2 - .7, L + 1.4, wd + 1.4);
    c.fillStyle = '#3c4048';
    c.fillRect(0, -wd / 2, L, wd);
    c.fillStyle = '#6c7480';
    c.fillRect(0, -wd / 2, L, wd * .28);
    // grille slits: the fire inside
    const hc = `rgb(255,${80 + heat * 150 | 0},${20 + heat * 60 | 0})`;
    c.fillStyle = heat > .15 ? hc : '#3a1a10';
    for (let q = 0; q < 3; q++) c.fillRect(1.2 + q * L / 3.4, -wd * .18, L / 6, wd * .36);
    // flared cowl
    c.fillStyle = '#120c0c';
    poly(c, [[L - .6, -wd / 2 - .8], [L + 2.2, -wd / 2 - 1.8], [L + 2.2, wd / 2 + 1.8], [L - .6, wd / 2 + .8]]);
    c.fillStyle = '#56606c';
    poly(c, [[L - .2, -wd / 2 - .4], [L + 1.8, -wd / 2 - 1.3], [L + 1.8, -wd / 2], [L - .2, -wd / 2 + .4]]);
    c.fillStyle = hc;
    c.fillRect(L + 1.6, -wd / 2 - .6, .8, wd + 1.2);
    add(c);
    c.fillStyle = `rgba(255,${150 + heat * 90 | 0},70,${.35 + heat * .55})`;
    poly(c, [[L + 2, -wd / 2], [L + 3.5 + heat * (3 + Math.random() * 3), 0], [L + 2, wd / 2]]);
    nrm(c);
    c.restore();
  }
}
/** CHOIR OF MOUTHS: a fleshy collar ring studded with big lipped mouths; they gape as choir.chg fills, scream at 1 */
export function rigChoir(c, l) {
  const chg = Math.max(0, Math.min(1, rs('choir').chg ?? .3)), n = 3 + l * 2, scream = chg > .95;
  c.strokeStyle = '#2a0608';
  c.lineWidth = 2.2;
  c.beginPath();
  c.ellipse(0, 0, 13, 10.5, 0, 0, TAU);
  c.stroke();
  c.strokeStyle = '#7a2228';
  c.lineWidth = 1.1;
  c.stroke();
  for (let k = 0; k < n; k++) {
    const a = .7 + k / (n - 1) * (TAU - 1.4), x = Math.cos(a) * 13, y = Math.sin(a) * 10.5;
    const op = Math.min(1, chg * (.55 + .45 * Math.abs(Math.sin($.T * .1 + k * 1.7))) + (scream ? .35 : 0));
    c.save();
    c.translate(x, y);
    c.rotate(a + Math.PI / 2);
    c.fillStyle = '#1e0406';
    ell(c, 0, 0, 3.3, 1.7 + op * 1.6);
    c.fillStyle = '#d0505c';
    ell(c, 0, 0, 2.8, 1.3 + op * 1.4);
    c.fillStyle = '#ff9aa4';
    ell(c, -.4, -.6 - op * .7, 1.4, .35);
    c.fillStyle = '#0a0002';
    ell(c, 0, 0, 2, .25 + op * 1.15);
    c.fillStyle = '#f4ecd8';
    for (let j = -1; j <= 1; j++) {
      c.fillRect(j * .75 - .25, -.2 - op * 1.05, .5, .6);
      c.fillRect(j * .75 - .25, op * 1.05 - .4, .5, .6);
    }
    c.restore();
    if (scream) {
      add(c);
      c.strokeStyle = `rgba(255,190,210,${.55 + .3 * Math.sin($.T * .8 + k)})`;
      c.lineWidth = .6;
      const w = ($.T * .5 + k) % 5;
      c.beginPath();
      c.arc(x, y, 2.5 + w, a - .45, a + .45);
      c.stroke();
      nrm(c);
    }
  }
}
/** GUT CANNON: a swollen offal bladder feeding a ribbed belly barrel; swells with charge, kicks back on firing */
export function rigGut(c, l) {
  const ch = Math.max(0, Math.min(1, rs('gut').charge || 0));
  if (gutPrev > .6 && ch < .25) gutRecT = $.T;
  gutPrev = ch;
  const rc = Math.max(0, 1 - ($.T - gutRecT) / 12), x = 6 - rc * 3, y = 7.5, w = 3.6 + l * .8, sw = ch * 1.8, bl = 10 + l * 1.5;
  // bladder
  c.fillStyle = '#1a0406';
  ell(c, x - 3.5, y + .3, 4.4 + sw, 3.4 + sw * .8);
  c.fillStyle = `rgb(${120 + ch * 110 | 0},${36 + ch * 50 | 0},${36 + ch * 10 | 0})`;
  ell(c, x - 3.5, y, 3.7 + sw, 2.8 + sw * .8);
  c.fillStyle = 'rgba(255,200,180,.45)';
  ell(c, x - 4.6, y - 1.2, 1.6 + sw * .4, .7);
  c.strokeStyle = '#3a0408';
  c.lineWidth = .5;
  c.beginPath();
  c.moveTo(x - 6.5, y + 1);
  c.quadraticCurveTo(x - 4, y + 2.6, x - 1, y + 1.2);
  c.stroke();
  // barrel
  c.fillStyle = '#120404';
  c.fillRect(x - 1.5, y - w / 2 - .6, bl + 1, w + 1.2);
  c.fillStyle = '#6a2a22';
  c.fillRect(x - 1, y - w / 2, bl, w);
  c.fillStyle = '#b06050';
  c.fillRect(x - 1, y - w / 2, bl, w * .3);
  c.fillStyle = BONE;
  for (let k = 0; k < 3; k++) c.fillRect(x + .5 + k * bl / 3.3, y - w / 2 - .7, 1.2, w + 1.4);
  // muzzle
  c.fillStyle = '#120404';
  ell(c, x + bl, y, 1.6, w / 2 + 1);
  c.fillStyle = '#d06a5a';
  ell(c, x + bl - .2, y, 1.1, w / 2 + .5);
  c.fillStyle = '#000';
  ell(c, x + bl + .2, y, .6, w / 2 - .4 + rc * .5);
  if (ch > .85) {
    add(c);
    gl(c, x + bl + 1, y, 3 + Math.sin($.T * .5), '255,150,80', .7);
    nrm(c);
  }
  if (rc > 0) {
    add(c);
    gl(c, x + bl + 2, y, 5 + rc * 9, '255,200,140', rc);
    nrm(c);
  }
}
/** LEECH PUMP: an anatomical heart riding the spine, aorta plugged into a blood vial that fills with kills */
export function rigLeech(c, l) {
  const fill = Math.max(0, Math.min(1, rs('leech').fill ?? .5)), rate = .13 + fill * .12, b = Math.pow(Math.max(0, Math.sin($.T * rate)), 4);
  const x = -1, y = -10, s = (1.05 + l * .15) * (1 + b * .16);
  // vial behind / beside the heart
  const vx = x - 7, vy = y - .5, vh = 7 + l, vw = 3;
  c.fillStyle = '#120c0c';
  c.fillRect(vx - vw / 2 - .6, vy - vh / 2 - 1.4, vw + 1.2, vh + 2.6);
  c.fillStyle = 'rgba(150,170,190,.55)';
  c.fillRect(vx - vw / 2, vy - vh / 2, vw, vh);
  const fh = vh * fill;
  c.fillStyle = fill > .98 ? `rgb(${220 + b * 35 | 0},20,40)` : '#a00818';
  c.fillRect(vx - vw / 2, vy + vh / 2 - fh, vw, fh);
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.fillRect(vx - vw / 2 + .4, vy - vh / 2 + .4, .5, vh - .8);
  c.fillStyle = '#8d98a6';
  c.fillRect(vx - vw / 2 - .6, vy - vh / 2 - 1.4, vw + 1.2, 1);
  c.fillRect(vx - vw / 2 - .6, vy + vh / 2, vw + 1.2, 1);
  if (fill > .98) {
    add(c);
    gl(c, vx, vy, 6, '255,40,60', .6 + b * .4);
    nrm(c);
  }
  // hoses: aorta into the vial, veins into the hull
  c.lineCap = 'round';
  c.strokeStyle = '#1a0204';
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(x - 1, y - 3);
  c.quadraticCurveTo(x - 3, y - 6.5, vx + .5, vy - vh / 2 - 1);
  c.moveTo(x - 2, y + 2);
  c.lineTo(x - 4, y + 5);
  c.moveTo(x + 2, y + 2);
  c.lineTo(x + 4, y + 4.4);
  c.stroke();
  c.strokeStyle = '#b01828';
  c.lineWidth = .9;
  c.stroke();
  c.lineCap = 'butt';
  // heart
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(-.35);
  c.fillStyle = '#1a0204';
  c.beginPath();
  c.moveTo(-3.2, -1.6);
  c.quadraticCurveTo(-3.4, -3.8, -.6, -3.4);
  c.quadraticCurveTo(2.6, -4, 3.4, -1);
  c.quadraticCurveTo(3.4, 2.2, 0, 4.6);
  c.quadraticCurveTo(-3.8, 2.4, -3.2, -1.6);
  c.fill();
  c.fillStyle = `rgb(${165 + b * 80 | 0},${22 + b * 20 | 0},32)`;
  c.beginPath();
  c.moveTo(-2.6, -1.5);
  c.quadraticCurveTo(-2.8, -3.2, -.5, -2.8);
  c.quadraticCurveTo(2.2, -3.3, 2.8, -.9);
  c.quadraticCurveTo(2.8, 1.8, 0, 3.8);
  c.quadraticCurveTo(-3.1, 2, -2.6, -1.5);
  c.fill();
  c.fillStyle = '#ff8080';
  ell(c, -1.3, -1.6, .9, .5, -.4);
  c.strokeStyle = '#4a0610';
  c.lineWidth = .45;
  c.beginPath();
  c.moveTo(.4, -2.8);
  c.quadraticCurveTo(-.6, .4, .2, 3.4);
  c.stroke();
  // aortic stubs
  c.fillStyle = '#d8b0a0';
  c.fillRect(-.6, -4.6, 1.2, 1.6);
  c.fillRect(1.2, -4.2, 1, 1.4);
  c.restore();
}
/** BONE SAW: a fat ripsaw of sharpened ribs on the prow; spins up with saw.spin */
export function rigSaw(c, l, mini) {
  const spin = Math.max(0, Math.min(1, rs('saw').spin ?? .25)), x = 14, y = 0, r = 5.4 + l * 1.4, n = 6 + l * 2;
  const dt = Math.max(0, Math.min(4, $.T - sawT));
  sawT = $.T;
  sawA += dt * (.05 + spin * .55);
  // mount strut
  c.fillStyle = '#120c0c';
  poly(c, [[6, -2.6], [x, -1.4], [x, 1.4], [6, 2.6]]);
  c.fillStyle = '#4a525c';
  poly(c, [[6.5, -1.9], [x, -.9], [x, -.2], [6.5, -.8]]);
  if (spin > .45 && !mini) {
    c.fillStyle = `rgba(230,215,185,${(spin - .45) * .5})`;
    c.beginPath();
    c.arc(x, y, r + 2, 0, TAU);
    c.fill();
  }
  c.save();
  c.translate(x, y);
  c.rotate(sawA);
  // teeth: big hooked bone fangs
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, a2 = a + TAU / n;
    c.fillStyle = '#120c0c';
    poly(c, [[Math.cos(a) * (r - 1), Math.sin(a) * (r - 1)], [Math.cos(a + .25) * (r + 3), Math.sin(a + .25) * (r + 3)], [Math.cos(a2) * (r - .6), Math.sin(a2) * (r - .6)]]);
    c.fillStyle = '#efe3c2';
    poly(c, [[Math.cos(a + .05) * (r - .6), Math.sin(a + .05) * (r - .6)], [Math.cos(a + .25) * (r + 2.4), Math.sin(a + .25) * (r + 2.4)], [Math.cos(a2 - .1) * (r - .4), Math.sin(a2 - .1) * (r - .4)]]);
  }
  // disc
  c.fillStyle = '#120c0c';
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
  c.fillStyle = '#5a4a3a';
  c.beginPath();
  c.arc(0, 0, r - .8, 0, TAU);
  c.fill();
  // rib spokes (curved: reads as spin direction)
  c.strokeStyle = '#d8c8a4';
  c.lineWidth = 1.1;
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU;
    c.beginPath();
    c.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 1.5);
    c.quadraticCurveTo(Math.cos(a + .7) * r * .55, Math.sin(a + .7) * r * .55, Math.cos(a + .3) * (r - 1), Math.sin(a + .3) * (r - 1));
    c.stroke();
  }
  c.fillStyle = '#9a1018';
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + .9;
    ell(c, Math.cos(a) * r * .62, Math.sin(a) * r * .62, .9, .7, a);
  }
  c.restore();
  c.fillStyle = '#120c0c';
  c.beginPath();
  c.arc(x, y, 2.2, 0, TAU);
  c.fill();
  c.fillStyle = '#c0141c';
  c.beginPath();
  c.arc(x, y, 1.3, 0, TAU);
  c.fill();
  if (spin > .7 && !mini) {
    add(c);
    c.fillStyle = 'rgba(255,220,160,.95)';
    for (let k = 0; k < 3; k++) {
      const a = -.6 + Math.random() * 1.2;
      c.fillRect(x + Math.cos(a) * (r + 2.5), y + Math.sin(a) * (r + 2.5), 1, 1);
    }
    nrm(c);
  }
}
/** MEAT WINCH: drum + arm + chain + hook (stowed, or harpooning toward rig.hook.tx/ty in world space) */
export function rigHook(c, l, x, y, s) {
  const h = rs('hook'), ph = Math.max(0, Math.min(1, h.phase || 0));
  const dx = 2, dy = 8;
  c.fillStyle = '#20181a';
  c.beginPath();
  c.arc(dx, dy, 3.2, 0, TAU);
  c.fill();
  c.fillStyle = METAL;
  c.beginPath();
  c.arc(dx, dy, 2.6, 0, TAU);
  c.fill();
  c.strokeStyle = '#8a7a6a';
  c.lineWidth = .5;
  c.beginPath();
  c.arc(dx, dy, 1.8, 0, TAU);
  c.stroke();
  const ra = $.T * (ph > 0 ? .6 : .02);
  c.strokeStyle = '#20181a';
  for (let k = 0; k < 3; k++) ln(c, dx, dy, dx + Math.cos(ra + k * 2.1) * 2.4, dy + Math.sin(ra + k * 2.1) * 2.4);
  // arm
  const ax = 8, ay = 12;
  c.fillStyle = METAL;
  taper(c, dx, dy, 5, 11.5, ax, ay, 2.2, 1.4);
  c.fillStyle = BONE;
  ell(c, ax, ay, .9, .9);
  let hx = ax + 1 + Math.sin($.T * .05) * .6, hy = ay + 4;
  if (ph > 0 && h.tx != null) {
    const k = Math.sin(ph * Math.PI), lx = (h.tx - x) / s, ly = (h.ty - y) / s;
    hx = hx + (lx - hx) * k;
    hy = hy + (ly - hy) * k;
  }
  // chain
  const n = Math.max(3, Math.min(30, Math.hypot(hx - ax, hy - ay) / 1.6 | 0));
  c.strokeStyle = '#8d98a6';
  c.lineWidth = .5;
  const an = Math.atan2(hy - ay, hx - ax);
  for (let k = 0; k < n; k++) {
    const t = (k + .5) / n, sag = ph > 0 ? 0 : Math.sin(t * Math.PI) * 1.2;
    c.beginPath();
    c.ellipse(ax + (hx - ax) * t, ay + (hy - ay) * t + sag, .8, .45, an + (k % 2) * Math.PI / 2, 0, TAU);
    c.stroke();
  }
  // hook
  const hs = 1 + l * .25;
  c.save();
  c.translate(hx, hy);
  c.rotate(an - Math.PI / 2);
  c.scale(hs, hs);
  c.strokeStyle = '#b8b0a4';
  c.lineWidth = 1.1;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 3);
  c.arc(1.8, 3, 1.8, Math.PI, 0, true);
  c.lineTo(3.6, 1.6);
  if (l >= 3) {
    c.moveTo(0, 3);
    c.arc(-1.8, 3, 1.8, 0, Math.PI);
    c.lineTo(-3.6, 1.6);
  }
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#8a0610';
  ell(c, 2.4, 4.6, .7, 1);
  c.restore();
}
/** SPINE LAUNCHER: dorsal rack of quills that re-grow as spine.cd (cooldown remaining) falls to 0 */
export function rigSpine(c, l) {
  const cd = Math.max(0, Math.min(1, rs('spine').cd || 0)), n = 3 + l * 2, ext = 1 - cd;
  c.fillStyle = '#2a2018';
  poly(c, [[-11, -6], [-1, -7.6], [-1, -6.2], [-11, -4.4]]);
  c.fillStyle = BONEM;
  poly(c, [[-11, -6], [-1, -7.6], [-1.5, -7.1], [-11, -5.5]]);
  for (let k = 0; k < n; k++) {
    const x = -10.2 + k * 9 / (n - 1), b = -6.2 - k * 1.4 / (n - 1), len = (6 + (k % 2) * 2) * (.15 + .85 * ext), a = -2.2 + k * .07;
    const tx = x + Math.cos(a) * len, ty = b + Math.sin(a) * len;
    c.fillStyle = BONED;
    taper(c, x, b, (x + tx) / 2, (b + ty) / 2, tx, ty, 1.5, .1, 3);
    c.fillStyle = '#f0e6d0';
    taper(c, x - .2, b, (x + tx) / 2 - .2, (b + ty) / 2, tx, ty, .6, .05, 3);
    if (ext > .97) {
      c.fillStyle = '#8a0610';
      ell(c, tx, ty, .35, .35);
    }
  }
}
