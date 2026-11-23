// =====================================================================
//  THE STAGE BOSSES AND THE GRAVITY DRIVE on the Gradius III model (DIFFICULTY-SPEC §2.3 Fights, encounters.md
//  §4.6-4.10; stream W4b). Pure: tuning tables and fight geometry, no imports, so the sim (boss/bossfights.ts,
//  boss/update.ts), the render and the unit tests all read one set of numbers.
//  long4 only: every table here is read behind the long4 gate (bossfights.ts g3()); `short` keeps today's fights (§5.3).
//  Tags: [ENC x] encounters.md section, [C n] the spec's conflicts table, [FIT] fitted by the named probe before merge.
//  Gates: B3 (boss-probe bullets max <= 24, p90 <= 14.4), K1 (boss-probe --spots: every phase >= 2 hits on every spot),
//  K2 (denial share), K3 (boss-probe TTK), K4 (boss-probe --timeout).
// =====================================================================

/** boss volleys: the Normal stage-boss cap (the live cap is rank.ts bulletCap by tier and context) and the volley-atomic
 *  retry [§2.1 "retries after min(remaining, 20 f)"] */
export const VOLLEY = {
  cap: 24, //    stage boss / Drive, Normal [C4]; Easy 18, Hard/VH 30 come from rank.ts bulletCap
  retry: 20, //  a volley that does not fit waits this long (or its own interval, if shorter) and tries again
  floor: 18, //  no fight interval below 18 f after the rank factor [C2]
};

/** the rank rule for every fight interval [C2]: I x (1.25 - .6 rho), floored at 18 f. m = cadMul */
export const ivOf = (n: number, m: number): number => Math.max(VOLLEY.floor, Math.round(n * m));

/** fight variants unlock at rank >= 14 [C3] */
export const VARIANT_RANK = 14;

/** K3 (W6 tune-tf, DIFFICULTY-SPEC §2.3 TTK column): the stage bosses' HP on top of depth.ts depthHP, whose stage-order
 *  weight (economy.ts bossOrdW) the economy stream owns: this table is the fights' own factor until that refit lands, then
 *  it folds in there. Applied once, on the fight's first frame (bossfights.ts hpOnce), to the body and any parts it was
 *  spawned with (the Bloat's bars). Measured by boss-probe (stage bosses, the BIOME B kit, 15-22 s) and midboss-probe
 *  (the Open Orbit Maw, the STAGE 1 kit, 8-11 s), Normal and Hard [FIT] */
export const BOSS_HPK: Readonly<Record<string, number>> = {
  maw0: 1.5, //  the Open Orbit Maw: 7.2 s at the STAGE 1 kit (8-11) at x1; its bite now lunges into the ship's own lane (MAW.past), where
  //             the ship's fire tears into it: 1.32 ran 9.0 s before that, 7.7 s after
  maw: 4, //    a biome stage-boss Maw [FIT]: 6.5 s (Hard 6.2) at the BIOME B kit at x1. Matt's decision 8 (2026-11-23) asked ~x2.5
  //             for 15+ s with the 28 s escape clock KEPT (a weakly armed ship watches it escape); x2.7 measured only 11.0 s (its
  //             bite brings it into the bot's options, so TTK grows slower than HP), so his target needs x4 (16.1-16.2 s)
  crux: 1.8, //  THE BLOAT: 10.5 s (Hard 10.8) at the BIOME B kit at x1; 1.6 ran 15.1, 1.7 15.4-19.0 across runs (its icicles roll), 1.75 15.5 (Hard 18.5-18.8), 1.85 20.3 (Hard 21.9), 1.8 21.1 (Hard 19.0): the Bloat's TTK swings +-2 s run to run
  butcher: 1.1, // THE BURNING BUTCHER: 14.3 s at the BIOME B kit at x1 once its first half hooks a far ship (BUTCHER.farHook)
};

/** the biome bosses' timed halves (Taisei-style clocks, docs/pacing.md 3.6): 1500 -> 1200 f per half, 40 s max, the top
 *  of Gradius's 15-40 s [ENC 4.7, C23 reasoning]. Gate K4 */
export const PHASE_F = 1200;

// ---------------- THE MAW: THE BITE [ENC 4.6] ----------------
export const MAW = {
  jaw: 130, //          jaw cycle (f), x cadMul (floor 18)
  fanAt: 100, //        the cycle frame the fan leaves (the throat's retch tell runs 78-100, render/gross/maw.ts)
  fanN: 5, //           7 -> 5 globs (peak per 120 f 9 -> 7) [ENC 4.6 bullets]
  fanSpread: .16,
  fanV: 1.6, //         + .1 per step out from the centre, as today
  orbEvery: 90, //      55 -> 90, half-led (spec §2.3 table: "led orb every 90"). W6: 140 lifted the bite only to 16-21% of the spot hits and cost K1
  orbV: 2,
  orbFirst: 8, //       the first orb 8 f after it is in (an Orbit Maw at the END D1 kit lasts ~4 s on W0: K1 wants 2 per spot per half)
  biteFirst: 1, //      the jaw-cycle count it starts on, so the first bite comes on the first cycle (jn 2) [FIT K1 W6: at 0 it came on the
  //                    second, and an Orbit Maw at the STAGE 1 kit was past half by then]
  biteEvery: [2, 1] as const, // a bite every 2nd jaw cycle, every cycle below half HP [FIT K2 W6: at 3 / 2 the bite was 3-9% of the spot hits, >= 35]
  tell: 46, //          the bite's tell (>= 44, D59): the eyes flare, a lane line runs along its y
  lock: 16, //          ... and the lane locks for the last 16 f. Before that it steers toward the ship's height (<= 1.5 px/f), the
  //                    Drive reach's track-then-lock grammar: a lane fixed at the Maw's own bob height is one a parked ship rarely sits in
  steer: 1.5, //        px/f the lane may drift toward the ship while it tracks
  lungeV: 6, //         px/f down the lane
  lungeX: .35, //       to x = W * .35 at most; W6 (K1/K2): on to `past` px beyond the ship's x when its lane locks (never left of
  //                    W * lungeMin), so the bite reaches a ship anywhere in its lane (at W * .35 every spot left of ~140 was out of
  //                    reach). The escape is the same: out of the lane, which the 46 f tell shows and the last 16 f lock
  past: 16, lungeMin: .06,
  hold: 20, //          snapping at the far end
  backV: 5, //          px/f home [W6: 3; the longer lunge comes home in the same time]
  blend: 30, //         f to fade back into its bob after the bite
  quiet: 200, //        no bite starts this close to its leave clock (the time-out stays at 1700 f, K4)
  // rank >= 14, stage-boss Maw only: the return runs down a second lane, re-aimed at the ship during the hold, which
  // grows to `hold` so the second line shows its full >= 44 f
  var: { hold: 44, lock: 16, backV: 4.5 },
};

/** where a lunge stands at frame `f` after the tell: x from x0 to `stop` (default W * lungeX) at lungeV, then held. Pure */
export const lungeX = (x0: number, W: number, f: number, stop = W * MAW.lungeX): number => Math.max(stop, x0 - MAW.lungeV * f);
/** where the bite stops for a ship at px when its lane locks: past it, inside W * lungeMin .. W * lungeX. Pure */
export const lungeStop = (px: number, W: number): number => Math.max(W * MAW.lungeMin, Math.min(W * MAW.lungeX, px - MAW.past));

/** the bite lane drifts toward the ship's height while it tracks, at most MAW.steer px a frame. Pure */
export const steerLane = (lane: number, py: number): number => lane + Math.max(-MAW.steer, Math.min(MAW.steer, py - lane));

// ---------------- THE BLOAT: NAIL COMB, ICICLE CURTAIN [ENC 4.7] ----------------
export const BLOAT = {
  start: 140, //        it holds fire through its entrance, as today
  comb: {
    every: 100, //      a nail comb every 100 f x cadMul while any bar stands [FIT B3: ENC's 90 with 4 spikes a lane measured p90 18
    //                  > 14.4 at the END D1 kit; the cadence is the denial, so the stream is cut to 3 spikes instead]
    tell: 44, //        the outer nails glow first: ENC's 30 raised to the >= 44 f every new move gets (C10, D59)
    n: 3, //            spikes per lane (ENC 4) [FIT B3]
    nVar: 2, //         ...and 2 a lane when it combs four lanes, so a variant comb is 8 spikes, not 12 [FIT B3: BIOME B kit p90 17]
    gap: 10, //         px between them (an emission every gap / speed frames)
    v: 2.4, //          straight left, unaimed: the player reads the body's bob, not bullets
    lanes: [-34, 34] as readonly number[], //               lane y offsets from the core
    lanesVar: [-46, -20, 20, 46] as readonly number[], //   rank >= 14, every other comb: four lanes, the core's level open
    x: -46, //          the emitters' x from the core (the outer nail tips)
  },
  aim: { every: 260, every2: 120, n: 3, spread: .17, v: 2 }, // every 260 (was 180) while the bars stand: the comb is the denial [FIT K2 W6: the fan took 63% of the spot hits at 180]; every2: core bared [FIT K1 W6: at 180 a second half at the END D1 kit held 1 hit on some spots] //  [FIT B3: v 1.7 lingered] // the aimed 3-fan of spikes for the ship parked outside the sweep [FIT B3: 150]
  ring: { every: 240, n: 9, v: 2 }, //            phase 2: one 9-ring (was two at 1.15 every 160) [FIT B3: 160/1.15 lingered 2-3 rings,
  //                                              p90 17; 200/1.5 still p90 15 > 14.4]
  glob: { every: 120, n: 3, v: 1.6 }, //          phase 2: 3 globs over the neck (was 5) [FIT B3: exposed p90 16]
  ice: { every: 150, dx: 60, first: 40 }, //      phase 2: three icicles, the ship's column and +-60 px (gaps ~45 px between)
};
/** the comb's emission spacing (f) at bullet-speed factor bs: n spikes `gap` px apart */
export const combStep = (bs: number): number => Math.max(2, Math.round(BLOAT.comb.gap / (BLOAT.comb.v * Math.max(.1, bs))));
/** the icicle curtain's columns around column c (the ship's), dropping any outside [lo, hi] */
export const curtainXs = (c: number, lo: number, hi: number): number[] =>
  [c - BLOAT.ice.dx, c, c + BLOAT.ice.dx].filter((x) => x >= lo && x <= hi);

// ---------------- THE BURNING BUTCHER: MEAT HOOKS [ENC 4.8] ----------------
export const BUTCHER = {
  idle: [100, 100] as const, // the opening wait (first half), as today's spawn cool
  open: 110, //   long4: its first attack from e.t 110 (was 160; it is on screen from ~e.t 30) [FIT K1]
  cutCool: [80, 50] as const, //  after the cleaver, first / second half, x cadMul
  hookCool: [60, 45] as const, // after the hook [FIT K1: 70 left a first-half spot at 1 hit]
  spitCool: [60, 50] as const, // after the spit [FIT K1: 80]
  spitAt: 18, //   the spit leaves once (was twice, wt 10 and 26) [ENC 4.8 bullets 26-38 -> 7-12]
  spitN: [5, 7] as const,
  spitVy: .2, //   [FIT K1 W6: .8 arced ~100 f to a mid-height ship, half a first half] long4 lobs each glob through the ship's height +-22 px a step (enemies/update.ts lob), so a far ship is reached
  spitEnd: 40,
  farHook: true, // W6 tune-tf (K2, the hook >= 40% of the spot hits): a far ship is hooked twice to each spit, not only spat at (a far mid-height ship is past what a glob reaches under V_CAP and the arena's ceiling)
  reach1: 440, //  ...so the first half's hook reaches across the field (KH.reach1 230 stays on short) [FIT K1/K2 boss-probe --spots]
  past1: 60, //    ...out to 60 px past the ship (never under KH.reach1), and home at back1 px/f (KH.back1 5), so the throw is quick
  back1: 9, //     enough that a first half at the END D1 kit holds two attacks on every spot (K1)
  spitFar: 150, // first half, long4: a ship further than this from the hook's root is spat at, not hooked [FIT K1: 230 left a spot at 1 hit]
  meat: {
    xs: [200, 290, 380] as readonly number[], // three pendulums across the lanes
    lenK: [.42, .6, .42] as readonly number[], // chain length as a share of the room under the ceiling there: the middle hangs lowest
    lenMax: 120,
    ph: [0, 2.1, 4.2] as readonly number[], //   swing phases (no R(): fixed offsets)
    sw: 1.5, //     the hook kind's swing (enemies/update.ts 'hook': amplitude .55 sw rad, so +-.83 rad) [FIT K2: 1 swung +-.55]
    tell: 50, //    the chains rattle at the ceiling for 50 f first (>= 44)
    lock: 16, //    ...the drop line goes solid for its last 16 f (render)
    drop: 20, //    then the hooks pay out over 20 f
    life: 360, //   swinging
    reel: 30, //    then they are hauled up over 30 f
    every: 600, //  a new set every 600 f x cadMul from the tell, through the second half
  },
  // rank >= 14: the planted chain is reeled in sweeping its arc toward the boss (KEEPSAKE's tug grammar); the 22 f
  // shudder becomes 44 f, its tell
  reelVar: { warn: 44, sweep: 30, arc: .6 },
};

// ---------------- THE GRAVITY DRIVE [ENC 4.10, C22, C23] ----------------
export const DRIVE = {
  hp: 880, //       core HP [FIT: boss-probe --kind drive, END D1 kit 30-40 s]: start 700 ([DER] ENC 560 x 1.24 at R .8, C22);
  //                740 gave 30.8 s pre-W0 and 28.5 s on w0-foundation (powHP 0, rank-based fire), so 740 x 34 / 28.5
  plateHp: 90, //   each of the 3 plates [FIT with hp, K1]: 48 and 64 left phase 0 (THE REACH) 2-4 s at the END D1 kit
  ring0: { every: 100, n: 5, arc: 1.6, v: 1.5 }, //     phase 0: a 5-pellet forward ring (was 8 around, every 80)
  fan0: { every: 120, n: 3, spread: .18, v: 1.5, first: 12 }, // [FIT K1: 170 left a spot at 1 hit] // phase 0: an aimed 3-orb fan (was 5 globs, which fall short of a
  //                                                    far ship), the first 30 f in: plates fall fast, and K1 wants 2 per spot
  fan1: { every: 70, n: 3, spread: .22, v: 1.9 }, //    phases 1-2: an aimed 3-fan (was every 50), never while a beam charges
  spike: { every: 95, v: 2.4 }, //                      phase 2: the half-led spike
  corpse: 250, //                                       phases 1-2: a thrown corpse (a body)
  reach: {
    tell: 46, //    the coil: the tip glows; a dashed line to the target locks for the last `lock` frames
    lock: 16,
    coil: 80, //    the coiled length the tell pulls back to
    ext: 10, //     f to shoot out to `len`
    hold: 20, //    f held out (ext + hold = 30 f out)
    back: 30, //    f to retract
    len: 190, //    px, the reach
    cyc0: 220, //   phase 0: each tentacle every 220 f x cadMul, the two 110 apart
    alt0: 110,
    cyc1: 180, //   phase 1: both every 180 f, alternating
    overlap: 40, // rank >= 14, phase 0: the second limb starts 40 f before the first ends (a two-limb sweep)
  },
  beam: {
    every1: 220, // phase 1 single beam (was 250), x cadMul
    every2: 200, // phase 2 twin beam
    tel: 75, //    charge; it tracks, then locks the last `lock` frames (the Big Core rule, unchanged)
    lock: 20,
    live: 40,
    half: 6, //    the beam's half-width (perp distance that hits)
    off: 70, //    the twin beam's second line: 70 px to the side with room, at the ship's distance
    gap: 50, //    the guaranteed free lane between the twin beams, at the ship's distance and beyond [unit test]
  },
  pincer: { gap: 60, start: 64, len: 300 }, // after the twin beam both limbs close on its lane, tips >= 60 px apart [unit test];
  //   ENC sets no pincer length: 300 px reaches the lane across most of the field (K2: 190 left the far lanes to bullets)
  collapse: 45 * 60, // 45 s of fight: THE WELL COLLAPSES, plates fall, the core is bared [C23]
  destruct: 60 * 60, // 60 s: it self-destructs: no 30000 bonus, stage grade capped at C, the descent still ends [C23]
  grade: 'C',
};

/** a tentacle's base (boss/update.ts tentPts): the hub's flank, 30 px above (side -1) or below (side 1) */
export const tentBase = (bx: number, by: number, side: number) => ({ x: bx - 12, y: by + side * 30 });

/** the reach's length and its blend toward the aim (0 the idle sway, 1 the straight reach) at state st, frame f.
 *  st 1 the tell (coil), 2 out, 3 back. Pure: tentPts, the probes and the render read it */
export function reachPose(st: number, f: number, sway: number, max: number = DRIVE.reach.len): { len: number; k: number } {
  const R = DRIVE.reach, L = Math.max(R.coil, max);
  if (st === 1) { const u = Math.min(1, f / R.tell); return { len: sway + (R.coil - sway) * u, k: u }; }
  if (st === 2) { const u = Math.min(1, f / R.ext); return { len: R.coil + (L - R.coil) * u, k: 1 }; }
  if (st === 3) { const u = Math.min(1, f / R.back); return { len: L + (sway - L) * u, k: 1 - u }; }
  return { len: sway, k: 0 };
}

/** the one non-table export: biomes.ts (W3) registers its boss hazard drop here at load, `HAZ_HOOK.drop = dropHazard`,
 *  so the Bloat's curtain can drop icicles without the sim importing the biome module (and its DOM) */
export const HAZ_HOOK: { drop: ((k: string, x: number) => void) | null } = { drop: null };

/** the free lane between two beams from (ex, ey) at angles a1, a2, at distance r (two lines from one eye: the lane
 *  narrows toward the eye, so twinAngle guarantees DRIVE.beam.gap at the ship's distance at lock and beyond): the perpendicular gap minus both
 *  beams' half-widths and the ship's core (2.6 each side) */
export function twinGap(a1: number, a2: number, r: number): number {
  const d = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
  return 2 * r * Math.sin(d / 2) - 2 * DRIVE.beam.half - 2 * 2.6;
}

/** the twin beam's second aim point: the ship moved DRIVE.beam.off px perpendicular to the first beam, to the side that
 *  stays inside the playfield (the side toward the middle when both fit). Returns its angle from the eye */
export function twinAngle(ex: number, ey: number, px: number, py: number, PH: number): number {
  const a1 = Math.atan2(py - ey, px - ex), nx = -Math.sin(a1), ny = Math.cos(a1), off = DRIVE.beam.off;
  const fits = (s: number) => { const y = py + s * ny * off; return y > 12 && y < PH - 12; };
  const toMid = (py + ny * off - PH / 2) ** 2 <= (py - ny * off - PH / 2) ** 2 ? 1 : -1;
  const s = fits(toMid) ? toMid : fits(-toMid) ? -toMid : toMid;
  // the lane is guaranteed at the ship's distance: widen the angle until the free gap there is >= DRIVE.beam.gap
  const r = Math.hypot(px - ex, py - ey);
  const a2 = Math.atan2(py + s * ny * off - ey, px + s * nx * off - ex), d = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
  const need = 2 * Math.asin(Math.min(1, (DRIVE.beam.gap + 2 * DRIVE.beam.half + 5.2) / (2 * Math.max(1, r))));
  return Math.abs(d) >= need ? a2 : a1 + (d < 0 ? -need : need);
}

/** the pincer's two tip targets around the lane's centre (cx, cy) on a lane at angle am: the upper limb (side -1) above,
 *  the lower below, spread until the two tips, each at most DRIVE.pincer.len from its base, end >= DRIVE.pincer.gap apart.
 *  Returns [[x, y] upper, [x, y] lower] */
export function pincerTargets(bx: number, by: number, cx: number, cy: number, am: number): [number, number][] {
  let nx = -Math.sin(am), ny = Math.cos(am);
  if (ny < 0) { nx = -nx; ny = -ny; } // n points down: the upper limb takes -n
  const up = tentBase(bx, by, -1), dn = tentBase(bx, by, 1), L = DRIVE.pincer.len;
  const tip = (b: { x: number; y: number }, tx: number, ty: number) => { const d = Math.hypot(tx - b.x, ty - b.y) || 1, l = Math.min(L, d); return [b.x + (tx - b.x) / d * l, b.y + (ty - b.y) / d * l]; };
  let g = DRIVE.pincer.start;
  for (let i = 0; i < 40; i++, g += 6) {
    const T = [[cx - nx * g / 2, cy - ny * g / 2], [cx + nx * g / 2, cy + ny * g / 2]] as [number, number][];
    const a = tip(up, T[0][0], T[0][1]), b = tip(dn, T[1][0], T[1][1]);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= DRIVE.pincer.gap + 2) return T;
  }
  return [[cx, cy - 200], [cx, cy + 200]];
}

/** the Drive's fight clock: 0 fighting, 1 collapsed (plates gone, core bared), 2 self-destruct [C23] */
export const driveClock = (ft: number): 0 | 1 | 2 => (ft >= DRIVE.destruct ? 2 : ft >= DRIVE.collapse ? 1 : 0);
