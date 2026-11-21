// @ts-nocheck
// THE NAIL CHOIR (ice home): a frozen eye in two orbiting nailbars. Art: render/gross/mid/choir.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its LINE denial (D61, ./_deny.ts): every DN.lEvery-th attack a nailbar comes loose and sweeps a lane at the ship's height.
import { $ } from '../../state';
import { PH, R, lerp, pick, rr } from '../../core';
import { sfx } from '../../audio';
import { drop, flash, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { playerHit } from '../../player';
import { aimA, eshoot, every, fan, mk, ring, wrapA } from '../spawn';
import { bandFit, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, LP, laneHit, laneY } from './_deny';
import { defineMid } from './roster';

const cool = (ph2) => Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** the lane is over (or cut short): the bar flies home from wherever it is */
const laneOff = (e) => { e.st = 'idle'; e.wt = 0; if (e.lb && !e.lb.dead && e.lp) { e.lp = LP.home; e.lh = 0; } else { e.lp = 0; e.lb = null; } };

/** the lane attack, one frame. e.lb: the loose bar (null: no bar left, the eye spits nails); e.lx, e.ly: the bar's place */
function lane(e, ph2) {
  const b = e.lb, x0 = e.x - DN.lFront;
  if (b && b.dead) { e.lb = null; e.lp = 0; e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); return; } // shot off the lane: it ends
  if (e.lp === LP.tel) {
    if (b) { const k = Math.min(1, e.wt / DN.lFly), s = k * k * (3 - 2 * k); e.lx = lerp(e.x + b.ox, x0, s); e.ly = lerp(e.y + b.oy, e.ly0, s); }
    else { e.lx = x0; e.ly = e.ly0; }
    if (e.wt >= DN.lTel) {
      e.wt = 0; sfx.lash(); flash(x0, e.ly, 14, 5, '200,235,255');
      if (b) e.lp = LP.out;
      else { // no bar left: the eye spits its nails down the lane, a column the bar's height
        for (let i = 0; i < DN.lSpikes; i++) eshoot(x0, e.ly + (i - (DN.lSpikes - 1) / 2) * DN.lSpikeDy, Math.PI, DN.lSpikeSp, 'spike');
        e.lp = 0; e.st = 'idle'; e.cool = cool(ph2);
      }
    }
  } else if (e.lp === LP.out) {
    e.lx -= DN.lSp;
    if (e.lx <= DN.lEnd) { e.lx = DN.lEnd; e.lp = LP.back; sfx.tink(); }
  } else if (e.lp === LP.back) {
    e.lx += DN.lBack;
    if (e.lx >= x0) { e.lx = x0; laneOff(e); e.cool = cool(ph2); }
  }
  if ($.P.alive && laneHit(e, $.P.x, $.P.y)) playerHit();
}

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
  if (go && e.lp && e.lp !== LP.home) laneOff(e); // it withdraws mid-lane (midLeave has set it idle): the bar comes home
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle' && e.wt >= e.cool) {
      e.att++;
      if (e.att % DN.lEvery === 0) { // the lane: locked on the ship's height now, its tell DN.lTel
        e.st = 'lane'; e.lp = LP.tel; e.wt = 0; e.ly0 = laneY($.P.y, PH); e.ly = e.ly0; e.lx = e.x - DN.lFront;
        e.lb = null;
        for (const b of e.bars) if (!b.dead) { e.lb = b; break; }
        if (e.lb) e.lb.sing = 0;
        sfx.tele(); sfx.chain();
      } else { e.st = 'tel'; e.wt = 0; e.ha = aimA(e.x - 10, e.y); sfx.tele(); }
    }
    else if (e.st === 'tel') {
      e.ha += wrapA(aimA(e.x - 10, e.y) - e.ha) * .04;
      if (e.wt >= 40) {
        fan(e.x - 10, e.y, e.ha, nLive ? 5 : 7, .16, 1.8, 'spike');
        flash(e.x - 10, e.y, 16, 6, '200,235,255');
        e.st = 'idle'; e.wt = 0; e.cool = cool(ph2);
      }
    } else if (e.st === 'lane') lane(e, ph2);
    if (every(e, ph2 ? 110 : 150)) for (const b of e.bars) if (!b.dead && !(b.sing > 0) && b !== e.lb) b.sing = 36;
    for (const b of e.bars) if (!b.dead && b.sing > 0 && --b.sing === 0) { fan(b.x, b.y, aimA(b.x, b.y), 3, .22, 1.35, 'spike'); sfx.tink(); }
    if (ph2 && every(e, 130)) ring(e.x, e.y, 10, e.t * .05, 1.05);
  }
  // the loose bar: on the lane, or flying home to its orbit (then it is an orbiting bar again)
  const lb = e.lb;
  if (lb && lb.dead) { e.lb = null; e.lp = 0; }
  else if (lb && e.lp === LP.home) {
    e.lh++;
    const k = Math.min(1, e.lh / DN.lHome);
    e.lx = lerp(e.lx, e.x + lb.ox, .25 + .75 * k); e.ly = lerp(e.ly, e.y + lb.oy, .25 + .75 * k);
    if (k >= 1) { e.lb = null; e.lp = 0; }
  }
  if (e.lb && e.lp) { e.lb.ox = e.lx - e.x; e.lb.oy = e.ly - e.y; }
  if (R() < .25) spark(e.x + rr(-12, 12), e.y + rr(-10, 12), rr(-.3, .3), rr(.2, .6), 14, cx ? pick(HOST_SPARK[e.host]) : R() < .5 ? '#d8efff' : '#8cc4ee');
  if (R() < .15) drop(e.x + rr(-6, 6), e.y + 10, 0, .4, 1.2, 0, 80);
}

defineMid('choir', {
  et: { hp: 80, r: 13, gsz: 4, score: 6000, bio: 60, skull: 1, eyes: 5, teeth: 4, big: 1, mini: 1, mid: 1 },
  word: 'SILENCED',
  onSpawn: (e) => { e.bars = [0, 1].map(i => mk('nailbar', e.x, e.y, { par: e, ox: 0, oy: 0, i, hpm: 1.6 })); e.lp = 0; e.lb = null; },
  update: updChoir,
});
