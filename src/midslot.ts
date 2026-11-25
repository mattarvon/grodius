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
import { ECON, econId } from './economy';

/** run f now if no midboss holds G.mini, else re-check every frame until none does (spec §3.2 rule 2) */
export function whenNoMini(f: () => void): void {
  if (!$.G.mini) { f(); return; }
  $.G.pend.push({ t: 1, f: () => whenNoMini(f) });
}

/** a midboss is up and fighting: G.mini is set and not on its way out (a withdrawing one no longer eats the stage) */
export const miniUp = () => { const m = $.G && $.G.mini; return !!m && !m.dead && !m.gone; };

/** the biome script's spawn-roll kinds (biomes.ts SPAWN; tests/unit/midslot.test.ts keeps the two in step) */
export const BIOME_FILL: ReadonlySet<string> = new Set(['corpse', 'wall', 'sine', 'zig', 'dive', 'cross', 'eye', 'flayer', 'hook', 'womb', 'hatch', 'crawler', 'behind', 'slime', 'mutant', 'dolls']);

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
  prentice: 180, // D61 Pass 1: 200 -> 180 (its hook turn replaced the 2nd lunge and pushed it to 11.7 s, over slot A 8-11). Was 150: 6.8 s, under the band. Measured 10.2 s at 200 (midboss-probe --layout long4 --leave 1080);
  // the +50 HP added 3.4 s, ~14.7 HP/s, matching spec §6.2's stage-1 DPS. Predict the next kind from that per-HP rate
};
/** DIFFICULTY-SPEC §2.3 (W4a): the Descent 1 midbosses' HP on long4's hard set, where the dial and powHP no longer touch
 *  HP (C30, E10). A kind here overrides MID_HP and ET there; its TTK targets are the fight table's, measured by
 *  tools/midboss-probe.mjs --layout long4 --leave 1080 at the STAGE 1 kit (slot A 8-11 s). [FIT] values: fitted on the
 *  probe before merge. The Saucer (DRIFT, spawned by ufo.ts) reads its row here too */
export const MID_HP_G3: Readonly<Record<string, number>> = {
  ufo: 44, //      [FIT] W6 round 3 integration: fitted to the kit a ship holds at its WARNING (~20 s into Orbit: 2-3 pods, e.g. THRUST +
  //               MISSILE, no graft or perk), not the STAGE 1 kit, which a ship meets only after the Orbit Maw. At 58 the deathless E2 bot
  //               left it with 16-24% HP at its ~15.2 s forced exit on 5 of 5 seeds (no kill pair, no first-kill pay, no Orbit grade S:
  //               r3-econ's E2/K0/E9 cause); 48 killed 2/5, 44 kills 4/5 in 10.8-12.8 s (s7, MISSILE + WRAITH + WARD, leaves at 13%),
  //               40 4/5 (pod-probe fights[], seeds 1/3/5/7/11). THE LEAN is kept (its reach, not its bullets, is the design).
  //               At the STAGE 1 kit this reads under spec §2.3's 8-11 s (gates-after3.md K3). Before: 58, W6 tune-tf: THE LEAN (ufo.ts UFO_LEAN) brings it 100-170 px nearer the ship: 50 ran 8.1 s. Before: 56 ran 11.8 s; spec §2.3 starts at 80 (64 if over 11 s); with the core rule (wings .3) the STAGE 1 kit ran out its forced exit at 80
  choir: 58, //    [FIT] W6 tune-tf: the eye at .7 (choir.ts CHOIR_EYE), the lane bar armoured. W0's rank: 52 ran 12.2 s. Before W0: 48 ran 10.0 s; 58 ran 12.6 s; ET 80: with the eye at .4 while a bar lives the STAGE 1 kit took 14.0 s at 80 (slot A 8-11)
  cyst: 155, //    [FIT] r3: 210 ran 13.1 s once the Womb's bob is fitted above the merged acid floor (cyst.ts: buried, the ship's ground
  //               missiles crawled into it); 155 runs ~10.5 s with the bob refitted into the band. W6 tune-tf: 156 ran 7.7 s on the merged build (8-11); 192 ran 8.8 s with its first half a frame short of its second attack (K1), 220 ran 10.6. ET 135 ran 8.9 s before W0: inside the band, but its phase 1 was too short for its slow moves to reach every spot (K1)
  brood: 120, //   [FIT] ET 105 ran 8.9 s: as the Womb (K1)
  prentice: 172, // [FIT] r4: 180 (MID_HP's D61 value) ran 11.2 / 11.3 s at the STAGE 1 kit on g3-tune3 (8-11: the faucet's and SPLIT
  //               flank changes moved the kit's dps); x.955 for ~10.7 s. Before: 9.8 s on the W6 build
};
/** the HP table midboss k reads on this layout: MID_HP_G3 on long4's hard set, else MID_HP (both picker-only) */
export const midHpOf = (k: string): number | undefined => (ECON[econId()].hard && MID_HP_G3[k]) || MID_HP[k];
/** midboss(): the HP multiplier for kind k (base = its ET base HP); 1 off picker layouts or for an unlisted kind */
export const midHpMul = (k: string, base: number) => { const h = layout().picker ? midHpOf(k) : undefined; return h ? h / base : 1; };

/** a DRIFT midboss's spawner: exitX = the scroll x it is forced out at, leave = its slot clock (frames) */
export type DriftSpawn = (exitX: number, leave: number) => void;
const DRIFT: Record<string, { name: string; spawn: DriftSpawn }> = {};
/** register a DRIFT midboss kind (enemies/mid/ufo.ts does, at load) */
export function registerDrift(k: string, name: string, spawn: DriftSpawn): void { DRIFT[k] = { name, spawn }; }
/** the registered DRIFT midboss of kind k, or undefined */
export const driftOf = (k: string) => DRIFT[k];
