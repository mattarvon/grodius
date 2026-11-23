// =====================================================================
//  SOLIDS: moving slabs (pistons, wedged frozen bodies, mucus plugs; DIFFICULTY-SPEC §2.4 "Shared code", levels.md
//  §2.1). STUB from W0: every query answers "no solid", so the hooks it is called from (player.ts terrain death,
//  shots.ts player and enemy shots, contraptions.ts solid(), step.ts stepSolids) merge inert. W3 fills the body and
//  render/solids.ts; the signatures (sigs.ts) place the slabs.
//
//  Collision rule (decision 5A, sigs.ts SOLID_KILLS): a solid is terrain. It kills the ship through WARD on the same
//  5-point test as FLOOR/CEIL (player.ts), stops player and enemy shots (a player shot may cut a cuttable slab, S6),
//  and stops contraption shots.
//
//  Contract for W3:
//  - solidAt / solidsCol are PURE reads of the current slab table: no R(), no allocation per call (tools/probe-lib.mjs
//    and space-probe call solidsCol every frame; player.ts calls solidAt 5 times a frame). Test only slabs near wx.
//  - stepSolids() is the one writer, once per world step (step.ts, before the player moves). Motion is frame-counter
//    or world-x math (spec §5.2): no R().
//  - solidShot() is the only call that may change a slab (damage from a player shot); it returns whether the shot hit.
//  - resetSolids() clears the table (stage build, checkpoint restore: slabs are rebuilt from the fixed table, never
//    saved; spec §5.4).
// =====================================================================

/** a blocked vertical interval [y0, y1] (screen y, y0 < y1) of a slab at one world x */
export type Span = readonly [number, number];

const NONE: readonly Span[] = Object.freeze([]);

/** is world point (wx, y) inside a solid? W0: never. Pure */
export function solidAt(_wx: number, _y: number): boolean {
  return false;
}
/** the blocked y intervals of every slab at world x `wx`, as [y0, y1][] (probe contract). W0: none. Pure */
export function solidsCol(_wx: number): readonly Span[] {
  return NONE;
}
/** a player shot of damage `dmg` at world point (wx, y): true when a slab stopped it (and took the damage if it is
 *  cuttable, S6). W0: never */
export function solidShot(_wx: number, _y: number, _dmg: number): boolean {
  return false;
}
/** advance every slab one world step (step.ts). W0: nothing to move */
export function stepSolids(): void {}
/** drop every slab (stage build, restore) */
export function resetSolids(): void {}
