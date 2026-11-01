// @ts-nocheck
// =====================================================================
//  THE SQUIDFUCKED SAUCER - the Open Orbit midboss: a wrecked saucer gone to meat, smothered in tentacles.
//  Gameplay only (art: src/render/gross/ufo.ts). Three telegraphed attacks, cycled lash / volley / lash / brood:
//   LASH   (42f): a tentacle uncoils and a dashed line tracks you, then locks; it whips out ~220 px along it and back
//   VOLLEY (36f): three tumours on the hull swell and glow, then burst into aimed 3-fans of pus globs
//   BROOD  (40f): the belly hatch dilates and drops a litter of hatchlings (kid: no stage-count, no grafts)
//  Under 50%: the lash comes twice (re-aimed), the volley bursts twice, a slow ring every ~2.3 s.
//  It pays out as it breaks up: a pod off the hull at 66% and 33%, a pod for killing a whole litter, 2 on the kill.
//
//  PACING (docs/pacing.md 3.2): unlike the biome midbosses it does NOT hold the scroll. Open Orbit is open space, so
//  the wreck drifts alongside you and the stage clock keeps running. While it's up (from its WARNING on) the Open Orbit
//  script's filler is eaten ($.G.eat, see runScript): kill it fast and the waves pick up where the scroll is; take
//  your time and it eats them. It leaves at scroll 1840 whatever happens (the last filler and the Maw's run-up always
//  come), so the stage is the same length in scroll and time; the cost is the eaten filler's kills and pods, which the
//  pods above stand in for (measured: docs/pacing.md 3.2).
// =====================================================================
import { $ } from '../state';
import { PH, R, TAU, W, clamp, dist2, lerp, rr } from '../core';
import { sfx } from '../audio';
import { enemies } from '../world';
import { drop, flash, spark } from '../fx/spawn';
import { aimA, banner, every, fan, miniWarn, mk, ring, wrapA } from './spawn';
import { playerHit } from '../player';
import { dropCap } from './update';
import { cdm } from '../depth';
import { ufoAt, ufoDrift, ufoGapEnd } from '../layout';

export const UFO_NAME = 'THE SQUIDFUCKED SAUCER';
// Where its WARNING is (it lands ~150 px later, ~45% through the stage) and where it must be gone by (the last of the
// filler, 1880..1900, always comes; the Maw's "SOMETHING IS COMING" is at 2000) are the Open Orbit row's drift entry
// in src/layout.ts, stage-relative (ufoAt() / ufoGapEnd() give world x).
/** @deprecated boot-time world-x aliases for the probes until build plan item J repoints them */
export const UFO_AT = ufoAt(), UFO_GAP_END = ufoGapEnd();
/** where the lash, the tumours and the belly hatch sit, relative to its centre (the art in render/gross/ufo.ts uses these) */
export const LASH_O = [-34, 9], TUMOURS = [[-24, -7], [6, -10], [30, -5]], HATCH_O = [12, 11];
const LASH_LEN = 220;

/** the WARNING beat (buildScript): the filler stops here, a breath, then the wreck drifts in */
export function ufoWarn() {
  $.G.eat = ufoGapEnd();
  miniWarn(UFO_NAME, spawnUfo);
}
export function spawnUfo() {
  const e = mk('ufo', W + 70, PH * .45, {
    title: UFO_NAME, tx: W - 96, st: 'idle', wt: 0, cool: 100, att: 0, drift: 1,
    la: Math.PI, ll: 0, lash2: 0, burst: 0, hb: [[-34, 2, 10], [32, 0, 9]],
  });
  // it has to be gone before the Maw's run-up: the scroll keeps moving (1 px/f) while it's up
  e.leave = clamp(Math.round(ufoGapEnd() - $.G.scroll - 70), 420, 1400);
  $.G.mini = e;
}
/** lash tentacle: origin (world) and whether the ship is on it */
const lashO = (e) => [e.x + LASH_O[0], e.y + LASH_O[1]];
function onLash(e) {
  if (!$.P.alive || e.ll < 30) return false;
  const [ox, oy] = lashO(e), dx = Math.cos(e.la), dy = Math.sin(e.la);
  const px = $.P.x - ox, py = $.P.y - oy, u = clamp(px * dx + py * dy, 0, e.ll);
  return dist2(px, py, dx * u, dy * u) < 6 * 6;
}
const cd = (e, ph2) => Math.round((ph2 ? 52 : 78) * (1 - .3 * ($.G.rank || 0)) * cdm()); // cdm: depth, src/depth.ts

export function updUfo(e) {
  const ph2 = e.hp < e.max * .5;
  // leave: on its timer, or when the scroll reaches the Maw's run-up (escape costs nothing, like the other midbosses)
  e.pl = e.leave;
  e.pt = Math.min(e.t, e.leave);
  if (e.t < e.leave && $.G.scroll > ufoGapEnd() - ufoDrift().exitLead) e.leave = e.t; // the forced exit (layout invariant, spec §3.2 rule 1: >= 300 px before the next WARNING; short is a pinned 220 px exception)
  const go = e.t >= e.leave;
  if (go) {
    if (!e.gone) { e.gone = 1; e.st = 'idle'; e.ll = 0; banner('IT WITHDRAWS', 'NOTHING LOST', '#8a5a5a', 90); }
    e.x += 1.6;
    e.y -= .25;
    if (e.x > W + 80) { e.dead = true; $.G.eat = 0; }
    return;
  }
  e.x = lerp(e.x, e.tx, .025);
  // it pays out as it breaks up (it eats the filler's formation pods while it's up): a pod off the hull at 66% and 33%
  for (const [k, f] of [['p1', .66], ['p2', .33]]) if (!e[k] && e.hp < e.max * f) {
    e[k] = 1;
    dropCap(e.x - 24, e.y + rr(-10, 10));
    for (let q = 0; q < 14; q++) drop(e.x - 20 + rr(-10, 10), e.y + rr(-6, 6), rr(-2, 1), rr(-2, 1), 1.5, R() < .5 ? 0 : 2, 80);
    $.G.shake += 3;
  }
  // bob, but hold still while a lash is lined up so the telegraph line is honest
  const still = e.st === 'lash' || e.st === 'whip';
  if (!still) e.y = lerp(e.y, PH * .45 + Math.sin(e.t * .012) * PH * .2, .04);
  if (e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      e.ll = Math.max(0, e.ll - 6);
      if (e.wt >= e.cool) {
        const k = e.att++ % 4;
        e.st = k === 1 ? 'swell' : k === 3 ? 'brood' : 'lash';
        e.wt = 0;
        if (e.st === 'lash') { e.la = aimA(...lashO(e)); sfx.tele(); } else sfx.squish();
      }
    } else if (e.st === 'lash') { // telegraph: tracks you for 26f, then locks
      const tel = e.lash2 ? 28 : 42;
      if (e.wt < tel - 16) e.la += wrapA(aimA(...lashO(e)) - e.la) * .12;
      if (e.wt >= tel) { e.st = 'whip'; e.wt = 0; sfx.lash(); }
    } else if (e.st === 'whip') { // out in 8f, holds 8f, back over 18f
      const w = e.wt, ext = w < 8 ? w / 8 : w < 16 ? 1 : Math.max(0, 1 - (w - 16) / 18);
      e.ll = 18 + LASH_LEN * ext;
      if (w === 8) {
        $.G.shake += 2;
        const [ox, oy] = lashO(e), tx = ox + Math.cos(e.la) * e.ll, ty = oy + Math.sin(e.la) * e.ll;
        for (let k = 0; k < 10; k++) drop(tx, ty, rr(-1.5, 1.5), rr(-1.5, 1), 1.4, R() < .5 ? 0 : 2, 70);
      }
      if (w >= 4 && w <= 20 && onLash(e)) playerHit();
      if (w >= 34) {
        e.ll = 0;
        if (ph2 && !e.lash2) { e.lash2 = 1; e.st = 'lash'; e.wt = 0; sfx.tele(); } // under 50%: a second, quicker lash
        else { e.lash2 = 0; e.st = 'idle'; e.wt = 0; e.cool = cd(e, ph2); }
      }
    } else if (e.st === 'swell') { // tumours swell 36f, burst into pus fans (twice under 50%)
      if (e.wt === 36 || (ph2 && e.wt === 54)) {
        e.burst++;
        for (const [tx, ty] of TUMOURS) {
          const x = e.x + tx, y = e.y + ty;
          fan(x, y, aimA(x, y), e.wt === 36 ? 3 : 2, .24, 1.45, 'glob');
          for (let k = 0; k < 6; k++) drop(x, y, rr(-1.6, 1.2), rr(-2, .4), 1.4, R() < .6 ? 2 : 0, 70);
        }
        flash(e.x, e.y - 6, 22, 6, '230,215,90');
        sfx.glob();
      }
      if (e.wt >= (ph2 ? 66 : 50)) { e.st = 'idle'; e.wt = 0; e.cool = cd(e, ph2); }
    } else if (e.st === 'brood') { // the belly hatch dilates 40f, then a litter drops out
      if (R() < .3) drop(e.x + HATCH_O[0] + rr(-3, 3), e.y + HATCH_O[1] + 2, rr(-.4, .4), rr(.3, 1), 1.2, 4, 50);
      if (e.wt === 40) {
        const kids = enemies.filter(q => q.kid && !q.dead).length, n = Math.min(8 - kids, 3 + Math.round(($.G.rank || 0) * 2) + (ph2 ? 1 : 0)), g = { n, killed: 0 };
        // the litter is a formation: kill all of it for a pod (it stands in for the filler it ate)
        for (let i = 0; i < n; i++) mk('hatch', e.x + HATCH_O[0] - i * 7, e.y + HATCH_O[1] + 4, { kid: 1, group: g, ph: R() * TAU, vy: (i % 2 ? 1 : -1) * rr(.4, 1.3) });
        for (let k = 0; k < 16; k++) drop(e.x + HATCH_O[0], e.y + HATCH_O[1] + 2, rr(-1.5, 1.5), rr(0, 2), 1.5, R() < .5 ? 4 : 0, 80);
        sfx.squish();
      }
      if (e.wt >= 56) { e.st = 'idle'; e.wt = 0; e.cool = cd(e, ph2); }
    }
    if (ph2 && every(e, 140)) ring(e.x, e.y + 4, 8, e.t * .05, 1);
  }
  if (R() < .3) drop(e.x + rr(-40, 40), e.y + rr(6, 14), rr(-.2, .2), rr(.2, .7), 1.3, R() < .5 ? 0 : 2, 90);
  if (R() < .06) spark(e.x + rr(-50, 50), e.y + rr(-8, 8), rr(-.3, .3), -rr(.2, .6), 18, '#d8c860');
}
/** killEnemy hook (the e.mid block already drops the pods and banners it): the filler resumes */
export function ufoKilled(e) {
  $.G.eat = 0;
  $.G.shake += 6;
  for (let k = 0; k < 40; k++) drop(e.x + rr(-40, 40), e.y + rr(-8, 10), rr(-2.5, 2.5), rr(-3, 1), rr(1.2, 2), R() < .4 ? 0 : R() < .5 ? 2 : 4, 110);
  sfx.groan();
}
