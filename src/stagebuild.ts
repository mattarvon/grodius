// @ts-nocheck
// Build each stage on entry (D19 build plan LS1 row C). buildStage(i, fromX) writes stage i's script entries, and
// for a biome stage its terrain, into the live descent; it is the one place a stage is built, so a resume (item H)
// can rebuild any stage from its stored inputs (G.route, G.visitNo, the stored G.bx[slot] as fromX, G.remixV).
//
// What is built when, and why (rows C and B2):
// - The base terrain is a descent-level build (world.ts buildTerrain at startLoop): pure noise of x and the loop, no
//   R() draw, so it rebuilds exactly. A biome stage blends its own terrain over it at the gate (rewriteTerrain), and
//   that blend runs into the next row (to layout().tEnd), so the base can't be laid stage by stage after it.
// - Biome stages are built at their gate (biomes.ts choose()), as before.
// - Open Orbit and the Drive approach: their variant picks still draw the sim R() at startLoop (pickStageVariants,
//   same draws, same order, same moment), and buildStage places them without drawing. Row C keeps placing them at
//   startLoop too: tools/layout-parity.mjs records each stage's whole remaining script at stage start, so placing
//   the Drive at its own entry would move that record even with play unchanged (row C's gate is parity diff 0).
//   biomes.ts choose() calls biomeStage directly (not buildStage) so biomes.ts gains no import of this module and
//   the boot-time module order, which the texture builders' R() draws depend on, is unchanged.
//   B2 puts these picks on the per-stage build stream, after which a stage can be placed at its real entry.
import { row } from './layout';
import { stageScript } from './enemies/scripts';
import { biomeStage, insertScript } from './biomes';

/** build stage i of the active layout into the live descent. fromX: where its content may start (a biome stage: the
 *  gate x, G.bx[slot]; other kinds start at their row's x0 and ignore it). A biome stage needs G.route[slot] and
 *  G.visitNo[slot] set (choose() sets them first). Draws no R() for Orbit/Drive (picked at startLoop) */
export function buildStage(i, fromX = row(i).x0) {
  const r = row(i);
  if (r.kind === 'biome') return biomeStage(r.slot, fromX);
  insertScript(stageScript(i));
}
