// @ts-nocheck
// THE BLOAT (ice biome boss, kind 'crux'): Matt's pick c5, the Engorged Frost Leech. A blood-gorged parasite
// clamped at both ends to a bent iron stake, the crop distended with frozen blood; the four nail bars are iron driven through
// its flank. Art: tools/bossart/crux/bake.py -> sprites/boss/crux.png. Sim: enemies/update.ts 'crux' / 'nailbar'.
// Render only: reads sim fields, never writes them; RNG is the render streams (midbosses rnd, srnd); no per-frame allocation.
import { $ } from '../../state';
import { hash } from '../../core';
import { drop, gib, mist } from '../../fx/spawn';
import { srr, srnd } from '../../srnd';
import { glowC, fxs, spray, stepParts, drawParts, strand, snd, emit, rnd, rn, GROSS } from './midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, pour, trackDeath, twitch } from './baked';

const K = 'crux';
// the sim's attack timers (enemies/spawn.ts every()): the same period, read here so each tell leads its volley honestly
const per = (n) => Math.max(18, Math.round(n * (1 - .4 * Math.min(2.0, ($.G && $.G.pow) || 0))));
const until = (e, n) => { const N = per(n); return (N - (e.t % N)) % N; }; // 0 on the frame it fires
const since = (e, n) => e.t % per(n);
const armed = (e) => e.t > 140 && !e.gone && $.P && $.P.alive;
const FAN = [-28, -4], RL = [-25, 28], RR = [27, 29], NECK = [11, -46], HEART = [0, -6];
// where it drips, boss-local: the frozen runs under the belly, then the bared cavity's floor (more with each stage)
const HEM = [[-20, 40, 5, 71], [-9, 45, 7, 53], [3, 48, 6, 88], [14, 47, 5, 61], [27, 44, 6, 77]];
const CAV = [[-6, 10, 9, 41], [0, 12, 12, 57], [5, 9, 8, 47], [-10, 6, 7, 66], [8, 13, 14, 38]];

/** the swallow: a bulge runs from the tail into the crop, then the crop pumps; a rest of changing length between, so never a loop */
function swallow(t, w) {
  const P = 150 - 34 * w, cyc = Math.floor(t / P), f = (t % P) / P, rest = .22 + hash(cyc * 2.3 + 5) * .38;
  return f < rest ? 0 : Math.min(5, Math.floor((f - rest) / (1 - rest) * 6));
}
/** heart beat frame (0 rest .. 2 full): a lub-dub, faster once it bleeds out */
function beat(t, w) {
  const P = w > 1 ? 30 : 46, f = (t % P) / P;
  return f < .07 ? 1 : f < .15 ? 2 : f < .22 ? 3 : f < .3 ? 1 : 0;
}

// the death: the crop bursts, the head tears off the stake and swings down, the heart drops out on its vessels
const DEATH = {
  k: K, list: 'die', rate: 7, hold: 46, fall: 0,
  gore: (x, y, age) => {
    pour(x - 2, y + 2, age, { w: 22, h: 26, jets: 9, len: 120, meat: 24, rope: 6 });
    if (age === 1) {
      snd('gicecrack', 1, .5);
      // frozen blood and the crop's clots thrown out as hard dark shards
      for (let k = 0; k < 26; k++) drop(x + srr(-18, 18), y + srr(-16, 20), srr(-3.6, 3.6), srr(-4.2, .6), srr(1.4, 2.6), srnd() < .5 ? 1 : 3, 120);
      for (let k = 0; k < 4; k++) gib(x - 30 + srr(-10, 4), y + srr(-14, 14), srr(-3, -.6), srr(-2.5, .5), 'metal', srr(1.4, 2.2));
    }
    if (age === 24) { snd('gross_slosh', .8, .4); mist(x - 4, y + 22, 26, 50, 1); } // the heart falls out of it
    if (age > 24 && age < 60 && (age & 3) === 0) drop(x - 4 + srr(-4, 4), y + 24 + srr(-3, 6), srr(-.5, .5), srr(.5, 1.6), srr(1.6, 2.4), 0, 100);
  },
};

const tells = { fan: 0, ring: 0, glob: 0, fanR: 0, ringR: 0 };
/** THE BLOAT's body, at boss origin (render/enemies.ts translates to e.x, e.y) */
export function drawCrux(c, e) {
  const s = fxs(e), t = e.t, f = s.f;
  stepParts(s);
  trackDeath(e, DEATH);
  const w = e.shielded ? 0 : e.hp < e.max * .5 ? 2 : 1;
  // ---- render-side events: a bar torn off the flank, the heart bared ----
  if (!f.bars) f.bars = [0, 0, 0, 0];
  const bars = e.bars || [];
  for (let i = 0; i < bars.length && i < 4; i++) {
    const b = bars[i];
    if (!b.dead || f.bars[i]) continue;
    f.bars[i] = 1;
    spray(s, b.x + 10, b.y, 16, '#6a0a12', 2.2, 1.4, .3);
    spray(s, b.x + 10, b.y, 8, '#2a0408', 1.6, 1.2, .2);
    for (let k = 0; k < 3; k++) gib(b.x + srr(-6, 6), b.y + srr(-8, 8), srr(-2.6, -.4), srr(-2.4, .4), 'metal', srr(1.2, 1.8));
    for (let k = 0; k < 2; k++) gib(b.x + 12, b.y + srr(-8, 8), srr(-1.6, .4), srr(-2, 0), 'chunk', srr(1.2, 1.8));
    for (let k = 0; k < 10; k++) drop(b.x + 12 + srr(-3, 3), b.y + srr(-10, 10), srr(-2.2, .6), srr(-1.8, .8), srr(1.1, 1.8), srnd() < .6 ? 0 : 1, 90);
    snd('gicecrack', .5, .25);
  }
  if (e.exposed && !f.exp) { // the last bar went: the crop splits and the heart is bared
    f.exp = 1;
    spray(s, e.x, e.y - 4, 26, '#7a0a14', 2.6, 1.6, .5);
    spray(s, e.x, e.y - 4, 12, '#2a0408', 2, 1.4, .3);
    for (let k = 0; k < 6; k++) gib(e.x + srr(-8, 8), e.y + srr(-10, 6), srr(-3, 2), srr(-3, .5), 'chunk', srr(1.4, 2.2));
    for (let k = 0; k < 18; k++) drop(e.x + srr(-8, 8), e.y + srr(-10, 8), srr(-3, 2), srr(-2.6, 1), srr(1.2, 2.2), srnd() < .6 ? 0 : 1, 100);
    mist(e.x, e.y - 4, 14, 36, 1);
    snd('gicecrack', .8, .4);
  }
  // ---- which frame: the sim has no attack states, so the tells read its timers ----
  tells.fan = tells.ring = tells.glob = tells.fanR = tells.ringR = 0;
  if (armed(e)) {
    const uf = until(e, 85), ur = until(e, 160);
    if (uf > 0 && uf <= 24) tells.fan = 1 - (uf - 1) / 24;
    if (since(e, 85) < 8) tells.fanR = 1;
    if (ur > 0 && ur <= 30) tells.ring = 1 - (ur - 1) / 30;
    if (since(e, 160) < 10) tells.ringR = 1;
    if (w === 2) { const ug = until(e, 120); if (ug > 0 && ug <= 24) tells.glob = 1 - (ug - 1) / 24; }
  }
  if (!bf(c, K, 'stake')) { bakedFallback(c, e.r); return; }
  let ok;
  if (e.flash && !e.shielded) ok = bf(c, K, 'hurt' + w, e.flash > 1 ? 0 : 1);
  else if (tells.fanR) ok = bf(c, K, 'fanr' + w, since(e, 85) < 3 ? 0 : 1);
  else if (tells.ringR) ok = bf(c, K, 'ringr' + w, since(e, 160) < 4 ? 0 : 1);
  else if (tells.fan) ok = bf(c, K, 'fan' + w, Math.min(2, tells.fan * 3 | 0));
  else if (tells.ring) ok = bf(c, K, 'ring' + w, Math.min(2, tells.ring * 3 | 0));
  else if (tells.glob) ok = bf(c, K, 'glob2', twitch(t, 2, 4, 9));
  else if (e.flash) ok = bf(c, K, 'hurt0', 1); // a tink off the shield: a flinch, no blood
  else ok = bf(c, K, 'idle' + w, swallow(t, w));
  if (!ok) bakedFallback(c, e.r);
  if (w) bf(c, K, 'heart' + w, beat(t, w)); // the heart at (0,-6): unseen until the nails are gone
  // ---- the live wet a still frame can't hold ----
  for (let i = 0; i < HEM.length; i++) { const h = HEM[i]; strand(c, s, e, 80 + i, h[0], h[1], h[2], 1, 'rgba(48,6,12,.92)', h[3], '#5a0a12', .8); }
  for (let i = 0; i < w * 2 + (w > 1 ? 1 : 0) && i < CAV.length; i++) { const h = CAV[i]; strand(c, s, e, 90 + i, h[0], h[1], h[2] * (w > 1 ? 1.4 : 1), 1.2, 'rgba(110,8,16,.95)', h[3] * (w > 1 ? .7 : 1), '#8a0c14', .5); }
  if (e.flash > 1 && rnd() < .6 * GROSS) emit(s, e.x + rn(-10, 8), e.y + rn(-14, 16), rn(-1.8, .6), rn(-1.8, .2), rnd() < .6 ? '#7a0a12' : '#2a0408', rn(.8, 1.6), 0, 70);
  if (tells.fanR && since(e, 85) === 0) spray(s, e.x + FAN[0], e.y + FAN[1], 9, '#8a1018', 2, 1.1, .2);
  if (tells.ringR && since(e, 160) === 0) { spray(s, e.x + RL[0], e.y + RL[1], 8, '#7a0a12', 1.6, 1.1, .3); spray(s, e.x + RR[0], e.y + RR[1], 8, '#7a0a12', 1.6, 1.1, .3); }
  if (w === 2 && e.t % 8 === 0 && armed(e) && rnd() < .5) emit(s, e.x + HEART[0] + rn(-3, 3), e.y + HEART[1] + rn(-2, 2), rn(-1, 1), rn(-1.2, .2), '#a8141c', rn(.7, 1.1), 0, 40);
  if (tells.glob > .5 && rnd() < .4) emit(s, e.x + NECK[0] + rn(-2, 2), e.y + NECK[1], rn(-.6, .6), rn(-1.6, -.6), '#6a0a12', rn(.7, 1.2), 0, 40);
  drawParts(c, s, e);
  // ---- light: the crop glowing through the skin, the heart once bared, and every tell at its source ----
  c.globalCompositeOperation = 'lighter';
  const bt = w ? beat(t, w) : (t % 64) < 6 ? 1 : 0, fl = (hash(t >> 2) - .5) * .1;
  glowC(c, HEART[0], HEART[1], (w ? 16 : 20) + bt * 3, w ? '255,26,30' : '150,10,20', (w ? .22 : .14) + bt * .06 + fl);
  if (tells.fan) glowC(c, FAN[0], FAN[1], 5 + tells.fan * 11, '255,46,30', .12 + .5 * tells.fan + fl);
  if (tells.ring) { const a = .1 + .45 * tells.ring + fl; glowC(c, RL[0], RL[1], 4 + tells.ring * 10, '255,46,30', a); glowC(c, RR[0], RR[1], 4 + tells.ring * 9, '255,46,30', a); }
  if (tells.glob) glowC(c, NECK[0], NECK[1], 4 + tells.glob * 9, '255,60,40', .1 + .45 * tells.glob + fl);
  if (w === 2 && e.t % 8 < 3 && armed(e)) glowC(c, HEART[0], HEART[1], 9, '255,90,70', .25);
  c.globalCompositeOperation = 'source-over';
}

/** one of the crux's nail bars, at the bar's own origin: the iron through the flank, bending and tearing out as it is shot.
 *  Only for bars whose e.par is the crux (the Nail Choir's bars keep their own draw) */
export function drawCruxNail(c, e) {
  const f = e.hp / (e.max || 1), st = f > .6 ? 0 : f > .3 ? 1 : 2;
  const q = e.flash ? ($.T >> 1) & 1 : 0; // the iron rings under fire
  if (!bf(c, K, 'nail' + (e.i | 0) + '_' + st, q)) { bakedFallback(c, 5); return; }
  if (st && GROSS > 0) {
    const s = fxs(e);
    stepParts(s);
    // blood worked out along the shank, shedding off the head
    strand(c, s, e, 30 + (e.i | 0), -2 - (e.i | 0) * 1.5, 2 + st * 2, 4 + st * 3, .9, 'rgba(96,6,14,.92)', 70 - st * 18, '#7a0a12', .4);
    if (e.flash && rnd() < .4) emit(s, e.x + rn(0, 14), e.y + rn(-12, 12), rn(-1.4, .2), rn(-1.4, .4), '#6a0a12', rn(.7, 1.2), 0, 60);
    drawParts(c, s, e);
  }
}

/** per-route warm-up (render/warmup.ts): start the atlas download; false = nothing left to build */
export function warmCrux() { bakedWarm(K); return false; }
export const cruxBuilt = () => bakedBuilt(K);
/** free the atlas; the next draw or warm-up loads it again */
export function dropCrux() { bakedDrop(K); }
