// @ts-nocheck
// =====================================================================
//  THE ANAL PROBE, the Open Orbit midboss: a wrecked saucer gone to meat under a skin of tentacles.
//  Render-only. Gameplay (HP, attacks, hitboxes, timing) is enemies/ufo.ts; everything here reads entity fields
//  (e.t, e.st, e.wt, e.la, e.ll, e.burst, e.hp) and never calls the gameplay RNG (core R / rr / pick).
//
//  Base art: The_Scientist___'s CC0 "Infested UFO Boss" (three damage sheets, 17 frames each), repainted by
//  tools/prep_midboss.py (meat-red tentacles, pus/bile hull, cataract dome) into src/sprites/ufo1..3@17.png. On top of
//  that, code-drawn grime: hanging tentacles that drip, pulsing veins, cracks in the hull with meat showing through,
//  tumours that swell and burst, wet specular glints, a puckered belly hatch, a drowned pilot sloshing in the dome.
//  Its own particles and the death (hull bursts in two, a flood of tentacles) live in a private list ticked by
//  drawUfoFx(), called once per render after the enemies.
// =====================================================================
import { $ } from '../../state';
import { TAU, W, ctx, hash } from '../../core';
import { floorAt } from '../../world';
import { SET } from '../../save';
import { sample } from '../../audio';
import { drawSkull, glow } from '../util';
import { eye, lowEye } from '../eyes';
import { spr, sprAt, sprReady } from '../../sprites';
import { HATCH_O, LASH_O, TUMOURS } from '../../enemies/ufo';

/** how gross: 0 = the repainted sprite and its attacks only, 1 = everything, >1 = more particles / drips / tentacles */
export const GROSS = 1;
const q = Math.min(1, GROSS);
const n = (k) => Math.max(0, Math.round(k * GROSS));

// ---------------- render-only RNG (xorshift32; NEVER core R / rr / pick) ----------------
let rs = 0x51d0f00d;
const rnd = () => ((rs ^= rs << 13), (rs ^= rs >>> 17), (rs ^= rs << 5), (rs >>> 0) / 4294967296);
const rb = (a, b) => a + rnd() * (b - a);
const rp = (a) => a[(rnd() * a.length) | 0];

// ---------------- palette ----------------
const MEAT = { dark: '#1c0507', mid: '#6e1218', lite: '#b8404a', fat: '#d89a88', suck: '#e0b0a0' };
const PUS = ['#d8c050', '#f0e490', '#a89a30', '#8a9a2a'];
const BLOOD = ['#7a0a10', '#4a0306', '#b01a22'];
const BILE = ['#9aa02a', '#6a7414', '#c8b840', '#4a5010'];

// ---------------- geometry (local px; the sprite is 120x31 centred on the entity) ----------------
const RIM = (x) => 4.6 + 9.6 * Math.sqrt(Math.max(0, 1 - (x / 58) ** 2)); // the underside rim's y at x
const EYE = [-.7, 4.7, 5.8]; // the orb in the art
const DOME = [3.4, -10.4];
const HANG = [[-46, 1.1, 18, .2], [-20, 1.5, 24, 1.9], [12, 1.4, 22, 3.7], [38, 1.1, 17, 5.3]]; // [x, width, length, phase]; LASH_O is its own
const DRIPS = [-50, -38, -27, -8, 6, 24, 34, 47];
const GLINT = [[-44, -1], [-30, -4], [-14, -6], [-6, 9], [18, -7], [24, 3], [40, -2], [50, 2], [8, -14], [-52, 3]];
const LUMPS = [[-50, 0, 2], [-12, 2, 2.2], [44, -3, 2.4], [18, 6, 1.8]]; // decorative tumours (the attack ones are TUMOURS)
// hull cracks: [x0, y0, x1, y1, show below hp fraction]; jagged in between, meat in the seam
const CRACKS = [[-40, -2, -26, 8, .85], [20, -6, 34, 6, .7], [-10, -7, 2, 6, .55], [36, -4, 52, 3, .42], [-54, 1, -42, 6, .3], [6, 2, 22, 11, .18]];

// ---------------- prebuilt layers ----------------
const LAY = {};
const hn = (i, j = 0) => hash(i * 7.31 + j * 29.3 + 5);
function layer(k, w, h, f) {
  if (LAY[k]) return LAY[k];
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  f(cv.getContext('2d'), w, h);
  return (LAY[k] = cv);
}
/** veins over the hull: dark, branching, clipped to the saucer */
const veins = () => layer('veins', 124, 36, (x) => {
  x.translate(62, 18);
  x.beginPath();
  x.ellipse(0, 4.5, 57, 9.6, 0, 0, TAU);
  x.ellipse(3, -9, 10, 6, 0, 0, TAU);
  x.clip();
  x.lineCap = 'round';
  const br = (px, py, a, w, k, d) => {
    for (let i = 0; i < k; i++) {
      const nx = px + Math.cos(a) * 3, ny = py + Math.sin(a) * 1.6;
      x.strokeStyle = d ? '#5a0c22' : '#2e0414';
      x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      px = nx; py = ny; a += (hn(px, py) - .5) * 1.1; w *= .88;
      if (d < 2 && hn(py, px) < .25) br(px, py, a + (hn(i, d) < .5 ? .9 : -.9), w * .8, k - i - 1, d + 1);
    }
  };
  for (let i = 0; i < 9; i++) { const sx = -54 + i * 13.5, a = (i % 2 ? .2 : Math.PI - .2) + (hn(i, 4) - .5); br(sx, 4 + (hn(i, 3) - .5) * 8, a, 1.4, 8, 0); }
  // hot cores: the ones that light up when it's about to do something
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(160,20,40,.35)';
  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(-54 + hn(i, 8) * 108, -2 + hn(i, 9) * 12, 1.2 + hn(i, 7) * 1.6, 0, TAU); x.fill(); }
});
/** a crack's jagged polyline (stable) */
const crackPts = (i) => {
  const [x0, y0, x1, y1] = CRACKS[i], k = 6, p = [];
  for (let j = 0; j <= k; j++) { const f = j / k; p.push([x0 + (x1 - x0) * f + (j && j < k ? (hn(i, j) - .5) * 3 : 0), y0 + (y1 - y0) * f + (j && j < k ? (hn(j, i) - .5) * 3.4 : 0)]); }
  return p;
};
const CP = CRACKS.map((_, i) => crackPts(i));

// ---------------- per-entity render state + private particles ----------------
const ST = new WeakMap();
const live = new Set();
function st(e) {
  let s = ST.get(e);
  if (!s) ST.set(e, (s = { hp: e.hp, st: e.st, burst: e.burst || 0, crater: [-999, -999, -999], dropT: -1, sc: {}, y: e.y, vy: 0, sndT: -99, drop: 0 }));
  return s;
}
const PT = [];
const CAP = 220;
function add(o, force = false) {
  if (GROSS <= 0 || PT.length >= (force ? CAP + 160 : CAP * q)) return;
  PT.push(Object.assign({ vx: 0, vy: 0, g: .1, l: 50, m: 50, s: 1, k: 0, c: '#fff', a: 1, ph: rnd() * TAU }, o));
}
const snd = (s, cat, o, gap = 18) => {
  if (GROSS <= 0 || $.state !== 'play' || $.T - s.sndT < gap) return;
  s.sndT = $.T;
  try { sample(cat, { ...o, vol: (o.vol || 1) * q }); } catch (err) {}
};
/** true once each time floor((t+off)/P) ticks over */
function tick(s, key, t, P, off = 0) {
  const k = Math.floor((t + off) / P), o = s.sc[key];
  s.sc[key] = k;
  return o !== undefined && k !== o;
}

// ---------------- tentacles ----------------
/** points of a tentacle from (x0,y0) heading a0, length L; it writhes (amp, phase) more toward the tip */
function tpts(x0, y0, a0, L, amp, ph, t, k = 10, sag = 0) {
  const p = [[x0, y0]];
  let x = x0, y = y0;
  for (let i = 1; i <= k; i++) {
    const f = i / k, a = a0 + Math.sin(t * .07 + ph - f * 3.2) * amp * f;
    x += Math.cos(a) * L / k;
    y += Math.sin(a) * L / k + sag * f;
    p.push([x, y]);
  }
  return p;
}
/** a tapered, outlined, wet tentacle along pts; suckers on one side */
function tentacle(c, p, w0, w1, hot = 0) {
  const L = [], Rt = [], m = p.length;
  for (let i = 0; i < m; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(m - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1, w = w0 + (w1 - w0) * (i / (m - 1));
    dx /= d; dy /= d;
    L.push([p[i][0] - dy * w, p[i][1] + dx * w]);
    Rt.push([p[i][0] + dy * w, p[i][1] - dx * w]);
  }
  c.beginPath();
  c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < m; i++) c.lineTo(L[i][0], L[i][1]);
  for (let i = m - 1; i >= 0; i--) c.lineTo(Rt[i][0], Rt[i][1]);
  c.closePath();
  c.strokeStyle = MEAT.dark;
  c.lineWidth = 1.3;
  c.stroke();
  c.fillStyle = hot ? `rgb(${110 + 80 * hot | 0},${18 + 10 * hot | 0},${24 + 6 * hot | 0})` : MEAT.mid;
  c.fill();
  // wet top-line
  c.strokeStyle = hot ? 'rgba(255,170,150,.8)' : 'rgba(210,110,110,.55)';
  c.lineWidth = .5;
  c.beginPath();
  for (let i = 0; i < m - 1; i++) { const x = (L[i][0] + p[i][0]) / 2, y = (L[i][1] + p[i][1]) / 2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  // pale suckers down the other side
  if (GROSS > 0) {
    c.fillStyle = MEAT.suck;
    for (let i = 1; i < m - 1; i += 2) { const x = (Rt[i][0] * 2 + p[i][0]) / 3, y = (Rt[i][1] * 2 + p[i][1]) / 3, r = Math.max(.35, (w0 + (w1 - w0) * (i / (m - 1))) * .38); c.fillRect(x - r * .5, y - r * .5, r, r); }
  }
  return p[m - 1];
}

// ---------------- the boss ----------------
export function drawUfoGross(c, e) {
  const s = st(e), t = e.t, hpf = Math.max(0, e.hp / e.max);
  live.add(e);
  const el = t - (s.t ?? t), dt = Math.max(0, Math.min(4, el));
  s.t = t;
  s.vy = el > 0 && el < 8 ? (e.y - s.y) / el : 0; // (a skipped stretch of frames isn't a lurch)
  s.y = e.y;
  s.x = e.x;
  const ev = s.st !== e.st ? s.st + '>' + e.st : '';
  s.st = e.st;
  const tel = e.st === 'lash' ? Math.min(1, e.wt / (e.lash2 ? 28 : 42)) : 0,
    sw = e.st === 'swell' ? Math.min(1, e.wt / 36) : 0,
    br = e.st === 'brood' ? Math.min(1, e.wt / 40) : e.st === 'idle' && s.drop ? Math.max(0, 1 - e.wt / 16) : 0;
  // ---- hits: squirts from the hull ----
  const dmg = s.hp - e.hp;
  if (dmg > 0) {
    for (let i = 0; i < n(Math.min(4, 1 + dmg * 2)); i++) {
      const x = rb(-50, 30), y = RIM(x) - rb(2, 10);
      add({ x: e.x + x, y: e.y + y, vx: rb(-2, -.3), vy: rb(-1.6, .4), g: .12, l: rb(16, 28), s: rb(.9, 1.8), c: rnd() < .5 ? rp(BLOOD) : rp(PUS), k: rnd() < .3 ? 4 : 0 });
    }
  }
  s.hp = e.hp;
  // ---- state edges: sounds, bursts, the litter ----
  if (ev === 'idle>swell') snd(s, 'gross_slosh', { vol: .5, wet: .35, spread: .18 });
  if (ev === 'idle>brood') snd(s, 'gross_gargle', { vol: .5, wet: .4, spread: .2 });
  if ((e.burst || 0) !== s.burst) {
    s.burst = e.burst || 0;
    for (let i = 0; i < TUMOURS.length; i++) {
      const [tx, ty] = TUMOURS[i];
      s.crater[i] = t;
      for (let k = 0; k < n(10); k++) { const a = rb(-Math.PI, 0), v = rb(.5, 2.4); add({ x: e.x + tx, y: e.y + ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .1, l: rb(30, 60), s: rb(1, 2), c: rp(PUS), k: rnd() < .4 ? 1 : 0 }); }
    }
    snd(s, 'gross_pop', { vol: .8, wet: .25, spread: .2 }, 4);
  }
  if (e.st === 'brood' && e.wt >= 40 && !s.drop) {
    s.drop = 1;
    for (let k = 0; k < n(18); k++) add({ x: e.x + HATCH_O[0], y: e.y + HATCH_O[1] + 2, vx: rb(-1.4, 1.4), vy: rb(.2, 2.2), g: .12, l: rb(40, 70), s: rb(1, 2.2), c: rnd() < .5 ? rp(BLOOD) : rp(BILE), k: rnd() < .3 ? 1 : 0 });
    snd(s, 'gross_gush', { vol: .7, wet: .3, spread: .15 }, 4);
  }
  if (e.st !== 'brood' && e.st !== 'idle') s.drop = 0;
  if (e.st === 'idle' && e.wt > 16) s.drop = 0;

  // ---- behind the hull: hanging tentacles, dripping ----
  const limp = 1 + (1 - hpf) * .6;
  for (let i = 0; i < HANG.length; i++) {
    const [hx, w, L, ph] = HANG[i];
    const tip = tentacle(c, tpts(hx, RIM(hx) - 2, Math.PI / 2 - s.vy * .25 + Math.sin(t * .02 + ph) * .25, L * limp, .55 + br * .4, ph, t * (1 + br), 9, .3), w * 1.9, .35);
    if (GROSS > 0) strand(c, s, e, i, tip[0], tip[1], 4 + 2 * (i % 2), .8, 'rgba(200,180,70,.85)', 70 + i * 17, PUS[1]);
  }
  // the lash tentacle: coiled under the front behind the hull; over it while it rears back and whips
  if (e.st !== 'lash' && e.st !== 'whip') lashT(c, e, t, tel, limp);
  // the lash's line: dashed, red, firming up as it locks
  if (e.st === 'lash') {
    const lock = e.wt >= (e.lash2 ? 12 : 26);
    c.save();
    c.setLineDash(lock ? [4, 2] : [2, 4]);
    c.lineDashOffset = -$.T;
    c.strokeStyle = `rgba(255,${lock ? 40 : 90},${lock ? 30 : 60},${.25 + .6 * tel})`;
    c.lineWidth = lock ? 1.4 : 1;
    c.beginPath();
    c.moveTo(LASH_O[0], LASH_O[1]);
    c.lineTo(LASH_O[0] + Math.cos(e.la) * 238, LASH_O[1] + Math.sin(e.la) * 238);
    c.stroke();
    c.restore();
  }

  // ---- the hull (tilted with the bob) ----
  const rot = -.05 + Math.sin(t * .011) * .035 + Math.max(-.12, Math.min(.12, s.vy * .06)) + (e.gone ? .08 : 0);
  const breathe = 1 + Math.sin(t * .09) * .012 * q + sw * .03;
  c.save();
  c.rotate(rot);
  c.scale(1 + (breathe - 1) * .5, breathe);
  const sheet = hpf > .66 ? 'ufo1' : hpf > .33 ? 'ufo2' : 'ufo3';
  if (!spr(c, sheet, sprAt(t, 9 + tel * 8), 0, 0)) fallbackHull(c, t);
  if (GROSS > 0) grime(c, s, e, t, hpf, tel, sw, br);
  // the eye: yellowed, bloodshot, tracking you; bulges when it's about to burst its tumours
  const la = Math.atan2($.P.y - e.y - EYE[1], $.P.x - e.x - EYE[0]); // eye() draws in screen space: a world angle
  c.fillStyle = '#2a0408';
  c.beginPath();
  c.arc(EYE[0], EYE[1], EYE[2] + .9, 0, TAU);
  c.fill();
  eye(c, EYE[0], EYE[1], EYE[2] * (1 + sw * .15 + (hpf < .33 ? Math.sin(t * .9) * .03 : 0)), { ang: tel ? e.la : la, iris: '#b8a830', bs: 3, blink: !tel && !sw && t % 190 < 6 ? 1 : 0, lid: '#4a0a10', jig: hpf < .33 ? 1 : 0 });
  if (GROSS > 0) { // a pus tear under it
    const wp = (Math.sin(t * .05) + 1) * .5;
    c.fillStyle = 'rgba(216,192,80,.95)';
    c.beginPath();
    c.moveTo(EYE[0] - 4, EYE[1] + 3.5);
    c.quadraticCurveTo(EYE[0] - 5, EYE[1] + 7, EYE[0] - 5.4, EYE[1] + 9 + wp * 2);
    c.lineTo(EYE[0] - 3.6, EYE[1] + 9 + wp * 2);
    c.quadraticCurveTo(EYE[0] - 3.4, EYE[1] + 6, EYE[0] - 2.4, EYE[1] + 4.5);
    c.fill();
  }
  c.restore();
  if (e.st === 'lash' || e.st === 'whip') lashT(c, e, t, tel, limp);
  // drips off the rim (unrotated is close enough at this tilt)
  if (GROSS > 0) for (let i = 0; i < DRIPS.length; i++) { const x = DRIPS[i]; strand(c, s, e, 20 + i, x, RIM(x) - 1, 4 + (i % 3) * 2, .9, i % 3 ? 'rgba(200,180,70,.85)' : 'rgba(120,10,16,.9)', 60 + i * 13, i % 3 ? PUS[1] : BLOOD[2]); }
  // ambient: specks of pus and blood shaking off it, a stink
  if (GROSS > 0 && dt) {
    if (rnd() < .12 * dt * q) add({ x: e.x + rb(-50, 50), y: e.y + rb(4, 12), vx: rb(-.3, .3), vy: rb(.2, .6), g: .08, l: 60, s: rb(.8, 1.4), c: rnd() < .6 ? rp(PUS) : rp(BLOOD), k: 4 });
    if (rnd() < .025 * dt * q) add({ x: e.x + rb(-40, 40), y: e.y + rb(-8, 8), vx: rb(-.3, .1), vy: rb(-.5, -.1), g: -.002, l: rb(70, 110), s: rb(3, 5), c: '120,130,40', k: 2, a: rb(.18, .3) });
  }
  // telegraph glows
  if (sw || br) {
    c.globalCompositeOperation = 'lighter';
    if (sw) for (const [tx, ty] of TUMOURS) glow(tx, ty, 5 + sw * 7, '230,210,80', .2 + .5 * sw * ((($.T >> 2) & 1) ? 1 : .7)); // glow() draws on the current (entity-local) transform
    if (br) glow(HATCH_O[0], HATCH_O[1] + 1, 6 + br * 8, '255,70,60', .25 + .45 * br);
    c.globalCompositeOperation = 'source-over';
  }
}

/** the lash tentacle (local coords): coiled at rest, rearing back on the telegraph, whipping out along e.la */
function lashT(c, e, t, tel, limp) {
  {
    const [lx, ly] = LASH_O;
    if (e.st === 'whip' && e.ll > 20) {
      const ext = Math.min(1, (e.ll - 18) / 220);
      const tip = tentacle(c, tpts(lx, ly, e.la, e.ll, .05 * (1 - ext) + .02, 0, t * 3, 20), 4.2, 1.3, 1 - ext * .6);
      c.globalCompositeOperation = 'lighter';
      glow(tip[0], tip[1], 7, '255,90,60', .5);
      c.globalCompositeOperation = 'source-over';
    } else {
      const a = tel ? e.la + Math.PI * .85 + Math.sin(t * .6) * .35 : Math.PI * .62 + Math.sin(t * .03) * .2;
      const tip = tentacle(c, tpts(lx, ly, a, (tel ? 24 : 20) * limp, tel ? 1.2 : .7, 1.3, t * (1 + tel * 3), 12, tel ? 0 : .2), tel ? 3.6 : 2.8, .6, tel);
      if (tel) {
        c.globalCompositeOperation = 'lighter';
        glow(tip[0], tip[1], 4 + tel * 6, '255,60,40', .3 + .5 * tel * ((($.T >> 2) & 1) ? 1 : .6));
        c.globalCompositeOperation = 'source-over';
      }
    }
  }
}

/** the grime on the hull, in the hull's (rotated) frame */
function grime(c, s, e, t, hpf, tel, sw, br) {
  // veins, pulsing; hot when it's about to act
  const hot = Math.max(tel, sw, br);
  c.globalAlpha = (.42 + .2 * Math.sin(t * (.08 + hot * .2))) * q;
  c.drawImage(veins(), -62, -18);
  if (hot) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = hot * .45; c.drawImage(veins(), -62, -18); c.globalCompositeOperation = 'source-over'; }
  c.globalAlpha = 1;
  // cracks in the hull, more of them as it dies: black split, raw meat in the seam, beads of pus
  for (let i = 0; i < CRACKS.length; i++) {
    const show = CRACKS[i][4];
    if (hpf > show) continue;
    const p = CP[i], open = Math.min(1, (show - hpf) * 6);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    p.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = '#0a0203';
    c.lineWidth = 1.4 + open * 1.6;
    c.stroke();
    c.strokeStyle = MEAT.lite;
    c.lineWidth = .5 + open * 1.1;
    c.stroke();
    c.strokeStyle = `rgba(255,190,170,${.35 + .3 * Math.sin(t * .1 + i)})`; // it glistens
    c.lineWidth = .35;
    c.stroke();
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    const [bx, by] = p[3];
    c.fillStyle = PUS[0];
    c.beginPath();
    c.arc(bx, by + .8, .7 + open * .5, 0, TAU);
    c.fill();
    if (open > .5) strand(c, s, e, 40 + i, p[p.length - 1][0], p[p.length - 1][1], 4, .8, 'rgba(150,20,26,.9)', 55 + i * 9, BLOOD[2]);
  }
  // tumours: the attack three swell and glow, burst into craters, and grow back
  for (let i = 0; i < TUMOURS.length; i++) {
    const [x, y] = TUMOURS[i], since = t - s.crater[i];
    if (since < 220) { // a burst crater, weeping, slowly closing
      const k = Math.min(1, since / 220);
      c.fillStyle = '#1a0204';
      c.beginPath();
      c.ellipse(x, y, 3.4 - k, 2.4 - k * .6, 0, 0, TAU);
      c.fill();
      c.strokeStyle = MEAT.lite;
      c.lineWidth = .7;
      c.stroke();
      c.fillStyle = PUS[0];
      c.beginPath();
      c.ellipse(x, y + .6, 1.8 - k, .9, 0, 0, Math.PI);
      c.fill();
      // ragged skin flaps
      c.fillStyle = '#8a6a3a';
      c.fillRect(x - 3.6, y - 1.6, 1.2, .8);
      c.fillRect(x + 2.4, y - 1.2, 1, .9);
      if (since < 120) strand(c, s, e, 60 + i, x, y + 1.4, 5, .9, 'rgba(216,192,80,.9)', 34, PUS[1]);
      continue;
    }
    const r = (1.8 + sw * 2.8 + Math.sin(t * .07 + i * 2) * .25) * (since < 400 ? Math.min(1, (since - 220) / 180) : 1);
    if (r < .3) continue;
    c.fillStyle = '#3a0c0a';
    c.beginPath();
    c.arc(x, y + .3, r + .7, 0, TAU);
    c.fill();
    const g = c.createRadialGradient(x - r * .35, y - r * .4, .2, x, y, r);
    g.addColorStop(0, sw > .5 ? '#fff6b0' : '#f0e490');
    g.addColorStop(.55, sw > .3 ? '#e0c040' : '#c0a040');
    g.addColorStop(1, '#6a3a14');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(120,10,30,.8)'; // veins stretched over it
    c.lineWidth = .35;
    c.beginPath();
    c.moveTo(x - r * .8, y + r * .2); c.lineTo(x - r * .1, y - r * .3); c.lineTo(x + r * .5, y - r * .7);
    c.moveTo(x + r * .7, y + r * .3); c.lineTo(x + r * .1, y);
    c.stroke();
    c.fillStyle = 'rgba(255,255,235,.9)';
    c.fillRect(x - r * .5, y - r * .6, Math.max(.6, r * .3), Math.max(.6, r * .3));
  }
  for (let i = 0; i < LUMPS.length; i++) { const [x, y, r] = LUMPS[i]; bubble(c, s, e, 80 + i, x, y, r, 70 + i * 23, 'rgba(200,180,70,.8)', 'rgba(240,225,140,.95)', PUS[0], 4); }
  // the belly hatch: a puckered, wet sphincter that dilates before the litter drops out
  {
    const [hx, hy] = HATCH_O, o = br, pu = Math.sin(t * .13) * .3 * (1 - o);
    c.fillStyle = '#2a0608';
    c.beginPath();
    c.ellipse(hx, hy, 5.4 + o * 3, 2.8 + o * 3.4, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#a8505a';
    c.lineWidth = .6;
    c.beginPath();
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; c.moveTo(hx + Math.cos(a) * (1 + o * 2.6), hy + Math.sin(a) * (.6 + o * 2.4)); c.lineTo(hx + Math.cos(a) * (5 + o * 2.8 + pu), hy + Math.sin(a) * (2.5 + o * 3)); }
    c.stroke();
    c.fillStyle = o > .2 ? '#0a0102' : '#5a1018';
    c.beginPath();
    c.ellipse(hx, hy, 1 + o * 3.8, .5 + o * 2.9, 0, 0, TAU);
    c.fill();
    if (o > .5) { // something slick crowning in there
      c.fillStyle = '#c89a8a';
      c.beginPath();
      c.arc(hx, hy + .4, 1.6 * o, 0, TAU);
      c.fill();
      c.fillStyle = '#1a0806';
      c.fillRect(hx - 1, hy, .7, .7);
      c.fillRect(hx + .4, hy, .7, .7);
    }
    strand(c, s, e, 70, hx - .6, hy + 1.6 + o * 2, 4 + o * 6, .9 + o * .6, 'rgba(170,40,40,.85)', o > .2 ? 26 : 80, BLOOD[2]);
  }
  // the dome: cataract glass, cracked, a drowned pilot's skull bobbing in brown fluid
  {
    const [dx, dy] = DOME, lv = Math.sin(t * .05) * .8, tilt = Math.sin(t * .03) * .8;
    c.save();
    c.beginPath();
    c.ellipse(dx, dy + 1, 7.4, 4.6, 0, Math.PI, TAU);
    c.lineTo(dx + 7.4, dy + 1.4);
    c.lineTo(dx - 7.4, dy + 1.4);
    c.clip();
    c.fillStyle = 'rgba(90,60,20,.7)';
    c.beginPath();
    c.moveTo(dx - 8, dy - 1 + lv - tilt);
    c.lineTo(dx + 8, dy - 1 + lv + tilt);
    c.lineTo(dx + 8, dy + 3);
    c.lineTo(dx - 8, dy + 3);
    c.closePath();
    c.fill();
    drawSkull(c, dx - 1 + Math.sin(t * .02) * 2, dy - .6 + lv, 3.2, 0);
    c.fillStyle = 'rgba(60,40,12,.45)';
    c.fillRect(dx - 8, dy - .6 + lv, 16, 4);
    c.restore();
    c.strokeStyle = 'rgba(20,10,4,.85)';
    c.lineWidth = .5;
    c.beginPath();
    c.moveTo(dx - 3, dy - 4); c.lineTo(dx - 1, dy - 2); c.lineTo(dx - 2, dy);
    c.moveTo(dx - 1, dy - 2); c.lineTo(dx + 2, dy - 2.6);
    c.stroke();
  }
  // wet specular glints: they slide and wink as it breathes
  c.fillStyle = '#fff4e8';
  for (let i = 0; i < GLINT.length; i++) {
    const a = Math.sin(t * .045 + i * 1.7);
    if (a < .3) continue;
    c.globalAlpha = Math.min(1, (a - .3) * 1.6) * q;
    const [x, y] = GLINT[i], sl = Math.sin(t * .02 + i) * .8;
    c.fillRect(x + sl, y, 1.6, .6);
    c.fillRect(x + sl + .4, y - .5, .6, .5);
  }
  c.globalAlpha = 1;
}

/** before the sprite loads: a code-drawn saucer in the same palette */
function fallbackHull(c, t) {
  c.fillStyle = MEAT.dark;
  c.beginPath();
  c.ellipse(0, 4.5, 59, 10.6, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5a5418';
  c.beginPath();
  c.ellipse(0, 4.5, 57, 9.4, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7a7428';
  c.beginPath();
  c.ellipse(-4, 2, 48, 5, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5a6a5a';
  c.beginPath();
  c.ellipse(DOME[0], DOME[1] + 1, 7.4, 5, 0, Math.PI, TAU);
  c.fill();
  // tentacles plastered over it
  c.strokeStyle = MEAT.dark;
  c.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    c.lineWidth = k ? 2.4 : 3.6;
    if (k) c.strokeStyle = MEAT.mid;
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + .3, L = 22 + hn(i, 2) * 26, w = Math.sin(t * .05 + i) * 2;
      c.moveTo(0, 2);
      c.quadraticCurveTo(Math.cos(a) * L * .5 + w, 2 + Math.sin(a) * 4, Math.cos(a) * L, 3 + Math.sin(a) * 7 + w * .5);
    }
    c.stroke();
  }
  c.lineCap = 'butt';
  c.fillStyle = '#b07a6a';
  c.beginPath();
  c.arc(EYE[0], EYE[1], EYE[2], 0, TAU);
  c.fill();
}

/** a gob hanging from (x,y): stretches over P frames, lets go as a falling drop, starts again */
function strand(c, s, e, id, x, y, len, w, col, P, tip) {
  const tt = e.t + hash(id) * P, f = (tt % P) / P, cyc = Math.floor(tt / P), key = 's' + id;
  const L = len * Math.min(1.5, GROSS) * (.3 + .7 * f * f), sw = Math.sin(e.t * .05 + id) * 1.2 * (L / len);
  if (s.sc[key] !== undefined && s.sc[key] !== cyc) add({ x: e.x + x + sw, y: e.y + y + L, vx: sw * .03, vy: .3, g: .12, l: 90, s: w * 1.1 + .4, c: tip, k: 4 });
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
/** a blister that inflates over P frames and pops */
function bubble(c, s, e, id, x, y, rmax, P, fill, rim, pc, k) {
  const tt = e.t + hash(id + 50) * P, f = (tt % P) / P, cyc = Math.floor(tt / P), key = 'b' + id;
  if (s.sc[key] !== undefined && s.sc[key] !== cyc) for (let i = 0; i < n(k); i++) { const a = rnd() * TAU, v = rb(.3, 1); add({ x: e.x + x, y: e.y + y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .5, g: .1, l: rb(30, 50), s: rb(.7, 1.2), c: pc, k: 0 }); }
  s.sc[key] = cyc;
  const r = rmax * Math.pow(f, .6);
  if (r < .45) return;
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.strokeStyle = rim;
  c.lineWidth = .4;
  c.stroke();
  c.fillStyle = 'rgba(255,255,240,.85)';
  c.fillRect(x - r * .5, y - r * .55, Math.max(.5, r * .3), Math.max(.5, r * .3));
}

// ---------------- particles + death, ticked once per render (after the enemies are drawn) ----------------
const RUP = [];
let lastT = -1, lastG = null;
export function drawUfoFx() {
  const c = ctx;
  if (lastG !== $.G) { // new run: drop everything
    lastG = $.G;
    PT.length = 0;
    RUP.length = 0;
    live.clear();
    lastT = $.T;
  }
  const dt = Math.max(0, Math.min(4, $.T - lastT));
  lastT = $.T;
  for (const e of live) {
    if (!e.dead) continue;
    live.delete(e);
    const s = ST.get(e);
    if (s && e.hp <= 0 && e.x < W + 60) rupture(e, s);
  }
  if (!PT.length && !RUP.length) return;
  for (const r of RUP) r.f += dt;
  for (let i = RUP.length - 1; i >= 0; i--) if (RUP[i].f > 150) RUP.splice(i, 1);
  for (const r of RUP) drawRupture(c, r, dt);
  const sc = ($.G && $.G.scroll) || 0;
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i];
    if (dt) {
      p.l -= dt;
      if (p.l <= 0) { PT[i] = PT[PT.length - 1]; PT.pop(); continue; }
      if (!p.st) {
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.k === 2) { p.vx *= .97; p.vy *= .97; p.s += .1 * dt; }
        if (p.k !== 2 && p.vy > 0 && p.y > floorAt(p.x + sc) - 1) { p.st = 1; p.y = floorAt(p.x + sc) - 1; }
      }
    }
    const f = p.l / p.m;
    c.globalAlpha = p.a * Math.min(1, f * 2.5);
    switch (p.k) {
      case 1: c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.st ? p.s * .6 : p.s * .7, 0, TAU); c.fill(); break;
      case 2: glow(p.x, p.y, p.s * 2.2, p.c, p.a * Math.min(1, f * 1.6)); break;
      case 3: { // a severed tentacle bit, still writhing
        const w = Math.sin($.T * .4 + p.ph), a = Math.atan2(p.vy, p.vx || .01);
        c.strokeStyle = MEAT.dark; c.lineWidth = p.s + .8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x + Math.cos(a + w) * 2.5, p.y + Math.sin(a + w) * 2.5, p.x + Math.cos(a - w * .5) * 5, p.y + Math.sin(a - w * .5) * 5); c.stroke();
        c.strokeStyle = MEAT.mid; c.lineWidth = p.s; c.stroke(); c.lineCap = 'butt';
        break;
      }
      case 4: c.fillStyle = p.c; c.fillRect(p.x - p.s * .4, p.y - (p.st ? 0 : Math.min(4, p.vy * 1.5)), p.s * .8, p.st ? .8 : p.s + Math.min(4, p.vy * 1.5)); break;
      case 5: lowEye(c, p.x, p.y, p.s, { ang: p.l * .2, iris: '#b8a830' }); break;
      case 6: c.strokeStyle = p.c; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, p.s * (1.4 - f), 0, TAU); c.stroke(); break;
      default: c.fillStyle = p.c; if (p.st) c.fillRect(p.x - p.s * .7, p.y, p.s * 1.4, .9); else c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
  }
  c.globalAlpha = 1;
}

function rupture(e, s) {
  const x = e.x, y = e.y;
  // the flood: tentacles that were holding the wreck together spill out of the split, writhing as they fall
  const fl = [];
  for (let i = 0; i < n(14); i++) { const a = rb(-Math.PI * .95, -.05) + (rnd() < .4 ? Math.PI : 0); fl.push({ x: x + rb(-12, 12), y: y + rb(-2, 6), vx: Math.cos(a) * rb(.4, 2.2), vy: Math.sin(a) * rb(.4, 2.4) - .4, L: rb(14, 30), w: rb(1.4, 2.6), ph: rnd() * TAU, a: a }); }
  RUP.push({ x, y, f: 0, frame: sprAt(e.t, 9), rot: -.05, fl });
  if (GROSS <= 0) return;
  for (let i = 0; i < n(90); i++) {
    const a = rb(0, TAU), sp = rb(.5, 4.6);
    add({ x: x + Math.cos(a) * rb(0, 30), y: y + Math.sin(a) * rb(0, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, g: .11, l: rb(40, 100), s: rb(1.2, 3.4), c: rnd() < .4 ? rp(BLOOD) : rnd() < .5 ? rp(PUS) : rp(BILE), k: rnd() < .5 ? 1 : rnd() < .5 ? 4 : 0 }, true);
  }
  for (let i = 0; i < n(18); i++) add({ x: x + rb(-30, 30), y: y + rb(-6, 8), vx: rb(-2.4, 2.4), vy: rb(-3, .5), g: .1, l: rb(70, 120), s: rb(1, 2), c: MEAT.mid, k: 3 }, true); // severed bits
  for (let i = 0; i < n(12); i++) add({ x: x + rb(-30, 30), y: y + rb(-8, 8), vx: rb(-.6, .9), vy: rb(-.6, .2), g: -.004, l: rb(80, 140), s: rb(4, 8), c: '120,130,40', k: 2, a: rb(.25, .4) }, true); // the stink
  add({ x: x + EYE[0], y: y + EYE[1], vx: -1.8, vy: -2.6, g: .1, l: 110, s: 3.2, k: 5 }, true); // the eye pops out
  add({ x, y, l: 16, m: 16, s: 50, c: PUS[1], k: 6, g: 0 }, true);
  if ($.state === 'play') {
    try {
      sample('splat_l', { vol: .95, rate: .75 });
      sample('gross_gush', { vol: .8 * q, wet: .3 });
      sample('fart_ok', { vol: .6 * q, rate: .55, spread: .05, at: .3 }); // the probe, withdrawn
    } catch (err) {}
  }
}

function drawRupture(c, r, dt) {
  const f = r.f;
  if (f < 7 && SET.flashes && GROSS > 0) {
    c.fillStyle = `rgba(150,30,30,${.12 * (1 - f / 7) * q})`;
    c.fillRect(0, 0, W, 300);
  }
  // the burst: a wave of meat and bile out of the split
  if (f < 24) {
    const k = f / 24, R0 = 16 + k * 50;
    c.globalAlpha = (1 - k) * .8;
    c.fillStyle = BLOOD[0];
    c.beginPath();
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, rr = R0 * (.7 + hash(i * 3.7) * .5); const px = r.x + Math.cos(a) * rr * 1.5, py = r.y + Math.sin(a) * rr * .6 + k * k * 8; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
    c.fill();
    c.fillStyle = BILE[0];
    c.beginPath();
    c.ellipse(r.x, r.y + k * 4, R0 * .7, R0 * .3, 0, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }
  // the hull, split in two: each half tumbles off and falls, trailing goo
  if (f < 120) {
    const al = 1 - Math.max(0, (f - 80) / 40);
    for (const side of [-1, 1]) {
      c.save();
      c.globalAlpha = al;
      c.translate(r.x + side * (4 + f * .55), r.y + f * f * .006 - f * .25 * (side < 0 ? .6 : .2));
      c.rotate(r.rot + side * f * .012);
      c.beginPath();
      if (side < 0) c.rect(-64, -20, 63 + Math.sin(f) * .5, 40); else c.rect(1, -20, 63, 40);
      c.clip();
      c.translate(-side * 2, 0);
      if (!spr(c, 'ufo3', r.frame, 0, 0)) fallbackHull(c, f);
      // the meat inside the split
      c.fillStyle = MEAT.mid;
      c.fillRect(side < 0 ? -3 : 1, -10, 2, 24);
      c.fillStyle = MEAT.lite;
      for (let i = 0; i < 5; i++) c.fillRect(side < 0 ? -3.5 : 2.5, -8 + i * 4.4, 1.2, 1.6);
      c.restore();
      c.globalAlpha = al;
      c.strokeStyle = 'rgba(160,30,36,.8)';
      c.lineWidth = .9;
      c.beginPath();
      const sx = r.x + side * (4 + f * .55) - side * 1, sy = r.y + f * f * .006 - f * .25 * (side < 0 ? .6 : .2);
      for (let i = 0; i < 3; i++) { c.moveTo(sx, sy - 6 + i * 6); c.lineTo(sx + Math.sin(f * .2 + i) * 1.5, sy - 6 + i * 6 + 3 + (f * .3 + i * 4) % 12); }
      c.stroke();
      c.globalAlpha = 1;
    }
  }
  // the tentacle flood
  for (const t of r.fl) {
    if (dt) { t.vy += .06 * dt; t.vx *= Math.pow(.99, dt); t.x += t.vx * dt; t.y += t.vy * dt; }
    const al = 1 - Math.max(0, (f - 100) / 50);
    if (al <= 0) continue;
    c.save();
    c.globalAlpha = al;
    c.translate(t.x, t.y);
    tentacle(c, tpts(0, 0, t.a + Math.PI + Math.sin(f * .15 + t.ph) * .6, t.L, 1.4, t.ph, f * 2.2, 8, .2), t.w, .4);
    c.restore();
  }
  c.globalAlpha = 1;
}

/** for probes */
(globalThis as any).__ufoFx = () => ({ pt: PT.length, rup: RUP.length, live: live.size });

/** pre-build the static layers (idle time after boot); false when done */
let warmed = 0;
export function warmUfo() {
  if (!LAY.veins) { veins(); return true; }
  // decode the three sprite sheets once (a first drawImage of a fresh PNG costs a few ms on a phone)
  if (warmed < 3 && sprReady('ufo' + (warmed + 1))) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    spr(cv.getContext('2d'), 'ufo' + (warmed + 1), 0, 4, 4);
    warmed++;
    return true;
  }
  return false; // done (or the sheets haven't loaded yet: they decode on first use then, no worse than before)
}
