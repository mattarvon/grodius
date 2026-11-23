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
 *  Sized from the audit's measured median free height to the slot targets (A <= 65%, B <= 56%: space-probe L1) */
export const INSET: Readonly<Record<string, readonly [number, number]>> = {
  ice: [20, 32], //  measured 80-82% -> ~65% / ~56%
  acid: [24, 36], // 82-87%
  fire: [18, 30], // 79-81%
  snot: [0, 8], //   60-61%: already tight, slot B only a touch
};
/** the inset is k x INSET near a midboss fight: k .5 within `pad` px of a breath that holds a midboss (its held
 *  screen runs W px past the breath's end), so the midboss fits and every kind's `bandFit` stay valid. `ramp`: px the
 *  k eases over. Movement C (the boss arena) takes no inset at all: REST and ARENA_GAP are unchanged */
export const INSET_MID = { k: .5, pad: 200, ramp: 100 };
/** the inset at slot s of biome b; 0 for a biome this table does not list */
export const insetOf = (b: string, s: number) => (INSET[b] ? INSET[b][s ? 1 : 0] : 0);

/** slot B only, the GULLET (levels.md §5.0): one 600 px narrow in peak A, gap 108-118 with its centre on a sine of
 *  amplitude 24 and period 600 (max slope 2pi x 24 / 600 = .25, S3 holds). `p`: where it starts in the spawn span
 *  (scroll x), `lead`: world x past that scroll x, so the ship (screen x ~150) meets it at p. ~10 s at FH 43-46% */
export const GULLET = { p: .70, len: 600, gap: [108, 118] as const, amp: 24, period: 600, blend: 100, lead: 150 };

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
