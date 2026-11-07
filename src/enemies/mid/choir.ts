// @ts-nocheck
// THE NAIL CHOIR (ice home): a frozen eye in two orbiting nailbars. Art: render/gross/mid/choir.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
import { $ } from '../../state';
import { PH, R, pick, rr } from '../../core';
import { sfx } from '../../audio';
import { drop, flash, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, every, fan, mk, ring, wrapA } from '../spawn';
import { bandFit, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { defineMid } from './roster';

function updChoir(e) {
  // THE NAIL CHOIR: a frozen eye in two orbiting nailbars. Glares 40f down a fan line, then a spike fan; the nails "sing" (glint 36f) and spit spikes at you
  // nLive: a counted loop rather than filtering e.bars into a new array, so the update allocates nothing per frame (build plan LS1 P0)
  const go = midLeave(e), ph2 = midPh2(e), cx = isCross(e);
  let nLive = 0;
  for (const b of e.bars) if (!b.dead) nLive++;
  e.y = PH / 2 + Math.sin(e.t * .014) * (PH * .16);
  if (cx) bandFit(e);
  e.spin = (e.spin || 0) + (nLive < 2 ? .034 : .022);
  for (const b of e.bars) { const a = e.spin + b.i * Math.PI; b.ox = Math.cos(a) * 31; b.oy = Math.sin(a) * 31; }
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle' && e.wt >= e.cool) { e.st = 'tel'; e.wt = 0; e.ha = aimA(e.x - 10, e.y); sfx.tele(); }
    else if (e.st === 'tel') {
      e.ha += wrapA(aimA(e.x - 10, e.y) - e.ha) * .04;
      if (e.wt >= 40) {
        fan(e.x - 10, e.y, e.ha, nLive ? 5 : 7, .16, 1.8, 'spike');
        flash(e.x - 10, e.y, 16, 6, '200,235,255');
        e.st = 'idle'; e.wt = 0; e.cool = Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm());
      }
    }
    if (every(e, ph2 ? 110 : 150)) for (const b of e.bars) if (!b.dead && !(b.sing > 0)) b.sing = 36;
    for (const b of e.bars) if (!b.dead && b.sing > 0 && --b.sing === 0) { fan(b.x, b.y, aimA(b.x, b.y), 3, .22, 1.35, 'spike'); sfx.tink(); }
    if (ph2 && every(e, 130)) ring(e.x, e.y, 10, e.t * .05, 1.05);
  }
  if (R() < .25) spark(e.x + rr(-12, 12), e.y + rr(-10, 12), rr(-.3, .3), rr(.2, .6), 14, cx ? pick(HOST_SPARK[e.host]) : R() < .5 ? '#d8efff' : '#8cc4ee');
  if (R() < .15) drop(e.x + rr(-6, 6), e.y + 10, 0, .4, 1.2, 0, 80);
}

defineMid('choir', {
  et: { hp: 80, r: 13, gsz: 4, score: 6000, bio: 60, skull: 1, eyes: 5, teeth: 4, big: 1, mini: 1, mid: 1 },
  word: 'SILENCED',
  onSpawn: (e) => { e.bars = [0, 1].map(i => mk('nailbar', e.x, e.y, { par: e, ox: 0, oy: 0, i, hpm: 1.6 })); },
  update: updChoir,
});
