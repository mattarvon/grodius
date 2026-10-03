// @ts-nocheck
import { $ } from '../state';
import { H, TAU, W, ctx, cv, dctx, lo } from '../core';

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
/** title-screen hero eyeball: big, pale, lumpy, densely bloodshot (512px sclera, 320px iris) */
let HERO = null;
function heroSclera() {
  const S = 512, Rr = S / 2 - 1, c = mkCan(S), x = c.getContext('2d'), im = x.createImageData(S, S), d = im.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (i + .5 - S / 2) / Rr, dy = (j + .5 - S / 2) / Rr, d2 = dx * dx + dy * dy;
    if (d2 > 1.01) continue;
    const dd = Math.sqrt(d2), nz = Math.sqrt(Math.max(0, 1 - d2));
    // lumpy surface: low-frequency bumps tilt the normal a little
    const bump = (h2(i * .021, j * .023) - .5) * .5 + (h2(i * .06, j * .055) - .5) * .25;
    const lam = Math.max(0, -.42 * dx - .5 * dy + .76 * nz + bump * .35);
    const sh = .34 + .78 * lam, grain = (h2(i * .45, j * .47) - .5) * 10;
    const edge = Math.pow(dd, 3.2);
    const o = (j * S + i) * 4;
    // pale grey-lavender flesh, warming to sore pink at the rim
    d[o] = Math.min(255, (214 + grain + edge * 10) * sh);
    d[o + 1] = Math.min(255, (204 + grain - edge * 60) * sh);
    d[o + 2] = Math.min(255, (222 + grain - edge * 50) * sh);
    d[o + 3] = 255 * Math.max(0, Math.min(1, (1 - dd) * Rr));
  }
  x.putImageData(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  let sd = 4242;
  const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const vein = (px, py, a, w, len, depth) => {
    for (let k = 0; k < len; k++) {
      const st = 3 + rnd() * 3, nx = px + Math.cos(a) * st, ny = py + Math.sin(a) * st;
      x.strokeStyle = `rgba(${90 + rnd() * 30 | 0},0,${10 + rnd() * 10 | 0},.55)`; // dark core shadow
      x.lineWidth = w + .9;
      x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      x.strokeStyle = `rgba(${200 + rnd() * 55 | 0},${10 + rnd() * 25 | 0},${30 + rnd() * 25 | 0},.9)`;
      x.lineWidth = w;
      x.stroke();
      px = nx; py = ny;
      a += (rnd() - .5) * 1.1; // jagged, cracked-looking turns
      w *= .955;
      if (w < .7) return;
      if (depth < 3 && rnd() < .16) vein(px, py, a + (rnd() < .5 ? -1 : 1) * (.7 + rnd() * .8), w * .75, (len - k) * .75 | 0, depth + 1);
    }
  };
  // trunks crawl in from the rim, then a crackle network everywhere
  for (let v = 0; v < 20; v++) {
    const a = rnd() * TAU;
    vein(S / 2 + Math.cos(a) * Rr, S / 2 + Math.sin(a) * Rr, a + Math.PI + (rnd() - .5) * .8, 3.6 + rnd() * 2.4, 26 + rnd() * 26 | 0, 0);
  }
  for (let v = 0; v < 120; v++) { // stratified so the cracks cover the whole ball, not clumps
    const a = (v * 2.39996) % TAU, r0 = Rr * Math.sqrt((v + rnd()) / 120);
    vein(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0, rnd() * TAU, 1.6 + rnd() * 1.2, 5 + rnd() * 9 | 0, 2);
  }
  const g = x.createRadialGradient(S / 2, S / 2, Rr * .7, S / 2, S / 2, Rr);
  g.addColorStop(0, 'rgba(120,20,40,0)');
  g.addColorStop(.85, 'rgba(120,24,44,.22)');
  g.addColorStop(1, 'rgba(30,4,10,.7)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}
export function heroSet() {
  return HERO || (HERO = { s: heroSclera(), i: eyeIris('#2fd43a', 0, 320, false) });
}
export function eyeSet(iris, fire, bs) {
  const k = iris + (fire ? 'f' : '') + bs;
  return EYEC[k] || (EYEC[k] = {
    s: eyeSclera(bs),
    i: eyeIris(iris, fire)
  });
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
    hero: o.hero ? 1 : 0
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
      r = e.r * $.DK,
      set = e.hero ? heroSet() : eyeSet(e.iris, e.fire, e.bs);
    if (X < -r || X > W * $.DK + r || Y < -r || Y > H * $.DK + r) continue;
    D.globalAlpha = e.al;
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
    D.drawImage(set.s, -r, -r, r * 2, r * 2);
    const lx = Math.cos(e.ang) * e.m,
      ly = Math.sin(e.ang) * e.m;
    D.save();
    D.translate(lx * r * .42, ly * r * .42);
    D.rotate(e.ang);
    D.scale(1 - .28 * e.m, 1);
    D.drawImage(set.i, -r, -r, r * 2, r * 2);
    const pr = r * .5 * .38 * e.dil;
    D.fillStyle = '#030000';
    D.beginPath();
    if (e.slit) D.ellipse(0, 0, pr * .32, pr * 1.9, -e.ang, 0, TAU);else D.arc(0, 0, pr, 0, TAU);
    D.fill();
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
}

// --- player ship & helpers ---
