// @ts-nocheck
import { $ } from '../state';
import { BOSS_AT, PH, R, TAU, W, pick, ri, rr } from '../core';
import { sfx } from '../audio';
import { ceilAt, enemies, eshots, floorAt } from '../world';
import { startBoss } from '../boss/update';

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
  brood: { hp: 105, r: 20, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 3, teeth: 8, big: 1, mini: 1, mid: 1 }
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
  // power rank (0..1) thickens everything: +80% HP for fodder, +100% for bosses (a maxed build still gets a fight)
  e.hp = b.hp * hm * (o.hpm || 1) * (1 + ($.G.rank || 0) * (b.mini ? 1 : .8));
  e.max = e.hp;
  if (!b.mini && !o.par && !o.kid && $.G.st) $.G.st.spawned++; // kid: born from a midboss, not scripted
  if (e.cap && !e.mini && R() < .65) e.cap = false;
  enemies.push(e);
  return e;
}
export const BS = () => Math.min(1.45, 1 + .12 * $.G.loop) * (1 + .22 * ($.G.rank || 0));
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
export function behindWave(y, n = 5) {
  y = rearLane(y);
  rearWarn(y, () => formation('behind', rearLane(y), n));
}
export function formation(pat, y, n = 5, o = {}) {
  n += Math.round(($.G.rank || 0) * 3); // denser waves as you power up
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
      ...o
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
export const every = (e, n) => e.t % Math.max(18, Math.round(n * (1 - .3 * ($.G.rank || 0)))) === 0;
export function miniWarn(name, f) {
  banner('WARNING', name, '#ff2a2a', 170);
  sfx.alarm();
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
export function buildScript(L) {
  const S = [],
    at = (x, f) => S.push({
      x,
      f
    }),
    hard = L > 0;
  // PHASE 1: open orbit, the derelict looming
  at(200, () => formation('sine', 80));
  at(420, () => formation(hard ? 'zig' : 'sine', 175)); // Descent 2+ upgrades a few waves (Descent 1 is untouched)
  at(560, () => {
    corpse(60);
    corpse(200);
  });
  at(700, () => formation('dive', 50));
  at(820, () => formation('dive', 205));
  at(980, () => formation('wall', PH / 2));
  at(1100, () => hatch(6, true));
  at(1220, () => {
    formation(hard ? 'zig' : 'sine', 60);
    corpse(150);
  });
  at(1320, () => flayer(PH * .3));
  at(1700, () => flayer(PH * .7));
  at(1900, () => flayer(PH * .4));
  at(1380, () => formation('zig', 190));
  at(1500, () => behindWave(PH / 2));
  at(1620, () => {
    corpse(40);
    corpse(120);
    corpse(210);
  });
  at(1760, () => formation('dive', 120));
  at(1880, () => hatch(8, false));
  at(2000, () => {
    banner('SOMETHING IS COMING', 'MASS READING: ORGANIC', undefined, 150);
    sfx.alarm();
  });
  at(2120, () => maw(true));
  if (hard) {
    at(900, () => behindWave(PH * .3, 4)); // a rear wave between the dives and the wall
    at(1550, () => { flayer(PH * .25); flayer(PH * .75); }); // a flayer pair as the behind wave clears
  }
  // PHASE 4: the Gravity Drive approach (stage 3 starts ~8370): corridor gauntlet, rising pressure, WARNING, a breath
  at(8430, () => logLine('GRAVITY RISING. THE HULL IS BEING PULLED AFT.'));
  at(8450, () => formation('sine', PH * .3));
  at(8530, () => { corpse(70); corpse(PH - 70); });
  at(8600, () => formation('dive', 60));
  at(8670, () => formation('dive', PH - 80));
  at(8730, () => { eyeT(1); eyeT(-1); });
  at(8790, () => behindWave(PH / 2));
  at(8850, () => { formation('zig', PH * .35); flayer(PH * .75); });
  at(8920, () => { formation('wall', PH / 2); if (hard) hatch(6, true); });
  at(8990, () => { flayer(PH * .25); flayer(PH * .7); if (hard) formation('dive', 120); });
  at(9060, () => { banner('WARNING', 'GRAVITY WELL CRITICAL', '#ff2a2a', 200); sfx.alarm(); $.G.glitch = 14; });
  at(9150, () => { corpse(PH * .3, { drift: .2 }); corpse(PH * .65, { drift: .2 }); }); // the breath: crew dragged toward the drive
  at(BOSS_AT, () => startBoss());
  // stages 1 and 2 (world x 2300..8200) are biome slots, scripted when you pick a gate (biomes.ts insertScript)
  S.sort((a, b) => a.x - b.x);
  return S;
}
export function runScript() {
  while ($.G.si < $.G.script.length && $.G.script[$.G.si].x <= $.G.scroll) $.G.script[$.G.si++].f();
}

// --- enemy behaviour ---
