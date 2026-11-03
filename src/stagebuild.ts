// @ts-nocheck
// Build each stage on entry (D19 build plan LS1 rows C and B2). buildStage(i, fromX) writes stage i's script entries,
// and for a biome stage its terrain, into the live descent. It is the one place a stage is built, so a resume (item H)
// can rebuild any stage from stored inputs: G.seed and G.loop (the stage's build stream, src/rng.ts), G.route,
// G.visitNo, G.remixV, and the stored G.bx[slot] as fromX.
//
// What is built when:
// - The base terrain is a descent-level build (world.ts buildTerrain at startLoop): pure noise of x and the loop, no
//   RNG, so it rebuilds exactly. A biome stage blends its own terrain over it at the gate (rewriteTerrain), and that
//   blend runs into the next row (to layout().tEnd), so the base can't be laid stage by stage after it.
// - Biome stages are built at their gate: biomes.ts choose() calls biomeStage directly (not buildStage), so biomes.ts
//   gains no import of this module and the boot-time module order, which textures.ts's R() draws depend on, is unchanged.
// - Open Orbit and the Drive approach are built at their own entry (stages.ts startStage). Every draw a build makes
//   comes from the stage's own stream (B2), never the sim R(), so when a stage is built no longer moves the sim.
// - The midboss pick (item F) draws its own stream, biomes.ts midStream(i), not stageStream(i): it is independent of
//   the script's draws, so it may run before or after the script without changing either.
import { $ } from './state';
import { row, stageOfSlot } from './layout';
import { stageScript } from './enemies/scripts';
import { biomeStage, insertScript, stageStream } from './biomes';
import { buildTerrain } from './world';

/** build stage i of the active layout into the live descent. fromX: where its content may start (a biome stage: the
 *  gate x, G.bx[slot]; other kinds start at their row's x0 and ignore it). A biome stage needs G.route[slot] and
 *  G.visitNo[slot] set (choose() sets them first). Draws only stage i's build stream */
export function buildStage(i, fromX = row(i).x0) {
  const r = row(i);
  if (r.kind === 'biome') return biomeStage(r.slot, fromX);
  insertScript(stageScript(i, stageStream(i)));
}

/** the resume's rebuild (item H; spec §4 "How it restores"), from restored G: the descent's base terrain from the
 *  loop, each biome slot committed up to this stage re-blended and re-scripted from its STORED gate x G.bx[slot]
 *  (never a recomputed one) in slot order, as the run built them, then stage G.stage itself when it is not a biome
 *  stage. Entries up to cpX are skipped (they had fired by the checkpoint: runScript fires x <= scroll), the G.eat
 *  pattern done once by index. Draws only the stages' build streams, never the sim R() */
export function rebuildAt(cpX) {
  const G = $.G;
  buildTerrain(G.loop);
  G.script = [];
  G.si = 0;
  for (let s = 0; s < G.route.length; s++) if (G.route[s] && G.bx[s] != null && stageOfSlot(s) <= G.stage) biomeStage(s, G.bx[s]);
  if (row(G.stage).kind !== 'biome') buildStage(G.stage);
  let i = 0;
  while (i < G.script.length && G.script[i].x <= cpX) i++;
  G.si = i;
}
