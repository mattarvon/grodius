// @ts-nocheck
// ELITES (docs/pacing.md 3.8): from Descent 2 on, some biome-stage spawns come out of the deep sick. eliteify() runs on
// an enemy AFTER mk() has built it (base HP, fire rates, mk() and ET stay untouched; this only changes that one
// instance): more HP, faster fire, a pustule shot of its own, a bigger payout, and a violet glow with pulsing
// pustules so it reads at a glance. Gameplay here uses the gameplay RNG; drawElite* is render-only (no R / rr / ri).
import { $ } from '../state';
import { TAU, W, ctx, ri } from '../core';
import { sfx } from '../audio';
import { aimA, eshoot, fan, onScreen } from './spawn';
import { xtra } from '../depth';
import { glow } from '../render/util';
import { spark } from '../fx/spawn';

/** knobs */
export const ELITE = {
  hp: 1.8, // HP multiplier on top of whatever mk() gave it
  pay: 2.5, // score and bio multiplier
  fast: 2, // its own fire cooldown ticks an extra step every `fast` frames (2 = ~1.5x fire rate)
  pz: [150, 210], // frames between pustule shots
  tel: 32, // pustule swell (telegraph) before it pops
  swarm: .45, // drones and hatchlings (fodder) roll at this fraction of the elite chance
};
const NO = new Set(['nailbar', 'sentry']); // parts and the Open Orbit's own pods are never elite
const NOFAST = new Set(['womb']); // a faster womb is just more hatchlings: it gets the pustule shot only

/** chance that a biome-stage spawn is elite: 0 in Descent 1; higher on a repeat visit (v = earlier visits) */
export function eliteChance(loop, v) {
  if (loop < 1) return 0;
  return Math.min(.34, .1 + .04 * (loop - 1) + (v > 0 ? .1 + .04 * (v - 1) : 0));
}
/** roll elites over freshly spawned enemies (chance p) */
export function eliteRoll(list, p, R) {
  if (!(p > 0)) return;
  for (const e of list) {
    if (e.dead || e.mini || e.par || e.kid || e.mid || NO.has(e.k)) continue;
    const swarm = e.k === 'drone' || e.k === 'hatch';
    if (R() < p * (swarm ? ELITE.swarm : 1)) eliteify(e);
  }
}
export function eliteify(e) {
  if (e.elite) return e;
  e.elite = 1;
  e.hp *= ELITE.hp;
  e.max = e.hp;
  e.score = Math.round(e.score * ELITE.pay);
  e.bio = Math.ceil(e.bio * ELITE.pay);
  e.eid = ri(0, 9999); // pustule layout (the render side reads it, it never rolls its own)
  e.pz = ri(ELITE.pz[0] * .5, ELITE.pz[1]);
  e.pt = 0;
  return e;
}
/** updEnemy hook, once per frame per elite */
export function eliteTick(e) {
  if (e.dead) return;
  if (e.cool > 1 && !NOFAST.has(e.k) && e.t % ELITE.fast === 0) e.cool--;
  const P = $.P;
  if (e.pt > 0) {
    if (--e.pt === 0 && P && P.alive && onScreen(e)) {
      const a = aimA(e.x, e.y);
      if (xtra()) fan(e.x - 2, e.y, a, 3, .22, 1.5, 'glob'); // Descent 3+: a 3-fan (depth: src/depth.ts, D2)
      else eshoot(e.x - 2, e.y, a, 1.6, 'glob');
      for (let i = 0; i < 5; i++) spark(e.x, e.y, Math.cos(a + (i - 2) * .4) * 1.5, Math.sin(a + (i - 2) * .4) * 1.5, 14, i % 2 ? '#e08aff' : '#fff0a0');
    }
    return;
  }
  if (--e.pz > 0) return;
  if (P && P.alive && !(e.ghost > 0) && onScreen(e) && e.x > 70 && e.x < W - 24 && P.x < e.x - 30) { e.pt = ELITE.tel; sfx.squish(); }
  e.pz = ri(ELITE.pz[0], ELITE.pz[1]);
}
/** killEnemy hook: it bursts violet */
export function eliteKill(e) {
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; spark(e.x, e.y, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 18, i % 2 ? '#c860ff' : '#fff0a0'); }
}

// ---------------- render (no gameplay RNG: layout from e.eid, motion from $.T) ----------------
/** behind the body, world coords: a pulsing sick-violet aura (a dark halo first so it reads on the bright Sinus too) */
export function drawEliteAura(e) {
  const tel = e.pt > 0 ? 1 - e.pt / ELITE.tel : 0, s = Math.sin($.T * .16 + e.eid) * .5 + .5, r = e.r * 1.3 + 12 + 3 * s + 6 * tel;
  glow(e.x, e.y, r + 3, '40,0,50', .55);
  ctx.globalCompositeOperation = 'lighter';
  glow(e.x, e.y, r, '200,60,255', .5 + .25 * s + .4 * tel);
  glow(e.x, e.y, r * .55, '230,120,255', .25 + .15 * s);
  ctx.globalCompositeOperation = 'source-over';
}
/** on the body, local coords (inside drawEnemy's transform + hit-flash filter): pustules that throb, and swell before the shot */
export function drawElitePus(c, e) {
  const n = 3 + (e.eid % 3), tel = e.pt > 0 ? 1 - e.pt / ELITE.tel : 0, rr = e.r * .78;
  for (let i = 0; i < n; i++) {
    const a = e.eid * 2.399 + i * TAU / n, th = Math.sin($.T * .2 + i * 1.7 + e.eid) * .5 + .5;
    const s = 1.5 + .8 * th + e.r * .05 + 1.6 * tel, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    c.fillStyle = '#2a0630';
    c.beginPath(); c.arc(x, y, s + .9, 0, TAU); c.fill();
    c.fillStyle = tel > .6 && ($.T >> 1) % 2 ? '#ffe0ff' : '#c040f0';
    c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
    c.fillStyle = '#fff2a8';
    c.fillRect(x - s * .45, y - s * .55, Math.max(1, s * .55), Math.max(1, s * .5));
  }
}
