// @ts-nocheck
import { $ } from '../state';
import { PH, R, TAU, W, pick, ri, rr } from '../core';
import { sfx } from '../audio';
import { ceilAt, enemies, eshots, floorAt } from '../world';
import { startBoss } from '../boss/update';
import { ufoWarn } from './ufo'; // unused here, but kept: it fixes the spawn/ufo ESM init order
import { depthHP } from '../depth';

// ---------------- enemies ----------------
export const ET = {
  drone: {
    hp: 1,
    r: 7,
    gsz: 1,
    score: 100,
    bio: 2
  },
  corpse: {
    hp: 5,
    r: 9,
    gsz: 1.6,
    score: 300,
    bio: 5,
    half: 1,
    eyes: 2,
    teeth: 3
  },
  eye: {
    hp: 7,
    r: 8,
    gsz: 1.4,
    score: 400,
    bio: 6,
    eyes: 1
  },
  crawler: {
    hp: 6,
    r: 8,
    gsz: 1.5,
    score: 350,
    bio: 6,
    teeth: 4
  },
  hatch: {
    hp: 1,
    r: 5,
    gsz: .7,
    score: 80,
    bio: 1
  },
  womb: {
    hp: 14,
    r: 12,
    gsz: 2.4,
    score: 900,
    bio: 14,
    half: 1,
    amnio: 1
  },
  cross: {
    hp: 12,
    r: 10,
    gsz: 2.2,
    score: 800,
    bio: 10,
    skull: 2,
    limbs: 2,
    eyes: 1,
    teeth: 4
  },
  hook: {
    hp: 7,
    r: 8,
    gsz: 1.8,
    score: 450,
    bio: 7,
    limbs: 2,
    eyes: 1,
    teeth: 3
  },
  flayer: {
    hp: 16,
    r: 9,
    gsz: 2.4,
    score: 1100,
    bio: 12,
    skull: 1,
    teeth: 6,
    eyes: 2
  },
  maw: {
    hp: 120,
    r: 24,
    gsz: 4,
    score: 6000,
    bio: 70,
    half: 1,
    eyes: 6,
    teeth: 16,
    big: 1,
    mini: 1
  },
  crux: {
    hp: 145,
    r: 20,
    gsz: 5,
    score: 15000,
    bio: 90,
    skull: 3,
    limbs: 4,
    eyes: 4,
    teeth: 12,
    big: 1,
    mini: 1
  },
  nailbar: {
    hp: 16,
    r: 9,
    gsz: 1,
    score: 800,
    bio: 4,
    teeth: 0,
    eyes: 0,
    skull: 0,
    limbs: 0
  },
  butcher: {
    hp: 300,
    r: 20,
    gsz: 5,
    score: 18000,
    bio: 110,
    skull: 2,
    limbs: 5,
    eyes: 8,
    teeth: 10,
    big: 1,
    mini: 1
  },
  // biome midbosses (docs/pacing.md 3.2): Maw-sized pools, hold the scroll, leave after ~23 s
  choir: { hp: 80, r: 13, gsz: 4, score: 6000, bio: 60, skull: 1, eyes: 5, teeth: 4, big: 1, mini: 1, mid: 1 },
  cyst: { hp: 135, r: 21, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 2, teeth: 6, big: 1, mini: 1, mid: 1 },
  prentice: { hp: 150, r: 15, gsz: 4, score: 6000, bio: 70, skull: 1, limbs: 3, eyes: 3, teeth: 6, big: 1, mini: 1, mid: 1 },
  brood: { hp: 105, r: 20, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 3, teeth: 8, big: 1, mini: 1, mid: 1 },
  // the Open Orbit midboss (enemies/ufo.ts): r is the eye-core; the saucer's wings are extra hitboxes (e.hb)
  ufo: { hp: 80, r: 15, gsz: 5, score: 6000, bio: 70, eyes: 3, teeth: 4, limbs: 4, big: 1, mini: 1, mid: 1 }
};
export function mk(k, x, y, o = {}) {
  const b = ET[k],
    hm = 1 + .4 * $.G.loop;
  const e = {
    k,
    x,
    y,
    vx: 0,
    vy: 0,
    t: 0,
    flash: 0,
    rot: 0,
    dead: false,
    ...b,
    ...o
  };
  // HP no longer tracks rank: pressure lives in fire rate + spawn density (BS(), every(), formation()),
  // not in sponge toughness. Depth (depth.ts) still scales HP from Descent 2 on so fodder survives long enough to shoot.
  e.hp = b.hp * hm * (o.hpm || 1);
  // ...and from Descent 2 on, depth keeps it climbing past the rank cap (src/depth.ts; dm = 1 in Descent 1)
  e.dm = depthHP(k, b, o);
  e.hp *= e.dm;
  e.max = e.hp;
  if (!b.mini && !o.par && !o.kid && $.G.st) $.G.st.spawned++; // kid: born from a midboss, not scripted
  if (e.cap && !e.mini && R() < .65) e.cap = false;
  enemies.push(e);
  return e;
}
export const BS = () => Math.min(1.45, 1 + .12 * $.G.loop) * (1 + .35 * Math.min(2.0, $.G.pow || 0));
export function eshoot(x, y, a, sp, k = 'orb') {
  if (eshots.length > 260) return;
  eshots.push({
    x,
    y,
    vx: Math.cos(a) * sp * BS(),
    vy: Math.sin(a) * sp * BS(),
    r: k === 'glob' ? 3 : k === 'spike' ? 4 : 2,
    k,
    t: 0
  });
  k === 'glob' ? sfx.glob() : sfx.eshot();
}
export const aimA = (x, y) => Math.atan2($.P.y - y, $.P.x - x),
  wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
export const onScreen = e => e.x > -10 && e.x < W - 6;
export function rearLane(y) {
  const py = $.P ? $.P.y : PH / 2;
  return Math.abs(py - y) < 60 ? py < PH / 2 ? PH - 55 : 55 : y;
}
export function rearWarn(y, f) {
  $.G.warn.push({
    y,
    t: 100,
    ml: 100
  });
  sfx.tele();
  $.G.pend.push({
    t: 100,
    f
  });
}
export function behindWave(y, n = 5, o = {}) {
  y = rearLane(y);
  rearWarn(y, () => formation('behind', rearLane(y), n, o));
}
/** extra drones a power-scaled formation gets: round(3 * min(2, pow)), 0..6 (density is where power shows, D1) */
export const formationExtra = () => Math.round(Math.min(2.0, $.G.pow || 0) * 3);
/** a drone wave of n (+ formationExtra()). o.fixed: a scripted set piece whose layout must hold (the acid biome's
 *  double wall would merge into one at +6 drones), so it spawns exactly n; other o fields go to every drone's mk() */
export function formation(pat, y, n = 5, o = {}) {
  const { fixed, ...mo } = o;
  if (!fixed) n += formationExtra(); // denser waves as you power up; uncapped past rank 1 so Infirmary buys still add bodies
  const g = {
    n,
    killed: 0
  };
  for (let i = 0; i < n; i++) {
    const e = mk('drone', pat === 'behind' ? -16 - i * 16 : W + 16 + i * 16, y, {
      group: g,
      pat,
      i,
      y0: y,
      ghost: pat === 'behind' ? 60 + i * 9 : 0,
      ...mo
    });
    if (pat === 'wall') {
      e.x = W + 16;
      e.y = y + (i - (n - 1) / 2) * 15;
      e.y0 = e.y;
    }
  }
}
export function corpse(y, o = {}) {
  mk('corpse', W + 20, y, {
    vr: rr(-.03, .03),
    drift: rr(.15, .6),
    ph: R() * TAU,
    noLeg: R() < .4,
    noArm: R() < .3,
    cap: R() < .25,
    ...o
  });
}
export function eyeT(side) {
  const wx = $.G.scroll + W + 14;
  const y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('eye', W + 14, y, {
    o: side,
    cool: ri(40, 90),
    veins: Array.from({
      length: 6
    }, () => [R() * TAU, rr(3, 6)]),
    blink: 0,
    cap: R() < .15
  });
}
export function crawler(side = 1) {
  const wx = $.G.scroll + W + 14,
    y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('crawler', W + 14, y, {
    o: side,
    spd: rr(.4, .9),
    cool: ri(80, 140),
    cap: R() < .3
  });
}
export function hatch(n, fromLeft, go) {
  if (fromLeft && !go) {
    const py = $.P ? $.P.y : PH / 2,
      y = py < PH / 2 ? PH * .72 : PH * .28;
    rearWarn(y, () => hatch(n, true, 1));
    return;
  }
  for (let i = 0; i < n; i++) {
    let y = rr(30, PH - 30);
    if (fromLeft && $.P) for (let k = 0; k < 6 && Math.abs(y - $.P.y) < 45; k++) y = rr(30, PH - 30);
    mk('hatch', fromLeft ? -10 - i * 14 : W + 10 + i * 14, y, {
      fromLeft,
      ph: R() * TAU,
      ghost: fromLeft ? 55 + i * 8 : 0
    });
  }
}
export function womb() {
  const wx = $.G.scroll + W + 16,
    c = ceilAt(wx);
  if (c < -4) return;
  mk('womb', W + 16, c + 20, {
    st: 20,
    cool: ri(60, 100)
  });
}
export function maw(stageBoss = false) {
  $.G.mini = mk('maw', W + 40, PH / 2, {
    stageBoss,
    jaw: 0,
    eyesP: Array.from({
      length: 9
    }, () => ({
      a: rr(-1.2, 1.2),
      r: rr(8, 19),
      s: rr(1.6, 3),
      b: 0
    })),
    cap: 1,
    leave: 1700
  });
}
/** a biome's midboss (k = choir / cyst / prentice / brood), in from the right edge */
export function midboss(k, title) {
  const e = mk(k, W + 50, k === 'prentice' ? PH * .42 : PH / 2, { title, tx: W - 92, st: 'idle', wt: 0, cool: 110, att: 0, ba: -2.3, leave: 1400 });
  if (k === 'choir') e.bars = [0, 1].map(i => mk('nailbar', e.x, e.y, { par: e, ox: 0, oy: 0, i, hpm: 1.6 }));
  $.G.mini = e;
}
export function crossT(side) {
  const wx = $.G.scroll + W + 16,
    sy = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (sy > PH + 4 || sy < -4) return;
  mk('cross', W + 16, sy - side * 22, {
    o: side,
    cool: ri(70, 130),
    cap: R() < .3,
    noLeg: R() < .35
  });
}
export function hookE() {
  const wx = $.G.scroll + W + 16,
    c = Math.max(-10, ceilAt(wx)),
    room = floorAt(wx) - c;
  mk('hook', W + 16, c + 30, {
    ax: W + 16,
    ay: c,
    len: rr(34, Math.max(40, room * .55)),
    sw: rr(.5, 1),
    ph: R() * TAU,
    noLeg: R() < .5,
    noArm: R() < .4,
    cap: R() < .2,
    twitch: 0,
    cut: R() < .5
  });
}
export function flayer(y) {
  mk('flayer', W + 18, y, {
    y0: y,
    tx: rr(W * .55, W * .8),
    ws: 'idle',
    wt: 0,
    ang: Math.PI,
    cool: ri(60, 110),
    cap: R() < .35
  });
}
export function logLine(s) {
  $.G.logQ.push(s);
}
// BulletML-lite pattern primitives
export const fan = (x, y, a, n, spread, sp, k) => {
  for (let i = 0; i < n; i++) eshoot(x, y, a + (i - (n - 1) / 2) * spread, sp, k);
};
export const ring = (x, y, n, a0, sp, k) => {
  for (let i = 0; i < n; i++) eshoot(x, y, a0 + i * TAU / n, sp, k);
};
export const every = (e, n) => e.t % Math.max(18, Math.round(n * (1 - .4 * Math.min(2.0, $.G.pow || 0)))) === 0;
export function miniWarn(name, f) {
  banner('WARNING', name, '#ff2a2a', 170);
  sfx.dread();
  $.G.glitch = 10;
  $.G.pend.push({
    t: 150,
    f
  });
}
export function crux() {
  const e = mk('crux', W + 60, PH / 2, {
    tx: W - 92,
    bars: []
  });
  for (let i = 0; i < 4; i++) e.bars.push(mk('nailbar', e.x, e.y, {
    par: e,
    ox: -24 - i * 7,
    oy: 0,
    i
  }));
  $.G.mini = e;
}
export function butcher() {
  $.G.mini = mk('butcher', W + 70, 95, {
    tx: W - 112,
    st: 'idle',
    wt: 0,
    cool: 100,
    sw: 0,
    ba: -2.3,
    hk: null,
    att: 0
  });
}
export function banner(text, sub, col = '#d4141e', t = 200) {
  $.G.banner = {
    text,
    sub,
    col,
    t,
    ml: t
  };
}
// the Open Orbit and Gravity Drive approach scripts, remixed per descent, live in enemies/scripts.ts
export { buildScript } from './scripts';
export function runScript() {
  while ($.G.si < $.G.script.length && $.G.script[$.G.si].x <= $.G.scroll) {
    const s = $.G.script[$.G.si++];
    if ($.G.eat && s.x < $.G.eat) continue; // the Open Orbit midboss is up: its stretch of filler is skipped (enemies/ufo.ts)
    s.f();
  }
}

// --- enemy behaviour ---

// ---------------- new enemies: the Sinus snot slime, the hulking mutant, the MERIDIAN security drone ----------------
// (behaviour: updNew() in update.ts; kill FX: killNew(); art: drawSlime / drawMutant / drawSentry in render/enemies.ts)
Object.assign(ET, {
  // a mucus slime oozing along the Sinus floor or ceiling: rears up and lobs snot, or lunges when you pass over it
  slime: { hp: 7, r: 9, gsz: 1.7, score: 450, bio: 6, amnio: 1, eyes: 0, teeth: 0, skull: 0, limbs: 0 },
  // a crewman the drive turned into a hulk, stalking the Cryovault and Furnace floors: slow, tough, hurls meat
  mutant: { hp: 26, r: 13, gsz: 3, score: 1600, bio: 16, big: 1, half: 1, skull: 1, limbs: 3, eyes: 2, teeth: 6 },
  // the derelict's own defence pods, still on patrol in Open Orbit: a brain in a can, bleeds blood-oil
  sentry: { hp: 6, r: 8, gsz: .8, score: 500, bio: 6, eyes: 1, teeth: 0, skull: 0, limbs: 0 },
});
export function slime(side = 1) {
  const wx = $.G.scroll + W + 16, y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('slime', W + 16, y - side * 6, { o: side, spd: rr(.2, .45), cool: ri(90, 130), st: 'ooze', wt: 0, ph: R() * TAU, cap: R() < .2 });
}
export function mutant() {
  const wx = $.G.scroll + W + 24, f = floorAt(wx);
  if (f > PH + 4 || f - ceilAt(wx) < 70) return;
  mk('mutant', W + 24, f - 18, { fy: f, st: 'walk', wt: 0, cool: ri(110, 150), spd: rr(.22, .36), cap: R() < .5 });
}
/** a security pod in from the right that parks at tx, fires two telegraphed bursts, then moves on */
export function sentry(y, tx) {
  mk('sentry', W + 14, y, { y0: y, tx: tx ?? rr(W * .6, W * .82), st: 'hover', wt: 0, cool: ri(50, 80), shots: 0, ph: R() * TAU, cap: R() < .3 });
}
