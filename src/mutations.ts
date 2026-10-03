// @ts-nocheck
import { $ } from './state';
import { PH, R, TAU, W, clamp, dist2, rr } from './core';
import { sfx } from './audio';
import { arcs, caps, enemies, shots } from './world';
import { drop, flash, gore, pop, spark } from './fx/spawn';
import { hurt } from './enemies/update';

// ---------------- mutations: you become what you kill ----------------
export const GM = [{
  id: 'rapid',
  c: 'CAD',
  k: 'drone',
  w: 'DRONES',
  n: [36, 150],
  name: 'SWARM CADENCE',
  d: 'faster fire'
}, {
  id: 'pierce',
  c: 'NDL',
  k: 'corpse',
  w: 'CORPSES',
  n: [15, 48],
  name: 'BONE NEEDLES',
  d: 'shots pierce'
}, {
  id: 'seek',
  c: 'LCK',
  k: 'eye',
  w: 'EYES',
  n: [18, 60],
  name: 'OPTIC LOCK',
  d: 'shots home in'
}, {
  id: 'tail',
  c: 'MDB',
  k: 'crawler',
  w: 'CRAWLERS',
  n: [15, 54],
  name: 'REAR MANDIBLE',
  d: 'tail guns'
}, {
  id: 'ripple',
  c: 'RPL',
  k: 'cross',
  w: 'CROSSES',
  n: [12, 42],
  name: 'HALO RIPPLE',
  d: 'shots widen into rings'
}, {
  id: 'chain',
  c: 'ARC',
  k: 'hook',
  w: 'HOOKS',
  n: [9, 27],
  name: 'MEATHOOK ARC',
  d: 'hits arc to more targets'
}, {
  id: 'serr',
  c: 'EDG',
  k: 'flayer',
  w: 'FLAYERS',
  n: [9, 30],
  name: 'FLAYED EDGE',
  d: '+30% damage'
}, {
  id: 'over',
  c: 'GLT',
  k: 'maw',
  w: 'MAWS',
  n: [2, 4],
  name: 'GLUTTONY',
  d: 'critical hits'
}, {
  id: 'cal',
  c: 'CAL',
  k: '*',
  w: 'KILLS',
  n: [120, 400, 800],
  name: 'CALIBER',
  d: 'bigger, harder rounds'
}, {
  id: 'regrow',
  c: 'RGR',
  k: 'womb',
  w: 'WOMBS',
  n: [8, 24],
  name: 'REGROWTH',
  d: 'membrane regrows',
  sh: 1
}, {
  id: 'spore',
  c: 'SPR',
  k: 'hatch',
  w: 'HATCHLINGS',
  n: [20, 60],
  name: 'SPORE COAT',
  d: 'shield hits burst back',
  sh: 1
}];
export const ROM = ['', 'I', 'II', 'III', 'IV'];
export const gmL = id => $.G && $.G.gm ? $.G.gm[id] || 0 : 0;
export const gunSlots = () => Math.min(3, 1 + ($.G && $.G.seal || 0));
export function countKill(e) {
  if (!$.G || !$.G.gm) return;
  const k = e.k;
  $.G.kk[k] = ($.G.kk[k] || 0) + 1;
  $.G.gmk++;
  $.G.gpend = $.G.gpend || {};
  for (const m of GM) {
    if (m.k !== k && m.k !== '*') continue;
    const c = m.k === '*' ? $.G.gmk : $.G.kk[k],
      l = gmL(m.id);
    if (l < m.n.length && c >= m.n[l] && !$.G.gpend[m.id]) {
      $.G.gpend[m.id] = 1;
      caps.push({
        x: clamp(e.x, 8, W - 8),
        y: clamp(e.y, 8, PH - 8),
        tx: clamp(e.x, W * .42, W - 60),
        ty: clamp(e.y, 30, PH - 34),
        t: 0,
        graft: m.id,
        glv: l + 1
      });
      $.G.feed = {
        s: 'GRAFT GROWN // ' + m.name + ' ' + ROM[l + 1],
        d: 'grab it: ' + m.d,
        t: 150,
        ml: 150
      };
      sfx.pick();
    }
  }
}
export function gunHeld() {
  return GM.filter(q => !q.sh && gmL(q.id) > 0);
}
export function graftSwap(id) {
  const m = GM.find(q => q.id === id);
  if (m.sh || gmL(id) > 0) return null;
  const h = gunHeld();
  if (h.length < gunSlots()) return null;
  $.G.gorder = $.G.gorder || [];
  for (const x of $.G.gorder) {
    const q = GM.find(z => z.id === x);
    if (!q.sh && gmL(x) > 0) return q;
  }
  return h[0];
}
export function graftTake(id) {
  const m = GM.find(q => q.id === id),
    l = gmL(id);
  $.G.gpend[id] = 0;
  if (l >= m.n.length) return;
  const old = graftSwap(id);
  if (old) {
    $.G.gm[old.id] = 0;
    pop($.P.x, $.P.y + 14, old.name + ' SLOUGHED', '#8a5a5a', 7, 60);
    gore($.P.x - 6, $.P.y, .6, {});
  }
  $.G.gm[id] = l + 1;
  $.G.gorder = ($.G.gorder || []).filter(x => x !== id);
  $.G.gorder.push(id);
  $.G.feed = {
    s: (m.sh ? 'SHIELD' : 'GUN') + ' GRAFT // ' + m.name + ' ' + ROM[l + 1],
    d: m.d,
    t: 170,
    ml: 170
  };
  sfx.power();
  setTimeout(() => sfx.pick(), 120);
  pop($.P.x, $.P.y - 18, m.name + ' ' + ROM[l + 1], m.sh ? '#9fd2ff' : '#ffb070', 8, 70);
  flash($.P.x, $.P.y, 46, 12, m.sh ? '120,180,255' : '255,150,60');
}
export function critMul(x, y) {
  const o = gmL('over');
  if (o && R() < [0, .1, .18][o]) {
    pop(x, y - 6, 'CRIT', '#ffd23a', 8, 24);
    for (let k = 0; k < 6; k++) spark(x, y, rr(-2, 2), rr(-2, 2), 8, '#ffd23a');
    return 2;
  }
  return 1;
}
export function chainArc(e, d) {
  const L = gmL('chain');
  if (!L) return;
  let src = e;
  const hs = [e];
  for (let j = 0; j < L; j++) {
    let best = null,
      bd = 75 * 75;
    for (const q of enemies) {
      if (q.dead || hs.includes(q)) continue;
      const dd = dist2(src.x, src.y, q.x, q.y);
      if (dd < bd) {
        bd = dd;
        best = q;
      }
    }
    if (!best) break;
    arcs.push({
      x1: src.x,
      y1: src.y,
      x2: best.x,
      y2: best.y,
      l: 9
    });
    hs.push(best);
    hurt(best, d * .4, best.x, best.y, 1);
    src = best;
  }
}
export function sporeBurst() {
  const L = gmL('spore');
  if (!L) return;
  const n = [0, 6, 10][L];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU;
    shots.push({
      k: 'bolt',
      x: $.P.x,
      y: $.P.y,
      vx: Math.cos(a) * 5,
      vy: Math.sin(a) * 5,
      dmg: 1.2,
      r: 2,
      spore: 1
    });
  }
  for (let k = 0; k < 14; k++) drop($.P.x, $.P.y, rr(-2, 2), rr(-2, 2), 1.2, 4, 40);
}

// ---------------- player ----------------
