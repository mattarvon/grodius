// @ts-nocheck
// =====================================================================
//  DEPTH SCALING (docs/pacing.md 3.9). The power rank G.rank (step.ts) runs 0..1 and hits the cap around the end of
//  Descent 1, but the player keeps growing after that: more weapon levels, grafts, perks and contraption levels. From
//  Descent 2 on, toughness and aggression keep climbing with the descent AND with the power past the cap, so bosses
//  keep a clock, fodder lives long enough to shoot, and a stacked build still gets a fight. In Descent 1 every factor
//  here is exactly 1 (it's the tuned, fresh-player game).
//
//  over() = raw power past the cap: G.pow (the uncapped rank, step.ts) + bolted contraption levels, minus 1, 0..2.
//  HP multipliers are (1 + k * loop + kO * over) on top of the old mk() scaling (x(1 + .4 * loop), x(1 + rank)).
//  Measured with tools/playtest.mjs (seeds 11 and 7, 3 descents); the knobs are below.
// =====================================================================
import { $ } from './state';

export const DEPTH = {
  fod: .8, fodO: .8, //     regular enemies (a boss's parts take the boss's factor)
  mid: .8, midO: .8, //     midbosses: the Saucer, the biome midbosses, and the Open Orbit Maw
  boss: 1.1, bossO: 1, //   biome stage bosses (Crucifer, Butcher, the biome Maws)
  drive: 0, driveO: .2, //  the Gravity Drive (its own formula in boss/update.ts already tracks loop and rank)
  // share of the extra: every Maw runs on a 28 s escape clock (maw0 = the Open Orbit one, maw = a biome stage boss),
  // the Butcher's fight is gated by its cleaver and guard more than its HP pool (Descent 2 took 7-15 s before), and
  // the Womb (cyst), the Brood Mother and the Crucifer (crux) have guarded windows that make extra HP count more.
  // Elites (enemies/elite.ts, HP x1.8) are rolled after mk(), so they stack on top of all of this
  w: { maw0: .5, maw: .45, butcher: .15, crux: .6, cyst: .6, brood: .6 },
  rig: .035, //             each bolted contraption level counts this much raw power toward over()
  fire: .45, //             enemy fire: cooldowns / (1 + fire * loop), random fire chance x(1 + fire * loop)
};

/** raw power past the rank cap, 0..2 (0 throughout Descent 1 by construction of the callers) */
export function over() {
  const m = $.meta, lv = m && m.cl ? (m.rig || []).reduce((s, id) => s + (m.cl[id] || 1), 0) : 0;
  return Math.max(0, Math.min(2, ($.G.pow || 0) + DEPTH.rig * lv - 1));
}
const f = (k, kO) => { const L = $.G.loop || 0; return L > 0 ? 1 + k * L + kO * over() : 1; };
/** HP multiplier for a fresh enemy of kind k, stats b (its ET row); o = mk()'s options */
export function depthHP(k, b, o) {
  if (!($.G.loop > 0)) return 1;
  if (o.par && o.par.dm) return o.par.dm; // a boss's parts (the Crucifer's nailbars, the Choir's) are as tough as it is
  if (!b.mini) return f(DEPTH.fod, DEPTH.fodO);
  // the Open Orbit Maw (stage 0) and the mid-stage Maw count as midbosses: they escape on a clock and must stay killable
  const mid = b.mid || (k === 'maw' && (!o.stageBoss || !$.G.stage)), m = mid ? f(DEPTH.mid, DEPTH.midO) : f(DEPTH.boss, DEPTH.bossO);
  return 1 + (DEPTH.w[k === 'maw' && mid ? 'maw0' : k] ?? 1) * (m - 1);
}
export const driveHP = () => f(DEPTH.drive, DEPTH.driveO);
/** enemy cooldown multiplier (<= 1): shorter waits between telegraphed attacks from Descent 2 on */
export const cdm = () => 1 / (1 + DEPTH.fire * ($.G.loop || 0));
/** enemy fire-chance multiplier (>= 1) */
export const firem = () => 1 + DEPTH.fire * ($.G.loop || 0);
/** one more bullet in a burst from Descent 3 on */
export const xtra = () => (($.G.loop || 0) >= 2 ? 1 : 0);
