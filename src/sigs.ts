// =====================================================================
//  SIGNATURES AND SPACE (DIFFICULTY-SPEC §2.4, levels.md §1, §2.3, §5). Pure, the NOTICE / DEPTH pattern: it imports
//  only layout.ts (itself import-free), so biomes.ts, the probes (tools/probe-lib.mjs loads it as /src/sigs.ts) and tests/unit/sigs.test.ts all
//  read the same numbers. Every value carries its spec tag and the gate that measures it.
//
//  What lives here:
//    - SPACE: the space rules S1-S8 as numbers (levels.md §1)
//    - INSET / GULLET: the biome resting walls coming in (levels.md §5.0), read by biomes.ts rewriteTerrain
//    - MORGUE / TIDE / GRILL / SWALLOW: the four biome signatures, 3 escalating variations each (levels.md §5.1-5.4)
//    - planSig(): where a stage's three variations go inside its movement-B band (scroll and world x), fitted to
//      the band the D31 stretch leaves (see the note on planSig)
//    - the pure shape functions the runtime (biomes.ts) calls every frame: tide level, throat inset, grill columns,
//      block lanes
//    - HAZ / ICICLE / FURNACE: the biome hazard timers on rank (DIFFICULTY-SPEC §2.1, C29) and the icicle and
//      Furnace fixes (spec §7 peer input from the retired tune1 lane)
//    - sigWindows($): the registered windows [{x0, x1, floor, id, k, cp}] in world x (spec §2.4 "Shared code"): the
//      route-probe / space-probe exception list and the bullet-cap context G.setp. Biome stages register theirs at
//      build (biomes.ts biomeStage, through setSigWindows); Orbit and the Drive register theirs the same way under
//      their own key (W3b). Nothing here draws R(); every runtime value is frame-counter or world-x math
//
//  Gates: L1-L3 (tools/space-probe.mjs), L4 (tools/playtest.mjs), L5 (tools/route-probe.mjs), L6 (pod-probe
//  tally_s), M3 (mortal pilot death sources), P2 (the drifter), plus tests/unit/sigs.test.ts for S3, S4, S5, S6.
// =====================================================================

import * as LY from './layout'; // a pure leaf itself (no imports): the active layout and its fixed rows' windows

/** the playfield height and width (core.ts PH / W) */
export const PH = 254, W = 480;

// ---------------- the space rules (levels.md §1; the names are W0's skeleton contract, scratchpad spec/W0-CONTRACT.md) ----------------
export const SPACE = {
  /** S1: the swept fit gap outside every signature window (route-probe's existing gate), over a fitBox px footprint */
  fitGap: 100,
  fitBox: 21,
  /** S1: never below this inside a window: the ship's 8 px footprint + 32 px each side */
  fitMin: 72,
  /** S2: the fastest a terrain edge may move, px/f (route-probe's slam trips at 1.5) */
  edgeV: .5,
  /** S3: a forced lane change of dy within L px of scroll: dy / L at most this (60% of naked speed 1.25) */
  weave: .75,
  /** S4: every moving solid, set-piece hazard and new entry has a tell of at least this many frames (D59) */
  tell: 44,
  /** S4: a signature's first variation is on screen this long before it can reach the ship's x */
  sigLead: 120,
  /** S5 / C9: nothing spawns within this of the ship's centre; split children noSpawnKid; a regrowing plug cell regrowMin */
  noSpawn: 48,
  noSpawnKid: 30,
  regrowMin: 24,
  /** S6: a barrier that can close a lane is cut by the naked main gun in <= 1 s: <= 8 bolts (8.57 bolts/s, SYS §2) */
  cutBolts: 8,
  /** S7: Orbit's parallax deck dims to this once the collidable hull arrives (W3b) */
  deckDim: .4,
  /** S8: in every this many px of signature or rush, something reaches the ship from behind, above or below */
  sanctuary: 600,
} as const;
/** Decision 5 (A): moving solids (pistons, lodged blocks, mucus plugs) kill like walls, through WARD */
export const SOLID_KILLS = true;

// ---------------- the resting walls (levels.md §5.0) ----------------
/** px per side each wall moves in, by biome, [slot A, slot B]. biomes.ts rewriteTerrain applies it after movement B and
 *  caps it column by column so the swept fit gap stays >= 108 (levels.md §5.0 put it inside shape() before the clamp;
 *  done literally, the fit fell to 87 beside fire's spires, under S1).
 *  Sized from the audit's measured median free height to the slot targets (A <= 65%, B <= 56%: space-probe L1).
 *  [FIT] W6 tune: LVL's values (ice 20/32, acid 24/36, fire 18/30, snot 0/8) measured the flown terrain (scroll moving,
 *  outside the boss fight) at A 66-70% / p10 53-63% and B 56-63% / 43-51% (space-probe seed 1, 4 routes): the cap and
 *  the midboss halving eat ~a third of each inset. +12-14 a side */
export const INSET: Readonly<Record<string, readonly [number, number]>> = {
  // [FIT] W6 r4 (L2 flown squeeze A 24.2 s / B 33.7 s, bands 30 / 45): +4 A, +8 B, with biomes.ts oneWall now giving the
  // inset the needle cap took from the other wall and INSET_MID.pad 200 -> 60. Held screens keep INSET_HELD (px)
  ice: [38, 54], //  measured 80-82% -> ~65% / ~56% (LVL); flown 67% / 63% at 20 / 32; W6 34 / 46
  acid: [40, 58], // 82-87%; flown 70% / 62% at 24 / 36; W6 36 / 50
  fire: [36, 52], // 79-81%; flown 66% / 61% at 18 / 30; W6 32 / 44
  snot: [12, 22], // 60-61%; flown 61% / 56% at 0 / 8
};
/** the inset is k x INSET near a midboss fight: k within `pad` px of a breath that holds a midboss (its held screen
 *  runs W px past the breath's end), so the midboss fits and every kind's `bandFit` stay valid. `ramp`: px the k eases
 *  over. Movement C (the boss arena) takes no inset at all: REST and ARENA_GAP are unchanged.
 *  [FIT] k .5 -> .3 with the W6 insets: the held screens keep the inset they were fitted at (~10-12 px a side) */
export const INSET_MID = { k: .3, pad: 60, ramp: 100 };
/** the inset a held midboss's screen keeps, px a side, [slot A, slot B]: W6's k x INSET (k .3 of ice 34/46, acid 36/50,
 *  fire 32/44, snot 12/22), pinned in px (W6 r4) so INSET can move without moving a fight's walls: every midboss fit,
 *  bandFit and its K1/K3 numbers were measured on these. biomes.ts midNear eases INSET to this over INSET_MID.ramp */
export const INSET_HELD: Readonly<Record<string, readonly [number, number]>> = {
  ice: [10.2, 13.8], acid: [10.8, 15], fire: [9.6, 13.2], snot: [3.6, 6.6],
};
export const heldInsetOf = (b: string, s: number) => (INSET_HELD[b] ? INSET_HELD[b][s ? 1 : 0] : 0);
/** the inset at slot s of biome b; 0 for a biome this table does not list */
export const insetOf = (b: string, s: number) => (INSET[b] ? INSET[b][s ? 1 : 0] : 0);

/** slot B only, the GULLET (levels.md §5.0): one 600 px narrow in peak A, gap 108-118 with its centre on a sine of
 *  amplitude 24 and period 600 (max slope 2pi x 24 / 600 = .25, S3 holds). `p`: where it starts in the spawn span
 *  (scroll x), `lead`: world x past that scroll x, so the ship (screen x ~150) meets it at p. ~10 s at FH 43-46% */
// [FIT] W6 r4 p .70 -> .68, len 600 -> 930 (L2 slot B 43.9 s flown, band 45, after the L6 stretch cut took ~3.7 s of
// slot B's scroll): ~15.5 s in the narrow, starting earlier and ending where the 840 px one did (~90 px before the
// ship meets the run-up, P(.94), at the late gate)
// Decision 31 (W6 r4, L3 slot B 3.6-4.3 forced moves/min, band 6): the gullet winds. Its lane, `zig.gap` px, holds at
// PH x .265 and .735 in turn (`w` px each, every `pitch` px) and runs straight between: a shift of 119 px, more than the
// lane, so no y flies two lanes in a row and a ship anywhere in the throat switches lanes ~3-4 times. Steepest .73 (119 over
// the 164 px between holds: S3 .75); swept fit 118 - .73 x 21 = 102.7 (S1 100, outside a window); blend 140 (the walls'
// centre comes ~58 px to a held lane over it: sstep 1.5 x 58 / 160 = .54, with room for the walls' own noise; a blended
// gap, lerp of ~130 and 118, is still squeeze; the lane holds through both blends). p .68 -> .67 and len 930 -> 1000 give
// back slot B squeeze (L2) and four lanes (three switches); it ends ~50 px before the ship meets the run-up INVARIANT (game-designer review): it is fair only while lanes[1] - lanes[0]
// > zig.gap / PH (no shared band), the steepest slope <= .75 (S3, the naked climb) and 118 - slope x 21 >= 100 (S1);
// terrainb.test pins all three, the blends included. gap / amp / period: the W6 sine's, legacy (unread; sigs.test pins gap)
export const GULLET = { p: .67, len: 1000, gap: [108, 118] as const, amp: 24, period: 600, blend: 160, lead: 150, zig: { gap: 118, lanes: [.265, .735] as const, pitch: 200, w: 36 } };

/** the LANE WEAVE (W6 tune, L3): the biome corridor's centre steps between two lanes, both walls together (the gap,
 *  so free height and L1, is untouched). Measured before it: 1.2-4.2 forced moves/min (L3 A >= 8, B >= 12): the walls
 *  only breathed (shape()'s noise, the inset), so a ship holding a mid lane was never made to move. The profile, period
 *  2 (hold + ramp): `hold` px on one lane, then a smoothstep shift of 2 amp over `ramp` px to the other; its steepest
 *  slope is 1.5 x 2 amp / ramp (A .55, B .55: S3 .75 with the walls' own noise on top). The shift sits in the ship's
 *  90 f look-ahead for ~ramp px, so a ship within ~2 amp of the wall coming toward it has to move. Phase from the
 *  stage's terrain offset (no RNG: a resume rebuilds it). biomes.ts weave() fades it out (`fade` px) over every
 *  signature window (their fit floors are fitted to the un-woven walls), the GULLET (its own weave), a held midboss's
 *  screen (bandFit) and the arena run-up (movement C), and scales it down wherever the un-woven swept fit has no room
 *  for its sweep loss (route-probe S1 >= 100). space-probe L3, route-probe L5 */
export const WEAVE = {
  /** [slot A, slot B]: amp px (half the lane shift), ramp px, hold px. Slot B steps further and more often (L3 12/min) */
  // [FIT] W6 r4 (L3 flown A 3.1 / B 4.1, bands 4 / 6; A 4.65 / B 4.45 after the r4 insets): the narrower corridor
  // (~115-130 px) leaves a ship in the middle ~53-61 px either side, and a .55 weave moves a lane ~41 px inside the 90 f
  // look-ahead. A holds 80 -> 60 (a step more often); B 28 / 130 / 30 moves ~48 px there and steps every 160 px:
  // steepest 1.5 x 56 / 130 = .646 (S3 .75: the walls' own noise keeps ~.1; their needles are obstacles, not a lane)
  slot: [{ amp: 22, ramp: 120, hold: 60 }, { amp: 28, ramp: 130, hold: 30 }] as const,
  /** px the weave fades over at a window, the gullet, a midboss screen or the run-up */
  fade: 100,
  /** the swept fit the weave keeps (the inset's own guard is 108): the weave scales to (fit - keep) / its sweep loss,
   *  and that scale moves at most `ease` a px (lowered only), so a fade adds no cliff */
  keep: 106, ease: 1 / 160,
};
/** the STAGGERED SPURS (W6 tune, L3 / L1 / L2): every `pitch` px of the flown corridor (the weave's mask: never in a
 *  signature window, the gullet, a held midboss's screen or the run-up) a spur grows off one wall, the next off the
 *  other. Its tip stops `gap` px short of the opposite wall (swept over its width + 12 px: S1 >= 100 by construction)
 *  and at most `depth` px out, eased across `w` px (sin^pow). The weave alone measured A 1.0-2.8 / B 1.3-4.2 forced
 *  moves/min: a weave S3 allows shifts a lane ~50 px inside the 90 f look-ahead, under half a 150-165 px corridor, so a
 *  ship near the middle never had to move. A spur closes the wall-side ~50 px of the corridor for its width, and the
 *  weave carries the open middle band across the held lanes. They are obstacles seen ~300 px ahead (the hull blocks'
 *  S3 standing), and the lane through a pair needs no climb: each spur leaves the middle open. biomes.ts biome art
 *  draws them as wall (the biome's own fill). space-probe L3, route-probe L5 */
export const SPUR = {
  /** [slot A, slot B]: w px, gap px to the far wall, depth px at most, pow (the flank). The pitch is half the weave's
   *  period (A 200, B 180 px): each spur sits on a weave hold (weaveHold) */
  slot: [{ w: 56, gap: 108, depth: 80, pow: .7 }, { w: 52, gap: 108, depth: 84, pow: .7 }] as const,
  /** px after the gate's blend over which a spur grows from half to full depth (the opener is gentler) */
  ramp: 900,
};
/** the weave's lane offset (px, + down) at world x for slot s, terrain offset o, before any fade (pure) */
export const weaveAt = (x: number, o: number, s: number) => laneWeave(x, hash01(o), WEAVE.slot[s ? 1 : 0]);
/** a lane-weave profile at world x (phase 0..1 of its period; V: amp, ramp, hold as in WEAVE.slot), px, + down. The
 *  biome stages read it through weaveAt, world.ts's Orbit breach and Drive bands (layout terrain.weave) directly */
export function laneWeave(x: number, phase: number, V: { amp: number; ramp: number; hold: number }) {
  const P = 2 * (V.hold + V.ramp);
  let t = (x + phase * P) % P; if (t < 0) t += P;
  if (t < V.hold) return V.amp;
  t -= V.hold;
  if (t < V.ramp) return V.amp * (1 - 2 * sstep(0, V.ramp, t));
  t -= V.ramp;
  if (t < V.hold) return -V.amp;
  return -V.amp * (1 - 2 * sstep(0, V.ramp, t - V.hold));
}
/** where the weave's +amp holds sit for slot s, terrain offset o: the first one's centre (world x, mod P) and the period
 *  P; the -amp hold's centre is half a period on (the spurs lock to them) */
export const weaveHold = (o: number, s: number) => { const V = WEAVE.slot[s ? 1 : 0], P = 2 * (V.hold + V.ramp); return { x: ((V.hold / 2 - hash01(o) * P) % P + P) % P, P }; };
/** the most the weave moves across the swept fit's 21 px footprint, slot s (its steepest slope x fitBox) */
export const weaveLoss = (s: number) => laneLoss(WEAVE.slot[s ? 1 : 0]);
/** a lane-weave profile's sweep loss (px): its steepest slope (1.5 x 2 amp / ramp) across the fit's 21 px footprint */
export const laneLoss = (V: { amp: number; ramp: number }) => 2 * V.amp * 1.5 * SPACE.fitBox / V.ramp;
/** a 0..1 hash of a number (core.ts hash's arithmetic shape; sigs.ts stays a leaf) */
const hash01 = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------- the signatures (levels.md §5.1-5.4; no bullets added) ----------------
/** nominal screen x of the ship when a plan places world windows (the dodging pilot and Matt sit at ~120-180) */
export const SHIP_X = 150;

/** ICE, MORGUE RUSH (Gradius III stage 9's cube rush): frozen crewmen in blocks of ice come down the ship's lane,
 *  turn to the nearer wall and lodge there, stacking. Flying, a block is a body hit (WARD takes it); lodged, it is
 *  terrain (Decision 5: kills through WARD). A lodge that would leave the fit gap under the window floor shatters */
export const MORGUE = {
  w: 22, h: 14, //   the block (levels.md §5.1)
  hp: 2, //          2 bolts (S6: one block is the whole barrier, 2 <= 8)
  tell: 50, //       frames of frost streak along the lane over the right 120 px before it enters (S4 >= 44)
  streak: 120, //    the streak's length, px from the right edge
  vx: 2.2, //        px/f it flies left along the lane (screen)
  vLodge: 2.5, //    px/f it turns to the wall at
  enter: 12, //      it enters at x W + this
  stopLead: 120, //  it turns at xStop = max(ship x at the tell + stopLead, stopMin)
  stopMin: 220,
  wallPad: 12, //    its lane is clamped this far inside the walls at the right edge
  alt: 50, //        v2: lanes alternate ship y and ship y +-alt
  /** [n blocks, frames between releases] per variation. Slot B: n x slotB, rounded (5 / 8 / 10) */
  vars: [{ n: 4, every: 75 }, { n: 6, every: 55, alt: true }, { n: 8, every: 45, cross: true }] as const,
  slotB: 1.25,
  /** the window fit floor, [slot A, slot B]: slot B registers below the 100 rule (levels.md §5.1) */
  floor: [100, 88] as const,
  /** frames from a variation's last release until its block has lodged (tell 50 + flight ~124 + lodge ~31) */
  tail: 205,
  /** frames the next variation's first tell may start before the previous one's tail is done */
  overlap: 60,
};
/** the lane a block of variation v (0-based) aims at: the ship's y at its tell, v2 alternating +-alt (pure) */
export function morgueLane(v: number, i: number, shipY: number) {
  if (!MORGUE.vars[v] || !('alt' in MORGUE.vars[v]) || i % 2 === 0) return shipY;
  return shipY + (((i >> 1) & 1) ? -MORGUE.alt : MORGUE.alt);
}

/** ACID, HIGH TIDE (Gradius III stage 3, as a moving floor): the acid lake rises by d toward the ceiling folds,
 *  holds, and drains. Every edge moves <= .5 px/f (S2: 40/90 .44, 60/120 .5, 70/140 .5). floor: the window fit floor
 *  [A, B]; the rise is capped so no column drops below it (+ TIDE.pad). w: the world window, px */
export const TIDE = {
  tell: 60, //   frames of the lake boiling hard and the tank rungs flashing, a glug (S4 >= 44)
  ramp: 100, //  px the rise eases in over at each end of the window (70 px over 100: S3 .7)
  pad: 4, //     px kept above the floor's cap, so the swept fit gap holds it
  gap: 40, //    world px between two tides' windows
  vars: [
    { d: 40, rise: 90, hold: 180, drain: 90, w: 400, floor: [110, 100] },
    { d: 60, rise: 120, hold: 240, drain: 120, w: 450, floor: [104, 92], eye: true },
    // v3 adds geysers from the risen surface at the normal hazard interval (D61 aims every 3rd): the timer runs
    // W3a's engine tapers a tide over max(60, 2.5 d) px a side, so a 70 px tide is full only 175 px inside each end and
    // asks ~600 px for v3. The D31 band leaves 406-450 (planSig shrinks to fit): v3 reaches full rise over ~60-100 px
    // of its middle under that engine (this adapter's ramp is TIDE.ramp, 100). Shortfall recorded (W3a request c)
    { d: 70, rise: 140, hold: 240, drain: 140, w: 450, floor: [100, 88], womb: true, geysers: true },
  ] as const,
};
/** the tide's level 0..1 at frame t of variation v (t from its trigger): the tell, then rise, hold, drain (pure) */
export function tideLevel(v: number, t: number) {
  const V = TIDE.vars[v]; if (!V) return 0;
  let u = t - TIDE.tell;
  if (u <= 0) return 0;
  if (u < V.rise) return u / V.rise;
  u -= V.rise;
  if (u < V.hold) return 1;
  u -= V.hold;
  return u < V.drain ? 1 - u / V.drain : 0;
}
/** frames a tide runs from its trigger to drained */
export const tideLen = (v: number) => { const V = TIDE.vars[v]; return TIDE.tell + V.rise + V.hold + V.drain; };

/** FIRE, THE GRILL (Gradius III's laser grid, built from jets): burner columns at a fixed world pitch fire in a comb
 *  from the ceiling or the floor, the reach 55% of the span, so the ship weaves the open side (>= 45%). A column
 *  warms (the jet's own 60 f tell, S4) when it is `lead` px ahead of the ship, and burns until it is `after` px
 *  behind it: the spec's lead (160-200) with the jet's stock 70 f of burn put it out ~50 px ahead of a still ship, so
 *  a grill column burns until it has passed the ship (live = lead - warm + after) */
export const GRILL = {
  warm: 60, lead: 170, after: 40, reach: .55,
  /** world px between two variations' combs */
  gap: 60,
  /** pat: alt = ceiling / floor alternating; pair = two ceiling, two floor. cross: a second jet from the opposite wall
   *  this far behind each column (the crisscross: C F F C C F ...). Weave (S3): 80 / pitch = .62 / .67 / .71 */
  vars: [{ n: 4, pitch: 130, pat: 'alt' }, { n: 6, pitch: 120, pat: 'alt', cross: 60 }, { n: 8, pitch: 112, pat: 'pair', hooks: 2 }] as const,
  slotB: 1.25,
  floor: 100, // the jets are hazards, not terrain: the window floor stays at the S1 rule
};
/** the columns of grill variation v with n columns: [world dx from the comb's start, fires from the ceiling] (pure) */
export function grillCols(v: number, n: number): [number, boolean][] {
  const V = GRILL.vars[v], out: [number, boolean][] = [];
  for (let i = 0; i < n; i++) {
    const up = V.pat === 'pair' ? ((i >> 1) & 1) === 0 : i % 2 === 0;
    out.push([i * V.pitch, up]);
    if ('cross' in V && V.cross) out.push([i * V.pitch + V.cross, !up]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
/** the world length of a grill comb, first column to last */
export const grillLen = (v: number, n: number) => { const c = grillCols(v, n); return c[c.length - 1][0]; };

/** SNOT, THE SWALLOW (Gradius III's Dead End Cell walls, as a living throat): over a world window each wall moves in
 *  by s(t) = S (1 - cos(2 pi t / T)) / 2 (DYN), so the B0 Peristalsis narrows (108 px) clench to 84 / 76 / 72.
 *  Edge speed S pi / T: .16 / .25 / .28 px/f (S2). v2 runs the window's two halves out of phase (eased over `oopW` px
 *  so no column jumps); v3 grows a MUCUS PLUG across each narrow in the window, which has to be shot through */
export const SWALLOW = {
  tell: 44, //  frames of the strands thickening and paling before the first clench (S4)
  ramp: 80, //  px the inset eases in over at each end of the window
  oopW: 80, //  v2: the phase shift eases over this many px around the window's middle
  gap: 60, //   world px between two windows
  vars: [{ S: 12, T: 240, w: 480 }, { S: 16, T: 200, w: 480, oop: true }, { S: 18, T: 200, w: 480, plug: true }] as const,
  floor: 72, // the window fit floor, both slots (the difficulty package's 72 px squeeze, scoped)
  /** the plug: 10 x 10 cells, 1 hp each, grown over `grow` f to close as the narrow reaches its minimum; a ship-sized
   *  hole is `hole` cells (3 bolts, S6). A cut cell regrows `regrow` f later, never within SPACE.regrowMin of the ship */
  plug: { cell: 10, hp: 1, grow: 44, regrow: 150, hole: 3 },
};
/** px each wall moves in at frame t of swallow variation v, at world x of the window [x0, x1] (pure) */
export function throatInset(v: number, t: number, x: number, x0: number, x1: number) {
  const V = SWALLOW.vars[v]; if (!V || x <= x0 || x >= x1 || t <= SWALLOW.tell) return 0;
  const u = t - SWALLOW.tell, m = (x0 + x1) / 2;
  const ph = 'oop' in V && V.oop ? Math.PI * sstep(m - SWALLOW.oopW / 2, m + SWALLOW.oopW / 2, x) : 0;
  // the swing eases in over its first half period, or the out-of-phase half would start fully shut. Edge speed with
  // the ease is at most S (2 + pi) / T: .26 / .41 / .46 px/f (S2)
  return V.S * Math.min(1, 2 * u / V.T) * (1 - Math.cos(2 * Math.PI * u / V.T + ph)) / 2 * envelope(x, x0, x1, SWALLOW.ramp);
}

// ---------------- hazards (DIFFICULTY-SPEC §2.1 rank table, C29; spec §7 peer input) ----------------
/** the biome hazard timers on rank: I_haz x (base - slope x rho), x1.11 at rank 2, x.85 at rank 16 (rank.ts rho).
 *  They pause inside a signature (one threat type at a time at a peak, GR §7), except where a variation says so */
export const HAZ = { base: 1.15, slope: .3 };
/** the hazard interval multiplier at rho (0..1); null (no rank.ts on this build) reads as no change */
export const hazRankMul = (rho: number | null) => (rho == null || !Number.isFinite(rho) ? 1 : HAZ.base - HAZ.slope * Math.max(0, Math.min(1, rho)));
/** icicles on long4: the ship's fire tinks off them. tune1 measured 0 icicle hits in its runs: the ship's own stream
 *  shot every icicle before it landed. `shootable` on a spawn (the Bloat's curtain, W4) opts back in */
export const ICICLE = { immune: true };
/** the Furnace's own jet cadence on long4 (fire's B.hazEvery is 125): tune1 found fire's hits/min over its band from
 *  this, not from aiming. The D61 bands are floors now (C27), so it is fitted against L4's floors and M3 */
export const FURNACE = { every: 140 };

// ---------------- planning: where the three variations go (levels.md §5.0b) ----------------
/** One planned variation, in scroll x (s0: its trigger, s1: done) and world x (x0..x1: its window). n: its count
 *  (blocks or columns), w: its window width (tide, throat) */
export interface SigVar { v: number; s0: number; s1: number; x0: number; x1: number; n: number; floor: number }
/** The stage's signature, or null for a biome without one */
export interface SigPlan { k: string; vars: SigVar[]; fitted: boolean }

/**
 * Place biome b's three variations between scroll x `a` (movement B's band start, where midboss A's breath ends) and
 * `lim` (the next midboss WARNING, or the slot B rest), slot s. Pure.
 *
 * The spec's anchors (band.a + 250, mid band, band.z - 400) and counts were drafted for a longer band than the D31
 * stretch leaves (~1190 f after a + 250 in slot A): the three variations at the spec's cadence need 1300-2100 f. So
 * the plan starts as late as a + 250 when it fits, otherwise earlier (never before a + 30, once midboss A's held
 * screen has gone), and when even that does not fit it shrinks: tide and throat windows to fit (never under 80%,
 * then narrower), grill columns and block counts down while each variation still escalates (>= 3 / 4 / 5). `fitted`
 * reports a shrink. Measured by tools/space-probe.mjs L2 / L3 and recorded in the commit
 */
export function planSig(b: string, s: number, a: number, lim: number): SigPlan | null {
  const B = s ? 1 : 0;
  if (b === 'ice') {
    const ns = MORGUE.vars.map((V) => Math.round(V.n * (B ? MORGUE.slotB : 1)));
    const dur = (n: number[]) => n.reduce((t, k, v) => t + (k - 1) * MORGUE.vars[v].every + MORGUE.tail, 0) - 2 * MORGUE.overlap;
    const fitted = shrinkCounts(ns, (n) => dur(n) + 30 <= lim - a);
    let s0 = a + Math.max(30, Math.min(250, lim - a - dur(ns)));
    const vars: SigVar[] = [];
    ns.forEach((n, v) => {
      const s1 = s0 + (n - 1) * MORGUE.vars[v].every + MORGUE.tail;
      vars.push({ v, s0, s1, x0: s0 + MORGUE.stopMin - 20, x1: s1 + W, n, floor: MORGUE.floor[B] });
      s0 = s1 - MORGUE.overlap;
    });
    return { k: 'morgue_rush', vars, fitted };
  }
  if (b === 'acid') {
    // the ship crosses a window at scroll x0 - SHIP_X .. x1 - SHIP_X; each tide triggers so it has risen by then
    const lead = (v: number) => SHIP_X + TIDE.tell + TIDE.vars[v].rise, ws = TIDE.vars.map((V) => V.w as number);
    let x0 = a + 30 + lead(0);
    const room = lim + SHIP_X - 30 - x0 - 2 * TIDE.gap, need = ws.reduce((t, w) => t + w, 0), f = Math.min(1, room / need);
    const vars: SigVar[] = [];
    ws.forEach((w0, v) => {
      const w = Math.round(w0 * f), s0 = x0 - lead(v);
      vars.push({ v, s0, s1: s0 + tideLen(v), x0, x1: x0 + w, n: 1, floor: TIDE.vars[v].floor[B] });
      x0 += w + TIDE.gap;
    });
    return { k: 'high_tide', vars, fitted: f < 1 };
  }
  if (b === 'fire') {
    const ns = GRILL.vars.map((V) => Math.round(V.n * (B ? GRILL.slotB : 1)));
    // the ship meets the first column at scroll x0 - SHIP_X - lead and leaves the last at its x - SHIP_X + after
    const first = a + 30 + SHIP_X + GRILL.lead, ext = (n: number[]) => n.reduce((t, k, v) => t + grillLen(v, k), 0) + 2 * GRILL.gap;
    const fitted = shrinkCounts(ns, (n) => first + ext(n) - SHIP_X + GRILL.after <= lim);
    // the smallest combs still too long: the gaps between them close up (never under 0)
    const gap = Math.max(0, Math.min(GRILL.gap, GRILL.gap + (lim - (first + ext(ns) - SHIP_X + GRILL.after)) / 2));
    let x0 = first;
    const vars: SigVar[] = [];
    ns.forEach((n, v) => {
      const len = grillLen(v, n);
      vars.push({ v, s0: x0 - SHIP_X - GRILL.lead, s1: x0 + len - SHIP_X + GRILL.after, x0: x0 - 20, x1: x0 + len + 20, n, floor: GRILL.floor });
      x0 += len + gap;
    });
    return { k: 'grill', vars, fitted };
  }
  if (b === 'snot') {
    // a window may sit on midboss A's held screen: it only starts to move once the scroll runs again (its trigger)
    let x0 = a + 30 + SHIP_X + SWALLOW.tell;
    const room = lim + SHIP_X - x0 - 2 * SWALLOW.gap, need = SWALLOW.vars.reduce((t, V) => t + V.w, 0), f = Math.min(1, room / need);
    const vars: SigVar[] = [];
    SWALLOW.vars.forEach((V, v) => {
      const w = Math.round(V.w * f), s0 = Math.max(a + 30, x0 - W);
      vars.push({ v, s0, s1: x0 + w + 20, x0, x1: x0 + w, n: 1, floor: SWALLOW.floor });
      x0 += w + SWALLOW.gap;
    });
    return { k: 'swallow', vars, fitted: f < 1 };
  }
  return null;
}
/** shrink counts ns in place, one at a time from the latest variation that can still give one, keeping each
 *  variation above the one before it and v1 >= 3, until ok(ns). Returns whether it shrank */
function shrinkCounts(ns: number[], ok: (n: number[]) => boolean) {
  let shrank = false;
  for (let guard = 0; guard < 64 && !ok(ns); guard++) {
    let v = ns.length - 1;
    while (v >= 0 && ns[v] - 1 < (v ? ns[v - 1] + 1 : 3)) v--;
    if (v < 0) break;
    ns[v]--; shrank = true;
  }
  return shrank;
}

// ---------------- the registered windows (spec §2.4; route-probe / space-probe exception list, G.setp) ----------------
/** W0 contract: one signature window in world x, x1 exclusive (SigWin below is it plus its kind and checkpoint) */
export interface SigWindow { readonly x0: number; readonly x1: number; readonly floor: number; readonly id: string }
/** W0 contract: the per-stage signature tuning, by signature (the tables above) */
export const SIG: Readonly<Record<string, unknown>> = { morgue_rush: MORGUE, high_tide: TIDE, grill: GRILL, swallow: SWALLOW };
/** a registered signature window, world x, x1 exclusive (W0 contract SigWindow, plus its kind and checkpoint) */
export interface SigWin { x0: number; x1: number; floor: number; id: string; k?: string; cp?: number }
type GSig = { sigW?: Record<string, SigWin[]>; sigV?: number } | null | undefined;
/** register (or replace) the windows of one owner key (a biome slot `b0` / `b1`); the fixed rows' windows (W3b's
 *  CREW KNOTS and THE STROKE) come from layout.ts rowSigWindows, read here */
export function setSigWindows(G: GSig, key: string, ws: SigWin[]) {
  if (!G) return;
  (G.sigW ||= {})[key] = ws;
  G.sigV = (G.sigV || 0) + 1;
}
// the merged, sorted table, rebuilt only when a stage registers (the probes and step.ts call sigWindows every frame:
// no per-call allocation, W0 contract)
let cG: GSig = null, cV = -1, cL: unknown = null, cT: readonly SigWin[] = Object.freeze([]);
let lastG: GSig = null;
/** every signature window this descent, sorted by x0: [{x0, x1, floor, id, k, cp}] in world x. `floor` is the swept
 *  fit floor inside it (S1), `cp` the scroll x just before it a checkpoint may sit at. $ is optional (W0 contract):
 *  without it, the table of the last G seen */
export function sigWindows($?: { G?: GSig } | null): readonly SigWin[] {
  const G = $ === undefined ? lastG : ($ && $.G) || null;
  if (!G) return EMPTY;
  lastG = G;
  const rows = (LY as unknown as { rowSigWindows?: () => SigWin[] }).rowSigWindows, L = LY.layout();
  if (G === cG && (G.sigV || 0) === cV && L === cL) return cT;
  const out: SigWin[] = rows ? rows().slice() : [];
  const S = G.sigW || {};
  for (const k of Object.keys(S)) for (const w of S[k] || []) out.push(w);
  cG = G; cV = G.sigV || 0; cL = L; cT = Object.freeze(out.sort((p, q) => p.x0 - q.x0));
  return cT;
}
const EMPTY: readonly SigWin[] = Object.freeze([]);
/** the window holding world x (x1 exclusive), or null; ws defaults to sigWindows() */
export function sigAt(wx: number, ws: readonly SigWin[] = sigWindows()) { for (const w of ws) if (wx >= w.x0 && wx < w.x1) return w; return null; }
/** the signature checkpoints (spec §2.1 "at every signature start", never inside a window): each variation's cp, in
 *  scroll x, for checkpoint.ts's list (W2 reads them) */
export const sigCheckpoints = ($?: { G?: GSig } | null) => sigWindows($).filter((w) => w.cp != null).map((w) => w.cp as number);

// ---------------- helpers ----------------
/** smoothstep, core.ts sstep's arithmetic */
export function sstep(a: number, b: number, x: number) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
/** 0 outside [x0, x1], easing to 1 over `ramp` px inside each end */
export const envelope = (x: number, x0: number, x1: number, ramp: number) => sstep(x0, x0 + ramp, x) * (1 - sstep(x1 - ramp, x1, x));
