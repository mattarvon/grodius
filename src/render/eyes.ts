// @ts-nocheck
import { drawPerf } from '../perf';
import { $ } from '../state';
import { H, TAU, W, ctx, cv, dctx, lo } from '../core';
import { drawHeroEye } from './heroeye';
import { SPR, sprReady } from '../sprites';

// ---------------- realistic eyeballs (pre-rendered, drawn on the hi-res layer) ----------------
export const EYEQ = [],
  EYEC = {};
$.EYE_LOW = 0;
$.FLUSHED = 0;
export const GLQ = [];
export const hexRGB = h => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
export const h2 = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export function mkCan(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return c;
}
export function eyeSclera(bs) {
  const S = 160,
    Rr = S / 2 - 1,
    c = mkCan(S),
    x = c.getContext('2d'),
    im = x.createImageData(S, S),
    d = im.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (i + .5 - S / 2) / Rr,
      dy = (j + .5 - S / 2) / Rr,
      d2 = dx * dx + dy * dy;
    if (d2 > 1.02) continue;
    const dd = Math.sqrt(d2),
      nz = Math.sqrt(Math.max(0, 1 - d2)),
      lam = Math.max(0, -.38 * dx - .46 * dy + .8 * nz),
      edge = Math.pow(Math.min(1, dd), 2.6) * (.55 + bs * .25),
      n = (h2(i * .37, j * .41) - .5) * 14 + (h2(i * .05, j * .06) - .5) * 18,
      sh = .42 + .66 * lam,
      o = (j * S + i) * 4;
    d[o] = Math.min(255, (236 * (1 - edge) + 190 * edge + n) * sh);
    d[o + 1] = Math.min(255, (226 * (1 - edge) + 96 * edge + n * .8) * sh);
    d[o + 2] = Math.min(255, (208 * (1 - edge) + 92 * edge + n * .6) * sh);
    d[o + 3] = 255 * Math.max(0, Math.min(1, (1 - dd) * Rr));
  }
  x.putImageData(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.lineCap = 'round';
  let sd = bs * 1000 + 7;
  const rnd = () => {
    sd = sd * 16807 % 2147483647;
    return sd / 2147483647;
  };
  const vein = (px, py, a, w, len, depth) => {
    for (let k = 0; k < len; k++) {
      const nx = px + Math.cos(a) * 2.4,
        ny = py + Math.sin(a) * 2.4;
      x.strokeStyle = `rgba(${120 + rnd() * 70 | 0},${6 + rnd() * 14 | 0},${14 + rnd() * 16 | 0},${.38 + .4 * w / 2.2})`;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(nx, ny);
      x.stroke();
      px = nx;
      py = ny;
      a += (rnd() - .5) * .9;
      w *= .93;
      if (w < .25) return;
      if (depth < 3 && rnd() < .16) vein(px, py, a + (rnd() < .5 ? -1 : 1) * (.5 + rnd() * .7), w * .7, len - k, depth + 1);
    }
  };
  const nv = 10 + bs * 10 | 0;
  for (let v = 0; v < nv; v++) {
    const a = rnd() * TAU,
      r0 = Rr * .99;
    vein(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0, a + Math.PI + (rnd() - .5) * .7, 1.4 + rnd() * 1.3, 12 + rnd() * 16 | 0, 0);
  }
  for (let v = 0; v < 40 + bs * 40; v++) {
    const a = rnd() * TAU,
      r0 = Rr * (.55 + rnd() * .45);
    vein(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0, rnd() * TAU, .5 + rnd() * .4, 3 + rnd() * 6 | 0, 3);
  }
  const g = x.createRadialGradient(S / 2, S / 2, Rr * .62, S / 2, S / 2, Rr);
  g.addColorStop(0, 'rgba(90,10,14,0)');
  g.addColorStop(.8, 'rgba(110,16,20,.28)');
  g.addColorStop(1, 'rgba(40,4,6,.75)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}
export function eyeIris(col, fire, S = 160, crypts = true) {
  const Rr = S / 2 - 1,
    ri = Rr * .5,
    c = mkCan(S),
    x = c.getContext('2d'),
    im = x.createImageData(S, S),
    d = im.data,
    [cr, cg, cb] = hexRGB(col);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i + .5 - S / 2,
      dy = j + .5 - S / 2,
      dd = Math.sqrt(dx * dx + dy * dy) / ri;
    if (dd > 1.03) continue;
    const a = Math.atan2(dy, dx),
      seg = Math.floor((a + Math.PI) / TAU * 220),
      fib = h2(seg, 3) * .55 + .45 * (.5 + .5 * Math.sin(a * 61 + h2(seg >> 2, 9) * 7 + dd * 5)),
      crypt = crypts && h2(Math.floor((a + 4) * 9), Math.floor(dd * 7)) < .12 && dd > .45 && dd < .8 ? .55 : 1;
    let k = (.62 + fib * .62) * crypt;
    if (dd > .4 && dd < .56) k *= 1.35;
    if (dd > .78) k *= 1 - (dd - .78) * 2.9;
    if (dd < .42) k *= .75 + dd * .6;
    let r = cr * k,
      g = cg * k,
      b = cb * k;
    if (fire && dd < .6) {
      const f = (.6 - dd) / .6;
      r += 255 * f * .7;
      g += 200 * f * .6;
      b += 60 * f * .3;
    }
    const o = (j * S + i) * 4;
    d[o] = Math.min(255, r);
    d[o + 1] = Math.min(255, g);
    d[o + 2] = Math.min(255, b);
    d[o + 3] = 255 * Math.max(0, Math.min(1, (1.03 - dd) * ri * .5));
  }
  x.putImageData(im, 0, 0);
  return c;
}
export const EYE_SHADE = (() => {
  const S = 160,
    c = mkCan(S),
    x = c.getContext('2d'),
    Rr = S / 2;
  let g = x.createRadialGradient(S * .4, S * .36, Rr * .2, S / 2, S / 2, Rr);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(.75, 'rgba(20,0,0,.18)');
  g.addColorStop(1, 'rgba(10,0,0,.62)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  g = x.createRadialGradient(S * .33, S * .3, 0, S * .33, S * .3, Rr * .3);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(.25, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,.95)';
  x.beginPath();
  x.ellipse(S * .32, S * .29, Rr * .085, Rr * .06, -.6, 0, TAU);
  x.fill();
  g = x.createRadialGradient(S * .68, S * .72, 0, S * .68, S * .72, Rr * .22);
  g.addColorStop(0, 'rgba(255,230,220,.22)');
  g.addColorStop(1, 'rgba(255,230,220,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
})();
// ---- real irises (sunburn's Eyeballs, CC-BY 3.0: src/sprites/iris_grey.png + pupil@4.png, cut by tools/prep_fx.py) ----
// One grey iris photo, tinted per colour once and cached. Each eye gets a stable variant v (from its colour, bloodshot
// level and size: no RNG, so the same eye looks the same every frame): a small shift of the colour, and now and then
// a cat slit, a frog bar or a fish crescent instead of a round pupil.
const IRIS_R = 121, PUPIL_R = 41.5; // source px: iris disc radius and round-pupil radius in the 272 px frames
/** pupil frame: 0 round, 1 cat (beast), 2 frog (amphibian), 3 fish */
export const pupilOf = (v) => { const u = h2(v * .0137, 5.3); return u < .7 ? 0 : u < .82 ? 1 : u < .92 ? 2 : 3; };
const HV = new Map();
/** stable 0..65535 hash of an iris colour string */
function colHash(col) {
  let h = HV.get(col);
  if (h == null) {
    h = 7;
    for (let i = 0; i < col.length; i++) h = (h * 31 + col.charCodeAt(i)) & 65535;
    HV.set(col, h);
  }
  return h;
}
// Textures are built OFF the frame: a small, known set (iris colour x 3 colour shifts, + fire) is queued at boot and
// built in idle slices of <= ~8 ms (warmEyes, run by main.ts warmUp). An eye whose texture isn't ready yet draws a
// plain tinted iris for those frames and queues its build; nothing per-pixel ever runs inside a game frame.
const IS = 128; // iris texture: ball-sized canvas, iris radius = a quarter of it (like eyeIris), scaled on draw
/** every iris colour the game passes to eye() (render/*, gore gib eyes, ship tiers, graft caps) */
export const IRIS_COLS = ['#b01018', '#8a0f12', '#8a9a22', '#9fd8ff', '#9a5aff', '#9fd23a', '#c8a020', '#c8ac3a', '#e8b818',
  '#ff3a10', '#ffb347', '#9bb030', '#3b6fd0', '#6a3b1c', '#c0141c', '#e05a10', '#b23cff', '#9fb7c4'];
/** colour shift per variant: none, warmer, colder */
const JIT = [[1, 1, 1], [1.16, .92, .86], [.86, 1.04, 1.16]];
const BASES = {};
/** the grey photo at size S, as luminance + alpha arrays (one drawImage + one getImageData, cached) */
function irisBase(S) {
  if (BASES[S]) return BASES[S];
  const I = SPR.iris_grey, c = mkCan(S), x = c.getContext('2d', { willReadFrequently: true }), ri = (S / 2 - 1) * .5, k = ri / IRIS_R * 1.03;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(I.img, 0, 0, I.fw, I.fh, S / 2 - I.fw * k / 2, S / 2 - I.fh * k / 2, I.fw * k, I.fh * k);
  const d = x.getImageData(0, 0, S, S).data, n = S * S, L = new Uint8Array(n), A = new Uint8Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) { L[i] = d[o]; A[i] = d[o + 3]; }
  return (BASES[S] = { L, A });
}
/** tint lookup: luminance byte -> channel multiplier and highlight, so the pixel loop is three table reads */
const TM = new Float32Array(256), TH = new Float32Array(256);
for (let i = 0; i < 256; i++) { const L = i / 255; TM[i] = Math.pow(L, 1.15) * 1.75; TH[i] = Math.max(0, L - .6) * 260; }
function fireCore(x, S) { // a hot core burning out of the pupil, as the painted version had
  const ri = (S / 2 - 1) * .5, gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, ri * .62);
  gr.addColorStop(0, 'rgba(255,210,90,.9)');
  gr.addColorStop(1, 'rgba(255,90,20,0)');
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = gr;
  x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'source-over';
}
function tintIris(col, j, fire) {
  const B = irisBase(IS), c = mkCan(IS), x = c.getContext('2d'), im = x.createImageData(IS, IS), d = im.data;
  const [r0, g0, b0] = hexRGB(col), J = JIT[j], R = r0 * J[0], G = g0 * J[1], Bl = b0 * J[2], { L, A } = B;
  for (let i = 0, o = 0; i < L.length; i++, o += 4) {
    const a = A[i];
    if (!a) continue;
    const l = L[i], m = TM[l], h = TH[l];
    d[o] = R * m + h; d[o + 1] = G * m + h * .9; d[o + 2] = Bl * m + h * .8; d[o + 3] = a; // Uint8Clamped clamps
  }
  x.putImageData(im, 0, 0);
  if (fire) fireCore(x, IS);
  return c;
}
// ---- the idle build queue ----
const TEX = {}; // colour -> [6]: index fire * 3 + j; undefined = not asked, 0 = queued, canvas = ready
const SCL = {}; // bloodshot bucket -> sclera canvas (0 = queued)
const JOBS = [];
let pumpOn = 0, seeded = 0;
const idle = (f) => (window.requestIdleCallback || ((g) => setTimeout(g, 50)))(f, { timeout: 1000 });
/** run queued builds for up to ~ms; returns true while work remains */
/** build log for tools: [ms, $.state] per job (window.__irisLog) */
const LOG = (globalThis as any).__irisLog = [];
function slice(ms) {
  if (!sprReady('iris_grey')) return true; // photo not loaded yet: try again next idle slot
  const t0 = performance.now();
  while (JOBS.length) {
    const jb = JOBS[0];
    const j0 = performance.now();
    if (jb.run()) JOBS.shift();
    if (LOG.length < 400) LOG.push([+(performance.now() - j0).toFixed(2), $.state]);
    if (performance.now() - t0 > ms) break;
  }
  return JOBS.length > 0;
}
function pump() {
  if (pumpOn) return;
  pumpOn = 1;
  idle(function go() { if (slice(6)) idle(go); else pumpOn = 0; });
}
function queueIris(col, fire, j) {
  const a = TEX[col] || (TEX[col] = []), i = fire * 3 + j;
  if (a[i] !== undefined) return;
  a[i] = 0;
  JOBS.push({ run: () => ((a[i] = tintIris(col, j, fire)), true) });
}
/** bloodshot level bucket: half steps 1..3.5 (a continuous bs, like a hurt Maw's, can't spawn new scleras) */
const sclB = (bs) => Math.max(1, Math.min(3.5, Math.round(bs * 2) / 2));
function queueScl(b) {
  if (SCL[b] !== undefined) return;
  SCL[b] = 0;
  JOBS.push({ run: () => ((SCL[b] = eyeSclera(b)), true) });
}
/** a luminance-ramped photo iris at size S built a few rows per slice (the 512 px title eye); calls done(canvas) */
export function queueRampIris(S, stops, done) {
  let st = null;
  JOBS.unshift({ run: () => {
    if (!st) {
      const c = mkCan(S), x = c.getContext('2d');
      st = { c, x, im: x.createImageData(S, S), B: irisBase(S), y: 0 };
      return false;
    }
    const { im, B, x, c } = st, d = im.data, y1 = Math.min(S, st.y + 48);
    for (let i = st.y * S, o = i * 4; i < y1 * S; i++, o += 4) {
      const a = B.A[i];
      if (!a) continue;
      const Lv = B.L[i] / 255;
      let k = 0;
      while (k < stops.length - 2 && stops[k + 1][0] < Lv) k++;
      const P = stops[k], Q = stops[k + 1], t = Math.max(0, Math.min(1, (Lv - P[0]) / (Q[0] - P[0])));
      d[o] = P[1] + (Q[1] - P[1]) * t; d[o + 1] = P[2] + (Q[2] - P[2]) * t; d[o + 2] = P[3] + (Q[3] - P[3]) * t; d[o + 3] = a;
    }
    st.y = y1;
    if (y1 < S) return false;
    x.putImageData(im, 0, 0);
    done(c);
    return true;
  } });
  pump();
}
/** main.ts warmUp: queue every known iris + sclera bucket once, then build in idle slices (true = more to do) */
let tries = 0;
export function warmEyes() {
  if (!seeded && !sprReady('iris_grey')) return ++tries < 60; // photo never loaded: don't hold up the bosses' warm-up
  if (!seeded) {
    seeded = 1;
    for (let b = 1; b <= 3.5; b += .5) queueScl(b);
    for (const col of IRIS_COLS) { for (let j = 0; j < 3; j++) queueIris(col, 0, j); queueIris(col, 1, 0); }
    pupils();
  }
  return slice(8);
}
const SET = { s: null, i: null };
/** sclera + iris for an eye; either can be null while its build waits for an idle slot (callers draw a plain stand-in) */
export function eyeSet(iris, fire, bs, v = -1) {
  const k0 = iris + (fire ? 'f' : '') + bs, s0 = EYEC[k0];
  if (s0) return s0; // a custom set painted into the cache (the Bloated Bitch's frozen eyes)
  const b = sclB(bs);
  let s = SCL[b];
  if (!s) { queueScl(b); for (const k in SCL) if (SCL[k]) { s = SCL[k]; break; } pump(); }
  SET.s = s || null;
  if (!sprReady('iris_grey')) { SET.i = null; return SET; }
  const f = fire ? 1 : 0, j = f ? 0 : (v < 0 ? 0 : v % 3), a = TEX[iris], t = a && a[f * 3 + j];
  if (t) SET.i = t;
  else { queueIris(iris, f, j); pump(); SET.i = null; }
  return SET;
}
/** pupils pre-shrunk to 64 px frames: a 272 px frame squeezed to a few device px per eye per frame is a slow draw */
let PUP = null;
function pupils() {
  if (PUP) return PUP;
  const P = SPR.pupil;
  if (!P || !P.fw) return null;
  const c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = 64 * P.n; c.height = 64;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  for (let i = 0; i < P.n; i++) x.drawImage(P.img, i * P.fw, 0, P.fw, P.fh, i * 64, 0, 64, 64);
  return (PUP = { img: c, fw: 64, k: 64 / P.fw });
}
// queue an eyeball at local (lx,ly) radius r on the current ctx transform
export function eye(c, lx, ly, r, o = {}) {
  const m = c.getTransform(),
    sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)),
    X = m.a * lx + m.c * ly + m.e,
    Y = m.b * lx + m.d * ly + m.f,
    rad = r * sc;
  if (c !== ctx || $.EYE_LOW || rad < .9) {
    lowEye(c, lx, ly, r, o);
    return;
  }
  EYEQ.push({
    x: X,
    y: Y,
    r: rad,
    ang: o.ang || 0,
    m: o.m ?? .85,
    iris: o.iris || '#b01018',
    fire: o.fire ? 1 : 0,
    bs: o.bs ?? 1,
    bl: o.blink || 0,
    dil: o.dil || 1,
    slit: o.slit || 0,
    al: c.globalAlpha * (o.al ?? 1),
    lid: o.lid || '#6e1f1c',
    hero: o.hero ? 1 : 0,
    jig: o.jig || 0,
    // stable look variant: colour + bloodshot level + size (no RNG; the same eye keeps its iris and pupil)
    v: (colHash(o.iris || '#b01018') * 7 + Math.round((o.bs ?? 1) * 8) * 131 + Math.round(r * 4) * 17) & 4095
  });
}
export function lowEye(c, x, y, r, o) {
  if (o.blink > .6) {
    c.fillStyle = o.lid || '#6e1f1c';
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    return;
  }
  const a = o.ang || 0;
  c.fillStyle = '#ece2cc';
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = o.iris || '#b01018';
  c.beginPath();
  c.arc(x + Math.cos(a) * r * .38, y + Math.sin(a) * r * .38, r * .52, 0, TAU);
  c.fill();
  c.fillStyle = '#000';
  c.fillRect(x + Math.cos(a) * r * .45 - .5, y + Math.sin(a) * r * .45 - .5, 1, 1);
}
export function drawEyeQ() {
  if (!EYEQ.length) return;
  const D = dctx;
  D.save();
  D.setTransform(1, 0, 0, 1, 0, 0);
  D.imageSmoothingEnabled = true;
  D.imageSmoothingQuality = 'high';
  for (const e of EYEQ) {
    const X = e.x * $.DK,
      Y = e.y * $.DK,
      r = e.r * $.DK;
    if (X < -r || X > W * $.DK + r || Y < -r || Y > H * $.DK + r) continue;
    D.globalAlpha = e.al;
    if (e.draw) { e.draw(D, X, Y, r, e); continue; } // custom hi-res eyeball (the Gravity Drive's infected eye: render/gross/drive.ts)
    if (e.hero) { drawHeroEye(D, e, X, Y, r); continue; } // title hero: its own wet, wobbling renderer (heroeye.ts)
    const set = eyeSet(e.iris, e.fire, e.bs, e.v);
    if (e.fire) {
      D.globalCompositeOperation = 'lighter';
      const g = D.createRadialGradient(X, Y, r * .6, X, Y, r * 2.6);
      g.addColorStop(0, 'rgba(255,120,30,.55)');
      g.addColorStop(1, 'rgba(255,60,10,0)');
      D.fillStyle = g;
      D.fillRect(X - r * 2.6, Y - r * 2.6, r * 5.2, r * 5.2);
      D.globalCompositeOperation = 'source-over';
    }
    D.save();
    D.translate(X, Y);
    D.beginPath();
    D.arc(0, 0, r, 0, TAU);
    D.clip();
    if (set.s) D.drawImage(set.s, -r, -r, r * 2, r * 2);
    else { D.fillStyle = '#e6d8c4'; D.fillRect(-r, -r, r * 2, r * 2); } // sclera still waiting for an idle slot
    const lx = Math.cos(e.ang) * e.m,
      ly = Math.sin(e.ang) * e.m;
    D.save();
    D.translate(lx * r * .42, ly * r * .42);
    D.rotate(e.ang);
    D.scale(1 - .28 * e.m, 1);
    if (set.i) D.drawImage(set.i, -r, -r, r * 2, r * 2);
    else { // plain tinted iris while the photo one waits for an idle slot
      D.fillStyle = e.iris;
      D.beginPath();
      D.arc(0, 0, r * .5, 0, TAU);
      D.fill();
      D.strokeStyle = 'rgba(10,0,0,.55)';
      D.lineWidth = r * .07;
      D.stroke();
    }
    const pr = r * .5 * .38 * e.dil, PU = PUP; // built by warmEyes
    if (PU) { // photo pupil, kept upright (slits stay vertical however the eye rolls)
      const f = e.slit ? 1 : pupilOf(e.v), k = pr / (PUPIL_R * PU.k) * (f === 1 ? 1.15 : 1), w = PU.fw * k;
      D.rotate(-e.ang);
      D.drawImage(PU.img, f * PU.fw, 0, PU.fw, PU.fw, -w / 2, -w / 2, w, w);
    } else {
      D.fillStyle = '#030000';
      D.beginPath();
      if (e.slit) D.ellipse(0, 0, pr * .32, pr * 1.9, -e.ang, 0, TAU);else D.arc(0, 0, pr, 0, TAU);
      D.fill();
    }
    D.restore();
    D.drawImage(EYE_SHADE, -r, -r, r * 2, r * 2);
    if (e.bl > .02) {
      const b = Math.min(1, e.bl);
      D.fillStyle = e.lid;
      D.beginPath();
      D.ellipse(0, -r, r * 1.15, r * b * 1.02, 0, 0, Math.PI);
      D.fill();
      D.beginPath();
      D.ellipse(0, r, r * 1.15, r * b * 1.02, 0, Math.PI, TAU);
      D.fill();
      D.strokeStyle = 'rgba(20,0,0,.8)';
      D.lineWidth = Math.max(1, r * .08);
      D.beginPath();
      D.ellipse(0, -r, r * 1.15, r * b * 1.02, 0, 0, Math.PI);
      D.stroke();
      D.beginPath();
      D.ellipse(0, r, r * 1.15, r * b * 1.02, 0, Math.PI, TAU);
      D.stroke();
    }
    D.restore();
    D.strokeStyle = e.hero ? 'rgba(40,4,12,.35)' : 'rgba(30,2,4,.7)';
    D.lineWidth = Math.max(1, r * (e.hero ? .02 : .07));
    D.beginPath();
    D.arc(X, Y, r, 0, TAU);
    D.stroke();
  }
  D.restore();
  EYEQ.length = 0;
}
export function flushLo() {
  dctx.save();
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalAlpha = 1;
  dctx.globalCompositeOperation = 'source-over';
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(lo, 0, 0, W * $.DK, H * $.DK);
  dctx.restore();
  drawEyeQ();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.restore();
  $.FLUSHED = 1;
}
export function present() {
  if (!$.FLUSHED) flushLo();else {
    dctx.save();
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(lo, 0, 0, W * $.DK, H * $.DK);
    dctx.restore();
    drawEyeQ();
  }
  for (const q of GLQ) {
    const [sx, sy, sw, sh, dx, dy, dw, dh] = q;
    dctx.drawImage(cv, sx * $.DK, sy * $.DK, sw * $.DK, sh * $.DK, dx * $.DK, dy * $.DK, dw * $.DK, dh * $.DK);
  }
  GLQ.length = 0;
  $.FLUSHED = 0;
  drawPerf(dctx, $.DK);
}

// --- player ship & helpers ---
