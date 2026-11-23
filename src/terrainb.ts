// Terrain movement B, the gimmick (spec §3.3; build plan LS2-mv). One shape per biome and variant: B0 on a first visit,
// B1 on a remix (src/setdraw.ts moveRoll). Each takes movement A's edges at world x and returns the gimmick's edges;
// biomes.ts rewriteTerrain blends them in over the band beatPlan(...).moveB gives.
//
// Static on purpose: a pure function of x and the terrain offset o (hash/vnoise, no RNG, no clock), so a resume rebuilds
// it exactly (spec §3.3, §4). Every return keeps MOVE_GAP, and a lerp of two gaps that hold it can't be narrower.
// Pure apart from MOVES (the bands built this descent): imports core only, so render/moveprops.ts and biomes.ts both read
// it without an import cycle.
import { PH, hash, vnoise } from './core';

/** the gap movement B never drops below (spec §3.3; shape()'s own floor) */
export const MOVE_GAP = 108;
/** the narrowest a collision tip may get (spec §9: a feature under ~3 logical px can't be read on a phone) */
export const TIP_W = 3;

// Every value below is measured by tools/movement-shots.mjs (band gaps, one shot per movement) and pinned by
// tests/unit/terrainb.test.ts (gap, flyability, shape); hazard rates by tools/route-probe.mjs (0 bad, 0 hits).
/** the tuning table */
export const MOVE = {
  /** ice B0 Crevasse: teeth every 36 px (shape()'s are 52: tighter) from a roof at 18 +-10, 26-68 tall before the tip
   *  plateau trims ~13% (shape()'s are 10-40: taller); pow sharpens the flank */
  tooth: { every: 36, min: 26, span: 42, base: 18, wander: 10, pow: 1.6 },
  /** ice B1 Shelf stairs: a step every 120 px (spec), 22 px each, walking up four and down (max climb 88 px over 480 px:
   *  each face is ~17 frames of a naked ship's climb, seen from 300 px out). base: the lowest tread's height off PH */
  stair: { every: 120, rise: 22, walk: [0, 1, 2, 3, 4, 3, 2, 1], base: 30 },
  /** acid B0 Flooded tank: the lake rises 30 px (spec) over a base 18 px off PH, swelling +-12 over ~380 px (wave 60:
   *  the 70 of the first build read flat in the shots), a 1.5 px ripple, foam up to 10 px on the noise crests */
  lake: { rise: 30, swell: 12, wave: 60, base: 18, ripple: 1.5, foam: 10 },
  /** acid B1 Folds: a drape every 110 px, 42-72 deep, off a roof at 16 +-8; pow < 1 rounds the drape's belly */
  fold: { every: 110, min: 42, span: 30, base: 16, wander: 8, pow: .7 },
  /** fire B0 Spire field: a spire every 40 px (shape()'s run ~47 px wide and rarer), 18-90 tall before the tip plateau,
   *  off a floor 24 px up; pow 2.4 makes them needles with a 3 px tip; jitter: the noise on each flank */
  spire: { every: 40, min: 18, span: 72, base: 24, pow: 2.4, jitter: 6 },
  /** fire B1 Chimney: a vent every 150 px. The roof sits at 46 +-10 (low: the band's threat is the jets coming down),
   *  hoods hang 24 px lower for 26 px either side, and the mouth opens up to y 34, below the HUD strip so the grille and
   *  the jet's telegraph read (accessibility review). spawnHazard needs c > 4 to hang a jet there */
  vent: { every: 150, half: 14, mouth: 34, hood: 26, drop: 24, base: 46, wander: 10 },
  /** snot B0 Peristalsis: gap 108-150 (spec), one narrow every 170 px (at x = 85 + 170n), the throat wandering +-14
   *  around mid-screen, +-4 of noise */
  throat: { min: 108, max: 150, every: 170, wander: 14, jitter: 4 },
  /** snot B1 Polyps: a round bulge every 130 px, radius 30-56, off a floor 34 px up (+-6); 15% of the places stay bare */
  polyp: { every: 130, min: 30, span: 26, base: 34, jitter: 6, bare: .15 },
};

/** the hazard spacing multiplier inside each gimmick, [B0, B1] (x the interval: < 1 is more often). Ice B0: the spec's
 *  "icicles every x.7 as often" read as the interval (~1.43x the rate). Ice B1 .85 and fire B1 .6: the stairs and the
 *  chimney were too quiet in the level-design review (the chimney's jets come down its vents: they are the threat) */
// D31 fit (2026-11-08, tools/band-haz-probe.mjs G1, production/qa/evidence/ls2-d31.md): fire B1 .6 read sigma 1.60 at Descent 2 on the
// stretched build, at the 1.6 cap (one descent step of hazard pressure; systems-designer target). .6 x 1.6 / 1.4 = .69,
// so .7 (the game-designer's pre-planned value). Every other cell sat in its band.
export const MOVE_HAZ: Readonly<Record<string, readonly [number, number]>> = { ice: [.7, .85], acid: [1, 1], fire: [1, .7], snot: [1, 1] };
/** the shortest hazard interval inside a band, in frames: the multiplier stacks on the depth term (x 1/(1 + .3 loop)),
 *  and ice B0 at Descent 3 reached ~34 f without it (systems review) */
export const MOVE_HAZ_MIN = 50;

const centre = (ce: number, fl: number): [number, number] => { // shape()'s own rule: both edges give way
  if (fl - ce >= MOVE_GAP) return [ce, fl];
  const m = (fl + ce) / 2;
  return [m - MOVE_GAP / 2, m + MOVE_GAP / 2];
};
/** the floor is the gimmick: the ceiling gives way, so a step or bulge keeps its shape */
const keepFloor = (ce: number, fl: number): [number, number] => [Math.min(ce, fl - MOVE_GAP), fl];
/** the ceiling is the gimmick: the floor gives way */
const keepCeil = (ce: number, fl: number): [number, number] => [ce, Math.max(fl, ce + MOVE_GAP)];
/** position in a repeating cell: its index and 0..1 across it */
const cell = (x: number, every: number) => { const n = Math.floor(x / every); return { n, t: x / every - n }; };
/** a tent 0..1..0 across a cell, flat-topped TIP_W px wide at the peak (cells `every` px wide) */
const peak = (t: number, every: number) => Math.min(1 - Math.abs(2 * t - 1), 1 - TIP_W / every);

/** world x of the fire B1 vent nearest x */
export const ventNear = (x: number) => { const v = MOVE.vent.every; return Math.round((x - v / 2) / v) * v + v / 2; };
/** world x of snot B0's narrow nearest x (its gap is narrowest where the cosine is -1) */
export const narrowNear = (x: number) => { const v = MOVE.throat.every; return Math.round((x - v / 2) / v) * v + v / 2; };

/** the gimmick's [ceiling, floor] at world x. ce, fl: movement A's edges there; o: the stage's terrain offset */
export function gimmick(b: string, mv: number, x: number, o: number, ce: number, fl: number): [number, number] {
  const a = vnoise(x / 200 + o) * 2 - 1, n = vnoise(x / 47 + o + 7) * 2 - 1;
  if (b === 'ice') {
    if (!mv) {
      const T = MOVE.tooth, c = cell(x, T.every);
      return centre(T.base + a * T.wander + peak(c.t, T.every) ** T.pow * (T.min + hash(c.n + o) * T.span), fl);
    }
    const S = MOVE.stair, c = cell(x, S.every), ph = Math.floor(hash(o) * S.walk.length);
    return keepFloor(ce, PH - S.base - S.walk[(c.n + ph) % S.walk.length] * S.rise);
  }
  if (b === 'acid') {
    if (!mv) { const K = MOVE.lake; return centre(ce, PH - K.base - K.rise + Math.sin(x / K.wave + o) * K.swell + Math.sin(x / 9) * K.ripple - Math.max(0, n) * K.foam); }
    const F = MOVE.fold, c = cell(x, F.every);
    return keepCeil(F.base + a * F.wander + Math.sin(Math.PI * c.t) ** F.pow * (F.min + hash(c.n + o) * F.span), fl);
  }
  if (b === 'fire') {
    if (!mv) {
      const S = MOVE.spire, c = cell(x, S.every);
      return centre(ce, PH - S.base - peak(c.t, S.every) ** S.pow * (S.min + hash(c.n + o) * S.span) - Math.abs(n) * S.jitter);
    }
    const V = MOVE.vent, d = Math.abs(x - ventNear(x)), base = V.base + a * V.wander;
    return centre(d < V.half ? V.mouth : d < V.half + V.hood ? base + V.drop * (1 - (d - V.half) / V.hood) : base, fl);
  }
  if (!mv) {
    const T = MOVE.throat, g = (T.min + T.max) / 2 + (T.max - T.min) / 2 * Math.cos(2 * Math.PI * x / T.every), m = PH / 2 + Math.sin(x / 260 + o) * T.wander + n * T.jitter;
    return [m - g / 2, m + g / 2];
  }
  const Y = MOVE.polyp, c = cell(x, Y.every), h = hash(c.n + o), r = Y.min + hash(c.n * 3.1 + o) * Y.span, d = Math.abs(c.t - .5) * Y.every;
  return keepFloor(ce, PH - Y.base - n * Y.jitter - (h < Y.bare || d >= r ? 0 : Math.sqrt(r * r - d * d)));
}

/** hazard spacing multiplier inside the gimmick of biome b, variant mv */
export const moveHazMul = (b: string, mv: number) => (MOVE_HAZ[b] ? MOVE_HAZ[b][mv ? 1 : 0] : 1);

/** one built movement B: its world band {a, z, blend} (beatPlan), biome b, variant mv, terrain offset o */
export type MoveBand = { a: number; z: number; blend: number; b: string; mv: number; o: number };
/** the movement B each built biome slot is flying, by slot. Written by biomes.ts rewriteTerrain, cleared by biomeReset;
 *  hazards (biomes.ts) and the props (render/moveprops.ts) read it */
export const MOVES: (MoveBand | undefined)[] = [];
/** how far movement B m has blended in at world x: 0 outside its band, 1 in its fully blended part (linear in x; the
 *  terrain itself uses sstep, which crosses .5 at the same place) */
export const moveK = (m: MoveBand, wx: number) => Math.max(0, Math.min(1, (wx - m.a) / m.blend, (m.z - wx) / m.blend));
/** the movement B at world x blended in at least `min` (1: its fully blended part), or null */
export function moveAt(wx: number, min = 1): MoveBand | null {
  for (let s = 0; s < MOVES.length; s++) { const m = MOVES[s]; if (m && wx > m.a && wx < m.z && moveK(m, wx) >= min) return m; }
  return null;
}
/** a spawn height y at world x, kept `pad` px inside the walls ce..fl there when a movement B band covers x (blended in
 *  at all): the gimmick moves the walls, and set pieces and hatchlings spawn at heights picked for movement A (systems
 *  review; tools/set-shots.mjs counts what still lands inside). Outside every band (always, on short) it is y */
export function bandClamp(y: number, wx: number, ce: number, fl: number, pad = 16) {
  return moveAt(wx, .001) ? Math.min(Math.max(y, ce + pad), fl - pad) : y;
}
/** a jet hazard at screen x: on the Chimney (fire B1, blended in past half) it snaps to the nearest vent, pulled back
 *  inside the screen when the vent is past its right edge (the telegraph would burn off-screen). vent: whether it did;
 *  a snap that lands outside the half-blended part is not a vent (the caller then rolls its side as everywhere else) */
export function snapVent(x: number, scroll: number, W: number): { x: number; vent: boolean } {
  const m = moveAt(x + scroll, .5);
  if (!m || m.b !== 'fire' || m.mv !== 1) return { x, vent: false };
  let sx = ventNear(x + scroll) - scroll;
  if (sx > W - 20) sx -= MOVE.vent.every;
  return moveAt(sx + scroll, .5) === m ? { x: sx, vent: true } : { x, vent: false };
}
/** the next hazard interval, given the base interval `t` (frames) and the screen's centre world x: x the gimmick's
 *  multiplier inside a fully blended band, never under MOVE_HAZ_MIN there; outside every band, `t` unchanged */
export function hazInterval(t: number, wx: number) {
  const m = moveAt(wx);
  return m ? Math.max(MOVE_HAZ_MIN, t * moveHazMul(m.b, m.mv)) : t;
}

// ---------------- DYN: slowly moving terrain (DIFFICULTY-SPEC §2.4 "Shared code", levels.md §2.2) ----------------
// A world-x window over the CEIL / FLOOR arrays. It saves the window's base copy when armed and, every frame, rewrites
// the window as base + a pure offset of (x, t): FLOOR = base - dF, CEIL = base + dC. Collision, render, hazards, eyeT
// and every floorAt / ceilAt reader then agree with no special case. Pure apart from DYNS (the live windows): it takes
// the arrays as arguments, so it keeps terrainb.ts's core-only import rule. solids.ts stepSolids drives it (one step.ts
// hook) with world.ts's arrays and G.t. Users: Acid HIGH TIDE, Snot THE SWALLOW (W3c arms them from the signature beats).

/** DYN tuning (every value: its rule and the gate that measures it) */
export const DYN = {
  /** a tide holds its fit against the far wall over this many columns a side (6 x 4 px: the swept S1 fit gap reads
   *  [-9, +12] px, so a needle beside a column would otherwise close the swept gap under the window's floor; W6) */
  sweepCols: 6,
  /** S2: no terrain edge moves faster than this, px/f. route-probe `slam` trips at 1.5 (gate L5); dynOff never exceeds it
   *  by construction (speed-capped ramp; cosine inset with S pi / T checked at arm). tests/unit/dyn.test.ts samples it */
  vMax: .5,
  /** S3 weave rule: a window end tapers over at least this run per px of offset, so the taper's slope (smoothstep peak
   *  1.5 x d / edge) stays <= .6 (levels.md S3 sustained slope); never shorter than minEdge */
  edgePerPx: 2.5,
  minEdge: 60,
  /** S4: no set piece moves with less tell than this (D59); arm clamps a shorter one up */
  minTell: 44,
  /** S1: a window's fit floor is never below this (levels.md S1); arm clamps up */
  minFit: 72,
  /** the share of a ramp spent easing in (and out) when the S2 cap leaves room: a trapezoid velocity profile */
  ease: 1 / 3,
  /** split swallow (v2): the cross-fade between the two out-of-phase halves, px (a seam would be a cliff) */
  splitBlend: 80,
};

/** one moving-terrain window. Tide: the floor (side 1) or ceiling (side -1) moves in by d over rise f, holds, moves back
 *  over drain f. Swallow: both walls inset by S (1 - cos(2 pi t / T)) / 2 for dur f (rounded up to whole periods).
 *  tell: frames of tell before anything moves (>= DYN.minTell). fit: the window's column-gap floor. edge: taper px */
export type DynSpec = {
  id: string; kind: 'tide' | 'swallow'; x0: number; x1: number; tell: number; fit: number; edge?: number;
  side?: 1 | -1; d?: number; rise?: number; hold?: number; drain?: number;
  S?: number; T?: number; dur?: number; split?: boolean;
};
/** a live window: its spec (as normDyn clamped it), the column range, the saved base and the arm frame t0 */
export type DynWin = { spec: DynSpec; i0: number; i1: number; bc: Float32Array; bf: Float32Array; t0: number; arr: Float32Array; TS: number;
  /** a tide's fixed far wall over each column's swept neighbourhood (DYN.sweepCols a side): the lowest ceiling a floor tide
   *  can meet (side 1), the highest floor a ceiling tide can (side -1). Built at the arm; absent = per-column fit only */
  ne?: Float32Array };
/** the live windows (solids.ts steps and resets them; render/moveprops.ts reads them through dynAt) */
export const DYNS: DynWin[] = [];

/** distance along a speed-capped ramp: d px in T f with peak speed <= v, eased in and out (trapezoid velocity) where the
 *  cap leaves room. Needs |d| / T <= v (normDyn stretches T so it holds) */
export function ramp(d: number, T: number, v: number, t: number) {
  if (t <= 0 || d === 0) return 0;
  if (t >= T) return d;
  const ta = Math.max(0, Math.min(T * DYN.ease, T - Math.abs(d) / v)), vc = d / (T - ta);
  if (ta <= 0) return vc * t;
  if (t < ta) return vc * t * t / (2 * ta);
  if (t <= T - ta) return vc * (t - ta / 2);
  return d - vc * (T - t) * (T - t) / (2 * ta);
}
const sst = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** the spec as the engine flies it: tell, fit and taper clamped to the space rules, every ramp stretched so no edge beats
 *  DYN.vMax (S2). Pure; armDynWin stores this, so what a probe reads back is what moves */
export function normDyn(s: DynSpec): DynSpec {
  const o: DynSpec = { ...s, tell: Math.max(DYN.minTell, s.tell | 0), fit: Math.max(DYN.minFit, s.fit || 0) };
  const v = DYN.vMax;
  if (o.kind === 'tide') {
    const d = Math.abs(o.d || 0);
    o.side = o.side === -1 ? -1 : 1;
    o.rise = Math.max(o.rise || 0, Math.ceil(d / v));
    o.drain = Math.max(o.drain || 0, Math.ceil(d / v));
    o.hold = Math.max(0, o.hold || 0);
    o.edge = Math.max(o.edge || 0, DYN.minEdge, Math.ceil(d * DYN.edgePerPx));
  } else {
    const S = Math.abs(o.S || 0);
    o.T = Math.max(o.T || 0, Math.ceil(S * Math.PI / v)); // peak inset speed S pi / T <= vMax
    o.dur = Math.ceil(Math.max(o.dur || 0, o.T * (o.split ? 2 : 1)) / o.T) * o.T; // whole periods: it ends relaxed (split: the
    // far half runs half a period late and stops half early, so it needs two to move at all)
    o.edge = Math.max(o.edge || 0, DYN.minEdge, Math.ceil(S * DYN.edgePerPx));
  }
  return o;
}
/** every frame the window lives, tell included */
export const dynLen = (s: DynSpec) => s.tell + (s.kind === 'tide' ? (s.rise || 0) + (s.hold || 0) + (s.drain || 0) : s.dur || 0);
/** 0..1 across the window: 0 at its ends, 1 past the taper */
const taper = (s: DynSpec, x: number) => sst(Math.min(x - s.x0, s.x1 - x) / (s.edge || DYN.minEdge));
/** the cosine inset fraction 0..1 at motion time u, period T */
const pulse = (u: number, T: number) => (1 - Math.cos(2 * Math.PI * u / T)) / 2;

/** the window's pure offset at world x, t frames after arm: [dC, dF]; dC moves the ceiling down, dF the floor up (both
 *  >= 0, into the gap). 0 outside (x0, x1), during the tell and after the end. s: a normDyn'd spec */
export function dynOff(s: DynSpec, x: number, t: number): [number, number] {
  const o: [number, number] = [0, 0];
  offInto(s, x, t, o);
  return o;
}
/** dynOff into o (no allocation: writeWin calls it per column per frame, render/terrain.ts per edge segment) */
export function offInto(s: DynSpec, x: number, t: number, o: number[]) {
  o[0] = o[1] = 0;
  if (x <= s.x0 || x >= s.x1) return;
  const u = t - s.tell;
  if (u <= 0 || u >= dynLen(s) - s.tell) return;
  const w = taper(s, x);
  if (w <= 0) return;
  if (s.kind === 'tide') {
    const d = s.d || 0, r = s.rise || 1, h = s.hold || 0, q = s.drain || 1;
    const p = u < r ? ramp(d, r, DYN.vMax, u) : u < r + h ? d : d - ramp(d, q, DYN.vMax, u - r - h);
    if (s.side === -1) o[0] = p * w; else o[1] = p * w;
    return;
  }
  const T = s.T || 1, S = s.S || 0;
  let f = pulse(u, T);
  if (s.split) { // two halves out of phase, cross-faded over splitBlend px about the window's middle. The far half runs
    // half a period late and stops half a period early, so it too starts and ends relaxed (no jump at either end)
    const m = (s.x0 + s.x1) / 2, b = sst((x - m) / DYN.splitBlend + .5), dur = s.dur || 0;
    f = f * (1 - b) + (u >= T / 2 && u <= dur - T / 2 ? pulse(u - T / 2, T) : 0) * b;
  }
  o[0] = o[1] = S * f * w;
}
const OFF = [0, 0];

/** arm a window on the arrays at frame t. Refuses (null) one that overlaps a live window (two bases over one column
 *  would restore wrong) or covers no column */
export function armDynWin(spec: DynSpec, t: number, CEIL: Float32Array, FLOOR: Float32Array, TS: number): DynWin | null {
  const s = normDyn(spec);
  const i0 = Math.max(0, Math.floor(s.x0 / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil(s.x1 / TS));
  if (i1 <= i0) return null;
  for (const w of DYNS) if (w.arr === FLOOR && i0 <= w.i1 && i1 >= w.i0) return null;
  const win: DynWin = { spec: s, i0, i1, bc: CEIL.slice(i0, i1 + 1), bf: FLOOR.slice(i0, i1 + 1), t0: t, arr: FLOOR, TS };
  if (s.kind === 'tide') { // the far wall does not move under a tide: its swept extreme is fixed for the window's life
    const ne = new Float32Array(i1 - i0 + 1), R = DYN.sweepCols, A = s.side === -1 ? FLOOR : CEIL, n = A.length;
    for (let i = i0; i <= i1; i++) { let v = s.side === -1 ? Infinity : -Infinity; for (let q = Math.max(0, i - R); q <= Math.min(n - 1, i + R); q++) v = s.side === -1 ? Math.min(v, A[q]) : Math.max(v, A[q]); ne[i - i0] = v; }
    win.ne = ne;
  }
  DYNS.push(win);
  return win;
}
/** rewrite one window's columns for frame t. The column gap never drops under the window's fit: it opens about its
 *  middle, shape()'s centre rule (each edge then moves at half the offset's speed, still <= vMax) */
function writeWin(w: DynWin, t: number, CEIL: Float32Array, FLOOR: Float32Array) {
  const s = w.spec, lt = t - w.t0;
  for (let i = w.i0; i <= w.i1; i++) {
    const j = i - w.i0, bc = w.bc[j], bf = w.bf[j];
    offInto(s, i * w.TS, lt, OFF);
    let c = bc + OFF[0], f = bf - OFF[1];
    if (s.kind === 'tide' && w.ne) { // the swept fit against the far wall's neighbourhood, never past the base (W6)
      if (s.side === -1) { const lim = w.ne[j] - s.fit; if (c > lim) c = Math.max(bc, lim); }
      else { const lim = w.ne[j] + s.fit; if (f < lim) f = Math.min(bf, lim); }
    } else if (f - c < s.fit) {
      if (bf - bc < s.fit) { c = bc; f = bf; } // the base itself is under the fit: the window leaves that column alone
      else if (s.kind === 'tide') { if (s.side === -1) c = f - s.fit; else f = c + s.fit; } // a tide stops short: only its own
      // side moves, so the far wall (and the eyes and wombs on it) never shifts
      else { const m = (c + f) / 2; c = m - s.fit / 2; f = m + s.fit / 2; } // both walls clench: open about the middle
    }
    CEIL[i] = c; FLOOR[i] = f;
  }
}
/** step every live window to frame t; a finished one writes its base back and is dropped. A window armed on another
 *  FLOOR array (the terrain was rebuilt) is dropped without writing */
export function stepDynWins(t: number, CEIL: Float32Array, FLOOR: Float32Array) {
  for (let k = DYNS.length - 1; k >= 0; k--) {
    const w = DYNS[k];
    if (w.arr !== FLOOR) { DYNS.splice(k, 1); continue; }
    if (t - w.t0 >= dynLen(w.spec)) {
      CEIL.set(w.bc, w.i0); FLOOR.set(w.bf, w.i0);
      DYNS.splice(k, 1);
      continue;
    }
    writeWin(w, t, CEIL, FLOOR);
  }
}
/** drop every window; given the arrays, write each one's base back first (a reset inside a window) */
export function resetDynWins(CEIL?: Float32Array, FLOOR?: Float32Array) {
  if (CEIL && FLOOR) for (const w of DYNS) if (w.arr === FLOOR) { CEIL.set(w.bc, w.i0); FLOOR.set(w.bf, w.i0); }
  DYNS.length = 0;
}
/** the live window over world x, or null */
export function dynWinAt(wx: number): DynWin | null {
  for (let k = 0; k < DYNS.length; k++) { const w = DYNS[k]; if (wx >= w.spec.x0 && wx <= w.spec.x1) return w; }
  return null;
}
/** the relaxed (base) [ceiling, floor] under a live window at world x (linear between saved columns), else null */
export function dynBase(wx: number): [number, number] | null {
  const w = dynWinAt(wx);
  if (!w) return null;
  const f = wx / w.TS - w.i0, j = Math.max(0, Math.min(w.bc.length - 2, Math.floor(f))), u = Math.max(0, Math.min(1, f - j));
  return [w.bc[j] + (w.bc[j + 1] - w.bc[j]) * u, w.bf[j] + (w.bf[j + 1] - w.bf[j]) * u];
}
/** what the window over world x is doing at frame t (render and probes): tell 0..1 ramps up over the tell, k 0..1 is the
 *  offset's share of its peak there (tide d, swallow S). null outside every window */
export function dynAt(wx: number, t: number): { w: DynWin; t: number; tell: number; k: number } | null {
  const w = dynWinAt(wx);
  if (!w) return null;
  const s = w.spec, lt = t - w.t0, o = dynOff(s, wx, lt), pk = s.kind === 'tide' ? Math.abs(s.d || 0) : Math.abs(s.S || 0);
  return { w, t: lt, tell: lt >= 0 && lt < s.tell ? lt / s.tell : 0, k: pk > 0 ? Math.max(o[0], o[1]) / pk : 0 };
}
