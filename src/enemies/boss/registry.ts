// =====================================================================
//  THE STAGE-BOSS REGISTRY (D55): a stage boss with its own file, the defineMid pattern for the bosses that end a stage.
//  One kind file per boss in this folder (enemies/boss/<k>.ts, loaded by ./index.ts), its art in
//  render/gross/boss/<k>.ts. The crux, the butcher and the Maws predate it and stay in enemies/update.ts's switch.
//
//  A leaf, like enemies/mid/roster.ts: no imports but that roster's MID_ET (ET is that same object, so a registered
//  boss's row lands in spawn.ts ET whichever module the boot reaches first), types that erase, so biomes.ts, the tests
//  and plain Node can read bossFor without the DOM.
//
//  Hooks the shared code calls (each one line in its shared file):
//   - enemies/update.ts updEnemy: `update(e)` every frame; killEnemy: `kill(e)` on the kill (its readout, the reward)
//   - enemies/mid/roster.ts midMul / midHitSnd: the entity's own `e.armor` / `e.hitSnd`, set by the spawn (every
//     damage path asks midMul, area and burn included)
//   - biomes.ts biomeScript: `spawn(b)` at the slot's boss x, `name` on the WARNING, `runup` as the run-up log line;
//     rewriteTerrain: `arena` as movement C
// =====================================================================
import { MID_ET } from '../mid/roster';

/** a stage boss's sim side, given to defineBoss by enemies/boss/<k>.ts */
export interface BossSim {
  /** its kind (e.k, the file names, the script entry's `boss:<k>`): set by defineBoss */
  k?: string;
  /** its row in enemies/spawn.ts ET: hp, r, score, bio, gore; big and mini set, never mid (killEnemy's midboss branch) */
  et: Record<string, number>;
  /** the WARNING banner and HUD name */
  name: string;
  /** the kill readout (stages.ts BOSS_READOUTS lists it, so no SLAB quip repeats it) */
  word: string;
  /** spawn it into $.G.mini in biome b (the host: a tint, never a terrain fit; it owns its arena) */
  spawn: (b: string) => void;
  /** its per-frame update (no allocation: .claude/rules/ai-code.md) */
  update: (e: any) => void;
  /** killEnemy, on the kill: the readout, the reward choice, the stage clear */
  kill: (e: any) => void;
  /** on its WARNING (biomes.ts biomeScript): audio only (a sting), no sim state */
  warn?: () => void;
  /** when its stage is built (biomes.ts biomeScript, at the gate, a minute before the fight): audio only, e.g. start
   *  decoding its lazy sound banks (audio.ts bankWant). No sim state, no R() */
  prep?: () => void;
  /** the run-up log line in place of the biome's (biomes.ts biomeScript) */
  runup?: string;
  /** movement C over its arena (biomes.ts rewriteTerrain): [c0, f0] the biome's rest edges, (ce, fl) the column's
   *  movement A terrain; writes [ceil, floor] into out. Pure */
  arena?: (c0: number, f0: number, ce: number, fl: number, out: number[]) => number[];
}
/** kind -> its sim side, filled as the kind files load. Read at call time only */
export const BOSS_SIM: Record<string, BossSim> = Object.create(null);

/** register a stage boss (each file in enemies/boss/ does, at load) */
export function defineBoss(k: string, sim: BossSim): void {
  if (BOSS_SIM[k]) throw new Error(`stage boss '${k}' is defined twice`);
  BOSS_SIM[k] = sim;
  sim.k = k;
  MID_ET[k] = sim.et;
}

// ---------------- placement (D55, Matt's decision 1) ----------------
/** the biome slot THE KEEPSAKE takes the boss of: the second biome stage (stage n-3 on long4). By slot, never by world x,
 *  so a layout that stretches its rows (D31) moves it with them */
export const KEEPSAKE_SLOT = 1;
/** the registered boss that ends biome slot `slot` in descent `loop` (0-based), or null for the biome's own boss.
 *  Picker layouts only (short stays byte-identical: layout parity). Descent 1 always meets THE KEEPSAKE in that slot;
 *  from Descent 2 it alternates with the biome's home boss by descent number (Descent 2, 4, ... the home boss; 3, 5, ...
 *  THE KEEPSAKE again). No RNG:
 *  the build streams and the checkpoint rebuild see the same draws. Pure */
export function bossFor(slot: number, loop: number, picker: boolean): string | null {
  if (!picker || slot !== KEEPSAKE_SLOT) return null;
  return (loop | 0) % 2 === 0 ? 'keepsake' : null;
}

/** a stage grade capped at `cap` (THE KEEPSAKE's enrage caps the stage at B, D55): better grades drop to it, worse ones
 *  stand, no cap is no change. stages.ts clearStage applies G.st.gcap through it. Pure */
export const capGrade = (g: string, cap: string | null | undefined) => (cap && 'SABC'.indexOf(g) < 'SABC'.indexOf(cap) ? cap : g);
