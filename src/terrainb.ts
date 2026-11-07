// Terrain movement B, the gimmick (spec §3.3; build plan LS2-mv). One shape per biome and variant: B0 on a first visit,
// B1 on a remix (src/setdraw.ts moveRoll). Each takes movement A's edges at world x and returns the gimmick's edges;
// biomes.ts rewriteTerrain blends them in over the band beatPlan(...).moveB gives.
//
// Static on purpose: a pure function of x and the terrain offset o (hash/vnoise, no RNG, no clock), so a resume rebuilds
// it exactly (spec §3.3, §4). Every return keeps MOVE_GAP, and a lerp of two gaps that hold it can't be narrower.
import { PH, hash, vnoise } from './core';

/** the gap movement B never drops below (spec §3.3; shape()'s own floor) */
export const MOVE_GAP = 108;

/** the tuning table; each value is measured by tools/movement-shots.mjs and tests/unit/terrainb.test.ts */
export const MOVE = {
  /** ice B0 Crevasse: teeth at 36 px (shape()'s are 52: tighter), 26-62 tall (shape()'s are 10-40: taller) */
  tooth: { every: 36, min: 26, span: 36 },
  /** ice B0: hazard spacing while inside the Crevasse (spec: icicles every x.7) */
  iceHaz: .7,
  /** ice B1 Shelf stairs: a step every 120 px (spec), 20 px each. Up three, down three, so no wall is taller than one
   *  step: a 20 px face is 16 frames of a naked ship's climb, seen from 300 px out */
  stair: { every: 120, rise: 20, walk: [0, 1, 2, 3, 2, 1] },
  /** acid B0 Flooded tank: the lake rises 30 px (spec) and swells +-9 over ~440 px */
  lake: { rise: 30, swell: 9, wave: 70 },
  /** acid B1 Folds: a drape every 110 px, 42-72 deep */
  fold: { every: 110, min: 42, span: 30 },
  /** fire B0 Spire field: a spire every 40 px, up to 80 tall (shape()'s run ~47 px wide and rarer) */
  spire: { every: 40, min: 18, span: 62 },
  /** fire B1 Chimney: a vent every 150 px, its mouth open to y 16 (spawnHazard needs c > 4; the grille has to clear the HUD strip to read), a hood 26 px wide each side */
  vent: { every: 150, half: 14, mouth: 16, hood: 26, drop: 24 },
  /** snot B0 Peristalsis: gap 108-150 (spec), one narrow every 170 px, the throat wandering +-14 */
  throat: { min: 108, max: 150, every: 170, wander: 14 },
  /** snot B1 Polyps: a round bulge every 130 px, radius 30-56; 15% of the places stay bare */
  polyp: { every: 130, min: 30, span: 26, bare: .15 },
};

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
const peak = (t: number) => 1 - Math.abs(2 * t - 1);

/** world x of the fire B1 vent nearest x */
export const ventNear = (x: number) => { const v = MOVE.vent.every; return Math.round((x - v / 2) / v) * v + v / 2; };

/** the gimmick's [ceiling, floor] at world x. ce, fl: movement A's edges there; o: the stage's terrain offset */
export function gimmick(b: string, mv: number, x: number, o: number, ce: number, fl: number): [number, number] {
  const a = vnoise(x / 200 + o) * 2 - 1, n = vnoise(x / 47 + o + 7) * 2 - 1;
  if (b === 'ice') {
    if (!mv) {
      const T = MOVE.tooth, c = cell(x, T.every);
      return centre(18 + a * 10 + peak(c.t) ** 1.6 * (T.min + hash(c.n + o) * T.span), fl);
    }
    const S = MOVE.stair, c = cell(x, S.every), ph = Math.floor(hash(o) * S.walk.length);
    return keepFloor(ce, PH - 30 - S.walk[(c.n + ph) % S.walk.length] * S.rise);
  }
  if (b === 'acid') {
    if (!mv) { const K = MOVE.lake; return centre(ce, PH - 18 - K.rise + Math.sin(x / K.wave + o) * K.swell + Math.sin(x / 9) * 1.5 - Math.max(0, n) * 10); }
    const F = MOVE.fold, c = cell(x, F.every);
    return keepCeil(16 + a * 8 + Math.sin(Math.PI * c.t) ** .7 * (F.min + hash(c.n + o) * F.span), fl);
  }
  if (b === 'fire') {
    if (!mv) {
      const S = MOVE.spire, c = cell(x, S.every);
      return centre(ce, PH - 24 - peak(c.t) ** 2.4 * (S.min + hash(c.n + o) * S.span) - Math.abs(n) * 6);
    }
    const V = MOVE.vent, d = Math.abs(x - ventNear(x)), base = 30 + a * 10;
    return centre(d < V.half ? V.mouth : d < V.half + V.hood ? base + V.drop * (1 - (d - V.half) / V.hood) : base, fl);
  }
  if (!mv) {
    const T = MOVE.throat, g = (T.min + T.max) / 2 + (T.max - T.min) / 2 * Math.cos(2 * Math.PI * x / T.every), m = PH / 2 + Math.sin(x / 260 + o) * T.wander + n * 4;
    return [m - g / 2, m + g / 2];
  }
  const Y = MOVE.polyp, c = cell(x, Y.every), h = hash(c.n + o), r = Y.min + hash(c.n * 3.1 + o) * Y.span, d = Math.abs(c.t - .5) * Y.every;
  return keepFloor(ce, PH - 34 - n * 6 - (h < Y.bare || d >= r ? 0 : Math.sqrt(r * r - d * d)));
}

/** hazard spacing multiplier inside the gimmick of biome b, variant mv */
export const moveHazMul = (b: string, mv: number) => (b === 'ice' && !mv ? MOVE.iceHaz : 1);
