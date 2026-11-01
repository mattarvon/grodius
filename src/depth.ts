// @ts-nocheck
// =====================================================================
//  DEPTH SCALING (docs/pacing.md 3.9, design/progression.md). From Descent 2 on, enemy toughness and aggression climb
//  with the descent (G.loop) so bosses keep a clock and fodder lives long enough to shoot. In Descent 1 every factor
//  here is exactly 1 (it's the tuned, fresh-player game).
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
const f = (k) => { const L = $.G.loop || 0; return L > 0 ? 1 + k * L : 1; };
/** HP multiplier for a fresh enemy of kind k, stats b (its ET row); o = mk()'s options */
export function depthHP(k, b, o) {
  if (!($.G.loop > 0)) return 1;
  if (o.par && o.par.dm) return o.par.dm; // a boss's parts (the Crucifer's nailbars, the Choir's) are as tough as it is
  if (!b.mini) return f(DEPTH.fod);
  // the Open Orbit Maw (stage 0) and the mid-stage Maw count as midbosses: they escape on a clock and must stay killable
  const mid = b.mid || (k === 'maw' && (!o.stageBoss || !$.G.stage)), m = mid ? f(DEPTH.mid) : f(DEPTH.boss);
  return 1 + (DEPTH.w[k === 'maw' && mid ? 'maw0' : k] ?? 1) * (m - 1);
}
/** the Gravity Drive's HP multiplier (x560 HP, x48 per plate): loop and, as the one D1 exception, rank and over() */
export const driveMul = () => { const L = $.G.loop || 0; return (1 + DEPTH.driveL * L) * (1 + DEPTH.driveRank * ($.G.rank || 0)) * (L > 0 ? 1 + DEPTH.driveO * over() : 1); };
/** enemy cooldown multiplier (<= 1): shorter waits between telegraphed attacks from Descent 2 on */
export const cdm = () => 1 / (1 + DEPTH.fire * ($.G.loop || 0));
/** enemy fire-chance multiplier (>= 1) */
export const firem = () => 1 + DEPTH.fire * ($.G.loop || 0);
/** one more bullet in a burst from Descent 3 on */
export const xtra = () => (($.G.loop || 0) >= 2 ? 1 : 0);
