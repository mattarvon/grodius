// @ts-nocheck
// =====================================================================
//  GROSS MIDBOSS KIT - what the biome midbosses' art shares: the crossover tint, the render-side RNG and particles,
//  strands, bubbles, wigglers and the cached layers. Each body is its own file in gross/mid/ (LS2-0).
//  Render-only: own RNG, own particle list, no gameplay state touched. Telegraph shapes are kept from the
//  originals (frost glare, crown bubbling + bloat, sweep cone + glowing mouth, heave + flaring nostrils).
// =====================================================================
import { $ } from '../../state';
import { C, H, TAU, W, ctx, hash } from '../../core';
import { floorAt } from '../../world';
import { SET } from '../../save';
import { sample } from '../../audio';
import { drawHookTip, drawSkull, glowSpr, poly } from '../util';
import { eye } from '../eyes';

// ---------------- crossover host tint (enemies/midhost.ts, build plan LS1 P0) ----------------
// A crossover's body is drawn into a screen-sized layer, washed with the host biome's colour (source-atop: only where
// the body is), then composited at the caller's transform. In a home fight none of this runs and c is the main ctx,
// so glowC/eyeC below are exactly glow()/eye(). The layer is 480x270, the same as the low-res frame, so the extra
// cost is one clear, one fill and one blit per crossover per frame.
let TL = null, tl = null, tE = null;
const TFILL = {};
/** glow() onto c instead of the global ctx: the same pixels when c is ctx; lets a crossover glow inside its layer */
export function glowC(c, x, y, r, col, a) {
  if (r <= 0 || a <= 0) return;
  const p = c.globalAlpha;
  c.globalAlpha = p * Math.min(1, a);
  c.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2);
  c.globalAlpha = p;
}
/** eye() that still queues on the main ctx (hi-res, untinted) when the body is being drawn into the tint layer */
export function eyeC(c, lx, ly, r, o) {
  if (c !== tl) return eye(c, lx, ly, r, o);
  const m = c.getTransform(), X = m.a * lx + m.c * ly + m.e, Y = m.b * lx + m.d * ly + m.f, sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  ctx.save();
  ctx.translate(X - tE.x, Y - tE.y); // the caller has ctx translated to the midboss; the layer is in screen px
  ctx.scale(sc, sc);
  eye(ctx, 0, 0, r, o);
  ctx.restore();
}
/** draw a crossover midboss through its host tint. c is translated to e (render/enemies.ts drawEnemy) */
export function drawMidCross(c, e, draw, rgb, a) {
  if (!TL) { TL = document.createElement('canvas'); TL.width = W; TL.height = H; tl = TL.getContext('2d'); tl.imageSmoothingEnabled = false; }
  tl.setTransform(1, 0, 0, 1, 0, 0);
  tl.globalAlpha = 1;
  tl.globalCompositeOperation = 'source-over';
  tl.clearRect(0, 0, W, H);
  tl.translate(e.x, e.y);
  tE = e;
  draw(tl, e);
  tE = null;
  tl.setTransform(1, 0, 0, 1, 0, 0);
  tl.globalAlpha = 1;
  tl.globalCompositeOperation = 'source-atop';
  tl.fillStyle = TFILL[rgb + a] || (TFILL[rgb + a] = `rgba(${rgb},${a})`);
  tl.fillRect(0, 0, W, H);
  tl.globalCompositeOperation = 'source-over';
  c.drawImage(TL, -e.x, -e.y);
}

/** dial-back knob: 0 = the old clean art (plus the base redesign), 1 = full gross. Scales drips, strands, bubbles, particles, maggots, sound. */
export const GROSS = 1;

// ---------------- render-side RNG + particles (never touches core R()) ----------------
let seed = 0x6b1d3a5;
export const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const rn = (a, b) => a + rnd() * (b - a);
const FX = new WeakMap();
const PMAX = () => Math.round(90 * GROSS);
let sndT = 0;
/** per-midboss render state: particles (screen space), strand/bubble cycle memory, state-change edge */
export function fxs(e) {
  let s = FX.get(e);
  if (!s) FX.set(e, s = { p: [], t: e.t, st: e.st, sc: {}, f: {} });
  s.dt = Math.max(0, Math.min(4, e.t - s.t));
  s.t = e.t;
  s.ev = s.st !== e.st ? s.st + '>' + e.st : '';
  s.st = e.st;
  return s;
}
// kinds: 0 drop (streaks, puddles on the floor), 1 fat spit (hot, glows), 2 maggot, 3 puddle, 4 chunk
export function emit(s, x, y, vx, vy, col, r = 1, k = 0, l = 70, g = .12) {
  if (GROSS <= 0 || s.p.length >= PMAX()) return;
  s.p.push({ x, y, vx, vy, col, r, k, l, ml: l, g, ph: rnd() * TAU });
}
export function spray(s, x, y, n, col, sp = 1.2, r = 1, up = .6) {
  n = Math.round(n * GROSS);
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, v = rn(.3, 1) * sp; emit(s, x, y, Math.cos(a) * v, Math.sin(a) * v - up, col, r * rn(.6, 1.2), 0, rn(40, 80)); }
}
export function stepParts(s) {
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
export function drawParts(c, s, e) {
  const ox = -e.x, oy = -e.y;
  let hot = 0;
  for (const p of s.p) {
    const x = p.x + ox, y = p.y + oy, a = Math.min(1, p.l / p.ml * 2.5);
    c.globalAlpha = a;
    if (p.k === 0 || p.k === 4) {
      // a streak along its velocity, by the ellipse's own rotation: no save/translate/rotate per particle (perf, LS2-bossart)
      const v = Math.hypot(p.vx, p.vy), st = Math.min(4, v * 1.4), ux = v > 1e-4 ? p.vx / v : 0, uy = v > 1e-4 ? p.vy / v : 1;
      c.fillStyle = p.col;
      c.beginPath();
      c.ellipse(x - ux * st * .5, y - uy * st * .5, p.r * .55, p.r * .55 + st * .5, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, TAU);
      c.fill();
    } else if (p.k === 1) {
      c.fillStyle = p.col;
      c.fillRect(x - .5, y - .5, 1.2, 1.2);
      hot++;
    } else if (p.k === 2) {
      wiggler(c, x, y, Math.atan2(p.vy, p.vx) + Math.sin(p.l * .6 + p.ph) * .9, 1);
    } else {
      c.fillStyle = p.col;
      c.beginPath();
      c.ellipse(x, y, p.r, p.r * .35, 0, 0, TAU);
      c.fill();
    }
  }
  if (hot) { // every fat spit's glow in one 'lighter' block, not a mode switch per particle
    c.globalCompositeOperation = 'lighter';
    const fl = SET.flashes ? 1 : .5;
    for (const p of s.p) if (p.k === 1) glowC(c, p.x + ox, p.y + oy, 3, '255,190,60', .5 * Math.min(1, p.l / p.ml * 2.5) * fl);
    c.globalCompositeOperation = 'source-over';
  }
  c.globalAlpha = 1;
}
/** a gob hanging from (x,y): stretches over P frames, lets go as a falling drop, starts again */
export function strand(c, s, e, id, x, y, len, w, col, P, tip = col, sway = 1.5) {
  if (GROSS <= 0) return;
  const tt = e.t + hash(id) * P, f = (tt % P) / P, cyc = Math.floor(tt / P), key = id; // a number key: no string built per strand per frame
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
export function bubble(c, s, e, id, x, y, rmax, P, fill, rim, pc = rim, n = 4, kf = -1) {
  if (GROSS <= 0) return 0;
  const tt = e.t + hash(id + 50) * P, f = kf >= 0 ? kf : (tt % P) / P, cyc = kf >= 0 ? 0 : Math.floor(tt / P), key = -1 - id; // bubbles below zero, strands at or above: no string per frame
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
export function wiggler(c, x, y, a, s) { // a maggot: fat, pale, segmented, black mouth hooks
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
export const lay = {};
export function layer(k, w, h, f) {
  if (lay[k]) return lay[k];
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  f(cv.getContext('2d'), w, h);
  return lay[k] = cv;
}
// layer-local seeded noise (stable art)
export const hn = (i, j = 0) => hash(i * 7.13 + j * 31.7 + 11);
export function popSnd(s, v) { // throttled wet pops, render-driven (audio RNG only)
  if (GROSS <= 0 || $.T - sndT < 9) return;
  sndT = $.T;
  sample('gross_pop', { vol: v * GROSS, wet: .2, spread: .25 });
}
export function snd(bank, vol, wet = .3) { if (GROSS > 0) sample(bank, { vol: vol * Math.min(1, GROSS), wet, spread: .18 }); }
export const blob = (c, n, r0, f) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = f(a, i % n) * r0; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
