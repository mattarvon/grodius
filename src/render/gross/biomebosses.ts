// @ts-nocheck
// =====================================================================
//  GROSS BIOME BOSSES: THE BLOATED BITCH (was THE FROZEN CRUCIFER; kind 'crux') + THE BURNING BUTCHER
//  Render-only. Nothing in here touches gameplay state or the gameplay RNG (core R/rr/ri/pick, fx/spawn).
//  Static art is pre-rendered to offscreen canvases once; the live layer animates on top; a capped render-side
//  particle list (drips, chunks, shards, steam, flies, maggots, sausage links...) runs from drawBiomeBossFX().
// =====================================================================
import { $ } from '../../state';
import { C, H, TAU, W, ctx } from '../../core';
import { floorAt } from '../../world';
import { SET } from '../../save';
import { sample, thr } from '../../audio';
import { glow, poly } from '../util';
import { EYEC, eye, eyeIris, eyeSclera } from '../eyes';

// THE KNOB. 1 = full gross. 0 = no particles / wounds / lens splats / maggots / flies (the base art stays).
// Anything in between scales particle counts, wound caps and overlay strength.
export const GROSS = 1;
const GX = Math.max(0, GROSS);
const n$ = (n) => Math.round(n * GX);

// ---------- render-only RNG (xorshift32); never the gameplay R() ----------
let rs = 0x2545f491;
const gr = () => ((rs ^= rs << 13), (rs ^= rs >>> 17), (rs ^= rs << 5), (rs >>> 0) / 4294967296);
const grr = (a, b) => a + gr() * (b - a);
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---------- small helpers ----------
const layer = (w, h, ox, oy, f) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.translate(ox, oy);
  f(x);
  return { c, ox, oy };
};
const blit = (c, L) => c.drawImage(L.c, -L.ox, -L.oy);
const ell = (c, x, y, rx, ry, a, col) => {
  c.fillStyle = col;
  c.beginPath();
  c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), a || 0, 0, TAU);
  c.fill();
};
const line = (c, pts, w, col) => {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
};
// lumpy blob path (seeded so it is stable)
const lump = (c, x, y, r, n, rnd, jag = .35) => {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * TAU, rr = r * (1 - jag / 2 + rnd() * jag);
    i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
};
const snd = (bank, o, ms = 90) => { if (GX > 0 && !thr('gb_' + bank, ms)) sample(bank, o); };

// =====================================================================
//  PARTICLES (render-side, capped)
// =====================================================================
const PS = [], LENS = [], MAXP = 240;
const add = (p) => {
  if (GX <= 0) return null;
  if (PS.length >= MAXP) PS.splice(0, 1 + (PS.length - MAXP));
  p.l ??= 60;
  p.ml = p.l;
  p.r ??= gr() * TAU;
  p.vr ??= grr(-.2, .2);
  p.vx ??= 0;
  p.vy ??= 0;
  p.g ??= .12;
  PS.push(p);
  return p;
};
// liquids
const drip = (x, y, vx, vy, col, s = 1.2, l = 90, hiss = 0) => add({ k: 'drip', x, y, vx, vy, col, s, l, hiss });
const chunk = (x, y, vx, vy, col, s = 1.6, edge = '#1a0405', ember = 0) => add({ k: 'chunk', x, y, vx, vy, col, s, edge, ember, l: 150, ph: gr() * 9 });
const shard = (x, y, vx, vy, col, s = 2) => add({ k: 'shard', x, y, vx, vy, col, s, l: 110 });
const steam = (x, y, s = 2) => add({ k: 'steam', x, y, vx: grr(-.15, .15), vy: grr(-.6, -.3), s, g: 0, l: 40 + gr() * 20 });
const ember = (x, y) => add({ k: 'ember', x, y, vx: grr(-.3, .3), vy: grr(-1, -.4), g: -.005, l: 30 + gr() * 30 });
const fly = (x, y, l = 240) => add({ k: 'fly', x, y, ax: x, ay: y, vx: grr(-.5, .5), vy: grr(-.5, .5), g: 0, l, ph: gr() * 9 });
const maggot = (x, y, vx, vy) => add({ k: 'maggot', x, y, vx, vy, l: 200 + gr() * 120, ph: gr() * 9 });
const links = (x, y, vx, vy, n = 4) => add({ k: 'links', x, y, vx, vy, n, vr: grr(-.15, .15), l: 200 });
const heart = (x, y, vx, vy) => add({ k: 'heart', x, y, vx, vy, l: 320, g: .1, vr: .05 });
const eyeball = (x, y, vx, vy) => add({ k: 'eyeball', x, y, vx, vy, l: 220, vr: grr(-.3, .3) });
const lens = (col, hi) => {
  if (GX <= 0) return;
  if (LENS.length >= 6) LENS.shift();
  const s = seeded(1 + (gr() * 1e6 | 0)), d = [];
  for (let i = 0; i < 3; i++) d.push({ dx: (s() - .5) * 1.4, len: 0, v: .25 + s() * .5, w: .25 + s() * .25 });
  LENS.push({ x: grr(40, W - 40), y: grr(20, H * .55), r: grr(10, 22), col, hi, s: 1 + (gr() * 1e6 | 0), d, l: 170, ml: 170 });
};
let lastT = -1;
function stepPS(n) {
  const sc = $.G ? $.G.scroll : 0;
  for (let k = 0; k < n; k++) {
    for (let i = PS.length - 1; i >= 0; i--) {
      const p = PS[i];
      if (--p.l <= 0) { PS[i] = PS[PS.length - 1]; PS.pop(); continue; }
      if (p.k === 'fly') { // buzz around the anchor, drifting off
        p.ph += .4;
        p.vx += Math.cos(p.ph * 1.7) * .25 + (p.ax - p.x) * .01;
        p.vy += Math.sin(p.ph * 2.3) * .25 + (p.ay - p.y) * .01;
        p.vx *= .82; p.vy *= .82;
        p.ay -= .05;
        p.x += p.vx; p.y += p.vy;
        continue;
      }
      if (p.rest) { if (p.k === 'maggot') { p.ph += .3; p.x += Math.sin(p.ph) * .15; } continue; }
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      if (p.k === 'steam') { p.s += .06; p.vx *= .97; continue; }
      if (p.k === 'ember') continue;
      if (p.k === 'maggot') p.ph += .5;
      const fy = floorAt(p.x + sc);
      if (p.y > fy && p.y < fy + 30) {
        p.y = fy;
        if (p.k === 'drip') {
          p.k = 'pud';
          p.rest = 1;
          p.l = Math.min(p.l, 60);
          p.ml = p.l;
          if (p.hiss) { steam(p.x, fy - 1, 1.5); steam(p.x + 1, fy - 1, 1); snd('gsizzle', { vol: .12, wet: .1, spread: .2 }, 650); }
        } else if (Math.abs(p.vy) > .8 && p.k !== 'heart') {
          p.vy *= -.3; p.vx *= .6; p.vr *= .5;
        } else {
          p.rest = 1;
          p.vx = p.vy = 0;
          if (p.k === 'heart') { p.l = Math.min(p.l, 180); p.ml = p.l; drip(p.x, fy - 2, 0, .2, '#6a0a12', 2.4, 80); }
        }
      }
    }
    for (let i = LENS.length - 1; i >= 0; i--) {
      const L = LENS[i];
      if (--L.l <= 0) { LENS.splice(i, 1); continue; }
      for (const d of L.d) d.len = Math.min(L.r * 2.5, d.len + d.v);
    }
  }
}
function drawPS() {
  const c = ctx, T = $.T || 0;
  for (const p of PS) {
    const a = Math.min(1, p.l / Math.min(30, p.ml));
    c.globalAlpha = a;
    switch (p.k) {
      case 'drip':
        c.strokeStyle = p.col;
        c.lineWidth = p.s;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6 - .5);
        c.stroke();
        break;
      case 'pud':
        ell(c, p.x, p.y, p.s * 1.6 + (1 - p.l / p.ml) * 1.2, p.s * .45, 0, p.col);
        break;
      case 'chunk':
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.fillStyle = p.edge;
        c.fillRect(-p.s - .5, -p.s * .7 - .5, p.s * 2 + 1, p.s * 1.4 + 1);
        c.fillStyle = p.col;
        c.fillRect(-p.s, -p.s * .7, p.s * 2, p.s * 1.4);
        if (p.ember && (T + p.ph) % 8 < 5) { c.fillStyle = '#ff7a1a'; c.fillRect(-.5, -.5, 1, 1); }
        c.restore();
        break;
      case 'shard':
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.fillStyle = p.col;
        poly(c, [[-p.s, -p.s * .4], [p.s * 1.2, 0], [-p.s * .6, p.s * .6]]);
        c.fillStyle = 'rgba(235,248,255,.85)';
        c.fillRect(-p.s * .6, -p.s * .3, p.s * 1.2, .6);
        c.restore();
        break;
      case 'steam':
        c.globalAlpha = .35 * (p.l / p.ml);
        ell(c, p.x, p.y, p.s, p.s * .8, 0, '#cdbfae');
        break;
      case 'ember':
        c.fillStyle = (T + p.l) % 6 < 3 ? '#ffb347' : '#ff5a10';
        c.fillRect(p.x, p.y, 1, 1);
        break;
      case 'fly':
        c.fillStyle = '#050505';
        c.fillRect(p.x, p.y, 1, 1);
        if ((T + (p.ph * 10 | 0)) % 3) { c.fillStyle = 'rgba(200,210,220,.7)'; c.fillRect(p.x - .5, p.y - 1, 2, .7); }
        break;
      case 'maggot': {
        const w = Math.sin(p.ph) * .6;
        c.fillStyle = '#efe6c4';
        c.fillRect(p.x - 1, p.y + w * .5, 1, 1);
        c.fillRect(p.x, p.y - w * .5, 1, 1);
        c.fillRect(p.x + 1, p.y + w * .3, 1, 1);
        c.fillStyle = '#5a3a20';
        c.fillRect(p.x + 1.6, p.y + w * .3, .6, .6);
        break;
      }
      case 'links':
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        sausages(c, 0, 0, p.n, 0, Math.sin(T * .2 + p.x) * .4, 1);
        c.restore();
        break;
      case 'heart': {
        const b = Math.pow(Math.max(0, Math.sin(T * (p.rest ? .1 : .2))), 4) * (p.l / p.ml);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.scale(1 + b * .35, 1 + b * .25);
        heartShape(c, 0, 0, 3.2, '#b0101a', '#5a0408', '#ff9a9a', 0);
        c.restore();
        break;
      }
      case 'eyeball':
        c.strokeStyle = '#8a2a2a';
        c.lineWidth = .8;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - Math.cos(p.r) * 4, p.y - Math.sin(p.r) * 4);
        c.stroke();
        ell(c, p.x, p.y, 1.6, 1.6, 0, '#e8e2d0');
        ell(c, p.x + Math.cos(p.r) * .7, p.y + Math.sin(p.r) * .7, .8, .8, 0, '#9fb7c4');
        break;
    }
  }
  c.globalAlpha = 1;
}
function drawLens() {
  if (!LENS.length) return;
  const c = ctx, k = SET.flashes ? 1 : .6;
  for (const L of LENS) {
    const f = Math.min(1, L.l / 50) * Math.min(1, (L.ml - L.l) / 4) * .62 * k * Math.min(1, GX);
    c.globalAlpha = f;
    const s = seeded(L.s);
    c.fillStyle = L.col;
    lump(c, L.x, L.y, L.r, 14, s, .55);
    c.fill();
    for (let i = 0; i < 5; i++) { // satellite spatters
      const a = s() * TAU, d = L.r * (1.1 + s() * .7);
      ell(c, L.x + Math.cos(a) * d, L.y + Math.sin(a) * d, 1 + s() * 2.5, 1 + s() * 2, 0, L.col);
    }
    for (const d of L.d) { // runs down the glass
      const x = L.x + d.dx * L.r;
      c.fillRect(x - d.w * L.r * .25, L.y, d.w * L.r * .5, d.len);
      ell(c, x, L.y + d.len, d.w * L.r * .3, d.w * L.r * .32, 0, L.col);
    }
    c.globalAlpha = f * .8;
    ell(c, L.x - L.r * .35, L.y - L.r * .35, L.r * .22, L.r * .14, -.5, L.hi);
  }
  c.globalAlpha = 1;
}

// =====================================================================
//  per-boss render state (keyed by the enemy object; gameplay object untouched)
// =====================================================================
const ST = new WeakMap(), TRACK = [];
function stOf(e) {
  let s = ST.get(e);
  if (!s) {
    s = { hp: e.hp, wounds: [], bars: (e.bars || []).map(() => 0), snap: [], exposed: 0, half: 0, cut: 0, cutT: 0, died: 0, pop: [], spitW: -1, e };
    ST.set(e, s);
    TRACK.push(s);
    if (TRACK.length > 4) TRACK.shift();
  }
  return s;
}
// hp went down since last frame -> open (or widen) a wound somewhere on the body
function wound(s, spots, max) {
  if (GX <= 0) return null;
  if (s.wounds.length < Math.ceil(max * GX)) {
    const sp = spots[gr() * spots.length | 0];
    const w = { x: sp[0] + grr(-sp[2], sp[2]), y: sp[1] + grr(-sp[3], sp[3]), a: grr(-.6, .6), s: .6, t: 0, sd: gr() * 1e5 | 0 };
    s.wounds.push(w);
    return w;
  }
  const w = s.wounds[gr() * s.wounds.length | 0];
  w.s = Math.min(1.9, w.s + .12);
  return w;
}

// =====================================================================
//  shared bits
// =====================================================================
function heartShape(c, x, y, r, col, dark, hi, frost) {
  c.fillStyle = dark;
  c.beginPath();
  c.arc(x - r * .45, y - r * .2, r * 1.08, 0, TAU);
  c.arc(x + r * .45, y - r * .45, r * .9, 0, TAU);
  c.fill();
  poly(c, [[x - r * 1.45, y], [x + r * 1.25, y - r * .3], [x - r * .2, y + r * 1.9]]);
  c.fillStyle = col;
  c.beginPath();
  c.arc(x - r * .45, y - r * .2, r * .9, 0, TAU);
  c.arc(x + r * .45, y - r * .45, r * .74, 0, TAU);
  c.fill();
  poly(c, [[x - r * 1.25, y], [x + r * 1.05, y - r * .3], [x - r * .2, y + r * 1.6]]);
  c.strokeStyle = dark;
  c.lineWidth = .6;
  c.beginPath();
  c.moveTo(x + r * .2, y - r * 1.1);
  c.quadraticCurveTo(x - r * .3, y, x - r * .1, y + r * 1.2);
  c.moveTo(x - r * .9, y - r * .5);
  c.lineTo(x - r * .4, y + r * .4);
  c.stroke();
  c.fillStyle = hi;
  c.fillRect(x - r * .8, y - r * .75, 1.2, 1);
  if (frost) {
    c.fillStyle = `rgba(200,232,250,${.55 * frost})`;
    c.beginPath();
    c.arc(x - r * .6, y - r * .4, r * .55, 0, TAU);
    c.arc(x + r * .5, y - r * .7, r * .4, 0, TAU);
    c.arc(x - r * .1, y + r * .7, r * .35, 0, TAU);
    c.fill();
  }
}
// a string of sausage-link guts from (x,y), `n` links, sway per link `sw`, `burnt` 0..1
function sausages(c, x, y, n, a0, sw, burnt, out) {
  let px = x, py = y, a = a0;
  for (let i = 0; i < n; i++) {
    a = a0 + sw * (1 + i * .35) + Math.sin(i * 1.3) * .15;
    const L = 3.6, nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L, mx = (px + nx) / 2, my = (py + ny) / 2;
    ell(c, mx, my, 2.6, 2.05, a, '#3a0e08');
    ell(c, mx, my, 2.25, 1.7, a, i % 2 ? '#c06a52' : '#a8503e');
    if (burnt && (i * 7) % 3 === 0) ell(c, mx + Math.cos(a + 1.6) * .6, my + Math.sin(a + 1.6) * .6, 1, .7, a, '#2e1006');
    c.fillStyle = '#eab09a';
    c.fillRect(mx - .6, my - 1, 1, .6);
    c.fillStyle = '#3a0c06';
    c.fillRect(nx - .5, ny - .5, 1, 1);
    if (out) out.push([nx, ny]);
    px = nx;
    py = ny;
  }
  return [px, py];
}

// =====================================================================
//  THE BLOATED BITCH (kind 'crux')
// =====================================================================
let CRUX = null;
const CRUX_IRIS = '#9fb7c4', CRUX_BS = 3;
function frozenEyes() { // a custom frozen, cataract, cracked eyeball set in the shared eye cache
  const key = CRUX_IRIS + CRUX_BS;
  if (EYEC[key]) return;
  const s = eyeSclera(CRUX_BS), i = eyeIris(CRUX_IRIS, 0), x = s.getContext('2d'), xi = i.getContext('2d'), r = seeded(77);
  x.globalCompositeOperation = 'source-atop';
  const g = x.createRadialGradient(80, 80, 40, 80, 80, 80);
  g.addColorStop(0, 'rgba(200,230,250,0)');
  g.addColorStop(1, 'rgba(200,230,250,.75)');
  x.fillStyle = g;
  x.fillRect(0, 0, 160, 160);
  x.lineCap = 'round';
  for (let k = 0; k < 7; k++) { // cracks running out of the frost
    let px = 80 + Math.cos(k * .9) * 74, py = 80 + Math.sin(k * .9) * 74, a = k * .9 + Math.PI;
    x.strokeStyle = k % 2 ? 'rgba(60,4,10,.9)' : 'rgba(40,70,110,.85)';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(px, py);
    for (let j = 0; j < 6; j++) {
      a += (r() - .5) * 1.2;
      px += Math.cos(a) * 12;
      py += Math.sin(a) * 12;
      x.lineTo(px, py);
      x.lineWidth = 5 - j * .6;
    }
    x.stroke();
  }
  xi.globalCompositeOperation = 'source-atop';
  xi.fillStyle = 'rgba(225,238,246,.5)'; // milky frozen cataract
  xi.fillRect(0, 0, 160, 160);
  xi.strokeStyle = 'rgba(255,255,255,.6)';
  xi.lineWidth = 3;
  xi.beginPath();
  xi.moveTo(40, 60); xi.lineTo(80, 80); xi.lineTo(70, 120); xi.moveTo(80, 80); xi.lineTo(122, 70);
  xi.stroke();
  EYEC[key] = { s, i };
}
const NAILS_X = [[-38, 28], [38, 28], [0, -50], [0, -30]];
const BLISTERS = [[7, -16, 2.8, 0], [8, -2, 2.3, 2], [-9, 7, 2.4, 1], [-21, 18, 2.2, 2], [24, 20, 2.5, 0], [5, -38, 2, 1], [-5, -46, 1.8, 2]];
// a torn tatter of frozen, blue-grey skin still stuck to the meat
const skin = (x, cx, cy, rad, rnd) => {
  x.fillStyle = '#262c3a';
  lump(x, cx, cy, rad + .7, 7, rnd, .6); x.fill();
  x.fillStyle = '#8e9fb2';
  lump(x, cx, cy, rad, 7, rnd, .6); x.fill();
  x.fillStyle = '#c4d4e2';
  lump(x, cx - rad * .25, cy - rad * .25, rad * .55, 6, rnd, .5); x.fill();
  x.fillStyle = '#3a3050';
  x.fillRect(cx + rad * .2, cy + rad * .1, 1, 1);
  x.fillStyle = '#f2faff';
  x.fillRect(cx - rad * .5, cy - rad * .6, 1, .7);
};
function buildCrux() {
  return layer(124, 160, 62, 74, (x) => {
    const r = seeded(11);
    // ---- frozen rack: a post that stops at the bar, braced like a gallows stand (it used to be an inverted cross;
    // reworked so nothing reads as a religious symbol) ----
    x.lineCap = 'butt';
    for (const [w, col] of [[9, '#0a0807'], [6.5, '#463326']]) { // diagonal braces from the bar ends up to the post
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(-36, 25);
      x.lineTo(-5, -14);
      x.moveTo(36, 25);
      x.lineTo(5, -14);
      x.stroke();
    }
    x.fillStyle = '#0a0807';
    x.fillRect(-7, -64, 14, 99);
    x.fillRect(-46, 22, 92, 13);
    x.fillStyle = '#463326';
    x.fillRect(-6, -63, 12, 97);
    x.fillRect(-45, 23, 90, 11);
    x.fillStyle = '#6a5242';
    x.fillRect(-6, -63, 2, 97);
    x.fillRect(-45, 23, 90, 2);
    x.fillStyle = '#2b1e16';
    for (let k = 0; k < 6; k++) x.fillRect(-6, -60 + k * 15, 12, 1);
    for (let k = 0; k < 6; k++) x.fillRect(-44 + k * 16, 27 + (k % 2) * 3, 10, 1);
    x.fillStyle = 'rgba(80,4,8,.6)'; // decades of blood soaked into the grain
    x.fillRect(-4, 2, 5, 20);
    x.fillRect(-40, 31, 6, 3);
    x.fillRect(33, 31, 7, 3);
    x.fillStyle = 'rgba(214,236,250,.8)'; // rime
    for (let i = -45; i < 45; i += 2) if (r() < .7) x.fillRect(i, 23, 1 + (r() * 2 | 0), 1);
    for (let y = -63; y < 34; y += 3) if (r() < .55) x.fillRect(-6, y, 1, 1 + (r() * 2 | 0));
    // icicles off the crossbar: clear ice, yellow bile, black blood
    for (let i = 0; i < 16; i++) {
      const ix = -44 + i * 5.8 + r() * 2;
      if (Math.abs(ix) < 8) continue;
      const L = 3 + r() * 11, q = r(), col = q < .4 ? 'rgba(190,225,245,.85)' : q < .75 ? '#a9b23a' : '#5a060c';
      x.fillStyle = col;
      poly(x, [[ix - 1.4, 34.5], [ix + 1.4, 34.5], [ix + r() * .8 - .4, 34.5 + L]]);
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.fillRect(ix - .6, 35, .6, L * .5);
    }
    // ---- flayed, frostbitten legs (feet nailed up top) ----
    x.lineCap = 'round';
    for (const s of [-1, 1]) {
      const p = [[s * 3, -22], [s * 5.5, -40], [s * 5, -57]];
      line(x, p, 9.5, '#2a080c');
      line(x, p, 7.5, '#9a4038');
      line(x, [[s * 2.4, -23], [s * 4.6, -40], [s * 4.2, -55]], 2, '#c05a4a');
      x.strokeStyle = '#5c1a1c';
      x.lineWidth = .6;
      for (let j = -2; j <= 2; j++) { x.beginPath(); x.moveTo(s * 3 + j * .9, -23); x.lineTo(s * 5.3 + j * .9, -40); x.lineTo(s * 5 + j * .7, -54); x.stroke(); }
      x.strokeStyle = 'rgba(90,96,160,.6)'; // frostbite bruising up the shins
      x.lineWidth = 6;
      x.beginPath(); x.moveTo(s * 5.4, -42); x.lineTo(s * 5, -57); x.stroke();
      skin(x, s * 4.5, -29, 3.2, r);
      skin(x, s * 5.6, -47, 3, r);
      line(x, [[s * 1.2 + (s < 0 ? -1.5 : 3), -22], [s * 3.3 + (s < 0 ? -1.8 : 3.2), -40]], .8, 'rgba(225,242,255,.85)');
      x.fillStyle = 'rgba(225,242,255,.8)';
      for (let k = 0; k < 6; k++) x.fillRect(s * 5 - 2 + r() * 4, -56 + r() * 30, 1, 1);
      // gangrenous feet + black toes
      ell(x, s * 5, -59, 3.4, 2.6, 0, '#2a2620');
      ell(x, s * 5, -58.4, 2.8, 2, 0, '#4a3a38');
      for (let t = 0; t < 4; t++) { ell(x, s * (3.2 + t * 1.2), -62 + Math.abs(t - 1.5) * .3, .8, 1.2, 0, '#0d0b08'); x.fillStyle = '#4a5a1a'; x.fillRect(s * (3.2 + t * 1.2) - .3, -63.2, .7, .7); }
    }
    // ---- arms, frostbite creeping from the hands ----
    for (const s of [-1, 1]) {
      x.lineWidth = 6;
      x.strokeStyle = '#3a0c10';
      x.beginPath(); x.moveTo(s * 8, 12); x.quadraticCurveTo(s * 24, 19, s * 37, 28); x.stroke();
      x.lineWidth = 4.2;
      x.strokeStyle = '#a3473c';
      x.stroke();
      const g = x.createLinearGradient(s * 14, 0, s * 37, 0);
      g.addColorStop(0, 'rgba(70,60,120,0)');
      g.addColorStop(.5, 'rgba(70,60,120,.65)');
      g.addColorStop(1, 'rgba(25,30,20,.95)');
      x.strokeStyle = g;
      x.stroke();
      x.strokeStyle = '#5c1a1c';
      x.lineWidth = .5;
      x.beginPath(); x.moveTo(s * 9, 11); x.quadraticCurveTo(s * 24, 17.6, s * 34, 25.5); x.stroke();
      x.strokeStyle = 'rgba(225,242,255,.9)'; // rime on the upper edge
      x.lineWidth = .8;
      x.beginPath(); x.moveTo(s * 8, 9.6); x.quadraticCurveTo(s * 24, 16.4, s * 36, 25.4); x.stroke();
      for (let k = 0; k < 7; k++) { // icicles hanging off the underside: ice and frozen blood
        const u = .12 + k * .12, ix = (1 - u) * (1 - u) * s * 8 + 2 * (1 - u) * u * s * 24 + u * u * s * 37, iy = (1 - u) * (1 - u) * 12 + 2 * (1 - u) * u * 19 + u * u * 28 + 2;
        const L = 2.5 + r() * 5;
        x.fillStyle = k % 3 === 1 ? '#6a0610' : 'rgba(200,232,250,.92)';
        poly(x, [[ix - 1, iy - .5], [ix + 1, iy - .5], [ix + (r() - .5) * .6, iy + L]]);
      }
      // swollen black hand + gangrene fingers
      skin(x, s * 17, 17.5, 2.4, r);
      skin(x, s * 27, 22.6, 2.2, r);
      ell(x, s * 38, 28, 5, 4.2, 0, '#0a0808');
      ell(x, s * 38, 27.6, 4.2, 3.4, 0, '#2a2420');
      ell(x, s * 37, 26.8, 2, 1.4, 0, '#3e4a26');
      x.lineCap = 'round';
      for (let f = 0; f < 4; f++) {
        const a = Math.PI / 2 + s * (-1.1 + f * .6), L = f === 2 ? 3 : 6.5 + r() * 1.5;
        const fx = s * 38 + Math.cos(a) * 3.8, fy = 28 + Math.sin(a) * 3.8, tx = fx + Math.cos(a) * L, ty = fy + Math.sin(a) * L;
        line(x, [[fx, fy], [tx, ty]], 2.2, '#050404');
        line(x, [[fx, fy], [tx * .5 + fx * .5, ty * .5 + fy * .5]], 1, '#3a4a1c');
        if (f === 2) { x.fillStyle = C.bone; x.fillRect(tx - .4, ty - .4, 1, 1.6); } // rotted off, bone stub
        else { ell(x, tx, ty, 1.1, 1.1, 0, '#0a0a06'); x.fillStyle = '#6a7a2a'; x.fillRect(tx - .3, ty - .3, .7, .7); }
      }
    }
    // ---- torso: flayed, frost-mottled, purple at the edges ----
    ell(x, 0, -4, 14, 22, 0, '#24070a');
    ell(x, -.5, -4.5, 12.5, 20.5, 0, '#8c3a34');
    ell(x, -1.5, -5.5, 10, 17.5, 0, '#a84a3e');
    ell(x, -4, -10, 3, 8, 0, '#c05a4a');
    x.strokeStyle = '#5a1a18';
    x.lineWidth = .7;
    x.beginPath();
    for (let k = 0; k < 7; k++) { x.moveTo(-8, -18 + k * 5); x.quadraticCurveTo(0, -16 + k * 5, 8, -18 + k * 5); }
    x.stroke();
    x.globalAlpha = .6;
    ell(x, 10, -6, 3.4, 13, 0, '#3a2a5a');
    ell(x, -11, -2, 3, 11, 0, '#3a2a5a');
    x.globalAlpha = 1;
    for (const [px, py, pr] of [[8, -15, 4.2], [-9, -17, 3.6], [9, 5, 3.8], [-9.5, 9, 3], [3, -22, 2.6]]) skin(x, px, py, pr, r);
    // ribcage cavity (heart lives in here, drawn live)
    ell(x, -2, -4, 6.5, 9.5, 0, '#120203');
    ell(x, -2, -3, 5, 8, 0, '#2a0508');
    x.strokeStyle = C.bone;
    x.lineWidth = 1.3;
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      x.moveTo(-9, -14 + k * 5); x.quadraticCurveTo(-4, -12 + k * 5, -3, -9 + k * 5);
      x.moveTo(7, -14 + k * 5); x.quadraticCurveTo(3, -12 + k * 5, 1, -9 + k * 5);
      x.stroke();
    }
    x.lineWidth = 1;
    for (let k = 0; k < 3; k++) { // snapped rib ends jutting out, frosted
      line(x, [[-9, -13 + k * 6], [-14, -15 + k * 6]], 1.1, '#d8d0bc');
      x.fillStyle = '#e8f6ff';
      x.fillRect(-14.5, -15.5 + k * 6, 1, 1);
    }
    // frozen blood-slush run from the cavity down into its mouth
    line(x, [[-2, 5], [-1, 8], [-2.2, 11], [-.6, 14], [0, 17.5]], 2.6, '#3a0408');
    line(x, [[-2, 5], [-1, 8], [-2.2, 11], [-.6, 14], [0, 17.5]], 1.4, '#7a0e18');
    x.fillStyle = '#e4f2ff';
    for (let k = 0; k < 5; k++) x.fillRect(-2 + r() * 2, 6 + r() * 11, .7, .7);
    // frozen vomit crusted up the chest (it puked, then froze, then they flipped it)
    x.fillStyle = '#6a6a1c';
    poly(x, [[-4, 18.5], [3.5, 18.5], [5, 13], [2.5, 10], [6, 5], [3, 1.5], [1, 5.5], [-1.5, 3], [-4.2, 7], [-2.8, 10], [-5.5, 13]]);
    x.fillStyle = '#b4ae46';
    poly(x, [[-3, 17.5], [2.6, 17.5], [3.8, 13], [1.6, 10.4], [4.4, 5.6], [2.6, 3], [.8, 6.6], [-1.6, 4.4], [-3.2, 7.4], [-1.8, 10.4], [-4.2, 13]]);
    for (let k = 0; k < 10; k++) {
      x.fillStyle = ['#e07a20', '#e8e2a8', '#8a8a2a', '#e07a20', '#d8c060'][k % 5];
      x.fillRect(-3 + r() * 6, 5 + r() * 12, 1, k % 5 === 0 ? 1.4 : .8);
    }
    x.fillStyle = 'rgba(240,250,255,.7)';
    x.fillRect(-2, 9, 2, .6);
    x.fillRect(2, 6, 1.6, .6);
    x.fillRect(-3, 15, 1, .6);
    // ---- inverted head: frozen grey skin, hair frozen into black spikes ----
    x.fillStyle = '#4a4050';
    x.fillRect(-3, 12, 6, 6);
    ell(x, 0, 24.5, 8.2, 9, 0, '#1a1820');
    ell(x, 0, 24, 7.5, 8.4, 0, '#8a98a6');
    ell(x, -2.4, 21.5, 3, 2.4, 0, '#b6c4d0');
    ell(x, 1.5, 27, 5, 4.5, 0, '#6a7280');
    x.globalAlpha = .55;
    ell(x, -3.5, 21, 2.2, 1.6, 0, '#5a3a5a');
    ell(x, 4, 29, 2, 1.4, 0, '#5a3a5a');
    x.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { // frozen hair
      const hx = -6 + i * 1.5, L = 4 + r() * 6;
      x.fillStyle = '#16141a';
      poly(x, [[hx - 1, 30], [hx + 1, 30], [hx + r() - .5, 30 + L]]);
      x.fillStyle = '#e8f6ff';
      x.fillRect(hx - .2 + r() * .4, 29 + L, .7, .7);
    }
    // peeled-back lids around eyes that can't close; frozen blood tears running "down" past the crown
    for (const s of [-1, 1]) {
      ell(x, s * 2.9, 25.6, 3, 2.8, 0, '#3a060a');
      ell(x, s * 2.9, 25.6, 2.5, 2.3, 0, '#7a1a1a');
      line(x, [[s * 2.9, 27.8], [s * 3.3, 31], [s * 3.1, 34.5]], .9, '#6a0a12');
      x.fillStyle = '#e8f6ff';
      x.fillRect(s * 2.9 - 1.5, 23, .7, .7);
      x.fillRect(s * 2.9 + 1, 28, .7, .7);
    }
    line(x, [[-4.5, 29.3], [-1.6, 28.8]], .9, '#2a2228'); // brows (upside down, below the eyes)
    line(x, [[1.6, 28.8], [4.5, 29.3]], .9, '#2a2228');
    x.fillStyle = '#3a1a1a'; // nostrils
    x.fillRect(-1.2, 21.6, .9, .8);
    x.fillRect(.4, 21.6, .9, .8);
    line(x, [[-.8, 22.4], [-1.2, 25], [-.9, 28]], .9, 'rgba(160,200,60,.9)'); // frozen snot runner
    // nails through swollen, pus-weeping flesh
    for (const [nx, ny] of NAILS_X) {
      ell(x, nx, ny, 4.6, 3.8, 0, '#6a1a1a');
      ell(x, nx, ny - .3, 3.8, 3, 0, '#c45a4a');
      ell(x, nx - 1, ny - 1.2, 1.6, 1, 0, '#e08a76');
      x.fillStyle = '#e2cf5a';
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + r(); ell(x, nx + Math.cos(a) * 3, ny + Math.sin(a) * 2.4, .8, .8, 0, '#e2cf5a'); }
      line(x, [[nx + 1.6, ny + 2], [nx + 1.9, ny + 5.5], [nx + 1.5, ny + 7]], 1.1, 'rgba(220,200,80,.95)');
      x.fillStyle = '#4a2a1a';
      x.fillRect(nx - 1.2, ny - 4.5, 2.4, 9);
      x.fillStyle = '#b8c4d0';
      x.fillRect(nx - 1, ny - 4.5, 1.6, 9);
      x.fillStyle = '#7a4a2a';
      x.fillRect(nx - 2.6, ny - 4.8, 5.2, 1.8);
      x.fillStyle = '#d8e4ee';
      x.fillRect(nx - 2.6, ny - 4.8, 5.2, .6);
    }
    // frost-burst blisters (some already popped and frozen mid-ooze)
    for (const [bx, by, br, kind] of BLISTERS) {
      ell(x, bx, by, br + .7, br * .85 + .7, 0, '#4a0a14');
      if (kind === 2) { // blood blister, purple-black and tight
        ell(x, bx, by, br, br * .82, 0, '#4a0a2a');
        ell(x, bx - br * .2, by - br * .2, br * .55, br * .4, 0, '#8a2a5a');
        x.fillStyle = '#ffd8f0';
        x.fillRect(bx - br * .45, by - br * .5, .9, .9);
      } else if (kind === 1) {
        ell(x, bx, by, br, br * .8, 0, '#3a0a0a');
        x.fillStyle = '#d8dcb0';
        x.fillRect(bx - br, by - .4, .9, .8);
        x.fillRect(bx + br - .9, by - .6, .9, .8);
        line(x, [[bx, by + br * .6], [bx + .3, by + br + 3.5]], .9, 'rgba(216,210,120,.95)');
      } else {
        ell(x, bx, by, br, br * .8, 0, '#dde8ee');
        ell(x, bx + .4, by + .4, br * .7, br * .55, 0, '#b8c8b0');
        x.fillStyle = '#ffffff';
        x.fillRect(bx - br * .45, by - br * .45, .9, .9);
      }
    }
  });
}
// blisters on the body that swell and burst while you watch (index into BLISTERS)
export function drawCruxGross(c, e) {
  const t = e.t, s = stOf(e), T = $.T || 0;
  if (!CRUX) CRUX = buildCrux();
  frozenEyes();
  const shield = e.shielded, beat = Math.pow(Math.max(0, Math.sin(t * (shield ? .12 : .16))), 5), half = e.hp < e.max * .5;
  // ---- events (render-side only) ----
  if (e.hp < s.hp - .001 && !shield) {
    const w = wound(s, [[-1, -5, 8, 15], [-22, 19, 10, 3], [22, 19, 10, 3], [0, -40, 4, 12], [0, 24, 5, 5]], 9);
    if (w) {
      for (let k = 0; k < n$(3); k++) drip(e.x + w.x, e.y + w.y, grr(-2.2, -.2), grr(-1.6, .4), gr() < .5 ? '#7a0e18' : '#c8e2f2', grr(1, 1.8), 80);
      if (gr() < .3 * GX) chunk(e.x + w.x, e.y + w.y, grr(-2, -.5), grr(-2, 0), gr() < .5 ? '#a84a3e' : '#cfe8f7', grr(1, 1.6));
    }
  }
  s.hp = e.hp;
  (e.bars || []).forEach((b, i) => {
    if (b.dead && !s.bars[i]) { // nail bar shattered: tendon snaps, pus + ice everywhere
      s.bars[i] = 1;
      s.snap[i] = T;
      for (let k = 0; k < n$(10); k++) shard(b.x, b.y + grr(-14, 14), grr(-2.5, 1.5), grr(-2.5, 1), gr() < .6 ? '#cfe8f7' : '#b8c4d0', grr(1.4, 2.6));
      for (let k = 0; k < n$(10); k++) drip(b.x, b.y + grr(-10, 10), grr(-2.5, 2), grr(-2.5, .5), gr() < .6 ? '#e2cf5a' : '#a10d14', grr(1.2, 2), 90);
      for (let k = 0; k < n$(2); k++) chunk(b.x, b.y, grr(-1.5, 1.5), grr(-2.5, -.5), '#a84a3e', 1.5);
      snd('gicecrack', { vol: .5, wet: .25, spread: .15 }, 60);
    }
  });
  if (!shield && !s.exposed) { // the last bar went: its chest bursts open
    s.exposed = T;
    for (let k = 0; k < n$(16); k++) shard(e.x - 2, e.y - 4, grr(-3, 1), grr(-3, 1.5), gr() < .5 ? '#cfe8f7' : '#d8d0bc', grr(1.2, 2.4));
    for (let k = 0; k < n$(18); k++) drip(e.x - 2, e.y - 4, grr(-3.2, .5), grr(-2.5, 1), gr() < .6 ? '#8a1420' : '#d8ecf8', grr(1.3, 2.2), 100);
    lens('#7a0a14', '#e8f4ff');
    snd('gicecrack', { vol: .8, wet: .4, spread: .1 }, 0);
  }
  if (half && !s.half) { // ribcage cracks wide, frozen guts drop out
    s.half = T;
    for (let k = 0; k < n$(14); k++) chunk(e.x + grr(-6, 6), e.y + grr(-8, 8), grr(-2.5, 1), grr(-2.5, .5), gr() < .5 ? '#a84a3e' : '#7a0e18', grr(1.2, 2));
    for (let k = 0; k < n$(14); k++) drip(e.x, e.y, grr(-3, 1.5), grr(-2, 1), gr() < .5 ? '#b4ae46' : '#8a1420', grr(1.2, 2), 90);
    snd('gicecrack', { vol: .6, wet: .3 }, 0);
  }
  // ---- static carcass ----
  blit(c, CRUX);
  // ---- swelling blisters that pop on their own (pus spits) ----
  for (let i = 0; i < 3; i++) {
    const [bx, by] = [[-12, -10], [9, 2], [-28, 22]][i], ph = (t * .006 + i * .37) % 1, br = .6 + ph * 2.4;
    if (ph < .93) {
      ell(c, bx, by, br + .5, br * .85 + .5, 0, '#6a1414');
      ell(c, bx, by, br, br * .82, 0, '#dde8ee');
      ell(c, bx + br * .25, by + br * .25, br * .6, br * .45, 0, '#c8d4a0');
      c.fillStyle = '#ffffff';
      c.fillRect(bx - br * .4, by - br * .45, .8, .8);
    } else {
      ell(c, bx, by, 1.6, 1.3, 0, '#3a0a0a');
      if (!s.pop[i]) { s.pop[i] = 1; for (let k = 0; k < n$(4); k++) drip(e.x + bx, e.y + by, grr(-1.5, 1.5), grr(-2, -.3), '#e2cf5a', 1.1, 70); }
    }
    if (ph < .5) s.pop[i] = 0;
  }
  // ---- the half-HP split: chest cavity torn wider, frozen intestines hanging toward its face ----
  if (half) {
    const k = Math.min(1, (T - s.half) / 20);
    ell(c, -1, 2, 7 * k, 5 * k, 0, '#120203');
    c.save();
    sausages(c, -3, 4, 3 + (k * 4 | 0), Math.PI / 2 + .3, Math.sin(t * .04) * .18, 0);
    c.restore();
    c.fillStyle = 'rgba(214,236,250,.8)';
    c.fillRect(-6, 1, 1, 1);
    c.fillRect(3, 3, 1, 1);
  }
  // ---- skin stretched from its cavity and nailed onto each live bar ----
  (e.bars || []).forEach((b, i) => {
    const bx = b.x - e.x, by = b.y - e.y;
    for (const [oy, hy] of [[-9, -7], [7, 0]]) {
      if (!b.dead) {
        const sag = 3 + Math.sin(t * .05 + i) * 1;
        c.strokeStyle = '#3a0c10';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-7, hy - 3);
        c.quadraticCurveTo((bx - 7) / 2, (hy + by + oy) / 2 + sag, bx + 1.5, by + oy);
        c.stroke();
        c.strokeStyle = '#b25446';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = '#e2cf5a';
        const mx = (bx - 7) / 2 + 1, my = (hy + by + oy) / 2 + sag * .5;
        c.fillRect(mx, my, 1, 1);
        if (gr() < .01 * GX) drip(e.x + mx, e.y + my, 0, .2, '#e2cf5a', 1, 80);
      } else { // snapped: curled stump dangling from the cavity
        const sw = Math.sin(t * .09 + i * 2) * .4, k = Math.min(1, (T - (s.snap[i] || T)) / 12);
        const ex = -7 - Math.cos(1.2 + sw) * 8 * k, ey = hy + Math.sin(1.2 + sw) * 9 * k;
        line(c, [[-7, hy - 3], [ex, ey]], 1.8, '#3a0c10');
        line(c, [[-7, hy - 3], [ex, ey]], .9, '#b25446');
        c.fillStyle = '#a10d14';
        c.fillRect(ex - .5, ey, 1, 1.5);
      }
    }
  });
  // ---- the heart: frozen and sluggish behind the bars, bulging and gushing once exposed ----
  const hr = (shield ? 3.6 : 4.3) + beat * (shield ? 1 : 2.2);
  c.globalCompositeOperation = 'lighter';
  glow(-2, -4, 14 + beat * 7, shield ? '120,10,20' : '255,30,30', .5 + beat * .45);
  c.globalCompositeOperation = 'source-over';
  c.save();
  c.translate(-2, -4 - (shield ? 0 : 1));
  c.scale(1 + beat * .14, 1 - beat * .06);
  c.strokeStyle = '#5a0a18'; // aorta stubs, plugged with frozen clot
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(.5, -hr); c.lineTo(1.5, -hr - 3);
  c.moveTo(-1.5, -hr); c.lineTo(-2.4, -hr - 2.4);
  c.stroke();
  c.fillStyle = '#d8ecf8';
  c.fillRect(1, -hr - 3.6, 1.2, 1);
  heartShape(c, 0, 0, hr * .8, shield ? '#8a1020' : '#d0101a', shield ? '#2a0306' : '#5a0408', shield ? '#c8e4f4' : '#ff9a9a', shield ? 1 : .25 * (1 - beat));
  c.restore();
  if (!shield) {
    // cracked ice crust around the opened cavity
    c.fillStyle = 'rgba(214,236,250,.85)';
    for (const [ix, iy] of [[-8, -12], [-8.5, 3], [3, -13], [4, 4], [-9, -5]]) poly(c, [[ix, iy], [ix + 1.5, iy - .5], [ix + .6, iy + 2.2]]);
    const pk = (t * .16) % TAU; // gush on each beat
    if (pk > Math.PI * .45 && pk < Math.PI * .45 + .16) {
      for (let k = 0; k < n$(5); k++) drip(e.x - 4, e.y - 6, grr(-2.6, -.6), grr(-1.4, .6), gr() < .65 ? '#a0101c' : '#d8ecf8', grr(1.2, 2.1), 90);
    }
  }
  if (gr() < (shield ? .06 : .2) * GX) drip(e.x - 2 + grr(-2, 2), e.y + 2, grr(-.3, .3), .3, gr() < .6 ? '#7a0e18' : '#d8ecf8', 1.2, 90); // slush leak
  // ---- frozen, cracked, cataract eyes: open, never blink, slowly follow you ----
  const la = Math.atan2($.P.y - e.y - 26, $.P.x - e.x);
  for (const sx of [-2.9, 2.9]) eye(c, sx, 25.6, 2.2, { ang: la, iris: CRUX_IRIS, bs: CRUX_BS, m: .55, dil: .7 });
  // ---- chattering, puke-crusted upside-down mouth ----
  const ch = ((T >> 1) % 2) * .5 + (half ? .6 : 0);
  ell(c, 0, 19.5, 3.1, 1.6 + ch, 0, '#160203');
  c.fillStyle = '#d8d0b4';
  for (let k = -2; k <= 2; k++) { c.fillRect(k * 1.1 - .4, 18.2 - ch * .3, .8, .9); if (k % 2) c.fillRect(k * 1.1 - .4, 20.4 + ch * .6, .8, .8); }
  // frozen bile icicles from the jaw, hanging down over its face, dripping at the tips
  const ic = [[-3, 19.6, -4.8, 41], [2.8, 19.8, 4.6, 37], [-.4, 21, .4, 44]];
  for (const [x0, y0, x1, y1] of ic) {
    c.fillStyle = 'rgba(150,160,40,.95)';
    poly(c, [[x0 - 1.1, y0], [x0 + 1.1, y0], [x1, y1]]);
    c.fillStyle = 'rgba(232,236,140,.85)';
    poly(c, [[x0 - .3, y0 + 1], [x0 + .3, y0 + 1], [x1 * .7 + x0 * .3, y1 * .7 + y0 * .3]]);
    if (gr() < .025 * GX) drip(e.x + x1, e.y + y1, 0, .4, '#b4b43a', 1.2, 90);
  }
  // pus oozing from the nails
  if (gr() < .05 * GX) { const [nx, ny] = NAILS_X[gr() * 4 | 0]; drip(e.x + nx + 1.7, e.y + ny + 6, 0, .3, '#e2cf5a', 1.1, 80); }
  // ---- wounds: frozen meat split open, slush beading out ----
  for (const w of s.wounds) {
    w.t++;
    const o = Math.min(1, w.t / 8) * w.s;
    c.save();
    c.translate(w.x, w.y);
    c.rotate(w.a);
    ell(c, 0, 0, 3.2 * o, 1.5 * o, 0, '#2a0406');
    ell(c, 0, 0, 2.5 * o, 1 * o, 0, '#c0141e');
    c.fillStyle = '#e8f6ff';
    c.fillRect(-2.6 * o, -1.4 * o, .8, .8);
    c.fillRect(2 * o, .8 * o, .8, .8);
    c.fillRect(-.4, -1.6 * o, .7, .7);
    c.restore();
    c.fillStyle = '#7a0e18';
    c.fillRect(w.x - .4, w.y + o, .9, 1.5 + o * 2 + Math.sin(t * .05 + w.sd) * .8);
    if (gr() < .015 * GX) drip(e.x + w.x, e.y + w.y + 1, grr(-.3, .3), .2, '#8a1420', 1.1, 80);
  }
}

// =====================================================================
//  THE BURNING BUTCHER
// =====================================================================
let BUT = null, BUTC = null;
const PITS = [[-15, -6], [9, -19], [15, 6], [-9, 2]];
function buildButcher() {
  return layer(90, 110, 45, 56, (x) => {
    const r = seeded(23);
    // ---- obese charred carcass ----
    ell(x, 1, 4, 27, 32, 0, '#140604');
    ell(x, 0, 3, 25.5, 30.5, 0, '#6a3412');
    ell(x, -6, -4, 15, 20, 0, '#82461a');
    // charred crust plates, rendered fat glistening in the seams
    for (let k = 0; k < 26; k++) {
      x.fillStyle = k % 3 ? '#1a0a06' : '#3c1c10';
      const a = r() * TAU, d = r() * 22;
      lump(x, Math.cos(a) * d * .95, 3 + Math.sin(a) * d * 1.2, 2.5 + r() * 3, 6, r, .5);
      x.fill();
    }
    // man-boobs, sagging
    for (const s of [-1, 1]) { ell(x, s * 9, -11, 8, 6.5, 0, '#120604'); ell(x, s * 9, -12, 7, 5.6, 0, '#3a1a0e'); ell(x, s * 9.5, -8.5, 1.4, 1, 0, '#6a1a14'); }
    // peeled to raw red: fat edge, wet meat, curled black flaps
    for (const [px, py, rx, ry] of [[-15, -2, 6, 5], [8, -19, 5, 4], [14, 3, 5.5, 5], [-5, 12, 7, 3.5], [3, -4, 4, 3]]) {
      const rad = (rx + ry) / 2;
      x.fillStyle = '#e3c48f';
      lump(x, px, py, rad + 1, 9, r, .7); x.fill();
      x.fillStyle = '#8a1a14';
      lump(x, px, py, rad, 9, r, .7); x.fill();
      x.fillStyle = '#c0402e';
      lump(x, px - .6, py - .6, rad * .7, 8, r, .8); x.fill();
      x.strokeStyle = '#5a0a08';
      x.lineWidth = .5;
      x.beginPath(); x.moveTo(px - rad * .6, py - rad * .2); x.lineTo(px + rad * .5, py + rad * .1); x.moveTo(px - rad * .4, py + rad * .4); x.lineTo(px + rad * .4, py + rad * .5); x.stroke();
      x.fillStyle = '#ffd0b8';
      x.fillRect(px - rad * .4, py - rad * .5, 1, .7);
      x.fillRect(px + rad * .2, py + rad * .1, .7, .7);
      x.fillStyle = '#4a2414'; // curled flap
      poly(x, [[px + rx * .6, py - ry], [px + rx + 3, py - ry - 2.5], [px + rx + 1, py - ry + 1.5]]);
      x.fillStyle = '#c88a6a';
      poly(x, [[px + rx + 3, py - ry - 2.5], [px + rx + 1.6, py - ry - .6], [px + rx + 1, py - ry + 1.5]]);
    }
    // burn pits for the maggots
    for (const [px, py] of PITS) {
      x.fillStyle = '#c8b040';
      lump(x, px, py, 4.6, 8, r, .5); x.fill();
      ell(x, px, py, 3.8, 3, 0, '#200404');
      ell(x, px, py + .6, 2.6, 1.8, 0, '#5a0a08');
    }
    // fat rolls
    for (const [y, w] of [[0, 21], [8, 23], [15, 24]]) {
      x.strokeStyle = '#0c0402';
      x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(-w, y - 2); x.quadraticCurveTo(0, y + 4, w, y - 2); x.stroke();
      x.strokeStyle = '#6a3a20';
      x.lineWidth = .6;
      x.beginPath(); x.moveTo(-w + 2, y - .6); x.quadraticCurveTo(0, y + 5.3, w - 2, y - .6); x.stroke();
    }
    // ribs, charred, poking through on the hook side
    x.strokeStyle = '#bfae8a';
    x.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(6, -18 + k * 6); x.quadraticCurveTo(16, -16 + k * 6, 20, -10 + k * 6); x.stroke(); }
    x.fillStyle = '#2a120a';
    for (let k = 0; k < 4; k++) x.fillRect(12, -16 + k * 6, 3, 1);
    // ---- apron, soaked: grease, blood, offal, a finger in the pocket ----
    x.fillStyle = '#1e140c';
    poly(x, [[-21, 14], [21, 14], [23, 44], [-23, 44]]);
    x.fillStyle = '#34261a';
    poly(x, [[-20, 15], [20, 15], [22, 43], [-22, 43]]);
    x.globalAlpha = .75;
    for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? '#6a5018' : '#8a6a20'; lump(x, -16 + r() * 32, 20 + r() * 20, 2.5 + r() * 4, 7, r, .6); x.fill(); }
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(80,6,10,.9)';
    lump(x, -6, 30, 6, 9, r, .5); x.fill();
    lump(x, 10, 36, 4.5, 8, r, .5); x.fill();
    x.fillStyle = 'rgba(150,14,20,.9)';
    lump(x, -7, 29, 3.4, 8, r, .5); x.fill();
    x.fillRect(-8, 32, 1.4, 12); x.fillRect(9, 38, 1.2, 7); x.fillRect(-15, 36, 1, 8);
    x.fillStyle = '#d8b860'; // grease gloss
    for (let k = 0; k < 9; k++) x.fillRect(-18 + r() * 36, 18 + r() * 24, 1 + r() * 2, .6);
    ell(x, -13, 39, 3.5, 2.3, .3, '#3e0a16'); // stuck-on liver
    ell(x, -13.6, 38.4, 2, 1, .3, '#8a3a4a');
    ell(x, 15, 28, 2.4, 1.6, -.5, '#5a1420'); // kidney
    x.lineCap = 'round';
    line(x, [[-2, 41], [1, 38], [4, 41], [6, 39]], 1.6, '#b0604e'); // a strip of gut stuck on
    x.fillStyle = '#e8e0cc';
    x.fillRect(3, 24, 1, 1.4); // somebody's tooth
    x.fillStyle = '#22180f'; // pocket + finger
    x.fillRect(9, 20, 9, 7);
    x.fillStyle = '#3a2a1a';
    x.fillRect(9, 20, 9, 1);
    line(x, [[12, 21], [12.5, 17.5]], 2, '#a86a58');
    x.fillStyle = '#e8d8c0';
    x.fillRect(11.8, 16.8, 1.4, 1);
    // apron strings biting into the fat
    line(x, [[-23, 12], [-12, 15], [12, 15], [24, 12]], 1, '#5a4a30');
    // ---- belly overhang, flopped over the apron ----
    ell(x, -1, 13, 25, 11, 0, '#120604');
    ell(x, -1, 12, 24, 10, 0, '#6a3412');
    ell(x, -5, 9, 14, 5, 0, '#8a4e1e');
    for (let k = 0; k < 9; k++) { x.fillStyle = k % 2 ? '#1a0a06' : '#40200f'; lump(x, -18 + r() * 34, 7 + r() * 9, 2 + r() * 2.5, 6, r, .5); x.fill(); }
    ell(x, -5, 13, 6, 3, 0, '#e3c48f');
    ell(x, -5, 13, 5, 2.3, 0, '#a8322a');
    ell(x, 0, 9, 1.6, 1.2, 0, '#050101'); // the navel, deep
    // ---- chins, then the scorched sack hood ----
    for (let k = 0; k < 3; k++) { ell(x, -4, -22 - k * 2.3, 9 - k, 2.6, 0, '#120604'); ell(x, -4, -22.4 - k * 2.3, 8.4 - k, 2, 0, '#4a2214'); }
    for (const sx of [-14, 14]) { ell(x, sx, -28.5, 3.4, 2.6, 0, '#6a1a14'); ell(x, sx, -28.5, 2.4, 1.8, 0, '#c8b040'); ell(x, sx, -28.5, 1.4, 1, 0, '#3a0606'); }
    ell(x, -6, -34, 12.5, 11.5, 0, '#2a1f12');
    ell(x, -6, -35, 11.4, 10.4, 0, '#5e4c32');
    ell(x, -9, -38, 6, 5, 0, '#6e5c40');
    for (const [hx, hy, hr] of [[1, -40, 2.2], [-14, -36, 1.8], [-3, -44, 1.5], [2, -30, 1.4]]) { ell(x, hx, hy, hr + .7, hr + .5, 0, '#a8400e'); ell(x, hx, hy, hr, hr * .8, 0, '#0a0503'); }
    x.strokeStyle = '#2a1f12';
    x.lineWidth = .6;
    x.beginPath();
    for (let k = 0; k < 6; k++) { x.moveTo(-14 + k * 3, -24); x.lineTo(-13 + k * 3, -21.5); }
    x.stroke();
    // pus tears under the eye cluster
    for (const [ex, ey] of [[-10, -35], [-3, -37], [0, -31]]) line(x, [[ex, ey], [ex + .3, ey + 4], [ex, ey + 6]], .8, 'rgba(220,200,90,.9)');
  });
}
function buildButcherCracks() { // glowing fissures in the char, pulsed with 'lighter'
  return layer(90, 110, 45, 56, (x) => {
    const r = seeded(91);
    x.lineCap = 'round';
    for (let k = 0; k < 22; k++) {
      const a = r() * TAU, d = r() * 22;
      let px = Math.cos(a) * d * .95, py = 3 + Math.sin(a) * d * 1.15, an = r() * TAU;
      x.strokeStyle = k % 3 ? '#ff6a18' : '#ffd070';
      x.lineWidth = k % 3 ? 1.1 : .8;
      x.beginPath();
      x.moveTo(px, py);
      for (let j = 0; j < 3; j++) { an += (r() - .5) * 1.6; px += Math.cos(an) * 2.6; py += Math.sin(an) * 2.6; x.lineTo(px, py); }
      x.stroke();
    }
  });
}
export function drawButcherGross(c, e) {
  const t = e.t, s = stOf(e), T = $.T || 0;
  if (!BUT) { BUT = buildButcher(); BUTC = buildButcherCracks(); }
  // ---- events ----
  if (e.hp < s.hp - .001) {
    const w = wound(s, [[-2, -2, 16, 14], [-4, 12, 16, 4], [-12, -8, 6, 10]], 10);
    if (w) {
      for (let k = 0; k < n$(3); k++) drip(e.x + w.x, e.y + w.y, grr(-2.2, -.2), grr(-1.6, .3), gr() < .5 ? '#d8b048' : '#8a0e14', grr(1, 1.8), 80, 1);
      if (gr() < .3 * GX) chunk(e.x + w.x, e.y + w.y, grr(-2, -.4), grr(-2, 0), gr() < .5 ? '#2a160c' : '#e3c48f', grr(1, 1.6), '#0a0402', 1);
    }
  }
  s.hp = e.hp;
  if (e.cut && !s.cut) { // half HP: the chain snaps and the gut bursts like a sausage in a pan
    s.cut = 1;
    s.cutT = T;
    for (let k = 0; k < n$(22); k++) drip(e.x + grr(-10, 10), e.y + 14, grr(-3, 3), grr(-3, .5), gr() < .55 ? '#d8b048' : '#9a1018', grr(1.2, 2.3), 110, 1);
    for (let k = 0; k < n$(8); k++) chunk(e.x, e.y + 14, grr(-2.5, 2.5), grr(-3, -.5), gr() < .5 ? '#e3c48f' : '#a8322a', grr(1.2, 2), '#2a0a04');
    for (let k = 0; k < n$(6); k++) maggot(e.x + grr(-8, 8), e.y + 14, grr(-1.5, 1.5), grr(-2, 0));
    for (let k = 0; k < n$(6); k++) steam(e.x + grr(-14, 14), e.y + grr(0, 20), 2.5);
    links(e.x, e.y + 16, grr(-1.5, -.5), -1.5, 3);
    lens('#8a6a18', '#ffe8a0');
    snd('splat_l', { vol: .7, wet: .3 }, 0);
    snd('gsizzle', { vol: .6, wet: .2, spread: .1 }, 0);
  }
  // ---- intestines first: they hang behind the apron edge ----
  const swing = -Math.cos(e.sw) * (e.cut ? .5 : .22);
  const gut = [];
  // ---- static carcass ----
  blit(c, BUT);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = .55 + .3 * Math.sin(t * .09) + .15 * Math.sin(t * .31);
  blit(c, BUTC);
  c.globalAlpha = 1;
  glow(0, 4, 26, '255,90,20', .12 + .06 * Math.sin(t * .09));
  c.globalCompositeOperation = 'source-over';
  if (!e.cut) { // guts already hanging out from under the belly fold, over the apron
    sausages(c, -9, 20, 6, Math.PI / 2 + .15, swing + Math.sin(t * .06) * .12, 1, gut);
    sausages(c, 6, 21, 5, Math.PI / 2 - .1, swing + Math.sin(t * .07 + 1) * .12, 1, gut);
  }
  // ---- maggots squirming in the burn pits ----
  if (GX > 0) for (let p = 0; p < PITS.length; p++) {
    const [px, py] = PITS[p];
    for (let m = 0; m < Math.ceil(3 * GX); m++) {
      const a = t * .05 * (m % 2 ? 1 : -1) + m * 2.1 + p, w = Math.sin(t * .4 + m * 3) * .5;
      const mx = px + Math.cos(a) * 2, my = py + Math.sin(a) * 1.3;
      c.fillStyle = '#fff6d8';
      c.fillRect(mx - 1.5, my + w * .6, 1.2, 1.2);
      c.fillRect(mx - .4, my, 1.2, 1.2);
      c.fillRect(mx + .7, my - w * .6, 1.2, 1.2);
      c.fillStyle = '#3a1a08';
      c.fillRect(mx + 1.6, my - w * .6, .6, .6);
    }
  }
  // ---- fat blisters bubbling up and popping ----
  const BUB = [[-12, -14], [4, -10], [-18, 6], [18, -4], [10, 12], [-4, -2], [-14, 13]];
  for (let i = 0; i < BUB.length; i++) {
    const [bx, by] = BUB[i], ph = (t * .011 + i * .29) % 1, br = .4 + ph * 2.6;
    if (ph < .9) {
      ell(c, bx, by, br + .4, br * .8 + .4, 0, '#5a3010');
      ell(c, bx, by, br, br * .78, 0, '#e8c66a');
      c.fillStyle = '#fff4c8';
      c.fillRect(bx - br * .4, by - br * .45, .8, .8);
    } else {
      ell(c, bx, by, 2.2, 1.5, 0, '#a8322a');
      if (!s.pop[i]) {
        s.pop[i] = 1;
        for (let k = 0; k < n$(3); k++) drip(e.x + bx, e.y + by, grr(-1.4, 1.4), grr(-2, -.6), '#e0bc58', 1.1, 70, 1);
        if (gr() < .6) steam(e.x + bx, e.y + by - 1, 1.4);
      }
    }
    if (ph < .5) s.pop[i] = 0;
  }
  if (gr() < .25) ember(e.x + grr(-18, 18), e.y + grr(-20, 20));
  // ---- belly rupture after the chain snaps: guts out, swinging hard ----
  if (e.cut) {
    const k = Math.min(1, (T - s.cutT) / 18);
    ell(c, 0, 12, 14 * k, 5 * k, 0, '#e3c48f');
    ell(c, 0, 12.5, 12 * k, 3.8 * k, 0, '#4a0606');
    ell(c, 0, 13, 9 * k, 2.4 * k, 0, '#8a1414');
    sausages(c, -6, 13, 3 + (k * 7 | 0), Math.PI / 2 + .2, swing + Math.sin(t * .08) * .2, 1, gut);
    sausages(c, 4, 13, 2 + (k * 5 | 0), Math.PI / 2 - .3, swing + Math.sin(t * .09 + 2) * .25, 1, gut);
    sausages(c, -1, 14, 2 + (k * 3 | 0), Math.PI / 2, swing * 1.3 + Math.sin(t * .11 + 4) * .3, 1, gut);
    c.fillStyle = '#e3c48f'; // fat lips flapping
    for (let i = -3; i <= 3; i++) c.fillRect(i * 4 * k - .8, 9.5 + Math.abs(i) * .4 + Math.sin(t * .2 + i) * .4, 1.6, 1.2);
  }
  // sizzle off the hot guts
  if (gut.length && gr() < .12 * GX) { const [gx, gy] = gut[gr() * gut.length | 0]; steam(e.x + gx, e.y + gy, 1.4); if (gr() < .5) drip(e.x + gx, e.y + gy + 1, 0, .3, '#d8b048', 1, 90, 1); }
  // grease and lard dripping off the belly / apron, hissing where it lands
  if (gr() < (e.cut ? .3 : .15) * GX) drip(e.x + grr(-20, 20), e.y + grr(20, 40), grr(-.2, .2), .4, gr() < .7 ? '#d8b048' : '#7a0e14', grr(1, 1.6), 120, 1);
  if (gr() < .06 * GX) drip(e.x, e.y + 10, 0, .3, '#c8a040', 1, 100, 1); // navel ooze
  // ---- mouth torn in the hood: drools, gapes and spews burnt chunks ----
  const spit = e.st === 'spit', gape = spit ? Math.min(1, e.wt / 6) * (e.wt < 34 ? 1 : 0) : .25 + .15 * Math.sin(t * .1);
  const mx = -6, my = -27.5;
  ell(c, mx, my, 4.4, .8 + gape * 3.2, 0, '#2a1f12');
  ell(c, mx, my, 3.8, .5 + gape * 2.8, 0, '#140202');
  if (gape > .5) ell(c, mx - .5, my + gape, 2.2, 1.2 * gape, 0, '#8a2a24'); // tongue
  c.fillStyle = '#d8cfb0';
  for (let k = -3; k <= 3; k++) {
    if (k !== 1) poly(c, [[mx + k * 1.1 - .5, my - .6 - gape * 2.6], [mx + k * 1.1 + .5, my - .6 - gape * 2.6], [mx + k * 1.1, my + .6 - gape * 2]]);
    if (k !== -2 && k % 2) poly(c, [[mx + k * 1.1 - .5, my + .6 + gape * 2.6], [mx + k * 1.1 + .5, my + .6 + gape * 2.6], [mx + k * 1.1, my - .4 + gape * 2]]);
  }
  if (spit && e.wt >= 8 && e.wt <= 32) { // projectile vomit of burnt meat, arcing out with the globs
    const k = Math.min(1, (e.wt - 8) / 5) * (e.wt > 27 ? (32 - e.wt) / 5 : 1), pts = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([mx - 2 - u * 30 * k, my + 1 + u * u * 10 * k + Math.sin(t * .6 + i) * .9 * u]); }
    c.lineCap = 'round';
    line(c, pts, 3.4 * k + .5, '#3a2408');
    line(c, pts, 2.2 * k + .3, '#9a7a20');
    line(c, pts.slice(0, 5), .9, '#d8c060');
    for (let i = 2; i < 9; i += 2) { const [vx, vy] = pts[i]; ell(c, vx, vy + Math.sin(t + i) * .8, 1.3, 1, i, i % 4 ? '#2a160c' : '#6a2a14'); }
    c.lineCap = 'butt';
  }
  const dl = 4 + Math.sin(t * .07) * 1.5 + gape * 3; // drool string
  line(c, [[mx + 2.6, my + .6 + gape * 2], [mx + 2.8 + swing * 3, my + dl + 2]], .8, 'rgba(216,184,72,.9)');
  ell(c, mx + 2.8 + swing * 3, my + dl + 2.4, .9, 1.1, 0, '#d8b048');
  if (spit && e.wt >= 8 && e.wt <= 30 && s.spitW !== e.wt && GX > 0) { // spews with the gameplay globs
    s.spitW = e.wt;
    if (e.wt % 2 === 0) chunk(e.x + mx - 3, e.y + my + 1, grr(-3.6, -1.6), grr(-1.4, .8), gr() < .6 ? '#2a160c' : '#5a2a14', grr(1, 1.7), '#0a0402', 1);
    drip(e.x + mx - 3, e.y + my + 1, grr(-3.2, -1.2), grr(-1, 1), gr() < .5 ? '#b4a040' : '#7a2a10', grr(1.2, 2), 70, 1);
  }
  // ---- the eye cluster (unchanged look-at) ----
  const la = Math.atan2($.P.y - e.y + 34, $.P.x - e.x + 6);
  for (const [ex, ey, er] of [[-10, -37, 2.6], [-3, -39, 2.1], [-7, -31.5, 1.6], [0, -33, 1.4], [-13, -31, 1.3]]) {
    ell(c, ex, ey, er + .8, er + .8, 0, '#1a0f08');
    eye(c, ex, ey, er, { ang: la, iris: '#e8b818', bs: 3, blink: (t + ex * 7) % 150 < 5 ? 1 : 0, lid: '#4a3a26' });
  }
  // ---- wounds: fat ruptures, yellow rind round raw meat ----
  for (const w of s.wounds) {
    w.t++;
    const o = Math.min(1, w.t / 7) * w.s;
    c.save();
    c.translate(w.x, w.y);
    c.rotate(w.a);
    const wr = seeded(w.sd + 1);
    c.scale(1.5, .75);
    c.fillStyle = '#3a0a04';
    lump(c, 0, 0, 2.9 * o, 7, wr, .7); c.fill();
    c.fillStyle = '#e3c48f';
    lump(c, 0, 0, 2.4 * o, 7, wr, .7); c.fill();
    c.fillStyle = '#7a0e10';
    lump(c, 0, 0, 1.7 * o, 6, wr, .6); c.fill();
    c.scale(1 / 1.5, 1 / .75);
    ell(c, -.5 * o, -.2 * o, 1.2 * o, .5 * o, 0, '#d04030');
    const bb = (t * .05 + w.sd) % 1; // a bubble of fat rising in it
    if (bb < .8) ell(c, 1.2 * o, -.2, .5 + bb, .4 + bb * .8, 0, '#f0d27a');
    c.restore();
    c.fillStyle = '#c8a040';
    c.fillRect(w.x - .4, w.y + o * 1.4, .9, 1 + o * 2.5);
    if (gr() < .015 * GX) drip(e.x + w.x, e.y + w.y + 2, 0, .3, '#d8b048', 1.1, 90, 1);
  }
  // ---- cleaver arm: same pivot and angle as before, now charred, and the blade caked in rotten meat ----
  const ba = e.ba, ax = -10, ay = -10, L = 34;
  c.lineCap = 'round';
  const ex = ax + Math.cos(ba) * 18, ey = ay + Math.sin(ba) * 18;
  line(c, [[ax, ay], [ex, ey]], 8.5, '#140604');
  line(c, [[ax, ay], [ex, ey]], 6.5, '#3e1a0e');
  line(c, [[ax + Math.cos(ba) * 4, ay + Math.sin(ba) * 4], [ax + Math.cos(ba) * 12, ay + Math.sin(ba) * 12]], 2.2, '#a8322a');
  ell(c, ax + Math.cos(ba) * 13, ay + Math.sin(ba) * 13, 1.5, 1.2, 0, '#e8c66a');
  c.lineCap = 'butt';
  c.save();
  c.translate(ex, ey);
  c.rotate(ba);
  c.fillStyle = '#2a1f12';
  c.fillRect(-2, -2, 8, 4);
  c.fillStyle = '#0e1012';
  c.fillRect(5.5, -9.5, L - 7, 14);
  c.fillStyle = '#3a444e';
  c.fillRect(6, -9, L - 8, 13);
  c.fillStyle = '#8a96a2';
  c.fillRect(6, -9, L - 8, 1.2);
  c.fillStyle = '#5a6672';
  c.fillRect(6, 2.6, L - 8, 1.4);
  c.fillStyle = 'rgba(110,60,20,.6)'; // rust + old grease
  c.fillRect(9, -6, 6, 5);
  c.fillRect(22, -3, 5, 4);
  // caked meat: rotten, green at the edges, hair stuck in it
  const mr8 = seeded(5);
  c.fillStyle = 'rgba(90,6,10,.85)';
  lump(c, 20, -2, 8, 10, mr8, .6); c.fill();
  for (const [mx2, my2, mr, col] of [[11, -4, 3.2, '#4a3a1a'], [17, 0, 2.8, '#6a1a14'], [24, -5, 3.4, '#3e4a18'], [29, -1, 2.4, '#7a2a1a'], [14, -7, 2, '#5a6a20'], [21, 2, 2, '#4a2a10']]) {
    c.fillStyle = '#120a04';
    lump(c, mx2, my2, mr + .6, 7, mr8, .6); c.fill();
    c.fillStyle = col;
    lump(c, mx2, my2, mr, 7, mr8, .6); c.fill();
    c.fillStyle = '#a8c040';
    c.fillRect(mx2 - mr * .5, my2 + mr * .2, 1, 1);
    c.fillStyle = '#e8d8b0';
    c.fillRect(mx2 + mr * .3, my2 - mr * .3, .7, .7);
  }
  c.strokeStyle = '#1a1208';
  c.lineWidth = .4;
  c.beginPath();
  c.moveTo(18, -2); c.quadraticCurveTo(21, -6, 19, -9);
  c.moveTo(25, -4); c.quadraticCurveTo(28, 0, 31, -2);
  c.stroke();
  c.fillStyle = C.blood;
  c.fillRect(L - 10, -9, 4, 11);
  c.fillStyle = '#0b0e11';
  c.beginPath();
  c.arc(L - 4, -5, 1.6, 0, TAU);
  c.fill();
  // goo strand hanging off the edge
  const gs = 3 + Math.sin(t * .1) * 1.5;
  line(c, [[20, 4], [20.5 - Math.sin(ba) * 2, 4 + gs]], .8, 'rgba(160,170,60,.9)');
  ell(c, 20.5 - Math.sin(ba) * 2, 4.5 + gs, .9, 1, 0, '#a8aa40');
  // flies
  if (GX > 0) for (let i = 0; i < Math.ceil(5 * GX); i++) {
    const fx = 18 + Math.sin(T * .31 + i * 2.1) * 9 + Math.sin(T * .9 + i) * 2, fy = -3 + Math.cos(T * .37 + i * 1.3) * 7 + Math.sin(T * 1.3 + i * 4) * 1.5;
    c.fillStyle = '#000';
    c.fillRect(fx - .2, fy - .2, 1.5, 1.4);
    if ((T + i) % 3) { c.fillStyle = 'rgba(225,235,245,.85)'; c.fillRect(fx - .8, fy - 1.1, 3, .8); }
  }
  c.restore();
  if (gr() < .04 * GX) drip(e.x + ex + Math.cos(ba) * 20, e.y + ey + Math.sin(ba) * 20 + 4, 0, .3, gr() < .5 ? '#8a0e14' : '#9aa040', 1, 90);
}

// =====================================================================
//  per-frame FX pass (called from drawWorld): particles, death bursts, lens splats
// =====================================================================
function deathCrux(e) {
  const x = e.x, y = e.y;
  for (let k = 0; k < n$(30); k++) shard(x + grr(-10, 10), y + grr(-50, 40), grr(-3.5, 3.5), grr(-4, 1.5), ['#cfe8f7', '#a84a3e', '#7f8c98', '#d8d0bc', '#463326'][k % 5], grr(1.4, 3.2));
  for (let k = 0; k < n$(12); k++) chunk(x + grr(-8, 8), y + grr(-30, 30), grr(-3, 3), grr(-4, 0), gr() < .5 ? '#a84a3e' : '#7a0e18', grr(1.4, 2.4), '#2a0406');
  for (let k = 0; k < n$(30); k++) drip(x + grr(-6, 6), y + grr(-10, 20), grr(-3.5, 3.5), grr(-4, 1), ['#8a1420', '#d8ecf8', '#b4ae46', '#e2cf5a'][k % 4], grr(1.2, 2.4), 120);
  if (GX > 0) {
    heart(x - 2, y - 4, -1.2, -2.6);
    eyeball(x - 3, y + 26, -1.6, -1.8);
    eyeball(x + 3, y + 26, 1.4, -2.2);
    links(x, y + 4, -.8, -2, 5);
  }
  lens('#7a0a14', '#e8f4ff');
  lens('#9a9a30', '#f0f0b0');
  snd('gicecrack', { vol: 1, wet: .5, spread: .05 }, 0);
}
function deathButcher(e) {
  const x = e.x, y = e.y;
  for (let k = 0; k < n$(18); k++) chunk(x + grr(-14, 14), y + grr(-30, 30), grr(-3.5, 3.5), grr(-4.5, 0), ['#2a160c', '#5a2a14', '#a8322a', '#e3c48f'][k % 4], grr(1.4, 2.6), '#0a0402', k % 2);
  for (let k = 0; k < n$(30); k++) drip(x + grr(-10, 10), y + grr(-10, 20), grr(-3.5, 3.5), grr(-4, 1), gr() < .6 ? '#d8b048' : '#9a1018', grr(1.2, 2.4), 120, 1);
  for (let k = 0; k < n$(16); k++) maggot(x + grr(-12, 12), y + grr(-10, 20), grr(-2, 2), grr(-3, 0));
  for (let k = 0; k < n$(10); k++) fly(x + grr(-15, 15), y + grr(-20, 10), 200 + gr() * 120);
  for (let k = 0; k < n$(12); k++) steam(x + grr(-16, 16), y + grr(-20, 30), 3);
  for (let k = 0; k < n$(14); k++) ember(x + grr(-16, 16), y + grr(-20, 20));
  for (let k = 0; k < Math.max(GX > 0 ? 2 : 0, n$(4)); k++) links(x + grr(-6, 6), y + 10, grr(-2.5, 2.5), grr(-4, -1.5), 3 + (gr() * 3 | 0));
  lens('#8a6a18', '#ffe8a0');
  lens('#7a0a10', '#ffb0a0');
  snd('splat_l', { vol: .9, wet: .4 }, 0);
  snd('gsizzle', { vol: .9, wet: .3, spread: .1 }, 0);
}
export function drawBiomeBossFX() {
  const T = $.T || 0;
  for (let i = TRACK.length - 1; i >= 0; i--) {
    const s = TRACK[i], e = s.e;
    if (!e.dead) continue;
    TRACK.splice(i, 1);
    if (!s.died && e.hp <= 0 && !e.gone) { s.died = 1; (e.k === 'crux' ? deathCrux : deathButcher)(e); }
  }
  if (lastT < 0 || T < lastT) lastT = T;
  const n = Math.min(3, T - lastT);
  lastT = T;
  if (n > 0) stepPS(n);
  if (!PS.length && !LENS.length) return;
  drawPS();
  drawLens();
}

/** pre-build the Crucifer's and Butcher's static art (idle time after boot); false when done */
export function warmBiomeBosses() {
  if (!CRUX) { CRUX = buildCrux(); return true; }
  if (!BUT) { BUT = buildButcher(); BUTC = buildButcherCracks(); return true; }
  return false;
}
