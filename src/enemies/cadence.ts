// @ts-nocheck
// =====================================================================
//  ENEMY ATTACK CADENCE: frames between telegraphed attacks, per kind, all in one place.
//  Each kind has Matt's authored depth curve, max(floor, base - step * loop), and the global depth step cdm()
//  on top of it (he wrapped these curves in cdm() himself in cb50d04, then tuned d0115f4 against the result).
//  Both are intended, so this is not double counting. M2's first pass dropped the per-kind curves and softened
//  Descent 3 fire by ~22% (eye 3.03 -> 2.35 b/s); the studio review blocked that, so these reproduce the
//  pre-M2 numbers exactly. Whether deep fire should be softer is Matt's call (art-direction picker, "deep fire").
//  Measured with tools/fire-probe.mjs (bullets/s per kind, Descent 1-3).
// =====================================================================
import { $ } from '../state';
import { cdm, xtra } from '../depth';

/** per kind: Descent 1 base cooldown (frames, before the caller's ri() jitter), frames shaved per descent, floor */
export const COOL = {
  eye: { base: 120, step: 18, floor: 55 }, //     aimed 1-3 shot volley from a surface eye (+0-40 jitter)
  cross: { base: 130, step: 18, floor: 70 }, //   crucified corpse's 3/5-shot spread (+0-40)
  flayer: { base: 110, step: 15, floor: 60 }, //  whip strike, after its 34f tell (+0-40)
  slime: { base: 170, step: 20, floor: 100 }, //  snot lob, after its 32f rear-up (+0-50)
  mutant: { base: 190, step: 25, floor: 120 }, // 3/5 lobbed chunks, after its 44f groan (+0-50)
  sentry: { base: 130, step: 20, floor: 80 }, //  gap between its two aimed bursts (+0-30)
};
/** kind k's authored curve at the current descent, before the global depth step */
export const curve = (k) => { const c = COOL[k]; return Math.max(c.floor, c.base - c.step * ($.G.loop || 0)); };
/** cooldown for kind k after an attack; roll = the ri() jitter the caller drew */
export const coolFor = (k, roll) => Math.round((curve(k) + roll) * cdm());
/** frames between a womb's litters: Matt's curve, deliberately without cdm() (more would swamp the screen) */
export const wombCool = () => Math.max(70, 120 - 15 * ($.G.loop || 0));
/** bullets in a dying enemy's revenge fan: a pair in Descent 2, a 3-fan from Descent 3 (the caller gates on Descent 2+) */
export const revengeN = () => 2 + xtra();
