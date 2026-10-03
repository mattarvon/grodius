// @ts-nocheck
import { $ } from '../state';
import { C, PH, R, TAU, W, pick, ri, rr } from '../core';
import { sfx } from '../audio';
import { buzz } from '../platform';
import { decals, drops, flashes, gibs, mists, sparks, splats, texts } from '../world';

// ---------------- helpers: particles ----------------
export function drop(x, y, vx, vy, s = 1, c = 0, l = 110) {
  if (drops.length > 4800) return;
  drops.push({
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    s,
    c,
    l
  });
}
export function addDecal(wx, y, r, side) {
  for (let i = decals.length - 1, n = 0; i >= 0 && n < 40; i--, n++) {
    const d = decals[i];
    if (d.side === side && Math.abs(d.wx - wx) < 3 + d.r * .5 && Math.abs(d.y - y) < 4) {
      d.r = Math.min(7, d.r + r * .18);
      return;
    }
  }
  decals.push({
    wx,
    y,
    r: Math.min(3, r * .9),
    side,
    t: $.T
  });
  if (decals.length > 1800) decals.splice(0, 240);
}
export function spark(x, y, vx, vy, l, c) {
  if (sparks.length > 500) return;
  sparks.push({
    x,
    y,
    vx,
    vy,
    l,
    ml: l,
    c
  });
}
export function flash(x, y, r, l, c) {
  if (flashes.length > 140) return;
  flashes.push({
    x,
    y,
    r,
    l,
    ml: l,
    c
  });
}
export function pop(x, y, s, col = '#e8f1ff', size = 8, l = 50) {
  if (texts.length > 60) texts.shift();
  texts.push({
    x,
    y,
    s,
    col,
    size,
    l,
    ml: l
  });
}
export function gib(x, y, vx, vy, k, s, o = {}) {
  if (gibs.length > 720) return null;
  const g = {
    x,
    y,
    vx,
    vy,
    k,
    s,
    rot: R() * TAU,
    vr: rr(-.35, .35),
    l: rr(170, 260),
    bleed: rr(30, 90),
    stuck: 0,
    ...o
  };
  if (k === 'chunk' || k === 'metal' || k === 'skin') {
    const n = ri(5, 7);
    g.pts = Array.from({
      length: n
    }, (_, i) => {
      const a = i / n * TAU + rr(-.3, .3),
        r = s * rr(.6, 1.15);
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    g.col = k === 'metal' ? pick(['#3a434d', '#56616d', '#2a3038']) : pick([C.flesh, C.fleshD, '#8e3a32', '#a3473c', C.blood]);
    g.fat = k === 'chunk' && R() < .35;
    g.bn = k === 'chunk' && R() < .3;
  }
  if (k === 'rope') {
    g.pts = Array.from({
      length: ri(7, 12)
    }, () => ({
      x,
      y,
      px: x,
      py: y
    }));
    g.vr = 0;
    g.l = rr(220, 320);
  }
  if (k === 'eye') {
    g.iris = pick(['#9bb030', '#3b6fd0', '#6a3b1c', '#b01018']);
    g.pts = Array.from({
      length: 4
    }, () => ({
      x,
      y,
      px: x,
      py: y
    }));
  }
  if (k === 'limb') {
    g.arm = R() < .55;
    g.bleed = rr(160, 300);
    g.boot = R() < .5;
  }
  if (k === 'skull') {
    g.vr = rr(-.25, .25);
    g.bleed = rr(20, 80);
  }
  if (k === 'half') {
    g.jag = Array.from({
      length: 7
    }, (_, i) => [-16 + i * 5.3, rr(-1.8, 1.8)]);
    g.bleed = 200;
  }
  g.ml = g.l;
  gibs.push(g);
  return g;
}
export function mist(x, y, r, l) {
  if (mists.length > 340) return;
  mists.push({
    x,
    y,
    r,
    vr: rr(.15, .45),
    l,
    ml: l
  });
}
export function splat(x, y, sz) {
  if (splats.length > 24) splats.shift();
  const b = [],
    dr = [];
  for (let i = 0; i < 5 + sz * 3; i++) b.push({
    dx: rr(-1, 1) * sz * 11,
    dy: rr(-1, 1) * sz * 7,
    r: rr(2, 5.5) * Math.sqrt(sz)
  });
  for (let i = 0; i < 2 + sz * 2; i++) {
    const k = pick(b);
    dr.push({
      dx: k.dx + rr(-1, 1),
      dy: k.dy,
      len: 0,
      sp: rr(.04, .22),
      w: rr(.8, 2.2)
    });
  }
  for (let i = 0; i < sz * 8; i++) b.push({
    dx: rr(-1, 1) * sz * 20,
    dy: rr(-1, 1) * sz * 14,
    r: rr(.5, 1.4)
  });
  splats.push({
    x,
    y,
    b,
    dr,
    l: 420,
    ml: 420
  });
}
export function gore(x, y, sz, o = {}) {
  const dir = o.dir || 0,
    nd = Math.min(570, 42 + sz * 75);
  for (let k = 0; k < nd; k++) {
    const a = R() * TAU,
      sp = rr(.3, 4.3) * Math.sqrt(sz) * (R() < .2 ? 1.8 : 1);
    const c = o.fire && R() < .4 ? 5 : o.black && R() < .55 ? 3 : o.amnio && R() < .35 ? 4 : R() < .22 ? 2 : R() < .3 ? 1 : 0;
    drop(x + rr(-3, 3) * sz, y + rr(-3, 3) * sz, Math.cos(a) * sp + dir * rr(0, 2.4), Math.sin(a) * sp - .6, rr(1, 1.7 + sz * .5), c, ri(45, 120));
  }
  for (let k = 0; k < 2 + sz * 2.5; k++) mist(x + rr(-5, 5) * sz, y + rr(-5, 5) * sz, rr(3, 7) * (.6 + sz * .4), ri(30, 70));
  const gv = () => [rr(-2.6, 2.6) * Math.sqrt(sz) + dir * rr(.5, 2.2), rr(-2.9, 1.6) * Math.sqrt(sz)];
  for (let k = 0; k < 3 + sz * 3.6; k++) {
    const [vx, vy] = gv();
    gib(x + rr(-4, 4), y + rr(-4, 4), vx, vy, 'chunk', rr(1.8, 3.4) + sz * .5);
  }
  for (let k = 0; k < Math.floor(sz * 2.4); k++) {
    const [vx, vy] = gv();
    gib(x, y, vx, vy, 'bone', rr(2.5, 5.5));
  }
  for (let k = 0; k < (o.teeth || 0) * 2; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx * 1.3, vy * 1.3, 'tooth', 1.3);
  }
  const ne = (o.eyes || 0) * 2 + (sz >= 1 ? ri(0, 2) : 0);
  for (let k = 0; k < ne; k++) {
    const [vx, vy] = gv();
    const g = gib(x, y, vx, vy, 'eye', rr(2.2, 3));
    if (g && o.fire) g.burning = ri(60, 140);
  }
  const sk = o.skull != null ? o.skull + (sz >= 2 ? 1 : 0) : sz >= 1.4 ? ri(1, 1 + Math.floor(sz / 2)) : R() < .3 ? 1 : 0;
  for (let k = 0; k < sk; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx * .9, vy * .9 - .6, 'skull', rr(3, 4.2));
  }
  const lb = o.limbs != null ? o.limbs + (sz >= 2 ? 1 : 0) : sz >= 1.4 ? ri(1, 2 + Math.floor(sz / 2)) : R() < .25 ? 1 : 0;
  for (let k = 0; k < lb; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx * 1.15, vy * 1.15, 'limb', rr(3, 5));
  }
  const ropes = o.rope != null ? o.rope : sz >= 1.4 ? ri(1, Math.ceil(sz) + 1) : R() < .5 ? 1 : 0;
  for (let k = 0; k < ropes; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx * 1.2, vy * 1.2, 'rope', 3);
  }
  if (o.chain) for (let k = 0; k < o.chain; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx, vy, 'rope', 3, {
      chain: 1
    });
  }
  if (o.metal) for (let k = 0; k < o.metal; k++) {
    const [vx, vy] = gv();
    gib(x, y, vx * 1.4, vy * 1.4, 'metal', rr(1.5, 4));
  }
  if (o.half) {
    const e = o.half;
    for (const side of [-1, 1]) {
      const g = gib(e.x, e.y + side * 3, dir * rr(.6, 1.8) + rr(-.5, .5), side * rr(.8, 1.8), 'half', e.r);
      if (g) {
        g.e = e;
        g.side = side;
        g.vr = side * rr(.04, .12);
        g.rot = e.rot || 0;
      }
    }
  }
  flash(x, y, 20 + sz * 16, 9, o.fire ? '255,140,40' : '255,60,40');
  if ($.G) {
    $.G.shake = Math.min(16, $.G.shake + sz * 1.8);
    if (sz >= 3) $.G.hitstop = Math.max($.G.hitstop, 5);
  }
  if (sz >= 3 || sz >= 1.5 && R() < .45) splat(x * .4 + W * .3 + rr(-70, 70), y * .5 + PH * .25 + rr(-40, 40), Math.min(4, sz * .8));
  sfx.gore(sz);
  if (sz >= 3) buzz('heavy');
  else if (sz >= 1.4) buzz('medium');
}

// ---------------- game flow ----------------
