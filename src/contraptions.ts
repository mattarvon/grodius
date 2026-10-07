// @ts-nocheck
// Contraptions: permanent ship modules bought in the Infirmary with biomass and bolted into sockets.
// Each one is real gameplay (logic: stepContraptions / hooks below) AND a visible, animated part on the hull
// (drawn by render/ship.ts from rigged()). Sockets start at 1; SOCKET upgrades in the Infirmary add more.
// meta.rig  = ids currently bolted on (persisted).  meta.own = ids bought (persisted).  meta.cl[id] = upgrade level 1..3.
//
// LIVE STATE for the ship art (render/ship.ts), always present on $.P.rig (see rigFresh):
//   saw.spin 0..1   gut.charge 0..1   leech.fill 0..1   spine.cd 0..1 (reload progress)
//   hook {phase 0..1 (0 idle, .5 at target, 1 home), tx, ty}   furnace.heat 0..1   choir.chg 0..1
// Anchors (ship centre): saw prow (+14,0), gut belly (+6,+7), leech heart (-2,-8), spine rack (-6,-7),
// hook arm (+2,+8), furnace stacks (-14,±4), choir ring r~12.
import { $ } from './state';
import { FIRE, PH, R, TAU, W, clamp, ctx, dist2, pick, ri, rr, swapRm } from './core';
import { caps, ceilAt, enemies, eshots, floorAt, orbs } from './world';
import { hurt } from './enemies/update';
import { bossHitByShot } from './boss/update';
import { drop, flash, gib, gore, mist, pop, spark } from './fx/spawn';
import { sample, sfx } from './audio';
import { I } from './input';
import { SET } from './save';
import { WARD_MAX } from './player';
import { drawChain, drawHookTip, light } from './render/util';

/** id, name, Infirmary blurb, buy cost, level-up costs (lvl 2, 3). Logic/visual owners key off `id`. */
export const RIG = [
  { id: 'saw', name: 'BONE SAW', desc: 'A buzzsaw of sharpened ribs on the prow. Ram enemies to shred them.', cost: 180, up: [260, 420] },
  { id: 'gut', name: 'GUT CANNON', desc: 'A belly cannon that coughs a piercing slug of bone and offal every few seconds.', cost: 220, up: [300, 480] },
  { id: 'leech', name: 'LEECH PUMP', desc: 'A pumping heart on the spine. Kills fill its vial; a full vial regrows a WARD hit (or grants one).', cost: 260, up: [340, 520] },
  { id: 'spine', name: 'SPINE LAUNCHER', desc: 'Dorsal quill rack. Fires a volley of homing spines at the nearest enemies.', cost: 240, up: [320, 500] },
  { id: 'hook', name: 'MEAT WINCH', desc: 'A chain-and-hook arm that harpoons an enemy, rips it open and reels its pods in.', cost: 200, up: [280, 460] },
  { id: 'furnace', name: 'FURNACE BELLY', desc: 'Stoked exhaust stacks. Faster ship, and a trail of burning slag behind you.', cost: 200, up: [280, 440] },
  { id: 'choir', name: 'CHOIR OF MOUTHS', desc: 'A ring of screaming mouths. At a 10-kill chain they scream and wipe nearby enemy bullets.', cost: 300, up: [380, 560] },
];
export const RIG_BY = Object.fromEntries(RIG.map((r) => [r.id, r]));
/** sockets: 1 base, +1 per Infirmary 'socket' level (max 3 sockets) */
export const SOCKET_COST = [400, 900];
export const SOCKET_MAX = 3;

// ---------------- tuning (index = level 1..3) ----------------
const T = {
  saw: { r: [0, 8, 10, 12], dmg: [0, 1.1, 1.7, 2.6], chip: [0, .14, .22, .34] },
  gut: { per: [0, 170, 135, 100], dmg: [0, 12, 17, 24], r: [0, 5, 6, 7.5], shards: [0, 0, 0, 9] },
  leech: { need: [0, 22, 16, 12] },
  spine: { per: [0, 120, 95, 72], n: [0, 3, 4, 6], dmg: [0, 2.6, 3, 3.6] },
  hook: { per: [0, 150, 115, 85], dmg: [0, 14, 22, 32], reach: [0, 170, 200, 235], pull: [0, 130, 170, 220] },
  furnace: { spd: [0, .45, .65, .85], life: [0, 45, 70, 100], burn: [0, 70, 100, 140], dmg: [0, .5, .8, 1.1] },
  choir: { need: [0, 10, 8, 6], rad: [0, 105, 135, 170], dmg: [0, 3, 4.5, 7] },
};
/** one line per level, shown in the Infirmary */
export const RIG_LV = {
  saw: ['Shreds small meat on contact. Front rams are free.', 'Bigger blade, +55% bite', 'Huge blade, 2.4x bite, chews big things'],
  gut: ['Piercing slug every 2.8s', 'Every 2.2s, bigger, harder', 'Every 1.7s, bursts into 9 bone shards'],
  leech: ['22 kills = +1 WARD hit', '16 kills = +1 WARD hit', '12 kills, overflow grows BONE AEGIS'],
  spine: ['3 homing spines every 2s', '4 spines every 1.6s', '6 spines every 1.2s'],
  hook: ['Rips small meat apart, reels pods in', 'Every 1.9s, longer chain', 'Every 1.4s, 32 dmg, huge reel'],
  furnace: ['+speed, burning slag trail', 'Hotter, longer trail', 'Fastest ship, slag lingers 1.7s'],
  choir: ['Scream every 10 chain', 'Every 8 chain, wider', 'Every 6 chain, huge, wounds'],
};

export function rigInit() {
  const m = $.meta;
  if (!Array.isArray(m.rig)) m.rig = [];
  if (!Array.isArray(m.own)) m.own = [];
  if (!m.cl || typeof m.cl !== 'object') m.cl = {};
  m.own = m.own.filter((id, i, a) => RIG_BY[id] && a.indexOf(id) === i);
  m.rig = m.rig.filter((id, i, a) => RIG_BY[id] && m.own.includes(id) && a.indexOf(id) === i);
  for (const id of m.own) m.cl[id] = clamp(Math.floor(+m.cl[id] || 1), 1, 3);
  m.lv ||= {};
  if (m.lv.socket) m.lv.socket = clamp(m.lv.socket | 0, 0, SOCKET_COST.length);
}
export const sockets = () => 1 + (($.meta.lv && $.meta.lv.socket) || 0);
/** contraptions bolted on this run: [{id, lvl}] */
export const rigged = () => ($.meta.rig || []).filter((id) => RIG_BY[id]).slice(0, sockets()).map((id) => ({ id, lvl: ($.meta.cl && $.meta.cl[id]) || 1 }));
export const rigLv = (id) => { const r = rigged().find((q) => q.id === id); return r ? r.lvl : 0; };

/** fresh per-life live state (render/ship.ts reads this) */
export const rigFresh = () => ({
  saw: { spin: 0, rot: 0 },
  gut: { charge: 0, kick: 0 },
  leech: { fill: 0, pulse: 0 },
  spine: { cd: 1 },
  hook: { phase: 0, tx: 0, ty: 0, st: 0, e: null, cd: 0, reel: 0, d0: 1 },
  furnace: { heat: 0 },
  choir: { chg: 0, base: 0, yell: 0 },
});
export const rigState = () => ($.P ? ($.P.rig ||= rigFresh()) : rigFresh());

// ---------------- projectiles / fx owned here ----------------
const slugs = [], spines = [], shards = [], slag = [], rings = [];
/** debug stats for tools/rig-probe.mjs: damage + kills per contraption this page load */
export const RST = { dmg: {}, kills: {}, wiped: 0, wards: 0, screams: 0 };
let SRC = null;
export const rigFX = () => ({ slugs: slugs.length, spines: spines.length, shards: shards.length, slag: slag.length, rings: rings.length });
export function resetContraptions() {
  slugs.length = spines.length = shards.length = slag.length = rings.length = 0;
}
function hit(e, d, src, x = e.x, y = e.y, dir = 1) {
  if (e.dead) return;
  RST.dmg[src] = (RST.dmg[src] || 0) + Math.min(d, Math.max(0, e.hp));
  const was = SRC;
  SRC = src;
  hurt(e, d, x, y, dir);
  SRC = was;
}
const eyY = (e) => (e.k === 'eye' ? e.y - e.o * 9 : e.y);
const live = (e) => !e.dead && !(e.ghost > 0) && e.x > -10 && e.x < W + 6;
function bossHit(x, y, r, d) {
  if (!$.G.boss) return false;
  return bossHitByShot({ k: 'rig', x, y, r, dmg: d });
}
const solid = (x, y) => { const wx = x + $.G.scroll; return y >= floorAt(wx) || y <= ceilAt(wx); };

/** call from killEnemy */
export function onKillContraptions(e) {
  const src = SRC;
  if (src) RST.kills[src] = (RST.kills[src] || 0) + 1;
  if (!$.P || !$.P.alive || $.state !== 'play') return;
  const R = rigState();
  if (src === 'saw') R.saw.spin = Math.min(1, R.saw.spin + .3);
  const lL = rigLv('leech');
  if (lL && !e.par) R.leech.fill = Math.min(1, R.leech.fill + 1 / T.leech.need[lL]);
}

// ---------------- per-frame logic ----------------
export function stepContraptions() {
  const P = $.P;
  if (!P || !$.G) return;
  const R = rigState(), L = {};
  for (const r of rigged()) L[r.id] = r.lvl;
  const alive = P.alive && $.state === 'play';
  if (alive) {
    if (L.furnace) furnace(P, R.furnace, L.furnace);
    if (L.saw) saw(P, R.saw, L.saw);
    if (L.gut) gut(P, R.gut, L.gut);
    if (L.leech) leech(P, R.leech, L.leech);
    if (L.spine) spineRack(P, R.spine, L.spine);
    if (L.hook) winch(P, R.hook, L.hook);
    if (L.choir) choir(P, R.choir, L.choir);
  } else {
    R.hook.phase = 0;
    R.hook.st = 0;
    R.furnace.heat *= .95;
    R.saw.spin *= .95;
  }
  updSlugs();
  updSpines();
  updShards();
  updSlag();
  for (let i = rings.length - 1; i >= 0; i--) if (++rings[i].t >= rings[i].ml) swapRm(rings, i);
}

// BONE SAW: prow contact grinds anything small; a front-on ram never hurts you
function saw(P, S, lv) {
  S.spin = Math.max(0, S.spin - .006);
  S.rot += .25 + S.spin * .6;
  const px = P.x + 14, py = P.y, sr = T.saw.r[lv] + S.spin * 2;
  let grind = 0;
  for (const e of enemies) {
    if (!live(e)) continue;
    const ey = eyY(e), rr2 = (sr + e.r) * (sr + e.r);
    if (dist2(px, py, e.x, ey) > rr2) continue;
    grind++;
    if (e.big) {
      hit(e, T.saw.chip[lv] * (1 + S.spin), 'saw', px + 2, py, 1);
    } else {
      // anything that would also touch the hull this frame from the front gets shredded first: no ram damage
      const touching = dist2(e.x, ey, P.x, P.y) < (e.r + 6) ** 2 && e.x >= P.x - 2;
      hit(e, touching ? 999 : T.saw.dmg[lv] * (1 + .6 * S.spin), 'saw', px + 2, py, 1);
      if (!e.dead) e.x += 1.2; // the blade shoves meat back off the hull
    }
    if (R() < .6) spark(px + rr(0, 4), py + rr(-sr, sr), rr(.5, 3), rr(-2.5, 2.5), ri(5, 12), R() < .5 ? '#f0e2c0' : '#ffb347');
    if (R() < .5) drop(px + 3, py + rr(-3, 3), rr(.5, 3), rr(-2, 2), rr(1, 1.6), R() < .3 ? 2 : 0, ri(40, 90));
  }
  if ($.G.boss && $.G.t % 4 === 0 && bossHit(px + 2, py, sr, T.saw.chip[lv] * 4)) {
    grind++;
    for (let k = 0; k < 3; k++) spark(px + 3, py, rr(-1, 2), rr(-2, 2), 8, '#f0e2c0');
  }
  if (grind) {
    S.spin = Math.min(1, S.spin + .02);
    $.G.shake = Math.max($.G.shake, .8);
    if ($.G.t % 7 === 0 && !sample('bone', { vol: .35, rate: 1.5, spread: .2, wet: .05 })) sfx.hit();
  }
}

// GUT CANNON: charges, holds at full until something is ahead, coughs a piercing slug
function gut(P, S, lv) {
  S.kick *= .85;
  if (S.charge < 1) S.charge = Math.min(1, S.charge + 1 / T.gut.per[lv]);
  if (S.charge < 1 || slugs.length > 5) return;
  let ahead = !!($.G.boss && !$.G.boss.dying);
  if (!ahead) for (const e of enemies) if (live(e) && e.x > P.x + 10 && Math.abs(eyY(e) - P.y) < 50) { ahead = true; break; }
  if (!ahead) return;
  S.charge = 0;
  S.kick = 1;
  const x = P.x + 12, y = P.y + 7;
  slugs.push({ x, y, vx: 6.2, vy: 0, r: T.gut.r[lv], dmg: T.gut.dmg[lv], lv, hit: new Set(), t: 0, kills: 0 });
  P.x = Math.max(10, P.x - 1.5);
  $.G.shake = Math.max($.G.shake, 2.5);
  flash(x + 4, y, 16, 6, '255,170,120');
  for (let k = 0; k < 14; k++) drop(x + 3, y, rr(1, 4), rr(-1.2, 1.2), rr(1.2, 2), R() < .4 ? 2 : 0, ri(40, 80));
  if (!sample('thud', { vol: .9, rate: .8, wet: .1 })) sfx.bomb();
  sample('splat_m', { vol: .45, rate: .9 });
}
function slugBurst(s) {
  if (s.lv < 3) return;
  for (let k = 0; k < T.gut.shards[3] && shards.length < 40; k++) {
    const a = (k / T.gut.shards[3]) * TAU + rr(-.2, .2), v = rr(3.5, 5);
    shards.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 26, a });
  }
  flash(s.x, s.y, 24, 8, '255,220,180');
  gore(s.x, s.y, .6, { teeth: 2 });
  sample('splat_l', { vol: .6, rate: 1.1 });
}
function updSlugs() {
  for (let i = slugs.length - 1; i >= 0; i--) {
    const s = slugs[i];
    s.t++;
    s.x += s.vx;
    s.y += s.vy + Math.sin(s.t * .5) * .3;
    if (s.t % 2 === 0) drop(s.x - 4, s.y, rr(-1.5, -.3), rr(-.4, .4), 1.2, R() < .5 ? 0 : 1, 50);
    let dead = false;
    if (solid(s.x, s.y)) dead = true;
    if (!dead) for (const e of enemies) {
      if (e.dead || s.hit.has(e)) continue;
      const ey = eyY(e);
      if (dist2(s.x, s.y, e.x, ey) > (s.r + e.r) ** 2) continue;
      s.hit.add(e);
      hit(e, s.dmg, 'gut', s.x, s.y, 1);
      gore(s.x, s.y, .4, {});
      if (e.dead) s.kills++;
      if (e.big || (s.lv >= 3 && s.kills >= 3)) { dead = true; break; }
    }
    if (!dead && bossHit(s.x, s.y, s.r, s.dmg)) dead = true;
    if (dead) slugBurst(s);
    if (dead || s.x > W + 12) swapRm(slugs, i);
  }
}
function updShards() {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += .05;
    let dead = --s.l <= 0 || solid(s.x, s.y);
    if (!dead) for (const e of enemies) if (!e.dead && dist2(s.x, s.y, e.x, eyY(e)) < (e.r + 2) ** 2) { hit(e, 3, 'gut', s.x, s.y, Math.sign(s.vx) || 1); dead = true; break; }
    if (!dead && bossHit(s.x, s.y, 2, 2)) dead = true;
    if (dead) swapRm(shards, i);
  }
}

// LEECH PUMP: kills fill the vial; full vial = one WARD hit (a membrane if you had none); lvl 3 overflows into AEGIS
function leech(P, S, lv) {
  S.pulse = Math.max(0, S.pulse - .05);
  if (S.fill < 1) return;
  if (!(P.wardLv > 0)) {
    P.wardLv = 1;
    P.shield = 1;
    pop(P.x, P.y - 16, 'MEMBRANE GROWN', '#ff8aa0', 8, 50);
  } else if (P.shield < WARD_MAX) {
    P.shield = Math.min(WARD_MAX, Math.floor(P.shield) + 1);
    pop(P.x, P.y - 16, '+1 WARD', '#ff8aa0', 8, 40);
  } else if (lv >= 3 && P.aegis < 12) {
    P.aegis = Math.min(12, (P.aegis || 0) + 4);
    pop(P.x, P.y - 16, 'AEGIS', '#f0e2c0', 8, 40);
  } else return; // brimming: hold the vial full until it's needed
  S.fill = 0;
  S.pulse = 1;
  RST.wards++;
  sfx.heart();
  sample('splat_s', { vol: .5, rate: .8 });
  flash(P.x - 2, P.y - 8, 18, 8, '255,60,90');
  for (let k = 0; k < 12; k++) { const a = R() * TAU; spark(P.x - 2, P.y - 8, Math.cos(a) * 2, Math.sin(a) * 2, 14, '#ff8aa0'); }
}

// SPINE LAUNCHER: dorsal volley of homing quills
function spineRack(P, S, lv) {
  const per = T.spine.per[lv];
  if (S.cd < 1) { S.cd = Math.min(1, S.cd + 1 / per); return; }
  const tg = [];
  for (const e of enemies) if (live(e) && e.x > P.x - 40) tg.push([dist2(e.x, e.y, P.x, P.y), e]);
  if (!tg.length && !($.G.boss && !$.G.boss.dying)) return;
  tg.sort((a, b) => a[0] - b[0]);
  S.cd = 0;
  const n = T.spine.n[lv];
  for (let k = 0; k < n && spines.length < 40; k++) {
    const a = -Math.PI / 2 - .9 + (k / Math.max(1, n - 1)) * 1.4;
    spines.push({ x: P.x - 6 + k, y: P.y - 8, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, e: tg.length ? tg[k % tg.length][1] : null, dmg: T.spine.dmg[lv], l: 110, t: 0 });
  }
  sample('bone', { vol: .4, rate: 1.9, spread: .1 });
  sfx.lash();
}
function updSpines() {
  for (let i = spines.length - 1; i >= 0; i--) {
    const s = spines[i];
    s.t++;
    if (!s.e || s.e.dead) {
      s.e = null;
      if (s.t % 6 === 0) { let bd = 220 * 220; for (const e of enemies) if (live(e)) { const d = dist2(e.x, e.y, s.x, s.y); if (d < bd) { bd = d; s.e = e; } } }
    }
    let tx = s.x + s.vx * 10, ty = s.y + s.vy * 10;
    if (s.e) { tx = s.e.x; ty = eyY(s.e); } else if ($.G.boss && !$.G.boss.dying) { tx = $.G.boss.x; ty = $.G.boss.y; }
    const sp = Math.min(6, 2.2 + s.t * .12), a = Math.atan2(s.vy, s.vx), want = Math.atan2(ty - s.y, tx - s.x);
    let d = want - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    const na = a + clamp(d, -.16, .16);
    s.vx = Math.cos(na) * sp;
    s.vy = Math.sin(na) * sp;
    s.x += s.vx;
    s.y += s.vy;
    let dead = --s.l <= 0 || s.x > W + 10 || s.x < -10 || s.y < -10 || s.y > PH + 10 || (s.t > 8 && solid(s.x, s.y));
    if (!dead) for (const e of enemies) if (!e.dead && dist2(s.x, s.y, e.x, eyY(e)) < (e.r + 2) ** 2) {
      hit(e, s.dmg, 'spine', s.x, s.y, Math.sign(s.vx) || 1);
      for (let k = 0; k < 3; k++) spark(s.x, s.y, rr(-1, 1), rr(-1, 1), 7, '#f0e2c0');
      dead = true;
      break;
    }
    if (!dead && bossHit(s.x, s.y, 2, s.dmg)) dead = true;
    if (dead) swapRm(spines, i);
  }
}

// MEAT WINCH: harpoon, rip, reel the pods in
function winch(P, H, lv) {
  const ax = P.x + 2, ay = P.y + 8;
  if (H.reel > 0) {
    H.reel--;
    const pr = T.hook.pull[lv];
    for (const c of caps) {
      if (c.choice) continue;
      const d = Math.sqrt(dist2(c.x, c.y, P.x, P.y)) || 1;
      if (d < pr) { const f = Math.min(d, 4.5); c.x += ((P.x - c.x) / d) * f; c.y += ((P.y - c.y) / d) * f; }
    }
    for (const o of orbs) {
      const d = Math.sqrt(dist2(o.x, o.y, P.x, P.y)) || 1;
      if (d < pr) { const f = Math.min(d, 5); o.x += ((P.x - o.x) / d) * f; o.y += ((P.y - o.y) / d) * f; }
    }
  }
  if (H.st === 0) {
    H.phase = 0;
    H.tx = ax;
    H.ty = ay;
    if (H.cd > 0) { H.cd--; return; }
    let best = null, bd = T.hook.reach[lv] ** 2;
    for (const e of enemies) {
      if (!live(e) || e.x < P.x - 10 || e.k === 'nailbar') continue;
      const d = dist2(e.x, eyY(e), ax, ay);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    H.st = 1;
    H.e = best;
    H.d0 = Math.sqrt(bd) || 1;
    sfx.chain();
    sfx.lash();
  } else if (H.st === 1) {
    const e = H.e;
    if (!e || e.dead) { H.st = 2; return; }
    const ex = e.x, ey = eyY(e), d = Math.sqrt(dist2(H.tx, H.ty, ex, ey)) || 1, v = 10;
    if (d <= v + e.r * .5) {
      H.tx = ex;
      H.ty = ey;
      if (!e.big) {
        hit(e, 999, 'hook', ex, ey, -1);
        for (let k = 0; k < 2; k++) gib(ex, ey, rr(-2.5, -.5), rr(-1.5, 1.5), 'chunk', rr(1.8, 2.6));
      } else hit(e, T.hook.dmg[lv], 'hook', ex, ey, -1);
      mist(ex, ey, 6, 30);
      flash(ex, ey, 18, 6, '255,90,80');
      $.G.shake = Math.max($.G.shake, 3);
      $.G.hitstop = Math.max($.G.hitstop, 2);
      if (!sample('splat_l', { vol: .7, rate: 1 })) sfx.squish();
      H.st = 2;
      H.reel = 70;
    } else {
      H.tx += ((ex - H.tx) / d) * v;
      H.ty += ((ey - H.ty) / d) * v;
      if (Math.sqrt(dist2(H.tx, H.ty, ax, ay)) > T.hook.reach[lv] + 40) H.st = 2;
    }
    H.phase = .5 * clamp(1 - d / Math.max(H.d0, d), 0, 1);
  } else {
    const d = Math.sqrt(dist2(H.tx, H.ty, ax, ay)) || 1, v = 8;
    if (R() < .5) drop(H.tx, H.ty, rr(-.5, .5), rr(0, 1), 1.2, 0, 60);
    if (d <= v) {
      H.st = 0;
      H.cd = T.hook.per[lv];
      H.phase = 0;
      sfx.chain();
      return;
    }
    H.tx += ((ax - H.tx) / d) * v;
    H.ty += ((ay - H.ty) / d) * v;
    H.phase = .5 + .5 * clamp(1 - d / Math.max(H.d0, d), 0, 1);
  }
}

// FURNACE BELLY: extra thrust + burning slag dropped out the stacks
function furnace(P, S, lv) {
  let dx = I.x, dy = I.y;
  if (dx && dy) { dx *= .75; dy *= .75; }
  const sp = T.furnace.spd[lv];
  if (dx || dy) {
    P.x = clamp(P.x + dx * sp, 10, W - 16);
    P.y = clamp(P.y + dy * sp, 6, PH - 6);
  }
  // heat + trail follow real movement (keys, pad or touch drag)
  const mv = S.px != null && dist2(P.x, P.y, S.px, S.py) > .25;
  S.px = P.x;
  S.py = P.y;
  S.heat += ((mv ? 1 : .45) - S.heat) * .04;
  const every = mv ? 3 : 6;
  if ($.G.t % every === 0 && slag.length < 140) {
    for (const oy of [-4, 4]) slag.push({ x: P.x - 15, y: P.y + oy + rr(-1, 1), vx: rr(-1.4, -.6), vy: rr(-.2, .4), l: T.furnace.life[lv], ml: T.furnace.life[lv], r: rr(2.8, 4.2) * (.7 + .3 * S.heat), lv });
  }
  if (R() < .5) spark(P.x - 15, P.y + (R() < .5 ? -4 : 4), rr(-2, -.6), rr(-.6, .1), ri(6, 14), pick(FIRE));
}
function updSlag() {
  const ss = $.G.scrollSpeed;
  for (let i = slag.length - 1; i >= 0; i--) {
    const s = slag[i];
    s.x += s.vx - ss * .8;
    s.y += s.vy;
    s.vx *= .96;
    s.vy = Math.min(1, s.vy + .02);
    if (solid(s.x, s.y)) { s.vy = 0; s.y -= .5; }
    if (--s.l <= 0 || s.x < -8) { swapRm(slag, i); continue; }
    if ((s.l + i) % 3) continue;
    for (const e of enemies) {
      if (e.dead || dist2(s.x, s.y, e.x, eyY(e)) > (s.r + e.r) ** 2) continue;
      e.burn = Math.max(e.burn || 0, T.furnace.burn[s.lv]);
      hit(e, T.furnace.dmg[s.lv], 'furnace', s.x, s.y, 1);
    }
  }
}

// CHOIR OF MOUTHS: chain kills charge it; every N chain it screams
function choir(P, S, lv) {
  S.yell = Math.max(0, S.yell - .03);
  const c = $.G.combo || 0, need = T.choir.need[lv];
  if (c < S.base) S.base = 0;
  S.chg = clamp((c - S.base) / need, 0, 1);
  if (c - S.base < need) return;
  S.base = c;
  S.chg = 0;
  S.yell = 1;
  scream(P, lv);
}
function scream(P, lv) {
  const rad = T.choir.rad[lv];
  RST.screams++;
  rings.push({ x: P.x, y: P.y, t: 0, ml: 26, r: rad });
  let n = 0;
  for (let i = eshots.length - 1; i >= 0; i--) {
    const q = eshots[i];
    if (dist2(q.x, q.y, P.x, P.y) < rad * rad) {
      for (let k = 0; k < 2; k++) drop(q.x, q.y, rr(-1, 1), rr(-1, 1), 1.3, 0, 70);
      swapRm(eshots, i);
      n++;
    }
  }
  RST.wiped += n;
  for (const e of enemies) {
    if (e.dead || dist2(e.x, e.y, P.x, P.y) > (rad * 1.1) ** 2) continue;
    e.chill = Math.max(e.chill || 0, 130);
    if (e.cool != null) e.cool += 75;
    hit(e, T.choir.dmg[lv] * (e.big ? .5 : 1), 'choir', e.x, e.y, Math.sign(e.x - P.x) || 1);
  }
  $.G.shake = Math.max($.G.shake, 6);
  $.G.glitch = Math.max($.G.glitch || 0, 6);
  flash(P.x, P.y, 40, 10, SET.flashes ? '255,235,220' : '160,140,130');
  pop(P.x, P.y - 22, n ? 'THE CHOIR SCREAMS  ' + n + ' SILENCED' : 'THE CHOIR SCREAMS', '#ffd0c0', 8, 50);
  sfx.roar();
  sample('splat_l', { vol: .5, rate: .7 });
}

// ---------------- drawing (called from drawWorld, under the ship) ----------------
export function drawContraptionFX() {
  if (!$.G) return;
  const c = ctx;
  // slag: dull crust with a hot core
  if (slag.length) {
    for (const s of slag) {
      const k = s.l / s.ml;
      c.fillStyle = k > .5 ? '#5a1a08' : '#2a0c06';
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'lighter';
    for (const s of slag) {
      const k = s.l / s.ml;
      c.fillStyle = `rgba(255,${(90 + 120 * k) | 0},30,${.35 + .55 * k})`;
      c.beginPath();
      c.arc(s.x, s.y, s.r * (.45 + .3 * k), 0, TAU);
      c.fill();
    }
    for (let i = 0; i < slag.length; i += 6) light(slag[i].x, slag[i].y, 16, .5 * slag[i].l / slag[i].ml);
    c.globalCompositeOperation = 'source-over';
  }
  // winch chain + hook tip
  if ($.P && $.P.alive && $.P.rig && $.P.rig.hook.st) {
    const H = $.P.rig.hook, ax = $.P.x + 2, ay = $.P.y + 8;
    drawChain(c, ax, ay, H.tx, H.ty, 1.2);
    drawHookTip(c, H.tx, H.ty, Math.atan2(H.ty - ay, H.tx - ax) - Math.PI / 2, 1.2);
  }
  // slugs: wet bone-and-offal lumps
  for (const s of slugs) {
    c.fillStyle = '#4a0a10';
    c.beginPath();
    c.ellipse(s.x - 2, s.y, s.r + 3, s.r * .8, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#a3242c';
    c.beginPath();
    c.ellipse(s.x, s.y, s.r + 1, s.r * .7, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#e8d8b4';
    for (let k = 0; k < 3; k++) { const a = s.t * .3 + k * 2.1; c.fillRect(s.x + Math.cos(a) * s.r * .6 - 1, s.y + Math.sin(a) * s.r * .5 - 1, 2.2, 2.2); }
    light(s.x, s.y, 24, .7);
  }
  // spines + shards: pale quills
  c.strokeStyle = '#5a1418';
  c.lineWidth = 2.6;
  c.beginPath();
  for (const s of spines) { const sp = Math.hypot(s.vx, s.vy) || 1; c.moveTo(s.x, s.y); c.lineTo(s.x - (s.vx / sp) * 8, s.y - (s.vy / sp) * 8); }
  c.stroke();
  c.strokeStyle = '#efe2c2';
  c.lineWidth = 1.3;
  c.beginPath();
  for (const s of spines) { const sp = Math.hypot(s.vx, s.vy) || 1; c.moveTo(s.x, s.y); c.lineTo(s.x - (s.vx / sp) * 8, s.y - (s.vy / sp) * 8); }
  for (const s of shards) { c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx, s.y - s.vy); }
  c.stroke();
  c.fillStyle = '#7a1418';
  for (const s of spines) c.fillRect(s.x - .7, s.y - .7, 1.4, 1.4);
  // saw sparks of light while grinding
  if ($.P && $.P.alive && $.P.rig && $.P.rig.saw.spin > .2 && rigLv('saw')) light($.P.x + 16, $.P.y, 22, .5 * $.P.rig.saw.spin);
  // choir scream: a ring of mouths blasting outward
  for (const g of rings) {
    const k = g.t / g.ml, r = g.r * (.25 + .75 * Math.sqrt(k)), a = 1 - k;
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,210,190,${.55 * a})`;
    c.lineWidth = 3 * a + .5;
    c.beginPath();
    c.arc(g.x, g.y, r, 0, TAU);
    c.stroke();
    c.strokeStyle = `rgba(200,30,40,${.5 * a})`;
    c.lineWidth = 7 * a;
    c.beginPath();
    c.arc(g.x, g.y, r * .92, 0, TAU);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgba(20,0,2,${.8 * a})`;
    for (let m = 0; m < 12; m++) {
      const an = (m / 12) * TAU + g.t * .05, mx = g.x + Math.cos(an) * r, my = g.y + Math.sin(an) * r;
      c.beginPath();
      c.ellipse(mx, my, 3.2, 1.6 + 1.6 * Math.sin(g.t * .6 + m), an, 0, TAU);
      c.fill();
    }
    light(g.x, g.y, r, .6 * a);
  }
}
