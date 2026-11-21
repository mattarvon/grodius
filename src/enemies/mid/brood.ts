// @ts-nocheck
// THE BROOD MOTHER (snot home): a swollen mucus sac. Art: render/gross/mid/brood.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its CROWD denial (D61, ./_deny.ts): from her phase 2 the litter comes in from behind the ship, at its height, under the
// rear waves' BEHIND warning; the heave (DN.bTel) is the tell.
import { $ } from '../../state';
import { PH, R, TAU, rr } from '../../core';
import { sfx } from '../../audio';
import { enemies } from '../../world';
import { drop } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, fan, mk } from '../spawn';
import { bandFit, midLeave } from '../update';
import { BROOD_CAP, fitsTerrain, midPh2 } from '../midhost';
import { DN, broodLane, rearSlot } from './_deny';
import { defineMid } from './roster';

const SLOT = [0, 0]; // rearSlot's scratch

function updBrood(e) {
  // THE BROOD MOTHER: a swollen mucus sac. Heaves 44f, then births a litter of hatchlings; or flares 26f and sneezes snot globs
  const go = midLeave(e), ph2 = midPh2(e);
  e.y = PH / 2 + Math.sin(e.t * .013) * (PH * .2);
  if (fitsTerrain(e)) bandFit(e);
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      e.bul = Math.max(0, (e.bul || 0) - .05);
      if (e.wt >= e.cool) {
        e.att++; e.st = e.att % 2 ? 'birth' : 'sneeze'; e.wt = 0; sfx.squish();
        e.rear = e.st === 'birth' && ph2 ? 1 : 0; // phase 2: this litter comes from behind, at your height now
        if (e.rear) { e.ry = broodLane($.P.y, PH); $.G.warn.push({ y: e.ry, t: DN.bTel, ml: DN.bTel }); sfx.tele(); }
      }
    } else if (e.st === 'birth') {
      const tel = e.rear ? DN.bTel : 44;
      e.bul = e.wt / tel;
      if (R() < .3) drop(e.x - 8 + rr(-4, 4), e.y + 14, rr(-.5, .5), rr(.3, 1), 1.2, 4, 60);
      if (e.wt >= tel) {
        let kids = 0;
        for (const q of enemies) if (q.kid && !q.dead) kids++;
        const n = Math.min(BROOD_CAP - kids, 3 + Math.round(($.G.rank || 0) * 2) + (ph2 ? 2 : 0));
        if (e.rear) { // in from the left edge in rows of three around the lane, flying right (the hatch's fromLeft)
          for (let i = 0; i < n; i++) { rearSlot(i, e.ry, SLOT); mk('hatch', SLOT[0], SLOT[1], { kid: 1, fromLeft: 1, ph: R() * TAU }); }
          for (let k = 0; k < 10; k++) drop(2, e.ry + rr(-14, 14), rr(.5, 2.5), rr(-1, 1), 1.4, R() < .5 ? 4 : 0, 60);
        } else for (let i = 0; i < n; i++) mk('hatch', e.x - 16 - i * 7, e.y + 6 + rr(-8, 8), { kid: 1, ph: R() * TAU, vy: rr(-1.4, 1.4) });
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
