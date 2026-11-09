// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/cyst.ts.
import { hash } from '../../../core';
import { glowC, fxs, spray, stepParts, drawParts, strand, snd, emit, rnd, rn, GROSS } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, breath, dieAge, pour, trackDeath, twitch, woundStage } from '../baked';

// =====================================================================
//  THE DISSOLVING WOMB - a torn placenta slung over an iron rod, its cord cut open at the spout (Matt's pick c2, D46: placenta,
//  cord and membrane only, nothing shaped like a person). Art: tools/bossart/cyst/bake.py -> sprites/boss/cyst.png
// =====================================================================
const K = 'cyst';
const DEATH = { k: K, body: false, len: 90, gore: (x, y, age) => pour(x, y + 4, age, { w: 18, h: 20, jets: 7, len: 80, meat: 20, rope: 5 }) };
// where it drips from, boss-local: the torn hem, then the wounds that open with each stage
const HEM = [[-14, 24, 13, 41], [-5, 30, 18, 57], [3, 28, 10, 73], [11, 22, 15, 49], [17, 14, 9, 88]];
const TEARS = [[-14, -4, 8, 37], [-10, 14, 9, 53], [14, 8, 11, 44]];
function grossCyst(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  trackDeath(e, DEATH);
  if (s.ev === 'idle>swell') snd('gross_slosh', .5, .35);
  if (s.ev === 'swell>idle') { spray(s, e.x, e.y + 4, 16, '#6a0c12', 2, 1.4, .4); spray(s, e.x, e.y + 4, 8, '#3a0a10', 1.6, 1.2, .2); }
  if (s.ev === 'tel>spray') spray(s, e.x - 2, e.y - 19, 10, '#8a1a1a', 1.8, 1.2, .9);
  if (e.dead || e.hp <= 0) { // a split corpse: gore.ts redraws this through each half, so the halves tear as they tumble
    if (!bf(c, K, 'die', Math.min(5, dieAge(e) / 8 | 0))) bakedFallback(c, e.r);
    return;
  }
  const w = woundStage(e), sw = (e.sw || 0) / 30, tel = e.st === 'tel' ? e.wt / 45 : 0;
  let ok;
  if (e.flash) ok = bf(c, K, 'hurt' + w);
  else if (sw > 0) ok = bf(c, K, 'swell' + w, Math.min(3, sw * 4 | 0));
  else if (e.st === 'tel') ok = bf(c, K, 'tell' + w, twitch(t, 4, 7 - tel * 4));
  else if (e.st === 'spray') ok = bf(c, K, 'gey' + w, twitch(t, 3, 4));
  else ok = bf(c, K, 'idle' + w, breath(t, 5, 110 - w * 18, 3));
  if (!ok) bakedFallback(c, e.r);
  // the wet that a still frame can't hold: threads off the hem, blood from the open tears, both shed real drops
  for (let i = 0; i < HEM.length; i++) { const h = HEM[i]; strand(c, s, e, 60 + i, h[0], h[1], h[2], 1, 'rgba(58,10,18,.9)', h[3], '#5a0a12', 1.2); }
  for (let i = 0; i < w * 2 && i < TEARS.length; i++) { const h = TEARS[i]; strand(c, s, e, 70 + i, h[0], h[1], h[2], 1.1, 'rgba(92,6,14,.95)', h[3], '#8a0c14', .6); }
  if (e.flash && rnd() < .5 * GROSS) emit(s, e.x + rn(-14, 14), e.y + rn(-14, 16), rn(-1.4, 1.4), rn(-1.8, .2), '#7a0a12', rn(.8, 1.5), 0, 60);
  // the cut cord bubbles with what's coming, and throws light: the honest tell
  if (tel > 0 && rnd() < (.15 + tel * .5) * s.dt) emit(s, e.x - 2 + rn(-3, 3), e.y - 20, rn(-.5, .5), rn(-1.5, -.5), hash(t) < .5 ? '#a8201e' : '#d8a080', rn(.7, 1.2), 0, 26, .08);
  drawParts(c, s, e);
  if (tel || sw) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -2, tel ? -19 : 4, tel ? 8 + tel * 12 : 16 + sw * 18, '60,230,195', tel ? .16 + .42 * tel : .08 + .2 * sw); // the swell glow sits low and soft: it lit the cord stump into a face
    c.globalCompositeOperation = 'source-over';
  }
}

/** the kind's art for the registry (./index.ts): draw, and its atlas for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossCyst,
  warm() { bakedWarm(K); return false; }, // false: nothing left to build
  built: () => bakedBuilt(K),
  drop() { bakedDrop(K); },
};
