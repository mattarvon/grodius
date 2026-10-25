// @ts-nocheck
// =====================================================================
//  GROSS MIDBOSSES - the four biome midbosses, made as revolting as possible.
//  THE NAIL CHOIR (ice), THE DISSOLVING WOMB (acid), THE BUTCHER'S APPRENTICE (fire), THE BROOD MOTHER (snot).
//  Render-only: own RNG, own particle list, no gameplay state touched. Telegraph shapes are kept from the
//  originals (frost glare, crown bubbling + bloat, sweep cone + glowing mouth, heave + flaring nostrils).
// =====================================================================
import { $ } from '../../state';
import { C, TAU, hash } from '../../core';
import { floorAt } from '../../world';
import { SET } from '../../save';
import { sample } from '../../audio';
import { drawHookTip, drawSkull, glow, poly } from '../util';
import { eye } from '../eyes';

/** dial-back knob: 0 = the old clean art (plus the base redesign), 1 = full gross. Scales drips, strands, bubbles, particles, maggots, sound. */
export const GROSS = 1;

// ---------------- render-side RNG + particles (never touches core R()) ----------------
let seed = 0x6b1d3a5;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rn = (a, b) => a + rnd() * (b - a);
const FX = new WeakMap();
const PMAX = () => Math.round(90 * GROSS);
let sndT = 0;
/** per-midboss render state: particles (screen space), strand/bubble cycle memory, state-change edge */
function fxs(e) {
  let s = FX.get(e);
  if (!s) FX.set(e, s = { p: [], t: e.t, st: e.st, sc: {}, f: {} });
  s.dt = Math.max(0, Math.min(4, e.t - s.t));
  s.t = e.t;
  s.ev = s.st !== e.st ? s.st + '>' + e.st : '';
  s.st = e.st;
  return s;
}
// kinds: 0 drop (streaks, puddles on the floor), 1 fat spit (hot, glows), 2 maggot, 3 puddle, 4 chunk
function emit(s, x, y, vx, vy, col, r = 1, k = 0, l = 70, g = .12) {
  if (GROSS <= 0 || s.p.length >= PMAX()) return;
  s.p.push({ x, y, vx, vy, col, r, k, l, ml: l, g, ph: rnd() * TAU });
}
function spray(s, x, y, n, col, sp = 1.2, r = 1, up = .6) {
  n = Math.round(n * GROSS);
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, v = rn(.3, 1) * sp; emit(s, x, y, Math.cos(a) * v, Math.sin(a) * v - up, col, r * rn(.6, 1.2), 0, rn(40, 80)); }
}
function stepParts(s) {
  const dt = s.dt;
  if (!dt) return;
  const sc = $.G ? $.G.scroll : 0;
  for (let i = s.p.length - 1; i >= 0; i--) {
    const p = s.p[i];
    p.l -= dt;
    if (p.l <= 0) { s.p[i] = s.p[s.p.length - 1]; s.p.pop(); continue; }
    if (p.k === 3) { p.r = Math.min(p.r + .04 * dt, p.rm); continue; }
    p.vy += p.g * dt;
    p.vx *= Math.pow(.985, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.k !== 1 && p.vy > 0 && p.y >= floorAt(p.x + sc) - 1) { // splat into a puddle
      p.k = 3; p.y = floorAt(p.x + sc) - .5; p.rm = p.r * 2.2 + 1; p.r *= .8; p.l = Math.min(p.l, 50); p.ml = 50; p.vx = p.vy = 0;
    }
  }
}
function drawParts(c, s, e) {
  const ox = -e.x, oy = -e.y;
  for (const p of s.p) {
    const x = p.x + ox, y = p.y + oy, a = Math.min(1, p.l / p.ml * 2.5);
    c.globalAlpha = a;
    if (p.k === 0 || p.k === 4) {
      const st = Math.min(4, Math.hypot(p.vx, p.vy) * 1.4);
      c.fillStyle = p.col;
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2);
      c.beginPath();
      c.ellipse(0, -st * .5, p.r * .55, p.r * .55 + st * .5, 0, 0, TAU);
      c.fill();
      c.restore();
    } else if (p.k === 1) {
      c.fillStyle = p.col;
      c.fillRect(x - .5, y - .5, 1.2, 1.2);
      c.globalCompositeOperation = 'lighter';
      glow(x, y, 3, '255,190,60', .5 * a * (SET.flashes ? 1 : .5));
      c.globalCompositeOperation = 'source-over';
    } else if (p.k === 2) {
      wiggler(c, x, y, Math.atan2(p.vy, p.vx) + Math.sin(p.l * .6 + p.ph) * .9, 1);
    } else {
      c.fillStyle = p.col;
      c.beginPath();
      c.ellipse(x, y, p.r, p.r * .35, 0, 0, TAU);
      c.fill();
    }
  }
  c.globalAlpha = 1;
}
/** a gob hanging from (x,y): stretches over P frames, lets go as a falling drop, starts again */
function strand(c, s, e, id, x, y, len, w, col, P, tip = col, sway = 1.5) {
  if (GROSS <= 0) return;
  const tt = e.t + hash(id) * P, f = (tt % P) / P, cyc = Math.floor(tt / P), key = 's' + id;
  const L = len * Math.min(1.5, GROSS) * (.3 + .7 * f * f), sw = Math.sin(e.t * .05 + id) * sway * (L / len);
  if (s.sc[key] !== undefined && s.sc[key] !== cyc) emit(s, e.x + x + sw, e.y + y + L, sw * .03, .3, tip, w * 1.1 + .4, 0, 90);
  s.sc[key] = cyc;
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + sw * .2, y + L * .55, x + sw, y + L);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = tip;
  c.beginPath();
  c.arc(x + sw, y + L, w * .55 + f * w * .45, 0, TAU);
  c.fill();
}
/** a bubble that inflates over P frames and pops into a spray (or with k forced 0..1) */
function bubble(c, s, e, id, x, y, rmax, P, fill, rim, pc = rim, n = 4, kf = -1) {
  if (GROSS <= 0) return 0;
  const tt = e.t + hash(id + 50) * P, f = kf >= 0 ? kf : (tt % P) / P, cyc = kf >= 0 ? 0 : Math.floor(tt / P), key = 'b' + id;
  if (kf < 0 && s.sc[key] !== undefined && s.sc[key] !== cyc) { spray(s, e.x + x, e.y + y, n, pc, .9, .9); if (n >= 5) popSnd(s, .3); }
  s.sc[key] = cyc;
  const r = rmax * Math.pow(f, .6);
  if (r < .45) return r;
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.strokeStyle = rim;
  c.lineWidth = .5;
  c.stroke();
  c.fillStyle = 'rgba(255,255,240,.85)';
  const h = Math.max(.6, r * .35);
  c.fillRect(x - r * .5, y - r * .55, h, h);
  return r;
}
function wiggler(c, x, y, a, s) { // a maggot: fat, pale, segmented, black mouth hooks
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = '#efe6c4';
  c.beginPath();
  c.ellipse(0, 0, 1.9 * s, .9 * s, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(150,130,90,.8)';
  c.fillRect(-.6 * s, -.8 * s, .4, 1.6 * s);
  c.fillRect(.5 * s, -.8 * s, .4, 1.6 * s);
  c.fillStyle = '#1a0e08';
  c.fillRect(1.4 * s, -.3, .7, .6);
  c.restore();
}
const lay = {};
function layer(k, w, h, f) {
  if (lay[k]) return lay[k];
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  f(cv.getContext('2d'), w, h);
  return lay[k] = cv;
}
// layer-local seeded noise (stable art)
const hn = (i, j = 0) => hash(i * 7.13 + j * 31.7 + 11);
function popSnd(s, v) { // throttled wet pops, render-driven (audio RNG only)
  if (GROSS <= 0 || $.T - sndT < 9) return;
  sndT = $.T;
  sample('gross_pop', { vol: v * GROSS, wet: .2, spread: .25 });
}
function snd(bank, vol, wet = .3) { if (GROSS > 0) sample(bank, { vol: vol * Math.min(1, GROSS), wet, spread: .18 }); }
const blob = (c, n, r0, f) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = f(a, i % n) * r0; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };

// =====================================================================
//  THE NAIL CHOIR - a frozen pus-weeping eye in a crust of gargling, frostbitten mouths
// =====================================================================
const chRim = (a, i) => (i % 2 ? 15 : 21) + hash(i + 3) * 4;
const choirCrust = () => layer('choir', 60, 60, (x) => {
  x.translate(30, 30);
  x.fillStyle = '#081420';
  blob(x, 16, 1, chRim);
  x.fill();
  x.fillStyle = 'rgba(150,205,245,.6)';
  blob(x, 16, .86, chRim);
  x.fill();
  // dirty ice: frozen phlegm, old blood and pus caught in the crust
  x.save();
  blob(x, 16, .86, chRim);
  x.clip();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + hn(i) * .5, r = 15 + hn(i, 1) * 4, px = Math.cos(a) * r, py = Math.sin(a) * r, k = hn(i, 2);
    x.fillStyle = k < .5 ? 'rgba(190,200,70,.45)' : k < .75 ? 'rgba(110,20,30,.45)' : 'rgba(225,200,90,.5)';
    x.beginPath();
    x.ellipse(px, py, 2 + hn(i, 3) * 2, 1.2 + hn(i, 4) * 1.2, a, 0, TAU);
    x.fill();
  }
  x.strokeStyle = 'rgba(190,200,70,.5)'; // phlegm streaks frozen mid-run
  x.lineWidth = .8;
  x.beginPath();
  for (let i = 0; i < 7; i++) { const a = hn(i, 9) * TAU, r = 13 + hn(i, 8) * 5; x.moveTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a) * r + hn(i, 7) * 2 - 1, Math.sin(a) * r + 3 + hn(i, 6) * 3); }
  x.stroke();
  x.restore();
  x.strokeStyle = '#f2fbff';
  x.lineWidth = .7;
  x.beginPath();
  for (let i = 0; i < 16; i += 2) { const a = i / 16 * TAU, r = chRim(a, i) * .86; x.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.stroke();
});
// mouths: [x, y, size, drools] - set into the crust, facing out
const MOUTHS = [[-17, 1, 1.35, 1], [-11, -13, 1.1, 0], [-11, 13, 1.2, 1], [11, -12.5, 1, 0], [13, 9.5, 1.1, 1]];
function choirMouth(c, s, e, k, mx, my, sz, drool, tel) {
  const t = e.t, o = .45 + .55 * Math.max(0, Math.sin(t * (.09 + tel * .25) + k * 2)) + tel * .4, g = Math.sin(t * .7 + k) * .25 * (1 + tel * 2);
  c.save();
  c.translate(mx, my);
  c.scale(sz, sz);
  // frostbitten lips: purple-black, rimed white, split open and beading blood
  c.fillStyle = '#1c0c1c';
  c.beginPath();
  c.ellipse(0, 0, 4.4, 3 + o * .9, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7a4068';
  c.beginPath();
  c.ellipse(0, -.2, 3.8, 2.5 + o * .8, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(230,245,255,.85)';
  c.fillRect(-2.6, -2.6 - o * .8, 2, .7);
  c.fillStyle = '#140810';
  c.fillRect(1.2, -2.4 - o * .7, 1.6, .9);
  c.fillRect(-3, 1 + o * .5, 1.5, 1);
  // the throat, full of phlegm, gargling
  c.fillStyle = '#050102';
  c.beginPath();
  c.ellipse(0, 0, 2.9, 1.7 * o + .4, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(190,200,70,.95)';
  c.beginPath();
  c.ellipse(g, .7 * o + .3, 1.8, .7 * o, 0, 0, Math.PI);
  c.fill();
  // rotten teeth: brown, black, one missing
  const T = ['#f0e4b0', '#8a7034', '#e0cc80', null, '#4a3414', '#fff4c8'];
  for (let i = 0; i < 3; i++) { const col = T[(i + k) % 6]; if (col) { c.fillStyle = col; c.fillRect(-2 + i * 1.4, -1.6 * o - .4, 1.1, 1.2 + (i % 2) * .5); } }
  for (let i = 0; i < 2; i++) { const col = T[(i + k + 3) % 6]; if (col) { c.fillStyle = col; c.fillRect(-1.3 + i * 1.6, 1.6 * o - .9, 1, 1); } }
  // splits in the lips, beading blood
  c.strokeStyle = '#d0203a';
  c.lineWidth = .45;
  c.beginPath();
  c.moveTo(-1, -2.4 - o * .8); c.lineTo(-.6, -1.4 - o * .7);
  c.moveTo(1.2, 2.2 + o * .7); c.lineTo(.8, 1.4 + o * .6);
  c.stroke();
  c.restore();
  // gargle bubbles boiling out of the phlegm
  bubble(c, s, e, k * 3 + 1, mx + g * 2, my + .6 * sz, (.9 + tel * 1.4) * sz, tel ? 14 : 28, 'rgba(210,215,110,.7)', 'rgba(240,245,160,.9)', '#c8cc5a', 3);
  if (drool) strand(c, s, e, k + 10, mx + .5, my + (1.6 * o + .5) * sz, 9 * sz, 1.1, 'rgba(195,205,85,.85)', 95 + k * 13, '#e4f0c0', 1.2);
}
export function grossChoir(c, e) {
  const s = fxs(e), t = e.t, tel = e.st === 'tel' ? e.wt / 40 : 0;
  stepParts(s);
  if (s.ev === 'idle>tel') snd('gross_gargle', .55, .4);
  // tongues nailed to its orbiting nails, frozen stiff, spit icicles hanging off them
  for (const b of e.bars || []) {
    if (b.dead || GROSS <= 0) continue;
    const bx = b.x - e.x, by = b.y - e.y, fl = Math.sin(t * .06 + b.i * 3) * .4;
    c.save();
    c.translate(bx, by);
    c.fillStyle = '#4a1a2a';
    c.beginPath();
    c.moveTo(1, -6); c.quadraticCurveTo(8, -7 + fl, 11, -1 + fl * 2); c.quadraticCurveTo(8, 2, 1, 0);
    c.fill();
    c.fillStyle = '#a65a72';
    c.beginPath();
    c.moveTo(1, -5.2); c.quadraticCurveTo(7.5, -6 + fl, 10, -1.4 + fl * 2); c.quadraticCurveTo(7, .8, 1, -.8);
    c.fill();
    c.fillStyle = 'rgba(200,210,90,.8)';
    c.fillRect(4, -4, 3, .8);
    c.fillStyle = '#2a0a14';
    c.fillRect(5.5, -3.6, .5, 2.6);
    c.fillStyle = '#d8efff';
    for (let q = 0; q < 3; q++) poly(c, [[3 + q * 2.6, -.4], [4.4 + q * 2.6, -.6], [3.7 + q * 2.6, 3 + hash(q + b.i * 5) * 3]]);
    c.restore();
    strand(c, s, e, 40 + b.i, bx + 9.5, by + fl * 2, 6, .8, 'rgba(195,205,85,.8)', 120 + b.i * 17, '#e4f0c0', .8);
  }
  // pus-cicles: the eye's pus ran down and froze; it still drips
  for (let k = -2; k <= 2; k++) {
    const pus = k !== 1, h = 22 + hash(k + 9) * 6 + (pus ? 4 * GROSS : 0), x0 = k * 5;
    c.fillStyle = pus ? '#c8b040' : '#d8efff';
    poly(c, [[x0 - 1.9, 15], [x0 + 1.9, 15], [x0, h]]);
    c.fillStyle = pus ? 'rgba(240,225,120,.9)' : '#f4fbff';
    poly(c, [[x0 - 1, 15], [x0, 15], [x0 - .2, h - 3]]);
    if (pus) strand(c, s, e, 20 + k, x0, h - .5, 4, .9, 'rgba(225,205,80,.9)', 70 + k * 11, '#f0e070', .4);
  }
  c.drawImage(choirCrust(), -30, -30);
  const g = c.createRadialGradient(-3, -4, 1, 0, 0, 13);
  g.addColorStop(0, '#d88a7a');
  g.addColorStop(.6, '#7a3a3a');
  g.addColorStop(1, '#2a0f14');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 13, 0, TAU);
  c.fill();
  // infected socket: yellow-green crust ringing the eye
  c.fillStyle = 'rgba(205,200,70,.9)';
  for (const [x, y, r] of [[-10, -1, 1.6], [6.2, 2, 1.3], [-6, 7.2, 1.2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // the choir: frostbitten mouths with rotten teeth, gargling frozen phlegm
  for (let k = 0; k < MOUTHS.length; k++) { const [mx, my, sz, dr] = MOUTHS[k]; if (k < 3 || GROSS > 0) choirMouth(c, s, e, k, mx, my, sz, dr && GROSS > 0, tel); }
  eye(c, -2, 0, 7.5, { ang: e.st === 'tel' ? e.ha : Math.atan2($.P.y - e.y, $.P.x - e.x), iris: '#9fd8ff', bs: 3, blink: !tel && t % 170 < 5 ? 1 : 0, lid: '#5a2a3a' });
  // nails driven through the lids
  c.fillStyle = '#b8c4d0';
  for (const [x, y, a] of [[-2, -9, 1.7], [-2, 9, -1.7], [6, -5, 2.6]]) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillRect(-1, -6, 2, 9);
    c.fillRect(-2.2, -6, 4.4, 1.3);
    c.restore();
  }
  // it weeps pus from under the lid, a thick yellow run that freezes on the way down
  const wp = (Math.sin(t * .05) + 1) * .5;
  c.fillStyle = '#d8c040';
  c.beginPath();
  c.moveTo(-7, 5); c.quadraticCurveTo(-9, 10, -10.2, 15 + wp * 2); c.lineTo(-7.2, 15 + wp * 2); c.quadraticCurveTo(-6, 10, -3.5, 6.5);
  c.fill();
  c.fillStyle = 'rgba(255,245,170,.9)';
  c.fillRect(-7.4, 9, .7, 3);
  c.fillStyle = C.blood;
  c.fillRect(-2.6, 8, 1.2, 6 + Math.sin(t * .05) * 2);
  c.fillRect(5, -1, 1, 4);
  strand(c, s, e, 31, -8.6, 15 + wp * 2, 5, 1.2, '#d8c040', 60, '#f0e070', .5);
  drawParts(c, s, e);
  if (tel) {
    c.globalCompositeOperation = 'lighter';
    glow(-2, 0, 10 + tel * 14, '160,215,255', .25 + .55 * tel);
    c.globalCompositeOperation = 'source-over';
  }
}

// =====================================================================
//  THE DISSOLVING WOMB - see-through, veined, sloshing with bile; the half-digested child still twitches
// =====================================================================
const wombVeins = () => layer('wveins', 50, 50, (x) => {
  x.translate(25, 25);
  x.beginPath();
  x.arc(0, 0, 20.5, 0, TAU);
  x.clip();
  x.lineCap = 'round';
  const br = (px, py, a, w, n, d) => {
    for (let i = 0; i < n; i++) {
      const nx = px + Math.cos(a) * 2.2, ny = py + Math.sin(a) * 2.2;
      x.strokeStyle = d ? '#c0304a' : '#7a1a40';
      x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      px = nx; py = ny; a += (hn(px, py) - .5) * .9; w *= .9;
      if (d < 2 && hn(py, px) < .22) br(px, py, a + (hn(i, d) < .5 ? .8 : -.8), w * .8, n - i - 1, d + 1);
    }
  };
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .4; br(Math.cos(a) * 21, Math.sin(a) * 21, a + Math.PI + (hn(i, 5) - .5) * .6, 1.3, 7, 0); }
});
export function grossCyst(c, e) {
  const s = fxs(e), t = e.t, sw = (e.sw || 0) / 30, sc = 1 + sw * .22 + Math.sin(t * .07) * .03, tel = e.st === 'tel' ? e.wt / 45 : 0, rim = (a, i) => 22 + Math.sin(a * 4 + t * .06) * 1.6 + hash(i) * 2;
  stepParts(s);
  if (s.ev === 'idle>swell') snd('gross_slosh', .5, .35);
  if (s.ev === 'swell>idle') { spray(s, e.x, e.y + 4, 16, '#a6e02a', 2, 1.4, .4); spray(s, e.x, e.y + 4, 8, '#8a2a3a', 1.6, 1.2, .2); }
  // placenta: ragged maroon strands with clots, hanging into the lake, dripping
  c.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    const x0 = k * 6, L = 26 + hash(k + 4) * 14, w1 = Math.sin(t * .05 + k) * 4, w2 = Math.sin(t * .04 + k * 1.7) * 6;
    c.strokeStyle = '#3a0a18';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0, 16);
    c.quadraticCurveTo(x0 * 1.4 + w1, 16 + L * .5, x0 + w2, 16 + L);
    c.stroke();
    c.strokeStyle = k % 2 ? '#8a2a3a' : '#6a1a30';
    c.lineWidth = 1.8;
    c.stroke();
    c.fillStyle = '#a03040';
    for (let q = 1; q < 4; q++) { const f = q / 4; c.beginPath(); c.arc(x0 + (x0 * .4 + w1) * 2 * f * (1 - f) + w2 * f * f, 16 + L * f, 1 + hash(q + k * 3) * .9, 0, TAU); c.fill(); }
    strand(c, s, e, 60 + k, x0 + w2, 16 + L, 5, 1.1, '#7a1a2a', 70 + k * 9, '#a02a3a', 1);
  }
  c.lineCap = 'butt';
  c.save();
  c.scale(sc, sc * (1 - sw * .08));
  // membrane: thin, see-through, fleshy
  c.fillStyle = 'rgba(52,14,34,.94)';
  blob(c, 22, 1, rim);
  c.fill();
  c.fillStyle = 'rgba(150,80,100,.42)';
  blob(c, 22, .9, rim);
  c.fill();
  c.save();
  blob(c, 22, .9, rim);
  c.clip();
  // the child: curled, skin going, skull showing, twitching
  const k = Math.sin(t * .04), tw = (t % 97 < 7 || t % 151 < 4) ? Math.sin(t * 2.3) * 1.4 : 0, kx = k + tw, ky = tw * .5;
  c.fillStyle = 'rgba(140,60,48,.92)';
  c.beginPath();
  c.ellipse(2 + kx, 4 + ky, 8, 10, .6 + k * .15 + tw * .1, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(221,210,122,.75)';
  c.beginPath();
  c.ellipse(4 + kx, 6 + ky, 4, 6, .6, 0, TAU);
  c.fill();
  // peeling skin flaps
  c.fillStyle = 'rgba(200,120,100,.9)';
  poly(c, [[-4 + kx, 7 + ky], [-7 + kx, 10 + ky + tw], [-3 + kx, 9 + ky]]);
  poly(c, [[7 + kx, -2 + ky], [10 + kx, -4 + ky - tw], [8 + kx, 0 + ky]]);
  // a kicking limb
  c.strokeStyle = '#a05040';
  c.lineWidth = 1.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-2 + kx, 10 + ky);
  c.lineTo(-6 + kx - tw * 1.5, 14 + ky + Math.sin(t * .1) * 1.2);
  c.lineTo(-8 + kx - tw * 2, 13 + ky);
  c.stroke();
  c.lineCap = 'butt';
  drawSkull(c, -4 + kx, -7 + ky, 5, 1);
  c.strokeStyle = C.bone;
  c.lineWidth = 1;
  c.beginPath();
  for (let q = 0; q < 4; q++) { c.moveTo(-1 + q * 2.5 + kx, 0 + ky); c.quadraticCurveTo(3 + q * 2.5 + kx, 4 + ky, 1 + q * 2.5 + kx, 9 + ky); }
  c.stroke();
  // umbilical cord to the wall, coiled and pulsing
  c.strokeStyle = '#4a1a3a';
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(6 + kx, 6 + ky);
  c.bezierCurveTo(14, 12 + Math.sin(t * .06) * 3, 18, -2, 13, -13);
  c.stroke();
  c.strokeStyle = '#9a5a7a';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = '#d090a8';
  c.lineWidth = .6;
  c.setLineDash([1.2, 1.6]);
  c.lineDashOffset = -t * .15;
  c.stroke();
  c.setLineDash([]);
  // bile: green and sloshing over the lower half, digesting it
  const lv = 3 - sw * 4 + Math.sin(t * .05) * 1.5, tl = Math.sin(t * .03) * 3;
  c.fillStyle = 'rgba(150,210,30,.5)';
  c.beginPath();
  c.moveTo(-26, lv + tl);
  for (let x = -26; x <= 26; x += 4) c.lineTo(x, lv + tl * (-x / 26) + Math.sin(x * .4 + t * .12) * 1.1);
  c.lineTo(26, 30);
  c.lineTo(-26, 30);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(220,255,110,.85)';
  c.lineWidth = .7;
  c.beginPath();
  for (let x = -26; x <= 26; x += 4) { const y = lv + tl * (-x / 26) + Math.sin(x * .4 + t * .12) * 1.1; x === -26 ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
  // digesting fizz in the bile
  c.fillStyle = 'rgba(230,255,150,.8)';
  for (let q = 0; q < 8; q++) { const bx = -14 + hash(q + 31) * 28, by = lv + 14 - ((t * .3 + hash(q + 7) * 30) % 14); c.fillRect(bx, by, .8, .8); }
  c.restore();
  // veins through the membrane, swelling dark red as it bloats
  c.globalAlpha = Math.min(1, .55 + .2 * Math.sin(t * .11) + sw * .45);
  c.drawImage(wombVeins(), -25, -25);
  if (sw > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = sw * .5; c.drawImage(wombVeins(), -25, -25); c.globalCompositeOperation = 'source-over'; }
  c.globalAlpha = 1;
  // holes eaten through the membrane, acid-raw edges, oozing
  for (const [x, y, r] of [[-12, 8, 4], [13, -6, 3.2], [6, 15, 2.6], [-8, -15, 2.2]]) {
    c.fillStyle = '#04110e';
    c.beginPath();
    c.ellipse(x, y, r, r * .8, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#7ff0d8';
    c.lineWidth = .7;
    c.stroke();
    c.strokeStyle = 'rgba(200,60,80,.8)';
    c.lineWidth = .5;
    c.beginPath();
    c.ellipse(x, y, r + .7, r * .8 + .6, 0, .4, 2.6);
    c.stroke();
  }
  // acid blisters swelling up on the membrane and popping
  const BL = [[-15, -6, 2.6], [15, 4, 2.2], [-3, -18, 1.8], [9, -15, 2], [-17, 3, 1.6], [16, -11, 1.5], [-1, 18, 1.8]];
  for (let q = 0; q < BL.length; q++) { const [bx, by, br] = BL[q]; bubble(c, s, e, 100 + q, bx, by, br * (1 + sw * .4), 50 + q * 13, 'rgba(180,240,60,.75)', 'rgba(230,255,140,.95)', '#a6e02a', 4); }
  c.fillStyle = 'rgba(230,220,240,.5)';
  c.beginPath();
  c.ellipse(-8, -12, 4, 1.8, -.6, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)';
  c.fillRect(11, 8, 1.5, .8);
  // the crown it spouts from
  c.fillStyle = '#0a2a24';
  c.beginPath();
  c.ellipse(-2, -20, 5, 3 + tel * 2, 0, 0, TAU);
  c.fill();
  c.fillStyle = tel ? '#a6ff2a' : '#46e0c0';
  c.beginPath();
  c.ellipse(-2, -20, 2.6, 1.4 + tel * 1.6, 0, 0, TAU);
  c.fill();
  c.restore();
  // ooze from the holes
  strand(c, s, e, 70, -12 * sc, 11 * sc, 6, 1.2, 'rgba(150,220,40,.85)', 64, '#c8ff50', 1);
  strand(c, s, e, 71, 6 * sc, 17 * sc, 5, 1, 'rgba(150,220,40,.85)', 82, '#c8ff50', 1);
  drawParts(c, s, e);
  if (tel || sw) {
    c.globalCompositeOperation = 'lighter';
    glow(-2, tel ? -20 : 0, tel ? 8 + tel * 12 : 16 + sw * 18, '60,230,195', .2 + .5 * Math.max(tel, sw));
    c.globalCompositeOperation = 'source-over';
  }
}

// =====================================================================
//  THE BUTCHER'S APPRENTICE - blistered, weeping, crawling with maggots, crying, snot bubble, offal loincloth
// =====================================================================
const burnTex = () => layer('burn', 32, 44, (x) => {
  x.translate(16, 22);
  x.beginPath();
  x.ellipse(0, 0, 13.5, 19.5, 0, 0, TAU);
  x.clip();
  for (let i = 0; i < 40; i++) { // charred scabs + raw weeping patches
    const px = (hn(i) - .5) * 26, py = (hn(i, 1) - .5) * 38, k = hn(i, 2);
    x.fillStyle = k < .45 ? 'rgba(12,3,2,.85)' : k < .7 ? 'rgba(200,40,36,.85)' : k < .85 ? 'rgba(255,120,40,.6)' : 'rgba(245,215,110,.75)';
    x.beginPath();
    x.ellipse(px, py, 1 + hn(i, 3) * 2.6, .8 + hn(i, 4) * 1.8, hn(i, 5) * 3, 0, TAU);
    x.fill();
  }
  x.strokeStyle = 'rgba(255,100,30,.75)'; // cracked, split skin, the meat under it still cooking
  x.lineWidth = .6;
  x.beginPath();
  for (let i = 0; i < 9; i++) { let px = (hn(i, 6) - .5) * 24, py = (hn(i, 7) - .5) * 34; x.moveTo(px, py); for (let q = 0; q < 3; q++) { px += (hn(i, q + 8) - .5) * 6; py += 2 + hn(q, i) * 3; x.lineTo(px, py); } }
  x.stroke();
  x.strokeStyle = 'rgba(240,215,110,.55)'; // dried serum runs
  x.lineWidth = .7;
  x.beginPath();
  for (let i = 0; i < 6; i++) { const px = (hn(i, 12) - .5) * 20, py = (hn(i, 13) - .5) * 24; x.moveTo(px, py); x.lineTo(px + .5, py + 4 + hn(i, 14) * 5); }
  x.stroke();
});
// blisters on the body: [x, y, rmax]
const BLIS = [[-8, -12, 2.8], [-10, -3, 3.2], [-4, -5, 2.2], [10, -14, 2.4], [-1, -15, 2], [12, -3, 2.2], [-11, 4, 1.8]];
function offal(c, t) { // loincloth of guts: dangling intestine loops, a kidney; returns the loop bottoms (they drip)
  c.lineCap = 'round';
  const loops = [[-13, 6, 20], [-7, 7, 27], [-1, 6, 18], [5, 7, 24]], bot = [];
  for (let i = 0; i < loops.length; i++) {
    const [x0, y0, d] = loops[i], sw = Math.sin(t * .06 + i * 1.3) * 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(x0 - 2 + sw, y0 + d, x0 + 8 + sw, y0 + d, x0 + 6, y0);
    c.strokeStyle = '#2a0608';
    c.lineWidth = 4.2;
    c.stroke();
    c.strokeStyle = i % 2 ? '#b8606a' : '#cc8080';
    c.lineWidth = 3;
    c.stroke();
    c.strokeStyle = 'rgba(255,215,215,.75)';
    c.lineWidth = .7;
    c.stroke();
    bot.push([x0 + 3 + sw * .75, y0 + d * .75 + 1.5]);
  }
  c.lineCap = 'butt';
  // the belt of it: a twist of bowel across the waist
  c.fillStyle = '#3a0a0c';
  poly(c, [[-14, 3], [13, 3], [13, 8.5], [-14, 8.5]]);
  c.fillStyle = '#a84850';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-11.5 + i * 4.6, 5.8, 2.6, 1.9, .5, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,200,200,.7)';
  for (let i = 0; i < 6; i++) c.fillRect(-12.6 + i * 4.6, 4.6, 1.4, .6);
  // a kidney hanging off it on a tube
  const ks = Math.sin(t * .05) * 1.4;
  c.strokeStyle = '#6a1a22';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(10, 8);
  c.lineTo(12 + ks, 22);
  c.stroke();
  c.fillStyle = '#3a060c';
  c.beginPath();
  c.ellipse(12 + ks, 25, 3, 3.8, .3, 0, TAU);
  c.fill();
  c.fillStyle = '#802030';
  c.beginPath();
  c.ellipse(11.6 + ks, 24.4, 2, 2.8, .3, 0, TAU);
  c.fill();
  bot.push([12 + ks, 28.5]);
  return bot;
}
export function grossPrentice(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  c.fillStyle = '#1a0503';
  c.beginPath();
  c.ellipse(1, 3, 15, 21, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#4e180e';
  c.beginPath();
  c.ellipse(0, 2, 13.5, 19.5, 0, 0, TAU);
  c.fill();
  c.drawImage(burnTex(), -16, -20);
  c.fillStyle = '#2a0a06';
  const HOLES = [[6, -8, 4, 3], [-7, 10, 3, 4], [8, 12, 2.4, 2]];
  for (const [x, y, rx, ry] of HOLES) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
  }
  c.strokeStyle = C.bone;
  c.lineWidth = 1.3;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(2, -10 + k * 5);
    c.quadraticCurveTo(9, -9 + k * 5, 11, -4 + k * 5);
    c.stroke();
  }
  // maggots writhing in the burn holes
  if (GROSS > 0) for (let h = 0; h < HOLES.length; h++) {
    const [hx, hy, rx, ry] = HOLES[h], n = Math.round((4 - h) * GROSS);
    for (let q = 0; q < n; q++) { const a = t * .03 * (q % 2 ? 1 : -1) + q * 2.1 + h; wiggler(c, hx + Math.cos(a) * rx * .5, hy + Math.sin(a) * ry * .5, a + Math.PI / 2 + Math.sin(t * .3 + q) * .6, 1.1); }
  }
  // blisters: swelling, weeping, popping; burning fat spits off the skin
  for (let q = 0; q < BLIS.length; q++) {
    const [bx, by, br] = BLIS[q];
    c.fillStyle = 'rgba(230,40,30,.85)'; // angry red base
    c.beginPath();
    c.arc(bx, by + .3, br * .9 + .5, 0, TAU);
    c.fill();
    const r = bubble(c, s, e, 200 + q, bx, by, br, 60 + q * 17, 'rgba(240,220,150,.9)', 'rgba(255,245,200,.95)', '#f0d070', 5);
    if (r > br * .8 && rnd() < .05 * s.dt * GROSS) emit(s, e.x + bx, e.y + by, rn(-.8, .8), rn(-1.6, -.5), '#ffe080', 1, 1, rn(20, 40), .1);
  }
  if (rnd() < .2 * s.dt * GROSS) { const a = rnd() * TAU; emit(s, e.x + Math.cos(a) * 12, e.y + 2 + Math.sin(a) * 18, Math.cos(a) * rn(.4, 1.2), rn(-1.8, -.6), rnd() < .5 ? '#ffd060' : '#fff0b0', 1, 1, rn(18, 36), .09); }
  // weeping burns: serum running off the wounds
  strand(c, s, e, 210, -9, -2, 5, .8, 'rgba(235,215,120,.85)', 55, '#f0e090', .4);
  strand(c, s, e, 211, 10, 4, 4, .8, 'rgba(235,215,120,.85)', 70, '#f0e090', .4);
  // maggots crawling over the skin, and dropping off
  if (GROSS > 0) for (let q = 0; q < Math.round(6 * GROSS); q++) {
    const a = t * (.008 + q * .002) * (q % 2 ? 1 : -1) + q * 1.7, mx = Math.cos(a) * (8 + (q % 3) * 1.5), my = -6 + Math.sin(a) * (9 + (q % 2) * 2);
    wiggler(c, mx, my, a + (q % 2 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(t * .25 + q) * .5, 1.35);
  }
  if (rnd() < .025 * s.dt * GROSS) emit(s, e.x + rn(-8, 8), e.y + rn(8, 18), rn(-.3, .3), .2, '#efe6c4', 1, 2, 90, .1);
  // loincloth of offal
  const bot = offal(c, t);
  for (let i = 0; i < bot.length; i++) if (i !== 2) strand(c, s, e, 220 + i, bot[i][0], bot[i][1], 5 + i, 1.1, i === 4 ? '#5a0a10' : '#8a1018', 48 + i * 11, '#c01a24', .6);
  drawHookTip(c, 0, -21, Math.PI, 1);
  // sack hood, three eyes, a mouth that glows before it spits
  c.fillStyle = '#3a2a1a';
  c.beginPath();
  c.ellipse(-4, -24, 8.5, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5a4630';
  c.beginPath();
  c.ellipse(-4, -25, 7.5, 7, 0, 0, TAU);
  c.fill();
  // sodden with tears and snot: dark wet patches on the sack
  c.fillStyle = 'rgba(30,20,10,.55)';
  c.beginPath();
  c.ellipse(-8, -21, 3.4, 4, .2, 0, TAU);
  c.fill();
  const la = Math.atan2($.P.y - e.y + 24, $.P.x - e.x + 4), spit = e.st === 'spit' && e.wt < 40, sk = Math.min(1, e.wt / 24);
  if (s.ev === 'idle>spit' && GROSS > 0) { spray(s, e.x - 13.5, e.y - 23, 7, '#c8d060', 1.2, 1); popSnd(s, .6); }
  const EY = [[-7, -27, 1.9], [-2, -28, 1.5], [-5, -22, 1.2]];
  for (const [ex, ey, er] of EY) eye(c, ex, ey, er, { ang: la, iris: '#ffb347', bs: 3, blink: (t + ex * 9) % 140 < 5 ? 1 : 0, lid: '#3a2a1a' });
  // crying: tear tracks streaming down, red raw rims
  if (GROSS > 0) {
    c.fillStyle = 'rgba(190,230,255,.85)';
    for (let q = 0; q < 3; q++) {
      const [ex, ey, er] = EY[q], L = 4 + ((t * .2 + q * 3) % 5);
      c.fillRect(ex - .3 - (q === 2 ? .8 : 0), ey + er, .6, L);
      c.beginPath();
      c.arc(ex - (q === 2 ? .8 : 0), ey + er + L, .6, 0, TAU);
      c.fill();
    }
    if (rnd() < .06 * s.dt) emit(s, e.x - 8 + rn(-2, 2), e.y - 17, rn(-.2, .1), .2, 'rgba(190,230,255,.9)', .9, 0, 70);
  }
  c.fillStyle = spit ? '#ff6a1a' : '#160203';
  const sob = spit ? 0 : Math.sin(t * .8) * .3;
  c.beginPath();
  c.ellipse(-8 + sob, -19, 2.4, spit ? 2 + sk * 1.6 : 1.2 + Math.abs(sob), 0, 0, TAU);
  c.fill();
  // snot: a string down the lip and a bubble that grows with every sob; it pops when it spits
  c.fillStyle = '#2a1408';
  c.fillRect(-12.6, -23.5, 1.4, 1.2);
  strand(c, s, e, 230, -12, -22.6, 7, .9, 'rgba(200,210,90,.9)', 90, '#d8e070', .8);
  if (!spit) bubble(c, s, e, 231, -15, -23.2, 4, 80, 'rgba(210,220,120,.45)', 'rgba(230,240,160,.95)', '#c8d060', 6);
  if (spit) {
    c.globalCompositeOperation = 'lighter';
    glow(-8, -19, 6 + sk * 8, '255,120,30', .7);
    c.globalCompositeOperation = 'source-over';
  }
  // cleaver arm
  const ba = e.ba, ax = -8, ay = -6, L = 28;
  c.lineCap = 'round';
  c.strokeStyle = C.fleshD;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(ax + Math.cos(ba) * 13, ay + Math.sin(ba) * 13);
  c.stroke();
  c.strokeStyle = C.flesh;
  c.lineWidth = 3;
  c.stroke();
  c.lineCap = 'butt';
  c.save();
  c.translate(ax + Math.cos(ba) * 13, ay + Math.sin(ba) * 13);
  c.rotate(ba);
  c.fillStyle = '#2a1f12';
  c.fillRect(-2, -1.5, 6, 3);
  c.fillStyle = '#4a4f56';
  c.fillRect(4, -8, L - 6, 11);
  c.fillStyle = e.st === 'tel' && ($.T >> 2) % 2 ? '#ffd0b0' : '#a8b0b8';
  c.fillRect(4, -8, L - 6, 2);
  c.fillStyle = '#1a0806';
  c.fillRect(L - 9, -8, 3, 11);
  c.fillStyle = C.blood;
  c.fillRect(10, -8, 2, 5);
  if (GROSS > 0) { // skin and hair stuck to the blade
    c.fillStyle = '#c87a6a';
    poly(c, [[13, 1], [19, 0], [18, 3.5], [14, 3]]);
    c.fillStyle = '#6a1a14';
    c.fillRect(16, 1, 4, 2);
    c.fillStyle = '#1a0a04';
    c.fillRect(14, 2.6, .5, 2.4);
    c.fillRect(15.4, 2.8, .5, 2);
  }
  c.restore();
  if (rnd() < .08 * s.dt * GROSS) { const d = rn(10, 26); emit(s, e.x + ax + Math.cos(ba) * (13 + d), e.y + ay + Math.sin(ba) * (13 + d), 0, .2, '#a01018', 1, 0, 70); }
  drawParts(c, s, e);
}

// =====================================================================
//  THE BROOD MOTHER - a heaving mucus sac of grubs; crusted nostrils blowing bubbles; births in a gush
// =====================================================================
const mucusTex = () => layer('mucus', 46, 46, (x) => {
  x.translate(23, 23);
  x.beginPath();
  x.arc(0, 0, 19.5, 0, TAU);
  x.clip();
  for (let i = 0; i < 46; i++) {
    const a = hn(i, 1) * TAU, r = Math.sqrt(hn(i, 2)) * 19, k = hn(i, 3);
    x.fillStyle = k < .3 ? 'rgba(60,70,10,.5)' : k < .55 ? 'rgba(200,215,90,.45)' : k < .7 ? 'rgba(120,90,20,.5)' : k < .85 ? 'rgba(90,110,20,.45)' : 'rgba(170,60,40,.35)';
    x.beginPath();
    x.ellipse(Math.cos(a) * r, Math.sin(a) * r, 1 + hn(i, 4) * 3, .8 + hn(i, 5) * 1.6, a, 0, TAU);
    x.fill();
  }
  x.fillStyle = 'rgba(30,30,8,.8)'; // specks (hairs? crumbs? don't ask)
  for (let i = 0; i < 30; i++) { const a = hn(i, 7) * TAU, r = Math.sqrt(hn(i, 8)) * 18; x.fillRect(Math.cos(a) * r, Math.sin(a) * r, .8, .8); }
});
function grub(c, x, y, a, s, sq) { // a curled larva, segmented, pale, dark mandibles
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(70,40,20,.75)';
  c.lineWidth = 3.4;
  c.beginPath();
  c.arc(0, 0, 2.4, .3 + sq, 4.6 - sq);
  c.stroke();
  c.strokeStyle = 'rgba(235,215,170,.88)';
  c.lineWidth = 2.6;
  c.stroke();
  c.strokeStyle = 'rgba(150,110,70,.9)';
  c.lineWidth = .4;
  c.beginPath();
  for (let q = 0; q < 5; q++) { const b = .6 + q * .8; c.moveTo(Math.cos(b) * 1.1, Math.sin(b) * 1.1); c.lineTo(Math.cos(b) * 3.7, Math.sin(b) * 3.7); }
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#3a1a08';
  c.beginPath();
  c.arc(Math.cos(4.6 - sq) * 2.4, Math.sin(4.6 - sq) * 2.4, 1.1, 0, TAU);
  c.fill();
  c.fillStyle = '#100604';
  c.fillRect(Math.cos(4.6 - sq) * 2.4 - .3, Math.sin(4.6 - sq) * 2.4 - 1.4, .7, .8);
  c.restore();
}
export function grossBrood(c, e) {
  const s = fxs(e), t = e.t, bul = Math.min(1, e.bul || 0), sn = e.st === 'sneeze' && e.wt < 26 ? e.wt / 26 : 0, sc = 1 + Math.sin(t * .08) * .04 + bul * .1 + Math.max(0, Math.sin(t * .21)) * .02 * GROSS, rim = (a, i) => 21 + Math.sin(a * 3 + t * .05) * 1.4 + hash(i + 5) * 1.6 + Math.max(0, Math.sin(a * 5 - t * .09)) * 1.6 * GROSS;
  stepParts(s);
  if (s.ev === 'idle>birth') snd('gross_slosh', .45, .3);
  if (s.ev === 'birth>idle' && GROSS > 0) { // the gush
    const gx = e.x - 17, gy = e.y + 6;
    for (let i = 0; i < 26 * GROSS; i++) emit(s, gx, gy, rn(-3, -.3), rn(-1.6, 1.2), rnd() < .5 ? '#b8c040' : rnd() < .6 ? '#d8e070' : '#c05a48', rn(1, 2.2), rnd() < .15 ? 4 : 0, rn(50, 90));
    for (let i = 0; i < 3 * GROSS; i++) emit(s, gx, gy, rn(-2, -.5), rn(-1, .5), '#efe6c4', 1, 2, 80, .1);
    snd('gross_gush', .8, .35);
  }
  if (e.st === 'sneeze' && e.wt >= 26 && !s.f.sz) { s.f.sz = 1; for (let n = 0; n < 2; n++) for (let i = 0; i < 9 * GROSS; i++) emit(s, e.x - 21, e.y - 8 + n * 6, rn(-3.4, -1), rn(-1, 1), rnd() < .6 ? '#c8d050' : '#e8f0a0', rn(.8, 1.8), 0, rn(40, 70)); }
  if (e.st !== 'sneeze') s.f.sz = 0;
  // ropes of snot hanging off it, bubbles caught in them, gobs letting go
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const x = -12 + k * 6, L = 14 + hash(k) * 12, w1 = Math.sin(t * .04 + k) * 3, w2 = Math.sin(t * .05 + k) * 4;
    c.strokeStyle = 'rgba(120,140,20,.9)';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x, 15);
    c.quadraticCurveTo(x + w1, 15 + L * .5, x + w2, 15 + L);
    c.stroke();
    c.strokeStyle = 'rgba(210,225,110,.85)';
    c.lineWidth = 1.2;
    c.stroke();
    c.fillStyle = 'rgba(235,245,170,.9)';
    c.beginPath();
    c.arc(x + w1 * .5, 15 + L * .45, .9, 0, TAU);
    c.fill();
    strand(c, s, e, 300 + k, x + w2, 15 + L, 6, 1.4, 'rgba(170,190,50,.9)', 60 + k * 11, '#d8e070', 1.2);
  }
  c.lineCap = 'butt';
  c.save();
  c.scale(sc, sc);
  c.fillStyle = '#2a3206';
  blob(c, 20, 1, rim);
  c.fill();
  c.fillStyle = 'rgba(130,150,35,.85)';
  blob(c, 20, .9, rim);
  c.fill();
  c.drawImage(mucusTex(), -23, -23);
  // the litter: grubs squirming inside, pulsing, pushing at the skin
  const n = Math.round(6 + 3 * GROSS);
  for (let k = 0; k < n; k++) {
    const a = k * (TAU / n) + t * .012 * (k % 2 ? 1 : -1), r = 6 + (k % 3) * 4.2, x = Math.cos(a) * r + 2, y = Math.sin(a) * r * .82, p = Math.sin(t * .15 + k * 1.9);
    grub(c, x, y, a * 2 + t * .02 * (k % 2 ? 1 : -1), .85 + p * .12 + bul * .15, .3 + p * .3);
  }
  // a mucus film over them so they read as inside
  c.fillStyle = 'rgba(150,170,40,.28)';
  blob(c, 20, .88, rim);
  c.fill();
  c.strokeStyle = 'rgba(90,60,20,.7)';
  c.lineWidth = .7;
  c.beginPath();
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; c.moveTo(Math.cos(a) * 19, Math.sin(a) * 18); c.quadraticCurveTo(Math.cos(a + .5) * 12, Math.sin(a + .5) * 11, Math.cos(a + .8) * 6, Math.sin(a + .8) * 6); }
  c.stroke();
  // wet, glossy
  c.fillStyle = 'rgba(255,250,210,.55)';
  c.beginPath();
  c.ellipse(-6, -12, 5, 2, -.5, 0, TAU);
  c.fill();
  c.fillRect(9, -9, 2, 1);
  c.fillRect(12, 6, 1.4, .8);
  // mucus bubbles welling up through the skin
  for (let q = 0; q < 4; q++) bubble(c, s, e, 320 + q, [8, 14, -2, 4][q], [-14, -2, 15, 9][q], 1.8, 45 + q * 14, 'rgba(210,225,110,.6)', 'rgba(240,250,180,.95)', '#c8d050', 3);
  c.restore();
  // birth canal, dilating as it heaves, glistening and stringy
  c.fillStyle = '#3a1a0a';
  c.beginPath();
  c.ellipse(-17, 6, 3 + bul * 2, 3 + bul * 5, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#a83a24';
  c.beginPath();
  c.ellipse(-17, 6, 1.4 + bul * 1.6, 1.6 + bul * 4, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(220,120,100,.9)';
  c.lineWidth = .5;
  c.beginPath();
  c.ellipse(-17, 6, 2.6 + bul * 2, 2.6 + bul * 5, 0, 1.8, 4.6);
  c.stroke();
  if (bul > .5) { // crowning: a slick grub head pushing out
    c.fillStyle = '#d8a59a';
    c.beginPath();
    c.arc(-17, 6, 2.2 * bul, 0, TAU);
    c.fill();
    c.fillStyle = '#3a1a08';
    c.fillRect(-18.4, 5, .9, .9);
    c.fillRect(-16.4, 5, .9, .9);
    c.fillStyle = 'rgba(255,240,220,.7)';
    c.fillRect(-18, 4, 1.2, .6);
  }
  strand(c, s, e, 340, -17, 8 + bul * 5, 6 + bul * 8, 1.3 + bul, 'rgba(200,130,90,.85)', bul > .2 ? 26 : 70, '#d8a070', 1);
  strand(c, s, e, 341, -15.5, 8 + bul * 4, 4 + bul * 6, 1, 'rgba(180,200,70,.85)', bul > .2 ? 34 : 90, '#d8e070', 1);
  // face: a raw, wet snout; booger-crusted nostrils blowing snot bubbles; they swell huge before it sneezes
  c.fillStyle = '#2e3608';
  c.beginPath();
  c.ellipse(-18.5, -5, 4.6 + sn, 6.6 + sn, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#8a5a3a';
  c.beginPath();
  c.ellipse(-18.2, -5.4, 3.6 + sn, 5.6 + sn, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,220,190,.6)';
  c.fillRect(-19.6, -10, 1.6, .7);
  for (let i = 0; i < 2; i++) {
    const y = [-8, -2][i];
    for (let q = 0; q < 4; q++) { c.fillStyle = q % 2 ? '#5a6a12' : '#6a5216'; c.beginPath(); c.arc(-19 + Math.cos(q * 1.7 + i) * 2.2, y + Math.sin(q * 1.7 + i) * 1.8, 1 + hash(q + i * 4) * .7, 0, TAU); c.fill(); }
    c.fillStyle = '#7a6a18';
    c.fillRect(-21, y - 1.6, 1.2, 1);
    c.fillStyle = '#2a1206';
    c.beginPath();
    c.ellipse(-19, y, 1.6 + sn * 1.6, 1.2 + sn * 1.2, 0, 0, TAU);
    c.fill();
    strand(c, s, e, 350 + i, -19.5, y + 1, 8 - i * 2, 1.1, 'rgba(190,210,70,.9)', 75 + i * 20, '#d8e870', 1.4);
    if (sn) bubble(c, s, e, 360 + i, -21 - sn * 2.4, y, 1 + sn * 3.2, 1, 'rgba(210,225,110,.5)', 'rgba(240,250,180,.95)', '#c8d050', 0, sn);
    else bubble(c, s, e, 362 + i, -20.6, y, 1.6, 50 + i * 23, 'rgba(210,225,110,.5)', 'rgba(240,250,180,.95)', '#c8d050', 3);
  }
  const la = Math.atan2($.P.y - e.y + 10, $.P.x - e.x + 8);
  for (const [ex, ey, er] of [[-8, -14, 2.4], [-2, -16, 1.8], [-11, -9, 1.5]]) {
    eye(c, ex, ey, er, { ang: la, iris: '#c8ac3a', bs: 3, blink: (t + ex * 5) % 160 < 6 ? 1 : 0, lid: '#5a5a18' });
    c.fillStyle = 'rgba(220,200,90,.95)'; // crusty eye goop in the corners
    c.fillRect(ex - er - .9, ey - .2, 1, 1);
    c.fillRect(ex + er - .1, ey + .3, .8, .8);
  }
  drawParts(c, s, e);
  if (sn) {
    c.globalCompositeOperation = 'lighter';
    glow(-19, -5, 6 + sn * 10, '236,210,90', .3 + .5 * sn);
    c.globalCompositeOperation = 'source-over';
  }
}

/** pre-build the midbosses' static layers (idle time after boot); false when done */
export function warmMidbosses() {
  const k = [['choir', choirCrust], ['wveins', wombVeins], ['burn', burnTex], ['mucus', mucusTex]].find(([q]) => !lay[q]);
  if (!k) return false;
  k[1]();
  return true;
}
