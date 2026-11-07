// @ts-nocheck
// THE BROOD MOTHER (snot home): a swollen mucus sac. Art: render/gross/mid/brood.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
import { $ } from '../../state';
import { PH, R, TAU, rr } from '../../core';
import { sfx } from '../../audio';
import { enemies } from '../../world';
import { drop } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, fan, mk } from '../spawn';
import { bandFit, midLeave } from '../update';
import { BROOD_CAP, fitsTerrain, midPh2 } from '../midhost';
import { defineMid } from './roster';

function updBrood(e) {
  // THE BROOD MOTHER: a swollen mucus sac. Heaves 44f, then births a litter of hatchlings; or flares 26f and sneezes snot globs
  const go = midLeave(e), ph2 = midPh2(e);
  e.y = PH / 2 + Math.sin(e.t * .013) * (PH * .2);
  if (fitsTerrain(e)) bandFit(e);
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      e.bul = Math.max(0, (e.bul || 0) - .05);
      if (e.wt >= e.cool) { e.att++; e.st = e.att % 2 ? 'birth' : 'sneeze'; e.wt = 0; sfx.squish(); }
    } else if (e.st === 'birth') {
      e.bul = e.wt / 44;
      if (R() < .3) drop(e.x - 8 + rr(-4, 4), e.y + 14, rr(-.5, .5), rr(.3, 1), 1.2, 4, 60);
      if (e.wt >= 44) {
        let kids = 0;
        for (const q of enemies) if (q.kid && !q.dead) kids++;
        const n = Math.min(BROOD_CAP - kids, 3 + Math.round(($.G.rank || 0) * 2) + (ph2 ? 2 : 0));
        for (let i = 0; i < n; i++) mk('hatch', e.x - 16 - i * 7, e.y + 6 + rr(-8, 8), { kid: 1, ph: R() * TAU, vy: rr(-1.4, 1.4) });
        for (let k = 0; k < 18; k++) drop(e.x - 14, e.y + 6, rr(-2.5, 0), rr(-1.5, 1.5), 1.5, R() < .5 ? 4 : 0, 80);
        sfx.squish();
        e.st = 'idle'; e.wt = 0; e.cool = Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm());
      }
    } else if (e.st === 'sneeze') {
      if (e.wt >= 26 && e.wt <= 38 && e.wt % 6 === 2) fan(e.x - 18, e.y - 4, aimA(e.x - 18, e.y - 4), ph2 ? 5 : 3, .22, 1.8, 'glob');
      if (e.wt >= 50) { e.st = 'idle'; e.wt = 0; e.cool = Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm()); }
    }
  }
  if (R() < .3) drop(e.x + rr(-16, 16), e.y + rr(10, 20), rr(-.2, .2), rr(.2, .6), 1.4, R() < .5 ? 0 : 4, 90);
}

defineMid('brood', {
  et: { hp: 105, r: 20, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 3, teeth: 8, big: 1, mini: 1, mid: 1 },
  word: 'LANCED', // was STILLBORN: too close to the crude-not-cruel line (Matt, D34)
  update: updBrood,
});
