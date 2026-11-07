// =====================================================================
//  MIDBOSS SLOTS IN PLAY (build plan LS1 row F; design/content-expansion.md §3.2 "Breath 2 safety", §6.3, §6.4).
//  The run-time side of the picker (src/midpick.ts picks at build time): what a stage's slot does when the scroll
//  reaches it, and the guards around G.mini, the single midboss slot that midboss() / spawnUfo() overwrite.
//
//  - whenNoMini: slot B's miniWarn and its spawn wait while G.mini is non-null, re-checking every frame (rule 2, the
//    explicit backstop: rule 1, the DRIFT forced exit, means it never triggers in normal play).
//  - fillerQuiet: on a picker layout the stage's filler is skipped while a midboss is up (the precondition of item K;
//    the Saucer's G.eat window, generalised). Set pieces, cells, log lines, pods and every WARNING still play.
//  - meetMid: $.meta.mb[k] += 1 when a midboss arrives (the picker's cross-run weighting, spec §6.3 step 4).
//  - DRIFT spawners register here (enemies/mid/ufo.ts), so biomes.ts can place a DRIFT midboss in a biome slot without
//    importing mid/ufo.ts (the boot-time module order, which textures.ts's R() draws depend on, stays as it was).
//  Imports only state and layout: no canvas, no audio, so tests drive it directly.
// =====================================================================
import { $ } from './state';
import { layout } from './layout';
import { midRow } from './enemies/mid/roster';

/** run f now if no midboss holds G.mini, else re-check every frame until none does (spec §3.2 rule 2) */
export function whenNoMini(f: () => void): void {
  if (!$.G.mini) { f(); return; }
  $.G.pend.push({ t: 1, f: () => whenNoMini(f) });
}

/** a midboss is up and fighting: G.mini is set and not on its way out (a withdrawing one no longer eats the stage) */
export const miniUp = () => { const m = $.G && $.G.mini; return !!m && !m.dead && !m.gone; };

/** the biome script's spawn-roll kinds (biomes.ts SPAWN; tests/unit/midslot.test.ts keeps the two in step) */
export const BIOME_FILL: ReadonlySet<string> = new Set(['corpse', 'wall', 'sine', 'zig', 'dive', 'cross', 'eye', 'flayer', 'hook', 'womb', 'hatch', 'crawler', 'behind', 'slime', 'mutant']);

/** is script entry kind k filler: a biome spawn roll, or long Orbit / Drive generator filler (`fill:<kind>`).
 *  Hand-made cells, set pieces, pods, log lines, WARNINGs and bosses are not */
export const isFiller = (k: string | undefined) => !!k && (k.startsWith('fill:') || BIOME_FILL.has(k));

/** runScript: skip this entry because a midboss is up (picker layouts only; short is unchanged) */
export const fillerQuiet = (k: string | undefined) => !!layout().picker && isFiller(k) && miniUp();

/** a midboss of kind k has arrived: count the meeting in $.meta.mb (saved with the meta at the next save()) */
export function meetMid(k: string): void {
  if (midRow(k)?.wip) return; // an unfinished kind (?mids=wip) leaves the real profile's weights alone
  const mb = ($.meta.mb ||= {});
  mb[k] = (mb[k] || 0) + 1;
}

/** D27 (production/decision-log.md): on picker layouts every held midboss kind aims at one TTK band, 8-11 s at the
 *  stage-1 kit (tools/midboss-probe.mjs --layout long4), set by its base HP. Kinds listed here override spawn.ts ET's
 *  base HP; the rest already sit in the band (Choir 10.0, Womb 8.7, Brood 9.4 s). DRIFT kinds are exempt: their
 *  forced exit sets the fight's length. `short` has no picker and keeps ET's values, so layout parity holds */
export const MID_HP: Readonly<Record<string, number>> = {
  prentice: 200, // was 150: 6.8 s, under the band. Measured 10.2 s at 200 (midboss-probe --layout long4 --leave 1080);
  // the +50 HP added 3.4 s, ~14.7 HP/s, matching spec §6.2's stage-1 DPS. Predict the next kind from that per-HP rate
};
/** midboss(): the HP multiplier for kind k (base = its ET base HP); 1 off picker layouts or for an unlisted kind */
export const midHpMul = (k: string, base: number) => (layout().picker && MID_HP[k] ? MID_HP[k] / base : 1);

/** a DRIFT midboss's spawner: exitX = the scroll x it is forced out at, leave = its slot clock (frames) */
export type DriftSpawn = (exitX: number, leave: number) => void;
const DRIFT: Record<string, { name: string; spawn: DriftSpawn }> = {};
/** register a DRIFT midboss kind (enemies/mid/ufo.ts does, at load) */
export function registerDrift(k: string, name: string, spawn: DriftSpawn): void { DRIFT[k] = { name, spawn }; }
/** the registered DRIFT midboss of kind k, or undefined */
export const driftOf = (k: string) => DRIFT[k];
