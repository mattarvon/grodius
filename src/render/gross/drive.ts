// @ts-nocheck
// THE GRAVITY DRIVE: Matt's pick c3 Spine Wheel (LS2-bossart). One spine curled round on itself, ribs for uneven spokes and a
// missing arc, turning round an eye in fused bone, a torn body wall with a lung and a heart behind it. Presentation only: it
// reads the boss object (hp, phase, plates, laser, ra/rb, dying) and never writes gameplay state or calls the sim RNG.
// Art: tools/bossart/drive/bake.py -> sprites/boss/drive.png + drive.json. Every turning part (vertebrae, ribs, cord, shards) is
// baked at fixed angles and lit from the same light at each, so nothing here rotates a pixel sprite. The layout of the wheel
// (vertebra angles, radii, which ones are the 8 gun spurs on the sim's fire points) comes from the JSON's 'L'.
//  - vertebrae turn with b.ra (the sim's outer ring: bullets leave the gun spurs' bores at r84), knuckles counter-turn with b.rb
//  - ribs snap by wound stage, shoulder blades (the plates) crack and tumble off, leaving raw scars
//  - the eye opens with b.eye, follows you, constricts and burns from inside on the beam's charge, stays an eye while it fires
//  - tentacles are spinal cord, built from baked segments along the sim's own points, frayed at the tip, torn out at the root
//  - the death: the wheel comes apart bone by bone, the eye bursts, the wall tears out, then the carcass drops out pouring
import DL from '../../sprites/boss/drive.json';
import { $ } from '../../state';
import { PH, TAU, W, ctx, hash } from '../../core';
import { SET } from '../../save';
import { sample } from '../../audio';
import { glow, light } from '../util';
import { tentPts } from '../../boss/update';
import { bakedBuilt, bakedN, bakedReady, bakedWarm, bf, breath, pour } from './baked';

export const GROSS = 1;
const GK = Math.max(0, GROSS);
const K = 'drive', LY = DL.L, A = LY.A;
const V = LY.v, RIB = LY.rib, KNOB = LY.knob, HEART = LY.heart, LUNG = LY.lung;
const RAD = Math.PI / 180;
const LIDO = [0, .15, .35, .55, .78, 1];
const PLA = [Math.PI - .62, Math.PI, Math.PI + .62];
// wounds on the wall (boss-local), the order they open in: drips and bleeding come from these
const WOUNDS = [[36, -34], [40, 36], [84, -14], [30, 80], [-20, -50], [80, 66]];
const WN = [2, 4, 6];

// ---------------- render-only RNG (never the gameplay R) ----------------
let rs = 0x1badf00d;
const rnd = () => {
  rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
  return (rs >>> 0) / 4294967296;
};
const rf = (a, b) => a + rnd() * (b - a);
const ai = (a, n) => ((Math.round(a / TAU * n) % n) + n) % n; // angle -> baked frame index

/** start loading the atlas (the route warm-up slice); false: nothing left to build */
export function warmDrive() {
  bakedWarm(K);
  return false;
}
/** atlas requested */
export const driveBuilt = () => bakedBuilt(K);

// the wheel's soft contact shadow: one blurred silhouette built once from the baked frames. A blur has nothing to smear, so this
// one image may turn with smoothing on
let SHAD = null;
function shadowArt() {
  if (SHAD || !bakedReady(K) || typeof document === 'undefined') return SHAD;
  const c0 = document.createElement('canvas'), c1 = document.createElement('canvas');
  c0.width = c0.height = c1.width = c1.height = 220;
  const x0 = c0.getContext('2d'), x1 = c1.getContext('2d');
  for (const r of RIB) { const v = V[r[0]], a = v[0] * RAD; bf(x0, K, 'r' + r[1], ai(a, A), 110 + Math.cos(a) * v[1], 110 + Math.sin(a) * v[1]); }
  for (const v of V) { const a = v[0] * RAD; bf(x0, K, 'v' + v[2], ai(a, A), 110 + Math.cos(a) * v[1], 110 + Math.sin(a) * v[1]); }
  x0.globalCompositeOperation = 'source-in';
  x0.fillStyle = '#050002';
  x0.fillRect(0, 0, 220, 220);
  x1.filter = 'blur(3px)';
  x1.drawImage(c0, 0, 0);
  return (SHAD = c1);
}

// ---------------- per-fight state ----------------
let S = null;
function fresh(b) {
  rs = 0x5eed1e5;
  return {
    b, G: $.G, lt: $.G.t, beat: 0, bt: 0, hurt: 0, lastHp: b.hp, lastPh: b.phase, plHp: b.plates.map((p) => p.hp), cd: {},
    stage: 0, vGone: V.map(() => 0), kGone: KNOB.map(() => 0), ribSnap: RIB.map(() => 0), eyeBurst: 0, burstT: 0,
    bx: b.x, by: b.y, ra: b.ra, rb: b.rb, after: null, beamOn: 0, lastDying: 0, flash: 0,
  };
}
// render-side particles (world coords). kinds: 0 dark blood 1 blood 2 marrow 3 vitreous 4 meat 5 bone chip
const P = [], MAXP = Math.round(420 * GK);
const GRAV = [.09, .08, .07, .05, .1, .11];
const PCOL = [['#2a0306', '#4a080c'], ['#6e0a10', '#a8161c'], ['#b89482', '#7a3a34'], ['rgba(200,190,180,.5)', 'rgba(240,230,220,.65)'], ['#4a0a0e', '#8a2a26'], ['#cbbb98', '#7a6a50']];
function sp(k, x, y, vx, vy, s, l) {
  if (P.length >= MAXP) return;
  P.push({ k, x, y, vx, vy, s, l, ml: l });
}
function burst(k, x, y, n, sp0, sp1, s0, s1, l0, l1, dir = null, spread = TAU) {
  n = Math.round(n * GK);
  for (let i = 0; i < n; i++) {
    const a = dir == null ? rnd() * TAU : dir + rf(-spread / 2, spread / 2), v = rf(sp0, sp1);
    sp(k, x, y, Math.cos(a) * v, Math.sin(a) * v, rf(s0, s1), rf(l0, l1) | 0);
  }
}
// tumbling baked pieces: vertebrae, ribs, knuckles, blades, shards. Each turns by stepping through its own angle frames
const BONES = [], MAXB = 90;
function bone(list, n, j, x, y, vx, vy, vj, l = 160) {
  if (BONES.length >= MAXB) return;
  BONES.push({ list, n, j, x, y, vx, vy, vj, l, ml: l });
}
function snd(cat, o, cd = 30) {
  if (!GK || !S) return true;
  if ((S.cd[cat] || 0) > 0) return true;
  S.cd[cat] = cd;
  return sample(cat, o);
}
const pulse = (f) => Math.exp(-(((f - .08) / .05) ** 2)) + .65 * Math.exp(-(((f - .3) / .06) ** 2));
const deathK = (b) => (b.dying ? 1 - b.dying / 220 : 0);
/** 0 whole, 1 torn, 2 ruined: the plates count for the first third, the core's hp for the rest */
function stageOf(b) {
  const f = Math.max(0, b.hp) / b.max;
  if (b.plates.some((p) => p.hp > 0)) return 0;
  return f > .66 ? 0 : f > .33 ? 1 : 2;
}

// ---------------- simulation of the render side (advances with G.t, so pause freezes it) ----------------
function tick(b) {
  let n = $.G.t - S.lt;
  S.lt = $.G.t;
  if (n < 0 || n > 8) n = 1;
  for (let f = 0; f < n; f++) {
    for (const k in S.cd) if (S.cd[k] > 0) S.cd[k]--;
    if (S.flash > 0) S.flash--;
    if (b) step1(b);
    else if (S.after) stepAfter();
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx; p.y += p.vy; p.vy += GRAV[p.k]; p.vx *= .99;
      if (--p.l <= 0 || p.y > PH + 20 || p.x < -30 || p.x > W + 40) { P[i] = P[P.length - 1]; P.pop(); }
    }
    for (let i = BONES.length - 1; i >= 0; i--) {
      const q = BONES[i];
      q.x += q.vx; q.y += q.vy; q.vy += .11; q.vx *= .992; q.j += q.vj;
      if (--q.l <= 0 || q.y > PH + 40) { BONES[i] = BONES[BONES.length - 1]; BONES.pop(); }
    }
  }
}
function step1(b) {
  const k = deathK(b), bx = b.x, by = b.y;
  S.bx = bx; S.by = by; S.ra = b.ra; S.rb = b.rb; S.lastDying = b.dying;
  const per = b.dying ? 18 : [74, 58, 44][b.phase] || 60;
  S.bt += 1 / per;
  S.beat = pulse(S.bt % 1);
  if (S.hurt > 0) S.hurt--;
  if (b.hp < S.lastHp - .01) S.hurt = 8;
  S.lastHp = b.hp;
  if (!GK) return;
  // blades: blood on a hit, and when one breaks it tears off and tumbles away, leaving its scar
  b.plates.forEach((p, i) => {
    const px = bx + Math.cos(p.a) * 42, py = by + Math.sin(p.a) * 42;
    if (p.hp < S.plHp[i]) {
      if (p.hp <= 0 && S.plHp[i] > 0) {
        bone('pf' + i, 8, 0, px, py, rf(-2.4, -1.2), rf(-2.6, -1), rf(.12, .2), 200);
        burst(1, px, py, 30, .8, 3.4, 1, 2.4, 50, 90, p.a, 1.8);
        burst(4, px, py, 6, .8, 2.4, 1.6, 2.8, 60, 100, p.a, 1.6);
        snd('splat_l', { vol: .8, rate: .8, wet: .3 }, 10);
      } else if (rnd() < .6) burst(1, px, py, 3, .8, 2, .8, 1.5, 30, 50, p.a, 1.2);
    }
    S.plHp[i] = p.hp;
    if (p.hp <= 0 && rnd() < .06) sp(rnd() < .5 ? 0 : 1, px + rf(-4, 4), py + 4, rf(-.2, .2), .3, rf(.9, 1.6), 80);
  });
  if (b.phase !== S.lastPh) {
    burst(1, bx, by, 26, .8, 3, 1, 2.2, 40, 80);
    if (b.phase === 2) { burst(0, bx, by, 30, 1, 4, 1, 2.5, 50, 90); snd('splat_l', { vol: .7, rate: .7 }, 5); }
    else snd('snot', { vol: .7, rate: .6 }, 5);
    S.lastPh = b.phase;
  }
  // ribs snap as the stage drops: the broken length falls out of the wheel
  const st = b.dying ? 2 : stageOf(b);
  if (st !== S.stage) {
    RIB.forEach((r, i) => {
      if (r[2] > S.stage && r[2] <= st && !S.ribSnap[i]) {
        S.ribSnap[i] = 1;
        const v = V[r[0]], a = v[0] * RAD + b.ra, x = bx + Math.cos(a) * (v[1] - 22), y = by + Math.sin(a) * (v[1] - 22);
        bone('shard' + (i % 2), 16, ai(a, 16), x, y, rf(-1.5, 1.5), rf(-2, -.5), rf(-.4, .4), 150);
        burst(1, x, y, 10, .6, 2, .8, 1.6, 40, 70);
      }
    });
    if (st > S.stage) snd('snot', { vol: .6, rate: .5, wet: .3 }, 10);
    S.stage = st;
  }
  // the wounds bleed in time with the heart, harder each stage
  const nw = WN[st];
  for (let i = 0; i < nw; i++) if (rnd() < (.02 + .05 * st) * (.4 + S.beat) + (b.dying ? .15 : 0)) {
    const w = WOUNDS[i];
    sp(rnd() < .6 ? 0 : 1, bx + w[0] + rf(-5, 5), by + w[1] + rf(-2, 3), rf(-.3, .3), rf(0, .5), rf(1, 2), 90);
  }
  // the gun spurs weep from their bores when the wheel fires (phase 0 volleys: the sim's t % 80)
  if (b.phase === 0 && !b.enter && b.t % 80 === 0) for (let i = 0; i < V.length; i++) {
    if (!V[i][3]) continue;
    const a = V[i][0] * RAD + b.ra;
    if (Math.cos(a) < .35) burst(1, bx + Math.cos(a) * 84, by + Math.sin(a) * 84, 3, .4, 1.4, .8, 1.3, 25, 45, a, .9);
  }
  // the charge: the socket weeps blood, then spits when the beam goes
  if (b.laser && b.laser.tel > 0 && rnd() < .3) sp(1, bx + rf(-20, -10), by + rf(14, 22), rf(-.5, .1), rf(.2, .8), rf(.8, 1.4), 60);
  if (b.laser && b.laser.tel === 0 && !S.beamOn) burst(1, bx - 6, by, 16, .8, 2.6, 1, 1.8, 40, 60, Math.PI, 2.2);
  S.beamOn = b.laser && b.laser.tel === 0 ? 1 : 0;
  if ((b.fl > 0 || b.flash > 0) && rnd() < .5) burst(1, bx + rf(-10, 10), by + rf(-10, 10), 3, .8, 2.4, .8, 1.6, 30, 55);
  if (rnd() < .1) {
    const tn = b.tent[rnd() < .5 ? 0 : 1], q = tentPts(b, tn)[16];
    sp(rnd() < .6 ? 1 : 2, q.x, q.y + 2, rf(-.3, .3), .3, rf(.8, 1.3), 70);
  }
  if (rnd() < .008) snd('drivegut', { vol: .5 + .15 * st, wet: .45 }, 150);
  // ---- death throes: the wheel comes apart bone by bone, the eye bursts ----
  if (b.dying) {
    for (let i = 0; i < V.length; i++) if (!S.vGone[i] && k > .12 + .8 * hash(i * 3.7 + 1)) {
      S.vGone[i] = 1;
      const v = V[i], a = v[0] * RAD + b.ra, x = bx + Math.cos(a) * v[1], y = by + Math.sin(a) * v[1], sp0 = rf(.8, 2.6);
      bone('v' + v[2], A, ai(a, A), x, y, Math.cos(a) * sp0, Math.sin(a) * sp0 - rf(.5, 2), rf(-.5, .5), 200);
      burst(rnd() < .5 ? 0 : 1, x, y, 12, .6, 2.6, 1, 2.2, 40, 80, a, 1.6);
      if (rnd() < .4) snd('splat_m', { vol: .5, rate: rf(.6, .9), wet: .3 }, 6);
    }
    for (let i = 0; i < KNOB.length; i++) if (!S.kGone[i] && k > .5 + .45 * hash(i * 5.1 + 2)) {
      S.kGone[i] = 1;
      const q = KNOB[i], a = q[0] * RAD + b.rb, x = bx + Math.cos(a) * q[1], y = by + Math.sin(a) * q[1];
      bone('shard' + (i % 2), 16, ai(a, 16), x, y, Math.cos(a) * 1.6, Math.sin(a) * 1.6 - 1, rf(-.4, .4), 160);
      burst(1, x, y, 8, .6, 2, 1, 2, 40, 70, a, 1.6);
    }
    if (k > .45 && !S.eyeBurst) {
      S.eyeBurst = 1;
      S.burstT = b.t;
      burst(3, bx, by, 40, .8, 4, 1.2, 2.8, 60, 110);
      burst(1, bx, by, 30, 1, 4.5, 1, 2.2, 50, 90);
      burst(0, bx, by, 20, .8, 3.5, 1, 2.4, 50, 90);
      snd('splat_l', { vol: 1, rate: .7, wet: .3 }, 4);
      snd('snot', { vol: .9, rate: .6 }, 4);
      if (SET.flashes) S.flash = 5;
    }
    // the heavy pour: arterial jets from the torn heart and the wall, through the shared gore stream
    const age = 220 - b.dying;
    pour(bx + 34, by + 30, age, { w: 22, h: 18, jets: 6, len: 200, meat: 16, rope: 4 });
    if (age > 60) pour(bx + 60, by - 20, age - 60, { w: 28, h: 30, jets: 4, len: 150, meat: 10, rope: 3 });
    if (b.dying % 40 === 20) snd('snot', { vol: .7, rate: .45 + k * .4 }, 10);
  }
}
function rupture() {
  // the last frame: whatever is left of the wheel is thrown out, the carcass drops out of the chamber pouring
  const x = S.bx, y = S.by;
  for (let i = 0; i < V.length; i++) if (!S.vGone[i]) {
    S.vGone[i] = 1;
    const v = V[i], a = v[0] * RAD + S.ra, s = rf(2, 5);
    bone('v' + v[2], A, ai(a, A), x + Math.cos(a) * v[1], y + Math.sin(a) * v[1], Math.cos(a) * s, Math.sin(a) * s - 1.5, rf(-.6, .6), 220);
  }
  for (let i = 0; i < 26; i++) { const a = rnd() * TAU, s = rf(1.5, 5); bone('shard' + (i % 2), 16, rnd() * 16, x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * s, Math.sin(a) * s - 1, rf(-.6, .6), 200); }
  burst(0, x, y, 150, 1, 8, 1.8, 4.5, 80, 160);
  burst(1, x, y, 130, 1, 8, 1.6, 4, 80, 160);
  burst(4, x, y, 40, 1.5, 6, 2.4, 5, 80, 140);
  burst(2, x, y, 30, 1, 5, 1.2, 2.6, 60, 110);
  burst(5, x, y, 30, 2, 6, .8, 1.6, 70, 120);
  S.after = { t: 0, x, y, drips: [] };
  for (let i = 0; i < Math.round(26 * GK); i++) S.after.drips.push({ x: rf(8, W - 8), w: rf(2, 7), sp: rf(.25, .9), d: rf(0, 30), c: rnd() < .7 ? 0 : 1 });
  S.cd = {};
  if (!snd('driveburst', { vol: 1, spread: .04, wet: .35, prio: true }, 0)) snd('splat_l', { vol: 1, rate: .6, wet: .4, prio: true }, 0);
  snd('explode_l', { vol: .7, rate: .7, wet: .4, prio: true }, 0);
  snd('drivegut', { vol: 1, rate: .32, spread: .02, wet: .6, at: .5, prio: true }, 0); // and the gut settling, slowed to a groan
}
function stepAfter() {
  const A_ = S.after;
  A_.t++;
  if (A_.t < 170) pour(A_.x + 40, A_.y + A_.t * A_.t * .006, A_.t, { w: 40, h: 40, jets: 8, len: 170, meat: 26, rope: 7 });
}

// ---------------- drawing ----------------
function drawList(name, x, y) {
  const n = bakedN(K, name);
  for (let i = 0; i < n; i++) bf(ctx, K, name, i, x, y);
}
function drawWheel(b, bx, by) {
  const ra = b.ra, st = S.stage, k = deathK(b);
  const sh = shadowArt();
  if (sh) {
    ctx.save();
    ctx.globalAlpha = .55 * (1 - k);
    ctx.translate(bx + 3, by + 5);
    ctx.rotate(ra);
    ctx.drawImage(sh, -110, -110);
    ctx.restore();
  }
  for (let i = 0; i < RIB.length; i++) {
    const r = RIB[i], v = V[r[0]];
    if (S.vGone[r[0]]) continue;
    const a = v[0] * RAD + ra;
    bf(ctx, K, 'r' + ((S.ribSnap[i] || r[2] <= st ? 2 : 0) + r[1]), ai(a, A), bx + Math.round(Math.cos(a) * v[1]), by + Math.round(Math.sin(a) * v[1]));
  }
  for (let i = 0; i < V.length; i++) {
    if (S.vGone[i]) continue;
    const v = V[i], a = v[0] * RAD + ra;
    bf(ctx, K, 'v' + v[2], ai(a, A), bx + Math.round(Math.cos(a) * v[1]), by + Math.round(Math.sin(a) * v[1]));
  }
}
function drawEye(b, bx, by) {
  const L = b.laser, hurt = b.fl > 0 || b.flash > 0;
  bf(ctx, K, 'socket', 0, bx, by);
  if (S.eyeBurst) { bf(ctx, K, 'eyeb', Math.min(2, (b.t - S.burstT) / 7 | 0), bx, by); return; }
  const st = S.stage;
  bf(ctx, K, 'globe', L ? 6 : hurt ? 3 + st : st, bx, by);
  let set = 'i';
  if (L) set = L.tel > 0 ? (L.tel > (L.ml || 75) * .6 ? 'a' : 't') : 'f';
  else if (hurt || b.phase === 2) set = 'a';
  const ang = L ? L.ang : Math.atan2($.P.y - b.y, $.P.x - b.x);
  bf(ctx, K, 'iris_' + set, 1 + ai(ang, 8), bx, by);
  let o = b.dying ? 1 : b.eye;
  if (hurt && !b.dying) o *= .6;
  if (o > .45 && !L) {
    ctx.fillStyle = 'rgba(255,240,228,.85)';
    ctx.fillRect(bx - 9, by - 10, 2, 1);
  }
  let li = 0;
  for (let i = 1; i < LIDO.length; i++) if (Math.abs(LIDO[i] - o) < Math.abs(LIDO[li] - o)) li = i;
  if (li < LIDO.length - 1) bf(ctx, K, 'lid', li, bx, by);
}
function drawHub(b, bx, by) {
  for (let i = 0; i < KNOB.length; i++) {
    if (S.kGone[i]) continue;
    const q = KNOB[i], a = q[0] * RAD + b.rb;
    bf(ctx, K, 'knob', q[2], bx + Math.round(Math.cos(a) * q[1]), by + Math.round(Math.sin(a) * q[1]));
  }
}
function drawPlates(b, bx, by) {
  for (let i = 0; i < 3; i++) {
    const p = b.plates[i], px = bx + Math.round(Math.cos(PLA[i]) * 42), py = by + Math.round(Math.sin(PLA[i]) * 42);
    if (p.hp > 0) {
      const d = 1 - p.hp / p.max, j = p.f > 0 ? 1 : 0;
      bf(ctx, K, 'pl' + i, d < .35 ? 0 : d < .7 ? 1 : 2, px - j, py + (p.f & 1));
    } else bf(ctx, K, 'ps' + i, 0, px, py);
  }
}
function drawTent(b, bx, by) {
  const dx = bx - b.x, dy = by - b.y;
  for (const t of b.tent) {
    const pts = tentPts(b, t);
    let i0 = 0;
    while (i0 < 15 && Math.hypot(pts[i0].x - b.x, pts[i0].y - b.y) < 36) i0++;
    const p0 = pts[i0], p1 = pts[i0 + 1];
    for (let i = i0; i < 16; i++) {
      const a = pts[i], c = pts[i + 1], f = i / 16, an = Math.atan2(c.y - a.y, c.x - a.x);
      bf(ctx, K, f < .4 ? 'cord0' : f < .75 ? 'cord1' : 'cord2', ai(((an % Math.PI) + Math.PI) % Math.PI, 32) % 16, Math.round((a.x + c.x) / 2 + dx), Math.round((a.y + c.y) / 2 + dy));
    }
    bf(ctx, K, 'stump', ai(Math.atan2(p1.y - p0.y, p1.x - p0.x), 32), Math.round(p0.x + dx), Math.round(p0.y + dy));
    const q = pts[15], e = pts[16];
    bf(ctx, K, 'fray', ai(Math.atan2(e.y - q.y, e.x - q.x), 32), Math.round(e.x + dx), Math.round(e.y + dy));
  }
}
// hanging threads of blood off the open wounds: they grow, swell and let go as real drops
function drawDrips(b, bx, by) {
  if (!GK) return;
  const n = WN[S.stage] + (b.dying ? 0 : 0);
  ctx.strokeStyle = 'rgba(70,6,12,.92)';
  ctx.fillStyle = '#5a070c';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const w = WOUNDS[i], per = 70 + hash(i * 9.1) * 70, tt = b.t + hash(i) * per, f = (tt % per) / per, L = (6 + hash(i * 2.3) * 12) * (.3 + .7 * f * f);
    const x = bx + w[0] + (hash(i * 4.4) - .5) * 8, y = by + w[1] + 3;
    if (f + 1 / per >= 1) sp(0, x, y + L, 0, .4, 1.4, 90);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(b.t * .04 + i) * .8, y + L);
    ctx.stroke();
    ctx.fillRect(x - 1, y + L - 1, 2, 2 + f);
  }
}
function drawParts() {
  for (const p of P) {
    const c = PCOL[p.k], s = p.s;
    ctx.globalAlpha = Math.min(1, p.l / 25);
    ctx.fillStyle = c[0];
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    const v = Math.abs(p.vx) + Math.abs(p.vy);
    if (v > 1.4) ctx.fillRect(p.x - p.vx * .8 - s / 4, p.y - p.vy * .8 - s / 4, s / 2, s / 2);
    if (s > 1.4) {
      ctx.fillStyle = c[1];
      ctx.fillRect(p.x - s / 2, p.y - s / 2, Math.max(.6, s * .35), Math.max(.6, s * .35));
    }
  }
  ctx.globalAlpha = 1;
  for (const q of BONES) {
    if (q.l < 30) ctx.globalAlpha = q.l / 30;
    bf(ctx, K, q.list, ((Math.round(q.j) % q.n) + q.n) % q.n, Math.round(q.x), Math.round(q.y));
    ctx.globalAlpha = 1;
  }
}
function drawAfter() {
  const A_ = S.after, t = A_.t;
  // the emptied carcass drops out of the chamber, tearing as it goes
  if (t < 190) {
    const f = t / 190, x = Math.round(A_.x + f * 26), y = Math.round(A_.y + t * t * .006);
    light(x + 30, y, 90, 1 - f);
    ctx.globalAlpha = 1 - f * f * f;
    drawList('walld1', x, y);
    bf(ctx, K, 'heartd', 0, x + HEART[0], y + HEART[1] + Math.round(t * .3));
    ctx.globalAlpha = 1;
  }
  // blood slopped across the lens, running down
  for (const d of A_.drips) {
    const tt = Math.max(0, t - d.d), len = Math.min(PH, tt * d.sp * 2.4), al = Math.max(0, 1 - Math.max(0, t - 220) / 120);
    if (al <= 0 || tt <= 0) continue;
    ctx.globalAlpha = al * .85;
    ctx.fillStyle = d.c ? '#5a060c' : '#24030a';
    ctx.fillRect(d.x - d.w / 2, -2, d.w, len);
    ctx.fillRect(d.x - d.w * .7, len - d.w * .4, d.w * 1.4, d.w * .9);
    ctx.fillStyle = 'rgba(190,40,40,.5)';
    ctx.fillRect(d.x - d.w / 2 + .8, -2, 1, len);
  }
  ctx.globalAlpha = 1;
}

/** the whole boss body (everything but the laser and the HP bar). b === null draws the aftermath of its death */
export function drawDrive(b) {
  if ($.G && S && S.G !== $.G) { S = null; P.length = 0; BONES.length = 0; }
  if (!b) {
    if (!S) return;
    if (S.b && S.lastDying > 0 && S.lastDying <= 3 && !S.after) rupture();
    S.b = null;
    tick(null);
    if (!S.after) { if (!P.length && !BONES.length) S = null; else drawParts(); return; }
    drawAfter();
    drawParts();
    if (S.after.t > 400 && !P.length && !BONES.length) S = null;
    return;
  }
  if (!S || S.b !== b) { S = fresh(b); P.length = 0; BONES.length = 0; }
  tick(b);
  const bx = Math.round(b.x), by = Math.round(b.y), k = deathK(b), st = S.stage;
  if (!bakedReady(K)) {
    bakedWarm(K);
    ctx.fillStyle = '#12060a';
    ctx.beginPath();
    ctx.arc(bx, by, 70, 0, TAU);
    ctx.fill();
    return;
  }
  drawList(!b.dying || k < .3 ? 'wall' + st : k < .65 ? 'walld0' : 'walld1', bx, by);
  bf(ctx, K, 'lung' + st, breath(b.t, bakedN(K, 'lung' + st), 150, 5), bx + LUNG[0], by + LUNG[1]);
  bf(ctx, K, b.dying && k > .3 ? 'heartd' : 'heart' + st, b.dying && k > .3 ? 0 : Math.min(2, S.beat * 2.4 | 0), bx + HEART[0], by + HEART[1]);
  drawWheel(b, bx, by);
  // glow on the tell: a red ring round the socket, drawn under the eye, so the eye still reads while it charges and fires
  const L = b.laser;
  if (L || b.phase === 2) {
    const g = L ? (L.tel > 0 ? .25 + .5 * (1 - L.tel / (L.ml || 75)) : .9) : .12 + .12 * S.beat;
    ctx.globalCompositeOperation = 'lighter';
    glow(bx, by, 70, '200,10,16', g * .5);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawEye(b, bx, by);
  drawHub(b, bx, by);
  drawPlates(b, bx, by);
  drawTent(b, bx, by);
  drawDrips(b, bx, by);
  light(bx, by, 60, .5 + .3 * S.beat);
  drawParts();
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(160,20,24,${.07 * S.flash})`;
    ctx.fillRect(-20, -20, W + 40, PH + 40);
  }
}
/** test hook for tools/drive-shots.mjs */
export const driveState = () => S;
