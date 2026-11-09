// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/brood.ts.
import { hash } from '../../../core';
import { glowC, fxs, emit, spray, stepParts, drawParts, strand, snd, rnd, rn, GROSS } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, dieAge, pour, trackDeath, twitch, woundStage } from '../baked';

// =====================================================================
//  THE BROOD MOTHER - a loose knot of segmented tapeworm ribbon bursting from a ruptured gut, its hook crown reared at the player
//  (Matt's pick c3 Tapeworm Knot). Art: tools/bossart/brood/bake.py -> sprites/boss/brood.png. The birth vent (-16,+6) is a round
//  puncture in the gut (D46: never a slit); the crown sits on the sneeze point (-18,-4). Hatchling art is the Saucer's, untouched.
// =====================================================================
const K = 'brood';
const DEATH = { k: K, body: false, len: 96, gore: (x, y, age) => pour(x - 3, y + 4, age, { w: 20, h: 24, jets: 7, len: 86, meat: 22, rope: 7 }) };
const GUSH = 27; // render frames the gush plays after the litter is born (the sim returns to idle on the birth frame)
// grey-brown slime off the trailing ribbon ends (never lime: D39, lime is the bullets'), boss-local x, y, length, period
const ENDS = [[-12, 32, 9, 61], [6, 33, 11, 77], [0, 32, 7, 53], [-23, 28, 8, 89], [13, 26, 6, 71]];
// blood from the gut split, by wound stage, and off the vent rim
const SPLIT = [[-3, 14, 10, 41], [1, 9, 8, 57], [5, -2, 7, 47], [-7, 17, 12, 37]];
const SLIME = 'rgba(88,70,48,.9)', SLIME_TIP = '#6e5a3c', BLOOD = 'rgba(96,8,14,.95)', BLOOD_TIP = '#7a0a12';

/** the idle crawl: steps through the peristalsis loop at a pace that changes and sometimes holds (D39: no clean loop) */
function crawl(s, t) {
  const blk = Math.floor(t / 50), h = hash(blk * 2.3 + 7);
  if (h > .18) s.f.cp = (s.f.cp || 0) + s.dt / (6 + h * 9);
  return Math.floor(s.f.cp || 0) % 6;
}
function grossBrood(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  trackDeath(e, DEATH);
  if (e.dead || e.hp <= 0) { // a split corpse: gore.ts redraws this through each half, so the halves unravel as they tumble
    if (!bf(c, K, 'die', Math.min(7, dieAge(e) / 7 | 0))) bakedFallback(c, e.r);
    return;
  }
  if (s.ev === 'idle>birth') snd('gross_slosh', .45, .3);
  if (s.ev === 'birth>idle') { // the gush: blood, slime and loose larvae out of the vent, and the art plays its pour
    s.f.g = GUSH;
    for (let i = 0; i < 22 * GROSS; i++) emit(s, e.x - 17, e.y + 7, rn(-3, -.3), rn(-1.4, 1.2), rnd() < .55 ? '#6a0a10' : rnd() < .6 ? '#5a4a32' : '#8a7458', rn(1, 2.2), rnd() < .12 ? 4 : 0, rn(50, 90));
    for (let i = 0; i < 3 * GROSS; i++) emit(s, e.x - 17, e.y + 7, rn(-2, -.5), rn(-1, .5), '#d8c8a8', 1, 2, 80, .1);
    snd('gross_gush', .8, .35);
  }
  if (e.st === 'sneeze' && e.wt >= 26 && !s.f.sz) { // the throw: slime and a little blood off the crown, at the player
    s.f.sz = 1;
    for (let i = 0; i < 14 * GROSS; i++) emit(s, e.x - 21, e.y - 4 + rn(-3, 3), rn(-3.6, -1), rn(-1, 1), rnd() < .7 ? '#7a6a48' : '#6a0c12', rn(.8, 1.7), 0, rn(40, 70));
  }
  if (e.st !== 'sneeze') s.f.sz = 0;
  const w = woundStage(e), bul = Math.min(1, e.bul || 0), wt = e.wt || 0;
  const tell = e.st === 'sneeze' && wt < 26 ? wt / 26 : 0;
  let ok, heave = 0;
  if (s.f.g > 0) s.f.g = Math.max(0, s.f.g - s.dt);
  if (e.flash) ok = bf(c, K, 'hurt' + w);
  else if (e.st === 'birth') { heave = bul; ok = bf(c, K, 'heave' + w, Math.min(3, bul * 4 | 0)); }
  else if (s.f.g > 0) ok = bf(c, K, 'gush' + w, Math.min(2, (GUSH - s.f.g) / 9 | 0));
  else if (e.st === 'sneeze') {
    if (wt < 26) ok = bf(c, K, 'snz' + w, Math.min(3, tell * 4 | 0)); // the crown rears and flares: the honest tell
    else if (wt <= 40) ok = bf(c, K, 'spit' + w, twitch(t, 2, 4)); // the fans go out at 26, 32, 38
    else ok = bf(c, K, 'snz' + w, Math.max(0, 3 - ((wt - 40) / 2.5 | 0))); // and it settles back
  } else ok = bf(c, K, 'idle' + w, crawl(s, t));
  if (!ok) bakedFallback(c, e.r);
  // the wet a still frame can't hold: slime off the trailing ends, blood from the split as it opens, both shed real drops
  for (let i = 0; i < ENDS.length; i++) { const h = ENDS[i]; strand(c, s, e, 400 + i, h[0], h[1], h[2], 1, SLIME, h[3], SLIME_TIP, 1.4); }
  for (let i = 0; i < w * 2 && i < SPLIT.length; i++) { const h = SPLIT[i]; strand(c, s, e, 420 + i, h[0], h[1], h[2], 1.1, BLOOD, h[3], BLOOD_TIP, .6); }
  strand(c, s, e, 430, -17, 9 + heave * 3, 5 + heave * 9, 1 + heave * .8, BLOOD, heave > .2 ? 24 : 80, BLOOD_TIP, .8);
  if (heave > .3 && rnd() < heave * .3 * s.dt) emit(s, e.x - 16 + rn(-2, 2), e.y + 8, rn(-.8, .2), rn(.2, 1), '#5a0a10', rn(.8, 1.3), 0, 60);
  if (e.flash && rnd() < .5 * GROSS) spray(s, e.x + rn(-12, 12), e.y + rn(-14, 14), 3, '#7a0a12', 1.6, 1, .5);
  if (w === 2 && rnd() < .06 * s.dt) emit(s, e.x + rn(-4, 6), e.y + rn(0, 14), rn(-.4, .4), rn(0, .6), '#6a0a10', rn(.8, 1.4), 0, 70);
  drawParts(c, s, e);
  if (tell || heave) { // light thrown by what is coming: off the gaping crown pit, or the swollen vent
    c.globalCompositeOperation = 'lighter';
    if (tell) glowC(c, -18, -4, 6 + tell * 10, '230,110,60', .18 + .45 * tell);
    if (heave) glowC(c, -16, 6, 5 + heave * 8, '200,40,30', .12 + .3 * heave);
    c.globalCompositeOperation = 'source-over';
  }
}

/** the kind's art for the registry (./index.ts): draw, and its atlas for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossBrood,
  warm() { bakedWarm(K); return false; }, // false: nothing left to build
  built: () => bakedBuilt(K),
  drop() { bakedDrop(K); },
};
