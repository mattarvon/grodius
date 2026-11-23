// =====================================================================
//  SIGNATURES AND SPACE RULES (DIFFICULTY-SPEC §2.4, levels.md). SKELETON from W0: the contract, the space-rule
//  constants and an empty window list. W3 owns this file after W0 and fills the signature tables (CREW KNOTS,
//  MORGUE RUSH, HIGH TIDE, THE GRILL, THE SWALLOW, THE STROKE) and sigWindows().
//
//  A pure leaf: it may import layout.ts (pure, no imports of its own) and nothing that touches the DOM or the sim
//  stream. tools/probe-lib.mjs and tools/route-probe.mjs call sigWindows($) every frame, so it must stay pure, draw
//  no R() and allocate nothing per call (return a table built once per stage, or the shared empty list).
// =====================================================================

/** one signature window in world x (spec §2.4; probe contract pinned in W0-CONTRACT.md):
 *  x0 / x1 the world-x span the ship is "inside the signature" (the cap context goes to 'setp', the hazard timer
 *  pauses, route-probe swaps the fit floor), floor the swept fit-gap floor inside it in px (S1: never below 72), id a
 *  stable name ('knots', 'morgue', 'tide', 'grill', 'swallow', 'stroke', with a variation suffix if W3 wants one) */
export interface SigWindow { readonly x0: number; readonly x1: number; readonly floor: number; readonly id: string }

/** the space rules (levels.md §1, spec §2.4 S1-S8), one value each, read by W3's builders, sigs.test.ts and the probes */
export const SPACE = {
  /** S1: swept fit gap (px) outside a signature window, for a 21 px ship box */
  fitGap: 100,
  /** S1: the swept fit gap is never below this inside a window */
  fitMin: 72,
  /** S1: the ship box the fit gap is swept with (px) */
  fitBox: 21,
  /** S2: moving terrain edges move at most this fast (px/f) */
  edgeV: .5,
  /** S3: a weave's dy / L is at most this */
  weave: .75,
  /** S4: every tell (frames), and a signature is on screen this long before it reaches the ship */
  tell: 44,
  sigLead: 120,
  /** S5 / C9: nothing spawns within this of the ship (px): bodies, solids and hazards; shots use rank.ts SHOT_CLEAR */
  noSpawn: 48,
  /** C9: a split child's no-spawn distance (px) */
  noSpawnKid: 30,
  /** S6: any barrier is cut by the naked gun in at most this many bolts (<= 1 s) */
  cutBolts: 8,
  /** S7: the Orbit deck dims to at most this share of its brightness */
  deckDim: .4,
  /** S8: within every span this long (px), something reaches the ship from behind, above or below */
  sanctuary: 600,
} as const;

/** decision 5A (Matt, 2026-11-22): a moving solid (piston, wedged frozen body, mucus plug) kills like a wall, through
 *  WARD. W3 builds behind this flag so a different answer is a value change (spec §6) */
export const SOLID_KILLS = true;

/** W3's per-stage signature tuning (levels.md §3.2, §5.1-5.4, §6.3: three escalating variations each). Empty in W0 */
export const SIG: Readonly<Record<string, unknown>> = {};

const NONE: readonly SigWindow[] = Object.freeze([]);
/** every signature window of the current stage, in world x. `_$` is accepted for the probes (they pass the state
 *  module's $) and may be ignored: it must answer the same with no argument (sigAt's default calls it that way). W0:
 *  none. Pure: no R(), no allocation per call (W3 returns a list built once per stage build) */
export function sigWindows(_$?: any): readonly SigWindow[] {
  return NONE;
}
/** the window containing world x `wx`, or null */
export function sigAt(wx: number, ws: readonly SigWindow[] = sigWindows()): SigWindow | null {
  for (let i = 0; i < ws.length; i++) if (wx >= ws[i].x0 && wx < ws[i].x1) return ws[i];
  return null;
}
