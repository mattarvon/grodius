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

// =====================================================================
//  G3 (DIFFICULTY-SPEC §2.1 / §2.3, workstream W1): bullets, the roster's fire rules and the entries, rebuilt on
//  Gradius III. long4 only: every reader gates on `ECON[econId()].hard` (enemies/spawn.ts g3()), so `short` and the
//  layout-parity baseline never see a value below. Pure leaf (no imports): tests and tools read it directly.
//  Tags: [GR] gradius-reference.md, [FR] Matt's frame notes, [DER] derived, Cn the spec's conflict row; the gate that
//  measures each value follows it.
// =====================================================================
export const BUL = {
  // --- caps (§2.1 "Bullet caps", C4/C5; rank.ts bulletCap() is authoritative once W0 lands, this is its mirror) ---
  cap: { scroll: [6, 8, 10, 10], setp: [12, 16, 20, 20], boss: [18, 24, 30, 30] }, // by tier Easy..VH [GR rule 1]; B1
  retry: 20, //        a refused volley's shooter retries after min(remaining, 20 f) (§2.1); B1
  backstop: 260, //    eshots.length past this never spawns (the old guard, kept)
  // --- fairness (§2.1 "Fairness", C9/C10) ---
  noShot: 64, //       no shot spawns within 64 px of the ship [GR rule 11]; F1, N4
  noBody: 48, //       nor a body within 48 px [GR rule 9, LVL S5]; N4
  noKid: 30, //        a split child's launch flips when its spawn point is within 30 px of the ship (CREW KNOTS); N4. On long4 a child
  //                   within noBody + kidPad is not born at all, so this flip only acts on short
  bodyPad: 10, //      an off-screen entrant clears noBody by 10 px more: its first frame can close up to ~8 px (a sentry's lerp in) before anyone sees it (L5 hazBad, N4)
  kidPad: 20, //       a split child is born on screen, so it needs a reaction margin: >= 48 px still after 5 f of the ship flying
  //                   straight at it at full thrust (2.93 px/f) while it drifts 1.1 px/f (L5 hazBad body-on-ship:clump / corpse; route-probe looks every 5th frame)
  tell: 12, //         every aimed shot shows a tell of at least 12 f (C10); F1
  edge: 40, //         a free-flying shooter fires only once it is more than 40 px inside the edge it entered by (NOTICE.backMinX)
  // --- speed (§2.1 "Speed, aim and who may shoot", C7) ---
  v: { drone: 1.4, eye: 1.5, sentry: 1.7 }, // px/f bases [FR "slow pellets", GR rule 3]; S1
  vcap: [2.6, 2.6, 2.9, 2.9], //  V_CAP by tier: the ship at THRUST 3 (2.51) / THRUST 4 (2.93) [GR rule 3]; S1
  rankV: .02, //       x(1 + .02 rank) on every bullet's speed (§2.1 rank table); S1
  loopV: .12, loopVMax: 1.3, // x min(1.3, 1 + .12 loop); S1
  // --- aim lead (C8): L = .2 + .6 rho, on single aimed shots and a spread's centre; N2 ---
  leadA: .2, leadB: .6,
  leadT: 60, //        t = min(60, dist / v) frames of lead at most
  aimY0: 6, aimY1: 248, // the aim point stays in the playfield (touch drags move up to 9 px/f)
  // --- the designated formation shooter (C6; ENC roster "drone"); N1 ---
  tellPad: 2, //       a right entrant's tell ends this far past the 40 px edge, so rounding in its speed estimate never refuses the shot
  // a right entrant tells 12 f before it is 40 px in, at its own last-frame speed (enemies/update.ts droneFire; W6 tune:
  // W * .95 ended the wall pattern's tell at 441, refused, re-told; game-designer: W * .78 broke N3's <= 30 f; spec amendment)
  droneBackX: 20, //   a rear-wave shooter from x >= 20 (its tell ends past the 40 px edge, behind the ship: N2). It tells (and its tell drops the phase-in ghost) only once the ship is >= 64 px off, so the body that fires is solid; since round 4 no rear ghost runs out within 64 px of the ship either (enemies/update.ts updEnemy)
  droneEdgeY: 22, //   a drop / rise shooter once 22 px in from its edge, so the 12 f tell at 1.6 px/f ends just past 40 px (41.2) (W6 tune: 20 ended it at 39, refused, re-told: N3 drone 44 f)
  rank2: 14, //        at rank >= 14 the last member shoots too (C3), so a formation fires 2 bullets at most
  // W6 tune (N1, N3): the designated shooter is the LEADER (member 0), not the last member: the last one entered
  // 16 px x n behind it and told at 50 f from spawn, so the statue had killed 2 of 3 before they fired (N1 drones 34-41%)
  // --- first attack after spawn (ENC E2; gate N3 <= 30 f from visible): one ri() over the range, as before ---
  first: { eye: [20, 30], cross: [34, 40], crawler: [20, 28], sentry: [6, 12], slime: [14, 18], mutant: [30, 30], flayer: [20, 28], watcher: [100, 120] } as Record<string, [number, number]>,
  // (watcher: THE WATCHER, enemies/watcher.ts, waits 20-40 f once fully in, then a 40 f blink tell: a readable event, so it sits outside N3's 30 f on purpose)
  // (W6 tune, N3 / N1: sentry 30-40 -> 6-12, its tell may start as it glides in; crawler 30-40 -> 20-28; slime 30 -> 14-18, its rear-up may start fully on screen; flayer added. N3 read sentry 32 f, flayer 76 f)
  flayIn: .06, //      a long4 flayer closes on its parking x at .06 a frame (short .03), so it is in reach by its first attack (N3)
  flayRetry: 4, //     and an out-of-reach flayer looks again every 4 f (short 20): its first lash tells the frame it can reach
  sentryTel: 44, //    the sentry's tell: 26 f tracking + 18 f lock (C11); F1
  sentryLock: 18,
  sentryDrop: 2, //    px/f: Orbit / Drive sentries that drop in from the top or bottom edge (every 2nd); N4
  sentryBursts: 1, // [FIT] W6 tune (B2 Hard, pod-probe --pilot --tier 2): a long4 sentry fires ONE telegraphed burst, then moves on (short: 2). Now
  //                   that nearly every sentry gets its burst off (N1), the second one pushed Orbit's scroll share > 5 bullets from 18% to 36% on Hard
  sentryNear: 24, //   a dropping sentry may start its tell within 24 px of its lane (it then holds still through the lock); N1
  sentryBack: 70, //   W6 tune (N2, N1): a drop-in sentry takes its lane 70 px BEHIND the ship when that is >= sentryBackMin in (ship x
  sentryBackMin: 50, // >= 120), so it fires from behind (forward fire killed 2 of 3 ahead of the ship before their 44 f tell ended); else the scripted tx
  slimeGap: 24, //     a slime lobs at either side once |dx| >= 24 (was: only at a ship ahead); N2
  // --- revenge (§2.1 "Revenge bullets"): popcorn only, [tier][min(loop, 2)] [GR rule 9, the Gradius V table]; D3 ---
  rev: [[0, 0, 0], [0, .33, .5], [.33, .5, 1], [.5, 1, 1]],
  revDelay: 8, //      the orb leaves 8 f after the kill
  revV: .8, //         at .8 x v_kind, unled
  revRing: 6, //       a large enemy's ring on Hard and Very Hard, from Descent 2
  // --- economy hooks this stream owns (§2.2) ---
  blueEvery: 12, //    every 12th red capsule dropped is blue [GR §4 S, Gradius II]; replaces the 7% roll; E2
  recDy: 40, //        recovery carriers fly in at the ship's height +- 40 px (ECO §2.3, C17); E1
  uLoop: 0, //         Descent 1 gets the dive drone's U-turn (NOTICE.uLoop 1 -> 0, ENC roster "drone dive")
};

/** the spawn-side 48 px rule (§2.1 "Fairness", S5; gates N4 and L5 hazBad): where an off-screen entrant spawning at
 *  (x, y) must start so it is at least r px from a ship at (px, py), pushed further out along the edge it enters by
 *  (right / left: x; top / bottom: y). An entrant already clear, or a spawn on screen (the caller's to refuse), comes
 *  back unchanged. Pure: no R(), so a pushed spawn draws exactly what it would have */
export function clearOfShip(x: number, y: number, px: number, py: number, W: number, PH: number, r: number): [number, number] {
  const dx = x - px, dy = y - py;
  if (dx * dx + dy * dy >= r * r) return [x, y];
  const hx = Math.sqrt(Math.max(0, r * r - dy * dy)), hy = Math.sqrt(Math.max(0, r * r - dx * dx));
  if (x >= W) return [Math.max(x, px + hx), y]; // a right entrant: further right
  if (x <= 0) return [Math.min(x, px - hx), y]; // a rear entrant: further left
  if (y <= 0) return [x, Math.min(y, py - hy)]; // a drop: further up
  if (y >= PH) return [x, Math.max(y, py + hy)]; // a rise: further down
  return [x, y];
}

/** the cap context a shooter counts against (§2.1): regular shooters always use `scroll` */
export type CapCls = 'scroll' | 'setp' | 'boss';

/** the cap for context cls at tier (0-3) */
export const capFor = (cls: CapCls, tier: number): number => BUL.cap[cls][Math.max(0, Math.min(3, tier | 0))];

/** does a volley of n fit beside `live` counted shots under `cap`? Atomic: all of it or none (§2.1) */
export const volleyFits = (live: number, n: number, cap: number): boolean => live + n <= cap;

/** the frames until a refused shooter tries again: min(remaining, 20) (§2.1) */
export const retryIn = (remaining: number): number => Math.max(1, Math.min(remaining, BUL.retry));

/** L = .2 + .6 rho (C8) */
export const leadOf = (rho: number): number => BUL.leadA + BUL.leadB * Math.max(0, Math.min(1, rho));

/** the angle of a shot from (x, y) at speed v (px/f) aimed at a ship at (px, py) moving (vx, vy) px/f, with lead L:
 *  the aim point is the ship's position L * t frames ahead, t = min(60, dist / v), its y clamped to 6-248 (§2.1).
 *  A still ship, or L 0, is exact aim */
export function aimLeadA(x: number, y: number, px: number, py: number, vx: number, vy: number, v: number, L: number): number {
  const t = Math.min(BUL.leadT, Math.hypot(px - x, py - y) / Math.max(.1, v));
  const ax = px + L * vx * t, ay = Math.max(BUL.aimY0, Math.min(BUL.aimY1, py + L * vy * t));
  return Math.atan2(ay - y, ax - x);
}

/** bullet speed on long4: min(V_CAP, v * (1 + .02 rank) * min(1.3, 1 + .12 loop)) (§2.1) */
export const bulletV = (v: number, rank: number, loop: number, tier: number): number =>
  Math.min(BUL.vcap[Math.max(0, Math.min(3, tier | 0))], v * (1 + BUL.rankV * Math.max(0, rank)) * Math.min(BUL.loopVMax, 1 + BUL.loopV * Math.max(0, loop)));

/** the revenge chance for popcorn at tier and loop (0-based); 0 means no R() is drawn (§2.1) */
export const revChanceOf = (tier: number, loop: number): number => BUL.rev[Math.max(0, Math.min(3, tier | 0))][Math.min(2, Math.max(0, loop | 0))];

/** is the n-th red capsule (1-based) blue? */
export const blueAt = (n: number): boolean => n > 0 && n % BUL.blueEvery === 0;

/** may a free-flying shooter fire (the firing gates, §2.1): the ship at least 64 px away and the shooter more than 40 px
 *  inside the edge it entered by. ent: 'right' (default), 'left' (a rear wave), 'top' (drop), 'bottom' (rise) */
export function mayFire(x: number, y: number, ent: string | undefined, px: number, py: number, W: number, PH: number): boolean {
  if (Math.hypot(px - x, py - y) < BUL.noShot) return false;
  const m = BUL.edge;
  if (ent === 'left') return x > m && x < W - 8;
  if (ent === 'top') return y > m && x > m && x < W - 8;
  if (ent === 'bottom') return y < PH - m && x > m && x < W - 8;
  return x < W - m && x > m; // a right entrant, and never from a body about to leave by the left (backMinX)
}

// ---------------- entries (§2.3 "Formations and entries"; LVL §2.4, §4) ----------------
export type EntryEdge = 'right' | 'behind' | 'top' | 'bottom' | 'wall';
export const ENTRY = {
  tell: 60, //         the drop / rise edge chevron (LVL §2.4; S4 >= 44 f)
  v: 1.6, vTeach: 1.2, // px/f vertical, then onto the sine (the teaching beat flies 1.2)
  laneDx: 110, laneLo: 200, lanePad: 40, // laneX = clamp(P.x + 110, 200, W - 40), picked at the tell
  gap: 18, //          members i * 18 px apart along x (and up the edge, so they stream in)
  yHi: .3, yLo: .7, // they level off at PH * .3 or PH * .7, on the ship's half
  loopX: .45, loopR: 60, loopV: 2, // 'loop': at W * .45 a 60 px-radius half circle back, then out right (ENC §3)
  birthTell: 44, //    a wall birth's bulge tell (S4)
  birthDx: 10, //      hatchlings born 10 px apart along the wall
  // the target entry mix per stage kind, as shares of formations (§2.3 table, LVL §4); N4 within +-5 points
  mix: {
    orbit: { right: .55, behind: .2, top: .12, bottom: .13, wall: 0 },
    // [FIT] W6 tune (N4, playtest/space-probe entries): the biome FILLER's draw (biomes.ts via cellpick droneEntry), set so filler plus the authored beats lands on the §2.3 table. The biome
    // beats bring their own hatchling waves (biomes.ts, ~1 in 2 from behind: biome A read left 35%, top 0), and a wall
    // entry with no wall at its lane tries the other wall, then the same edge's drop / rise (round 4; it was a right entry). biome A's rear share is all authored hatchlings: cut
    // those beats and A has no rear entries
    // round 4 (N4, 8-seed statue entry log by source): a biome stage's authored beats alone are ~43% right and ~17-24%
    // rear (the 2 opener carriers + the release, all right sines; the biome's hatch rolls; the set pieces' rear waves; A read
    // right 66 / bottom 3 / wall 3, B left 26) before the
    // filler, so its filler carries the top, bottom and wall shares and a little rear (the rear waves are N2's shots from
    // behind: B's rear .12 -> 0 took N2 regular from 24% to 14% on the statue)
    biome0: { right: .28, behind: .1, top: .2, bottom: .2, wall: .22 }, //   table 55 / 15 / 10 / 10 / 10
    biome1: { right: .26, behind: .1, top: .25, bottom: .25, wall: .14 }, //  table 50 / 18 / 12 / 12 / 8
    drive: { right: .5, behind: .2, top: .15, bottom: .15, wall: 0 }, // unread: the Orbit and Drive filler edge is scripts.ts FILL_EDGE (W3b)
  } as Record<string, Record<EntryEdge, number>>,
  // a right entry's pattern: the old four, plus 'loop' (Orbit and the Drive, about 1-2 a stage: ENC §3)
  rightPat: ['sine', 'zig', 'dive', 'wall'],
  loopShare: .12, //   of the right entries in Orbit and the Drive
};

/** laneX for a drop / rise / wall birth: clamp(P.x + 110, 200, W - 40), at the tell */
export const laneX = (px: number, W: number): number => Math.max(ENTRY.laneLo, Math.min(W - ENTRY.lanePad, px + ENTRY.laneDx));

/** the mix row for a stage kind ('orbit' | 'biome' | 'drive') and biome slot (0 = A, 1 = B) */
export const entryMix = (kind: string, slot = 0): Record<EntryEdge, number> => ENTRY.mix[kind === 'biome' ? (slot > 0 ? 'biome1' : 'biome0') : kind] || ENTRY.mix.orbit;

/** the entry edge for a filler formation from u in [0, 1) (the build stream rs, never the sim R(): §2.3) */
export function entryPick(kind: string, slot: number, u: number): EntryEdge {
  const m = entryMix(kind, slot), ks = Object.keys(m) as EntryEdge[], tot = ks.reduce((s, k) => s + m[k], 0);
  let acc = 0;
  for (const k of ks) { acc += m[k] / tot; if (u < acc) return k; }
  return 'right';
}

/** a right entry's pattern from u2 in [0, 1): 'loop' for loopShare of them in Orbit and the Drive */
export function rightPat(kind: string, u2: number): string {
  const lp = kind === 'orbit' || kind === 'drive';
  if (lp && u2 < ENTRY.loopShare) return 'loop';
  const r = lp ? (u2 - ENTRY.loopShare) / (1 - ENTRY.loopShare) : u2;
  return ENTRY.rightPat[Math.max(0, Math.min(3, Math.floor(r * 4)))];
}

// ---------------- CREW KNOTS kinds (LVL §3.2; W3 places them in Orbit) ----------------
export const KNOT = {
  r: 24, hp: 20, //       a knot of 5-7 bodies; [FIT] W6 tune (L7): ~2.5 s of the naked gun (was 8, ~1 s), still a burstable body
  //                      (game-designer). space-probe Orbit knot-window cover p90 (L7): 0-13% at 8, 7-10 at 20, 21-35 at 40, 33-37
  //                      unkillable, so the band is the placement's (W3b: more knots on the column at once), not the hp's
  drift: .2, //           world drift px/f (left, on top of the scroll it rides). [FIT] W6 tune (L7, space stream's request): .35;
  //                      slower, a knot holds the ship's column longer
  bob: 10, bobF: 180, //  +-10 px over 180 f
  spin: .01, //           rad/f
  clumpR: 14, clumpHp: 6, // [FIT] W6 tune (L7, space-probe cover): 3; the two clumps cover more of the column than the knot did
  clumpA: 40 * Math.PI / 180, clumpV: .9, clumpF: 60, // thrown +-40 deg off the knot's travel at .9, decaying to drift over 60 f
  corpseA: 50 * Math.PI / 180, corpseV: 1.1, corpseF: 60, corpseHp: 1, // corpses +-50 deg at 1.1, 1 HP (popcorn rule)
  laneGap: 48, //         a knot spawns at W + 30 only on a lane >= 48 px from the ship's y, else 48 px toward the larger side
  x0: 30, //              spawn x past the right edge
};

/** a split child's launch angle: base +- the spread, rotated 180 deg when its spawn point is within 30 px of the ship
 *  (deterministic: no R(); LVL §3.2 fairness) */
export function kidAngle(base: number, side: number, spread: number, x: number, y: number, px: number, py: number): number {
  const a = base + side * spread;
  return Math.hypot(px - x, py - y) < BUL.noKid ? a + Math.PI : a;
}

/** a knot's spawn lane: y, or 48 px from the ship toward its larger free side when y is within 48 px of the ship's y */
export function knotLane(y: number, py: number, PH: number): number {
  if (Math.abs(y - py) >= KNOT.laneGap) return y;
  const ny = PH - py >= py ? py + KNOT.laneGap : py - KNOT.laneGap;
  return Math.max(KNOT.r, Math.min(PH - KNOT.r, ny));
}
