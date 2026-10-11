// @ts-nocheck
// Title-screen hero eyeball (v2): big, wet, wobbling, crackled with veins.
// Reference look: pale lavender/blue sclera under a dense jagged red vein crackle with a pink haze, lime iris with a dark
// green limbal ring, cyan glint upper right. Textures are painted once (768px sclera, 512px iris); the sloppy parts
// (wobbling silhouette, squash, wet sheen, drool strands) are drawn live on the hi-res layer every frame.
import { $ } from '../state';
import { TAU } from '../core';

const can = (S) => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
/** smooth value noise (bilinear over the hash lattice, smoothstepped) */
function sn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

function sclera() {
  const S = 768, Rr = S / 2 - 1, c = can(S), x = c.getContext('2d'), im = x.createImageData(S, S), d = im.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (i + .5 - S / 2) / Rr, dy = (j + .5 - S / 2) / Rr, d2 = dx * dx + dy * dy;
    if (d2 > 1.01) continue;
    const dd = Math.sqrt(d2), nz = Math.sqrt(Math.max(0, 1 - d2));
    const lam = Math.max(0, -.34 * dx - .4 * dy + .85 * nz), sh = .6 + .5 * lam;
    // cool blue-violet bruising in soft patches, sore pink creeping in from the rim
    const cool = cl((sn(i * .011, j * .011) - .4) * 2.4, 0, 1) * .7 + Math.pow(dd, 2) * .15;
    const pink = Math.pow(dd, 3) * .45 + cl((sn(i * .02 + 9, j * .02) - .62) * 2, 0, 1) * .18;
    const grain = (hash(i * .5, j * .5) - .5) * 9 + (sn(i * .08, j * .08) - .5) * 14;
    let r = mix(238, 172, cool), g = mix(228, 184, cool), b = mix(240, 244, cool);
    r = mix(r, 218, pink); g = mix(g, 136, pink); b = mix(b, 172, pink);
    const o = (j * S + i) * 4;
    d[o] = cl((r + grain) * sh, 0, 255);
    d[o + 1] = cl((g + grain) * sh, 0, 255);
    d[o + 2] = cl((b + grain) * sh, 0, 255);
    d[o + 3] = 255 * cl((1 - dd) * Rr, 0, 1);
  }
  x.putImageData(im, 0, 0);
  // vein geometry first (jagged, lightning-like, branching), then drawn twice: a blurred pink haze, then crisp
  let sd = 9137;
  const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const segs = [];
  const vein = (px, py, a, w, len, depth) => {
    for (let k = 0; k < len; k++) {
      a += (rnd() - .5) * 1.25;
      const st = 2.6 + rnd() * 3.4, nx = px + Math.cos(a) * st, ny = py + Math.sin(a) * st;
      segs.push([px, py, nx, ny, w]);
      px = nx; py = ny;
      w *= .963;
      if (w < .45) return;
      if (depth < 4 && rnd() < (depth ? .14 : .1)) vein(px, py, a + (rnd() < .5 ? -1 : 1) * (.6 + rnd() * .9), w * .7, (len - k) * .7 | 0, depth + 1);
    }
  };
  for (let v = 0; v < 34; v++) {
    const a = rnd() * TAU;
    vein(S / 2 + Math.cos(a) * Rr, S / 2 + Math.sin(a) * Rr, a + Math.PI + (rnd() - .5) * .9, 4.2 + rnd() * 2.6, 50 + rnd() * 45 | 0, 0);
  }
  for (let v = 0; v < 170; v++) { // stratified crackle so the whole ball is covered, not clumps
    const a = (v * 2.39996) % TAU, r0 = Rr * Math.sqrt((v + rnd()) / 170);
    vein(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0, rnd() * TAU, 1.1 + rnd() * .8, 8 + rnd() * 12 | 0, 3);
  }
  x.globalCompositeOperation = 'source-atop';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const stroke = (X, col, wm, wa) => { X.lineCap = 'round'; X.lineJoin = 'round'; for (const [a, b, c2, d2, w] of segs) { X.strokeStyle = col(w); X.lineWidth = w * wm + wa; X.beginPath(); X.moveTo(a, b); X.lineTo(c2, d2); X.stroke(); } };
  // haze: strokes on their own canvas, blurred ONCE when composited (a filter on the main ctx would blur per stroke)
  {
    const hc = can(S), hx = hc.getContext('2d');
    stroke(hx, () => 'rgba(225,70,120,.07)', 3, 3);
    x.filter = 'blur(5px)';
    x.drawImage(hc, 0, 0);
    x.filter = 'none';
  }
  stroke(x, () => 'rgba(105,0,28,.5)', 1, 1);
  stroke(x, (w) => `rgba(${190 + rnd() * 50 | 0},${18 + rnd() * 26 | 0},${50 + rnd() * 34 | 0},${.75 + .25 * Math.min(1, w / 2)})`, 1, 0);
  // rim: bruised purple-red falloff
  const g = x.createRadialGradient(S / 2, S / 2, Rr * .62, S / 2, S / 2, Rr);
  g.addColorStop(0, 'rgba(120,30,80,0)');
  g.addColorStop(.8, 'rgba(130,30,70,.1)');
  g.addColorStop(1, 'rgba(40,6,24,.75)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}

/** lime iris on a texture the size of the whole ball (iris radius = half the ball, like eyeIris) */
function iris() {
  const S = 512, Rr = S / 2 - 1, ri = Rr * .5, c = can(S), x = c.getContext('2d'), im = x.createImageData(S, S), d = im.data;
  // radial colour ramp: [radius (of iris), r, g, b]
  const RAMP = [[0, 70, 100, 12], [.36, 92, 128, 18], [.46, 176, 222, 58], [.6, 196, 238, 70], [.74, 150, 214, 44], [.84, 80, 146, 20], [.92, 20, 52, 8], [1.03, 10, 24, 4]];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i + .5 - S / 2, dy = j + .5 - S / 2, dd = Math.sqrt(dx * dx + dy * dy) / ri;
    if (dd > 1.03) continue;
    let k = 0;
    while (k < RAMP.length - 2 && RAMP[k + 1][0] < dd) k++;
    const [r0, R0, G0, B0] = RAMP[k], [r1, R1, G1, B1] = RAMP[k + 1], t = cl((dd - r0) / (r1 - r0), 0, 1);
    const a = Math.atan2(dy, dx), seg = Math.floor((a + Math.PI) / TAU * 260);
    const fib = .86 + .14 * hash(seg, 7) + .08 * Math.sin(a * 47 + hash(seg >> 3, 2) * 6 + dd * 9);
    const blot = .9 + .2 * sn(Math.cos(a) * 3 + dd * 6, Math.sin(a) * 3);
    const lit = 1 + .18 * cl(-(dx + dy) / (ri * 1.4), -1, 1); // upper-left a touch brighter
    const m = fib * blot * lit, o = (j * S + i) * 4;
    d[o] = cl(mix(R0, R1, t) * m, 0, 255);
    d[o + 1] = cl(mix(G0, G1, t) * m, 0, 255);
    d[o + 2] = cl(mix(B0, B1, t) * m, 0, 255);
    d[o + 3] = 255 * cl((1.03 - dd) * ri * .5, 0, 1);
  }
  x.putImageData(im, 0, 0);
  return c;
}

let SET0 = null;
export const heroTex = () => SET0 || (SET0 = { s: sclera(), i: iris() });

/** blob silhouette: a ball that won't hold its shape (slow wobble + jiggle when the gaze darts) */
function blob(D, r, t, jig) {
  D.beginPath();
  for (let k = 0; k <= 72; k++) {
    const th = k / 72 * TAU;
    const rr = r * (1 + .016 * Math.sin(3 * th + t * .045) + .012 * Math.sin(5 * th - t * .063 + 1) + .007 * Math.sin(9 * th + t * .11) + jig * .05 * Math.sin(4 * th + t * .5));
    k ? D.lineTo(Math.cos(th) * rr, Math.sin(th) * rr) : D.moveTo(rr, 0);
  }
  D.closePath();
}

/** drool strands off the bottom of the ball: stretch, bead, snap, fall. Deterministic from time */
function strands(D, r, t) {
  for (let s = 0; s < 3; s++) {
    const th = Math.PI / 2 + (s - 1) * .42 + Math.sin(t * .01 + s) * .05;
    const ax = Math.cos(th) * r * .95, ay = Math.sin(th) * r * .95;
    const p = ((t * (.0034 + s * .0007) + s * .37) % 1);
    const snap = p > .9, len = r * (.06 + .62 * Math.min(p, .9) ** 1.7), sway = Math.sin(t * .03 + s * 2) * r * .05;
    const ex = ax + sway, ey = ay + len;
    if (!snap) {
      D.beginPath();
      D.moveTo(ax - r * .05, ay - r * .02);
      D.quadraticCurveTo(ax + sway * .3, ay + len * .55, ex - r * .012, ey);
      D.lineTo(ex + r * .012, ey);
      D.quadraticCurveTo(ax + sway * .3 + r * .02, ay + len * .55, ax + r * .05, ay - r * .02);
      D.fillStyle = 'rgba(255,170,190,.22)';
      D.fill();
      D.strokeStyle = 'rgba(255,235,240,.45)';
      D.lineWidth = Math.max(1, r * .008);
      D.stroke();
    }
    // bead at the tip; once it snaps it falls and thins out
    const fall = snap ? (p - .9) / .1 : 0, by = ey + fall * fall * r * 1.4, br = r * (.022 + .03 * Math.min(p, .9)) * (1 - fall * .5);
    D.globalAlpha = 1 - fall;
    D.fillStyle = 'rgba(255,175,195,.42)';
    D.beginPath();
    D.ellipse(ex, by, br * (snap ? .8 : 1.15), br * (snap ? 1.4 : 1.3), 0, 0, TAU);
    D.fill();
    D.strokeStyle = 'rgba(255,235,240,.5)';
    D.lineWidth = Math.max(1, r * .006);
    D.stroke();
    D.fillStyle = 'rgba(255,255,255,.75)';
    D.beginPath();
    D.arc(ex - br * .3, by - br * .35, br * .28, 0, TAU);
    D.fill();
    D.globalAlpha = 1;
  }
}

/** draw the hero at device-space (X,Y) radius r. e carries gaze (ang, m), dilation, blink, lid colour, jig */
export function drawHeroEye(D, e, X, Y, r) {
  const t = $.T, T = heroTex(), jig = e.jig || 0;
  const sq = 1 + .03 * Math.sin(t * .085) + jig * .05 * Math.sin(t * .6), sx = 1 / Math.sqrt(sq), sy = sq;
  D.save();
  D.translate(X, Y);
  // wet glow behind the ball
  {
    const g = D.createRadialGradient(0, 0, r * .8, 0, 0, r * 1.5);
    g.addColorStop(0, 'rgba(170,30,60,.25)');
    g.addColorStop(1, 'rgba(170,30,60,0)');
    D.fillStyle = g;
    D.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
  }
  D.scale(sx, sy);
  D.save();
  blob(D, r, t, jig);
  D.clip();
  D.drawImage(T.s, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
  // iris + pupil, foreshortened toward the gaze
  const lx = Math.cos(e.ang) * e.m, ly = Math.sin(e.ang) * e.m, ix = lx * r * .42, iy = ly * r * .42;
  D.save();
  D.translate(ix, iy);
  D.rotate(e.ang);
  D.scale(1 - .28 * e.m, 1);
  // soft shadow the iris casts on the sclera (sits in a socket of wet tissue)
  const sg = D.createRadialGradient(0, 0, r * .46, 0, 0, r * .62);
  sg.addColorStop(0, 'rgba(60,10,30,.45)');
  sg.addColorStop(1, 'rgba(60,10,30,0)');
  D.fillStyle = sg;
  D.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4);
  D.drawImage(T.i, -r, -r, r * 2, r * 2);
  const pr = r * .5 * .36 * e.dil;
  const pg = D.createRadialGradient(0, 0, pr * .6, 0, 0, pr * 1.18);
  pg.addColorStop(0, 'rgba(6,2,0,1)');
  pg.addColorStop(.75, 'rgba(14,8,2,.96)');
  pg.addColorStop(1, 'rgba(30,40,6,0)');
  D.fillStyle = pg;
  D.beginPath();
  D.arc(0, 0, pr * 1.18, 0, TAU);
  D.fill();
  D.restore();
  // cyan glint on the upper right of the iris (fixed to the light, not the gaze)
  {
    const gx = ix + r * .2, gy = iy - r * .2, g = D.createRadialGradient(gx, gy, 0, gx, gy, r * .11);
    g.addColorStop(0, 'rgba(225,245,255,1)');
    g.addColorStop(.3, 'rgba(70,160,255,.85)');
    g.addColorStop(1, 'rgba(40,120,255,0)');
    D.fillStyle = g;
    D.fillRect(gx - r * .11, gy - r * .11, r * .22, r * .22);
  }
  // wet sheen: a broad soft streak that slides a little as the ball wobbles, plus a few glistening beads
  {
    const wx = -r * .38 + Math.sin(t * .02) * r * .03, wy = -r * .42;
    D.save();
    D.translate(wx, wy);
    D.rotate(-.65);
    const g = D.createRadialGradient(0, 0, 0, 0, 0, r * .34);
    g.addColorStop(0, 'rgba(255,255,255,.42)');
    g.addColorStop(.5, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    D.scale(1, .42);
    D.fillStyle = g;
    D.beginPath();
    D.arc(0, 0, r * .34, 0, TAU);
    D.fill();
    D.restore();
    D.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < 3; k++) {
      const a = 3.6 + k * .32 + Math.sin(t * .015 + k) * .05, rr = r * (.62 + .1 * Math.sin(k * 2.3));
      D.beginPath();
      D.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * (.008 + .006 * (k % 3)), 0, TAU);
      D.fill();
    }
  }
  // tear film pooling along the bottom edge
  D.strokeStyle = 'rgba(255,225,235,.07)';
  D.lineWidth = r * .05;
  D.beginPath();
  D.arc(0, 0, r * .95, .35, Math.PI - .35);
  D.stroke();
  // lids for blinks
  if (e.bl > .02) {
    const b = Math.min(1, e.bl);
    D.fillStyle = e.lid;
    D.beginPath();
    D.ellipse(0, -r * 1.05, r * 1.2, r * b * 1.07, 0, 0, Math.PI);
    D.fill();
    D.beginPath();
    D.ellipse(0, r * 1.05, r * 1.2, r * b * 1.07, 0, Math.PI, TAU);
    D.fill();
  }
  D.restore();
  // wobbly dark rim
  blob(D, r, t, jig);
  D.strokeStyle = 'rgba(40,4,16,.5)';
  D.lineWidth = Math.max(1, r * .02);
  D.stroke();
  strands(D, r, t);
  D.restore();
}
