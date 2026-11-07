// @ts-nocheck
// THE DISSOLVING WOMB (acid home): a melting sac on the lake. Art: render/gross/mid/cyst.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
import { $ } from '../../state';
import { PH, R, rr } from '../../core';
import { sfx } from '../../audio';
import { geysers } from '../../world';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { ring } from '../spawn';
import { bandFit, lob, midLeave } from '../update';
import { HOST_SPARK, isCross } from '../midhost';
import { defineMid } from './roster';

function updCyst(e) {
  // THE DISSOLVING WOMB: a melting sac on the lake. Bubbles 45f, then geysers a rain of globs lobbed onto you; or bloats 30f and bursts a ring
  const go = midLeave(e), ph2 = e.hp < e.max * .5, cx = isCross(e);
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
      if (e.wt % 5 === 0) lob(e.x - 2, e.y - 20, $.P.x + rr(-36, 36), $.P.y + rr(-20, 20), rr(1.3, 1.8));
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
  if (R() < .35) drop(e.x + rr(-14, 14), e.y + rr(8, 20), rr(-.2, .2), rr(.3, .9), 1.3, R() < .6 ? 2 : 4, 80);
  if (R() < .08) spark(e.x + rr(-16, 16), e.y - rr(0, 14), 0, -rr(.3, .8), 20, cx ? HOST_SPARK[e.host][e.t % HOST_SPARK[e.host].length] : '#a6ff2a'); // no extra R() for the colour
}

defineMid('cyst', {
  et: { hp: 135, r: 21, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 2, teeth: 6, big: 1, mini: 1, mid: 1 },
  word: 'BURST',
  update: updCyst,
});
