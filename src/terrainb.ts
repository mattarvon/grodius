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
export const MOVE_HAZ: Readonly<Record<string, readonly [number, number]>> = { ice: [.7, .85], acid: [1, 1], fire: [1, .6], snot: [1, 1] };
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
