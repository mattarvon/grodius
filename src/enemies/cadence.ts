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
import { cdm, late, xtra } from '../depth';
import { kindOf } from '../layout';
import { ECON, econId } from '../economy';
import { cadMul } from '../rank';

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
/** DIFFICULTY-SPEC C2 for regular shooters: their cooldowns x rank.ts cadMul (1.25 - .6 rho; x1.17 at rank 2, x.65 at
 *  16), floor 18 f, on a long entry with a HardSet (long4) only, so short keeps today's numbers (spec §5.3).
 *  W0 lands it OFF (inert hook): W1 turns it on with its bullet changes and gates B2 / N1 */
export const RANK_CAD = false;
/** the rank cadence factor coolFor applies: cadMul on long4 once RANK_CAD is on, else 1. Pure, no R() */
export const rankCool = () => (RANK_CAD && ECON[econId()].hard ? cadMul($) : 1);
/** cooldown for kind k after an attack; roll = the ri() jitter the caller drew. The long4 test is taken once; rank is
 *  live (rank.ts), never G.rk. cadence.ts passes to W1 after W0 (it flips RANK_CAD) */
export const coolFor = (k, roll) => {
  const on = RANK_CAD && !!ECON[econId()].hard;
  const c = Math.round((curve(k) + roll) * cdm() * driveCool() * (on ? cadMul($) : 1));
  return on ? Math.max(18, c) : c; // C2's 18 f floor, with the rank factor only
};
/** D62: a regular shooter's first-shot range: its own [lo, hi], or the Drive stage's LateSet.driveFirst on a long entry.
 *  The caller draws one ri() over it either way, so the R() count is unchanged */
export const firstShot = (lo, hi) => { const L = late(); return L && L.driveFirst && kindOf($.G.stage || 0) === 'drive' ? L.driveFirst : [lo, hi]; };
/** D62: the Drive stage's cooldown multiplier on a long entry (economy.ts LateSet.driveCool), else 1 (short: 1) */
const driveCool = () => { const L = late(); return L && kindOf($.G.stage || 0) === 'drive' ? L.driveCool : 1; };
/** frames between a womb's litters: Matt's curve, deliberately without cdm() (more would swamp the screen) */
export const wombCool = () => Math.max(70, 120 - 15 * ($.G.loop || 0));
/** bullets in a dying enemy's revenge fan: a pair in Descent 2, a 3-fan from Descent 3 (the caller gates on Descent 2+) */
export const revengeN = () => 2 + xtra();
