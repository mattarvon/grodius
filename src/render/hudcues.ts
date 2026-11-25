// @ts-nocheck
// =====================================================================
//  HUD CUES (round 4, r4-perf): what the HUD shows of four long4 rules the player could not see. Pure reads of $, no
//  drawing and no RNG, so tests/unit/hudcues.test.ts drives them against the real rules (player.ts, mid/_fight.ts).
//  - podShows: a capsule shows the slot it will give. K0 FIRST (player.ts applyPower, W6 round 3) turns a pod for a slot
//    already at its K0 level into the first missing K0 slot as it is taken, so a WARD-coloured pod that would become
//    THRUST now looks like THRUST (economy request: "HUD k0Gap capsule retype").
//  - stored: SEAL PRIMING's stored parts (player.ts primeOk). A sealed slot's stored fragments and whether a whole level
//    is waiting for the stage-2 seal (tune-tc request: "stored bar when slotLocked && frag > 0, plus a ready cue").
//  - floorHeld: the half floor (_fight.ts phaseShare) is holding the midboss's bar at its line (r3 fights request).
//  - lurched: the half clock (_fight.ts halfClock) just threw the fight into its second half (r3 fights request).
// =====================================================================
import { $ } from '../state';
import { SET } from '../save';
import { hardOn } from '../death';
import { PRIME, k0Gap, k0Held, needOf, slotLocked, slotMaxed } from '../player';
import { FT, g3 } from '../enemies/mid/_fight';

/** the slot a pod of type ty gives if it is taken now (applyPower's K0 FIRST branch, line for line). A FULL pod, meter mode,
 *  short and seal 1+ keep their type; past K0 the pod is re-rolled with R() as it is taken, which the HUD cannot (and
 *  must not) predict, so it shows its own type */
export function podShows(ty: number, full = false): number {
  if (ty == null || ty < 0 || !$.P || !hardOn() || full || SET.meter || (($.G && $.G.seal) || 0) !== PRIME.seal) return ty;
  const g = k0Gap();
  return g >= 0 && g !== ty && (k0Held(ty) || slotMaxed(ty)) ? g : ty;
}
/** SEAL PRIMING on slot i: n stored fragments of the need nd, ready once the whole level is stored (it grows in when the
 *  stage-2 seal breaks). null when nothing is stored on a sealed slot */
export function stored(i: number): { n: number; nd: number; ready: boolean } | null {
  if (!$.P || !hardOn() || SET.meter || !slotLocked(i)) return null;
  const n = ($.P.frag && $.P.frag[i]) || 0;
  if (!n) return null;
  const nd = needOf(i);
  return { n: Math.min(n, nd), nd, ready: n >= nd - PRIME.short };
}
/** the half floor on midboss e (phaseShare): null when it is not holding, else the bar fraction it holds at (.5 in the
 *  first half, 1 HP in the second). A kind joins the floor with its first phaseAtt (e.hfN), so a kind that never counts
 *  attacks shows nothing */
export function floorHeld(e: any): number | null {
  if (!e || !e.hfN || !g3() || !(e.max > 0)) return null;
  const h = e.hp < e.max * .5 ? 1 : 0, n = e.hfN[h] || 0;
  if (n >= FT.floorN && e.t >= e.hfT[h]) return null;
  return h ? 1 / e.max : .5;
}
/** did the half clock throw e into its second half since the last draw? (prev, prevT: e's HP and clock at that draw.) The
 *  clock passed its halfK mark in between and the HP crossed the half line: halfClock's own test. Not the exact value it
 *  writes: a phone that steps several times per draw can burn or shoot the HP off it first (audio-director). A hit that
 *  crosses the line on the very step the clock was due also counts; the cue is right either way */
export function lurched(e: any, prev: number, prevT: number): boolean {
  if (!e || !g3() || !(e.leave > 0)) return false;
  const half = e.max * .5, due = e.leave * FT.halfK;
  return prev >= half && e.hp < half && prevT < due && e.t >= due;
}
