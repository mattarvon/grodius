// @ts-nocheck
// =====================================================================
//  THE MAW, gross edition: THE MAW (Open Orbit), THE DISSOLVED MAW (acid), THE MUCUS MAW (snot).
//  Render-only. Hitbox, HP, timing, bullets and spawns live in enemies/update.ts and are untouched: everything
//  here reads entity fields ($.T, e.t, e.jaw, e.hp, e.eyesP, e.biome) and never calls the gameplay RNG. Its own
//  particles (pus, vomit, gas, maggots, the death rupture) sit in a private list ticked by drawMawFx().
// =====================================================================
import { $ } from '../../state';
import { C, TAU, W, ctx, hash } from '../../core';
import { floorAt } from '../../world';
import { SET } from '../../save';
import { sample } from '../../audio';
import { drawSkull, glow } from '../util';
import { eye, lowEye } from '../eyes';

/** how gross: 0 = the original Maw, 1 = everything, >1 = more particles / flies / maggots. Dial back here. */
export const GROSS = 1;

const q = Math.min(1, GROSS); // alpha / count scale for overlays (particle counts scale by GROSS itself)
const n = (k) => Math.max(0, Math.round(k * GROSS));

// ---------------- render-only RNG (xorshift; NEVER core.R / rr / pick) ----------------
let rs = 0x2f6b4e1d;
const rnd = () => ((rs ^= rs << 13), (rs ^= rs >>> 17), (rs ^= rs << 5), (rs >>> 0) / 4294967296);
const rb = (a, b) => a + rnd() * (b - a);
const rp = (a) => a[(rnd() * a.length) | 0];

// ---------------- per-variant palette ----------------
const PAL = {
  orbit: {
    rim: '#2e0c0a', base: ['#c97862', '#8a3a2e', '#3e110d'], patch: ['#6b6a34', '#3a1a2c', '#a39a58', '#5a0e14', '#2a2a14'],
    vein: '#3c1446', veinHot: '#c2307e', pus: ['#e8d468', '#f6eeb0', '#c8a838', '#9aa83a'], blood: ['#8a0a12', '#4e0307', '#c0202a'],
    drool: '232,226,190', bile: ['#b4b42e', '#8a8a1e', '#d6a03c', '#e2782c', '#5e4a1c', '#c8c868'], gas: '120,140,44', liquid: '#a8b42e', liquidD: '#5a6a14',
    gum: '#7e2442', gumD: '#4a1028', tongue: '#b0485a', tongueL: '#d47888', tooth: ['#e8e0cc', '#d8c88a', '#bba060', '#8a6a3a', '#2a1a10'],
  },
  acid: {
    rim: '#122018', base: ['#c9a08a', '#7a5446', '#24140f'], patch: ['#2a8a70', '#1a4a3c', '#b8c870', '#3a1a2c', '#52e0b8'],
    vein: '#0e3a30', veinHot: '#3ff0c0', pus: ['#b8f070', '#e0ffc0', '#6ad8a0', '#d8e060'], blood: ['#1c9a80', '#0a3a32', '#6ff0d4'],
    drool: '110,240,205', bile: ['#40e0b0', '#20a080', '#d0f0a0', '#b8c440', '#0e5a48', '#8af0d0'], gas: '70,220,180', liquid: '#33e8b6', liquidD: '#0c6a54',
    gum: '#5a3a4a', gumD: '#1e3a30', tongue: '#9a6a6a', tongueL: '#c89a8a', tooth: ['#d8e8d0', '#a8d0b0', '#78b898', '#4a8a70', '#1a3a30'],
  },
  snot: {
    rim: '#3a2a08', base: ['#d68e6a', '#8e4a2a', '#3a160a'], patch: ['#b8b83a', '#6a6a18', '#e8e070', '#5a2a10', '#8aa020'],
    vein: '#4a1a3a', veinHot: '#e0a030', pus: ['#e8dc50', '#fff6b0', '#b8b828', '#a0c030'], blood: ['#c8ac3a', '#6a4a14', '#f2e08a'],
    drool: '210,214,70', bile: ['#d8d040', '#a8b020', '#f0f0a0', '#80a020', '#6a5a10', '#e8c040'], gas: '170,170,40', liquid: '#c8c83c', liquidD: '#6a6a10',
    gum: '#8a3040', gumD: '#5a4a10', tongue: '#b85a5a', tongueL: '#e08a7a', tooth: ['#f0e8c0', '#e0d080', '#c8b048', '#8a7a2a', '#3a2a0a'],
  },
};
const VK = (e) => (e.biome === 'acid' || e.biome === 'snot' ? e.biome : 'orbit');

// ---------------- pre-rendered body (one 72x72 canvas per variant) ----------------
const TEX = {};
function srng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647), s / 2147483647);
}
function blob(x, cx, cy, r, f, k = 9) {
  x.beginPath();
  for (let i = 0; i <= k; i++) {
    const a = (i / k) * TAU, rr = r * (.6 + f() * .55);
    i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}
function bodyTex(v) {
  if (TEX[v]) return TEX[v];
  const S = 72, O = 36, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d'), P = PAL[v], f = srng(v === 'acid' ? 911 : v === 'snot' ? 4242 : 1337);
  // base flesh
  const g = x.createRadialGradient(O - 6, O - 8, 2, O, O, 26);
  g.addColorStop(0, P.base[0]);
  g.addColorStop(.6, P.base[1]);
  g.addColorStop(1, P.base[2]);
  x.fillStyle = g;
  x.beginPath();
  x.arc(O, O, 23.5, 0, TAU);
  x.fill();
  x.globalCompositeOperation = 'source-atop';
  // gangrene mottling
  for (let i = 0; i < 20; i++) {
    const a = f() * TAU, r = Math.sqrt(f()) * 21;
    x.globalAlpha = .16 + f() * .22;
    x.fillStyle = P.patch[(f() * P.patch.length) | 0];
    blob(x, O + Math.cos(a) * r, O + Math.sin(a) * r, 3 + f() * 4.5, f);
  }
  // necrotic black-green rot patches with a sick rim
  for (let i = 0; i < 4; i++) {
    const a = f() * TAU, r = 8 + f() * 13, cx = O + Math.cos(a) * r, cy = O + Math.sin(a) * r, s = 2.5 + f() * 3.5;
    x.globalAlpha = .85;
    x.fillStyle = P.patch[1];
    blob(x, cx, cy, s + 1.2, f);
    x.fillStyle = '#140808';
    blob(x, cx, cy, s, f);
    x.fillStyle = P.patch[0];
    x.globalAlpha = .5;
    for (let k = 0; k < 4; k++) x.fillRect((cx + (f() - .5) * s * 1.6) | 0, (cy + (f() - .5) * s * 1.6) | 0, 1, 1);
  }
  // peeling skin: raw red under a curled pale flap
  for (let i = 0; i < 5; i++) {
    const a = f() * TAU, r = 6 + f() * 15, cx = O + Math.cos(a) * r, cy = O + Math.sin(a) * r, s = 2.8 + f() * 2.2, an = f() * TAU;
    x.globalAlpha = 1;
    x.fillStyle = '#b01c2c';
    x.beginPath();
    x.ellipse(cx, cy, s * 1.3, s * .8, an, 0, TAU);
    x.fill();
    x.fillStyle = '#e8506a';
    x.fillRect((cx - 1) | 0, (cy - 1) | 0, 1, 1);
    x.fillStyle = '#e6c2a8';
    x.beginPath();
    x.moveTo(cx + Math.cos(an) * s * 1.4, cy + Math.sin(an) * s * 1.4);
    x.quadraticCurveTo(cx + Math.cos(an + 1.8) * s * 1.6, cy + Math.sin(an + 1.8) * s * 1.6, cx + Math.cos(an + 2.9) * s * .6, cy + Math.sin(an + 2.9) * s * .6);
    x.lineTo(cx + Math.cos(an + .4) * s * .4, cy + Math.sin(an + .4) * s * .4);
    x.closePath();
    x.fill();
    x.strokeStyle = '#3a0a08';
    x.lineWidth = .7;
    x.stroke();
  }
  // static veins (the pulse is drawn live on top)
  x.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    let a = f() * TAU, px = O + Math.cos(a) * 24, py = O + Math.sin(a) * 24, d = a + Math.PI + (f() - .5);
    x.strokeStyle = P.vein;
    x.globalAlpha = .55;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 7; k++) {
      d += (f() - .5) * 1.1;
      px += Math.cos(d) * 2.4;
      py += Math.sin(d) * 2.4;
      x.lineTo(px, py);
      if (f() < .3) x.moveTo(px, py);
    }
    x.stroke();
  }
  // pockmarks
  x.globalAlpha = 1;
  for (let i = 0; i < 18; i++) {
    const a = f() * TAU, r = Math.sqrt(f()) * 22, px = (O + Math.cos(a) * r) | 0, py = (O + Math.sin(a) * r) | 0;
    x.fillStyle = '#1e0606';
    x.fillRect(px, py, 1, 1);
    x.fillStyle = P.base[0];
    x.globalAlpha = .6;
    x.fillRect(px + 1, py + 1, 1, 1);
    x.globalAlpha = 1;
  }
  if (v === 'acid') {
    // the flesh has dissolved off the upper back: skull plate + ribs, stained teal
    x.fillStyle = '#2a8a70';
    blob(x, O + 10, O - 12, 8, f, 12);
    x.fillStyle = '#d8d2b2';
    blob(x, O + 10, O - 12, 6, f, 12);
    x.fillStyle = '#9aa888';
    x.fillRect(O + 8, O - 16, 1, 8);
    x.fillRect(O + 6, O - 13, 7, 1);
    x.fillStyle = '#0c1410';
    x.beginPath();
    x.ellipse(O + 12, O - 10, 2, 1.5, .3, 0, TAU);
    x.fill();
    x.strokeStyle = '#d8d2b2';
    x.lineWidth = 1.3;
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      x.arc(O + 2, O + 6 + k * 3.6, 9 - k * .8, -.35, .55);
      x.stroke();
    }
    // melt streaks
    x.strokeStyle = '#3ac0a0';
    x.lineWidth = 1;
    x.globalAlpha = .45;
    for (let k = 0; k < 12; k++) {
      const px = O - 20 + f() * 40, py = O - 18 + f() * 20;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (f() - .5), py + 4 + f() * 12);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  if (v === 'snot') {
    // a glaze of mucus over everything
    for (let i = 0; i < 16; i++) {
      x.globalAlpha = .16 + f() * .14;
      x.fillStyle = f() < .5 ? '#c8c84a' : '#a8b830';
      const a = f() * TAU, r = Math.sqrt(f()) * 20;
      blob(x, O + Math.cos(a) * r, O + Math.sin(a) * r, 3 + f() * 5, f);
    }
  }
  // shading
  x.globalAlpha = 1;
  const sh = x.createRadialGradient(O - 8, O - 10, 3, O, O, 25);
  sh.addColorStop(0, 'rgba(255,225,205,.34)');
  sh.addColorStop(.55, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.45)');
  x.fillStyle = sh;
  x.fillRect(0, 0, S, S);
  if (v === 'snot') { // wet gloss streaks
    x.strokeStyle = 'rgba(255,255,220,.45)';
    x.lineWidth = 1;
    x.beginPath();
    x.arc(O - 3, O - 3, 17, 3.6, 4.6);
    x.stroke();
    x.beginPath();
    x.arc(O - 1, O - 1, 12, 3.8, 4.3);
    x.stroke();
  }
  // ragged dark rim behind it all
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = P.rim;
  x.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, r = 25.5 + hash(i) * 3;
    i ? x.lineTo(O + Math.cos(a) * r, O + Math.sin(a) * r) : x.moveTo(O + Math.cos(a) * r, O + Math.sin(a) * r);
  }
  x.closePath();
  x.fill();
  // live vein paths (local coords), generated once with the same rng
  const veins = [];
  for (let i = 0; i < 6; i++) {
    let a = -1.2 + f() * 2.4 + (i % 2 ? Math.PI : 0), px = Math.cos(a) * 22, py = Math.sin(a) * 22, d = a + Math.PI + (f() - .5) * .6;
    const pts = [[px, py]];
    for (let k = 0; k < 6; k++) {
      d += (f() - .5) * .9;
      px += Math.cos(d) * 2.8;
      py += Math.sin(d) * 2.8;
      pts.push([px, py]);
    }
    veins.push(pts);
  }
  return (TEX[v] = { cv, veins });
}

// ---------------- private particles ----------------
// k: 0 dot, 1 blob, 2 gas puff, 3 maggot, 4 drop (streaks), 5 eyeball, 6 tooth, 7 skin flap
const PT = [];
const CAP = 200;
let lastT = -1, lastG = null;
function add(o, force = false) {
  if (PT.length >= (force ? CAP + 120 : CAP)) return;
  PT.push(Object.assign({ vx: 0, vy: 0, g: .08, l: 40, m: 40, s: 1, k: 0, c: '#fff', a: 1 }, o));
}
const live = new Set(); // Maws drawn recently (to catch the kill)
const RUP = []; // death ruptures
const ST = new WeakMap();
function st(e) {
  let s = ST.get(e);
  if (!s) ST.set(e, (s = { m: {}, hp: e.hp, wounds: [], jig: 0, fart: 0, x: e.x, y: e.y, v: VK(e), sndT: -99 }));
  return s;
}
/** true once each time floor((t+off)/P) ticks over (robust to skipped render frames) */
function tick(s, key, t, P, off = 0) {
  const k = Math.floor((t + off) / P), o = s.m[key];
  s.m[key] = k;
  return o !== undefined && k !== o;
}
const snd = (s, cat, o, gap = 20) => {
  if ($.state !== 'play' || $.T - s.sndT < gap) return;
  s.sndT = $.T;
  try { sample(cat, o); } catch (err) {}
};

// ---------------- the Maw ----------------
const BOILS = {
  orbit: [[6, -13, 3.4], [19, -10, 2.6], [-3, -21, 2.4], [21, 12, 3], [7, 16, 2.8], [-6, 20, 2.2], [14, -18, 2], [0, 9, 2.2]],
  acid: [[4, 13, 2.2], [20, 10, 2], [-6, 19, 1.8], [12, 18, 1.8], [-1, -19, 1.6], [18, -2, 1.6]],
  snot: [[6, -13, 4], [19, -9, 3.2], [-3, -21, 3], [21, 12, 3.6], [7, 16, 3.4], [-6, 20, 2.6], [14, -18, 2.4], [0, 9, 2.8], [16, 4, 2.4]],
};
const NOSE = [[-11, -19.5], [-4.5, -22]];
const STOM = { orbit: [13, 2, 6.5, 9], acid: [11, 3, 9.5, 12.5], snot: [13, 2, 6, 8.5] };

export function drawGrossMaw(c, e) {
  const t = e.t, v = VK(e), P = PAL[v], s = st(e), T = bodyTex(v);
  live.add(e);
  s.x = e.x;
  s.y = e.y;
  s.v = v;
  // ---- hits: track damage, open wounds, squirt ----
  const dmg = s.hp - e.hp;
  if (dmg > 0) {
    s.acc = (s.acc || 0) + dmg;
    s.jig = Math.min(1.4, s.jig + .5);
    const step = e.max / 9;
    while (s.acc >= step && s.wounds.length < 9 * q) {
      s.acc -= step;
      let a = rb(Math.PI * .55, Math.PI * 1.45), r = rb(11, 20), wx = Math.cos(a) * r, wy = Math.sin(a) * r;
      if (wx < -4 && Math.abs(wy) < 12) wy = (wy < 0 ? -1 : 1) * rb(13, 19);
      s.wounds.push({ x: wx, y: wy, a: rb(-.8, .8), L: rb(2.4, 4.2), t0: t });
    }
    const k = Math.min(4, 1 + ((dmg * 2) | 0));
    for (let i = 0; i < n(k); i++) {
      const w = s.wounds.length && rnd() < .6 ? rp(s.wounds) : { x: rb(-22, -6), y: rb(-18, 18) };
      add({ x: e.x + w.x, y: e.y + w.y, vx: rb(-2.2, -.4), vy: rb(-1.6, .6), g: .12, l: rb(14, 26), s: rb(1, 2), c: rp(rnd() < .5 ? P.blood : P.pus), k: rnd() < .3 ? 4 : 0 });
    }
  }
  s.hp = e.hp;
  s.jig = Math.max(0, s.jig - .06);
  const cyc = t % 130, tel = cyc >= 78 && cyc < 100 ? (cyc - 78) / 22 : 0, j = e.jaw * 14 + 2.5;
  const spew = tick(s, 'sp', t, 130, 30) && cyc >= 100 && cyc < 112 && e.x < W - 20; // the heave (update.ts fires the globs at cyc 100)
  const hurt = 1 - e.hp / e.max;
  // ---- retch shudder + peristalsis breathing + hit jiggle ----
  const sh = tel * tel * 1.3 * q;
  c.save();
  c.translate((hash(t * 1.7) - .5) * sh, (hash(t * 2.3 + 5) - .5) * sh);
  const br = Math.sin(t * .09), jg = Math.sin(t * 1.1) * s.jig * .06;
  const sx = 1 + (.035 * br + .07 * tel + jg) * q, sy = 1 - (.03 * br - .03 * tel + jg) * q;
  // ---- guts trailing out the back (where the cables were), peristaltic lumps crawling along them ----
  c.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const ax = 14, ay = 6 + k * 5, cx = 26, cy = 14 + k * 4 + Math.sin(t * .05 + k) * 4, bx = 36, by = 6 + k * 9 + Math.sin(t * .04 + k * 2) * 2;
    c.strokeStyle = '#3a1418';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo(cx, cy, bx, by);
    c.stroke();
    c.strokeStyle = k === 1 ? '#a85a5e' : '#8e4a52';
    c.lineWidth = 2.6;
    c.stroke();
    c.strokeStyle = 'rgba(255,200,200,.35)';
    c.lineWidth = .8;
    c.stroke();
    const u = (t * .012 + k * .37) % 1, iu = 1 - u, lx = iu * iu * ax + 2 * iu * u * cx + u * u * bx, ly = iu * iu * ay + 2 * iu * u * cy + u * u * by;
    c.fillStyle = '#b86a6a';
    c.beginPath();
    c.arc(lx, ly, 2.2 + Math.sin(t * .2) * .3, 0, TAU);
    c.fill();
    c.fillStyle = '#5a1a1e';
    c.fillRect(bx - 1, by - 1, 2.4, 2.4); // ragged severed end
    if (tick(s, 'gd' + k, t, 70 + k * 23, k * 31)) add({ x: e.x + bx, y: e.y + by + 1, vy: .3, g: .1, l: 40, s: 1.4, c: rp(P.blood), k: 4 });
  }
  // ---- the arse (gross-out comedy): a puckered sphincter on the back that clenches and vents ----
  const fartNow = tick(s, 'fa', t, 190, 57) || spew; // it vomits and farts at the same time
  if (fartNow && GROSS > 0) {
    s.fart = 1;
    for (let i = 0; i < n(7); i++) add({ x: e.x + 24, y: e.y - 3 + rb(-2, 2), vx: rb(.3, 1.3), vy: rb(-.5, .2), g: -.006, l: rb(55, 90), s: rb(3, 5), c: P.gas, k: 2, a: rb(.3, .5) });
    if (rnd() < .4) snd(s, 'fart_ok', { vol: .5, wet: .25, spread: .15 }, 60);
  }
  s.fart = Math.max(0, s.fart - .05);
  // ---- body ----
  c.save();
  c.scale(sx, sy);
  c.drawImage(T.cv, -36, -36);
  // pulsing veins (heartbeat, faster as it dies)
  const beat = Math.pow(Math.max(0, Math.sin(t * (.12 + hurt * .1))), 6);
  c.globalAlpha = q * (.55 + .45 * beat);
  c.strokeStyle = beat > .4 ? P.veinHot : P.vein;
  c.lineWidth = 1 + beat * 1.1;
  c.beginPath();
  for (const pts of T.veins) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] + Math.sin(t * .1 + i) * beat * .4, pts[i][1]);
  }
  c.stroke();
  c.globalAlpha = 1;
  // peristalsis: a swallowing ring travelling from the back toward the mouth
  c.save();
  c.beginPath();
  c.arc(0, 0, 23.5, 0, TAU);
  c.clip();
  const px = 24 - ((t * .35) % 50);
  c.fillStyle = `rgba(30,0,0,${.28 * q})`;
  c.beginPath();
  c.ellipse(px, 0, 3, 26, 0, 0, TAU);
  c.fill();
  c.fillStyle = `rgba(255,180,160,${.14 * q})`;
  c.beginPath();
  c.ellipse(px - 3.5, 0, 1.2, 25, 0, 0, TAU);
  c.fill();
  c.restore();
  c.restore();
  // ---- cyborg plates, now infected: pus beading around the rivets ----
  c.fillStyle = '#2a3038';
  c.fillRect(2, -25, 14, 7);
  c.fillRect(4, 18, 12, 7);
  c.fillStyle = v === 'acid' ? '#4a7a6a' : '#6e7b88';
  c.fillRect(2, -25, 14, 1);
  c.fillRect(4, 18, 12, 1);
  c.fillStyle = '#5a3a20';
  c.fillRect(3, -20, 12, 1);
  c.fillRect(5, 23, 10, 1); // rust
  for (const [x, y] of [[4, -22], [13, -22], [6, 21], [13, 21]]) {
    c.fillStyle = P.pus[0];
    c.fillRect(x - 1, y - 1, 3, 3);
    c.fillStyle = '#a5b3c0';
    c.fillRect(x, y, 1, 1);
  }
  c.fillStyle = P.pus[0];
  c.fillRect(2, -18, 14, 1.2);
  c.fillRect(4, 17, 12, 1.2); // crust where flesh meets metal
  // ---- the stomach window: the seam split and the stomach wall is see-through ----
  const [mx, my, mrx, mry] = STOM[v];
  c.save();
  c.beginPath();
  c.ellipse(mx, my, mrx, mry, 0, 0, TAU);
  c.clip();
  c.fillStyle = '#1a0806';
  c.fillRect(mx - mrx, my - mry, mrx * 2, mry * 2);
  const lvl = my - mry * .15 + Math.sin(t * .07) * 1.5 * q - tel * 2, tilt = Math.sin(t * .05 + e.y * .02) * .3;
  // floating junk (behind the liquid surface): bones, a skull, an eyeball, a chewed bit of ship
  const bob = (o) => Math.sin(t * .06 + o) * 1.2;
  if (v === 'acid') {
    drawSkull(c, mx - 3, lvl + 5 + bob(1), 2.2, 0);
    c.strokeStyle = '#d8d2b2';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(mx + 1, lvl + 9 + bob(2));
    c.lineTo(mx + 6, lvl + 6 + bob(3));
    c.moveTo(mx - 6, lvl + 10);
    c.lineTo(mx - 2, lvl + 12 + bob(4));
    c.stroke();
  } else {
    drawSkull(c, mx + 1, lvl + 4 + bob(1), 1.6, 0);
  }
  c.fillStyle = '#5a6470';
  c.fillRect(mx - 4, lvl + 1 + bob(5), 3, 2);
  lowEye(c, mx + 3.5, lvl + 2 + bob(6), 1.3, { ang: t * .03, iris: '#b01018' });
  c.globalAlpha = .74;
  c.fillStyle = P.liquid;
  c.beginPath();
  c.moveTo(mx - mrx, lvl - tilt * mrx);
  for (let i = 0; i <= 8; i++) {
    const xx = mx - mrx + (i / 8) * mrx * 2;
    c.lineTo(xx, lvl + tilt * (xx - mx) + Math.sin(t * .15 + i * 1.3) * .8);
  }
  c.lineTo(mx + mrx, my + mry);
  c.lineTo(mx - mrx, my + mry);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = P.liquidD;
  c.globalAlpha = .6;
  c.fillRect(mx - mrx, my + mry * .55, mrx * 2, mry);
  c.globalAlpha = 1;
  // bubbles fizzing up through it
  c.fillStyle = 'rgba(255,255,220,.7)';
  for (let i = 0; i < (v === 'acid' ? 7 : 4); i++) {
    const bp = ((t * (.25 + hash(i) * .2) + hash(i + 3) * 40) % 14) / 14, bx = mx - mrx * .7 + hash(i + 9) * mrx * 1.4;
    c.fillRect(bx + Math.sin(t * .2 + i) * .6, my + mry - bp * (my + mry - lvl), 1, 1);
  }
  c.restore();
  // membrane: wet gloss + red capillaries + a torn stapled seam on its front
  c.strokeStyle = `rgba(230,150,150,${.6 * q})`;
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(mx, my, mrx, mry, 0, 0, TAU);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.4)';
  c.beginPath();
  c.ellipse(mx, my, mrx - 1.5, mry - 1.5, 0, 3.6, 4.4);
  c.stroke();
  c.strokeStyle = 'rgba(160,20,30,.5)';
  c.beginPath();
  c.moveTo(mx - mrx * .6, my - mry * .7);
  c.quadraticCurveTo(mx, my - 2, mx + mrx * .3, my + mry * .8);
  c.moveTo(mx + mrx * .5, my - mry * .6);
  c.lineTo(mx + mrx * .1, my);
  c.stroke();
  c.strokeStyle = '#9aa8b6';
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    const yy = my - mry * .8 + k * mry * .4, xx = mx - mrx * Math.sqrt(Math.max(0, 1 - ((yy - my) / mry) ** 2));
    c.moveTo(xx - 2, yy);
    c.lineTo(xx + 1.5, yy + (k % 2 ? 1 : -1));
  }
  c.stroke();
  if (v === 'acid' || GROSS > 1) { // it glows
    c.globalCompositeOperation = 'lighter';
    glow(mx, my, mry + 3, '60,230,190', .13 + .05 * Math.sin(t * .1));
    c.globalCompositeOperation = 'source-over';
  }
  // ---- sphincter ----
  {
    const op = s.fart, r = 2 + op * 1.6 + Math.sin(t * .13) * .2;
    c.fillStyle = '#6e2a36';
    c.beginPath();
    c.arc(23, -3, r + 1.6, 0, TAU);
    c.fill();
    c.fillStyle = '#1e0408';
    c.beginPath();
    c.arc(23, -3, r * .55, 0, TAU);
    c.fill();
    c.strokeStyle = '#3a0c14';
    c.lineWidth = .6;
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + Math.sin(t * .05) * .2;
      c.moveTo(23 + Math.cos(a) * r * .55, -3 + Math.sin(a) * r * .55);
      c.lineTo(23 + Math.cos(a) * (r + 1.4), -3 + Math.sin(a) * (r + 1.4));
    }
    c.stroke();
    if (op > .1) { // stink lines
      c.strokeStyle = `rgba(${P.gas},${op * .8})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const bx = 27 + k * 3, by = -7 - (1 - op) * 8;
        c.moveTo(bx, by);
        c.quadraticCurveTo(bx + 2, by - 2, bx, by - 4);
        c.quadraticCurveTo(bx - 2, by - 6, bx, by - 8);
      }
      c.stroke();
    }
  }
  // ---- boils: swell, tremble, burst into pus, scab, swell again ----
  const BL = BOILS[v], nb = Math.ceil(BL.length * q);
  for (let i = 0; i < nb; i++) {
    const [bx0, by0, rm] = BL[i], Pp = (v === 'acid' ? 110 : 170) + hash(i * 3.1) * 170, off = hash(i + 7) * Pp, ph = ((t + off) % Pp) / Pp;
    const bx = bx0 * sx, by = by0 * sy;
    if (tick(s, 'bo' + i, t, Pp, off - .82 * Pp)) {
      const nx = bx / 24, ny = by / 24;
      for (let k = 0; k < n(9); k++) add({ x: e.x + bx, y: e.y + by, vx: nx * rb(.6, 2.4) + rb(-.8, .8), vy: ny * rb(.6, 2.4) + rb(-1.4, .2), g: .1, l: rb(18, 34), s: rb(1, 2.2), c: rp(P.pus), k: rnd() < .4 ? 1 : 0 });
      add({ x: e.x + bx, y: e.y + by, l: 8, m: 8, s: rm * 2.5, c: P.pus[1], k: 8, g: 0 }); // pop ring
      snd(s, 'splat_s', { vol: .22, spread: .2, wet: .15 }, 25);
    }
    if (ph < .82) {
      const gp = ph / .82, r = rm * (.3 + .7 * gp ** 1.4), tr = gp > .75 ? (hash(t + i) - .5) * .8 : 0;
      const x = bx + tr, y = by;
      c.fillStyle = '#b8202c';
      c.globalAlpha = .75;
      c.beginPath();
      c.arc(x, y + .3, r + 1, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = P.pus[2];
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
      c.fillStyle = P.pus[0];
      c.beginPath();
      c.arc(x - r * .15, y - r * .2, r * .72, 0, TAU);
      c.fill();
      c.fillStyle = P.pus[1];
      c.beginPath();
      c.arc(x - r * .35, y - r * .4, r * .32, 0, TAU);
      c.fill();
      if (gp > .45) {
        c.fillStyle = '#5a4a14';
        c.fillRect(x - .5, y - r * .2 - .5, 1, 1); // the head
      }
      c.fillStyle = '#fff';
      c.fillRect(x - r * .5, y - r * .6, 1, 1);
    } else {
      const k = (ph - .82) / .18, r = rm * (1 - k * .45);
      c.globalAlpha = 1 - k * .6;
      c.fillStyle = '#4a0a10';
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
      c.strokeStyle = P.pus[2];
      c.lineWidth = .8;
      c.stroke();
      c.fillStyle = P.pus[0];
      c.fillRect(bx - .5, by + r * .3, 1, 1 + k * 3); // weeping out of the crater
      c.globalAlpha = 1;
    }
  }
  // ---- too many teeth: a few have erupted out through the cheeks ----
  if (q > .3) {
    c.fillStyle = P.tooth[1];
    for (const [x, y, a] of [[-4, -15, -2.4], [-6, 14, 2.3], [-18, -12, -3.4], [-17, 13, 3.2]]) {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = '#5a1018';
      c.fillRect(-1.6, -.4, 3.2, 1.4);
      c.fillStyle = P.tooth[(hash(x * y) * 3) | 0];
      c.beginPath();
      c.moveTo(-1.1, 0);
      c.lineTo(0, 3.2);
      c.lineTo(1.1, 0);
      c.fill();
      c.restore();
    }
  }
  // ---- wounds from hits: open, ooze, and the maggots move in ----
  for (const w of s.wounds) drawWound(c, e, s, w, P, t, 1);
  if (e.wounded) drawWound(c, e, s, s.big || (s.big = { x: 8, y: -12, a: -.5, L: 7, t0: t, big: 1 }), P, t, 1);
  // ---- snot bubbles from the nostrils ----
  const nz = v === 'snot' ? 1 : v === 'orbit' ? .55 : 0;
  for (let i = 0; i < 2; i++) {
    const [nx, ny] = NOSE[i];
    c.fillStyle = '#2a0808';
    c.beginPath();
    c.ellipse(nx, ny, 1.6, 1.1, -.4, 0, TAU);
    c.fill();
    c.fillStyle = v === 'acid' ? '#6ad8a0' : '#c8c040';
    c.fillRect(nx - 1.5, ny + .6, 3, 1); // crust
    if (!nz) continue;
    const Pp = 120 + i * 37, off = i * 53, ph = ((t + off) % Pp) / Pp, r = nz * 7 * ph ** 1.3 * (1 + .12 * Math.sin(t * .25)) * q;
    if (tick(s, 'sn' + i, t, Pp, off)) {
      const R0 = nz * 7 * q;
      for (let k = 0; k < n(8 * nz); k++) {
        const a = rb(0, TAU);
        add({ x: e.x + nx - 2 + Math.cos(a) * R0, y: e.y + ny - 3 + Math.sin(a) * R0, vx: Math.cos(a) * rb(.4, 1.4), vy: Math.sin(a) * rb(.4, 1.4) - .3, g: .09, l: rb(16, 30), s: rb(1, 1.8), c: v === 'snot' ? rp(['#d8d040', '#f0f0a0', '#a8b020']) : rp(['#d8e0a0', '#c8c870']), k: 0 });
      }
      add({ x: e.x + nx, y: e.y + ny + 1, vy: .2, g: .04, l: 40, s: 1.2, c: '#c8c840', k: 4 }); // the string that's left
      if (v === 'snot') snd(s, 'snot', { vol: .35, spread: .2 }, 30);
    }
    if (r > .6) {
      const bx = nx - r * .55, by = ny - r * .6;
      c.fillStyle = v === 'snot' ? 'rgba(200,210,70,.38)' : 'rgba(220,225,170,.3)';
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
      c.strokeStyle = v === 'snot' ? 'rgba(235,240,140,.85)' : 'rgba(240,240,210,.6)';
      c.lineWidth = .8;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)';
      c.beginPath();
      c.arc(bx, by, r * .7, 3.5, 4.4);
      c.stroke();
    }
  }
  // ---- eyes (same spots the bullets come from), crusted with pus and weeping ----
  for (let i = 0; i < e.eyesP.length; i++) {
    const ep = e.eyesP[i], x = Math.cos(ep.a + Math.PI) * ep.r * .9 + 4, y = Math.sin(ep.a) * ep.r;
    const tl = 3 + ep.s + Math.sin(t * .05 + i) * 1.5;
    c.strokeStyle = `rgba(${P.drool},${.75 * q})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + .3, y + ep.s * .7);
    c.quadraticCurveTo(x + 1, y + ep.s + tl * .5, x + .5, y + ep.s + tl);
    c.stroke();
    c.fillStyle = P.pus[0];
    c.fillRect(x, y + ep.s + tl - .5, 1.2, 1.4);
    c.strokeStyle = `rgba(200,180,80,${.7 * q})`;
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(x, y, ep.s + .8, 0, TAU);
    c.stroke();
    if (tick(s, 'tr' + i, t, 90 + ((i * 37) % 70), i * 13)) add({ x: e.x + x + .5, y: e.y + y + ep.s + tl, vy: .4, g: .1, l: 30, s: 1.2, c: P.pus[(i % 2) * 2], k: 4 });
    eye(c, x, y, ep.s, { ang: Math.atan2($.P.y - e.y - y, $.P.x - e.x - x), iris: '#b01018', bs: 1.5 + hurt, blink: ep.b > 0 ? 1 : 0, lid: v === 'snot' ? '#8a7a2a' : v === 'acid' ? '#4a6a5a' : '#6e2b26' });
  }
  // an extra eye on a fleshy stalk out of the scalp, where no eye should be
  if (q > .5) {
    const sx0 = 8, sy0 = -21, ex = sx0 - 6 + Math.sin(t * .04) * 4, ey = sy0 - 9 + Math.cos(t * .05) * 2;
    c.strokeStyle = '#6e2b30';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(sx0, sy0);
    c.quadraticCurveTo(sx0 + 2, sy0 - 6, ex, ey);
    c.stroke();
    c.strokeStyle = '#b06068';
    c.lineWidth = .7;
    c.stroke();
    eye(c, ex, ey, 2.1, { ang: Math.atan2($.P.y - e.y - ey, $.P.x - e.x - ex), iris: '#c8a020', bs: 2.2, blink: (t + 40) % 150 < 7 ? 1 : 0, lid: '#5a1a20' });
  }
  // ---- once it's badly hurt, maggots come out of the wounds and crawl over the skin ----
  if (hurt > .3 && q > 0) {
    const nm = Math.round((hurt - .3) * 16 * GROSS);
    for (let i = 0; i < nm; i++) {
      const a = t * (.004 + hash(i) * .006) * (i % 2 ? 1 : -1) + hash(i + 3) * TAU, r = 9 + hash(i + 5) * 12, wr = Math.sin(t * .35 + i);
      const mx = Math.cos(a) * r * sx, my = Math.sin(a) * r * sy, ta = a + (i % 2 ? Math.PI / 2 : -Math.PI / 2), ca = Math.cos(ta), sa = Math.sin(ta);
      c.fillStyle = '#f2ead0';
      c.fillRect(mx, my, 1.3, 1.1);
      c.fillRect(mx - ca * 1.2 + wr * .3, my - sa * 1.2, 1.2, 1);
      c.fillStyle = '#4a3a2a';
      c.fillRect(mx + ca * .9, my + sa * .9, .7, .7);
    }
  }
  // ---- dangling stuff underneath ----
  hangers(c, e, s, P, v, t, sx, sy);
  // ---- the mouth ----
  drawMouth(c, e, s, P, v, t, j, tel, cyc, spew);
  // ---- flies ----
  c.fillStyle = '#0a0606';
  for (let i = 0; i < n(6); i++) {
    const a = t * (.05 + hash(i) * .06) * (i % 2 ? 1 : -1) + i * 1.7, R0 = 22 + hash(i + 2) * 14 + Math.sin(t * .3 + i) * 3;
    const fx = Math.cos(a) * R0 + Math.sin(t * .7 + i * 3) * 2, fy = Math.sin(a) * R0 * .8 + Math.cos(t * .9 + i) * 2;
    c.fillRect(fx, fy, 1.2, 1.2);
    if ((t + i) & 2) {
      c.fillStyle = 'rgba(220,230,240,.55)';
      c.fillRect(fx - .6, fy - 1, 1, 1);
      c.fillRect(fx + 1, fy - 1, 1, 1);
      c.fillStyle = '#0a0606';
    }
  }
  c.restore();
}

function drawWound(c, e, s, w, P, t, sc) {
  const age = t - w.t0, op = Math.min(1, age / 12), L = w.L * op, H = L * .45;
  c.save();
  c.translate(w.x, w.y);
  c.rotate(w.a);
  c.fillStyle = '#3a0408';
  c.beginPath();
  c.ellipse(0, 0, L + .8, H + .8, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#9a1420';
  c.beginPath();
  c.ellipse(0, 0, L, H, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#1a0204';
  c.beginPath();
  c.ellipse(0, .2, L * .7, H * .5, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.fat; // the yellow fat layer at the lips of the cut
  c.fillRect(-L * .8, -H, L * 1.6, .7);
  c.fillStyle = 'rgba(255,220,220,.6)';
  c.fillRect(-L * .4, -H * .5, 1, 1);
  if (w.big) { // exposed, rotting: a rib and a nest of maggots
    c.strokeStyle = '#d8d0b0';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-L * .7, 1);
    c.quadraticCurveTo(0, -2.5, L * .7, 1);
    c.stroke();
    c.fillStyle = 'rgba(90,110,40,.6)';
    c.fillRect(-L * .5, 0, L, H * .6);
  }
  // maggots: they find the wound after a second, more in the big one
  const nm = age < 50 ? 0 : n(w.big ? 7 : 2);
  for (let i = 0; i < nm; i++) {
    const u = Math.sin(t * (.03 + i * .007) + i * 2.1), mx = u * L * .7, my = Math.sin(t * .05 + i) * H * .5, wr = Math.sin(t * .4 + i * 1.3);
    c.fillStyle = '#f2ead0';
    c.fillRect(mx, my, 1.4, 1);
    c.fillRect(mx + 1 + wr * .4, my + .4 + wr * .3, 1.2, .9);
    c.fillStyle = '#5a4a3a';
    c.fillRect(mx - .4, my + .1, .6, .7);
  }
  c.restore();
  if (op >= 1 && tick(s, 'wo' + (w.big ? 'B' : w.t0), t, w.big ? 22 : 64, w.t0)) {
    const ca = Math.cos(w.a), sa = Math.sin(w.a);
    add({ x: e.x + w.x - sa * H, y: e.y + w.y + ca * H + 1, vy: .2, vx: 0, g: .1, l: 34, s: 1.3, c: rp(P.blood), k: 4 });
    if (w.big && rnd() < .5) add({ x: e.x + w.x + rb(-3, 3), y: e.y + w.y + 2, vx: rb(-.4, .4), vy: rb(-.6, 0), g: .09, l: 60, s: 1, c: '#f2ead0', k: 3 });
  }
}

function drawMouth(c, e, s, P, v, t, j, tel, cyc, spew) {
  const mw = 6.5 + e.jaw * 3;
  // swollen cracked lips
  c.fillStyle = '#5a1a26';
  c.beginPath();
  c.ellipse(-14, 0, mw + 2.2, j + 2.2, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#8a3440';
  c.beginPath();
  c.ellipse(-14.4, -.4, mw + 1.2, j + 1.2, 0, 0, TAU);
  c.fill();
  // throat, with rings contracting down into it
  c.fillStyle = '#160203';
  c.beginPath();
  c.ellipse(-14, 0, mw, j, 0, 0, TAU);
  c.fill();
  c.save();
  c.beginPath();
  c.ellipse(-14, 0, mw, j, 0, 0, TAU);
  c.clip();
  if (j > 4) {
    c.strokeStyle = '#4a0a10';
    c.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const f = ((t * .03 + k / 3) % 1);
      c.beginPath();
      c.ellipse(-13, 0, mw * (1 - f) * .9, j * (1 - f) * .9, 0, 0, TAU);
      c.stroke();
    }
    // uvula
    c.fillStyle = '#a03040';
    c.beginPath();
    c.ellipse(-13 + Math.sin(t * .2) * .5, -j * .55, 1.2, 2.2, 0, 0, TAU);
    c.fill();
    // an eye at the back of the throat, staring out
    lowEye(c, -13, -j * .1, Math.min(2.2, j * .18), { ang: Math.atan2($.P.y - e.y, $.P.x - e.x + 13), iris: '#c8a020', blink: e.jaw < .5 ? 1 : 0, lid: '#4a0a10' });
  }
  // bile welling up before it heaves
  if (tel > 0 || cyc < 112 && cyc >= 100) {
    const lv = tel > 0 ? tel : 1 - (cyc - 100) / 12;
    c.fillStyle = P.bile[0];
    c.globalAlpha = .9;
    const top = j - j * 2 * lv * .85 + Math.sin(t * .4) * .6;
    c.fillRect(-14 - mw, top, mw * 2, j * 2);
    c.fillStyle = P.bile[2];
    c.fillRect(-14 - mw, top, mw * 2, .8);
    c.fillStyle = P.bile[4];
    for (let k = 0; k < 4; k++) c.fillRect(-17 + hash(k * 7) * 6, top + 1.5 + hash(k) * j, 1.4, 1.2); // chunks
    c.globalAlpha = 1;
  }
  c.restore();
  if (tel > 0) {
    c.globalCompositeOperation = 'lighter';
    glow(-14, 0, 7 + tel * 6, v === 'acid' ? '60,230,180' : '170,190,40', .2 + tel * .35);
    c.globalCompositeOperation = 'source-over';
  }
  // rotten gums, swollen and receding
  for (const side of [-1, 1]) {
    const gx = -14 + side * (mw - .5);
    for (let k = -3; k <= 3; k++) {
      const gy = k * (j / 3.2) * .95;
      c.fillStyle = (k + side) % 3 ? P.gum : P.gumD;
      c.beginPath();
      c.arc(gx, gy, 2 + hash(k + side * 9) * .8, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#2a3a14';
    c.fillRect(gx - .5, -j * .3, 1, 1);
    c.fillRect(gx, j * .5, 1, 1);
  }
  // too many teeth: two crooked rows a side, rotten, some missing
  const nT = 13;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < nT; k++) {
      const hsh = hash(k * 13.1 + row * 7.7);
      if (hsh < .08) continue; // gap
      const y = (k / (nT - 1) - .5) * 2 * j * .92, ln = (row ? 2.2 : 3.6) + hash(k * 3.3 + row) * 2 * (row ? .5 : 1), wd = 1.1 + hash(k + 19) * .8;
      const col = P.tooth[hsh < .2 ? 4 : hsh < .35 ? 3 : hsh < .55 ? 2 : hsh < .75 ? 1 : 0];
      for (const side of [-1, 1]) {
        const bx = -14 + side * (mw - row * 1.6), tip = bx - side * ln, sk = (hash(k * 5 + side) - .5) * 1.4;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(bx, y - wd);
        c.lineTo(tip, y + sk);
        c.lineTo(bx, y + wd);
        c.fill();
        if (hsh > .5 && hsh < .6) { // a brown cavity
          c.fillStyle = '#3a2008';
          c.fillRect(bx - side * ln * .4, y, .8, .8);
        }
      }
    }
  }
  // saliva webs strung across the open mouth, snapping when it gapes
  if (j > 3 && j < 13) {
    const al = (1 - (j - 3) / 10) * .8 * q;
    c.strokeStyle = `rgba(${P.drool},${al})`;
    c.lineWidth = .7;
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const y0 = (k / 3 - .5) * j * 1.3;
      c.moveTo(-14 - mw + 2, y0);
      c.quadraticCurveTo(-14, y0 + 2 + j * .2, -14 + mw - 2, y0 + 1.5);
    }
    c.stroke();
  }
  // the tongue lolls out of the bottom of the mouth, coated and ulcerous
  const loll = 1 + tel * .8, sw = Math.sin(t * .045) * 3 + (tel ? Math.sin(t * .9) * 1.5 : 0);
  const bx = -15, by = j * .7, cx = -24 - sw * .5, cy = j + 4, tx = -25 - sw, ty = j + 9 * loll + 2 * e.jaw;
  c.lineCap = 'round';
  c.strokeStyle = '#4a1018';
  c.lineWidth = 5.6;
  c.beginPath();
  c.moveTo(bx, by);
  c.quadraticCurveTo(cx, cy, tx, ty);
  c.stroke();
  c.strokeStyle = P.tongue;
  c.lineWidth = 4.2;
  c.stroke();
  c.strokeStyle = P.tongueL;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(bx - 1, by - .6);
  c.quadraticCurveTo(cx - 1, cy - 1, tx - .6, ty - 1);
  c.stroke();
  c.fillStyle = 'rgba(240,235,200,.7)'; // thrush coating
  for (let k = 0; k < 5; k++) {
    const u = .2 + k * .16, iu = 1 - u, xx = iu * iu * bx + 2 * iu * u * cx + u * u * tx, yy = iu * iu * by + 2 * iu * u * cy + u * u * ty;
    c.fillRect(xx - 1 + hash(k) * 2, yy - 1, 1.2, 1);
  }
  c.fillStyle = P.pus[0]; // an ulcer
  c.fillRect((bx + cx) / 2 - 1, (by + cy) / 2, 1.6, 1.4);
  // drool strings: from the tongue tip and the lips, stretch, let go, start again
  const DS = [[tx, ty + 1.5, 60, 0], [-19, j + 1.5, 47, 17], [-9, j + 1.5, 53, 31]];
  for (let i = 0; i < DS.length; i++) {
    const [dx, dy, Pp, off] = DS[i], ph = ((t + off) % Pp) / Pp, L = 2 + ph * ph * (v === 'snot' ? 16 : 12) * q;
    c.strokeStyle = `rgba(${P.drool},.75)`;
    c.lineWidth = v === 'snot' ? 1.3 : .9;
    c.beginPath();
    c.moveTo(dx, dy);
    c.lineTo(dx + Math.sin(t * .07 + i) * 1.2, dy + L);
    c.stroke();
    c.fillStyle = `rgba(${P.drool},.95)`;
    c.fillRect(dx - .7 + Math.sin(t * .07 + i) * 1.2, dy + L - .5, 1.6, 1.8);
    if (tick(s, 'dr' + i, t, Pp, off)) add({ x: e.x + dx, y: e.y + dy + L, vy: .5, g: .12, l: 40, s: v === 'snot' ? 1.8 : 1.4, c: `rgb(${P.drool})`, k: 4 });
  }
  // bile dribbling out the corners while it retches
  if (tel > .2 && tick(s, 'bd', t, 3)) add({ x: e.x - 14 + rb(-mw, mw), y: e.y + j, vx: rb(-.6, .1), vy: rb(0, .4), g: .12, l: 26, s: rb(1, 2), c: rp(P.bile), k: rnd() < .5 ? 4 : 1 });
  // the heave: spew a gush of vomit along the shot (the globs are the real bullets; this is just the splash)
  if (spew) {
    const a = Math.atan2($.P.y - e.y, $.P.x - (e.x - 14));
    for (let k = 0; k < n(20); k++) {
      const aa = a + rb(-.55, .55), sp = rb(.9, 2.8);
      add({ x: e.x - 16, y: e.y + rb(-3, 3), vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, g: .06, l: rb(16, 32), s: rb(1, 2.6), c: rp(P.bile), k: rnd() < .45 ? 1 : 0, a: .85 });
    }
    snd(s, 'splat_m', { vol: .35, rate: .7, spread: .1 }, 40);
  }
  // the jet itself: a gush out of the mouth along the aim for ~14 frames, the tail tearing off as it ends
  if (cyc >= 100 && cyc < 114 && q > 0) {
    const k = (cyc - 100) / 14, a = Math.atan2($.P.y - e.y, $.P.x - (e.x - 14)), L = 34 * Math.min(1, k * 3.5), L0 = Math.max(0, k - .45) * 50;
    if (L > L0 + 1) {
      c.save();
      c.translate(-17, 0);
      c.rotate(a);
      const w0 = 2.6 + (1 - k) * 1.5, w1 = 7 + k * 4, wv = (u) => Math.sin(u * .5 + t * .9) * 1.2;
      c.globalAlpha = (.85 - k * .5) * q;
      c.fillStyle = P.bile[1];
      c.beginPath();
      c.moveTo(L0, -w0 - L0 * .1);
      c.quadraticCurveTo((L0 + L) / 2, -w1 * .7 + wv(1), L, -w1 + wv(2));
      c.lineTo(L + 3, wv(3));
      c.lineTo(L, w1 + wv(4));
      c.quadraticCurveTo((L0 + L) / 2, w1 * .7 + wv(5), L0, w0 + L0 * .1);
      c.closePath();
      c.fill();
      c.fillStyle = P.bile[0];
      c.beginPath();
      c.moveTo(L0, -w0 * .55);
      c.quadraticCurveTo((L0 + L) / 2, -w1 * .35, L - 2, wv(6) * .5);
      c.quadraticCurveTo((L0 + L) / 2, w1 * .35, L0, w0 * .55);
      c.closePath();
      c.fill();
      c.fillStyle = P.bile[2];
      c.fillRect(L0, -.6, (L - L0) * .6, 1.2);
      for (let i = 0; i < 8; i++) { // chunks
        const u = L0 + hash(i * 3.3) * (L - L0), vv = (hash(i * 7.1) - .5) * w1 * 1.2 * (u / Math.max(1, L));
        c.fillStyle = P.bile[3 + (i % 3)];
        c.fillRect(u, vv, 1.6, 1.4);
      }
      c.restore();
      c.globalAlpha = 1;
    }
  }
}

/** strands hanging off the underside: acid melts, snot ropes, peeled skin. [x, len, period, off, width] */
function hangers(c, e, s, P, v, t, sx, sy) {
  const H = v === 'acid' ? [[-8, 8, 70, 0, 2.2], [-1, 11, 90, 20, 2.6], [6, 7, 64, 41, 2], [12, 10, 80, 13, 2.4], [17, 6, 58, 30, 1.8], [-13, 6, 75, 52, 1.8]]
    : v === 'snot' ? [[-7, 16, 120, 0, 1.8], [2, 22, 150, 40, 2.2], [10, 14, 110, 80, 1.6], [16, 10, 90, 25, 1.4]]
    : [[-3, 7, 0, 0, 3.2], [9, 9, 0, 0, 3.6], [15, 6, 0, 0, 2.6]];
  for (let i = 0; i < H.length * q; i++) {
    const [x0, ln, Pp, off, w] = H[i], x = x0 * sx, y = Math.sqrt(Math.max(0, 23.5 * 23.5 - x0 * x0)) * sy - 1.2;
    const sw = Math.sin(t * .05 + i * 1.7) * (v === 'snot' ? 3 : 1.5);
    if (v === 'orbit') { // flaps of necrotic skin peeling off and hanging
      c.fillStyle = '#3a1210';
      c.beginPath();
      c.moveTo(x - w, y - 1);
      c.lineTo(x + w, y - 1);
      c.lineTo(x + w * .6 + sw, y + ln);
      c.lineTo(x - w * .3 + sw * 1.2, y + ln + 1.5);
      c.closePath();
      c.fill();
      c.fillStyle = i % 2 ? '#b8a07e' : '#a89a78';
      c.beginPath();
      c.moveTo(x - w + .6, y - 1);
      c.lineTo(x + w - .6, y - 1);
      c.lineTo(x + w * .5 + sw, y + ln - .8);
      c.lineTo(x - w * .2 + sw * 1.2, y + ln);
      c.closePath();
      c.fill();
      c.fillStyle = '#8a1a22';
      c.fillRect(x - w + .8, y - 1, w * 2 - 1.6, 1.2);
      continue;
    }
    const ph = ((t + off) % Pp) / Pp, L = ln * (.35 + .65 * ph * ph);
    c.strokeStyle = v === 'acid' ? (i % 2 ? '#8a6a52' : '#4ab89a') : (i % 2 ? '#c8c040' : '#a8b028');
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + sw * .4, y + L * .5, x + sw, y + L);
    c.stroke();
    c.fillStyle = v === 'acid' ? '#6ff0d4' : '#e8e070';
    c.beginPath();
    c.arc(x + sw, y + L, w * .75 + ph * .8, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,255,230,.7)';
    c.fillRect(x + sw - .5, y + L - w * .5, .8, .8);
    if (tick(s, 'hg' + i, t, Pp, off)) add({ x: e.x + x + sw, y: e.y + y + L, vy: .4, g: .1, l: 40, s: w, c: v === 'acid' ? '#6ff0d4' : '#d8d040', k: 4 });
  }
  // acid fizz: little bubbles boiling up and popping on the skin
  if (v === 'acid') {
    c.strokeStyle = 'rgba(160,255,220,.8)';
    c.lineWidth = .6;
    for (let i = 0; i < 7 * q; i++) {
      const Pp = 24 + ((i * 7) % 13), ph = ((t + i * 11) % Pp) / Pp, a = hash(i * 9.1 + Math.floor((t + i * 11) / Pp)) * TAU, r = 10 + hash(i + 4) * 12;
      c.beginPath();
      c.arc(Math.cos(a) * r * sx, Math.sin(a) * r * sy, .5 + ph * 1.4, 0, TAU);
      c.stroke();
    }
  }
}

// ---------------- particles + death rupture, ticked once per render (call after the enemies are drawn) ----------------
export function drawMawFx() {
  const c = ctx;
  if (GROSS <= 0) return;
  if (lastG !== $.G) { // new run: drop everything
    lastG = $.G;
    PT.length = 0;
    RUP.length = 0;
    live.clear();
    lastT = $.T;
  }
  const dt = Math.max(0, Math.min(4, $.T - lastT));
  lastT = $.T;
  // catch kills: a Maw that went dead on screen (an escape leaves off the right edge)
  for (const e of live) {
    if (!e.dead) continue;
    live.delete(e);
    const s = ST.get(e);
    if (s && e.x < W + 40 && e.hp <= 0) rupture(e, s);
  }
  for (const r of RUP) r.f += dt;
  for (let i = RUP.length - 1; i >= 0; i--) if (RUP[i].f > 100) RUP.splice(i, 1);
  for (const r of RUP) drawRupture(c, r);
  // particles
  const sc = $.G && $.G.scroll || 0;
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i];
    if (dt) {
      p.l -= dt;
      if (p.l <= 0) { PT[i] = PT[PT.length - 1]; PT.pop(); continue; }
      if (!p.st) {
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.k === 2) { p.vx *= .97; p.vy *= .97; p.s += .12 * dt; }
        if (p.k !== 2 && p.k !== 8 && p.vy > 0 && p.y > floorAt(p.x + sc) - 1) { p.st = 1; p.y = floorAt(p.x + sc) - 1; } // splat on the floor
      }
    }
    const f = p.l / p.m;
    c.globalAlpha = p.a * Math.min(1, f * 2.5);
    switch (p.k) {
      case 2: glow(p.x, p.y, p.s * 2.2, p.c, p.a * Math.min(1, f * 1.6)); break;
      case 1: c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.st ? p.s * .6 : p.s * .7, 0, TAU); c.fill(); if (p.st) c.fillRect(p.x - p.s, p.y, p.s * 2, .8); break;
      case 3: { const w = Math.sin(($.T + i) * .5); c.fillStyle = '#f2ead0'; c.fillRect(p.x, p.y, 1.4, 1); c.fillRect(p.x + 1 + w * .4, p.y + .3, 1.2, .9); c.fillStyle = '#4a3a2a'; c.fillRect(p.x - .4, p.y, .6, .7); if (p.st && dt) p.x += w * .15 * dt; break; }
      case 4: c.fillStyle = p.c; c.fillRect(p.x - p.s * .4, p.y - (p.st ? 0 : Math.min(4, p.vy * 1.5)), p.s * .8, p.st ? .8 : p.s + Math.min(4, p.vy * 1.5)); break;
      case 5: lowEye(c, p.x, p.y, p.s, { ang: p.l * .2, iris: '#b01018' }); break;
      case 6: c.fillStyle = p.c; c.fillRect(p.x, p.y, 1, 2); break;
      case 7: c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.l * .1); c.fillRect(-p.s, -p.s * .4, p.s * 2, p.s * .8); c.restore(); break;
      case 8: c.strokeStyle = p.c; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, p.s * (1.4 - f), 0, TAU); c.stroke(); break;
      default: c.fillStyle = p.c; if (p.st) c.fillRect(p.x - p.s * .7, p.y, p.s * 1.4, .9); else c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
  }
  c.globalAlpha = 1;
}

function rupture(e, s) {
  const v = s.v, P = PAL[v], x = e.x, y = e.y;
  RUP.push({ x, y, f: 0, v });
  const m = GROSS;
  for (let i = 0; i < Math.round(70 * m); i++) {
    const a = rb(0, TAU), sp = rb(.5, 4.2);
    add({ x: x + Math.cos(a) * rb(0, 14), y: y + Math.sin(a) * rb(0, 14), vx: Math.cos(a) * sp - .3, vy: Math.sin(a) * sp - 1.2, g: .11, l: rb(40, 90), s: rb(1.2, 3.4), c: rp(rnd() < .5 ? P.bile : rnd() < .5 ? P.blood : P.pus), k: rnd() < .5 ? 1 : 0 }, true);
  }
  for (let i = 0; i < Math.round(14 * m); i++) add({ x: x + rb(-10, 10), y: y + rb(-10, 10), vx: rb(-2, 2), vy: rb(-3, 0), g: .1, l: rb(60, 110), s: 1, c: '#f2ead0', k: 3 }, true); // maggots
  for (let i = 0; i < Math.round(12 * m); i++) add({ x: x - 14 + rb(-4, 4), y: y + rb(-8, 8), vx: rb(-3, 1), vy: rb(-3, 1), g: .12, l: rb(50, 80), s: 1, c: rp(P.tooth), k: 6 }, true); // teeth
  for (let i = 0; i < Math.round(4 * m); i++) add({ x: x + rb(-12, 6), y: y + rb(-12, 12), vx: rb(-2.5, 1.5), vy: rb(-3.5, -.5), g: .12, l: rb(60, 90), s: rb(1.5, 2.4), c: '#fff', k: 5 }, true); // eyeballs
  for (let i = 0; i < Math.round(8 * m); i++) add({ x: x + rb(-14, 14), y: y + rb(-14, 14), vx: rb(-2, 2), vy: rb(-2.5, .5), g: .1, l: rb(50, 80), s: rb(2, 3.5), c: rp(['#e6c2a8', '#c97862', '#a89a78', '#8a3a2e']), k: 7 }, true); // peeled skin
  for (let i = 0; i < Math.round(10 * m); i++) add({ x: x + rb(-10, 10), y: y + rb(-10, 10), vx: rb(-.6, .9), vy: rb(-.6, .2), g: -.004, l: rb(80, 130), s: rb(4, 7), c: P.gas, k: 2, a: rb(.3, .45) }, true); // the stink
  add({ x, y, l: 14, m: 14, s: 34, c: P.pus[1], k: 8, g: 0 }, true);
  if ($.state === 'play') {
    try {
      sample('splat_l', { vol: .9, rate: .8 });
      sample('fart_ok', { vol: .75, rate: .6, spread: .05, at: .25 }); // the empty skin deflating
    } catch (err) {}
  }
}

function drawRupture(c, r) {
  const P = PAL[r.v], f = r.f, T = bodyTex(r.v);
  // full-screen bile tint: only with flashes on
  if (f < 7 && SET.flashes) {
    c.fillStyle = `rgba(${P.gas},${.13 * (1 - f / 7) * q})`;
    c.fillRect(0, 0, W, 300);
  }
  // the sludge wave bursting out
  if (f < 26) {
    const k = f / 26, R0 = 20 + k * 46;
    c.globalAlpha = (1 - k) * .85;
    c.fillStyle = P.bile[0];
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * TAU, rr = R0 * (.7 + hash(i * 3.7) * .5);
      i ? c.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr + k * k * 10) : c.moveTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr + k * k * 10);
    }
    c.closePath();
    c.fill();
    c.fillStyle = P.blood[0];
    c.beginPath();
    c.arc(r.x, r.y + k * 6, R0 * .45, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }
  // the empty skin: flattened, sagging, falling, still twitching
  if (f < 90) {
    const k = f / 90, fy = r.y + f * f * .012, al = 1 - Math.max(0, (f - 50) / 40);
    c.save();
    c.globalAlpha = al;
    c.translate(r.x + Math.sin(f * .6) * (1 - k) * 2, fy);
    c.scale(1.35 + k * .2, .32 - k * .1 + Math.sin(f * .5) * .04 * (1 - k));
    c.drawImage(T.cv, -36, -36);
    c.restore();
    c.globalAlpha = al;
    c.strokeStyle = `rgba(${P.drool},.8)`; // strings of slime hanging off it
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const xx = r.x - 24 + i * 12, yy = fy + 5;
      c.moveTo(xx, yy);
      c.lineTo(xx + Math.sin(f * .1 + i), yy + 4 + (f * .25 + i * 3) % 14);
    }
    c.stroke();
    c.globalAlpha = 1;
  }
}

/** for debugging / probes */
(globalThis as any).__mawFx = () => ({ pt: PT.length, rup: RUP.length, live: live.size });
