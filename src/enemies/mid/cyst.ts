// @ts-nocheck
// THE DISSOLVING WOMB (acid home): a melting sac on the lake. Art: render/gross/mid/cyst.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its SPACE denial (D61, ./_deny.ts): a spray glob that strikes the floor or ceiling plants an acid pool that lingers.
import { $ } from '../../state';
import { PH, R, rr } from '../../core';
import { sfx } from '../../audio';
import { ceilAt, eshots, floorAt, geysers } from '../../world';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { playerHit } from '../../player';
import { ring } from '../spawn';
import { bandFit, lob, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, agePools, eruptStage, plantPool, poolHit, poolReach } from './_deny';
import { defineMid } from './roster';

/** a spray glob's land hook (shots.ts updateEShots, sim side, no R()): where it strikes, a pool */
function cystLand(s) {
  const e = s.cy;
  if (!e || e.dead || e.gone) return;
  const wx = s.x + $.G.scroll, f = floorAt(wx), c = ceilAt(wx), side = s.y >= f ? 1 : -1, y = side > 0 ? f : c;
  if (y > PH + 2 || y < -2) return; // open space: nothing to pool on
  plantPool(e, wx, y, side, e.t, midPh2(e) ? DN.plN2 : DN.plN, poolReach(Math.min(PH, f) - Math.max(0, c)));
}

function updCyst(e) {
  // THE DISSOLVING WOMB: a melting sac on the lake. Bubbles 45f, then geysers a rain of globs lobbed onto you; or bloats 30f and bursts a ring
  const go = midLeave(e), ph2 = midPh2(e), cx = isCross(e);
  e.y = PH * .6 + Math.sin(e.t * .016) * (PH * .13); // tuned to sit on the acid lake; a crossover fits the host's cave
  if (cx) bandFit(e);
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      e.sw = Math.max(0, (e.sw || 0) - 1.5);
      if (e.wt >= e.cool) { e.att++; e.st = e.att % 3 ? 'tel' : 'swell'; e.wt = 0; e.st === 'tel' ? sfx.tele() : sfx.squish(); }
    } else if (e.st === 'tel') {
      if (R() < .6) spark(e.x + rr(-6, 6), e.y - 18, rr(-.3, .3), -rr(.8, 2), 14, '#7ff0d8');
      if (e.wt >= 45) { e.st = 'spray'; e.wt = 0; geysers.push({ wx: 0, y: 0, att: e, ox: -2, oy: -19, a: -Math.PI / 2, l: ph2 ? 44 : 32, rate: 4, c: 2 }); }
    } else if (e.st === 'spray') {
      if (e.wt % 5 === 0) {
        const n = eshots.length;
        lob(e.x - 2, e.y - 20, $.P.x + rr(-36, 36), $.P.y + rr(-20, 20), rr(1.3, 1.8));
        if (eshots.length > n) { eshots[n].cy = e; eshots[n].land = cystLand; } // it pools where it strikes
      }
      if (e.wt >= (ph2 ? 40 : 28)) { e.st = 'idle'; e.wt = 0; e.cool = Math.round((ph2 ? 55 : 80) * (1 - .3 * ($.G.rank || 0)) * cdm()); }
    } else if (e.st === 'swell') {
      e.sw = e.wt;
      if (e.wt >= 30) {
        ring(e.x, e.y, ph2 ? 14 : 10, e.t * .07, 1.05);
        for (let k = 0; k < 20; k++) drop(e.x, e.y, rr(-2, 2), rr(-2, 2), 1.5, 2, 70);
        sfx.glob();
        e.st = 'idle'; e.wt = 0; e.cool = Math.round((ph2 ? 55 : 80) * (1 - .3 * ($.G.rank || 0)) * cdm());
      }
    }
  }
  // the pools: they dry on their own clocks, and burn whoever sits in one (they outlive a withdraw until it is gone)
  agePools(e, e.t);
  for (let i = 0; i < e.pn; i++) { // an eruption: the boil's first frame hisses, the column's first frame gushes
    const a = e.t - e.pT[i], er = eruptStage(a), was = eruptStage(a - 1);
    if (er !== was && er === 1) sfx.squish();
    if (er !== was && er === 2) { sfx.glob(); for (let k = 0; k < 8; k++) drop(e.pX[i] - $.G.scroll + rr(-5, 5), e.pY[i] - e.pS[i] * e.pR[i], rr(-1.2, 1.2), -e.pS[i] * rr(0, 1.5), 1.3, 2, 50); }
  }
  if ($.P.alive && e.pn && poolHit(e, $.G.scroll, $.P.x, $.P.y)) playerHit();
  if (R() < .35) drop(e.x + rr(-14, 14), e.y + rr(8, 20), rr(-.2, .2), rr(.3, .9), 1.3, R() < .6 ? 2 : 4, 80);
  if (R() < .08) spark(e.x + rr(-16, 16), e.y - rr(0, 14), 0, -rr(.3, .8), 20, cx ? HOST_SPARK[e.host][e.t % HOST_SPARK[e.host].length] : '#a6ff2a'); // no extra R() for the colour
}

defineMid('cyst', {
  et: { hp: 135, r: 21, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 2, teeth: 6, big: 1, mini: 1, mid: 1 },
  word: 'BURST',
  onSpawn: (e) => { e.pn = 0; e.pX = [0, 0, 0, 0, 0, 0, 0, 0]; e.pY = [0, 0, 0, 0, 0, 0, 0, 0]; e.pS = [0, 0, 0, 0, 0, 0, 0, 0]; e.pT = [0, 0, 0, 0, 0, 0, 0, 0]; e.pR = [0, 0, 0, 0, 0, 0, 0, 0]; }, // room for DN.plN2
  update: updCyst,
});
