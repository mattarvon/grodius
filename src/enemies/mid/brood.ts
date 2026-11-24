// @ts-nocheck
// THE BROOD MOTHER (snot home): a swollen mucus sac. Art: render/gross/mid/brood.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its CROWD denial (D61, ./_deny.ts): from her phase 2 the litter comes in from behind the ship, at its height, under the
// rear waves' BEHIND warning; the heave (DN.bTel) is the tell.
import { $ } from '../../state';
import { PH, R, TAU, W, rr } from '../../core';
import { sfx } from '../../audio';
import { enemies } from '../../world';
import { drop } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, fan, mk } from '../spawn';
import { bandFit, lob, midLeave } from '../update';
import { BROOD_CAP, fitsTerrain, midPh2 } from '../midhost';
import { DN, broodLane, edgeSlot, edgeX, rearSlot } from './_deny';
import { defineMid } from './roster';
import { cad, diveKids, entered, g3, halfClock, ledger, litter, lobFan, lobReach, lurch, opening, phaseAtt, phaseShare, spend, spendP } from './_fight';

const SLOT = [0, 0]; // rearSlot's / edgeSlot's scratch
// g3 (DIFFICULTY-SPEC §2.3): the one rank rule, cad() (no pow term, no dial); short keeps its old line (layout parity)
const cool = (ph2) => g3() ? cad(ph2 ? 60 : 85) : Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** DIFFICULTY-SPEC §2.3 (W4a), long4 only: the sneeze is TWO bursts (wt 26, 38; was three) of 3 (phase 2: 4) [B3] */
export const SNEEZE = { at: [26, 38] as readonly number[], n: [3, 4] as readonly number[], rise: .3 } as const; // rise: the lob's preferred rise (x BS; was 1.4), as flat as V_CAP lets it (_fight.ts lobV) [W6 K1: the high arc took ~100 f] // phase 2: 4, not the spec's 5 (2 x 5 lobbed globs held the screen at 10: B3 p90 <= 9.6)
/** r3 K1, the half floor's reach per attack (_fight.ts phaseAtt): frames from its start to a ship across the screen.
 *  The edge litter: its 46 f tell plus a fall of the screen's height (~130 f); from behind: 56 f plus ~70 f of flight;
 *  the sneeze: its second burst at 38 plus a lob's ~90 f */
export const BROOD_LAND = { edge: 176, rear: 126, sneeze: 128 } as const;

/**
 * g3: steer the phase-1 litter in from its edge (q.ent = the side it came from: 1 top, -1 bottom). The hatchling's own
 * arm (enemies/update.ts 'hatch') runs after this in the same frame (a child is later in the list) and moves it 2.5 left
 * and steers vy .05 toward the ship, so this sets it up to fall straight at DN.eV down its column: x back by 2.5, vy so the
 * arm's .05 lands it on DN.eV. Once it reaches the ship's lane it is an ordinary hatchling (ent 0). Pure frame math, no R()
 */
const steer = (e) => diveKids(e, enemies, PH); // _fight.ts: shared with the Saucer's litter
function updBrood(e) {
  // THE BROOD MOTHER: a swollen mucus sac. Heaves 44f, then births a litter of hatchlings; or flares 26f and sneezes snot globs
  halfClock(e); // g3 (r3 K1): a first half still up at half the slot clock lurches on (_fight.ts FT.halfK)
  const go = midLeave(e), ph2 = midPh2(e);
  e.y = PH / 2 + Math.sin(e.t * .013) * (PH * .2);
  if (fitsTerrain(e)) bandFit(e);
  if (!go && entered(e) && $.P.alive) {
    e.wt++;
    if (lurch(e, ph2)) e.att = 0; // g3: phase 2 opens on a litter (from behind)
    if (e.st === 'idle') {
      e.bul = Math.max(0, (e.bul || 0) - .05);
      if (e.wt >= e.cool) {
        // g3 (r3 K1): the first half opens on the sneeze when its lobs can reach the ship (a near ship's first half ends
        // before a litter falling the screen's height arrives), else on the litter; and a sneeze due at a ship past every
        // lob under V_CAP and the cave's ceiling (_fight.ts lobReach: far up and to the left) is a litter instead
        const reach = g3() && lobReach(e.x - 18, e.y - 4, $.P.x, $.P.y);
        if (g3() && !e.att && !ph2 && reach) e.att = 1;
        e.att++; e.st = e.att % 2 ? 'birth' : 'sneeze'; e.wt = 0; sfx.squish();
        if (g3() && e.st === 'sneeze' && !reach) e.st = 'birth';
        phaseAtt(e, e.st === 'sneeze' ? BROOD_LAND.sneeze : ph2 ? BROOD_LAND.rear : BROOD_LAND.edge);
        e.rear = e.st === 'birth' && ph2 ? 1 : 0; // phase 2: this litter comes from behind, at your height now
        if (e.rear) { e.ry = broodLane($.P.y, PH); $.G.warn.push({ y: e.ry, t: DN.bTel, ml: DN.bTel }); sfx.tele(); }
        // g3 phase 1 (spec §2.3): the litter drops in from the TOP or BOTTOM edge, alternating, in a column at the ship's
        // x + 60..90, falling to its lane; the tell is a DN.eTel edge chevron at that column (render/gross/mid/brood.ts)
        e.edge = e.st === 'birth' && !ph2 && g3() ? (e.en = -(e.en || -1)) : 0;
        if (e.edge) { e.ex = edgeX($.P.x, e.att >> 1, W); e.ey = broodLane($.P.y, PH); sfx.tele(); }
      }
    } else if (e.st === 'birth') {
      const tel = e.rear ? DN.bTel : e.edge ? DN.eTel : 44;
      e.bul = e.wt / tel;
      if (R() < .3) drop(e.x - 8 + rr(-4, 4), e.y + 14, rr(-.5, .5), rr(.3, 1), 1.2, 4, 60);
      if (e.wt >= tel) {
        let kids = 0;
        for (const q of enemies) if (q.kid && !q.dead) kids++;
        const n = Math.min(BROOD_CAP - kids, (g3() ? litter() : 3 + Math.round(($.G.rank || 0) * 2)) + (ph2 ? 2 : 0));
        if (e.edge) { // in a column off the edge, falling to the ship's lane (steer), then hatchlings as any other
          for (let i = 0; i < n; i++) { edgeSlot(i, e.ex, e.edge, PH, SLOT); if (Math.hypot(SLOT[0] - $.P.x, SLOT[1] - $.P.y) < DN.eClear) continue; mk('hatch', SLOT[0], SLOT[1], { kid: 1, own: e, ent: e.edge, ey: e.ey, ph: R() * TAU, vy: 0 }); }
          for (let k = 0; k < 10; k++) drop(e.ex + rr(-6, 6), e.edge > 0 ? 2 : PH - 2, rr(-1, 1), e.edge * rr(.5, 2), 1.4, R() < .5 ? 4 : 0, 60);
          e.edge = 0;
        } else if (e.rear) { // in from the left edge in rows of three around the lane, flying right (the hatch's fromLeft)
          for (let i = 0; i < n; i++) { rearSlot(i, e.ry, SLOT); mk('hatch', SLOT[0], SLOT[1], { kid: 1, fromLeft: 1, ph: R() * TAU }); }
          for (let k = 0; k < 10; k++) drop(2, e.ry + rr(-14, 14), rr(.5, 2.5), rr(-1, 1), 1.4, R() < .5 ? 4 : 0, 60);
        } else for (let i = 0; i < n; i++) mk('hatch', e.x - 16 - i * 7, e.y + 6 + rr(-8, 8), { kid: 1, ph: R() * TAU, vy: rr(-1.4, 1.4) });
        for (let k = 0; k < 18; k++) drop(e.x - 14, e.y + 6, rr(-2.5, 0), rr(-1.5, 1.5), 1.5, R() < .5 ? 4 : 0, 80);
        sfx.squish();
        e.st = 'idle'; e.wt = 0; e.cool = cool(ph2);
      }
    } else if (e.st === 'sneeze') {
      if (!g3()) { if (e.wt >= 26 && e.wt <= 38 && e.wt % 6 === 2) fan(e.x - 18, e.y - 4, aimA(e.x - 18, e.y - 4), ph2 ? 5 : 3, .22, 1.8, 'glob'); }
      else if (e.wt === SNEEZE.at[0] || e.wt === SNEEZE.at[1]) { const n = SNEEZE.n[ph2 ? 1 : 0]; if (e.wt === SNEEZE.at[0] ? spend(e, n) : spendP(e, n)) lobFan(lob, e.x - 18, e.y - 4, $.P.x, $.P.y, n, 26, SNEEZE.rise); } // the second burst only under the soft ceiling (B3 p90) // lobbed: the centre glob comes down through the ship
      if (e.wt >= 50) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    }
  }
  if (g3()) steer(e);
  if (R() < .3) drop(e.x + rr(-16, 16), e.y + rr(10, 20), rr(-.2, .2), rr(.2, .6), 1.4, R() < .5 ? 0 : 4, 90);
}

defineMid('brood', {
  et: { hp: 105, r: 20, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 3, teeth: 8, big: 1, mini: 1, mid: 1 },
  word: 'LANCED', // was STILLBORN: too close to the crude-not-cruel line (Matt, D34)
  onSpawn: (e) => { e.en = -1; e.edge = 0; if (g3()) { ledger(e); opening(e); e.cool = 0; e.att = 0; } }, // cool 0: the heave starts as it is in (its 46 f tell is the wait) // g3: the litter first unless a lob can reach the ship (r3: then the sneeze; updBrood's reach rule. W6 K1: the sneeze's lobs cannot climb to a ship well above her under V_CAP)
  update: updBrood,
  hurt: (e, d) => phaseShare(e, d), // g3 (r3 K1): the half floor (_fight.ts FT.floorN / floorF); 1 on short
});
