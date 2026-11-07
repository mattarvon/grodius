// @ts-nocheck
// =====================================================================
//  DEPTH SCALING (docs/pacing.md 3.9, design/progression.md). From Descent 2 on, enemy toughness and aggression climb
//  with the descent (G.loop) so bosses keep a clock and fodder lives long enough to shoot. On the short layout every
//  factor here is exactly 1 in Descent 1 (it's the tuned, fresh-player game). A long layout also climbs within a descent
//  (dep(), spec §7 intra-descent depth, LS1 item G): long4's Descent 1 runs 1x at Open Orbit up to loop .35 on the Drive,
//  for regular enemies' HP and for all enemy fire. Midboss HP is exempt (D29, Matt): it reads the integer loop.
//
//  The power rule (D1): player power (G.pow, src/power.ts) shows up ONLY as enemy fire and density (every(), BS(),
//  formation() in src/enemies/spawn.ts). HP comes from depth and loop alone. The one exception is the Gravity Drive
//  (driveMul() below), whose fight collapses without its power terms (boss-probe numbers in design/progression.md).
//  HP multipliers are (1 + k * loop) on top of mk()'s x(1 + .4 * loop).
//  Until M2 the HP also read over() (power past the cap) with weights fodO .8 / midO .8 / bossO 1; the loop weights below
//  absorbed what a typical build paid through it (over ~.4 in Descent 2, ~.8 in Descent 3: .8 + .8 * .4 = 1.12 and
//  1.1 + 1 * .4 = 1.5), so a typical build's TTK holds and only a stacked build gets faster kills.
//  Measured with tools/depth-probe.mjs and tools/playtest.mjs (seeds 11 and 7).
// =====================================================================
import { $ } from './state';
import { midRow } from './enemies/mid/roster';
import { kindOf } from './layout';
import { descDepth, econId } from './economy';

/** a midboss kind not named in DEPTH.w takes its tag's share (spec §6.4: WINDOW and ANGLE .6, RACE .5; the rest 1),
 *  so a pool lane's new kind needs no line here */
export const TAG_W: Readonly<Record<string, number>> = { WINDOW: .6, ANGLE: .6, RACE: .5 };

export const DEPTH = {
  fod: 1.12, //  regular enemies (a boss's parts take the boss's factor)
  mid: 1.12, //  midbosses: the Saucer, the biome midbosses, and the Open Orbit Maw
  boss: 1.5, //  biome stage bosses (Crucifer, Butcher, the biome Maws)
  // share of the extra: every Maw runs on a 28 s escape clock (maw0 = the Open Orbit one, maw = a biome stage boss),
  // the Butcher's fight is gated by its cleaver and guard more than its HP pool (Descent 2 took 7-15 s before), and
  // the Womb (cyst), the Brood Mother and the Crucifer (crux) have guarded windows that make extra HP count more.
  // Elites (enemies/elite.ts, HP x1.8) are rolled after mk(), so they stack on top of all of this
  w: { maw0: .5, maw: .45, butcher: .15, crux: .6, cyst: .6, brood: .6 },
  // the Gravity Drive (driveMul): 560 HP x (1 + driveL * loop) x (1 + driveRank * rank) x (1 + driveO * over, from Descent 2).
  // The documented exception to D1. Without driveRank/driveO the fight collapses: boss-probe STRONG D1 9.8 s (14.3 with
  // them), depth-probe Descent 2 10.6 s / Descent 3 7.0 s (18.2 / 14.3 with them), against the 24-39 s documented for
  // Descent 2-3 (CHANGELOG 2026-10-30). The Drive is one big HP pool, no escape clock: it has nothing else to hold a fight
  driveL: .4, driveRank: .6, driveO: .2,
  fire: .45, //   enemy fire: cooldowns / (1 + fire * loop), random fire chance x(1 + fire * loop)
};

/** raw power past the rank cap, 0..2. Only the Gravity Drive's HP reads it (the D1 exception) */
export const over = () => Math.max(0, Math.min(2, ($.G.pow || 0) - 1));
/** depth for regular enemies' HP and for enemy fire (midboss HP takes the integer loop: D29): the descent plus the layout's intra-descent share at the current stage
 *  (src/economy.ts descDepth; spec §7). short: exactly G.loop. long4: G.loop + .35 * stage/3, so Open Orbit in Descent 1
 *  stays at 1x and the Drive stage's fodder reads loop + .35. Midboss and stage-boss HP and the Drive's keep the integer loop */
export const dep = () => descDepth(econId(), $.G.loop || 0, $.G.stage || 0);
const f = (k, L) => (L > 0 ? 1 + k * L : 1);
/** HP multiplier for a fresh enemy of kind k, stats b (its ET row); o = mk()'s options */
export function depthHP(k, b, o) {
  const D = dep();
  if (!(D > 0)) return 1;
  if (o.par && o.par.dm) return o.par.dm; // a boss's parts (the Crucifer's nailbars, the Choir's) are as tough as it is
  if (!b.mini) return f(DEPTH.fod, D);
  // the Open Orbit Maw and the mid-stage Maw count as midbosses: they escape on a clock and must stay killable
  // D29: midboss HP (the biome midbosses, the Saucer and these Maws) takes the integer loop only, no intra-descent term,
  // so D27's one 8-11 s TTK band holds in both biome slots. Their fire (cdm/firem) still reads dep(). Stage bosses
  // were already on the integer loop. So within a descent, intra-depth HP reaches regular enemies only
  const L = $.G.loop || 0;
  const mid = b.mid || (k === 'maw' && (!o.stageBoss || kindOf($.G.stage || 0) === 'orbit')), m = mid ? f(DEPTH.mid, L) : f(DEPTH.boss, L);
  return 1 + (DEPTH.w[k === 'maw' && mid ? 'maw0' : k] ?? TAG_W[midRow(k)?.tag ?? ''] ?? 1) * (m - 1);
}
/** the Gravity Drive's HP multiplier (x560 HP, x48 per plate): loop and, as the one D1 exception, rank and over() */
export const driveMul = () => { const L = $.G.loop || 0; return (1 + DEPTH.driveL * L) * (1 + DEPTH.driveRank * ($.G.rank || 0)) * (L > 0 ? 1 + DEPTH.driveO * over() : 1); };
/** enemy cooldown multiplier (<= 1): shorter waits between telegraphed attacks with depth (dep(): from Descent 2 on, and
 *  within a long descent). Its callers are regular enemies, midbosses and the Saucer; stage bosses do not read it */
export const cdm = () => 1 / (1 + DEPTH.fire * dep());
/** enemy fire-chance multiplier (>= 1), on dep() like cdm() */
export const firem = () => 1 + DEPTH.fire * dep();
/** one more bullet in a burst from Descent 3 on */
export const xtra = () => (($.G.loop || 0) >= 2 ? 1 : 0);
