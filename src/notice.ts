// D61 Pass 1, "it notices you" (production/qa/difficulty-package-2026-11-20.md section 3): the threats that used to be
// written to avoid the ship now turn on it. Tuning and the pure rules live here, a leaf with no imports, so tests and
// tools can read them without the sim. Every new threat keeps D59's fairness rules: a tell of at least 44 f, a
// guaranteed gap, nothing that punishes shooting and nothing unavoidable from off-screen.
//   - passed sentries and mutants turn and fire ONE volley back (enemies/update.ts updNew)
//   - from Descent 2 a dive drone that missed U-turns once (enemies/update.ts, drone 'dive')
//   - rear waves come in at the ship's height (enemies/spawn.ts rearLane)
//   - every 3rd hazard (1 in 2 in Descent 3) marks the ship's column and drops there (biomes.ts spawnHazard)
//   - flayers hunt: their parking x follows the ship (enemies/update.ts, flayer)
// Measured by tools/playtest.mjs (would-be hits/min) and tools/pod-probe.mjs --mortal --pilot.
export const NOTICE = {
  // --- turn-around attacks ---
  sentryGap: 20, //  a sentry counts the ship as passed once it is 20 px to its right (mirrors its forward test, P.x < e.x - 20)
  mutantGap: 30, //  the mutant's mirror of its forward test (P.x < e.x - 30)
  backMinX: 40, //   never turn within 40 px of the left edge: the volley must come from a body the player can see
  // --- the dive drone's U-turn (Gradius) ---
  uLoop: 1, //       from Descent 2 (G.loop 1); Descent 1 keeps the old pass-through dive
  uGap: 30, //       it has missed once it is 30 px left of the ship
  uMinX: 40, //      and still at least 40 px on screen (it brakes ~18 px more during the tell)
  uTel: 46, //       the tell (>= 44 f, D59): it brakes and flares, flips at the half, its lane locks for the last uLock f
  uLock: 16, //      the lane line goes solid for these last frames (the sentry's lock grammar, 18 f there)
  uVx: 2.6, //       the return run, px/f rightward in screen space, straight along the locked lane (no homing: step off it)
  // --- hazards that mark the ship's column ---
  hazEvery: 6, //    every 6th hazard is aimed (Descent 1-2). D61: 3; D62 toned it down (biome B 7.2 hits/min)
  hazEveryD3: 4, //  1 in 4 from Descent 3 (G.loop 2). D61: 2
  hazHw: 12, //      the mark's half width: the band is 24 px, the hazard's own hit column 10-14 px
  hazPad: 4, //      frames added to a geyser's or jet's warm-up for its reach to grow to the ship (it grows over 8 f)
  // --- flayers hunt ---
  flayDx: 90, //     the flayer parks 90 px ahead of the ship, inside its 155 px strike radius
  flayLo: 60, //     its parking x never goes left of 60 px
  flayHi: .85, //    nor right of W * .85 (it only strikes from x < W - 20)
  flayLock: 16, //   its aim locks for the last 16 f of its 34 f tell (it tracked to the end; with hunting that left no dodge)
  // --- D62 (Matt, 2026-11-21): Pass 1 toned down to D61's own D1 bands on the fixed playtest probe (bullets counted).
  // The mechanics stay; these set how often they come. 1 / 1 / true are D61 as merged. D63: long4 (the default) runs
  // D61's rates again (economy.ts HARD_LONG4.notice, read through noticeOf); short and long5 keep these ---
  flayEvery: 2, //   every 2nd flayer hunts (the others park at their spawn x, as before D61)
  flayCool: 1.4, //  a hunting flayer's cooldown after a lash, x its coolFor('flayer') (it is always in reach)
  hazInFight: false, // no aimed hazards while a midboss or boss is up (the fight is the threat then)
};

/** the hazard's warm-up (frames) before it can hurt: biomes.ts stepBiome's icicle 50, geyser 70, jet 60 */
export const HAZ_WARM: Record<string, number> = { icicle: 50, geyser: 70, jet: 60 };

/** whether the n-th hazard of a descent (1-based) is aimed at the ship's column; loop is G.loop (2 = Descent 3).
 *  Only the column hazards are aimed (a strand sweeps in from the right edge and never is) */
export function hazAimed(n: number, loop: number, k: string, o: Pick<typeof NOTICE, 'hazEvery' | 'hazEveryD3'> = NOTICE): boolean {
  if (!(k in HAZ_WARM)) return false;
  return n % (loop >= 2 ? o.hazEveryD3 : o.hazEvery) === 0;
}

/** frames from a hazard's spawn until it reaches height y in its column. top: the icicle's tip at spawn (it hangs from
 *  the ceiling, waits HAZ_WARM, then falls at .22 px/f^2: biomes.ts) */
export function hazReach(k: string, top: number, y: number): number {
  if (k === 'icicle') return HAZ_WARM.icicle + Math.sqrt(2 * Math.max(0, y - top) / .22);
  return (HAZ_WARM[k] ?? 0) + NOTICE.hazPad;
}

/** the screen x to drop an aimed hazard at: where the ship's column will be when the hazard reaches it if the ship
 *  holds still, since a hazard scrolls left with the world at ss px/f. Clamped on screen so its mark is always seen */
export function hazLeadX(k: string, px: number, py: number, ss: number, top: number, W: number): number {
  return Math.min(W * .92, Math.max(16, px + ss * hazReach(k, top, py)));
}

/** whether the n-th flayer of a run (1-based) hunts (D62: every flayEvery-th) */
export const flayHunts = (n: number, o: Pick<typeof NOTICE, 'flayEvery'> = NOTICE): boolean => n % o.flayEvery === 0;

/** the flayer's parking x: 90 px ahead of the ship, clamped (it used to park at a fixed random x) */
export function flayerTx(px: number, W: number): number {
  return Math.min(W * NOTICE.flayHi, Math.max(NOTICE.flayLo, px + NOTICE.flayDx));
}
